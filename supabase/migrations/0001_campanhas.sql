-- 0001_campanhas.sql
-- Perfis, campanhas, participantes e convites, com Row Level Security.
--
-- Modelo de segurança:
--  * Tudo aqui é PRIVADO: o papel `anon` (visitante) não tem nenhum acesso. O conteúdo público
--    (catálogo SRD) virá em migrações próprias, com SELECT liberado a `anon` só nessas tabelas.
--  * Clientes NÃO inserem direto em campaigns / campaign_members / campaign_invites: criar campanha,
--    criar convite, entrar por convite e mudar papel só existem como funções (RPC) que validam
--    tudo no servidor. Assim ninguém se promove a mestre nem entra sem convite válido.
--  * O convite não carrega papel: quem entra por convite é sempre `jogador`.
--  * Políticas usam funções SECURITY DEFINER (is_member / is_master) para evitar recursão de RLS.
-- Como aplicar: cole no SQL Editor do Supabase (ou `supabase db push`). Ver docs na seção 5 do DECISOES.

-- ---------------------------------------------------------------- perfis
create table public.profiles (
  id           uuid primary key references auth.users (id) on delete cascade,
  display_name text not null default '' check (char_length(display_name) <= 60),
  created_at   timestamptz not null default now()
);

-- Cria o perfil automaticamente com o trecho local do e-mail como nome inicial (editável).
create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, left(coalesce(split_part(new.email, '@', 1), ''), 60))
  on conflict (id) do nothing;
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- ------------------------------------------------------------- campanhas
create table public.campaigns (
  id          uuid primary key default gen_random_uuid(),
  name        text not null check (char_length(btrim(name)) between 1 and 80),
  description text not null default '' check (char_length(description) <= 1000),
  created_by  uuid not null references auth.users (id) on delete restrict,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index campaigns_created_by_idx on public.campaigns (created_by);

create table public.campaign_members (
  campaign_id uuid not null references public.campaigns (id) on delete cascade,
  user_id     uuid not null references public.profiles (id) on delete cascade,  -- via profiles: permite embutir o nome na consulta
  role        text not null check (role in ('mestre', 'jogador')),
  joined_at   timestamptz not null default now(),
  primary key (campaign_id, user_id)
);
create index campaign_members_user_idx on public.campaign_members (user_id);

create table public.campaign_invites (
  id          uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns (id) on delete cascade,
  code        text not null unique check (code ~ '^[A-Z0-9]{12}$'),
  created_by  uuid not null references auth.users (id) on delete cascade,
  created_at  timestamptz not null default now(),
  expires_at  timestamptz not null,
  max_uses    int not null check (max_uses between 1 and 50),
  uses        int not null default 0 check (uses >= 0),
  check (uses <= max_uses)
);
create index campaign_invites_campaign_idx on public.campaign_invites (campaign_id);

-- ------------------------------------------------------------- funções auxiliares
create function public.is_member(cid uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.campaign_members m where m.campaign_id = cid and m.user_id = auth.uid())
$$;

create function public.is_master(cid uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.campaign_members m where m.campaign_id = cid and m.user_id = auth.uid() and m.role = 'mestre')
$$;

-- O usuário atual divide alguma campanha com `uid`? (para ver nomes de companheiros de mesa)
create function public.shares_campaign(uid uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.campaign_members a
    join public.campaign_members b on b.campaign_id = a.campaign_id
    where a.user_id = auth.uid() and b.user_id = uid)
$$;

create function public.touch_updated_at() returns trigger language plpgsql set search_path = '' as $$
begin new.updated_at := now(); return new; end $$;
create trigger campaigns_touch before update on public.campaigns
  for each row execute function public.touch_updated_at();

-- Uma campanha nunca fica sem mestre (sair, ser removido ou ser rebaixado como último mestre).
create function public.guard_last_master() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if old.role = 'mestre' and (tg_op = 'DELETE' or new.role <> 'mestre')
     and exists (select 1 from public.campaigns c where c.id = old.campaign_id)   -- exclusão em cascata da campanha é permitida
     and not exists (select 1 from public.campaign_members m
                     where m.campaign_id = old.campaign_id and m.role = 'mestre' and m.user_id <> old.user_id) then
    raise exception 'ultimo_mestre' using errcode = '23514';
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end $$;
create trigger campaign_members_guard before update or delete on public.campaign_members
  for each row execute function public.guard_last_master();

-- ------------------------------------------------------------- operações (RPC)
create function public.create_campaign(p_name text, p_description text default '') returns uuid
language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid(); cid uuid;
begin
  if uid is null then raise exception 'nao_autenticado' using errcode = '28000'; end if;
  p_name := btrim(coalesce(p_name, ''));
  if char_length(p_name) not between 1 and 80 then raise exception 'nome_invalido' using errcode = '22023'; end if;
  if char_length(coalesce(p_description, '')) > 1000 then raise exception 'descricao_invalida' using errcode = '22023'; end if;
  if (select count(*) from public.campaigns where created_by = uid) >= 20 then raise exception 'limite_campanhas' using errcode = '54000'; end if;
  insert into public.campaigns (name, description, created_by) values (p_name, coalesce(p_description, ''), uid) returning id into cid;
  insert into public.campaign_members (campaign_id, user_id, role) values (cid, uid, 'mestre');
  return cid;
end $$;

create function public.create_invite(p_campaign_id uuid, p_max_uses int default 5, p_days int default 7) returns text
language plpgsql security definer set search_path = '' as $$
declare c text;
begin
  if auth.uid() is null then raise exception 'nao_autenticado' using errcode = '28000'; end if;
  if not public.is_master(p_campaign_id) then raise exception 'sem_permissao' using errcode = '42501'; end if;
  if (select count(*) from public.campaign_invites where campaign_id = p_campaign_id and expires_at > now() and uses < max_uses) >= 20 then
    raise exception 'limite_convites' using errcode = '54000';
  end if;
  c := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 12));
  insert into public.campaign_invites (campaign_id, code, created_by, expires_at, max_uses)
  values (p_campaign_id, c, auth.uid(), now() + make_interval(days => least(greatest(coalesce(p_days, 7), 1), 30)), least(greatest(coalesce(p_max_uses, 5), 1), 50));
  return c;
end $$;

-- Entrar por código. Qualquer falha devolve o MESMO erro (não revela se o código existe).
create function public.join_campaign(p_code text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare inv public.campaign_invites;
begin
  if auth.uid() is null then raise exception 'nao_autenticado' using errcode = '28000'; end if;
  select * into inv from public.campaign_invites where code = upper(btrim(coalesce(p_code, ''))) for update;
  if not found or inv.expires_at <= now() or inv.uses >= inv.max_uses then
    raise exception 'convite_invalido' using errcode = '22023';
  end if;
  if exists (select 1 from public.campaign_members where campaign_id = inv.campaign_id and user_id = auth.uid()) then
    return inv.campaign_id;  -- já participa: idempotente, não consome o convite
  end if;
  insert into public.campaign_members (campaign_id, user_id, role) values (inv.campaign_id, auth.uid(), 'jogador');
  update public.campaign_invites set uses = uses + 1 where id = inv.id;
  return inv.campaign_id;
end $$;

create function public.set_member_role(p_campaign_id uuid, p_user_id uuid, p_role text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'nao_autenticado' using errcode = '28000'; end if;
  if not public.is_master(p_campaign_id) then raise exception 'sem_permissao' using errcode = '42501'; end if;
  if p_role not in ('mestre', 'jogador') then raise exception 'papel_invalido' using errcode = '22023'; end if;
  update public.campaign_members set role = p_role where campaign_id = p_campaign_id and user_id = p_user_id;
  if not found then raise exception 'participante_inexistente' using errcode = '22023'; end if;
end $$;

-- ------------------------------------------------------------- privilégios
-- O Supabase concede acesso amplo por padrão a anon/authenticated: retiramos tudo e liberamos o mínimo.
revoke all on public.profiles, public.campaigns, public.campaign_members, public.campaign_invites from anon, authenticated, public;
grant select on public.profiles, public.campaigns, public.campaign_members, public.campaign_invites to authenticated;
grant update (display_name) on public.profiles to authenticated;
grant update (name, description) on public.campaigns to authenticated;
grant delete on public.campaigns, public.campaign_members, public.campaign_invites to authenticated;

revoke all on function
  public.handle_new_user(), public.is_member(uuid), public.is_master(uuid), public.shares_campaign(uuid), public.touch_updated_at(), public.guard_last_master(),
  public.create_campaign(text, text), public.create_invite(uuid, int, int), public.join_campaign(text), public.set_member_role(uuid, uuid, text)
  from public, anon, authenticated;
grant execute on function
  public.is_member(uuid), public.is_master(uuid), public.shares_campaign(uuid),
  public.create_campaign(text, text), public.create_invite(uuid, int, int), public.join_campaign(text), public.set_member_role(uuid, uuid, text)
  to authenticated;

-- ------------------------------------------------------------- RLS
alter table public.profiles          enable row level security;
alter table public.campaigns         enable row level security;
alter table public.campaign_members  enable row level security;
alter table public.campaign_invites  enable row level security;

create policy profiles_select on public.profiles for select to authenticated
  using (id = auth.uid() or public.shares_campaign(id));
create policy profiles_update on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

create policy campaigns_select on public.campaigns for select to authenticated using (public.is_member(id));
create policy campaigns_update on public.campaigns for update to authenticated
  using (public.is_master(id)) with check (public.is_master(id));
create policy campaigns_delete on public.campaigns for delete to authenticated using (public.is_master(id));

create policy members_select on public.campaign_members for select to authenticated using (public.is_member(campaign_id));
-- Mestre remove qualquer participante; qualquer um pode sair. Sem policy de INSERT/UPDATE: só via RPC.
create policy members_delete on public.campaign_members for delete to authenticated
  using (public.is_master(campaign_id) or user_id = auth.uid());

-- Convites (códigos) são segredo do mestre: jogadores não os enxergam.
create policy invites_select on public.campaign_invites for select to authenticated using (public.is_master(campaign_id));
create policy invites_delete on public.campaign_invites for delete to authenticated using (public.is_master(campaign_id));

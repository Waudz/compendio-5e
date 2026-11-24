-- 0011 — PROPOSTA, NÃO APLICADA ao Supabase hospedado. Só o responsável autoriza aplicar: apresentar este SQL, os resultados de `supabase/combate-status.test.ts`
-- e a reversão (`supabase/rollback/0011_character_combat_status_down.sql`) antes. Depende de 0001–0008 (character_sheets) e da 0009 (schema `private_combates`).
--
-- Sincronização AUTORIZADA de PV e condições do combate com a ficha do personagem (decisão de 23/11/2026):
--  • o MESTRE grava `character_combat_status` SOMENTE pela função `public.set_combat_status` (SECURITY DEFINER mínima, confere `is_master` da campanha da ficha);
--  • o JOGADOR lê apenas o status da PRÓPRIA ficha (e o mestre da campanha lê os da campanha); não há acesso a `campaign_combats`, ordem, turno, rodada
--    nem a outros combatentes: a linha só tem PV, PV máximo, condições, versão e horário;
--  • nenhuma política de INSERT/UPDATE/DELETE para o cliente; o status NÃO altera `character_sheets` (nem sua revisão): não conflita com a edição da ficha pelo dono;
--  • `public.clear_combat_status` (mestre) limpa os status da campanha ao finalizar o combate.
-- Incremental: não toca em nenhuma tabela ou dado existente.
begin;

create schema if not exists private_combates;
create function private_combates.valid_condicoes(c jsonb) returns boolean
language plpgsql immutable security invoker set search_path = '' as $$
declare x jsonb;
begin
  if c is null or jsonb_typeof(c) <> 'array' or jsonb_array_length(c) > 16 then return false; end if;
  for x in select value from jsonb_array_elements(c) loop
    if jsonb_typeof(x) is distinct from 'string' or char_length(btrim(x #>> '{}')) = 0 or char_length(x #>> '{}') > 40 then return false; end if;
  end loop;
  return true;
end $$;
revoke all on function private_combates.valid_condicoes(jsonb) from public, anon, authenticated;
grant usage on schema private_combates to authenticated;
grant execute on function private_combates.valid_condicoes(jsonb) to authenticated;

create table public.character_combat_status (
  character_id uuid primary key references public.character_sheets (character_id) on delete cascade,
  campaign_id  uuid not null references public.campaigns (id) on delete cascade,
  current_hp   integer check (current_hp between 0 and 1000000),
  max_hp       integer check (max_hp between 1 and 1000000),
  conditions   jsonb   not null default '[]'::jsonb,
  version      bigint  not null default 1 check (version between 1 and 9007199254740991),
  updated_at   timestamptz not null default now(),
  constraint character_combat_status_hp_pair check ((current_hp is null) = (max_hp is null) and (current_hp is null or current_hp <= max_hp)),
  constraint character_combat_status_conditions check (coalesce(private_combates.valid_condicoes(conditions), false))
);
create index character_combat_status_campaign_idx on public.character_combat_status (campaign_id);

alter table public.character_combat_status enable row level security;
revoke all on table public.character_combat_status from public, anon, authenticated;
grant select on table public.character_combat_status to authenticated;
create policy character_combat_status_select on public.character_combat_status for select to authenticated
  using (public.is_master(campaign_id)
         or exists (select 1 from public.character_sheets s where s.character_id = character_combat_status.character_id and s.owner_id = (select auth.uid()) and public.is_member(s.campaign_id)));

-- Mestre: define PV/condições da ficha. Devolve a nova versão. A autorização é conferida NO BANCO (campanha lida da própria ficha, nunca do cliente).
create function public.set_combat_status(p_character_id uuid, p_current_hp integer, p_max_hp integer, p_conditions jsonb default '[]'::jsonb) returns bigint
language plpgsql security definer set search_path = '' as $$
declare v_campaign uuid; v_version bigint;
begin
  if (select auth.uid()) is null then raise exception 'nao_autenticado' using errcode = '42501'; end if;
  select s.campaign_id into v_campaign from public.character_sheets s where s.character_id = p_character_id;
  if v_campaign is null then raise exception 'ficha_inexistente' using errcode = 'P0002'; end if;
  if not public.is_master(v_campaign) then raise exception 'apenas_mestre' using errcode = '42501'; end if;
  insert into public.character_combat_status as t (character_id, campaign_id, current_hp, max_hp, conditions)
  values (p_character_id, v_campaign, p_current_hp, p_max_hp, coalesce(p_conditions, '[]'::jsonb))
  on conflict (character_id) do update set current_hp = excluded.current_hp, max_hp = excluded.max_hp, conditions = excluded.conditions, version = t.version + 1, updated_at = clock_timestamp()
  returning t.version into v_version;
  return v_version;
end $$;
revoke all on function public.set_combat_status(uuid, integer, integer, jsonb) from public, anon;
grant execute on function public.set_combat_status(uuid, integer, integer, jsonb) to authenticated;

-- Mestre: ao finalizar o combate, remove os status da campanha (as fichas voltam a mostrar só o que o dono registrou).
create function public.clear_combat_status(p_campaign_id uuid) returns integer
language plpgsql security definer set search_path = '' as $$
declare n integer;
begin
  if (select auth.uid()) is null or not public.is_master(p_campaign_id) then raise exception 'apenas_mestre' using errcode = '42501'; end if;
  delete from public.character_combat_status where campaign_id = p_campaign_id;
  get diagnostics n = row_count;
  return n;
end $$;
revoke all on function public.clear_combat_status(uuid) from public, anon;
grant execute on function public.clear_combat_status(uuid) to authenticated;

-- Realtime (somente quando a publicação existir, como no Supabase): o jogador recebe a mudança do PRÓPRIO status, filtrada pela RLS acima.
do $$ begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.character_combat_status;
  end if;
exception when others then null;
end $$;
commit;

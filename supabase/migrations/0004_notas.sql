-- 0004_notas.sql
-- Notas e diário com visibilidade controlada no BANCO (RLS). Reversão: supabase/rollback/0004_notas_down.sql
--
-- Visibilidade (campo notes.visibility):
--   private   somente o autor (padrão; única opção para nota pessoal, sem campanha)
--   master    autor e o mestre da campanha
--   campaign  autor e todos os participantes atuais da campanha
--   selected  autor e participantes escolhidos (tabela note_shares), desde que ainda participem
-- Regras:
--   * Mestre NÃO enxerga nota privada de jogador. Nada é automático: só o que o autor compartilha.
--   * Participação é verificada AGORA, em cada consulta (quem saiu ou foi removido perde o acesso na hora).
--   * O compartilhamento só vale enquanto o AUTOR também participa da campanha (ver "quem sai" abaixo).
--   * owner_id e campaign_id são imutáveis (privilégio de coluna + gatilho). Só o autor escreve e exclui.
--   * note_readable / can_read_note(id) são a ÚNICA definição de "posso ler esta nota": links, busca e histórico (próximas
--     migrações) devem usá-la nas suas políticas, para nunca vazar título, prévia ou existência.
--   * Escrita com controle otimista: version é incrementada só pelo servidor; o cliente atualiza com
--     "... where id = ? and version = ?" e 0 linhas significa conflito (nada é sobrescrito em silêncio).
--
-- Política de quem sai/é removido da campanha (padrão conservador, sem apagar nada e reversível):
--   * As notas do autor são mantidas; ele continua lendo e excluindo as suas, mas não edita notas de uma
--     campanha da qual não participa (a escrita exige participação atual).
--   * O compartilhamento fica INATIVO: mestre e demais deixam de ver as notas dele enquanto ele estiver fora.
--     Se ele voltar por convite, o compartilhamento original volta a valer.
--   * A exclusão da campanha apaga suas notas (cascata); a exclusão da conta apaga as notas da conta.

-- ------------------------------------------------------------------ tabelas
create table public.notes (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  campaign_id uuid references public.campaigns (id) on delete cascade,
  title       text not null check (char_length(btrim(title)) between 1 and 120),
  body        text not null default '' check (char_length(body) <= 50000),
  visibility  text not null default 'private' check (visibility in ('private', 'master', 'campaign', 'selected')),
  version     int  not null default 1,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  check (campaign_id is not null or visibility = 'private')      -- nota pessoal nunca é compartilhável
);
create index notes_owner_idx on public.notes (owner_id, updated_at desc);
create index notes_campaign_idx on public.notes (campaign_id, visibility) where campaign_id is not null;

create table public.note_shares (
  note_id uuid not null references public.notes (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (note_id, user_id)
);
create index note_shares_user_idx on public.note_shares (user_id);

-- ------------------------------------------------------------------ funções auxiliares
-- As 4 funções abaixo são SECURITY DEFINER com search_path vazio (precisam ler tabelas que o chamador não lê);
-- só respondem "sim" a quem já tem direito (sem oráculo de existência). Os gatilhos NÃO são definer.

create function public.is_note_owner(nid uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.notes n where n.id = nid and n.owner_id = auth.uid())
$$;

-- Regra única de leitura, sobre as colunas da própria linha (não relê a tabela: assim também vale para
-- INSERT ... RETURNING, em que a linha nova ainda não é visível a uma subconsulta).
create function public.note_readable(nid uuid, owner uuid, campaign uuid, vis text) returns boolean
language sql stable security definer set search_path = '' as $$
  select auth.uid() is not null and (
    owner = auth.uid()
    or (
      campaign is not null and vis <> 'private'
      and public.is_member(campaign)                                                                              -- leitor participa agora
      and exists (select 1 from public.campaign_members a where a.campaign_id = campaign and a.user_id = owner)   -- autor também
      and (
        vis = 'campaign'
        or (vis = 'master' and public.is_master(campaign))
        or (vis = 'selected' and exists (select 1 from public.note_shares s where s.note_id = nid and s.user_id = auth.uid()))
      )
    ))
$$;

-- Versão por id, para políticas de links/busca/histórico. false para nota inexistente OU inacessível (sem oráculo).
create function public.can_read_note(nid uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce((select public.note_readable(n.id, n.owner_id, n.campaign_id, n.visibility) from public.notes n where n.id = nid), false)
$$;

-- O autor atual pode compartilhar `nid` com `uid`? (dono, nota de campanha, destinatário participa, não é o próprio autor)
create function public.can_share_note(nid uuid, uid uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.notes n
    where n.id = nid and n.owner_id = auth.uid() and n.campaign_id is not null and uid <> n.owner_id
      and exists (select 1 from public.campaign_members m where m.campaign_id = n.campaign_id and m.user_id = uid)
      and public.is_member(n.campaign_id))
$$;

-- ------------------------------------------------------------------ gatilhos
-- Gatilhos rodam como o USUÁRIO que escreve (SECURITY INVOKER): nenhuma elevação de privilégio, a RLS vale também dentro deles.
create function public.notes_before_update() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.owner_id <> old.owner_id or new.campaign_id is distinct from old.campaign_id or new.id <> old.id then
    raise exception 'campo_imutavel' using errcode = '23514';
  end if;
  new.version := old.version + 1;          -- só o servidor decide a versão
  new.created_at := old.created_at;
  new.updated_at := now();
  if old.visibility = 'selected' and new.visibility <> 'selected' then
    delete from public.note_shares where note_id = old.id;   -- lista de selecionados não sobrevive a mudança de visibilidade
  end if;
  return new;
end $$;
create trigger notes_before_update before update on public.notes for each row execute function public.notes_before_update();

-- Limites: AFTER INSERT, ou seja, só depois da checagem de RLS (quem não tem direito recebe o erro genérico de RLS,
-- sem descobrir quantos compartilhamentos ou notas existem). Invoker: contam o que o próprio autor enxerga.
create function public.note_shares_limit() returns trigger
language plpgsql set search_path = '' as $$
begin
  if (select count(*) from public.note_shares where note_id = new.note_id) > 50 then raise exception 'limite_compartilhamentos' using errcode = '54000'; end if;
  return null;
end $$;
create trigger note_shares_limit after insert on public.note_shares for each row execute function public.note_shares_limit();

create function public.notes_owner_limit() returns trigger
language plpgsql set search_path = '' as $$
begin
  if (select count(*) from public.notes where owner_id = new.owner_id) > 5000 then raise exception 'limite_notas' using errcode = '54000'; end if;
  return null;
end $$;
create trigger notes_owner_limit after insert on public.notes for each row execute function public.notes_owner_limit();

-- ------------------------------------------------------------------ privilégios
revoke all on public.notes, public.note_shares from anon, authenticated, public;
grant select, delete on public.notes, public.note_shares to authenticated;
grant insert (campaign_id, title, body, visibility) on public.notes to authenticated;     -- owner_id sempre = auth.uid() (default)
grant update (title, body, visibility) on public.notes to authenticated;                  -- owner_id e campaign_id imutáveis
grant insert (note_id, user_id) on public.note_shares to authenticated;

revoke all on function
  public.is_note_owner(uuid), public.note_readable(uuid, uuid, uuid, text), public.can_read_note(uuid), public.can_share_note(uuid, uuid),
  public.notes_before_update(), public.note_shares_limit(), public.notes_owner_limit() from public, anon, authenticated;
grant execute on function public.is_note_owner(uuid), public.note_readable(uuid, uuid, uuid, text), public.can_read_note(uuid), public.can_share_note(uuid, uuid) to authenticated;

-- ------------------------------------------------------------------ RLS
alter table public.notes enable row level security;
alter table public.note_shares enable row level security;

create policy notes_select on public.notes for select to authenticated using (public.note_readable(id, owner_id, campaign_id, visibility));
create policy notes_insert on public.notes for insert to authenticated
  with check (owner_id = auth.uid() and (campaign_id is null or public.is_member(campaign_id)));
create policy notes_update on public.notes for update to authenticated
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid() and (campaign_id is null or public.is_member(campaign_id)));
create policy notes_delete on public.notes for delete to authenticated using (owner_id = auth.uid());

-- Quem vê a lista de selecionados: o autor, e cada selecionado só na PRÓPRIA linha e só enquanto a nota é legível para ele
-- (compartilhamento suspenso não revela sequer o id da nota).
create policy shares_select on public.note_shares for select to authenticated
  using (public.is_note_owner(note_id) or (user_id = auth.uid() and public.can_read_note(note_id)));
create policy shares_insert on public.note_shares for insert to authenticated
  with check (public.can_share_note(note_id, user_id));
create policy shares_delete on public.note_shares for delete to authenticated
  using (public.is_note_owner(note_id) or user_id = auth.uid());

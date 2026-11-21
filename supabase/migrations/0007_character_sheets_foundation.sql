-- 0007 — character_sheets_private_foundation. JÁ APLICADA no Supabase `compendio-5e` (gwcttjlxzelzjhbuitmi) como `20261121033258 character_sheets_private_foundation`. NÃO REAPLICAR.
-- ATENÇÃO: este arquivo RECONSTRÓI a migração remota. O SQL original não estava versionado; a reconstrução foi corrigida em 21/11/2026 com a revisão somente
-- leitura do esquema remoto (comentário do PR #80): `revision between 1 and 2147483647`, índice composto `character_sheets_campaign_owner_idx (campaign_id, owner_id)`
-- e RLS de INSERT/UPDATE exigindo `notes.deleted_at IS NULL`. O TEXTO EXATO dos predicados e os nomes de outras restrições/índices continuam desconhecidos:
-- comparar com `pg_dump --schema-only -t public.character_sheets` antes de qualquer decisão. A 0008 não depende dos nomes (recria TODAS as políticas e
-- confere a estrutura em pré-condições).
--
-- Estado que esta migração deixa (verificado no remoto): tabela VAZIA, RLS ligada, FKs restritivas, SEM nenhum privilégio para anon/authenticated
-- ("fail closed"): a API não consegue ler nem gravar a tabela até a revisão de segurança (0008) ser aprovada e aplicada.
--
-- Ficha PRIVADA do personagem (atributos, PV, inventário, escolhas), separada da linha pública em `notes` (kind = 'character'), que guarda só a
-- identidade pública. Uma ficha por personagem (character_id = notes.id).

create table if not exists public.character_sheets (
  character_id uuid        primary key references public.notes (id)     on delete restrict,
  campaign_id  uuid        not null    references public.campaigns (id) on delete restrict,
  owner_id     uuid        not null    references public.profiles (id)  on delete restrict,
  revision     integer     not null default 1 check (revision between 1 and 2147483647),
  draft        jsonb       not null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  constraint character_sheets_draft_check check (jsonb_typeof(draft) = 'object' and octet_length(draft::text) <= 65536)
);
create index if not exists character_sheets_campaign_owner_idx on public.character_sheets (campaign_id, owner_id);

alter table public.character_sheets enable row level security;

-- Políticas iniciais (substituídas pela 0008): dono participante e mestre leem; INSERT/UPDATE exigem a nota ativa (notes.deleted_at IS NULL).
-- Nota: no remoto o UPDATE confere a nota por subconsulta sob RLS; o mestre não lê notas privadas, então essa conferência não o atinge (a 0008 resolve).
create policy character_sheets_select on public.character_sheets for select to authenticated
  using ((owner_id = auth.uid() and public.is_member(campaign_id)) or public.is_master(campaign_id));
create policy character_sheets_insert on public.character_sheets for insert to authenticated
  with check (owner_id = auth.uid() and public.is_member(campaign_id)
    and exists (select 1 from public.notes n where n.id = character_id and n.kind = 'character' and n.campaign_id = character_sheets.campaign_id
                and n.owner_id = auth.uid() and n.deleted_at is null));
create policy character_sheets_update on public.character_sheets for update to authenticated
  using ((owner_id = auth.uid() and public.is_member(campaign_id)) or public.is_master(campaign_id))
  with check (((owner_id = auth.uid() and public.is_member(campaign_id)) or public.is_master(campaign_id))
    and exists (select 1 from public.notes n where n.id = character_id and n.kind = 'character' and n.campaign_id = character_sheets.campaign_id and n.deleted_at is null));

-- Fail closed: nenhum privilégio de API até a revisão terminar.
revoke all on public.character_sheets from public, anon, authenticated;

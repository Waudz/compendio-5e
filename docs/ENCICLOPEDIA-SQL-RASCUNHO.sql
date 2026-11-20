-- PROPOSTA PARA REVISAO. NAO EXECUTAR SEM VALIDACAO E AUTORIZACAO.
-- Base: esquema verificado em 2026-11-20 no projeto compendio-5e.
-- Supabase: public.campaigns(id), public.profiles(id), public.is_master(uuid), public.is_member(uuid).
-- NOTA: arquivo de projeto, NAO e uma migration versionada nem foi aplicada.
begin;

create table public.encyclopedia_entries (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  kind text not null check (kind in ('creature','character','place','organization','knowledge')),
  name text not null check (char_length(btrim(name)) between 1 and 160),
  summary text not null default '' check (char_length(summary)<=5000),
  public_description text not null default '' check (char_length(public_description)<=20000),
  visibility text not null default 'hidden' check (visibility in ('hidden','summary','full')),
  deleted_at timestamptz,
  deleted_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (deleted_at is not null or deleted_by is null)
);
create index encyclopedia_entries_active_idx on public.encyclopedia_entries(campaign_id,kind,name,id)
 where deleted_at is null;
create index encyclopedia_entries_discovery_idx on public.encyclopedia_entries(campaign_id,visibility,kind,id)
 where deleted_at is null;

-- Never store secrets on the player-readable table.
create table public.encyclopedia_master_details (
 entry_id uuid primary key references public.encyclopedia_entries(id) on delete cascade,
 master_notes text not null default '' check (char_length(master_notes)<=50000),
 mechanics_link jsonb,
 updated_at timestamptz not null default now(),
 check (mechanics_link is null or jsonb_typeof(mechanics_link)='object')
);

-- Narrative history is exclusively managed by the campaign master.
create table public.encyclopedia_history (
 id uuid primary key default gen_random_uuid(),
 entry_id uuid not null references public.encyclopedia_entries(id) on delete cascade,
 event_kind text not null check (char_length(btrim(event_kind)) between 1 and 80),
 event_payload jsonb not null default '{}'::jsonb check (jsonb_typeof(event_payload)='object'),
 created_at timestamptz not null default now()
);
create index encyclopedia_history_entry_idx on public.encyclopedia_history(entry_id,created_at desc,id);

alter table public.encyclopedia_entries enable row level security;
alter table public.encyclopedia_master_details enable row level security;
alter table public.encyclopedia_history enable row level security;

revoke all on public.encyclopedia_entries,public.encyclopedia_master_details,public.encyclopedia_history from public,anon,authenticated;
grant select on public.encyclopedia_entries to authenticated;
grant insert(campaign_id,kind,name,summary,public_description) on public.encyclopedia_entries to authenticated;
grant update(name,summary,public_description,visibility) on public.encyclopedia_entries to authenticated;
-- Trash transitions intentionally disabled until server-authoritative RPC is implemented.
-- Hard deletion intentionally disabled until a guarded server-side operation exists.
grant select,insert,update,delete on public.encyclopedia_master_details,public.encyclopedia_history to authenticated;

create policy encyclopedia_entries_read on public.encyclopedia_entries for select to authenticated
 using (
  public.is_master(campaign_id)
  -- Player SELECT intentionally disabled pending secure summary/full projections.
 );
create policy encyclopedia_entries_insert on public.encyclopedia_entries for insert to authenticated
 with check (public.is_master(campaign_id) and visibility='hidden' and deleted_at is null and deleted_by is null);
create policy encyclopedia_entries_update on public.encyclopedia_entries for update to authenticated
 using (public.is_master(campaign_id)) with check (public.is_master(campaign_id));

-- This helper reads the parent row under the invoking user's RLS; only masters can see private details.
create policy encyclopedia_master_details_read on public.encyclopedia_master_details for select to authenticated
 using (exists (select 1 from public.encyclopedia_entries e where e.id=entry_id and public.is_master(e.campaign_id)));
create policy encyclopedia_master_details_insert on public.encyclopedia_master_details for insert to authenticated
 with check (exists (select 1 from public.encyclopedia_entries e where e.id=entry_id and public.is_master(e.campaign_id)));
create policy encyclopedia_master_details_update on public.encyclopedia_master_details for update to authenticated
 using (exists (select 1 from public.encyclopedia_entries e where e.id=entry_id and public.is_master(e.campaign_id)))
 with check (exists (select 1 from public.encyclopedia_entries e where e.id=entry_id and public.is_master(e.campaign_id)));
create policy encyclopedia_master_details_delete on public.encyclopedia_master_details for delete to authenticated
 using (exists (select 1 from public.encyclopedia_entries e where e.id=entry_id and public.is_master(e.campaign_id)));

create policy encyclopedia_history_read on public.encyclopedia_history for select to authenticated
 using (exists (select 1 from public.encyclopedia_entries e where e.id=entry_id and public.is_master(e.campaign_id)));
create policy encyclopedia_history_insert on public.encyclopedia_history for insert to authenticated
 with check (exists (select 1 from public.encyclopedia_entries e where e.id=entry_id and public.is_master(e.campaign_id)));
-- History is append-only: no UPDATE or DELETE policies.

commit;

-- REVIEW BLOCKERS BEFORE PROMOTION TO A MIGRATION:
-- 1. This DRAFT uses campaign ON DELETE CASCADE; user decision on retention of
--    narrative records on campaign deletion must be confirmed.
-- 2. UPDATE grants permit changing deleted_at/deleted_by separately: enforce
--    server-authoritative timestamps and deleted_by=auth.uid() with a trigger/RPC.
-- 3. DELETE currently permits hard deletion without explicit confirmation: replace
--    with a guarded RPC and revoke direct DELETE before deploying.
-- 4. visibility='summary' needs a distinct public projection to omit
--    public_description; do not expose this draft table directly to players
--    until column-level projection is secured.
-- 5. history ON DELETE CASCADE conflicts with permanent audit preservation.
-- 6. Test RLS under actual authenticated identities, Realtime, and search/count.

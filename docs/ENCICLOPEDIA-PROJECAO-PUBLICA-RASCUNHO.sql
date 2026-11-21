-- DESIGN DRAFT ONLY. DO NOT APPLY. Security-first public projection without SECURITY DEFINER RPC.
-- Requires encyclopedia_entries from ENCICLOPEDIA-SQL-RASCUNHO.sql.
-- This table is the only player-readable encyclopedia data source.
-- No master_notes, mechanics, character sheet, HP, inventory, or private note columns.
begin;
create table public.encyclopedia_publications (
 entry_id uuid primary key references public.encyclopedia_entries(id) on delete restrict,
 campaign_id uuid not null references public.campaigns(id) on delete restrict,
 kind text not null check (kind in ('creature','character','place','organization','knowledge')),
 name text not null check (char_length(btrim(name)) between 1 and 160),
 summary text not null default '' check (char_length(summary) <= 5000),
 public_description text not null default '' check (char_length(public_description) <= 20000),
 visibility text not null check (visibility in ('summary','full')),
 updated_at timestamptz not null default now(),
 check (visibility = 'full' or public_description = '')
);
create index encyclopedia_publications_list_idx on public.encyclopedia_publications(campaign_id,kind,name,entry_id);
alter table public.encyclopedia_publications enable row level security;
revoke all on public.encyclopedia_publications from public,anon,authenticated;
grant select on public.encyclopedia_publications to authenticated;
-- No client INSERT/UPDATE/DELETE grants: master publishes via a reviewed
-- server-side operation with explicit validation and transactional sync.
create policy encyclopedia_publications_select on public.encyclopedia_publications
 for select to authenticated
 using (public.is_member(campaign_id));
commit;

-- REVIEW BLOCKERS:
-- 1. Do not expose this table until publication sync is implemented and tested.
--    An outdated publication may reveal an entry after hide, trash, campaign change
--    or member removal. All transitions must be atomic with the source entry.
-- 2. The write path must prove source entry_id/campaign_id/kind match and source
--    visibility/deleted_at, derive actor from auth.uid(), and require is_master.
-- 3. Never derive public fields by spreading source records or character sheets.
-- 4. Realtime publication is NOT authorized. Keep the table out of publications.
-- 5. Player queries must filter/paginate/count only this table, not source entries.
-- 6. Test SQL RLS with authenticated player, unrelated player, removed member,
--    master, and anon; also verify direct write is denied.
-- 7. Publication of name/image/mechanics needs separate product approval:
--    current domain contract only supports summary/full text and no images.

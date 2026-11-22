-- REVIEW DRAFT ONLY — DO NOT APPLY TO SUPABASE.
-- Dependency order: ENCICLOPEDIA-SQL-RASCUNHO.sql, then
-- ENCICLOPEDIA-PROJECAO-PUBLICA-RASCUNHO.sql, then this trigger.
-- This design avoids a player-callable SECURITY DEFINER RPC.
--
-- Source writes are authorized by encyclopedia_entries RLS (master only).
-- AFTER INSERT/UPDATE trigger runs atomically in the same transaction,
-- maintaining the exact player-safe projection. A failure rolls back both.
begin;
create schema if not exists encyclopedia_internal;
revoke all on schema encyclopedia_internal from public, anon, authenticated;

create or replace function encyclopedia_internal.sync_publication()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
begin
  -- Fail closed: only INSERT/UPDATE are supported. DELETE stays forbidden.
  if tg_op not in ('INSERT','UPDATE') then
    raise exception 'unsupported encyclopedia publication operation'
      using errcode='0A000';
  end if;

  -- Do not accept a trigger on another relation as authority.
  if tg_table_schema <> 'public' or tg_table_name <> 'encyclopedia_entries' then
    raise exception 'invalid encyclopedia publication source'
      using errcode='42501';
  end if;

  -- Defense in depth: derive authority from the authenticated session even
  -- if a future grant/policy accidentally widens writes on the source.
  if auth.uid() is null or not public.is_master(new.campaign_id) then
    raise exception 'only campaign master may publish' using errcode='42501';
  end if;

  -- Source row's master-only INSERT/UPDATE RLS must already have succeeded.
  -- A hidden or trashed entry has NO player-visible publication.
  if new.deleted_at is not null or new.visibility = 'hidden' then
    delete from public.encyclopedia_publications p where p.entry_id = new.id;
  else
    insert into public.encyclopedia_publications
      (entry_id,campaign_id,kind,name,summary,public_description,visibility,updated_at)
    values
      (new.id,new.campaign_id,new.kind,new.name,new.summary,
       case when new.visibility = 'full' then new.public_description else '' end,
       new.visibility,now())
    on conflict (entry_id) do update set
      campaign_id=excluded.campaign_id,
      kind=excluded.kind,
      name=excluded.name,
      summary=excluded.summary,
      public_description=excluded.public_description,
      visibility=excluded.visibility,
      updated_at=excluded.updated_at;
  end if;
  return new;
end
$function$;

revoke all on function encyclopedia_internal.sync_publication() from public,anon,authenticated;

create trigger encyclopedia_entries_sync_publication
after insert or update of
  campaign_id,kind,name,summary,public_description,visibility,deleted_at
on public.encyclopedia_entries
for each row execute function encyclopedia_internal.sync_publication();
commit;

-- REQUIRED BEFORE EXECUTION:
-- A. Verify no existing entries require backfill; if they do, use a
--    transactionally consistent master-authorized backfill.
-- B. Verify source RLS and column grants deny direct edits to deleted_at.
--    The trash/restore operation must itself be authorized server-side.
-- C. Verify trigger owner, EXECUTE grants, schema exposure and search_path.
-- D. Test hide, summary/full transitions, trash, restore, failure rollback,
--    concurrent changes, membership removal and cross-campaign isolation
--    under real authenticated Postgres roles, not only mocked TS tests.
-- E. No hard DELETE operation: entry/history FK RESTRICT remains intentional.
-- F. Do not add encyclopedia_publications to Realtime publication.
-- G. Before publishing, resolve image/mechanics granular disclosure contract.

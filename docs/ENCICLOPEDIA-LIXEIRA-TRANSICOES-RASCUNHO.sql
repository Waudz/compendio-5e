-- DESIGN DRAFT ONLY — DO NOT APPLY.
-- Dependency: ENCICLOPEDIA-SQL-RASCUNHO.sql and public sync trigger.
-- Replace the superseded exposed SECURITY DEFINER trash/restore RPC.
-- Masters can change ONLY trash columns under source RLS. A BEFORE trigger
-- derives timestamps/actor and refuses inconsistent transitions.
begin;
create or replace function encyclopedia_internal.guard_trash_transition()
returns trigger language plpgsql security invoker set search_path = ''
as $body$
begin
  if tg_op <> 'UPDATE' then
    raise exception 'invalid trash operation' using errcode='42501';
  end if;
  if tg_table_schema <> 'public' or tg_table_name <> 'encyclopedia_entries' then
    raise exception 'invalid trash source' using errcode='42501';
  end if;
  -- Campaign and entry ownership are immutable even if grants change.
  if new.id is distinct from old.id or new.campaign_id is distinct from old.campaign_id
     or new.kind is distinct from old.kind or new.created_at is distinct from old.created_at then
    raise exception 'immutable encyclopedia identity' using errcode='42501';
  end if;
  if new.deleted_at is distinct from old.deleted_at
     or new.deleted_by is distinct from old.deleted_by then
    if auth.uid() is null or not public.is_master(old.campaign_id) then
      raise exception 'only master may change trash state' using errcode='42501';
    end if;
    -- Only two legal transitions: active -> trashed and trashed -> active.
    -- A direct edit to deleted_by without a state change is rejected.
    if (old.deleted_at is null and new.deleted_at is not null) then
      new.deleted_at := now();
      new.deleted_by := auth.uid();
    elsif (old.deleted_at is not null and new.deleted_at is null) then
      new.deleted_by := null;
    else
      raise exception 'invalid trash transition' using errcode='23514';
    end if;
  end if;
  new.updated_at := now();
  return new;
end
$body$;

revoke all on function encyclopedia_internal.guard_trash_transition()
  from public,anon,authenticated;
create trigger encyclopedia_entries_guard_trash
before update on public.encyclopedia_entries
for each row execute function encyclopedia_internal.guard_trash_transition();

-- Both columns must be writable together; the guard rewrites client values.
-- RLS still limits the UPDATE to the campaign master. The sync AFTER trigger
-- atomically deletes/restores the player publication.
grant update(deleted_at,deleted_by) on public.encyclopedia_entries to authenticated;
commit;

-- Review notes:
-- 1. This uses direct UPDATE with RLS, not a privileged RPC.
-- 2. UPDATE grants are column-specific; validate that the API cannot set
--    campaign_id, kind, id, created_at, or bypass the guard.
-- 3. Source table's existing master-only SELECT policy is necessary for UPDATE.
-- 4. The public projection trigger fires on deleted_at; no stale publication.
-- 5. Confirm behavior of UPDATE ... RETURNING and RLS under authenticated.
-- 6. Race/lock semantics: two concurrent trash calls may both report an
--    updated row unless client UPDATE filters on expected deleted_at IS NULL.
--    Require conditional UPDATE and verify affected row count.
-- 7. Permanent deletion remains forbidden; trash is indefinite.
-- 8. Validate with real Postgres identities and run advisors before promotion.

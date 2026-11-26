-- Somente com autorização e backup. As definições da campanha são arquivadas em esquema privado antes da remoção;
-- o catálogo global nunca foi alterado. As fichas já copiadas para as páginas permanecem como estão.
begin;
create schema if not exists private_codex_archive;
revoke all on schema private_codex_archive from public,anon,authenticated;
create table if not exists private_codex_archive.definition_snapshots(created_at timestamptz default now(),data jsonb);
revoke all on private_codex_archive.definition_snapshots from public,anon,authenticated;
insert into private_codex_archive.definition_snapshots(data) select coalesce(jsonb_agg(to_jsonb(d)),'[]'::jsonb) from public.campaign_definitions d;
drop function public.codex_definition_remove(uuid,text,text,int,jsonb,text);
drop function public.codex_definition_save(uuid,text,text,int,text,jsonb,jsonb,text);
drop function public.codex_definition_sync(uuid,text,text,jsonb,text,text);
drop table public.campaign_definitions;
create or replace function public.codex_capabilities() returns integer language sql stable set search_path='' as $$ select 17 $$;
commit;

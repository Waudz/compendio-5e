-- Somente por autorização, com backup. Desativa a funcionalidade e arquiva o índice e as notificações.
-- NÃO apaga notes nem arquivos de imagem. O arquivo privado NÃO é exposto pela Data API.
begin;
create schema if not exists private_codex_archive;
revoke all on schema private_codex_archive from public,anon,authenticated;
create table if not exists private_codex_archive.snapshots (
 id bigint generated always as identity primary key, created_at timestamptz not null default now(), data jsonb not null
);
revoke all on private_codex_archive.snapshots from public,anon,authenticated;
insert into private_codex_archive.snapshots(data) select jsonb_build_object(
 'entries',coalesce((select jsonb_agg(to_jsonb(c)) from public.campaign_codex c),'[]'::jsonb),
 'notifications',coalesce((select jsonb_agg(to_jsonb(n)) from public.codex_notifications n),'[]'::jsonb),
 'notes',coalesce((select jsonb_agg(to_jsonb(n)) from public.notes n join public.campaign_codex c on c.id=n.id),'[]'::jsonb)
);
drop policy codex_assets_read on storage.objects;
drop policy codex_assets_insert on storage.objects;
drop policy codex_assets_delete on storage.objects;
drop function public.codex_asset_access(text,boolean);
drop policy notes_codex_boundary on public.notes;
drop function public.codex_note_access(uuid);
drop trigger codex_note_guard on public.notes;
drop function public.codex_note_guard();
drop function public.codex_save(uuid,uuid,int,jsonb);
drop function public.codex_remove(uuid,uuid,int);
drop function public.codex_holders(uuid,uuid);
drop function public.codex_list(uuid);
drop table public.codex_notifications;
drop function public.codex_visible(uuid,int);
drop table public.campaign_codex;
commit;

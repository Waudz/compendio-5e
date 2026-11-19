-- 0006 — PROPOSTA, NÃO APLICADA ao Supabase hospedado (depende da 0005). Só o responsável autoriza aplicar.
-- Registros de campanha sobre `notes` (Diário, cenas e quadro do Planejamento, personagens), capa da campanha e imagens.
--   * notes.meta (jsonb objeto, até 16 KiB): data da sessão do Diário, ordem do quadro, classe/nível/retrato do personagem.
--   * novos tipos: 'board' (quadro) e 'character' (personagem).
--   * regras de quem pode criar: diary/scene/board só o MESTRE da campanha; character qualquer participante, em nome próprio.
--   * planejamento (scene, board) é SEMPRE privado; diário e personagem só 'private' ou 'campaign' (publicado).
--   * campaigns.cover_path + bucket privado `campaign-assets` (caminho <campanha>/<uuid>, JPEG/PNG/WebP até 5 MiB) com políticas.
-- Aditiva: não apaga nem altera dados existentes. Reversão em supabase/rollback/0006_registros_capa_personagens_down.sql.

alter table public.notes add column meta jsonb not null default '{}'::jsonb;
alter table public.notes add constraint notes_meta_check check (jsonb_typeof(meta) = 'object' and octet_length(meta::text) <= 16384);

alter table public.notes drop constraint notes_kind_check;
alter table public.notes add constraint notes_kind_check
  check (kind in ('note', 'page', 'scene', 'npc', 'location', 'faction', 'event', 'diary', 'board', 'character'));

alter table public.notes add constraint notes_planejamento_privado_check check (kind not in ('scene', 'board') or visibility = 'private');
alter table public.notes add constraint notes_publicavel_check check (kind not in ('diary', 'character') or visibility in ('private', 'campaign'));
alter table public.notes add constraint notes_registro_de_campanha_check check (kind not in ('diary', 'scene', 'board', 'character') or campaign_id is not null);

-- Gatilho SECURITY INVOKER (a RLS vale dentro dele; is_master/is_member já são definer e só respondem sobre o próprio usuário).
create function public.notes_kind_guard() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.kind in ('diary', 'scene', 'board') and (new.campaign_id is null or not public.is_master(new.campaign_id)) then
    raise exception 'tipo_exclusivo_do_mestre' using errcode = '42501';
  end if;
  if new.kind = 'character' and (new.campaign_id is null or not public.is_member(new.campaign_id)) then
    raise exception 'sem_permissao' using errcode = '42501';
  end if;
  return new;
end $$;
create trigger notes_kind_guard before insert or update of kind, campaign_id on public.notes
  for each row execute function public.notes_kind_guard();

-- Privilégios por coluna (como na 0004/0005): `meta` é gravável pelo dono; owner_id e campaign_id seguem imutáveis.
grant insert (meta) on public.notes to authenticated;
grant update (meta) on public.notes to authenticated;
revoke all on function public.notes_kind_guard() from public, anon, authenticated;

alter table public.campaigns add column cover_path text;
alter table public.campaigns add constraint campaigns_cover_path_check
  check (cover_path is null or cover_path ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$');

grant update (cover_path) on public.campaigns to authenticated;   -- a RLS de campaigns_update já restringe ao mestre

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('campaign-assets', 'campaign-assets', false, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

-- Leitura: quem participa da campanha dona do caminho. Envio: participante, só em <campanha>/<uuid>. Exclusão: o mestre ou quem enviou.
create policy campaign_assets_select on storage.objects for select to authenticated
  using (bucket_id = 'campaign-assets' and name ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}$' and public.is_member(((storage.foldername(name))[1])::uuid));
create policy campaign_assets_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'campaign-assets' and name ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
              and public.is_member(((storage.foldername(name))[1])::uuid));
create policy campaign_assets_delete on storage.objects for delete to authenticated
  using (bucket_id = 'campaign-assets' and name ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}$'
         and (owner = auth.uid() or public.is_master(((storage.foldername(name))[1])::uuid)));

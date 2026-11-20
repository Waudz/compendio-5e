-- 0006 — PROPOSTA, NÃO APLICADA ao Supabase hospedado (depende da 0005). Só o responsável autoriza aplicar.
-- Registros de campanha sobre `notes` (Diário, cenas e quadro do Planejamento, personagens), capa da campanha e imagens.
--   * notes.meta (jsonb objeto, até 16 KiB): data da sessão do Diário, ordem do quadro, classe/nível/retrato do personagem.
--   * novos tipos: 'board' (quadro) e 'character' (personagem).
--   * regras de quem pode criar: diary só o MESTRE da campanha; scene/board/character qualquer participante, em nome próprio.
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

-- Gatilho SECURITY INVOKER: somente o mestre cria diary; participantes criam seus próprios scene/board/character.
-- A RLS de notes (0004/0005) mantém owner_id = auth.uid(), escrita exclusiva do dono e leitura privada.
-- O CHECK notes_planejamento_privado_check impede compartilhar scene/board, inclusive com o mestre.
-- is_master/is_member verificam a participação atual no banco, não no cliente.
create function public.notes_kind_guard() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.kind = 'diary' and (new.campaign_id is null or not public.is_master(new.campaign_id)) then
    raise exception 'tipo_exclusivo_do_mestre' using errcode = '42501';
  end if;
  if new.kind in ('scene', 'board', 'character') and (new.campaign_id is null or not public.is_member(new.campaign_id)) then
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
-- IMPORTANTE: o Postgres NÃO garante a ordem de avaliação de AND. Estas políticas valem para TODAS as linhas de storage.objects (outros buckets
-- incluídos); o cast ::uuid só pode ocorrer depois de o nome casar com o padrão, por isso o CASE. Sem ele, um nome fora do padrão em outro bucket
-- poderia gerar erro de cast e quebrar o acesso de authenticated a esses arquivos. Dono do objeto: owner_id (text; `owner` é obsoleto no Supabase).
create policy campaign_assets_select on storage.objects for select to authenticated
  using (bucket_id = 'campaign-assets' and case
    when name ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    then public.is_member(((storage.foldername(name))[1])::uuid) else false end);
create policy campaign_assets_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'campaign-assets' and case
    when name ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    then public.is_member(((storage.foldername(name))[1])::uuid) else false end);
create policy campaign_assets_delete on storage.objects for delete to authenticated
  using (bucket_id = 'campaign-assets' and case
    when name ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    then (owner_id = auth.uid()::text or public.is_master(((storage.foldername(name))[1])::uuid)) else false end);

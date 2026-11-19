-- Reverte 0006_registros_capa_personagens.sql (NÃO APLICADA ao Supabase hospedado).
-- ATENÇÃO — DESTRUTIVO: apaga as notas dos tipos 'board' e 'character', todo `meta` e a coluna da capa (as notas 'diary' e 'scene' ficam, sem data de sessão).
-- Imagens já enviadas ao bucket `campaign-assets` NÃO são apagadas aqui (apague pelo painel do Storage se quiser).
-- TRAVA: se houver dados afetados, só roda após backup e confirmação NA MESMA SESSÃO:
--     set compendio.confirmar_rollback_0006 = 'sim';
do $$
begin
  if current_setting('compendio.confirmar_rollback_0006', true) is distinct from 'sim'
     and (exists (select 1 from public.notes where kind in ('board', 'character') or meta <> '{}'::jsonb) or exists (select 1 from public.campaigns where cover_path is not null)) then
    raise exception 'rollback_0006_destrutivo: faca backup e confirme com: set compendio.confirmar_rollback_0006 = ''sim'';' using errcode = '55000';
  end if;
end $$;
drop policy if exists campaign_assets_select on storage.objects;
drop policy if exists campaign_assets_insert on storage.objects;
drop policy if exists campaign_assets_delete on storage.objects;
revoke update (cover_path) on public.campaigns from authenticated;
alter table public.campaigns drop constraint if exists campaigns_cover_path_check;
alter table public.campaigns drop column if exists cover_path;
drop trigger if exists notes_kind_guard on public.notes;
drop function if exists public.notes_kind_guard();
delete from public.notes where kind in ('board', 'character');
alter table public.notes
  drop constraint if exists notes_registro_de_campanha_check,
  drop constraint if exists notes_publicavel_check,
  drop constraint if exists notes_planejamento_privado_check,
  drop constraint if exists notes_meta_check,
  drop constraint if exists notes_kind_check;
alter table public.notes add constraint notes_kind_check check (kind in ('note', 'page', 'scene', 'npc', 'location', 'faction', 'event', 'diary'));
revoke insert (meta), update (meta) on public.notes from authenticated;
alter table public.notes drop column if exists meta;

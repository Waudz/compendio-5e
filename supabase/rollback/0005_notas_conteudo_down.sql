-- Reverte 0005_notas_conteudo.sql (NÃO APLICADA ao Supabase hospedado; este arquivo também não foi executado lá).
-- ATENÇÃO — o que se perde ao reverter:
--   * `content` (conteúdo estruturado em JSONB), `content_schema`, `kind`, `deleted_at` e `deleted_batch` de TODAS as notas.
--   * Notas que estavam na lixeira voltam a aparecer como notas PRIVADAS normais (nunca compartilhadas: a exclusão já as tornou privadas).
-- O que se preserva: todas as notas, `title`, `body` (inclusive o body derivado do conteúdo), visibilidade, dono, campanha e versão.
-- Antes de reverter, em ambiente real: faça backup (`select * from public.notes`) e, se quiser descartar de vez as notas da lixeira,
-- apague-as antes (`delete from public.notes where deleted_at is not null`).
-- TRAVA DE SEGURANÇA: este rollback é DESTRUTIVO para content, kind, content_schema e a lixeira. Se existir qualquer dado nesses campos, ele só
-- roda depois de uma confirmação explícita NA MESMA SESSÃO, feita DEPOIS do backup:
--     select * from public.notes;            -- backup (exportar)
--     set compendio.confirmar_rollback_0005 = 'sim';
do $$
begin
  if current_setting('compendio.confirmar_rollback_0005', true) is distinct from 'sim'
     and exists (select 1 from public.notes where content is not null or deleted_at is not null or kind <> 'note' or content_schema <> 1) then
    raise exception 'rollback_0005_destrutivo: faca backup de public.notes e confirme com: set compendio.confirmar_rollback_0005 = ''sim'';' using errcode = '55000';
  end if;
end $$;
alter policy notes_update on public.notes using (owner_id = auth.uid()) with check (owner_id = auth.uid() and (campaign_id is null or public.is_member(campaign_id)));   -- política da 0004
drop function if exists public.save_note_content(uuid, integer, jsonb, integer, text);
drop trigger  if exists notes_content_before_write on public.notes;
drop function if exists public.notes_content_before_write();
drop index    if exists public.notes_deleted_idx;
drop index    if exists public.notes_kind_idx;
alter table public.notes
  drop constraint if exists notes_deleted_check,
  drop constraint if exists notes_content_check,
  drop constraint if exists notes_content_schema_check,
  drop constraint if exists notes_kind_check;
alter table public.notes
  drop column if exists deleted_batch,
  drop column if exists deleted_at,
  drop column if exists content_schema,
  drop column if exists content,
  drop column if exists kind;

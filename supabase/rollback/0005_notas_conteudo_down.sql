-- Reverte 0005_notas_conteudo.sql (NÃO APLICADA ao Supabase hospedado; este arquivo também não foi executado lá).
-- ATENÇÃO — o que se perde ao reverter:
--   * `content` (conteúdo estruturado em JSONB), `content_schema`, `kind`, `deleted_at` e `deleted_batch` de TODAS as notas.
--   * Notas que estavam na lixeira voltam a aparecer como notas PRIVADAS normais (nunca compartilhadas: a exclusão já as tornou privadas).
-- O que se preserva: todas as notas, `title`, `body` (inclusive o body derivado do conteúdo), visibilidade, dono, campanha e versão.
-- Antes de reverter, em ambiente real: faça backup (`select * from public.notes`) e, se quiser descartar de vez as notas da lixeira,
-- apague-as antes (`delete from public.notes where deleted_at is not null`).
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

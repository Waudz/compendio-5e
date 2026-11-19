-- Reverte 0004_notas.sql. ATENÇÃO: apaga TODAS as notas e compartilhamentos. Faça backup antes (select * from public.notes).
drop table if exists public.note_shares;
drop table if exists public.notes;
drop function if exists public.notes_before_update();
drop function if exists public.notes_owner_limit();
drop function if exists public.note_shares_limit();
drop function if exists public.can_share_note(uuid, uuid);
drop function if exists public.can_read_note(uuid);
drop function if exists public.note_readable(uuid, uuid, uuid, text);
drop function if exists public.is_note_owner(uuid);

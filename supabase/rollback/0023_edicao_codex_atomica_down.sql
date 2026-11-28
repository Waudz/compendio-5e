-- Reversão da 0023: remove só as duas funções. Registros, vínculos, estados vitais e imagens gravados por elas permanecem.
-- O aplicativo volta a avisar que o salvamento conjunto está indisponível.
begin;
drop function if exists public.codex_save_edit(uuid, uuid, int, jsonb, jsonb);
drop function if exists public.codex_edit_capability();
commit;

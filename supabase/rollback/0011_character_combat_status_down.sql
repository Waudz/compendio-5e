-- Reversão da 0011: remove SOMENTE a tabela de status de combate das fichas e suas funções. Não toca em `character_sheets`, notas, campanhas, combates ou encontros.
-- ATENÇÃO: apaga os status (PV/condições do combate) gravados; são estados transitórios do combate. Exporte antes se precisar guardá-los.
drop function if exists public.clear_combat_status(uuid);
drop function if exists public.set_combat_status(uuid, integer, integer, jsonb);
drop table if exists public.character_combat_status;
drop function if exists private_combates.valid_condicoes(jsonb);

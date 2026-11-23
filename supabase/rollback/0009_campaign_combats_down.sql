-- Reversão da 0009: remove SOMENTE a tabela do combate ativo e suas funções de apoio. Não toca em campanhas, membros, notas ou fichas.
-- ATENÇÃO: apaga os combates ativos gravados nessa tabela (são estados transitórios; encontros ficam na 0010). Exporte antes se precisar guardá-los.
drop table if exists public.campaign_combats;
drop function if exists private_combates.guard_campaign_combat_version();
drop function if exists private_combates.valid_campaign_combat_state(jsonb);
drop schema if exists private_combates;   -- falha de propósito se a 0010 ainda estiver aplicada: reverta a 0010 primeiro

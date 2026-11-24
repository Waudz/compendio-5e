-- Reversão da 0010: remove SOMENTE a tabela de encontros preparados e suas funções de apoio. Não toca em campanhas, membros, combates, notas ou fichas.
-- ATENÇÃO: apaga os encontros preparados gravados nessa tabela. Exporte antes se precisar guardá-los.
drop table if exists public.campaign_encounters;
drop function if exists private_combates.guard_campaign_encounters_version();
drop function if exists private_combates.valid_campaign_encounters_state(jsonb);

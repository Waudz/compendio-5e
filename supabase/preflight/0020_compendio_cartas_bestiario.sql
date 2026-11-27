-- SOMENTE LEITURA; confirmar o projeto 2.0 e um backup recuperável antes da aplicação autorizada. Rodar antes e depois.
-- Antes: capacidade 19 e coluna ausente. Depois: capacidade 20 e coluna presente.
select public.codex_capabilities() as capacidade,
 exists(select 1 from information_schema.columns where table_schema='public' and table_name='campaign_codex' and column_name='combat_definition_id') as coluna_ficha_npc,
 to_regprocedure('public.codex_refs_text(uuid,text)') is not null as saneamento_referencias;
-- Contagens que a 0020 não altera (devem ser idênticas antes e depois).
select (select count(*) from public.campaign_codex) as registros, (select count(*) from public.codex_links) as vinculos,
 (select count(*) from public.notes) as notas, (select count(*) from public.campaign_definitions) as definicoes,
 (select count(*) from public.codex_notifications) as avisos, (select count(*) from public.character_sheets) as fichas;
-- Informativo: criaturas com ficha técnica hoje marcada como revelada. Depois da 0020 o jogador deixa de recebê-la.
select count(*) as criaturas_com_ficha_revelada from public.campaign_codex
 where category='monster' and deleted_at is null and visible and exists(select 1 from unnest(revealed) k where k='sheet' or k like 'sheet:%');

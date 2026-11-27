-- SOMENTE LEITURA; confirmar projeto 2.0 e backup recuperável antes de aplicação autorizada. Rodar antes e depois.
-- Antes da 0017: capacidade 16, colunas novas ausentes e tabela de definições inexistente.
select public.codex_capabilities() as capacidade,
 to_regclass('public.campaign_definitions') as definicoes_existentes,
 exists(select 1 from information_schema.columns where table_schema='public' and table_name='campaign_codex' and column_name='revealed') as coluna_revealed;
select count(*) as registros from public.campaign_codex;
select count(*) as vinculos from public.codex_links;
select count(*) as notas from public.notes;
select count(*) as fichas from public.character_sheets;
select count(*) as avisos from public.codex_notifications;
-- ANTES: distribuição por categoria e nível, para conferir a conversão (esta consulta falha depois da 0017).
select category, knowledge, count(*) from public.campaign_codex where deleted_at is null group by 1,2 order by 1,2;
-- DEPOIS (descomentar): registros publicados devem ser iguais aos que tinham nível maior que 0.
-- select category, visible, cardinality(revealed) as chaves, count(*) from public.campaign_codex where deleted_at is null group by 1,2,3 order by 1,2,3;
-- select count(*) filter(where revealed) as vinculos_revelados, count(*) as total from public.codex_links;

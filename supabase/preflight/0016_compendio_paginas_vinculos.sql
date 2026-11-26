-- SOMENTE LEITURA; confirmar projeto 2.0 e backup recuperável antes de aplicação autorizada.
select to_regclass('public.campaign_codex') as ledger_0015,
 to_regprocedure('public.codex_save(uuid,uuid,integer,jsonb)') as save_0015,
 to_regprocedure('public.codex_list(uuid)') as projection_0015;
-- A primeira aplicação não deve colidir com objetos existentes.
select to_regclass('public.codex_links') as links_existing,to_regprocedure('public.codex_capabilities()') as capability_existing;
select count(*) as records from public.campaign_codex;
select count(*) as notes from public.notes;
select count(*) as characters from public.character_sheets;
-- A migração não reescreve o conteúdo desses registros; comparar as contagens depois.

-- SOMENTE LEITURA. Executar apenas após confirmar o projeto 2.0 no painel; não usar no legado.
-- Pré-requisitos: a sequência 0001–0014 deve estar aplicada e testada.
select to_regclass('public.notes') as notes,
       to_regclass('public.character_sheets') as character_sheets,
       to_regprocedure('public.is_master(uuid)') as is_master,
       to_regprocedure('public.alterar_vitais(uuid,jsonb,uuid)') as vitais_0014;
-- Deve retornar zero linhas antes da primeira aplicação. Se houver colisão, PARAR e comparar os objetos.
select n.nspname,p.proname from pg_proc p join pg_namespace n on n.oid=p.pronamespace
where n.nspname='public' and p.proname like 'codex_%';
select table_name from information_schema.tables where table_schema='public' and table_name in ('campaign_codex','codex_notifications');
-- Bucket pré-existente requer inspeção (p.ex. reaplicação após rollback); não sobrescrever configuração permissiva.
select id,public,file_size_limit,allowed_mime_types from storage.buckets where id='codex-assets';
-- Contagens para comparar antes/depois; não imprime nomes, fichas, e-mails ou conteúdo privado.
select (select count(*) from public.campaigns) as campaigns,
       (select count(*) from public.notes) as notes,
       (select count(*) from public.character_sheets) as sheets;

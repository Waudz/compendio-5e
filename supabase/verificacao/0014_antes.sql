-- Conferência ANTES da 0014. SOMENTE LEITURA. Um único resultado: (item, valor).
-- Aplique somente se: pre_requisitos_ok = sim e ja_aplicada = não. Guarde as linhas "digital_*": depois têm de ser idênticas.
select 'pre_requisitos_ok' as item, case when to_regnamespace('private_ficha') is not null and to_regclass('private_ficha.itens_livres') is not null
         and to_regprocedure('private_ficha.guarda_entregas()') is not null and to_regprocedure('private_ficha.atualizar_apresentacao()') is not null
         and to_regprocedure('private.identidade_meta_valida(jsonb)') is not null then 'sim' else 'não' end as valor
union all select 'ja_aplicada', case when to_regclass('private_ficha.operacao') is not null or exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'character_sheets' and column_name = 'vitals_version') then 'sim' else 'não' end
union all select 'fichas', count(*)::text from public.character_sheets
union all select 'fichas_sem_pv_numerico', count(*)::text from public.character_sheets where jsonb_typeof(draft -> 'currentHp') is distinct from 'number'
union all select 'realtime_publicacao_existe', case when exists (select 1 from pg_publication where pubname = 'supabase_realtime') then 'sim' else 'não' end
union all select 'digital_fichas', coalesce(md5(string_agg(character_id::text || ':' || revision || ':' || md5(draft::text), ',' order by character_id)), 'vazio') from public.character_sheets
union all select 'digital_notas', coalesce(md5(string_agg(id::text || ':' || md5(coalesce(title, '') || visibility || meta::text || coalesce(body, '')), ',' order by id)), 'vazio') from public.notes;

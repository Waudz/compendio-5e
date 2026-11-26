-- Conferência ANTES da 0013. SOMENTE LEITURA. Um único resultado: (item, valor).
-- Aplique a migração somente se: pre_requisitos_ok = sim, ja_aplicada = não e fichas_fora_do_formato = 0.
-- Guarde as três linhas "digital_*": depois da aplicação elas têm de ser idênticas.
with fichas as (select character_id, revision, draft from public.character_sheets),
inv as (select f.character_id, e.v from fichas f cross join lateral jsonb_array_elements(case when jsonb_typeof(f.draft -> 'inventory') = 'array' then f.draft -> 'inventory' else '[]'::jsonb end) e(v)),
ruins as (
  select character_id from fichas where (draft ? 'inventory' and jsonb_typeof(draft -> 'inventory') <> 'array')
     or (draft #> '{play,concedidos}' is not null and jsonb_typeof(draft #> '{play,concedidos}') <> 'array')
  union
  select character_id from inv where jsonb_typeof(v) <> 'object'
     or jsonb_typeof(v -> 'id') is distinct from 'string' or jsonb_typeof(v -> 'itemId') is distinct from 'string' or jsonb_typeof(v -> 'quantity') is distinct from 'number'
     or case when jsonb_typeof(v -> 'quantity') = 'number' then (v ->> 'quantity')::numeric <> trunc((v ->> 'quantity')::numeric) or (v ->> 'quantity')::numeric not between 1 and 1000000 else true end
  union
  select character_id from inv group by character_id, v ->> 'id' having count(*) > 1),
guiadas as (select n.id, n.visibility, n.meta from public.notes n join fichas f on f.character_id = n.id),
sobras as (
  select id, visibility from guiadas g where coalesce(g.meta #>> '{identidadePublica,settings,title}', '') <> ''
     or (g.meta #>> '{identidadePublica,settings,imageUrl}') is not null
     or exists (select 1 from jsonb_each(case when jsonb_typeof(g.meta #> '{identidadePublica,settings}') = 'object' then g.meta #> '{identidadePublica,settings}' else '{}'::jsonb end) s
                 where jsonb_typeof(s.value) = 'object' and coalesce(s.value ->> 'mode', '') <> 'custom' and coalesce(s.value ->> 'customValue', '') <> ''))
select 'pre_requisitos_ok' as item, case when to_regclass('public.character_sheets') is not null and to_regprocedure('private.identidade_meta_valida(jsonb)') is not null
         and to_regprocedure('private.notes_ficha_guard()') is not null and exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'campaigns' and column_name = 'cover_framing')
         and exists (select 1 from storage.buckets where id = 'campaign-assets') then 'sim' else 'não' end as valor
union all select 'ja_aplicada', case when to_regnamespace('private_ficha') is not null or exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'campaigns' and column_name = 'enabled_coins') then 'sim' else 'não' end
union all select 'campanhas', count(*)::text from public.campaigns
union all select 'fichas', count(*)::text from fichas
union all select 'fichas_fora_do_formato', count(*)::text from (select distinct character_id from ruins) r
union all select 'apresentacoes_privadas_que_passam_a_aparecer_na_proxima_gravacao', count(*)::text from guiadas where visibility <> 'campaign'
union all select 'apresentacoes_com_texto_oculto_gravado_total', count(*)::text from sobras
union all select 'apresentacoes_com_texto_oculto_gravado_ja_visiveis', count(*)::text from sobras where visibility = 'campaign'
union all select 'digital_fichas', coalesce(md5(string_agg(character_id::text || ':' || revision || ':' || md5(draft::text), ',' order by character_id)), 'vazio') from fichas
union all select 'digital_notas', coalesce(md5(string_agg(id::text || ':' || md5(coalesce(title, '') || visibility || meta::text || coalesce(body, '')), ',' order by id)), 'vazio') from public.notes
union all select 'digital_campanhas', coalesce(md5(string_agg(id::text || ':' || md5(name || coalesce(description, '') || coalesce(cover_path, '') || coalesce(cover_framing::text, '')), ',' order by id)), 'vazio') from public.campaigns;

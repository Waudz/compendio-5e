-- SOMENTE LEITURA. Rodar as quatro consultas ANTES e DEPOIS de aplicar a 0022. Não mostra conteúdo de ficha, nomes nem segredos.

-- 1) A 0022 substitui 12 funções a partir do texto deste repositório. ANTES: todas devem dizer 'antes'; DEPOIS: todas 'depois'.
--    Qualquer 'DIVERGENTE' ou 'AUSENTE' antes de aplicar: PARAR e comparar a função de produção com o repositório (nada deve ser sobrescrito às cegas).
with esperado(funcao, antes, depois) as (values
  ('private.nota_guiada_ativa', 'a737e05862ee3590ea690c0e1d2302a4', 'da383838aca973a12224360974a265b2'),
  ('private.notes_ficha_guard', 'ee2b21c77db352855cf5607e38f05b74', '56bd88acc09b3430bf8e36f496514823'),
  ('private_combates.valid_campaign_combat_state', '30e831547fe663f4882be6841dd371fc', '282610cfde03ea46d31c44c0f547c2c2'),
  ('private_combates.valid_campaign_encounters_state', '1996b238d88322f7df88a49cdf221d35', 'b10a678a436a3f2caa0b0d4710eb8a10'),
  ('private_ficha.purgar_copias', 'fe10796f13fd5cc1be405a076ab30b33', 'c903de2e1cc430d31facc392c78a004b'),
  ('private_ficha.recusar_destino_inativo', '231e6696d263ba0e800257cb353f1e12', 'cbbc11f1a202a53e95d87c097b50c335'),
  ('private_ficha.travar', 'e1a7707c41d6e5bbed03e37a4e248be4', '77f16ca726e5b7a4e33ce0fdea821a2f'),
  ('public.codex_capabilities', 'cb90ccb43cc53889e658cd521c5cb825', '016d411930fa3d7978e12adfd62c7350'),
  ('public.codex_project', 'a22fc04877ee33cda3cfa4ac812f0a1e', '7fd3321ec5b2ab64c428ee8e16bdd9a4'),
  ('public.codex_remove', '91b78ec7863f7a241df03a4b9fb212b6', '72d1660e5692863df870bb06261a6a4d'),
  ('public.codex_reveal', 'ef9bd30fb71b35acbcfb56827beee1c8', '16d1aa7b683e4c1ec89f2d51640aaa78'),
  ('public.codex_set_combat_sheet', 'b2ad452f92a80b48a41c2cf793ec4de9', '29396995e2da4c48c8520c06fb554ca4')
), atual as (
  select n.nspname || '.' || p.proname as funcao, md5(btrim(replace(p.prosrc, chr(13), ''), E' \n\t')) as hash
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
)
select e.funcao, case when a.hash is null then 'AUSENTE' when a.hash = e.antes then 'antes' when a.hash = e.depois then 'depois' else 'DIVERGENTE' end as situacao
  from esperado e left join atual a using (funcao) order by 1;

-- 2) Objetos novos e versão. ANTES: 21 e três colunas falsas. DEPOIS: 22 e três verdadeiras.
select public.codex_capabilities() as versao,
       to_regprocedure('public.codex_npc_sheet_set(uuid,uuid,integer,jsonb,uuid,integer,text)') is not null as tem_operacao_de_ficha,
       to_regclass('public.character_life') is not null as tem_estado_vital,
       to_regclass('private_ficha.npc_ficha_eventos') is not null as tem_retencao_de_npc;

-- 3) Contagens que NÃO podem mudar com a aplicação (guardar o resultado de antes e comparar).
select (select count(*) from public.notes) as notas, (select count(*) from public.character_sheets) as fichas,
       (select count(*) from public.campaign_codex) as paginas,
       (select count(*) from public.campaign_codex where category = 'npc' and combat_definition_id is not null) as npcs_com_criatura_vinculada,
       (select count(*) from public.campaign_definitions) as definicoes_da_campanha,
       (select count(*) from public.campaign_combats) as combates, (select count(*) from public.campaign_encounters) as encontros;

-- 4) Antes e logo depois de aplicar, as duas contagens devem ser zero.
select (select count(*) from public.character_sheets s join public.campaign_codex c on c.id = s.character_id where c.category = 'npc') as fichas_em_paginas_de_npc,
       (select count(*) from public.campaign_definitions d where d.definition_id like 'custom-npc-%') as copias_proprias_de_npc;

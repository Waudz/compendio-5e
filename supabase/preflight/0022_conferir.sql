-- SOMENTE LEITURA. Rodar ANTES e DEPOIS de aplicar a 0022 em produção. Não mostra conteúdo de ficha, nomes nem segredos.
-- 1) Versão do banco: antes = 21, depois = 22.
select public.codex_capabilities() as versao;
-- 2) Antes: as duas colunas devem ser falsas. Depois: verdadeiras.
select to_regprocedure('private.npc_do_compendio(uuid)') is not null as tem_apoio,
       to_regprocedure('public.codex_npc_sheet_create(uuid,uuid,integer,jsonb)') is not null as tem_rpc;
-- 3) Contagens que NÃO podem mudar com a aplicação (comparar antes e depois).
select (select count(*) from public.notes) as notas, (select count(*) from public.character_sheets) as fichas,
       (select count(*) from public.campaign_codex) as paginas,
       (select count(*) from public.campaign_codex where category = 'npc' and combat_definition_id is not null) as npcs_com_ficha_de_criatura;
-- 4) Nenhuma ficha deve existir hoje ligada a uma página de NPC (antes e logo depois de aplicar: zero).
select count(*) as fichas_em_paginas_de_npc from public.character_sheets s
  join public.campaign_codex c on c.id = s.character_id where c.category = 'npc';

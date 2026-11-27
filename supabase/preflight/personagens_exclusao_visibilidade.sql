-- Preparação somente leitura. NÃO executar em produção sem autorização específica.
-- Contagens agregadas, sem nomes, e-mails, fichas, inventários ou textos privados.
-- Não identifica automaticamente quais ocultações antigas foram intencionais.
begin transaction read only;
select count(*) as fichas,
 count(*) filter(where n.visibility <> 'campaign' and n.deleted_at is null) as identidade_global_oculta,
 count(*) filter(where n.deleted_at is not null) as nota_removida_com_ficha,
 count(*) filter(where not private.identidade_meta_valida(n.meta)) as identidade_fora_do_contrato,
 count(*) filter(where exists(select 1 from public.campaign_codex c where c.id=n.id)) as personagem_classificado_no_codex
from public.character_sheets s join public.notes n on n.id=s.character_id and n.campaign_id=s.campaign_id;

-- Ocultação por campo é uma configuração legítima e deve permanecer intacta.
select count(*) as fichas_com_campos_ocultos
from public.character_sheets s join public.notes n on n.id=s.character_id
where exists(select 1 from jsonb_each(case when jsonb_typeof(n.meta#>'{identidadePublica,settings}')='object' then n.meta#>'{identidadePublica,settings}' else '{}'::jsonb end) f
 where f.value->>'mode'='hidden');

-- Referências a aventureiros no combate e na configuração dos encontros: manter snapshots.
select count(*) as referencias_em_combate
from public.campaign_combats b cross join lateral jsonb_array_elements(b.state->'combatentes') c
where c#>>'{ref,tipo}'='personagem';
select count(*) as referencias_em_encontros
from public.campaign_encounters e cross join lateral jsonb_array_elements(e.state->'encontros') x
cross join lateral jsonb_array_elements(x->'participantes') p where p#>>'{ref,tipo}'='personagem';

-- Quantas notas ocultas são anteriores ao corte do reparo (reparos/identidades_ocultas_antigas.sql) e quantas não são.
select count(*) filter(where n.updated_at < timestamptz '2026-11-26 02:01:19+00') as ocultas_antigas_reparaveis,
 count(*) filter(where n.updated_at >= timestamptz '2026-11-26 02:01:19+00') as ocultas_recentes_a_investigar
from public.character_sheets s join public.notes n on n.id=s.character_id and n.campaign_id=s.campaign_id
where n.visibility <> 'campaign' and n.deleted_at is null;

-- Outra origem do mesmo aviso: fichas de quem já não participa da campanha (a leitura da linha pública exige o autor presente).
-- O reparo não as altera; o mestre as resolve pelo próprio aplicativo (gerenciar o personagem), depois da 0021.
select count(*) as fichas_sem_jogador_na_campanha
from public.character_sheets s where not exists (select 1 from public.campaign_members m where m.campaign_id=s.campaign_id and m.user_id=s.owner_id);

-- Pré-requisitos e colisões da 0021.
select to_regprocedure('public.codex_definitions_for(uuid)') is not null as tem_0019_ou_0020,
 public.codex_capabilities() as capacidade_atual,
 to_regclass('private_ficha.ciclo') is not null as ciclo_ja_existe,
 to_regclass('public.character_notices') is not null as avisos_ja_existem;
rollback;

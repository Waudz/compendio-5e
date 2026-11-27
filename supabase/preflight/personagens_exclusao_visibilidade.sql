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
where exists(select 1 from jsonb_each(coalesce(n.meta#>'{identidadePublica,settings}','{}'::jsonb)) f
 where f.value->>'mode'='hidden');

-- Referências a aventureiros no combate e na configuração dos encontros: manter snapshots.
select count(*) as referencias_em_combate
from public.campaign_combats b cross join lateral jsonb_array_elements(b.state->'combatentes') c
where c#>>'{ref,tipo}'='personagem';
select count(*) as referencias_em_encontros
from public.campaign_encounters e cross join lateral jsonb_array_elements(e.state->'encontros') x
cross join lateral jsonb_array_elements(x->'participantes') p where p#>>'{ref,tipo}'='personagem';

select to_regprocedure('public.delete_campaign_character(uuid,bigint,text,uuid)') is not null as operacao_ja_existe;
rollback;

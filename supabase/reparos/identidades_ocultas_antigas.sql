-- REPARO PROPOSTO. NÃO executar em produção sem autorização específica e sem antes rodar o preflight
-- `preflight/personagens_exclusao_visibilidade.sql`. Não é uma migração: não muda o esquema.
--
-- Origem: a 0013 passou a tornar visível à campanha todo personagem com ficha, mas só na gravação seguinte (não houve preenchimento
-- retroativo). Desde então nenhuma gravação consegue deixá-lo oculto; portanto uma nota oculta com ficha é, necessariamente, anterior
-- à 0013 e nunca regravada. O preflight separa a contagem pela data em que a 0013 foi aplicada (26/11/2026 02:01:19 UTC): se houver
-- nota oculta posterior a ela, NÃO rodar o reparo e investigar antes.
--
-- O que o reparo faz: toca a linha pública para o servidor refazer a apresentação. As escolhas por campo (personalizado/oculto) são
-- mantidas. A ficha completa não é alterada e continua restrita ao dono e ao mestre. Pode ser repetido sem efeito.
-- A única "ocultação" que ele desfaz é a global antiga, que o produto não oferece mais. Se o dono de algum desses personagens quis
-- não aparecer, ele continua podendo ocultar cada campo.
begin;
update public.notes n set meta = n.meta
 where n.kind = 'character' and n.deleted_at is null and n.visibility <> 'campaign'
   and exists (select 1 from public.character_sheets s where s.character_id = n.id and s.campaign_id = n.campaign_id)
   and not exists (select 1 from public.campaign_codex c where c.id = n.id)
   and private.identidade_meta_valida(n.meta);
commit;

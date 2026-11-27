# Ciclo de vida e visibilidade dos personagens (0021)

Especificação do responsável de 27/11/2026. **Substitui** a versão anterior deste documento (exclusão arquivada pelo jogador). Nada foi aplicado em produção; a proposta anterior de 0021 nunca foi aplicada e foi reescrita.

## Como funciona

Perder o controle é **trocar o dono para o mestre da campanha**. Ficha, vitais, status de combate, Realtime e definições de itens já são decididos por dono ou mestre, então o antigo dono deixa de ler e gravar sem política nova; a sessão aberta em outro aparelho recebe `ficha_nao_encontrada`. A troca só passa por funções do servidor, com uma marca por transação que a API não consegue criar.

| Situação | Ficha | Registro no Compêndio e vínculos | Listas de ativos |
|---|---|---|---|
| ativo | do dono | sim | sim |
| aguardando (renúncia) | preservada, com o mestre | sim | não |
| arquivado | preservada, com o mestre | sim | não |
| npc | preservada, com o mestre; mesmo registro, listado entre NPCs | sim | não |
| compendio | **removida** | identidade pública e vínculos continuam | não |
| excluido | **removida** | registro apagado logicamente; vínculos removidos | não |

- Ações: `character_lifecycle(campanha, ids, ação, operação, revisões, destino)`. Uma transação por chamada (lote é tudo ou nada), repetição inofensiva pelo identificador da operação, travas em ordem fixa. Renunciar, "só no Compêndio" e excluir exigem a revisão da ficha que a pessoa está vendo.
- Só o próprio jogador renuncia ao seu personagem ativo; todo o resto é do mestre da campanha.
- Transferência: o dono atual continua até o aceite; antes dele o destinatário recebe apenas o título público. Escolher o próprio mestre como destino não pede aceite. Outra decisão do mestre cancela a oferta pendente.
- "Reativar" devolve o personagem a ativo **sob o controle do mestre**; devolver a um jogador é transferir.
- Avisos em `character_notices` (renúncia ao mestre; oferta ao destinatário; resposta ao mestre), no mesmo sino, inclusive em "Marcar todas como lidas".
- Combate e encontros mantêm nome, PV, iniciativa e condições; na remoção da ficha só a ligação viva é desfeita. Documentos, diário e referências `@` no texto continuam (o jogador lê o nome como texto simples quando o destino deixou de existir).
- Portadores de itens e destino de transferência de itens ignoram quem está aguardando ou arquivado.
- Imagens de retrato não são apagadas.

## O que fica guardado

Ao remover a ficha ("só no Compêndio" e exclusão), uma cópia (ficha, itens já vistos, linha pública, referências de combate/encontro e, na exclusão, vínculos) fica em `private_ficha.ciclo_eventos`, **sem acesso pela API**. Serve à recuperação pelo responsável; o aplicativo não restaura. **Decisão a confirmar:** se "definitiva" deve também apagar essa cópia (e por quanto tempo mantê-la).

## Limites

- "Converter em NPC" mantém o registro de personagem e o classifica como NPC. Ele **não** ganha "Gerenciar conhecimento" por campo dos NPCs criados no Compêndio: isso exigiria converter o registro e quebraria as garantias da ficha guiada.
- O mestre não edita as escolhas de identidade de um personagem de jogador. Ao assumir o controle (aguardando, arquivado, NPC) ele passa a poder editá-las.
- Sem a 0021 no banco, o aplicativo não oferece nenhuma dessas ações (`character_states` ausente).

## Aviso "oculto dos jogadores"

O aviso vinha de um único ponto (`rotuloPrivacidade`), usado pelo Início, pela lista e pelo Compêndio. Duas origens, ambas reproduzidas em PostgreSQL isolado (`supabase/ciclo-personagens.test.ts`):

1. **Ficha anterior à 0013 e nunca regravada.** A 0013 passou a tornar o personagem visível na gravação seguinte, sem preencher o passado. Desde então nenhuma gravação consegue ocultá-lo. Correção: `supabase/reparos/identidades_ocultas_antigas.sql` (idempotente, mantém campos ocultos/personalizados, não toca na ficha). **Não aplicado.** Não depende da 0021.
2. **O jogador saiu da campanha.** A leitura da linha pública exige o autor presente; o mestre lia a ficha e não a linha. Ninguém ocultou nada. Com a 0021 o mestre vê "jogador saiu da campanha" e, ao gerenciar o personagem, o controle passa a ele e a identidade volta à campanha. Sem 0021, o aviso antigo continua.

Não é possível saber em produção quantos registros há em cada caso sem rodar o preflight. A única ocultação que o reparo desfaz é a global antiga, que o produto não oferece mais; escolhas por campo permanecem. Nenhuma regra de RLS foi afrouxada.

## Aplicação pelo responsável (não executada)

1. Confirmar o projeto `gwcttjlxzelzjhbuitmi`, backup recuperável e que 0017–0020 constam no histórico.
2. Rodar **somente leitura** `supabase/preflight/personagens_exclusao_visibilidade.sql` e guardar as contagens. Se `ocultas_recentes_a_investigar` for maior que zero, **não** rodar o reparo. `ciclo_ja_existe` e `avisos_ja_existem` devem ser falsos.
3. Com autorização, aplicar o arquivo completo `supabase/migrations/0021_personagens_ciclo_de_vida.sql` (já tem `BEGIN/COMMIT`).
4. Com autorização separada, executar `supabase/reparos/identidades_ocultas_antigas.sql` e repetir o preflight.
5. Testar com mestre, dois jogadores e outra campanha em dados temporários; só então publicar o aplicativo.
6. Reversão: `supabase/rollback/0021_personagens_ciclo_de_vida_down.sql` funciona apenas **antes do primeiro uso**; depois ela se recusa, para não devolver acesso nem perder cópias.

SHA-256 (fim de linha LF): migração `0485e4a315342716e2df7b4e74272450c16a311d844bb501546195edfd7b9d75`; reparo `7816a708bfe28bf1c69973f77f3010707836122f5a9c1ed8e3568d280241a438`. Recalcular se mudarem.

Nenhuma limpeza de personagens é automática. Os de teste podem ser removidos pelo mestre em Personagens → Selecionar → "Selecionar todos da campanha".

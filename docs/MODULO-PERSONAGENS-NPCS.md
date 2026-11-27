# Personagens e NPCs — módulo encerrado (27/11/2026)

Reformulação das DEC-038 a DEC-041. **Escopo fechado pelo responsável:** não acrescentar funcionalidades nem refinamentos a este módulo; correções de defeitos entram normalmente.

## Situação

| Parte | Código | Banco de produção | Site publicado |
|---|---|---|---|
| Ciclo de vida e visibilidade (DEC-038) | integrado (#168) | 0021 **aplicada** (não reaplicar) | publicado |
| Página Personagens, lista/grade, seleção (#169) | integrado | sem migração | publicado |
| Fichas de NPC, PV/condições, Iniciativa, Encontros, estado vital (#170) | integrado (#170) | **0022 aplicada** | **publicado** |

Em 27/11/2026, a 0022 foi aplicada em produção pelo ChatGPT com autorização expressa. Capacidade 21 → 22; contagens antes/depois iguais: 115 notas, 0 fichas, 6 páginas, 1 NPC com ficha de criatura. RLS de character_life ativa; codex_npc_sheet_set disponível a authenticated e não a anon. Não reaplicar. O diagnóstico completo das 12 funções e o agendamento não foram conferidos nesta aplicação; não há confirmação de backup novo. PR #170 mesclado em 5c75a51; publicação e E2E pós-merge aprovados. Teste manual com contas reais pendente.

## O que o módulo faz

**Três áreas, os mesmos registros.** *Personagens* é a gestão técnica das fichas (aventureiros e NPCs com ficha). *Compêndio → Personagens* é a enciclopédia narrativa de todos. *Iniciativa e Encontros* são só do mestre e usam apenas quem tem ficha.

### Página Personagens
- Lista (padrão) ou grade, preferência salva por usuário; busca por personagem e jogador; ordenação; filtros Todos, Ativos, Aguardando decisão e Arquivados (seletor compacto e menu de ordenação em painéis de até 700 px).
- Seções Aventureiros e NPCs (mestre); aviso quando não há NPC com ficha. Jogadores veem só aventureiros em jogo.
- "+ Criar" (aventureiro; NPC para o mestre, seguido da escolha da ficha).
- Cada cartão: nome (até duas linhas), alcunha (uma, em itálico, fora do subtítulo), dados da ficha, **PV atuais/máximos, temporários, condições e estado vital**, lidos da mesma fonte da ficha. Cartões da mesma altura.
- Seleção múltipla reutilizável (`src/ui/SelecaoMultipla.tsx`): vale só o que está visível; exclusão coletiva só com algo marcado.

### Ciclo de vida do aventureiro (0021)
Renúncia do jogador, aguardando decisão, arquivar/reativar, converter em NPC, manter só no Compêndio, transferir com aceite, exclusão definitiva com confirmação; lote atômico, avisos e sessão antiga sem acesso. Detalhes em [EXCLUSAO-VISIBILIDADE-PERSONAGENS](EXCLUSAO-VISIBILIDADE-PERSONAGENS.md).

### Ficha de NPC (0022)
- Uma identidade narrativa por NPC (a página do Compêndio). Quatro situações: sem ficha; **ficha própria de criatura** (cópia de um modelo do Bestiário ou criatura personalizada); **ficha de personagem** (mesmo criador dos aventureiros, mesmo ID da página); **personagem convertido** (continua como na 0021).
- "Adicionar ficha"/"Gerenciar ficha" na página do NPC e em Personagens: ver, editar, trocar e remover. Trocar ou remover uma ficha própria exige confirmação.
- A ficha perdida fica **30 dias** em cópia privada, fora da API; depois é apagada pela limpeza diária. Nome, história, segredos, retrato da página, vínculos, divulgação, histórico e estado vital não mudam.
- O vínculo antigo com uma criatura compartilhada continua funcionando; editar cria a cópia própria.
- Cópias próprias não aparecem no Bestiário nem nas buscas de criaturas, e não podem ser usadas por outro NPC.

### Combate
- Iniciativa e Encontros adicionam NPCs com ficha; uma ficha permanente não entra duas vezes. Monstros genéricos continuam com estado por instância e sem registro narrativo.
- NPC com ficha de personagem usa a mecânica das fichas. NPC com ficha de criatura guarda PV, temporários e condições de forma persistente, com as mesmas regras.
- **0 PV não é morte.** "Confirmar morte" muda o estado vital. Mortos (NPCs e aventureiros) ficam fora das listas de combatentes, salvo "Incluir mortos".

### Estado vital
Vivo (padrão), Morto ou Desconhecido, separado do ciclo de gestão, dos PV e das condições; só o mestre altera; ressuscitar preserva tudo; morrer não arquiva. Ícones neutros com texto. Não aparece nos cartões do Compêndio.

## Dados e permissões

| Dado | Onde | Quem lê | Quem grava |
|---|---|---|---|
| Identidade do aventureiro | `notes` (`character`) | conforme a apresentação publicada | dono (e regras do ciclo) |
| Página do NPC | `notes` (`npc`) + `campaign_codex` | mestre; jogador só a projeção revelada | mestre |
| Ficha de personagem (inclusive de NPC) | `character_sheets` | dono e mestre; **de NPC, só o mestre atual** | idem, por revisão e operações |
| Ficha própria de criatura | `campaign_definitions` (`custom-npc-<id>`) | mestre | mestre |
| Estado vital; PV/condições do NPC de criatura | `character_life` | mestre; o dono lê o do próprio aventureiro | só o mestre, por `character_life_set` |
| Cópias de 30 dias | `private_ficha.npc_ficha_eventos` e `ciclo_eventos` | ninguém pela API | só funções do banco |

- Jogador não descobre se um NPC tem ficha; a projeção dele não muda, exceto o estado vital revelado.
- Jogador não envia itens a um NPC. As operações do servidor (PV, itens) também recusam um mestre rebaixado que conste como dono.
- Página com ficha própria não pode ser removida antes de a ficha sair.

## Decisões
DEC-038 (ciclo de vida e retenção), DEC-039 (áreas, NPC e estado vital), DEC-040 (identidade única e diretrizes de cartões), DEC-041 (entrega integrada, reutilização da mecânica, retenção de 30 dias das fichas de NPC), em [DECISOES-E-ARQUITETURA](../DECISOES-E-ARQUITETURA.md).

**Diretrizes de cartões (sem novos ajustes isolados):** uniformes, sem esmaecimento; nome em até duas linhas e alcunha em uma; demonstrações com nomes naturais. A revisão definitiva dos cartões, agora com PV na tela, fica para quando o responsável a pedir; a diretriz de cartões **quadrados** ainda não foi aplicada.

## Código

- `src/npc/`: `estado.ts` (tipos, estado vital, adaptador dos NPCs de criatura à fila de vitais), `FichaDoNpc.tsx`, `ControleVital.tsx`, `EstadoNoCartao.tsx`, `SeletorNpc.tsx`.
- Reutilizados: `vitais/vitais` (`aplicarAcao`), `vitais/loja`, `vitais/combate`, criador guiado, `EditorDefinicao`, `SeletorMonstro`.
- Banco: `0022_npc_ficha_de_personagem.sql`, reversão e `preflight/0022_conferir.sql`.

## Limitações conhecidas

1. **#170 publicado em 27/11/2026.** Com o banco 21 o aplicativo se comporta como antes.
2. Sem filtro por estado vital nas listas (previsto na DEC-039, fora desta entrega).
3. O jogador ainda não vê na tela o estado vital do próprio aventureiro (o banco já permite); outros jogadores não o veem. Aventureiros não têm divulgação por campo.
4. Personagem convertido em NPC não tem conhecimento por campo nem "Gerenciar ficha"; usa "Gerenciar personagem".
5. PV de NPC com ficha de criatura mudam na Iniciativa; a página da ficha de criatura não mostra o PV atual. Não há salvaguardas contra a morte para criaturas.
6. O retrato do NPC é o da página. Um retrato colocado dentro da ficha de personagem do NPC sai junto com ela (fica na cópia de 30 dias).
7. Recuperar uma cópia de 30 dias exige acesso ao banco; não há tela.
8. "Confirmar morte" aparece na Iniciativa quando o combatente está com 0 PV; fora disso, use o estado vital na página.
9. A atualização entre aparelhos do estado dos NPCs de criatura é por releitura periódica, não imediata.
10. Em Compêndio → Personagens, a alcunha do aventureiro vem da identidade publicada.
11. A verificação de acessibilidade apontou itens **anteriores** a este módulo na Iniciativa: contraste na faixa de turnos, ordem de títulos e rótulo do botão "Temp.".
12. Não foi feita conferência em produção com contas reais deste PR.

## Resultados dos testes

Ver a tabela em [CONTINUIDADE-DESENVOLVIMENTO](CONTINUIDADE-DESENVOLVIMENTO.md#encerramento-do-módulo-de-personagens-e-npcs) (mantida num só lugar).

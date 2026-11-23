# Regressões de personagens — rodada curta de testes

Base: main `ebab8d47e4339a08405c097255f576a501723708`. Branch `test/regressoes-personagens`. Nenhuma implementação de produção, configuração, dependência ou migration alterada.

## Cobertura existente consultada (não recriada nem reexecutada)

| Fluxo | Testes existentes |
| --- | --- |
| Criação, salvamento, reabertura e reload | `src/criador/persistenciaServidor.test.tsx`; `e2e/creator/expansao-2014.creator.ts` |
| Navegação entre abas, inventário, Compêndio e alterações não salvas | `src/criador/criadorGuiado.test.tsx`; `e2e/creator/flows.creator.ts` |
| Equipamentos iniciais idempotentes, substituição e preservação de aquisições | `src/rules/starting-equipment-selection.test.ts`; `src/criador/criadorGuiado.test.tsx` |
| Dono, outro jogador, mestre e identidade pública | `src/criador/persistenciaServidor.test.tsx`; `src/rules/public-identity.test.ts` |

Vitest configurado em `vite.config.ts`; React Testing Library/jsdom para UI; Playwright separado em `playwright*.config.ts`. A autorização real possui testes SQL separados; a API em memória aqui não certifica RLS remota.

## Três regressões complementares

Arquivo novo: `src/criador/regressoes-persistencia.test.tsx`.

1. Uma resposta de gravação deliberadamente pendente não muda a revisão/draft persistidos; a UI mantém o aviso de alterações não salvas até receber a confirmação.
2. Cancelar troca de Guerreiro para Mago mantém a classe, a ficha sem alterações pendentes e as duas instâncias de inventário; nenhuma chamada de gravação ocorre.
3. Renomear um personagem existente mantém ID, campanha, dono e todo o draft salvo exceto o nome, inclusive duas instâncias distintas da mesma Adaga com quantidades/equipamento/origens diferentes. A identidade pública permanece com o alias e não recebe inventário, moedas, recursos ou `previousRulesDraft` privado.

Não foi criado outro teste de reaplicação de equipamentos: o comportamento já está coberto nos arquivos acima. Fixtures são sintéticas e descartáveis, reutilizando `renderApp`, `memoryStorage`, `fichasEmMemoria` e os contratos da main. Nenhuma chamada de rede ou conta real; sem temporizações fixas, snapshots ou falhas esperadas.

## Execução desta rodada

Executado **uma vez**, somente o arquivo novo:

`npm test -- --configLoader runner --maxWorkers=1 src/criador/regressoes-persistencia.test.tsx`

Resultado: **3 aprovados, 0 falhas**, um arquivo; 7,30 s no Windows. `--configLoader runner` contorna a limitação conhecida do esbuild no sandbox local. Não executados build Vite, suíte unitária completa ou E2E completos. A checagem de tipos usa `npx tsc -b`, sem publicar o app. O CI habitual pode ser acionado automaticamente ao abrir o PR; seu resultado não é presumido por estes números.

## Trabalho paralelo / PR #97

Sem dependência de código não integrado: casos executáveis sobre a main. O HEAD #97 consultado foi `0338919e8ef95ce2b866ff782ee0dcdb17008442`. A nova ficha em modo leitura, o botão Editar personagem e a preservação de edições feitas *durante* uma gravação são trabalho do #97 e não são apresentados como testados aqui. Quando esse fluxo entrar na main, o helper de abertura deste teste precisará passar pelo botão de edição, se o contrato visual mudar. As asserções de persistência/identidade não dependem desses detalhes de navegação. Nenhum arquivo da implementação do #97 ou do Claude foi modificado.

## Compatibilidade com a ficha de leitura do PR #97 — 22/11/2026

A validação conjunta com #97 reproduziu três falhas: o helper aguardava diretamente o campo de nome, mas a ficha salva abria corretamente em leitura. O helper agora aguarda o campo ou aciona Editar personagem quando disponível. Nenhuma asserção de confirmação de gravação, cancelamento de classe, identidade ou instâncias de inventário foi removida.

Verificação em duas bases: os três testes passam na branch original do #102 e os mesmos três passam na integração com #97, #103–#109 e #110–#112. Build da branch original aprovado. Sem alteração de implementação, dados reais ou banco. CI do novo HEAD ainda deve ser conferido.

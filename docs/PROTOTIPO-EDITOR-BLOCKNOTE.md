# Protótipo do editor por blocos — BlockNote (PR 2, experimental)

> 19/11/2026. **Protótipo isolado, não é o módulo de Planejamento.** Sem Supabase, sem persistência, sem migração, sem RLS. Dados fictícios locais. Não afeta o aplicativo publicado.

## Como abrir
`npm run dev` e acessar `http://localhost:5173/compendio-5e/?lab=editor` (só em desenvolvimento). Na build normal o laboratório e o BlockNote **não entram no pacote** (verificado: o JS principal muda +0,01 kB; nenhum chunk ou arquivo novo). Para medir o impacto do editor existe a variável `VITE_EDITOR_LAB=1`, usada apenas em build de medição, nunca no deploy. Abas do laboratório: **Quadro de planejamento** (Sessão 5 — Festival da Lua), **Editor (bancada)**, **Painéis FlexLayout** (1 a 3 painéis reais) e **Desempenho**.

## Dependências (fixadas, sem `^`)
| Pacote | Versão | Licença |
|---|---|---|
| `@blocknote/core`, `@blocknote/react`, `@blocknote/mantine` | 0.57.0 | MPL-2.0 |
| `@mantine/core`, `@mantine/hooks` | 8.3.11 | MIT |

- Verificado no `package-lock.json`: nenhuma licença GPL, AGPL ou proprietária na árvore (294 MIT, 3 MPL-2.0, 6 Apache-2.0, demais permissivas). **Nenhum `xl-*`**, `yjs` ou recurso pago. Teste automatizado impede a entrada de `@blocknote/xl-*`.
- **Mantine 8, não 9:** o Mantine 9 exige React 19; o projeto está em React 18. O `@blocknote/mantine` 0.57 aceita `^8.3.11 || ^9`.
- React 18 e TypeScript estrito: compilam sem erro. A tipagem do editor com esquema customizado é pesada (a bancada usa conversões de tipo pontuais).
- BlockNote é **anterior à 1.0** (API ainda muda) e traz o Mantine como dependência de interface (o projeto não tinha biblioteca de UI).

## Impacto no tamanho (KiB, build de produção, bruto / gzip)
| | Antes (`main`) | Build normal (este PR) | Com o laboratório (`VITE_EDITOR_LAB=1`) |
|---|---|---|---|
| JS principal | 616,2 / 171,3 | 616,2 / 171,3 (+0,01 kB) | 618,1 / 172,1 |
| CSS principal | 37,0 / 6,5 | 37,0 / 6,5 | 37,0 / 6,5 |
| Chunk do editor (carregado sob demanda) | — | **não existe** | JS 1002,7 / 309,7 + CSS 234,2 / 37,5 |
| Idioma (1 por vez; 25 idiomas, ~3 MB no total) | — | — | `en` 71,5 / 25,9; `pt` 92,7 / 31,6 |

Para o usuário que abrir o editor: cerca de **1,3 MiB brutos (≈ 370 KiB gzip)**, baixados uma vez, sob demanda. O app inicial não cresce. Observação: importar `@blocknote/core/fonts/inter.css` fazia a build publicar 18 arquivos de fonte (~350 kB) mesmo sem uso; a importação foi removida (o app já define a fonte).

## O que foi validado (e como)
Ambiente: Chromium do painel embutido do Claude, desktop. Valores variam por máquina.

**Funciona (verificado no navegador, com teclado real quando indicado):**
- Títulos, parágrafos, listas, **blocos aninhados** (Tab), digitação real e **desfazer/refazer** (Ctrl+Z / Ctrl+Y) — teclado real.
- Tabela (inserida pela API; 4 células renderizadas), link, **referência interna** (conteúdo inline próprio `ref` com `{kind, refId, label}`; serializa e restaura).
- Modo leitura/edição. **JSON ida e volta idêntico** (1,6 kB e 2,8 kB, comparação byte a byte).
- Quadro: cartões compactos (título + prévia de texto), expandidos (renderizador leve somente leitura), edição de **um** cartão por vez, reorganização por botões (↑ ↓ ← →) sem perda nem cópia.
- **Dentro do FlexLayout:** 2 painéis (485 px cada) e 3 painéis (321 px cada); o editor funciona dentro de um painel. Abaixo de 640 px o quadro empilha as colunas (container query).
- **Segurança:** JSON com `javascript:` no link → o editor renderiza `href=""` (sem URL executável); HTML (`<img onerror>`, `<script>`) no texto vira texto inerte; nenhum `<img>`/`<script>` no DOM. A prévia própria só aceita `http`, `https`, `mailto` e `compendio:` (testes).

**Desempenho (sintético, mesma máquina):**
| Teste | Resultado |
|---|---|
| Quadro com 100 / 500 / 1000 cartões compactos | pintado em 89 / 275 / 459 ms; 2,4 mil / 12 mil / 24 mil nós de DOM; heap +4 / +17 / +33 MB |
| 1 / 5 / 20 editores completos montados (somente leitura) | 62 / 81 / 186 ms; 35 / 171 / 681 nós; heap +8 MB / ruído (coleta de lixo) / +18 MB |
| 300 inserções de caractere por API | mediana 0,20 ms, p95 0,30 ms (documento pequeno); mediana 0,10 ms, p95 0,80 ms, máx. 39 ms (documento de 500 blocos) |
| Documento de 500 blocos carregado | 21 ms (síncrono) |

Leitura: um editor completo custa cerca de 0,5 a 1 MB de heap e ~9 ms para montar; **não** montar um por cartão é correto, e a estratégia "prévia leve + um editor ativo" funcionou. Acima de ~500 cartões a prévia leve já pesa em DOM: usar virtualização ou carregar por sessão. A memória é lida de `performance.memory` sem forçar coleta (valores ruidosos). **Não** houve medição objetiva de latência de teclado real: a digitação real não mostrou atraso perceptível, mas isso não é uma métrica.

## Limitações e pontos não verificados
1. **Celular real: não testado.** Só emulação do painel (375 px, agente Android, pontos de toque): o layout funcionou e não houve rolagem horizontal. Teclado virtual, IME, alça de arrastar com toque, seleção por toque e rolagem dentro de cartões **precisam de teste em aparelho**.
2. **Arrastar blocos dentro do BlockNote (alça lateral do editor) não foi testado**; apenas Tab/Enter e a API. O arrastar de **cartões** do quadro foi implementado e é outro mecanismo (seção abaixo).
3. **Tabelas:** inseridas por API e renderizadas; a edição interativa de células não foi exercitada.
4. **Links internos:** o conteúdo inline `ref` funciona, mas o clique dentro do editor não está ligado a navegação (no quadro, a prévia chama `onRef`). Em produção, deve usar `openContentLink`, do PR 1.
5. **Personalização visual:** as cores se ajustam por variáveis CSS (`--bn-colors-*`) com facilidade. A **densidade** (margens laterais de ~54 px e títulos grandes pensados para página inteira) exigiu seletores sobre classes internas (`.bn-block-content[data-content-type=heading] .bn-inline-content`, com `!important`): é frágil entre versões.
6. **Pré-1.0 e Mantine:** risco de mudanças de API; recomenda-se versão fixa e um adaptador próprio (`PageEditor`) entre o aplicativo e o BlockNote.
7. **Idiomas:** a build com o laboratório gera 25 arquivos de idioma (carregados 1 por vez); revisar se é possível limitar ao português e ao inglês.
8. Digitação e memória medidas só no Chromium; Firefox e Safari não testados.

## Tiptap
Não foi necessário comparar na prática: **não apareceu limitação impeditiva** no BlockNote. Para referência (verificado no npm): Tiptap 3.34.0, MIT, com tabela, `details` e alça de arrastar também MIT. Seria a alternativa se a personalização da densidade ou o risco pré-1.0 se mostrarem inaceitáveis; custaria mais código para reproduzir o menu `/`, os blocos e as tabelas.

## Arrastar e soltar cartões (Tarefa do PR #28 / Issue #29)

**Biblioteca escolhida: `@dnd-kit`** (clássico, **`core` 6.3.1 + `sortable` 10.0.0 + `utilities` 3.2.2**, MIT, versões fixadas; `accessibility` 3.1.1 entra como dependência). React 18 (peer `>=16.8`), sem dependências extras. Alternativas avaliadas no npm: `@dnd-kit/react` 0.5.3 (nova geração, MIT, ainda pré-1.0) e `@hello-pangea/dnd` 18.0.1 (Apache-2.0, bom para listas, menos flexível para sensores e alças). Escolhi o clássico por ser estável, ter sensores de mouse, toque e teclado, anúncios de acessibilidade e auto-rolagem. **Ressalva:** a última publicação do pacote clássico é de dezembro de 2024; se a manutenção parar, a migração natural é para `@dnd-kit/react`.

**Impacto:** build normal **inalterada** (mesmo arquivo, mesmo hash). No chunk do laboratório: JS +54,3 KiB brutos / +17,9 KiB gzip (1002,7 → 1057,0 KiB), CSS +1,7 KiB.

**Como funciona**
- **Alça dedicada** (ícone de pegada) é o único ponto de arrasto; o corpo do cartão e o editor nunca iniciam arrasto. Cartão em edição tem a alça desabilitada.
- Sensores: **mouse** (move 6 px para começar, então um clique na alça não arrasta), **toque** (pressão longa de 250 ms na alça; antes disso o movimento rola a página) e **teclado** (foco na alça → Espaço pega, setas movem, Espaço solta, Esc cancela).
- **Onde será solto:** o cartão arrastado vira um espaço tracejado na posição de destino e um cartão flutuante acompanha o cursor; colunas vazias têm uma área tracejada "Solte um cartão aqui" que acende ao receber o cartão. **Esc cancela** e restaura exatamente o estado anterior.
- **Botões ↑ ↓ ← →** continuam como alternativa (aparecem ao passar o mouse ou focar o cartão; em telas sem hover ficam sempre visíveis).
- Acessibilidade: instruções e anúncios em português para leitores de tela (região ao vivo do dnd-kit); respeita `prefers-reduced-motion` (sem animações).
- **Modelo:** o cartão referencia uma **página** (`Card { pageId, mode }`, `Page { blocks }`). Mover, reordenar ou duplicar o cartão só reordena referências: **as páginas nunca são alteradas** (testado). A amostra inclui um **atalho** (dois cartões, a mesma página da Marta; editar uma reflete na outra).

**Verificação**
| Interação | Como | Resultado |
|---|---|---|
| Arrastar para **coluna vazia** | mouse real (ferramenta de arrasto do painel) | OK |
| **Reordenar** na mesma coluna | mouse real | OK |
| Indicador de destino, cartão flutuante e anúncio ao vivo | eventos de mouse com pausas, captura de tela | OK |
| **Cancelar** com Esc | evento de teclado | volta ao estado anterior; sem resíduos |
| **Teclado** (Espaço, → →, Espaço) | teclas reais | OK; anúncios em português; foco permanece na alça |
| Arrasto **não** inicia ao selecionar texto no editor | eventos de mouse no texto do BlockNote | OK (nenhum arrasto; seleção feita) |
| Alça desabilitada em edição | eventos de mouse | OK |
| **Toque** (emulação 375 px) | TouchEvent sintéticos | toque curto com movimento não arrasta; pressão longa arrasta e solta |
| Dentro de painel do **FlexLayout** (2 painéis) | mouse | cartão flutuante posicionado corretamente |
| Lógica de destino, limites, cancelamento, atalhos | Vitest (puro) | 20 testes |
| Alças acessíveis, botões como alternativa, coluna vazia | Vitest (componente) | 4 testes |

**Limitações:** (a) **nenhum teste em dedo/aparelho real** (os toques foram sintéticos): precisão da pressão longa, conflito com a rolagem inercial e com o teclado virtual seguem não verificados; (b) o arrasto com mouse foi feito pela ferramenta do painel e por eventos sintéticos, não por um usuário; (c) dois navegadores não testados; (d) em colunas muito longas a rolagem automática do dnd-kit não foi exercitada; (e) a posição de soltura usa `closestCorners`; em colunas com cartões muito altos (expandidos) o destino pode surpreender e exige ajuste fino; (f) as cores dos botões de seta sobrepostos ao título podem esconder parte de títulos longos ao passar o mouse.

## Ajustes do quadro (PR D)

- **Aparência:** o cartão expandido tem agora a **mesma aparência do fechado** (mesma borda de 1 px, sem brilho azul e sem fundo próprio); expandir muda só a altura e o conteúdo. Medido no navegador: borda, sombra, fundo e padding **idênticos** entre cartão aberto e fechado. Teste estático impede o retorno de borda, brilho ou fundo em `.lab-card.expanded`.
- **Arrastar, feedback discreto:** espaço reservado tracejado de 1 px, sem preenchimento azul; cartão flutuante com sombra leve; coluna que recebe o cartão só ganha um fundo azul-claro tênue; coluna vazia, borda tracejada fina.
- **Foco visível:** todo botão do cartão (alça, título, setas, Editar) mostra anel de foco por teclado (`outline: 2px`), verificado na alça após arrasto por teclado.
- **Cartões altos:** com todos os cartões expandidos (alturas de 123 a 292 px), o destino passou a ser decidido pelo que está **sob o ponteiro** (`pointerWithin`, com `closestCorners` como reserva, o que mantém o teclado funcionando) e o espaço reservado no destino é **compacto** (72 px), para a coluna não "pular". Verificado: soltar na parte de cima do 2º cartão de uma coluna insere na posição 1; soltar na parte de baixo do último cartão insere no fim. Antes do ajuste, um cartão alto entrava sempre na posição 0 porque o espaço reservado de 292 px empurrava os vizinhos.
- **Rolagem automática:** quadro com 500 cartões (página de 9 001 px). Com o ponteiro junto da borda inferior da janela a página rolou de 0 a 1 840 px; junto da borda superior voltou a 0; Esc cancelou e não restou cartão flutuante nem espaço reservado. (Rolagem da página; as colunas não têm rolagem interna.)
- **BlockNote e FlexLayout preservados:** em 2 painéis o editor abre normalmente, a alça fica desabilitada durante a edição e o cartão volta ao normal ao cancelar.
- **O que é do laboratório e o que é candidato à interface final:** `Board.tsx`, `Preview.tsx`, `model.ts` e `schema.tsx` são os candidatos; **`Lab.tsx`, `EditorBench.tsx` (botões "Medir digitação", "Documento de 500 blocos", "Exportar/Carregar JSON", "Ida e volta"), as abas "Painéis" e "Desempenho" e `mount.tsx` são só do laboratório e não devem ser transportados**. Teste estático garante que o `Board` não contém controles de teste. O laboratório continua no repositório e fora da build normal.
- **Limitações novas:** a rolagem automática foi testada só com a rolagem da página; arraste por toque real, em aparelho, segue não verificado; com cartões muito altos o destino exato ainda depende de onde o ponteiro está no momento da entrada na coluna.

## Recomendação
**Seguir com o BlockNote** como editor, com condições: (a) teste em celular real e do arrasto de blocos antes de fechar o módulo; (b) versão fixa e adaptador próprio; (c) JSON de blocos como formato canônico (já validado: ida e volta idêntica); (d) aprovação das dependências, inclusive o Mantine 8. **Pode-se avançar para a modelagem do banco** das páginas, cartões e conteúdo em JSON, porque o formato e as prévias foram validados; os itens 1 a 3 não alteram o modelo de dados.

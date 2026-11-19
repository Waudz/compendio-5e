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
2. **Arrastar blocos (alça lateral) não foi testado**; apenas Tab/Enter e a API. Arrastar **cartões** não foi implementado (botões).
3. **Tabelas:** inseridas por API e renderizadas; a edição interativa de células não foi exercitada.
4. **Links internos:** o conteúdo inline `ref` funciona, mas o clique dentro do editor não está ligado a navegação (no quadro, a prévia chama `onRef`). Em produção, deve usar `openContentLink`, do PR 1.
5. **Personalização visual:** as cores se ajustam por variáveis CSS (`--bn-colors-*`) com facilidade. A **densidade** (margens laterais de ~54 px e títulos grandes pensados para página inteira) exigiu seletores sobre classes internas (`.bn-block-content[data-content-type=heading] .bn-inline-content`, com `!important`): é frágil entre versões.
6. **Pré-1.0 e Mantine:** risco de mudanças de API; recomenda-se versão fixa e um adaptador próprio (`PageEditor`) entre o aplicativo e o BlockNote.
7. **Idiomas:** a build com o laboratório gera 25 arquivos de idioma (carregados 1 por vez); revisar se é possível limitar ao português e ao inglês.
8. Digitação e memória medidas só no Chromium; Firefox e Safari não testados.

## Tiptap
Não foi necessário comparar na prática: **não apareceu limitação impeditiva** no BlockNote. Para referência (verificado no npm): Tiptap 3.34.0, MIT, com tabela, `details` e alça de arrastar também MIT. Seria a alternativa se a personalização da densidade ou o risco pré-1.0 se mostrarem inaceitáveis; custaria mais código para reproduzir o menu `/`, os blocos e as tabelas.

## Recomendação
**Seguir com o BlockNote** como editor, com condições: (a) teste em celular real e do arrasto de blocos antes de fechar o módulo; (b) versão fixa e adaptador próprio; (c) JSON de blocos como formato canônico (já validado: ida e volta idêntica); (d) aprovação das dependências, inclusive o Mantine 8. **Pode-se avançar para a modelagem do banco** das páginas, cartões e conteúdo em JSON, porque o formato e as prévias foram validados; os itens 1 a 3 não alteram o modelo de dados.

# Segunda etapa de qualidade — relatório de execução

## Base, dependência e escopo

- Main conferida: `c651368`. Infraestrutura reutilizada do PR #76: `33eab06`.
- Branch separada `test/quality-stage-2`, PR com base `test/playwright-e2e`; depende da integração do #76 e posterior revisão da base. Nenhuma alteração nas branches #74/#75/#76.
- Somente dados sintéticos do modo demo existente; fixture de rede fechada, nenhum usuário real ou Supabase de produção. Nenhum merge/deploy autorizado.
- Matriz: 320/360/390/700/701/768/1024/1440 px em Chromium. Divisões reais 50/50 e 30/70 em 1024/1440 px, via menu e arraste de divisória, com restauração após reload. Interfaces mobile e desktop são testes distintos; skips indicam explicitamente onde o recurso não existe.

## Cobertura e evidência

- Semântica WCAG 2 A/AA e 2.1 A/AA com axe; árvore acessível e capturas anexadas.
- Ordem de Tab/Shift+Tab, Enter, indicador de foco; menu contextual por Shift+F10, setas e Escape; diálogo mobile e confirmação real de exclusão (somente cancelar).
- Navegação rápida, reload, histórico do navegador entre papéis sintéticos e Voltar mobile. Não confundir histórico de documentos do navegador com abas internas desktop.
- PerformanceObserver/MutationObserver e ResourceTiming para diagnóstico; nenhum teto temporal, de bytes ou mutações. Esperas por condições observáveis, sem sleeps/retries. Não há instrumentação de renders React nem benchmark de produção.

## Resultados

Primeira execução: [CI 44825742576](https://github.com/Waudz/compendio-5e/actions/runs/44825742576), commit `2be3aaf`. 36/36 E2E originais aprovados; etapa 2: **52 aprovados, 20 falhas, 32 não aplicáveis**. Tipos/build e 560 testes existentes aprovados. Não houve falhas de divisão, estabilidade ou diagnóstico de carregamento. Correções de teclado em revalidação; resultados finais serão acrescentados abaixo.

## Defeitos confirmados e reprodução

| ID | Gravidade | Reprodução / comportamento observado | Evidência e tratamento |
|---|---|---|---|
| Q2-01 | P2 | Desktop 701/768/1024/1440: focar Diário, Shift+F10, ArrowDown. O foco fica no primeiro item, não vai ao seguinte. | Falha E2E de setas + unitário `ContextMenu.a11y.test.tsx` reproduzido vermelho antes da correção. Corrigido em `ContextMenu`: setas/Home/End pulam desabilitados e circulam. |
| Q2-02 | P2 | Mesmo menu: Escape fecha, mas foco não retorna a Diário. | Falha E2E e unitário vermelho antes da correção. Corrigido: captura e restauração do acionador conectado. |
| Q2-03 | P2 | Mobile 320/360/390/700: focar Abrir menu e Enter. O diálogo aparece, mas foco continua fora dele. Tab não fica contido; não havia tratamento de Escape. | Falha de contenção de foco nas quatro larguras. Corrigido no menu mobile: foco inicial, ciclo Tab/Shift+Tab, Escape e retorno de foco, com `aria-modal`. |
| Q2-04 | P2 / axe serious | Como jogador, abrir Início e Diário. A auditoria detecta `color-contrast`: texto ativo da barra inferior no celular; marca do site e rótulo da campanha no desktop. | JSON `axe` e capturas do relatório por largura. **Pendente**, sem alterar a paleta compartilhada nesta entrega. |
| Q2-05 | P2 / axe serious | Como jogador, Início: cartões de aventureiros com texto visível e `aria-label` divergentes. No desktop também seletor da campanha e aba com rótulo acessível “Campanha” apesar do título visível da campanha. | Regra `label-content-name-mismatch`, árvore acessível e alvos no relatório. **Pendente**; exige reconciliar nomes visíveis/ARIA e integração com FlexLayout, sem copiar títulos sensíveis ao layout persistido. |

A auditoria axe continua exigindo zero violações: sem allowlist, `test.fail`, retries ou exclusões de regras para mascarar Q2-04/Q2-05. Portanto CI E2E permanece vermelho enquanto esses defeitos persistirem. O PR deve permanecer em rascunho e não ser integrado como aprovado.

## Limitações e coordenação

- A sandbox Windows bloqueia esbuild/Vite dev ao enumerar um ancestral; browser executado no CI Linux. Celulares são emulados; leitor de tela real, Firefox/WebKit, rede real, autenticação, RLS e dados de produção não são exercitados.
- Diários, anotações e campanha da main são usados como superfícies reais de navegação; sem alterações dos módulos de personagem, ficha, inventário, Compêndio ou Enciclopédia.
- Conflitos potenciais com #74: `package.json`, lockfile e README; preservar todas as dependências/scripts ao reconciliar. Nenhum arquivo de domínio compartilhado com #75. Dependência direta de #76 em fixtures, configuração-base e workflow. Revalidar após a integração de cada frente; CI verde na demo não prova permissões/persistência reais.

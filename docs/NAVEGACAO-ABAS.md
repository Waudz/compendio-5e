# Navegação por abas e divisão de painéis

Status: **implementado e integrado à `main`** (PR #22, divisão com aba única; PR #23, navegação, fixação e proteção de alterações), **com duas verificações de interface ainda pendentes (seção 6): a navegação não deve ser considerada totalmente concluída até serem resolvidas.** Testes: `src/divisao.test.ts`, `src/navegacao.test.ts`, `src/navegacao.test.tsx`, `src/App.test.tsx`. Visão geral e roteiro: `DECISOES-E-ARQUITETURA.md` e `PLANEJAMENTO-V2.md`.

## 1. Comportamento (decisões aprovadas e implementadas)

**Clique normal no menu lateral** (`navigate(model, spec, "reuse")`):
1. Destino já aberto (mesmo id) → seleciona essa aba e ativa o painel dela; nunca duplica.
2. Senão → troca o conteúdo da aba selecionada do **painel ativo**, se ela não for **fixada** nem tiver **alterações não salvas**; a nova aba ocupa a mesma posição.
3. Selecionada indisponível → reutiliza outra aba normal e limpa do mesmo painel; senão cria uma aba normal. Todas fixadas → cria aba normal.
4. Nunca substitui aba fixada nem "pula" de painel. Aberturas automáticas (criar/entrar em campanha, abrir pelo convite) usam **nova aba**, para não trocar a aba em uso de surpresa.

**Gestos e menus**
- Ctrl/Cmd + clique e botão do meio: nova aba interna (o botão do meio não dispara autoscroll).
- Botão direito (ou tecla de menu) em item de navegação: **Abrir nesta aba · Abrir em nova aba · Abrir em nova aba fixada**.
- Menu da aba: **Fixar/Desafixar**, mover entre colunas, abrir em nova coluna, **Fechar aba**, **Fechar outras abas normais** (ignora fixadas), **Fechar coluna**.
- O menu abre junto ao ponto de interação, respeita os limites da tela e fecha com clique fora, Esc ou seleção. Não intercepta campos editáveis.

**Fixação:** propriedade da própria aba (`config.pinned`), selecionável, desafixável e fechável à mão, com alfinete e texto acessível "(fixada)". Usa-se propriedade própria porque o `pinned` nativo do FlexLayout agrupa as fixadas no início, impede fechá-las pela interface e arrastá-las para fora do painel.

**Registros em abas próprias:** ids estáveis `tipo:ref` (`secao`, `conta`, `campanha`, `ficha`, `npc`, `documento`); o mesmo id é sempre a mesma aba, e o escopo vem da partição do layout (usuário + campanha ativa), então campanhas diferentes nunca compartilham abas. Hoje só `campanha` e as seções têm painel real; os demais tipos esperam seus módulos.

**Celular (≤ 700 px):** sem arraste de colunas; mostra o painel ativo. Toque normal navega pela regra padrão; **toque prolongado** (≈ 500 ms, cancela se mover) abre o menu; botões acessíveis por texto, **"Opções de <aba>"** (fixar/fechar) e **"Nova aba"** (lista de seções), dispensam o toque prolongado. A faixa de abas rola sozinha; a página não rola na horizontal (verificado em 375 px).

## 2. Divisão de painéis e painéis vazios
- **Causa do bug antigo:** ao soltar a única aba na lateral do próprio painel, o FlexLayout movia a aba e apagava o painel de origem esvaziado (`enableDeleteWhenEmpty`); o resultado voltava a um painel só, embora o indicador prometesse uma divisão.
- **Solução:** `classifyDrop` é a única fonte de verdade (indicadores do FlexLayout, menu de contexto e ação final). Aba única solta na lateral do próprio painel (ou na borda da área, no lado em que o painel já está) **divide a tela**: `prepareMove` devolve uma ação atômica que marca o painel de origem com `enableDeleteWhenEmpty:false` (atributo documentado) e o torna o painel ativo.
- **Vazio intencional × painel a remover:** vazio intencional = sem abas **e** `enableDeleteWhenEmpty:false`. `normalizeEmptyPanels` devolve o padrão assim que o painel recebe uma aba; fechar a última aba de um painel normal o remove. Só a divisão cria painel vazio.
- **Indicadores:** nunca em cima/embaixo, nunca para o 4º painel, nunca para operações que não mudam nada (painel inteiro sobre si mesmo, vizinho imediato).
- **Estado vazio:** "Painel vazio. Escolha uma seção no menu lateral ou arraste uma aba para cá"; clicar nele o torna ativo, e a próxima seção aberta pelo menu o preenche.
- **Persistência:** painéis vazios são salvos e restaurados (`sanitizeLayout` mantém grupo vazio apenas se já veio vazio; descarta grupo cujas abas eram todas inválidas); acima de 3 grupos descartam-se vazios antes de fundir abas. O peso padrão (100), que o FlexLayout omite, passou a ser gravado para as larguras restaurarem iguais.

## 3. Persistência e isolamento
- Chave `compendio5e:workspace:v2:<usuario>:<campanha>:<dispositivo>`, envelope `{version:2, layout}` (versão inalterada: `pinned` é campo opcional).
- O layout guarda **só ids, geometria, seleção, grupo ativo e `pinned: true`**; nunca títulos, nomes de campanha, descrições nem `config`. Layouts antigos (sem `pinned`) e valores inválidos são tratados.
- Troca de conta remonta o espaço de trabalho; sair apaga as chaves da conta; aba de registro sem acesso mostra a mesma tela de "inexistente".

## 4. Alterações não salvas
`unsaved.tsx`: editores informam "sujo" por aba (`useUnsavedGuard`, com `save` opcional). Confirmação (**Cancelar** · **Salvar** quando existir · **Descartar alterações**) ao fechar aba, botão X do FlexLayout, **fechar coluna** (menu e botão), fechar outras abas normais, sair da conta e trocar de campanha; `beforeunload` ao recarregar. A aba suja nunca é substituída pelo clique normal. **Fixar não substitui a confirmação.** O registro é só em memória.

## 5. Limitações conhecidas
- Ainda não existem editores reais: a proteção foi testada com um editor de teste; cada editor futuro precisa adotar `useUnsavedGuard`.
- Se o acesso a uma campanha for perdido enquanto ela está ativa, o espaço de trabalho troca sem confirmação (não há como interceptar).
- Soltar repetidamente a aba única na lateral pode acumular painéis vazios (ex.: `[vazio][vazio][aba]`); cada um se fecha pelo botão da coluna.
- Títulos longos aparecem truncados na faixa de abas do celular.
- Mover abas entre colunas só tem alternativa por teclado via menu de contexto; não há arraste por toque no celular (intencional).
- Ctrl/Cmd+clique e botão do meio dependem do navegador; o menu e os botões cobrem a necessidade.
- Ainda não existe o tipo de aba de monstro (`monstro:<id>`); chega com o Compêndio, sem decidir a visibilidade das estatísticas (pendência D7).

## 6. Pendências de verificação e correção (próximo ciclo de interface, antes de novas funcionalidades de RPG)
Não invalidam o que foi entregue nos PRs #22 e #23 (histórico preservado); relacionam-se às decisões das seções 1 e 5.

**6.1 Elementos que abrem registros não usam os gestos de navegação — pendente de correção (confirmado na análise do código).**
- **Sintoma:** na aba Personagens, o botão direito em "Abrir Ficha: Sabine" abre o menu padrão do Chrome, em vez do menu interno do Compêndio.
- **Causa provável (análise inicial):** `src/Panel.tsx` renderiza botões comuns com apenas `onClick` (em `Panel.tsx`, o `demo-actions`), enquanto Ctrl/Cmd+clique, botão do meio, botão direito e toque prolongado foram implementados só no componente `NavItem` (menu lateral). `CampaignPanels.tsx` ("Abrir" campanha) e outros elementos que chamam `onOpen` têm o mesmo limite.
- **A fazer:** padronizar **todo elemento que abre registro em aba interna** com clique normal, Ctrl/Cmd+clique, botão do meio e botão direito com **Abrir nesta aba / Abrir em nova aba / Abrir em nova aba fixada** (e toque prolongado no celular), **reutilizando** a lógica existente (`NavItem`/`useLongPress`, `navigate`, menu de contexto) e não duplicando comportamento; a decisão da seção 1 ("registros em abas próprias") vale para todos eles.

**6.2 Fixar uma aba já aberta pode estar pouco evidente ou inacessível — pendente de verificação (NÃO é bug comprovado).**
- **Observação:** não foi encontrada uma opção visível para fixar a aba "Personagens" já aberta. O código contém "Fixar aba"/"Desafixar aba" no menu de contexto das abas do desktop (`App.tsx`), coberto por testes automatizados; **falta confirmar o funcionamento na versão publicada**. Pode ser apenas dificuldade de descoberta.
- **A verificar:** (a) botão direito diretamente na aba superior; (b) que "Fixar aba" e "Desafixar aba" funcionam; (c) se for pouco acessível, avaliar um **botão de opções visível na própria aba**; (d) acessibilidade e funcionamento no celular (hoje há o botão "Opções de <aba>" e o toque prolongado na aba).
- **Classificação:** verificação primeiro; só depois, se confirmado, correção.

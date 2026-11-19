# Navegação por abas e divisão de painéis — decisões e proposta técnica

Status: **decisões aprovadas (19/11/2026); proposta técnica aguardando aprovação; NADA implementado.** A implementação só começa depois de o responsável aprovar a proposta, em branch própria a partir da `main`, separada da Etapa 1. Sem mudanças no banco. Complementa `PLANEJAMENTO-V2.md` (§8, etapa 1b) e substitui a regra antiga de `DECISOES-E-ARQUITETURA.md` §5 ("clicar no menu abre a seção na coluna ativa, sem substituir outra aba").

## 1. Decisões aprovadas
**Clique no menu lateral**
1. Seção já aberta em aba compatível → **seleciona essa aba** (sem duplicar).
2. Senão → **reutiliza a aba atual** (a selecionada do grupo ativo), desde que **não fixada**.
3. Aba atual fixada → procura uma aba normal disponível; se não houver, **cria uma aba normal**. Todas fixadas → cria aba normal.
4. **Nunca** substitui o conteúdo de aba fixada automaticamente.
5. A reutilização respeita **contexto de campanha e registro**: nunca confunde campanhas ou registros diferentes de mesmo tipo.
   Exemplo: no Bestiário, clicar em Documentos troca a aba por Documentos; depois Iniciativa troca de novo; com o Bestiário **fixado**, ele permanece.

**Atalhos e menu**
6. Botão direito em item de navegação: **Abrir nesta aba · Abrir em nova aba · Abrir em nova aba fixada**.
7. Ctrl/Cmd + clique e botão do meio: nova aba interna. Links externos mantêm o comportamento normal; aba interna ≠ aba do navegador.
8. Nas abas: **Fixar/Desafixar**, **Fechar**, **Fechar outras abas normais**.
9. Menu perto do ponto de interação, dentro da tela, fecha com clique fora, Esc ou seleção; não interfere em campos editáveis nem em menus nativos fora da navegação.
10. **Fixação é propriedade da aba existente** (sem segunda categoria de abas, sem sistema de janelas). Aba fixada: selecionável, desafixável, fechável à mão, com marca visual discreta; mantém registro e contexto.

**Registros em abas próprias**
11. Lista geral e registros específicos (ex.: lista do Bestiário, Goblin, Balor, campanha Festival da Lua, documento Resumo da Sessão 3) abrem em abas próprias, identificadas por **id estável + tipo + escopo**, nunca por nome. Mesmo registro no mesmo contexto = mesma aba. Clique normal segue a regra de reutilização; "nova aba" preserva a atual. **Sem regra definitiva de visibilidade de estatísticas de monstros para jogadores** (pendência D7 do planejamento continua aberta; ver 5).

**Celular**
12. Toque normal = regra padrão; **toque prolongado** abre o menu; **botão de opções acessível** como alternativa; fixar, desafixar e fechar disponíveis; sem cortes, sem rolagem horizontal da página (só na faixa de abas); verificar 375 px.

**Persistência e segurança**
13. Fixação persistida **por usuário autenticado**, junto ao layout da Etapa 1; só ids, geometria e metadados mínimos (**`pinned`**); nunca títulos, descrições ou conteúdo; limpeza no logout; nada de campanha sem acesso é restaurado; aba sem acesso mostra estado seguro sem revelar o que foi carregado antes.

**Proteção contra perda de trabalho**
14. Antes de **substituir ou fechar** aba com alterações não salvas: confirmar ou preservar rascunho de forma segura; nunca descartar em silêncio. **Fixar não substitui essa proteção.**

**Acessibilidade e desempenho**
15. Teclado, aba ativa e fixadas distinguíveis, rótulos acessíveis, sem depender só de ícones, sem remontagens nem requisições duplicadas, fechar a aba libera recursos.

## 2. Arquitetura atual (análise do código na `main` `8e0067a`)
- **`workspace.ts`** (puro): ids `kind:ref` (`secao`, `conta`, `campanha`, `ficha`, `npc`, `documento`); `openTab` = se já existe, **seleciona**; senão **acrescenta ao grupo ativo** (nunca substitui); `closeTab/Group/Others`, `moveToGroup/NewColumn`, `allowDrop`, `sanitizeLayout`, `isColumnsOnly`.
- **`App.tsx`** (`Workspace`): estado do `Model` do FlexLayout; menu lateral chama `open(spec)`; `ContextMenu` próprio já existe (abas e grupos); `onModelChange` valida colunas e salva; títulos resolvidos por `titleOf` (campanha vem da API); `Mobile.tsx` substitui o FlexLayout abaixo de 700 px.
- **`persistence.ts`**: grava `minimalLayout` (ids, pesos, seleção, grupo ativo); escopo `usuário:campanha:dispositivo`; **hoje descarta grupos vazios ao restaurar** (relevante para a seção 4).
- **FlexLayout 0.11:** tem `Actions.setTabPinned` e atributo `tabEnablePin` (hoje `false` no `global`); o `id` de um nó de aba é fixado na criação.

**Lacunas para a nova navegação:** (a) não há "substituir aba"; (b) não há `pinned` no nosso modelo/persistência; (c) o menu lateral só tem clique simples; (d) não há registro de alterações não salvas; (e) o celular só tem seleção e "x", sem opções.

## 3. Proposta técnica

### 3.1 Modelo e função pura de navegação (`workspace.ts`)
- `pinned` guardado **na própria aba** (preferência: atributo nativo do FlexLayout se o protótipo mostrar que permite fechar/selecionar/desafixar sem efeitos colaterais de ordem; senão `config.pinned`). Decisão final após protótipo de 1 hora, antes de implementar o resto.
- Nova função `navigate(model, spec, mode: "reuse" | "new" | "newPinned", isDirty)` → devolve o resultado (`selected | replaced | created`) e é a **única** porta de entrada de navegação (menu, listas de registros, links internos):
  1. Aba com o mesmo **id** já aberta → seleciona (e foca o grupo). `newPinned` sobre aba existente apenas a fixa. Sem duplicar.
  2. `reuse`: alvo = aba selecionada do **grupo ativo**, se **não fixada** e **sem alterações não salvas**. Substituição = `Actions.group([addTab no mesmo índice + deleteTab])` (atômica; id novo, posição e seleção preservadas).
  3. Sem alvo elegível: aba normal mais recente do grupo ativo (não fixada, não suja); se nenhuma → **cria** aba normal no grupo ativo. Não "pula" para outros grupos.
  4. `new`/`newPinned`: sempre cria (com `pinned` quando pedido), exceto pela regra 1.
  5. Alvo com alterações não salvas **não é substituído**: abre em nova aba (sem diálogo); a confirmação fica para fechar.
- **Escopo e contexto:** o id continua `kind:uuid|slug` (UUIDs não colidem); o **escopo vem da partição do layout** (usuário + campanha ativa), então duas campanhas nunca compartilham abas; registros universais (`monstro:<slug>`) são iguais em qualquer campanha. Tabs de registro de campanha só existem no layout daquela campanha.

### 3.2 Interface
- Hook `useNavTarget(spec)` + componente `NavLink`/item de menu: `onClick` (normal; com `ctrlKey`/`metaKey` → `new`), `onAuxClick` e `onMouseDown` (botão 1 → `new`, com `preventDefault` do autoscroll), `onContextMenu` → `ContextMenu` já existente com as três opções; teclado: Enter = normal, Ctrl+Enter = nova aba, tecla de menu/Shift+F10 = menu (o `contextmenu` nativo já cobre). Não intercepta campos editáveis.
- Menu da aba (existente) ganha **Fixar/Desafixar** e mantém Fechar/Fechar outras (**"outras abas normais"**: não fecha fixadas, nem a atual).
- Indicação da fixada: ícone de alfinete + texto acessível "Fixada" (`aria-label`/`title`), cor discreta do tema; aba ativa continua com a linha azul.
- **Celular** (`Mobile.tsx`): toque prolongado (~500 ms, cancela se mover) abre o mesmo menu (folha inferior); **botão "⋯" por aba** (fixar/desafixar/fechar) e **botão "+ Nova aba"** (lista de seções → nova aba) como alternativas sem toque prolongado; faixa de abas rola sozinha; sem rolagem horizontal da página; teste em 375 px.

### 3.3 Persistência (`persistence.ts`, `workspace.ts`)
- `minimalLayout` passa a gravar `pinned: true` **somente quando verdadeiro** (booleano, nunca texto); `sanitizeLayout` aceita apenas `pinned === true`. Continua sem títulos/descrições. **Versão do envelope permanece 2** (campo opcional; layouts antigos = nada fixado).
- Limpeza no logout e partição por usuário/campanha **inalteradas** (Etapa 1).
- Abas de registro sem acesso (campanha/registro removido): estado seguro genérico (mesma tela de "inexistente"), sem reaproveitar dados carregados antes (o painel remonta ao perder o acesso; caches por `cacheKey`).

### 3.4 Alterações não salvas
- Registro leve `dirty: Map<tabId, boolean>` (contexto React, não persistido) alimentado por `useUnsavedGuard(tabId, dirty)` nos editores (Documentos, ficha etc.; a API existe antes dos editores, que a adotam quando chegarem).
- Pontos de verificação: **fechar aba**, **fechar outras**, **fechar coluna**, logout/troca de conta e `beforeunload`; diálogo **Salvar / Descartar / Cancelar** (ou rascunho local protegido, por editor, conforme a arquitetura de cada um; rascunhos locais ficam sob `cacheKey` e são apagados no logout). **Substituição por clique normal nunca descarta**: abre nova aba.
- Fixar não isenta da confirmação ao fechar.

### 3.5 Desempenho
Substituir = montar o conteúdo novo uma vez (chave por id da aba); fechar desmonta e libera o que o painel registrou; sem refetch ao apenas selecionar; dados de registro por `cacheKey` compartilhado entre abas do mesmo registro (que, de qualquer modo, é uma só aba).

## 4. Bug: não é possível dividir a tela com uma única aba
**Reproduzido e investigado (modelo, sem mudar nada).**
- **Sintoma:** com 1 aba, arrastar para a esquerda/direita mostra o indicador, mas soltar não faz nada.
- **Causa-raiz (confirmada):** não é a regra de 3 colunas, nem exigência de segunda aba pelo FlexLayout. `allowDrop` aprova o encaixe (a aba é o único filho do grupo, então "não cria grupo novo"), o FlexLayout **move a aba para um grupo novo ao lado e o grupo de origem, agora vazio, é apagado automaticamente** (`tabSetEnableDeleteWhenEmpty: true`): resultado final = 1 grupo, igual ao início. Com 2+ abas funciona (verificado: 2 grupos). Há ainda um efeito secundário: **o indicador promete uma operação que o modelo desfaz** (indicador ≠ resultado).
- **Correção proposta (na causa, não no indicador):**
  1. Ao soltar a **única aba de um grupo** na lateral do **próprio grupo**, **manter o grupo de origem** como painel vazio: interceptar em `onAction` (`MOVE_NODE`) e despachar `Actions.group([updateNodeAttributes(grupoOrigem, { enableDeleteWhenEmpty: false }), moveNode(...)])`. Resultado: dois painéis válidos — a aba no lado indicado e um painel **vazio** do outro lado, sem duplicar conteúdo.
  2. **Painel vazio com estado apropriado** (já existe `onTabSetPlaceHolder`: "Escolha uma seção no menu lateral"; acrescentar "ou arraste uma aba para cá"); o painel recebe o clique de menu (grupo ativo) ou abas movidas.
  3. **Persistência de painéis vazios:** hoje `sanitizeLayout` e a restauração descartam grupos vazios quando há mais de um; passar a **preservar grupos vazios** (limite de 3, pesos mantidos) e salvar/restaurar `[aba][vazio]` e `[vazio][aba]`.
  4. **Limite de 3 colunas:** com 3 grupos e uma única aba num deles, dividir criaria o 4º painel (o vazio): `allowDrop` deve **rejeitar** (indicador some). A regra atual `consumesGroup` só vale para mover para **outro** grupo.
  5. **Indicador = operação:** `allowDrop` deixa de aprovar operações que viram no-op (ex.: soltar a única aba no centro do próprio grupo) e aprova a divisão com painel vazio; o contorno do FlexLayout já representa "aba no lado soltado".
  6. Menu de contexto "Abrir em nova coluna à esquerda/direita" (`moveToNewColumn`) usa a mesma regra para aba única.
  7. Sem perda de estado: mover a aba não remonta dados fora do necessário; alterações não salvas continuam protegidas (3.4); o layout é do usuário/campanha (Etapa 1), sem mistura entre contas.
- **Testes previstos (bug):** arrastar a única aba para a esquerda e para a direita (modelo e interface, com `onAction`); painel vazio criado e posteriormente **preenchido** (menu lateral e mover outra aba); layout **válido** (`isColumnsOnly`) após **salvar e restaurar** `[aba][vazio]`/`[vazio][aba]`; limite de 3; 2+ abas continuam funcionando; sem grupos empilhados; troca de conta não revela o layout anterior.

## 5. Interação com a pendência D7 (Bestiário)
A navegação só trata **abrir registros**: `monstro:<id>` e a lista no Compêndio usam as mesmas regras de reutilização/fixação. **Nenhuma regra de visibilidade de estatísticas** é decidida nem implementada aqui; o conteúdo exibido em uma aba de monstro obedecerá, no futuro, ao único ponto de "nível de detalhe" descrito em `PLANEJAMENTO-V2.md` §9 (D7). A navegação não deve carregar nem guardar estatísticas de monstro em título, layout ou prévia.

## 6. Componentes afetados
`workspace.ts` (`navigate`, `pinned`, preservar grupos vazios, `allowDrop`), `persistence.ts` (`minimalLayout`), `App.tsx` (menu lateral com atalhos/menu, `onAction`, placeholder, confirmações), `ContextMenu.tsx` (reuso, posição/limites), `Mobile.tsx` (toque prolongado, ⋯, + Nova aba), `Panel.tsx` (estado seguro sem acesso), novo `unsaved.tsx` (registro de alterações), `style.css` (marca de fixada, painel vazio, folha do celular). **Não** mudam: banco, Supabase, autenticação, limpeza do logout, regra de 3 colunas.

## 7. Testes obrigatórios (da especificação) + os do bug
Clique normal reutiliza aba não fixada · seleciona aba compatível já aberta · fixada não é substituída · todas fixadas → nova aba normal · menu abre na aba atual/nova/nova fixada · fixar e desafixar · Ctrl/Cmd + clique e botão do meio · registros e campanhas diferentes não se confundem · persistência sem títulos privados (só `pinned` + ids) · troca de conta não revela abas · fechar/substituir respeitam alterações não salvas · celular (375 px: toque prolongado, ⋯, + Nova aba, sem rolagem horizontal da página) · **divisão com aba única à esquerda/direita, painel vazio e preenchimento, salvar/restaurar válidos**. Build, TypeScript (`tsc -b --force`) e suíte completa.

## 8. Riscos e limitações previstas
- Semântica nativa de `pinned` do FlexLayout pode impor ordem/limites: decidir por protótipo (3.1).
- Gestos: Ctrl+clique/botão do meio dependem do navegador (ex.: menu nativo do Safari); o menu e os botões cobrem a necessidade.
- Toque prolongado em iOS pode competir com seleção de texto: usar `touch-action`/`user-select` nos itens de navegação e manter a alternativa por botão.
- Confirmação ao fechar só protege editores que adotarem `useUnsavedGuard` (os de Documentos/fichas, quando existirem).
- Painéis vazios persistentes são novidade para o layout salvo: cobertos por testes de restauração.

## 9. Ordem sugerida
1. Protótipo de `pinned` (nativo × `config`) e **correção do bug de divisão** (causa-raiz + persistência de painéis vazios + testes), por ser independente da navegação. 2. `navigate` + menu lateral (clique, Ctrl/Cmd, botão do meio, menu). 3. Fixar/desafixar nas abas + persistência. 4. Alterações não salvas (API + fechar/substituir). 5. Celular. 6. Acessibilidade e revisão final. Cada passo com testes; um PR único ou dois (bug + navegação), conforme sua preferência.

## 10. Estado de implementação (atualizado após o desenvolvimento)
- **PR 1 — `fix/divisao-aba-unica`:** correção da divisão com aba única (seção 4) **implementada**: `classifyDrop`/`allowDrop` (única fonte para indicadores, menu e ação), `prepareMove` (ação atômica que mantém o painel de origem vazio via `enableDeleteWhenEmpty:false`, atributo documentado), `normalizeEmptyPanels` (o painel que recebe aba volta ao padrão: fechar a última aba o remove), painéis vazios preservados ao salvar/restaurar, e o peso padrão (100), omitido pelo FlexLayout, agora é gravado.
- **PR 2 — `feat/navegacao-abas-fixadas`:** navegação **implementada** (`src/navigation.ts`, `NavItem.tsx`, `unsaved.tsx`, `Mobile.tsx`). Decisões tomadas na implementação:
  - **Fixação própria (`config.pinned`)**, não o `pinned` nativo do FlexLayout: o nativo agrupa as fixadas no início da faixa, impede fechá-las pela interface e arrastá-las para fora do painel, o que contraria as decisões aprovadas.
  - **Aba com alterações não salvas é tratada como a fixada na reutilização:** não é substituída; reutiliza-se outra aba normal e limpa do painel ou cria-se uma nova (a confirmação fica para fechar). Isto ajusta o item 5 da seção 3.1 ("abre em nova aba").
  - Aberturas programáticas (criar/entrar em campanha, abrir pelo convite) usam **nova aba**: nunca substituem a aba em uso de surpresa. Trocar de campanha e sair da conta pedem confirmação se há alterações.
  - Ao fundir os dois PRs há conflitos mecânicos em `App.tsx`, `persistence.ts` e `style.css`; a resolução testada (281 testes) está na branch `integracao/pr1-pr2-referencia`.

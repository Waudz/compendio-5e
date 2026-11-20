# Planejamento v2 — estado, arquitetura planejada e roteiro

Status em 19/11/2026, `main` após o PR #24: Etapa 1 (login obrigatório e isolamento local) e a navegação por abas com a divisão de painéis estão **implementadas e publicadas**. Todo o restante abaixo é **planejamento**, distinguido por "Planejado". Migrações `0001`–`0004` aplicadas ao projeto `gwcttjlxzelzjhbuitmi` (não reaplicar); **nenhuma migração nova foi escrita**; a `0005` (conteúdo estruturado das notas) está **proposta no PR #32 e NÃO aplicada**; as audiências de notas passam a ser a `0009` (ver `supabase/migrations/LEIA-ME.md`). O projeto legado `rastreador-dnd` nunca é tocado. Regras gerais: `DECISOES-E-ARQUITETURA.md`.

## 1. Decisões aprovadas
1. **Login obrigatório**, sem visitante. Cadastro segue aberto (restringir a convidados fica para depois). Biblioteca universal: qualquer conta autenticada, somente leitura.
2. **Campanha = ambiente independente** (como contas de CNPJs distintos num login único), com dados, permissões, encontros, documentos, registros e histórico próprios. Menu lateral: Campanhas, Personagens, Iniciativa, Encontros, Enciclopédia, Compêndio, Documentos (mais Conta).
3. **Personagem pertence ao usuário** e participa de campanhas por vínculos com estado próprio.
4. **Um único sistema de anotações** (`notes`), do usuário, com vínculos opcionais que nunca transferem propriedade nem compartilham; a aba Documentos o centraliza.
5. **Encontros** (campanha) → **Iniciativa** (executa) → **loot** confirmado pelo mestre e registrado.
6. Três escopos aplicados por **RLS**: universal, pessoal, campanha.
7. **Navegação por abas** e divisão de painéis conforme `NAVEGACAO-ABAS.md` (implementado).

**D1–D6 (aprovadas):**
- **D1** exclusão **lógica** de personagem (lixeira sem prazo automático); participações arquivadas; histórico da campanha preservado; anotações e documentos intactos; o mestre nunca exclui nem edita o personagem pessoal de outro usuário.
- **D2** saída/remoção de jogador **arquiva** a participação; voltar a restaura sem sobrescrever o estado preservado com a ficha pessoal.
- **D3** nada de transferir nota para campanha alterando `campaign_id`; vínculos opcionais e múltiplos; compartilhar é ação explícita e separada do vínculo; o autor mantém acesso e edição quando sai da campanha ou o personagem morre, é trocado ou excluído.
- **D4** dono e mestre veem a ficha completa na campanha (o mestre edita o estado); outros jogadores veem nome, retrato e nível; o mestre configura se veem os PV dos colegas.
- **D5** `notes` é a base única dos documentos (anotações pessoais, de personagem e documentos do mestre são a mesma entidade).
- **D6** cinco moedas oficiais 5e 2014 (PC, PP, PE, PO, PL); o mestre escolhe as ativas por campanha (**padrão: PC, PP e PO**); personagem pessoal usa as cinco; **carteira zerada ao vincular**; saldos independentes por participação; desativar moeda nunca apaga nem converte sem confirmação.

**Pendências de decisão:**
- **D7 — Visibilidade do Bestiário para jogadores: NÃO DECIDIDA** (a conversar com o grupo). O acesso de qualquer conta autenticada ao Compêndio universal continua previsto; está em aberto o **nível de informação** que jogadores veem de um monstro: (A) ficha completa (PV, CA, atributos, ataques, habilidades, resistências, imunidades), (B) só imagem, nome e descrição, ou (C) configuração por campanha controlada pelo mestre. **Nenhuma restrição é implementada por ora.** Para não fechar portas nem revelar por engano: links automáticos para monstros em Documentos, cartões de prévia, backlinks, busca e participantes de encontros exibidos a jogadores **não embutem estatísticas** enquanto D7 estiver pendente (só o nome); toda exibição de monstro passa por um único ponto de "nível de detalhe" (`full | descriptive`); o catálogo SRD (etapa 5) separa **dados descritivos** de **mecânicos** para que A, B ou C sejam implementáveis por RLS/visões sem refazer o esquema; monstros personalizados têm visibilidade própria e não herdam a do original.
- **Exclusão de conta** vs retenção do histórico de campanha (`campaigns.created_by` é `on delete restrict`): será discutida **antes** de qualquer implementação que dependa dela (personagens e participações).
- Cadastro restrito a convidados: adiado.

## 2. Estado atual (verificado no código e nas migrações)

### Implementado
| Item | Onde |
|---|---|
| Login obrigatório (`AuthGate`), cadastro, confirmação de e-mail, recuperação e troca de senha, sessão persistente, logout; sem visitante | `AuthGate.tsx`, `AuthContext.tsx`, `AccountPanel.tsx`, `auth.ts` |
| Isolamento local: layout só com ids, limpeza no logout/troca de conta, app remontado por usuário, `cacheKey` por usuário e campanha | `persistence.ts`, `localData.ts`, `scope.ts`, `App.tsx` |
| Campanhas: criar, listar, editar, excluir; **mestre único = criador** (não sai, exclui; jogador sai/é removido); limite de 20; convites por link com entrada automática, expiração, limite de usos e revogação; campanha ativa; layout por usuário + campanha + dispositivo | `0001`–`0003`, `CampaignPanels.tsx`, `CampaignsContext.tsx`, `campaigns.ts` |
| Workspace FlexLayout: até 3 colunas, arrastar, dividir (**inclusive com aba única**, com painéis vazios intencionais preservados), redimensionar, menu de contexto | `workspace.ts`, `App.tsx` |
| Navegação por abas: clique reutiliza a aba atual, abas fixadas, nova aba, Ctrl/Cmd+clique, botão do meio, menu de contexto, toque prolongado e controles acessíveis no celular, **proteção de alterações não salvas**, persistência só com ids e `pinned` | `navigation.ts`, `NavItem.tsx`, `unsaved.tsx`, `Mobile.tsx`; `NAVEGACAO-ABAS.md` |
| Notas no **banco**: visibilidade `private/master/campaign/selected`, RLS, selecionados, versão otimista, limites, reversão | `0004`, `supabase/notas.test.ts` |
| Tema azul discreto sobre azul-grafite (botões neutros, destaque nas ações principais); barra de controles do celular que recolhe ao rolar; layout responsivo | `style.css`, `chromeHide.ts` |
| CI (`npm ci`, build, testes) em PR e na `main`; publicação no GitHub Pages a cada merge na `main`; testes de RLS em Postgres em memória | `.github/workflows` |

### Parcial
| Item | O que existe | O que falta |
|---|---|---|
| Notas / Documentos | banco e regras (`0004`); aba Documentos é demonstrativa | modelo D3 (audiências e vínculos, `0008`/`0009`), camada de dados, editor, lista e filtros |
| Isolamento real de dados por campanha | só `campaigns`, `campaign_members`, `campaign_invites`, `notes`, `note_shares` | todo módulo novo precisa de tabelas com `campaign_id`, RLS e testes multi-conta |
| Registros em abas próprias | ids `tipo:ref` e regras de navegação prontos; só `campanha` e as seções têm painel real | painéis de ficha, NPC, documento, monstro; **gestos e menu de contexto nos elementos que abrem registros (1c)** |
| Navegação por abas: fixar aba já aberta | implementado e testado (menu de contexto da aba; menu dos itens de navegação; celular) | **verificar a descoberta/acesso na versão publicada (1c, não confirmado como bug)** |
| Proteção de alterações não salvas | API, diálogo e pontos de verificação testados | editores reais que a adotem |
| Contratos de registros | `records.ts`, `notePermissions.ts` com testes | consumo pelos módulos (links, busca, offline) |
| Validação em produção da autenticação | só com cliente simulado | testes com contas reais (seção 9) |

### Não existe
Biblioteca universal SRD e biblioteca pessoal · personagens, participações, estados · configurações de campanha (moedas, PV dos colegas) · moedas e inventário · encontros, combate, loot · links bidirecionais, busca universal, histórico/desfazer · cache/IndexedDB e sincronização offline · PWA · Compêndio, Iniciativa, Encontros e Enciclopédia (telas demonstrativas).

## 3. Escopos e padrão de migração
- **Universal:** SRD 2014 (`srd_*`), `select` para `authenticated`, sem escrita para clientes; carga por migração. Nunca editado: personalização = cópia pessoal ou de campanha com `source_ref` (cópia independente).
- **Pessoal:** `owner_id = auth.uid()`, sem `campaign_id`; existe sem campanha ativa.
- **Campanha:** `campaign_id` obrigatório; leitura e escrita por participação **atual** (`is_member`/`is_master`), nunca pela "campanha ativa", que é conceito do cliente.
- **Padrão de toda migração:** declarar o escopo na primeira linha; `campaign_id` imutável (gatilho); `version`; chaves compostas `(campaign_id, id)` nas dependentes; limites; funções `SECURITY DEFINER` com `search_path` vazio, sem `anon`, e gatilhos `SECURITY INVOKER`; reversão em `supabase/rollback/`; testes multi-conta em `supabase/*.test.ts`; auditoria estrutural atualizada.

## 4. Personagens, participações e estados (Planejado)
**Modelo:** `characters` (identidade; dono = criador; `base_state jsonb` = ficha pessoal completa com as cinco moedas; `status` active/retired/dead; `deleted_at`; `version`) · `campaign_characters` (participação, **única por `(campaign_id, character_id)`**; `state jsonb` independente com nível, XP, PV, atributos, inventário, recursos e carteira `coins`; `status` active/archived + `archived_reason` unlinked/player_left/player_removed/character_deleted/character_dead/character_retired/replaced; `display_name_snapshot` e `portrait_snapshot`; `version`) · `character_events` (histórico append-only: quem, o quê, antes/depois).

**Regras:**
- Só o dono edita identidade e ficha pessoal e exclui; o mestre nunca altera `characters`/`base_state`.
- **Vincular** copia a parte **não monetária** de `base_state` para `state` (equipamento inicial, atributos base); **a carteira começa zerada** e só muda por ação do mestre/dono dentro da campanha. Depois, cada estado evolui sozinho: sem sincronização contínua e sem conflito entre campanhas.
- **Restaurar** reativa a mesma linha e **não** recopia `base_state`; reiniciar a partir da ficha pessoal é ação separada, confirmada e registrada.
- **Sair/ser removido**: participações da campanha viram `archived`; estado e histórico preservados; o mestre mantém o histórico necessário sem ver nada novo. **Morte, aposentadoria, substituição**: participação arquivada com o motivo; nenhuma anotação é tocada.
- **Exclusão lógica (D1):** some da biblioteca pessoal (lixeira restaurável, sem prazo); participações arquivadas mantendo os snapshots; vínculos de notas continuam (o alvo aparece como "personagem excluído" a quem puder ver).
- O mestre edita o estado da participação **da própria campanha** (`is_master(campaign_id)`), com `character_events` visível ao dono; não vê nem altera participações de outras campanhas.
- **Visibilidade (D4):** dono e mestre veem tudo na campanha; os demais jogadores veem só nome, retrato e nível (PV se `party_hp_visible`), por uma visão/RPC mínima; participações arquivadas só para dono e mestre.
- Concorrência por `version` com atualização condicional e `operationId` (offline futuro); conflito nunca sobrescreve em silêncio.

**Interface (aba Personagens):** com campanha ativa, "Da campanha" (participações) e "Meus personagens" (com "Vincular à campanha"); sem campanha, só pessoais, com criação e administração completas. A ficha `ficha:<characterId>` mostra o estado da campanha ativa quando vinculado, senão a ficha pessoal, **com o contexto sempre rotulado**.

## 5. Documentos e anotações (Planejado; banco em `NOTAS-PERMISSOES.md`)
- **Um só armazenamento e um só editor:** `notes` evolui (tipo, pasta, ordem, blocos) em vez de uma tabela paralela. A ficha mostra só um atalho para "anotações relacionadas", sem cópia. **Exemplo:** o personagem A morre; as notas ligadas a ele permanecem em Documentos, o jogador filtra por personagem e pode **vincular** notas antigas ao personagem B (novas linhas de vínculo, sem copiar nem mover); o que B "sabe" na história é decisão da mesa.
- **Vínculos e audiências (D3):** modelo e análise de compatibilidade com a `0004` em `NOTAS-PERMISSOES.md` §4. Documentos de campanha do mestre são notas do mestre com audiência da campanha.
- **Aba Documentos:** lista única com filtros (escopo, tipo, personagem, vínculo, visibilidade, etiqueta, pasta) e árvore de pastas/páginas/subpáginas; "Novo" abre tipos e templates e cada documento abre na própria aba `documento:<id>`; ferramentas avançadas aparecem só quando existem. **Sem campanha ativa:** só as anotações pessoais, e sem criar ou editar documentos de campanha.
- **Recursos, por fatias:** notas com visibilidade e vínculos → pastas, páginas, templates → editor por blocos → bancos, tabelas e Kanban → calendários e linhas do tempo → quadros infinitos e mapas de relações → anexos e mapas (Storage com políticas espelhando `can_read_note`, sem URL pública) → exportação e backup (cliente, só do que a RLS permite).
- **Histórico:** `note_versions` append-only; a versão herda a regra de leitura **atual**; desfazer = nova versão. **Busca:** RPC/visão `security invoker` com FTS sobre as tabelas protegidas, sem índice duplicado; prévias só de linhas que a RLS devolve.

## 6. Configurações de campanha, moedas, encontros e loot (Planejado)
- **`campaign_settings`** (uma linha por campanha, criada com ela e para as existentes; leitura por participantes, escrita só do mestre): `coin_cp/sp/ep/gp/pp` (**padrão: cobre, prata e ouro ligados; electro e platina desligados**) e `party_hp_visible` (padrão falso). Pertence à campanha, não ao usuário nem ao personagem.
- **Moedas:** equivalências oficiais fixas numa constante compartilhada (1 PP = 10 PC; 1 PE = 5 PP = 50 PC; 1 PO = 2 PE = 10 PP = 100 PC; 1 PL = 10 PO = 1000 PC). A carteira `coins` tem as cinco chaves sempre (inteiros ≥ 0); ativar/desativar só muda a configuração, **nunca um saldo**. A ficha pessoal mostra as cinco; a participação mostra as ativas **mais** qualquer desativada com saldo. Saldos independentes por participação; nada é somado entre pessoal e campanhas.
- **Moeda desativada com saldo:** nunca some (aparece com selo "desativada" e o saldo real; o total informativo em PO a inclui e informa a parcela); o mestre é avisado das participações afetadas (só informação); soluções sempre por ação confirmada, com prévia: reativar; manter como saldo antigo (o servidor recusa **crédito** nela); **converter** pelas equivalências oficiais para as ativas (o resto indivisível permanece); ou descartar, com confirmação digitada. Tudo vira `character_events` e é reversível. **Sem lojas, comércio, economia complexa ou câmbio personalizado.**
- **Encontros** (`campaign_id` obrigatório; padrão visível só ao mestre; revelar partes aos jogadores é ação explícita): `encounters` (nome, status draft/ready/running/finished, dificuldade, cenário, notas via vínculos, resultado), `encounter_participants` (monstro universal por id estável, NPC/monstro personalizado ou participação de PC), `encounter_loot` (itens do catálogo ou personalizados e **moedas só das ativas**; estados planned/found/distributed/discarded; vale também sem combate), `loot_distributions` (auditoria das quantidades efetivamente distribuídas, quem confirmou, quando; chave composta prende o destinatário à mesma campanha).
- **Combate:** `combats`/`combatants`, iniciado a partir de um encontro ou avulso; monstros têm PV no combatente; **PV de PC vive na participação** (fonte única). **Loot:** o mestre marca "encontrado" e atribui; a única via de escrita é a função `distribute_loot` (confere mestre, mesma campanha e moedas ativas, atualiza inventário/carteira com `version`, grava a distribuição e o evento). Nada é distribuído por morte de monstro; jogadores veem só o que receberam.

## 7. Isolamento e permissões
**Já aplicado:** login obrigatório; layout só com ids e limpo no logout/troca de conta; app remontado por usuário; chaves de cache `cacheKey(usuário, campanha, …)`; RLS em campanhas, convites, participantes e notas; "sem acesso" igual a "inexistente" nas abas.
**Vale para todo módulo futuro:** a camada de dados recebe `campaignId` explícito (nunca lê a "campanha ativa" global); caches (TanStack Query, IndexedDB, buscas) usam `cacheKey` e são limpos no logout e na troca de campanha; Realtime por campanha, encerrado na troca, e **sem** `notes`/audiências sem revisão; IndexedDB por usuário, partição por campanha, apagado no logout, revalidando o acesso ao sincronizar (dado já baixado de acesso revogado é limitação aceita e documentada); mestre único, convites e limite de 20 campanhas não mudam.

## 8. Roteiro por prioridade e dependência
**Concluído:** Etapa 1 (login obrigatório e isolamento local) e Etapa 1b (navegação por abas, fixação, divisão de painéis, proteção de alterações), **com duas verificações pendentes de interface (1c)**.

**Próximo, antes de qualquer funcionalidade de RPG — 1c, ciclo de correções de interface** (detalhes e critérios em `NAVEGACAO-ABAS.md` §6): (1) padronizar o menu de contexto e os gestos (clique, Ctrl/Cmd+clique, botão do meio, botão direito com as três opções, toque prolongado) em todos os elementos que abrem registros em abas, como os botões de `Panel.tsx` e de `CampaignPanels.tsx`, reutilizando `NavItem`/`navigate`; (2) verificar na versão publicada se fixar/desafixar a aba já aberta é acessível (item **não confirmado como bug**) e avaliar um botão de opções visível na aba.

| # | Etapa | Depende de | Observação |
|---|---|---|---|
| 2 | **Notas — arquitetura (`0005`: conteúdo estruturado e edição do autor fora da campanha; `0008`/`0009`: vínculos e audiências)**, camada de dados e testes de regressão | `0004` | antes da interface, para construí-la uma vez; risco: mudar a leitura em produção sem reabrir vazamento |
| 3 | **Notas — interface em Documentos** (lista, editor, vínculos, compartilhamento explícito, filtros; adota `useUnsavedGuard`) | 2 | |
| 4 | **`campaign_settings`** (moedas ativas, PV dos colegas) na aba Campanhas | Etapa 1 | pode andar em paralelo com 2–3 |
| 5 | **Biblioteca universal SRD** (Compêndio: monstros; depois magias e itens), separando descritivo de mecânico | Etapa 1 | independente de 2–4; exibir a jogadores só depois de **D7** |
| 6 | **Personagens pessoais** (identidade, ficha-base, cinco moedas, lixeira) | 5; **decidir exclusão de conta** | maior domínio; manter simples |
| 7 | **Participações** (vincular/restaurar/arquivar, edição do mestre, resumo da party, `character_events`, carteira por campanha) | 4, 6 | **maior risco de RLS** |
| 8 | **Links bidirecionais** completos e atalho "anotações da ficha" | 3, 6 | nunca vazar título nem existência |
| 9 | **Encontros e loot planejado** | 5, 7 | |
| 10 | **Iniciativa a partir do encontro** e `distribute_loot` (inventário e moedas) | 7, 9 | atomicidade, auditoria, PV único |
| 11 | **Histórico/desfazer e busca universal** | 3, 7, 8 | FTS sob RLS |
| 12 | **Documentos avançados** (pastas, templates, blocos, bancos/Kanban, calendários, quadros, anexos, exportação), uma ferramenta por vez | 3, 8, 11 | |
| 13 | **Offline/IndexedDB, sincronização com conflitos e PWA** | 7, 11 | só com a escrita online estável |

Fichas e Iniciativa vêm antes dos Documentos avançados. Antes da 6, resolver a exclusão de conta; antes de expor monstros a jogadores (5 e 9), decidir D7.

## 9. Validações e pendências abertas
**Autenticação real em produção (não testada, apenas simulada):** cadastro com e-mail real e confirmação; login e persistência após recarregar; logout e limpeza das chaves `compendio5e:*`; senha errada; recuperação de senha até abrir o app; convite por link em duas contas (aberto deslogado, cadastro, confirmação, volta pelo link, entrada como jogador; expiração, limite de usos, revogação e remoção); troca de conta no mesmo navegador; repetir em celular real. No painel do Supabase (**não alterado por nós**): *Site URL* `https://waudz.github.io/compendio-5e/` e *Redirect URLs* `https://waudz.github.io/compendio-5e/**` (o curinga é necessário por causa de `?convite=`).
**Interface (1c):** itens 1 e 2 acima, registrados em `NAVEGACAO-ABAS.md` §6. **Outras:** navegação móvel definitiva a validar em celular real; teste de arraste e gestos em navegadores reais além do embutido; estratégia de sincronização e de migração segura do legado; funções legadas a reaproveitar ou descartar; como pré-visualizar PRs (hoje só a `main` publica).


---

## 11. Atualização consolidada de decisões e pendências — 20/11/2026

**Esta seção é parte do planejamento principal e prevalece sobre os status antigos das seções 1–10 quando houver conflito.** O texto original acima é preservado como histórico da arquitetura e do roteiro em 19/11/2026. Em particular, a antiga seção “Não existe” e as descrições de “Documentos demonstrativos” não devem ser interpretadas como auditoria do estado de 20/11. Este complemento incorpora integralmente as decisões adicionais registradas em chats e antes reunidas em um documento separado. A lista abaixo distingue implementação comprovada, parcial, pendente e decisão aberta.


> Registro consolidado em 20/11/2026 a partir das conversas e documentação. Status sujeitos a conferência no código e produção.
>

## Legenda
- **[x]** confirmado por PR mesclado / código; não implica teste visual em produção.
- **[~]** parcial, protótipo, teste pendente ou código em PR aberto.
- **[ ]** pendente de implementação.
- **[?]** decisão ainda aberta.
- **[H]** histórico/decisão substituída, mantida para rastreabilidade.

## 0. Situação do repositório e prioridades atuais
- [x] Repositório novo **Waudz/compendio-5e**, React + TypeScript + Vite, GitHub Pages e Supabase; projeto legado `rastreador-dnd` **não deve ser alterado**.
- [x] Login obrigatório no projeto novo; **sem modo visitante em produção** (substitui proposta antiga do aplicativo legado). Modo demonstração só no desenvolvimento.
- [x] Navegação desktop por abas e até três grupos/colunas, fixação, restauração de layout, proteções de alterações não salvas; celular navega por telas, **sem grupos/abas superiores visíveis**.
- [x] Anotações/Planejamento com guias, quadros, colunas, seções e cartões; editor BlockNote; menu de guias e fixação; várias melhorias dos PRs #44–#60.
- [x] PR #62 mesclado: CSS responsivo para guias em painéis estreitos. **Conferência visual ainda pendente**; não assumir que resolveu definitivamente os cortes.
- [x] Abrir múltiplas instâncias de Anotações pelo menu lateral: **PR #64 mesclado à main**, conforme confirmação no GitHub em 20/11/2026; validar funcionamento real e restauração após publicação.
- [~] PR #61 (base de links internos) **fechado sem merge**, adiado; não considerar implementado.
- [ ] Prioridade imediata: concluir múltiplas instâncias/grupos, persistência e sincronização; corrigir responsividade; depois títulos opcionais, lixeira/menus, imagens, referências, links entre notas e encontros.
- [ ] Após cada PR: TypeScript, build, testes, revisão de conflito, teste visual real (desktop dividido 50/50 e 30/70, celular), só então merge. CI verde não garante UX correta.
- [ ] Atualizar os documentos antigos de planejamento, que ainda descrevem telas/recursos como inexistentes; **não apagar decisões históricas**.

## 1. Anotações — roteiro aprovado (prioridade alta)

### 1.1 Abas, guias e grupos
- [~] Cada guia interna (ex.: **Sessão 5**, **NPCs aleatórios**) deve poder ser aberta em **nova aba superior** e **outro grupo**, inclusive lado a lado. Menu contextual na guia interna: **Abrir em nova aba / Abrir em outro grupo**. Não confundir **fixar guia interna** com **fixar aba superior**.
- [~] Abrir Anotações em **nova aba** ou **nova aba fixada** diretamente pelo menu lateral deve criar uma instância distinta, não apenas focar a seção existente (#64).
- [ ] Cada painel guarda guia ativa, posição de rolagem e estado de edição independentes; mesmo registro mantém identidade única; alterações entre instâncias sincronizam sem sobrescrever silenciosamente. Testar concorrência, perda de acesso, troca de campanha e restauração.
- [ ] Painel largo: guias visíveis; médio: priorizar fixadas e ativa **se houver espaço**; estreito: **guia ativa sempre visível**, demais no menu **•••**, com pesquisa e indicador de fixação. Evitar guias cortadas e barras de rolagem horizontais duplicadas. O menu ••• deve continuar acessível no celular.
- [ ] Conferir funcionamento com muitas fixadas, títulos longos, painel de 220–440 px, 50/50, 30/70 e múltiplos grupos; o botão **+** deve permanecer acessível.
- [ ] Menu contextual abre perto da guia clicada; fechar `×` só a guia ativa; renomear por duplo clique/Enter/Esc; numeração de **Nova guia N** sem novas duplicações. Recursos existentes: manter e testar regressões.

### 1.2 Cartões e seções
- [ ] **Título opcional nos cartões**: permitir cartão apenas com texto, imagem ou referência; não impor “Novo cartão” como título definitivo; placeholder discreto e ação para adicionar título.
- [ ] **Seções**: título exibido por padrão, mas permitir ocultar/deixar sem título; identificador acessível em busca/menus quando não houver título visível. Confirmar a interação exata antes de implementá-la.
- [ ] Lixeira/excluir discreto: **hover no desktop**, menu **••• no celular**; padronizar menus, alça de arrastar, foco/teclado e confirmações destrutivas conforme conteúdo.
- [ ] Preservar criação rápida de cartão, cartões vazios, colunas/seções, arraste, ordem e o editor inline; não criar formulários obrigatórios para notas comuns.
- [ ] Corrigir eventuais nomes duplicados já existentes separadamente, sem renomear dados do usuário automaticamente.

### 1.3 Imagens
- [ ] Inserir **imagens no corpo** dos cartões, entre parágrafos, não somente capa: upload, visualização, zoom, substituição e remoção; suporte a celular e estados de erro.
- [ ] Habilitar mídia com segurança no BlockNote/visualizador; hoje há restrições de mídia no editor e formato salvo. Planejar Supabase Storage **privado**, RLS espelhando permissão de leitura, limites, compressão, referências estáveis, limpeza de órfãos e sem URL pública.
- [ ] Garantir que imagem não degrade a carga de quadros grandes; lazy loading e miniaturas quando apropriado.

### 1.4 Referências e links — decisão mais recente
- [ ] **Manter `/` nativo do BlockNote exatamente como está**; **não adicionar novos comandos personalizados ao slash menu nesta etapa**. Ideia antiga de `/monstro`, `/imagem` etc. foi substituída.
- [ ] Digitar **`@`** abre busca contextual de **monstros, itens, magias, personagens/NPCs e outras anotações**; `@dragão` filtra e permite selecionar a ficha correta.
- [ ] Selecionar texto → ação **Vincular** na barra contextual → buscar referência, **preservando as palavras selecionadas**. Editar/remover vínculo depois.
- [ ] Links internos por **tipo + ID estável**, não por título/URL improvisada; renomear não quebra. Prévia no painel/modal sem perder o texto; opção de abrir ficha completa em nova aba/grupo. Visualizador leve dos cartões também precisa renderizar links.
- [ ] Links entre **cartões, seções e guias**; respeitar RLS dos dois lados, sem vazar existência/título em busca, prévia, backlink ou histórico. Links externos continuam possíveis, mas não são a identidade do registro.
- [ ] Não implementar `*dragão` como atalho: `*` é reservado à formatação; `@` foi escolhido.

### 1.5 Encontros nas Anotações
- [ ] Inserir **encontro como recurso/bloco dentro do cartão comum**, sem exigir tipo rígido de cartão. Nome, descrição, participantes, monstros/quantidades do bestiário, NPCs/PCs quando cabível.
- [ ] **Iniciar combate** transfere participantes à Iniciativa existente; encontro salvo é reutilizável e não cria segundo motor de combate. Definir snapshot congelado da composição no início do combate para não alterar encontros preparados.
- [ ] Permissões de mestre/jogador e segredo de monstros conforme decisão D7 (ainda aberta).

## 2. Navegação e experiência de uso
- [x] Navegação mestre definida: **Início · Anotações · Iniciativa · Compêndio · Menu**.
- [x] Navegação jogador definida: **Início · Anotações · Ficha · Compêndio · Menu**; **Inventário dentro da Ficha**, não como item principal.
- [~] Implementação de cada tela/rota e comportamento real dessas barras: verificar no aplicativo; decisão de menu não prova funcionalidade.
- [ ] Gestos entre subáreas: arrastar horizontalmente dentro de um módulo pode navegar para submenu relacionado (ex.: Ficha → Inventário), **sem interferir com rolagem, editor, arraste de cartão ou gestos do sistema**.
- [~] Inspirar-se no Letterboxd: menus superior/inferior do celular ocultam ao rolar para baixo e retornam ao subir; skeleton durante carregamento; evitar flicker e exibição temporária de página errada. Há implementação parcial; validar todas as telas.
- [ ] Padronizar navegação de registros por clique, Ctrl/Cmd+clique, botão do meio, clique direito, toque prolongado, menu **Abrir nesta aba / em nova aba / fixada**; não apenas menu lateral (ver NAVEGACAO-ABAS §6).
- [ ] Conferir descoberta de **Fixar/Desafixar aba já aberta**, acesso por teclado e celular; não assumir bug antes de reproduzir.
- [ ] Manter layout sem sobreposição em meia tela, menus compactos, títulos truncados somente quando inevitável, skeleton com retry e boa performance em rede lenta.
- [ ] Ajustes visuais pendentes do legado, **reavaliar pertinência no projeto novo**: ícones de tamanho consistente, cabeçalho móvel fixo, botões do topo em uma linha quando couber, reduzir convite excessivamente alto, padronizar fundos/molduras/pop-ups, foto de perfil e avatar na lista de jogadores.

## 3. Campanhas, identidade, contas e segurança
- [x] Projeto novo: autenticação Supabase, e-mail, recuperação/troca de senha, sessão persistente, mestre único (criador), convites e isolamento por campanha; verificar em contas reais.
- [ ] Auditoria de RLS em todas as tabelas, inclusive **impedir que o dono altere campos exclusivos do mestre dentro de JSON**; testes adversariais com múltiplas contas e privilégios.
- [ ] Testar confirmação, recuperação, troca de senha, persistência, logout, perda de internet, reentrada, convites revogados/expirados, Android/PWA real e acesso após remoção da campanha.
- [ ] Revisar política de exclusão de conta versus retenção de histórico de campanha (**decisão aberta antes de implementar exclusão**).
- [ ] Cadastro somente por convite: **adiado**, não impor agora. Login obrigatório é decisão vigente; visitante do sistema antigo **não migrar automaticamente**.
- [ ] Campanha com regras **2014 OU 2024**, sem misturar; **implementar inicialmente só 2014**. Conversão futura com preservação de dados e confirmação; não habilitar 2024 parcialmente.
- [ ] Campanhas: seletor persistente/discreto, ações compactas, entrar com código via **+**, compartilhar/gerenciar via **•••**, sem ocupar muito espaço; confirmar quais partes já estão entregues.
- [ ] Segurança de uploads, Storage privado, limites, sanitização de conteúdo, RLS e não confiar no papel informado pelo cliente; migrações com rollback e testes; **nunca aplicar migração no Supabase real sem autorização explícita**.
- [ ] Revisar controle de permissões de anotações pessoais, do mestre e compartilhadas; links não concedem leitura; autor continua dono após sair de campanha.
- [?] **D7**: quanto da ficha de monstro jogadores podem ver — completa, só descritiva ou configurável por campanha. Até decidir, **não expor estatísticas por links/prévias**.
- [?] Exclusão de conta e histórico; comportamento de registros rápidos (editável vs append-only), prioridade de atalhos móveis e outras escolhas descritas em PLANEJAMENTO-V2/NOTAS-PERMISSOES.

## 4. Personagens, ficha, inventário e regras
- [ ] Biblioteca pessoal de personagens com criação/edição/exclusão lógica, restauração e vínculos a campanhas; personagem pertence ao usuário; mestre só edita **estado da participação**, nunca ficha pessoal alheia.
- [ ] Estado independente por campanha; ao vincular, copiar atributos/equipamentos não monetários e **zerar carteira da participação**; saída/remoção arquiva, reentrada restaura sem sobrescrever; morte/aposentadoria preservam histórico.
- [ ] Visibilidade: dono e mestre veem ficha completa; demais jogadores nome, retrato, nível e PV somente se permitido por campanha.
- [ ] Inventário **dentro da Ficha**; equipamentos iniciais por classe (não kit universal); agrupamento de itens idênticos somente quando propriedades/equipado coincidirem; edição de classes/equipamentos existentes sem bloqueio circular.
- [ ] Cinco moedas 2014 (PC, PP, PE, PO, PL); campanha ativa **PC/PP/PO por padrão**, outras configuráveis; saldos nunca somem ao desativar moeda; conversão somente confirmada, auditada e reversível.
- [ ] Catálogos e motor de regras 2014: classes, subclasses, raças, antecedentes, talentos, multiclasse, atributos, perícias com atributo visível, progressão, conjuração, equipamentos, condições, descansos e regras gerais.
- [ ] Fichas com retratos padronizados, botões coerentes, efeitos e alterações de PV rápidos e animados em todas as visualizações pertinentes.
- [ ] Revisar suporte a concessões especiais de personagem (ex.: Lydia), grimórios privados e inventários de NPCs, monstros e baús; funcionalidades do legado são **referência**, não confirmação de implementação no novo projeto.
- [ ] Escolher manualmente ícones de classes/escolas de magia no **game-icons.net**; não aplicar automaticamente versões redesenhadas/recoloridas; manter paleta e tamanhos consistentes.

## 5. Compêndio, Enciclopédia e bestiário
- [ ] Biblioteca universal **SRD 5e 2014**, somente leitura para contas autenticadas; separar dados descritivos/mecânicos e conteúdo pessoal/campanha; cópia independente para personalizações.
- [ ] Bestiário, magias, itens, regras, personagens/NPCs, locais, facções, eventos e referências cruzadas com busca segura; suportar **lista e grade** como preferência de visualização, reaproveitando padrões do app antigo quando fizer sentido.
- [ ] Padronizar layout das magias fora das fichas, sidebar do bestiário, pesquisa e comportamento em telas estreitas; testar imagens e ausência de dados de contas novas.
- [ ] Garantir que nomes em inglês/português e referências SRD sejam identificáveis sem cadastrar conteúdo protegido indevidamente; conteúdo personalizado não herda visibilidade do universal.
- [ ] Preparar referências entre Enciclopédia, bestiário, Anotações e Iniciativa; links estáveis, backlinks filtrados por RLS.

## 6. Encontros, Iniciativa e loot
- [ ] Encontros preparados, participantes com quantidades, dificuldade, cenário e notas vinculadas; mestre decide o que revelar.
- [ ] Iniciativa avulsa e iniciada de encontro, sem duplicar motor; PV de PC na participação, PV de monstro no combatente; atualizações rápidas, animações consistentes e sincronização em tempo real segura.
- [ ] Monstros ocultos e informações secretas para jogadores; efeitos/condições avançados, ordem, descansos e recursos conforme regras.
- [ ] Loot planejado/encontrado/distribuído; distribuição confirmada pelo mestre, transação atômica e auditada, sem entregar automaticamente por morte de monstro; itens e moedas apenas segundo regras da campanha.
- [ ] Investigar necessidades do legado: exportar/importar combate, usar personagem em combate sem abrir app móvel no desktop, inputs de d20 sem cortes, tamanhos de cartões e ícones padronizados.

## 7. Dados, notas, offline e PWA
- [~] Migrações `0001`–`0004` documentadas como aplicadas; **0005 e posteriores exigem conferência do estado real** antes de qualquer ação. Documentos de 19/11 podem estar desatualizados.
- [ ] Evoluir `notes` como armazenamento único, com conteúdo BlockNote estruturado, vínculos opcionais múltiplos e compartilhamento **explícito** (vínculo não transfere propriedade/acesso); compatibilizar `0005`, `0008` e `0009` sem vazamento.
- [ ] Histórico de versões append-only, desfazer, lixeira, recuperação, busca sob RLS, filtros/pastas/templates e exportação; evitar conteúdo perdido silenciosamente e resolver conflitos por versão.
- [ ] Definir ciclo de exclusão de páginas com cartões, registros rápidos e snapshots de encontros; não apagar automaticamente registros relacionados.
- [ ] Offline com IndexedDB por usuário/campanha, fila idempotente, conflitos explícitos, revalidação de acesso e limpeza de cache no logout; não prometer Realtime de notas sem auditoria.
- [ ] PWA instalável, sessão resiliente sem rede, splash/ícone minimalista dourado livro+chapéu, fundo transparente; nome completo **Compêndio 5e** e `short_name` **Compêndio** (decisão anterior, conferir implementação).
- [ ] Notificações futuras com app fechado e sino interno: definir escopo, opt-in, permissões, push/background, privacidade e custo antes de construir.
- [ ] Evitar cobrança: produto gratuito; avaliar custo de IA e infraestrutura antes de serviços pagos.

## 8. Documentos avançados — horizonte posterior
- [ ] Pastas, subpáginas, templates de RPG, editor em blocos, tabelas/Kanban, calendários, linhas do tempo, quadros/mapas de relações, anexos e exportação.
- [ ] Priorizar primeiro navegação, fichas, bestiário, iniciativa e Anotações funcionais; avançados entram gradualmente, sem recriar o editor ou banco paralelos.
- [ ] Busca universal, prévias e backlinks só com autorização efetiva; histórico não pode revelar conteúdo removido/revogado.

## 9. Decisões rejeitadas ou substituídas (não reabrir por acidente)
- [H] `/` customizado para links/imagens/encontros: **não**; manter slash do BlockNote; `@` e seleção de texto para vincular.
- [H] `*dragão` para buscar vínculo: **não**; usar `@`.
- [H] Cartões rigidamente tipados: **não**; cartão comum recebe texto/imagem/links; encontro é recurso especial.
- [H] Guias fixadas obrigatoriamente sempre visíveis em qualquer largura: **não**; ativa tem prioridade e ••• acessa demais.
- [H] Abrir outra aba de Anotações duplicando o quadro: **não**; instâncias independentes apontam ao mesmo registro.
- [H] Mover nota para campanha mudando `campaign_id` ou transferindo propriedade: **não**; vínculos/audiências separados.
- [H] Excluir personagem apagando histórico/notas: **não**; exclusão lógica, participações arquivadas.
- [H] Misturar regras 2014 e 2024: **não**; campanhas separadas, implementação 2014 primeiro.
- [H] Criar segundo motor de combate para encontros: **não**; integrar à Iniciativa.
- [H] Visitante sem login no projeto novo: **não**; somente demo em desenvolvimento.
- [H] Usar diretamente Supabase/repositório do aplicativo legado: **não**; preservar projeto antigo.

## 10. Checklist antes de declarar qualquer item concluído
1. Verificar se o código está **na main**, não apenas em branch ou PR; identificar commit.
2. Conferir build/TypeScript/testes e migrações/rollback quando aplicável.
3. Testar visualmente desktop, painéis estreitos, celular e interações de teclado/toque.
4. Testar conta mestre e jogador, campanhas distintas, acesso negado, exclusão e concorrência.
5. Atualizar este documento com **PR, data, resultado e limitações**, mantendo histórico.
6. Não confundir planejamento, demo local, PR aberto e produção publicada.

### Histórico de referência
- **19/11:** arquitetura, regras de campanhas, anotações, notas, segurança e navegação consolidadas nos documentos antigos; algumas seções estão defasadas.
- **20/11:** Anotações ganharam guias/quadros/cartões e navegação por abas (PRs #44–#60); #62 e #64 mesclados; #61 fechado por adiamento; #63 substituído pelo #64. Testes visuais e sincronização ainda pendentes.
- Decisões recuperadas de chats anteriores incluídas neste documento, **sem alegar que todos os itens foram auditados no código**.

## 12. Ponto de parada das Anotações e próxima frente — 20/11/2026

**Decisão:** pausar novas funcionalidades de Anotações e iniciar a construção funcional do **Compêndio 5e**. Não considerar as pendências abaixo canceladas; retomá-las após a base do Compêndio. Este registro complementa o histórico e não altera os contratos de segurança ou de dados.

### O que já foi integrado
- PR #71: seções mantêm título visível, com apenas o controle de tamanho de fonte; cartões podem ter título visual opcional.
- PR #72: no celular, ações da seção reunidas no menu de três pontos; ambos PRs confirmados mesclados na `main` em 20/11/2026.
- Abas, guias, seções e cartões são a base atual; ainda exigem testes reais em dispositivos e com diferentes contas antes de declarar a experiência concluída.

### Pendências preservadas para retomar nas Anotações
1. **Imagens dentro de cartões:** editor atual exclui blocos de imagem/vídeo/áudio/arquivo; projetar upload seguro, armazenamento, permissões, limites, prévias e remoção de arquivos órfãos antes de habilitar. Não aceitar URLs/arquivos sem validação.
2. **Vínculos internos:** cartões, seções, guias e documentos; identificadores estáveis, abrir destino na aba adequada, resolver destinos excluídos ou sem permissão, sem duplicar dados.
3. **Busca nas Anotações:** pesquisar guias, seções e conteúdo dos cartões, respeitando escopo, permissões e desempenho.
4. **Vínculos com o Compêndio:** digitar `@` para buscar monstro/item/magia/personagem/anotação e inserir referência; selecionar texto existente e escolher **Vincular**. **Preservar o menu `/` nativo do BlockNote**. Depende de catálogo e páginas de detalhes funcionais.
5. **Encontros dentro de cartões:** integrar ao módulo Encontros e ao motor único de Iniciativa, sem inventar segundo sistema de combate.
6. **Futuro:** histórico/desfazer, backlinks, pastas, etiquetas e outras formas de organização; priorizar depois de validar os fluxos essenciais.

### Próxima prioridade: Compêndio
1. Criar **página real do Compêndio**, substituindo o painel demonstrativo; garantir navegação por abas e layouts desktop/celular.
2. Implementar **busca, filtros e alternância lista/grade**, preservando as preferências de apresentação do projeto anterior sem reutilizar seu banco.
3. Incluir **catálogos SRD 5e 2014** (monstros, magias e itens) com proveniência/licença verificadas, esquema coerente e separação de dados descritivos e mecânicos.
4. Criar **detalhes navegáveis** por identificadores estáveis, para que as Anotações possam referenciá-los depois.
5. Em seguida, priorizar **Personagens/Ficha/Inventário**, **Encontros/Iniciativa** e integração cruzada; ajustar sequência conforme dependências e testes.

**Cuidado:** o item Compêndio aparece no menu, mas `src/Panel.tsx` ainda exibe um placeholder; não confundir a navegação pronta com o módulo implementado. Nenhuma migração Supabase sem aprovação explícita. O arquivo possui trechos históricos anteriores a estes PRs; esta seção prevalece como registro das decisões mais recentes, sem afirmar auditoria completa dos módulos antigos.

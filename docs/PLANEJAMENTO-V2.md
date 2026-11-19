# Planejamento v2 — estado, arquitetura planejada e roteiro

Status em 19/11/2026, `main` após o PR #24: Etapa 1 (login obrigatório e isolamento local) e a navegação por abas com a divisão de painéis estão **implementadas e publicadas**. Todo o restante abaixo é **planejamento**, distinguido por "Planejado". Migrações `0001`–`0004` aplicadas ao projeto `gwcttjlxzelzjhbuitmi` (não reaplicar); **nenhuma migração nova foi escrita**; a `0005` só será escrita com autorização. O projeto legado `rastreador-dnd` nunca é tocado. Regras gerais: `DECISOES-E-ARQUITETURA.md`.

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
| Notas / Documentos | banco e regras (`0004`); aba Documentos é demonstrativa | modelo D3 (audiências e vínculos, `0005`), camada de dados, editor, lista e filtros |
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
| 2 | **Notas — arquitetura (`0005`: audiências, vínculos, edição do autor fora da campanha)**, camada de dados e testes de regressão | `0004` | antes da interface, para construí-la uma vez; risco: mudar a leitura em produção sem reabrir vazamento |
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

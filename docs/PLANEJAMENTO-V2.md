# Planejamento v2 — campanhas isoladas, personagens pessoais, documentos, encontros e loot

Status: **planejamento aprovado em princípio, nada implementado além do que a seção 1 lista**. Substitui, sem apagar, as decisões anteriores que conflitem; o que não é citado aqui continua valendo (`DECISOES-E-ARQUITETURA.md`, `NOTAS-PERMISSOES.md`, `FUNDACAO-REGISTROS.md`).
Data da revisão: 19/11/2026, sobre a `main` em `2b2d362` (CI e Pages verdes). Migrações `0001`–`0004` já aplicadas ao projeto `gwcttjlxzelzjhbuitmi`. O projeto legado `rastreador-dnd` nunca é tocado.

## 0. Decisões novas (resumo)
1. **Login obrigatório.** Sem experiência de visitante. Cadastro continua aberto (restrição a convidados fica para depois). Biblioteca universal: qualquer conta autenticada, somente leitura.
2. **Campanha = ambiente independente** (como contas de CNPJs distintos num mesmo login). Menu lateral inalterado: Campanhas, Personagens, Iniciativa, Encontros, Enciclopédia, Compêndio, Documentos.
3. **Personagem pertence ao usuário**; participa de campanhas por vínculos com estado próprio.
4. **Um único sistema de anotações** (o de `0004_notas.sql`), do usuário, com vínculos opcionais, centralizado em Documentos.
5. **Documentos** reúne anotações, páginas, quadros, bancos, calendários, anexos e backup, sem novas abas principais.
6. **Encontros** (campanha) → **Iniciativa** (executa) → **loot** confirmado pelo mestre e registrado, nunca automático.
7. Três escopos de dado, aplicados por **RLS**: universal, pessoal, campanha.

## 1. Estado atual (verificado no código e no banco versionado)

| Decisão | Estado | Evidência / lacuna |
|---|---|---|
| Mestre único = criador; sai? não; exclui? sim; jogador sai/é removido; 20 campanhas | **Implementado** (SQL + UI + testes) | `0001`, `0003`, `rls.test.ts` |
| Convites por link, entrada automática | **Implementado** | `CampaignPanels.tsx`, `join_campaign` |
| Autenticação, recuperação, sessão persistente | **Implementado** | `auth.ts`, `AuthContext.tsx` |
| Login obrigatório | **Não** — o app ainda tem modo visitante (`AuthStatus: guest`, escopo `visitante`, avisos em `AccountPanel`) | contradiz a decisão 1 |
| Uma campanha ativa por vez | **Implementado no cliente** (`CampaignsContext`, `compendio5e:active-campaign:<usuário>`) | o servidor não tem noção de "ativa", e não deve ter |
| Isolamento do **layout** por usuário+campanha+dispositivo | **Implementado** (`persistence.ts`, `App.tsx`) | é só apresentação |
| Isolamento real de **dados** por campanha | **Parcial**: existe só para `campaigns`, `campaign_members`, `campaign_invites`, `notes`, `note_shares` (RLS + testes) | **nenhum outro módulo tem tabela**: Personagens, Iniciativa, Encontros, Enciclopédia, Compêndio e Documentos são *placeholders* |
| Notas com permissões (`private/master/campaign/selected`) | **Implementado só no banco** (`0004`, 32 testes) | sem cliente de dados nem interface; sem vínculos a registros; `campaign_id` imutável (ver 4.3) |
| Biblioteca universal (bestiário SRD) | **Não existe** (nem tabelas nem dados) | só contratos em `records.ts` |
| Biblioteca pessoal | **Não existe** | |
| Personagens (qualquer forma) | **Não existe** | |
| Links bidirecionais, busca, histórico, offline | **Só contratos/planejamento** (`records.ts`: `RecordLink`, `decideVersion`, `PendingOperation`) | sem tabelas, sem IndexedDB |
| Cache/IndexedDB | **Não existe** | hoje só `localStorage` (layout e campanha ativa) |
| PWA | **Não existe** | |

Riscos de isolamento já identificados no cliente (a tratar antes dos módulos de dados):
- O layout salvo guarda **títulos de abas** (nomes de campanhas, futuramente de notas/fichas) em `localStorage`; fica no aparelho após logout. Guardar só o id e resolver o título pela API (ou limpar o layout do usuário no logout).
- Abas persistidas referenciam registros que podem deixar de ser acessíveis (removido da campanha, nota descompartilhada): todo painel deve tratar "não encontrado / sem acesso" com a mesma tela, sem distinguir os casos.
- Ainda não há regra para **caches**: ver 7.3.

## 2. Modelo de escopos
- **Universal**: bestiário/magias/itens SRD 2014. Tabelas `srd_*` com `select` para `authenticated`, nenhum `insert/update/delete` para clientes; carga por migração/seed. Nunca editado: personalização = cópia pessoal ou de campanha com `source_ref` (cópia independente, como já decidido).
- **Pessoal**: `owner_id = auth.uid()`; `campaign_id` ausente. Existe sem campanha ativa.
- **Campanha**: `campaign_id` obrigatório; leitura/escrita por participação **atual** (`is_member`/`is_master`), nunca por "campanha ativa" (conceito só do cliente).

Regra de ouro para toda tabela nova: declarar o escopo na primeira linha da migração, e testá-lo com contas de papéis diferentes (modelo de `notas.test.ts`).

## 3. Personagens pessoais reutilizáveis (arquitetura recomendada)

**Separar identidade, estado-base e participação:**
- `characters` — **identidade** (dono = criador): nome, retrato, conceito, raça/antecedente, descrição; `base_state jsonb` = ficha pessoal completa (nível, atributos, PV, XP, inventário…) usada **sem campanha** e como ponto de partida ao vincular; `version`, `deleted_at`.
- `campaign_characters` — **participação**: `(campaign_id, character_id)` único; `state jsonb` independente (nível, XP, PV, atributos, inventário, recursos, notas de estado); `status` (`active|archived`); `version`; `linked_at`.
- `character_events` — histórico append-only (quem alterou, o quê, antes/depois), base de desfazer e de auditoria do mestre.

**Regras (todas em RLS/gatilhos):**
- Dono cria/edita `characters` e `base_state`; **só o dono** edita identidade e exclui o personagem. Mestre nunca altera `characters` nem `base_state`.
- Dono vincula a campanhas das quais participa (a participação **copia** `base_state` → `state` no vínculo; depois cada estado evolui sozinho. Sem sincronização contínua = sem conflitos entre campanhas).
- Mestre edita `campaign_characters.state` **somente** da própria campanha (UPDATE com `is_master(campaign_id)`); não vê nem toca participações em outras campanhas (a RLS filtra por `campaign_id`). Alterações do mestre geram `character_events` visíveis ao dono.
- Desvincular ou sair/ser removido da campanha → participação `archived` (estado preservado; revinculação restaura). O personagem pessoal permanece intacto.
- Chaves compostas `(campaign_id, id)` nas tabelas dependentes (loot, combate) impedem referenciar participação de outra campanha.
- Leitura: dono e mestre da campanha veem a participação; demais jogadores só veem o que a campanha permitir (padrão: resumo — nome, retrato, nível, PV opcional — decisão D4).
- Controle otimista por `version` (`decideVersion`) e `operationId` para offline futuro.

**Interface (aba Personagens):** com campanha ativa → "Da campanha" (participações) + "Meus personagens" (pessoais, com ação "Vincular à campanha"); sem campanha ativa → apenas pessoais, com criação e edição completas. Aba da ficha: `ficha:<characterId>` abre o estado da campanha ativa se vinculado, senão o estado-base (rótulo explícito do contexto na ficha).

**Alternativas descartadas:** ficha única compartilhada (progressão e estado se misturariam entre campanhas); cópia completa por campanha (a identidade divergiria sem controle e duplicaria dados).

## 4. Documentos e anotações sem duplicação

### 4.1 Um só armazenamento
`notes` (0004) **é** o sistema de anotações e passa a ser a base de todos os "documentos": evoluir a tabela (ex.: `kind`, `parent_id`, `sort_order`, conteúdo em blocos) em vez de criar `documents` paralela. Reaproveita sem refazer: `owner_id`, `campaign_id`, `visibility`, `note_shares`, `note_readable/can_read_note`, `version`, limites. Anotação de jogador, de personagem e documento do mestre são a mesma coisa com vínculos e visibilidades distintos. Ficha de personagem não tem editor próprio de notas: usa o mesmo editor/lista filtrado por vínculo.

### 4.2 Vínculos (Etapa C já planejada)
- `record_links(source note, target kind+id, owner_id, campaign_id?)`: alvo = personagem, NPC, local, encontro, monstro universal, outra nota…
- Linha de vínculo só é legível se a **origem** for legível (`can_read_note(source)`); título e existência do alvo vêm sempre da RLS do próprio alvo. Backlinks = vínculos cuja origem o leitor pode ler **e** cujo alvo ele pode ler.
- Atalho na ficha: consulta "notas vinculadas a este personagem" filtrada pela RLS; sem cópia.

### 4.3 Ajuste de permissão a decidir (D3)
`notes.campaign_id` hoje é imutável. Para "anotação pessoal que depois ganha campanha", permitir **uma única** transição `NULL → campanha da qual o autor participa agora` (nunca troca nem volta a `NULL`), mantendo a nota `private` até o autor compartilhar. Exige a `0005` (gatilho + política); nada mais muda.

### 4.4 Organização da aba Documentos (para não ficar complexa)
- Uma lista única com **filtros**: escopo (Pessoais | Campanha ativa), tipo, vínculo, visibilidade, etiqueta, pasta; busca (4.6). Árvore de pastas/páginas/subpáginas.
- "Novo" abre um menu de **tipos e templates**; cada documento abre em sua própria aba `documento:<id>` com o editor do tipo. Ferramentas avançadas aparecem só quando existem (liberação por etapa), nunca como novas abas principais.
- **Sem campanha ativa**: lista só as pessoais (`campaign_id` nulo); não cria nem edita documentos de campanha; a aba Documentos não consulta campanhas.
- Etapas de recursos: (1) notas + visibilidade + vínculos; (2) pastas/páginas/subpáginas e templates; (3) editor por blocos; (4) bancos/tabelas/Kanban; (5) calendários e linhas do tempo; (6) quadros infinitos e mapas de relações (consomem `record_links`); (7) anexos e mapas (Storage); (8) exportação/backup.
- **Anexos:** Supabase Storage com políticas em `storage.objects` espelhando `can_read_note` (caminho `owner/note_id/arquivo`); limites de tipo e tamanho; nunca URL pública.
- **Exportação/backup:** feito pelo cliente com o que a RLS permite ler (nada de função privilegiada); backup da campanha, só do mestre e só do que ele pode ler.

### 4.5 Histórico e desfazer
`note_versions` append-only: legível se `can_read_note(note_id)` **e** o leitor for o autor para versões de nota privada (histórico nunca revela conteúdo que a nota atual não revelaria). Retenção limitada. Desfazer = restaurar versão como nova versão (nunca reescreve passado). Mesmo padrão para `character_events` e eventos de encontro.

### 4.6 Busca universal
Sem tabela de índice duplicada. Busca por RPC/visão **`security invoker`** sobre as tabelas protegidas (FTS `tsvector` em colunas geradas), unindo universal + pessoal + campanha ativa. Prévia só vem de linhas que a RLS já devolveu. Índice offline local (futuro) é por usuário e por campanha.

## 5. Encontros, Iniciativa e loot

Tabelas (todas com `campaign_id not null`, RLS de campanha, `campaign_id` imutável, chaves compostas):
- `encounters`: nome, status (`draft|ready|running|finished`), dificuldade, cenário, notas/referências (links), resultado/histórico. **Padrão: só o mestre vê**; revelar partes aos jogadores é ação explícita.
- `encounter_participants`: referência a monstro universal, NPC/monstro personalizado, ou participação de PC; quantidade; observações. (Monstro SRD referenciado por id estável, não copiado.)
- `encounter_loot`: item universal/personalizado ou moedas, quantidade, `state` (`planned|found|distributed|discarded`). Vinculado ao encontro; existe também em encontros **sem combate**.
- `loot_distributions`: auditoria (quem recebeu, quantidade, quem confirmou, quando), com chave composta que prende o destinatário à **mesma campanha**.
- `combats` / `combatants`: combate iniciado **a partir** de um encontro (ou avulso). Ao iniciar, cria `combatants` copiando participantes; monstros têm PV no próprio combatente; **PC: o PV vive na participação (`campaign_characters.state`)**, o combatente guarda iniciativa e condições — fonte única, sem sincronização.

Fluxo: Encontros (preparar) → Iniciativa "Iniciar combate" → durante/depois, painel de loot do encontro vinculado (só mestre) → mestre marca "encontrado" e atribui a personagens → função de servidor `distribute_loot` (única via de escrita; verifica mestre da campanha, mesma campanha, atualiza inventário da participação com `version`, grava `loot_distributions` e evento). Nada é distribuído por morte de monstro. Jogadores veem apenas o que foi atribuído a eles.

Isolamento: encontro, combate e loot nunca referenciam registros de outra campanha (chaves compostas + testes cruzados).

## 6. Ajustes de permissões e isolamento (checklist)
1. **Login obrigatório:** remover `guest`/escopo `visitante`; porta de entrada com tela de login/cadastro/recuperação; Account vira só gestão de conta; testes de visitante substituídos por testes de porta. Universal: `to authenticated`, nenhum `grant` a `anon`.
2. **Camada de dados exige `campaignId` explícito** (sem leitura de "campanha ativa" global dentro das funções de acesso).
3. **Cache** (TanStack Query, IndexedDB, buscas): chave sempre `[userId, campaignId|null, …]`; limpar no logout e na troca de campanha; canais Realtime (se usados) assinados por campanha e encerrados na troca; **não** incluir `notes`/`note_shares` no Realtime sem nova revisão.
4. **IndexedDB**: banco por usuário, partição por campanha, apagado no logout/troca de conta; revalidação de acesso ao sincronizar; dado já baixado de um acesso revogado é limitação aceita e documentada.
5. **Layout**: guardar só ids; limpar no logout; painéis tratam "sem acesso" igual a "inexistente".
6. **Padrão de migração de campanha**: `campaign_id` imutável (gatilho), `version`, chaves compostas, limites (como `0004`), reversão em `supabase/rollback/`, testes multi-conta em `supabase/*.test.ts`, e auditoria estrutural atualizada (funções `SECURITY DEFINER` com `search_path` vazio, sem `anon`).
7. Regras existentes (mestre único, participantes, convites, 20 campanhas) **não mudam**.

## 7. Ordem de implementação (dependências e riscos)

| # | Etapa | Depende de | Risco principal |
|---|---|---|---|
| 1 | **Login obrigatório + base de isolamento** (porta de login, remover visitante, layout só com ids, helper de chaves de cache) | — | Baixo; quebra testes de visitante (esperado) |
| 2 | **Notas — cliente e interface** (Etapa B: lista, editor, visibilidade, filtros; `0005` com NULL→campanha se D3 aprovada) | 1, `0004` | Médio: UX de visibilidade; vazamento por título em estados de erro |
| 3 | **Biblioteca universal SRD** (tabelas `srd_*`, carga, Compêndio: Monstros; depois magias/itens) | 1 | Licença/atribuição SRD; volume de dados |
| 4 | **Personagens pessoais** (`characters`, criador de ficha, base state) | 1, 3 (itens, para inventário) | Alto: tamanho do domínio D&D; manter simples e testado |
| 5 | **Participação em campanhas** (`campaign_characters`, vincular/revincular/arquivar, edição do mestre, `character_events`) | 4 | **Alto: RLS e conflitos**; exige testes cruzados pesados |
| 6 | **Links bidirecionais** (`record_links`) + atalho "notas da ficha" | 2, 4 | Médio: nunca vazar título/existência |
| 7 | **Encontros + loot planejado** | 3, 5 | Médio |
| 8 | **Iniciativa a partir do encontro + distribuição de loot** (`distribute_loot`, inventário) | 5, 7 | **Alto:** atomicidade, auditoria, PV único |
| 9 | **Histórico/desfazer e busca universal** | 2, 5, 6 | Médio: FTS sob RLS, retenção |
| 10 | **Documentos avançados** (pastas, templates, blocos, bancos/Kanban, calendários, quadros, anexos/Storage, exportação) por fatias | 2, 6, 9 | Alto no conjunto; entregar uma ferramenta por vez |
| 11 | **Offline/IndexedDB + sincronização com conflitos + PWA** | 5, 9 (escrita estável) | **Alto:** conflitos, vazamento local; só depois de a escrita online estar sólida |

Fichas e Iniciativa não ficam atrás de Documentos avançados: as etapas 4–8 vêm antes da 10. As etapas 2 e 3 são independentes entre si e podem andar em paralelo.

## 8. Decisões que preciso de você (com recomendação)
- **D1 — Personagem excluído pelo dono com participações:** *(recomendado)* exclusão lógica; participações viram `archived` e o mestre mantém o registro com o nome. Alternativas: apagar tudo (some do histórico da campanha) ou impedir exclusão enquanto vinculado.
- **D2 — Jogador removido/saiu:** *(recomendado)* participação `archived` (estado preservado, revinculável; o mestre mantém o histórico). Alternativa: apagar a participação.
- **D3 — Anotação pessoal receber campanha depois** (única transição `NULL → campanha`): *(recomendado)* permitir. Alternativa: criar cópia vinculada.
- **D4 — O que os demais jogadores veem das fichas dos colegas:** *(recomendado)* resumo (nome, retrato, nível); ficha completa só dono e mestre; opção de campanha para mostrar PV da party.
- **D5 — Documentos sobre `notes` (recomendado)** em vez de nova tabela `documents`.
- **D6 — Itens e moedas do loot:** inventário como lista de itens com referência ao catálogo universal ou item personalizado; moedas em campo próprio (cobre, prata, ouro, platina). Confirmar a granularidade.
- Cadastro restrito a convidados: segue **adiado**, como você definiu.

Nenhuma migração nova é proposta nesta etapa; a próxima só será escrita após sua aprovação e, como sempre, aplicada ao banco somente com autorização explícita.

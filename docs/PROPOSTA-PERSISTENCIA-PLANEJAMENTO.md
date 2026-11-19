# Proposta de persistência do Planejamento — 19/11/2026

> **Somente proposta.** Nenhum SQL foi executado ou criado como migração; nenhum arquivo em `supabase/` foi alterado; o Supabase não foi tocado. Os trechos SQL abaixo são **esboços de desenho** para revisão, não migrações. Base: `supabase/migrations/0001`–`0004` (aplicadas no projeto `gwcttjlxzelzjhbuitmi`), `docs/NOTAS-PERMISSOES.md`, `docs/CONTRATO-PLANEJAMENTO-V1.md` (branch do PR #26) e o protótipo do PR #28 (modelo de cartão que referencia página, JSON de blocos validado). Legenda: **[V]** verificado no repositório · **[P]** proposta · **[D]** decisão que precisa de aprovação.

## 1. Princípios
1. **Uma página, um conteúdo.** A página é a linha de `notes` (D5). Cartões, atalhos e links **referenciam**; nunca copiam conteúdo.
2. **Planejamento é do mestre e privado por padrão** [A]. Nenhuma tabela nova é legível por jogadores; vínculo nunca concede acesso.
3. **Aditivo e reversível.** Migrações só acrescentam; cada uma com `supabase/rollback/00NN_down.sql` e testes PGlite multi-conta.
4. **A autorização é do banco** (RLS, `SECURITY DEFINER` com `search_path` vazio, `anon` sem acesso, privilégio por coluna), como na 0004.
5. **Edição por autor único.** Não há colaboração simultânea (decisão); concorrência = **versão otimista** por linha, sem tempo real.
6. **Nada se perde em silêncio:** exclusão lógica por padrão, conflito explícito, rascunho preservado na tela.

## 2. Numeração das migrações (colisão com "0005")
**[V]** `main` contém `0001`–`0004` e o rollback da `0004`. Nenhuma outra branch do repositório traz arquivo de migração além disso (varridas as 29 branches remotas). Os documentos reservam **"0005" para a migração de audiências/vínculos de notas (D3)** (`NOTAS-PERMISSOES.md` §4, `PLANEJAMENTO-V2.md` etapa 2, `REGISTRO-OFICIAL` P5).

**Colisão:** o Planejamento precisa de migrações **antes** das audiências e **não depende delas** (usa só notas `private`). Para que o nome de cada arquivo diga a ordem real de aplicação:

| Nº | Conteúdo | Depende de | Risco |
|---|---|---|---|
| `0001`–`0004` | campanhas, backfill, mestre único, notas | — | **aplicadas** |
| **`0005`** | `planejamento_conteudo`: colunas em `notes` (`kind`, `content`, `content_schema`, `deleted_at`, `deleted_batch`), gatilhos, limites | 0004 | médio (altera `notes` e seus `GRANT`; aditivo) |
| `0006` | `planejamento_quadro`: `planning_sessions`, `planning_columns`, `planning_cards` | 0005 | baixo (tabelas novas, só mestre) |
| `0007` | `registros_sessao`: `session_entries`, `session_tasks` | 0006 | baixo |
| `0008` | `vinculos_paginas`: `note_links` derivada de `content` | 0005 | médio (usa `can_read_note`) |
| `0009` | `notas_audiencias` (a antiga "0005", D3): audiências, destinatários, nova leitura | 0004–0008 | **alto** (reescreve a regra de leitura) |
| `0010`+ | `encontros`, `combates` (módulo Encontros) | 0006 | a definir com o módulo |

**[D] Decisão:** (A) **recomendada** — numerar pela ordem de aplicação: o Planejamento usa `0005`–`0008` e a migração de audiências passa a ser `0009` (atualizar `NOTAS-PERMISSOES.md`, `PLANEJAMENTO-V2.md` e o registro oficial); (B) manter "0005 = audiências" e numerar o Planejamento como `0006`+, aplicando-as **fora de ordem** (não recomendado: o histórico passa a mentir sobre a ordem de aplicação).
**Regras comuns:** número nunca reaproveitado, mesmo se a migração for abandonada; um `supabase/migrations/LEIA-ME.md` com o livro-razão (número, PR, estado: proposta/aplicada, data); **teste automático** `tests/migracoes.test.ts` que falha se houver número repetido, buraco, ou migração sem rollback; a `0009` deve manter a assinatura de `can_read_note` usada pela `0008`.

## 3. Páginas e blocos em JSON (`0005`)
**Formato canônico:** JSON de blocos do BlockNote (array de blocos). **Nunca HTML** (validado no PR #28: ida e volta idêntica; HTML no texto vira texto inerte; `javascript:` vira `href` vazio).

```sql
-- ESBOÇO (não é migração)
alter table public.notes
  add column kind           text  not null default 'note' check (kind in ('note','scene','npc','location','doc','diary')),
  add column content        jsonb check (content is null or (jsonb_typeof(content) = 'array' and octet_length(content::text) <= 500000)),
  add column content_schema int   not null default 1,
  add column deleted_at     timestamptz,
  add column deleted_batch  uuid;
grant insert (kind, content, content_schema) on public.notes to authenticated;      -- além das colunas já liberadas na 0004
grant update (kind, content, content_schema, deleted_at, deleted_batch) on public.notes to authenticated;
```
- **`body` (texto, ≤ 50.000)** continua existindo para busca e prévia: **um gatilho no servidor** o mantém a partir de `content` (texto concatenado dos nós `text`/`link`/`ref`), de modo que ninguém depende do cliente para a busca e para o limite antigo.
- **`content_schema`** versiona o formato dos blocos: o aplicativo migra na leitura (`v1 → v2`) e grava na versão corrente. Validação estrutural completa fica no aplicativo (esquema), o banco só garante tipo, tamanho e (via gatilho de `note_links`) a extração das referências.
- **Imagens:** só referências a arquivos do Storage da campanha (`campaign-assets/<campaign>/<uuid>`), nunca URL externa nem `data:`. Bucket privado com URL assinada; política de Storage própria (migração futura, fora desta fase).
- **Tamanho:** páginas típicas do protótipo têm 1,6–3 kB; teto de 500 kB por página evita abuso sem limitar uso real.
- **[D]** Teto de `content` (500 kB proposto) e a lista de `kind`.

## 4. Sessões, colunas e cartões (`0006`)
Padrão comum (herdado do padrão de migração do projeto): `campaign_id` obrigatório e **imutável** (gatilho), `created_by default auth.uid()`, `version`, `created_at/updated_at`, `deleted_at/deleted_batch`, chaves compostas `(campaign_id, id)` para impedir referência cruzada entre campanhas.

```sql
-- ESBOÇO
planning_sessions (id, campaign_id, title text 1..120, status text check in ('rascunho','em_andamento','concluida'), sort_key, ...)
planning_columns  (id, campaign_id, session_id, title text 1..80, sort_key, ...)       -- FK (campaign_id, session_id) -> sessions
planning_cards    (id, campaign_id, session_id, column_id, kind text check in ('page','encounter','text'),
                   note_id uuid, encounter_id uuid, text text check (length <= 2000),
                   collapsed boolean default true, sort_key, ...)
  -- exatamente um alvo por tipo (CHECK); (session_id, column_id) -> columns: cartão só vive em coluna da própria sessão
```
- **Cartão de página** referencia `notes(id)`; um gatilho exige `note.campaign_id = card.campaign_id` e `note.owner_id = auth.uid()`. **Atalho = dois cartões com o mesmo `note_id`** (sem cópia; remover um não apaga a página nem o outro). Validado no protótipo (editar uma página reflete nos dois cartões; mover não altera páginas).
- **Cartão de encontro** guarda só `encounter_id`; a FK nasce com a tabela de encontros (`0010`+); até lá o tipo existe no `CHECK`, mas o aplicativo não o cria.
- **Cartão de texto** é um bloco de organização da própria sessão (sem página).
- **Limites** (gatilhos `AFTER INSERT`, como na 0004, para não virarem oráculo): 200 sessões por campanha; 30 colunas por sessão; 300 cartões por coluna.

### Ordenação e movimentação
- **Chave de ordenação fracionária** `sort_key text collate "C"` (indexação fracionária estilo "lexorank"): mover um cartão é **um único `UPDATE`** (`column_id`, `sort_key`, com `version`), sem renumerar os vizinhos. Índice `(column_id, sort_key, id)`; empate (dois dispositivos) resolvido por `id`.
- O cliente gera a chave entre os vizinhos (função pura de ~40 linhas, com testes); alternativa: pacote MIT `fractional-indexing` (**[D]** aprovar dependência). Uma função `rebalance_column(column_id)` (`SECURITY DEFINER`, só mestre) reescreve as chaves de uma coluna quando elas ficam longas demais.
- **Movimento entre colunas** = mesmo `UPDATE` trocando `column_id`; a FK composta garante a mesma sessão. Reordenar **colunas** e **sessões** usa o mesmo mecanismo.
- **Conflito de movimento:** `where id = ? and version = ?`; 0 linhas → o cliente recarrega a coluna e reaplica (o movimento é pequeno e idempotente). Perder um movimento nunca perde conteúdo.
- **[D]** Chave de texto fracionária (recomendada) × número com espaçamento e rebalanceamento.

## 5. Registros rápidos e pendências (`0007`)
```sql
-- ESBOÇO
session_entries (id, campaign_id, session_id, card_id null, body text 1..4000, kind text check in ('event','observation'),
                 occurred_at timestamptz default now(), client_id uuid not null, created_by, version, edited_at, deleted_at, ...)
  unique (session_id, client_id)               -- reenvio idempotente
session_tasks   (id, campaign_id, session_id, entry_id null, card_id null, body text 1..500,
                 status text check in ('open','done','dismissed'), resolved_at, resolved_note_id null, created_by, version, deleted_at, ...)
```
- **Não alteram o planejamento** (outra tabela). Podem existir **sem cartão** (`card_id` nulo) e **sobrevivem** à remoção do cartão (`on delete set null`: o texto da sessão não se perde).
- **`client_id`** (UUID gerado no aparelho) torna o envio idempotente: repetir por falha de rede não duplica. Uma fila local simples para quando estiver sem rede é decisão **[D]** (a regra do projeto limita o `localStorage` a layout/preferências; um rascunho de registro seria a primeira exceção e precisa de aprovação).
- **Pendência** é um item à parte; ao resolver, pode apontar `resolved_note_id` (a página do NPC criada depois), **sem** criá-la automaticamente.
- **Edição/remoção:** só o autor; exclusão lógica; sem histórico de edições na primeira entrega (só `edited_at` e `version`). **[D]** Registros editáveis ou somente de acrescentar.
- **Privacidade:** privados do mestre (política `is_master(campaign_id) and created_by = auth.uid()`). Nunca publicados nem usados para gerar o Diário [A].
- **Exportação** (texto/Markdown) roda no cliente sobre o que a RLS já devolve: sem endpoint novo e sem risco de contornar permissões.

## 6. Links entre páginas e encontros (`0008`)
- No conteúdo, a referência é um **inline próprio** `{type:"ref", props:{kind, refId, label}}` (validado no protótipo). **Nunca guarda URL.**
- `note_links(id, campaign_id, source_note_id, target_kind, target_id, created_at)` é um **índice derivado**: um gatilho `AFTER INSERT/UPDATE OF content` em `notes` extrai os `ref` de `content` (`jsonb_path_query`) e reconstrói as linhas daquela página. Derivado no **servidor** = ninguém forja vínculo e o índice nunca discorda do conteúdo.
- **RLS de leitura:** a linha só é visível se `can_read_note(source_note_id)` **e** o alvo for legível para quem lê (`can_read_note(target)` para notas; `is_master` para encontros). Assim nenhum backlink revela título nem existência de registro inacessível.
- **Sem efeito de acesso**; sem cascata do alvo para a origem: alvo removido/na lixeira → vínculo "pendente" (a interface mostra "indisponível").
- Limite: 500 vínculos por página.

## 7. Encontros vinculados e instâncias de combate (`0010`+, depende do módulo Encontros)
- `encounters` = **definição reutilizável** (campanha, mestre, `content jsonb` da lista de criaturas etc.), com versão e exclusão lógica. O cartão de encontro referencia `encounters(id)`.
- `combat_runs` = **execução independente**: `encounter_id` (opcional, `on delete set null`), **`snapshot jsonb`** (cópia congelada da definição no início) e `state jsonb` (PV, condições, rodada, resultado). **Nenhum caminho de escrita da execução para a definição** (sem gatilho nem função que faça isso); a cópia única do início existe de propósito, para o histórico se manter fiel mesmo se o encontro mudar depois.
- Duplicar encontro = criar uma **variante** explícita (nova linha), nunca vincular duas execuções ao mesmo estado.
- **[D]** Aceitar a cópia congelada dentro da execução (única "duplicação" do modelo).

## 8. Exclusão lógica e restauração
- Sessões, colunas, cartões, páginas, registros e pendências têm `deleted_at` e `deleted_batch` (UUID da ação). **Excluir uma sessão** marca a sessão, suas colunas e seus cartões com o **mesmo** `deleted_batch`; **restaurar** devolve exatamente esse lote (padrão também adotado na lixeira dos Encontros do app 1.0). Sem prazo automático de expurgo (coerente com D1); exclusão definitiva é explícita, com confirmação e contagem do que será apagado.
- **Página na lixeira:** um gatilho força `visibility = 'private'` e apaga os destinatários `selected` ao excluir logicamente (restaurar volta **privada**; compartilhar de novo é ação explícita). Assim **a regra de leitura (`note_readable`) não muda** na `0005`.
- Cartões que apontam para página na lixeira mostram "página na lixeira" (restaurar a página os reativa). Excluir **definitivamente** uma página usada em cartões: **[D]** apagar também os cartões (com a lista do que será afetado) × bloquear.
- Excluir a campanha apaga tudo em cascata (regra existente).

## 9. Permissões RLS (resumo)
| Tabela | Leitura | Escrita |
|---|---|---|
| `notes` (+ novas colunas) | regra atual (`note_readable`), **sem mudança** | só o autor (como na 0004) |
| `planning_sessions/columns/cards` | `is_master(campaign_id)` | `is_master` e `created_by = auth.uid()`; colunas/`GRANT` explícitos; `campaign_id` imutável |
| `session_entries/tasks` | `is_master` e autor | idem; `client_id` único |
| `note_links` | `can_read_note(source)` **e** alvo legível | nenhuma (gatilho no servidor) |
| `encounters/combat_runs` | `is_master` | `is_master`; execução nunca escreve na definição |
- **Jogadores:** nada de planejamento. **Mestre de outra campanha:** nada. **Quem saiu/foi removido:** perde acesso na hora (`is_master` é avaliado a cada consulta).
- Funções auxiliares `SECURITY DEFINER` com `search_path` vazio, `anon` sem execução, gatilhos `SECURITY INVOKER` (padrão do projeto). `anon` sem nenhum privilégio. Tabelas novas **fora** da publicação Realtime (regra registrada na revisão da 0004).
- **Cross-campaign:** chaves compostas + gatilhos de coerência (nota e cartão na mesma campanha; coluna e cartão na mesma sessão).

## 10. Versões e conflitos de edição
- Toda linha editável tem `version int` incrementado **só pelo servidor** (gatilho, como na 0004). O cliente atualiza com `where id = ? and version = ?`; **0 linhas = conflito**.
- **Página (conteúdo):** em conflito o aplicativo **não sobrescreve**: mostra a versão do servidor, mantém o rascunho do usuário na tela (a proteção de alterações não salvas já existe: `useUnsavedGuard`) e oferece **manter o meu**, **usar o do servidor** ou **salvar o meu como nova página**; sempre com **Copiar JSON** disponível. Salvamento **explícito** + autosave com intervalo, sempre com versão.
- **Quadro e registros:** conflito de movimento = recarregar e reaplicar (seção 4); registros usam `client_id`.
- **Histórico:** fora do escopo agora. Futuro: `note_versions` (instantâneos append-only a cada N salvamentos ou sob demanda), com RLS igual à da nota.
- Sem tempo real, sem fusão automática, sem CRDT.

## 11. Testes e validação (PGlite, como `supabase/notas.test.ts`)
Isolamento entre campanhas e mestres; jogador, ex-membro e mestre de outra campanha sem acesso; cartão para nota de outra campanha (recusado); coluna de outra sessão (recusado); `version` e conflito; limites; `client_id` idempotente; exclusão lógica em lote e restauração; página na lixeira volta privada; `note_links` não vaza título nem existência; reversão (rollback) deixa o banco idêntico; os 32 testes de notas continuam como suíte de regressão. Mais `tests/migracoes.test.ts` (numeração) e a auditoria estrutural atualizada.

## 12. Ordem de implementação sugerida (PRs pequenos, cada um com aprovação)
1. Esta proposta aprovada + decisões da seção 13 + livro-razão de migrações.
2. `0005` (SQL proposto, rollback, testes) → **aprovação para aplicar** → aplicar (por você).
3. Camada de dados de notas (CAS, conflito) e guarda de alterações não salvas.
4. `0006` + quadro (sessões/colunas/cartões) usando o `Board` do protótipo.
5. `0007` + registros rápidos e pendências; exportação.
6. `0008` + links; depois `0009` (audiências) quando for a vez da Enciclopédia/compartilhamento.
Nenhuma etapa aplica SQL sem a sua autorização expressa.

## 13. Decisões que precisam de aprovação
1. Numeração: **A** (0005–0008 Planejamento; audiências = 0009) × B.
2. Teto de `content` (500 kB) e lista de `kind`.
3. Chave de ordenação (texto fracionário recomendado) e dependência `fractional-indexing` (ou função própria).
4. Registros rápidos: editáveis ou só de acrescentar; fila local offline já no mínimo ou depois.
5. Excluir definitivamente página usada em cartões: apagar os cartões ou bloquear.
6. Cópia congelada do encontro dentro da execução de combate.
7. Que o Planejamento **não espere** as audiências (D3) — confirmado como recomendação.

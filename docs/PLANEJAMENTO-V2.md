# Planejamento v2 — campanhas isoladas, personagens pessoais, documentos, encontros, loot e moedas

Status: **decisões D1–D6 aprovadas (19/11/2026). Tudo abaixo é PLANEJAMENTO; só o que a seção 1 marca como "implementado" existe.** Substitui, sem apagar, as decisões anteriores que conflitem; o que não é citado aqui continua valendo (`DECISOES-E-ARQUITETURA.md`, `NOTAS-PERMISSOES.md`, `FUNDACAO-REGISTROS.md`).
Base: `main` em `2b2d362` (CI e Pages verdes). Migrações `0001`–`0004` **já aplicadas** ao projeto `gwcttjlxzelzjhbuitmi` (não reaplicar). O projeto legado `rastreador-dnd` nunca é tocado. **Nenhuma migração nova foi escrita**; a `0005` só será escrita depois de nova autorização.

## 0. Decisões (todas aprovadas)
1. **Login obrigatório.** Sem visitante. Cadastro continua aberto (restrição a convidados fica para depois). Biblioteca universal: qualquer conta autenticada, somente leitura.
2. **Campanha = ambiente independente** (como contas de CNPJs distintos num login único). Menu lateral inalterado: Campanhas, Personagens, Iniciativa, Encontros, Enciclopédia, Compêndio, Documentos.
3. **Personagem pertence ao usuário**; participa de campanhas por vínculos com estado próprio (D1, D2, D4, D6).
4. **Um único sistema de anotações**, do usuário, com vínculos opcionais que **nunca** transferem propriedade nem compartilham (D3, D5).
5. **Documentos** reúne anotações, páginas, quadros, bancos, calendários, anexos e backup, sobre a mesma tabela `notes` (D5).
6. **Encontros** (campanha) → **Iniciativa** (executa) → **loot** confirmado pelo mestre e registrado (D6).
7. Três escopos de dado aplicados por **RLS**: universal, pessoal, campanha.

Resumo de D1–D6:
- **D1** exclusão **lógica** de personagem; participações arquivadas; histórico da campanha preservado; anotações e documentos intactos.
- **D2** saída/remoção de jogador **arquiva** a participação; restauração preserva o estado, sem sobrescrever com a ficha pessoal.
- **D3** (**a recomendação anterior foi rejeitada**) nada de transferir nota para campanha alterando `campaign_id`; vínculos opcionais e múltiplos; compartilhar é ação explícita e separada do vínculo.
- **D4** dono e mestre veem a ficha completa na campanha; outros jogadores veem nome, retrato e nível; o mestre configura se veem PV dos colegas.
- **D5** `notes` é a base única de documentos.
- **D6** cinco moedas oficiais 5e 2014 (PC, PP, PE, PO, PL); o mestre escolhe as ativas por campanha (padrão: PC, PP e PO); personagem pessoal usa as cinco; saldos independentes por participação; desativar moeda nunca apaga nem converte sem confirmação.

## 1. Estado atual (verificado no código e nas migrações)

| Decisão | Estado | Evidência / lacuna |
|---|---|---|
| Mestre único = criador; mestre não sai, exclui; jogador sai/é removido; 20 campanhas | **Implementado** (SQL + UI + testes) | `0001`, `0003`, `rls.test.ts` |
| Convites por link, entrada automática | **Implementado** | `CampaignPanels.tsx`, `join_campaign` |
| Autenticação, recuperação, sessão persistente | **Implementado** | `auth.ts`, `AuthContext.tsx` |
| Login obrigatório | **Não implementado** — ainda existe modo visitante (`AuthStatus: guest`, escopo `visitante`, avisos em `AccountPanel`) | contradiz a decisão 1 |
| Uma campanha ativa por vez | **Implementado no cliente** (`CampaignsContext`, `compendio5e:active-campaign:<usuário>`) | o servidor não tem noção de "ativa", e não deve ter |
| Isolamento do **layout** por usuário+campanha+dispositivo | **Implementado** | `persistence.ts`, `App.tsx`; é só apresentação |
| Isolamento real de **dados** por campanha | **Parcial**: só `campaigns`, `campaign_members`, `campaign_invites`, `notes`, `note_shares` (RLS + testes) | Personagens, Iniciativa, Encontros, Enciclopédia, Compêndio e Documentos são *placeholders* sem tabela |
| Notas com visibilidade `private/master/campaign/selected` | **Implementado só no banco** (`0004`, 32 testes) | sem cliente nem interface; **o modelo de vínculos de D3 não cabe nele sem mudanças (seção 4.4)** |
| Biblioteca universal (bestiário SRD) e biblioteca pessoal | **Não existem** | só contratos em `records.ts` |
| Personagens, participações, estados | **Não existem** | |
| Configurações de campanha (moedas, PV dos colegas) | **Não existem** | |
| Moedas e inventário | **Não existem** | |
| Encontros, combate, loot | **Não existem** | |
| Links bidirecionais, busca, histórico, offline | **Só contratos** (`records.ts`: `RecordLink`, `decideVersion`, `PendingOperation`) | sem tabelas, sem IndexedDB |
| Cache/IndexedDB, PWA | **Não existem** | hoje só `localStorage` (layout e campanha ativa) |

Riscos de isolamento já presentes no cliente:
- O layout salvo guarda **títulos de abas** em `localStorage`; ficam no aparelho após logout. Guardar só ids e resolver títulos pela API (ou limpar o layout no logout).
- Abas persistidas apontam para registros que podem deixar de ser acessíveis: todo painel trata "sem acesso" e "inexistente" com a mesma tela.
- Ainda não há regra para **caches**: ver 6.

## 2. Modelo de escopos
- **Universal**: SRD 2014 (`srd_*`), `select` para `authenticated`, nenhum `insert/update/delete` para clientes; carga por migração/seed. Nunca editado: personalização = cópia pessoal ou de campanha com `source_ref` (cópia independente).
- **Pessoal**: `owner_id = auth.uid()`, sem `campaign_id`. Existe sem campanha ativa.
- **Campanha**: `campaign_id` obrigatório; leitura/escrita por participação **atual** (`is_member`/`is_master`), nunca pela "campanha ativa" (conceito do cliente).

Regra para toda tabela nova: declarar o escopo na primeira linha da migração e testá-lo com contas de papéis diferentes (modelo de `notas.test.ts`).

## 3. Personagens, participações e estados

### 3.1 Modelo
- `characters` — **identidade** (dono = criador): nome, retrato, conceito, raça/antecedente, descrição; `base_state jsonb` = ficha pessoal completa (nível, atributos, PV, XP, inventário, **cinco moedas**) usada **sem campanha** e como ponto de partida ao vincular; `status` (`active | retired | dead`, rótulo do dono, não afeta acesso); `deleted_at` (lixeira, D1); `version`.
- `campaign_characters` — **participação**: `(campaign_id, character_id)` **único** (uma linha por par; reentrada reaproveita a mesma linha); `state jsonb` independente (nível, XP, PV, atributos, inventário, recursos, **carteira `coins` com as cinco chaves**); `status` (`active | archived`) + `archived_reason` (`unlinked | player_left | player_removed | character_deleted | character_dead | character_retired | replaced`); `display_name_snapshot`, `portrait_snapshot` (para o histórico da campanha continuar legível se a identidade sumir da biblioteca); `version`; `linked_at`, `archived_at`.
- `character_events` — histórico append-only (quem, o quê, antes/depois): base de auditoria, desfazer e do "o mestre mudou isto".

### 3.2 Regras
- **Identidade e ficha pessoal:** só o dono edita e exclui. O mestre nunca altera `characters`/`base_state` nem exclui o personagem de outro usuário.
- **Vincular:** o dono vincula a campanhas das quais participa. **Primeiro vínculo copia** a parte não monetária de `base_state` (equipamento inicial, atributos base…) para `state`; **moedas NÃO são copiadas** (D6: não misturar carteira pessoal com carteira de campanha): a carteira da participação começa em zero e só muda por ação do mestre/dono dentro da campanha. Depois do vínculo, cada estado evolui sozinho: sem sincronização contínua, sem conflito entre campanhas.
- **Restauração (D2):** voltar à campanha **reativa a mesma linha** (`status = active`) e **não** recopia `base_state`: o estado preservado prevalece. Se o dono quiser reiniciar a partir da ficha pessoal, é ação explícita e separada, com confirmação ("substituir o estado desta campanha"), registrada em `character_events`.
- **Saída/remoção do jogador (D2):** todas as participações dele naquela campanha viram `archived` (`player_left`/`player_removed`); estado e histórico preservados; o personagem pessoal continua dele. O mestre mantém o histórico necessário da campanha (nome, nível, eventos, distribuições de loot); **não** passa a ver nada novo (ver 3.4).
- **Morte, aposentadoria, substituição:** `status` da participação muda para `archived` com o motivo correspondente; **nenhuma anotação é tocada** (vínculos não têm efeito em cascata). O jogador cria outro personagem e o vincula à mesma campanha; nada do anterior é perdido.
- **Exclusão lógica (D1):** `characters.deleted_at` preenchido → some da biblioteca pessoal (visível numa lixeira do dono, restaurável); participações viram `archived (character_deleted)` mantendo `*_snapshot`; **histórico da campanha preservado**; anotações e documentos **não** são excluídos e seus vínculos continuam (o alvo aparece como "personagem excluído" para quem puder ver). Exclusão física não é oferecida nesta fase.
- **Mestre edita o estado da participação** da própria campanha (nível, XP, PV, atributos, inventário, moedas habilitadas) — `UPDATE` com `is_master(campaign_id)`; não enxerga nem altera participações em outras campanhas. Cada edição do mestre gera `character_events` visível ao dono.
- Chaves compostas `(campaign_id, id)` nas tabelas dependentes (loot, combate, eventos) impedem referenciar participação de outra campanha.
- Concorrência: `version` com atualização condicional e `operationId` (offline futuro); conflito nunca sobrescreve em silêncio.

### 3.3 Interface (aba Personagens)
Com campanha ativa → "Da campanha" (participações ativas; arquivadas em seção recolhida para o mestre e o dono) + "Meus personagens" (pessoais, com "Vincular à campanha"). Sem campanha ativa → somente pessoais, com criação e administração completas. Aba `ficha:<characterId>`: abre o estado da campanha ativa quando vinculado, senão a ficha pessoal, **com o contexto sempre rotulado** ("Ficha pessoal" × "Na campanha X").

### 3.4 Visibilidade de fichas (D4)
- **Dono e mestre** da campanha: ficha completa **no contexto daquela campanha**. Mestre edita o estado.
- **Outros jogadores:** `nome`, `retrato` e `nível` (derivados da participação ativa). PV só se `campaign_settings.party_hp_visible = true` (o mestre decide). Nada mais, nem de outras campanhas.
- Implementação prevista: visão/RPC de "resumo da party" `security invoker`/definer mínima que devolve **só** esses campos; a tabela `campaign_characters` completa não é legível por jogadores que não são o dono. Participações arquivadas: só dono e mestre.
- Participações de outras campanhas e a identidade completa (`characters`) nunca são expostas por vínculo de campanha.

## 4. Documentos e anotações (sistema único)

### 4.1 Princípios aprovados (D3 + D5)
1. Toda anotação tem **autor/proprietário**; a propriedade não muda.
2. Existe sem campanha e sem personagem.
3. Pode ter **vínculos opcionais e múltiplos** (personagens, campanhas, NPCs, locais, encontros, outros registros).
4. **Vínculo ≠ propriedade ≠ acesso.** Criar um vínculo nunca compartilha nem altera quem lê.
5. A mesma anotação pode se relacionar a vários personagens/campanhas.
6. **Compartilhar** é ação explícita, separada, com público definido (4.3).
7. Mestre não lê anotação privada por administrar a campanha (regra já garantida em `0004`).
8. O autor continua acessando as próprias anotações ao sair da campanha, ao morrer/trocar de personagem ou quando o personagem for excluído.
- Um só armazenamento e **um só editor**: `notes` (`0004`) é a base. Anotação de jogador, de personagem e documento do mestre são a mesma entidade, filtrada por vínculos, visibilidade e tipo. A ficha mostra só um atalho para "anotações relacionadas" (consulta filtrada pela RLS, sem cópia).
- **Exemplo de referência (personagem A morre):** as notas ligadas ao A permanecem em Documentos; o jogador filtra por personagem, e pode **vincular** notas antigas ao personagem B (novas linhas de vínculo; nada é copiado ou movido). O app preserva o que o jogador registrou; o que o personagem B "sabe" na história é decisão da mesa.

### 4.2 Vínculos (`record_links`) — planejado
Linha: `(note_id, target_kind, target_id, target_campaign_id?, created_by, created_at)`; único por trio. **Sem `ON DELETE CASCADE` do alvo para a nota** e sem chave estrangeira que apague nota; alvo removido/arquivado deixa o vínculo "pendente", exibido como indisponível.
- **Escrita:** só o autor da nota; só para alvos que ele **pode ler agora** (não se vincula a registro oculto).
- **Leitura:** a linha é legível se `can_read_note(note_id)`; **título e existência do alvo** vêm sempre da RLS do próprio alvo. Backlinks do alvo = vínculos cuja nota o leitor pode ler **e** cujo alvo ele pode ler. Nunca revelar existência ou título de nota privada por backlink.
- **Efeito de acesso: nenhum.** Vincular uma nota privada ao personagem de um colega não a torna visível a ninguém.

### 4.3 Compartilhamento explícito — planejado
Compartilhar = o autor definir uma **audiência** por campanha. Modelo recomendado: tabela de audiências `(note_id, campaign_id, scope: master | campaign | selected)` mais destinatários para `selected` `(note_id, campaign_id, user_id)`; uma nota pode ter **várias** audiências (campanhas diferentes). Regras herdadas da `0004`: leitor e autor participam **agora**; compartilhamento fica suspenso enquanto o autor está fora e volta se ele reentrar; mudar o escopo limpa selecionados; limites de 50 destinatários e 5000 notas; só o autor compartilha.

### 4.4 Compatibilidade com o banco aplicado (`0004`) — análise
A `0004` usa **um único `campaign_id` imutável** que acumula três papéis: (a) campanha de origem, (b) público do compartilhamento e (c) pré-condição de escrita. D3 exige separá-los. Incompatibilidades:

| Ponto na `0004` | Conflito com D3 | Mudança necessária (planejada, `0005`) |
|---|---|---|
| `check (campaign_id is not null or visibility = 'private')` | nota pessoal (sem campanha) não pode ser compartilhada nem ter público | remover/relaxar; visibilidade passa a derivar das **audiências** |
| `campaign_id` imutável e único | impede compartilhar a mesma nota em várias campanhas e impede compartilhar depois, **sem** mover a propriedade | manter imutável como "campanha de origem" (informativo, sem poder de acesso); acesso passa a vir só de audiências |
| `note_shares (note_id, user_id)` sem campanha | `selected` precisa saber **em qual campanha** o destinatário participa | acrescentar `campaign_id` (preenchido a partir da nota para as linhas existentes) |
| `notes_update` `with check (campaign_id is null or is_member(campaign_id))` | **autor que saiu da campanha não consegue editar as próprias notas**, contra o item 8 de D3 (leitura continua, edição não) | editar a própria nota não deve exigir participação; só **compartilhar para** uma campanha exige participação atual |
| `notes_insert` exige participação na campanha | criar nota "no contexto de uma campanha" funciona, mas nota pessoal vinculada depois depende de vínculos, não de `campaign_id` | criação livre; participação só para audiência |
| `note_readable(nid, owner, campaign, vis)` | lê colunas da própria linha | reescrever lendo audiências (continua a regra única; `can_read_note` mantém assinatura) |
| `visibility` na tabela | duas fontes de verdade (coluna e audiências) | período de transição: coluna vira derivada/legado, preenchida por gatilho; remoção só em migração posterior |

Caminho recomendado: **migração aditiva** (`0005`) que (1) cria audiências e `record_links`, (2) preenche audiências a partir das notas existentes com `campaign_id` e `visibility <> 'private'`, (3) troca as funções de leitura, (4) relaxa a política de escrita do autor, (5) mantém `campaign_id`/`visibility` para compatibilidade e acrescenta reversão em `supabase/rollback/`. **Alternativa descartada:** permitir `NULL → campanha` (rejeitada em D3: transferiria a nota para uma campanha). Os 32 testes de `notas.test.ts` viram a **suíte de regressão** da `0005`; os testes de "autor fora da campanha não edita" serão **substituídos** (comportamento muda por D3 item 8).

### 4.5 Organização da aba Documentos
- Lista única com **filtros**: escopo (Pessoais | Campanha ativa), tipo, **personagem**, vínculo, visibilidade/público, etiqueta, pasta; busca (4.7). Árvore de pastas/páginas/subpáginas.
- "Novo" abre tipos e templates; cada documento abre na própria aba `documento:<id>` com o editor do tipo. Ferramentas avançadas só aparecem quando existem. Nenhuma aba principal nova.
- **Sem campanha ativa:** mostra as anotações pessoais (inclusive as vinculadas a campanhas, que são do autor) e não cria nem edita documentos **de campanha**; não consulta campanhas.
- **Documentos de campanha do mestre** (segredos, handouts) = `notes` do mestre com audiência da campanha; o mestre não sai da campanha, então nunca ficam "suspensos".
- Evolução da tabela (futuro, ainda sem migração): `kind`, `parent_id` (mesmo dono), `sort_order`, conteúdo em blocos; mantém `owner_id`, audiências, `version`, `can_read_note`, limites.
- Recursos por etapa: (1) notas + visibilidade + vínculos; (2) pastas/páginas/subpáginas e templates; (3) editor por blocos; (4) bancos/tabelas/Kanban; (5) calendários e linhas do tempo; (6) quadros infinitos e mapas de relações (consomem `record_links`); (7) anexos e mapas (Storage); (8) exportação/backup.
- **Anexos:** Supabase Storage com políticas espelhando `can_read_note` (`owner/note_id/arquivo`), limites de tipo/tamanho, nunca URL pública. **Exportação/backup:** feitos pelo cliente com o que a RLS permite ler; backup da campanha só pelo mestre e só do que ele pode ler.

### 4.6 Histórico e desfazer
`note_versions` append-only: versão de nota privada só para o autor; versão de nota compartilhada herda a regra de leitura **atual**; nunca revela conteúdo que a nota hoje não revelaria. Retenção limitada; desfazer = nova versão com o conteúdo antigo. Mesmo padrão para `character_events` e eventos de encontro.

### 4.7 Busca universal
Sem tabela de índice duplicada: RPC/visão `security invoker` com FTS sobre as tabelas protegidas, unindo universal + pessoal + campanha ativa; prévia só de linhas que a RLS já devolveu. Índice offline local (futuro): por usuário e campanha.

## 5. Configurações da campanha, moedas, encontros, Iniciativa e loot

### 5.1 Configurações da campanha (`campaign_settings`) — planejado
Uma linha por campanha, criada junto com a campanha, legível por participantes, **gravável só pelo mestre**, `campaign_id` imutável:
- `coin_cp`, `coin_sp`, `coin_ep`, `coin_gp`, `coin_pp` (booleans). **Padrão sugerido para novas campanhas: cobre, prata e ouro ligados; electro e platina desligados** (mesa do responsável). O mestre altera quando quiser. Pertence à campanha, não ao usuário nem ao personagem.
- `party_hp_visible` (boolean, padrão `false`) — D4.
- Futuro: outras opções simples; sem "configurações" gratuitas (regra 9 de `DECISOES`).

### 5.2 Moedas (D&D 5e 2014)
- Cinco moedas: **PC, PP, PE, PO, PL**. Equivalências oficiais fixas (não configuráveis), em constante única compartilhada cliente/servidor: 1 PP = 10 PC; 1 PE = 5 PP = 50 PC; 1 PO = 2 PE = 10 PP = 100 PC; 1 PL = 10 PO = 1000 PC.
- **Carteira:** objeto `coins` com as **cinco chaves sempre presentes** (inteiros ≥ 0) em `base_state` e em `campaign_characters.state`. Ativar/desativar moeda só muda a configuração da campanha; **não toca em nenhum saldo**.
- **Pessoal:** ficha sem campanha mostra as cinco. **Participação:** mostra as moedas ativas da campanha **mais** qualquer moeda desativada que ainda tenha saldo. Campanha A só ouro → só PO; B cobre/prata/ouro → PC, PP, PO; C todas → as cinco. O mesmo personagem tem saldos totalmente independentes em cada participação; nada é somado entre pessoal e campanhas.
- **Moeda desativada com saldo — comportamento definido:**
  1. **Nunca some:** continua aparecendo em cada ficha afetada, com selo "desativada" e o saldo real; o **total** (equivalente em PO, apenas informativo) **inclui** esse saldo e informa a parcela ("inclui 3 PE em moeda desativada"). Nada fica oculto de forma enganosa.
  2. Ao desativar, o mestre recebe aviso com a lista de participações afetadas (**só informação**; nenhum valor é alterado).
  3. **Soluções seguras, sempre por ação confirmada do mestre**, com prévia do resultado: (a) reativar a moeda; (b) manter como "saldo legado" (somente gastar/transferir para baixo, nunca receber mais — o servidor recusa **crédito** em moeda desativada); (c) **converter** pelas equivalências oficiais para moedas ativas, por personagem ou em lote, mostrando antes/depois; o **resto indivisível permanece** na moeda desativada (sem arredondar para baixo em silêncio); (d) zerar/descartar só com confirmação digitada e evento registrado.
  4. Toda conversão ou descarte vira `character_events` (antes/depois, ator, motivo) e é reversível por desfazer.
- **Sem lojas, comércio, economia complexa ou taxas de câmbio personalizadas.** A conversão acima é só utilitário de saldo com as equivalências oficiais.

### 5.3 Encontros, combate e loot
Tabelas (todas `campaign_id not null`, RLS de campanha, `campaign_id` imutável, chaves compostas):
- `encounters`: nome, status (`draft | ready | running | finished`), dificuldade, cenário, notas/referências (via `record_links`), resultado/histórico. **Padrão: só o mestre vê**; revelar partes aos jogadores é ação explícita.
- `encounter_participants`: monstro universal (id estável, não copiado), NPC/monstro personalizado ou participação de PC; quantidade; observações.
- `encounter_loot`: itens (catálogo universal **ou** personalizados) e **moedas só das ativas na campanha**; `state` (`planned | found | distributed | discarded`). Existe também em encontros sem combate. Se uma moeda planejada for desativada antes da distribuição, o item fica sinalizado e o mestre ajusta ou converte (nunca automático).
- `loot_distributions`: auditoria (quem recebeu, **quantidades efetivamente distribuídas** por item e por moeda, quem confirmou, quando); chave composta prende destinatário à **mesma campanha**.
- `combats`/`combatants`: combate iniciado **a partir** de um encontro (ou avulso); ao iniciar copia participantes; monstros têm PV no combatente; **PC: o PV vive na participação** (fonte única); o combatente guarda iniciativa e condições.
- Fluxo: Encontros (preparar) → Iniciativa "Iniciar combate" → durante/depois, painel de loot do encontro vinculado (só mestre) → mestre marca "encontrado" e atribui → função de servidor `distribute_loot` (única via de escrita: confere mestre, mesma campanha, moedas ativas, atualiza inventário/carteira com `version`, grava `loot_distributions` e `character_events`). **Nada é distribuído por morte de monstro.** Jogadores veem apenas o que receberam.

## 6. Permissões e isolamento (checklist transversal)
1. **Login obrigatório:** remover `guest`/escopo `visitante`; porta de entrada (login/cadastro/recuperação); Account vira gestão de conta; testes de visitante substituídos por testes de porta. Universal: `to authenticated`, nenhum `grant` a `anon`.
2. A camada de dados recebe `campaignId` **explícito** (sem ler "campanha ativa" global).
3. **Cache** (TanStack Query, IndexedDB, buscas): chave `[userId, campaignId|null, …]`; limpar no logout e na troca de campanha; Realtime por campanha e encerrado na troca; **não** incluir `notes`/`note_shares`/audiências no Realtime sem revisão.
4. **IndexedDB:** banco por usuário, partição por campanha, apagado no logout/troca de conta; revalidação ao sincronizar; dado já baixado de acesso revogado é limitação aceita e documentada.
5. **Layout:** só ids; limpar no logout; "sem acesso" = "inexistente".
6. Padrão de migração de campanha: `campaign_id` imutável (gatilho), `version`, chaves compostas, limites, reversão em `supabase/rollback/`, testes multi-conta, auditoria estrutural (`SECURITY DEFINER` com `search_path` vazio, sem `anon`, gatilhos `invoker`).
7. Regras existentes (mestre único, participantes, convites, 20 campanhas) **não mudam**.

## 7. Dependências e riscos para as próximas migrações

| Migração (futura, ainda não escrita) | Depende de | Riscos |
|---|---|---|
| **`0005` notas: audiências + `record_links` + edição do autor fora da campanha** | `0004` aplicada | alterar regra de leitura já em produção (regressão: reaproveitar os 32 testes); backfill das audiências; período com duas fontes de verdade (`visibility`/`campaign_id` × audiências); rollback precisa restaurar o comportamento anterior; **não pode reabrir vazamento** de notas privadas |
| `campaign_settings` (+ preenchimento das campanhas existentes) | `0001`, `0003` | linha obrigatória por campanha (criar no `create_campaign` e backfill); só o mestre grava |
| `srd_*` (bestiário, depois magias e itens) | — | licença/atribuição SRD; volume e formato dos dados |
| `characters`, `campaign_characters`, `character_events` | `campaign_settings`, `srd_*` (itens) | **maior risco de RLS**: mestre edita só o estado da própria campanha; resumo para jogadores sem vazar; restauração sem sobrescrita; exclusão lógica; participações arquivadas; chaves compostas |
| `encounters`, `encounter_*`, `combats`, `loot_*`, `distribute_loot` | personagens, moedas, itens | atomicidade, auditoria, PV único, moedas desativadas, não misturar campanhas |
| Histórico (`note_versions`) e busca | `0005` e personagens | FTS sob RLS; retenção; histórico não pode contornar a leitura atual |
| Documentos avançados (`kind`, `parent_id`, blocos, bancos…) | `0005`, histórico | tamanho do conjunto; uma ferramenta por vez |
| Offline/IndexedDB | escrita online estável | conflitos; vazamento local; limpeza no logout |

Riscos transversais: **exclusão de conta** vs retenção do histórico da campanha (`campaigns.created_by` é `on delete restrict`; personagens e participações de uma conta excluída precisam de regra — decidir antes de personagens); papel `archived` não pode manter acesso do jogador removido; `base_state` não pode vazar via resumo da party.

## 8. Ordem de implementação
Mudança em relação à versão anterior (necessária): a **migração de arquitetura de notas (`0005`) passa a vir ANTES da interface de notas**, para a interface ser construída uma vez só sobre o modelo definitivo de audiências e vínculos; e **`campaign_settings`** entra cedo, pois moedas e visibilidade de PV dependem dela.

| # | Etapa | Depende de |
|---|---|---|
| 1 | **Login obrigatório + base de isolamento** (porta de login, remover visitante, layout só com ids, helper de chaves de cache) | — |
| 2 | **Notas — arquitetura (`0005`: audiências, vínculos, edição do autor)** + camada de dados + testes de regressão | 1, `0004` |
| 3 | **Notas — interface em Documentos** (lista, editor, vínculos, compartilhamento explícito, filtros) | 2 |
| 4 | **`campaign_settings`** (moedas ativas, PV dos colegas) + aba Campanhas | 1 |
| 5 | **Biblioteca universal SRD** (Compêndio: monstros; depois magias/itens) — pode andar em paralelo com 2–4 | 1 |
| 6 | **Personagens pessoais** (identidade, ficha-base, cinco moedas, lixeira) | 1, 5 |
| 7 | **Participações** (vincular/restaurar/arquivar, edição do mestre, resumo da party, `character_events`, carteira por campanha) | 4, 6 |
| 8 | **Links bidirecionais** completos + atalho "anotações da ficha" | 3, 6 |
| 9 | **Encontros + loot planejado** | 5, 7 |
| 10 | **Iniciativa a partir do encontro + `distribute_loot` + inventário/moedas** | 7, 9 |
| 11 | **Histórico/desfazer e busca universal** | 3, 7, 8 |
| 12 | **Documentos avançados** (pastas, templates, blocos, bancos/Kanban, calendários, quadros, anexos, exportação), uma ferramenta por vez | 3, 8, 11 |
| 13 | **Offline/IndexedDB + sincronização com conflitos + PWA** | 7, 11 (escrita estável) |

Fichas e Iniciativa continuam vindo antes dos Documentos avançados.

## 9. Pontos ainda abertos (não bloqueiam a etapa 1)
- Exclusão de **conta** e destino de personagens/participações/histórico (seção 7).
- Confirmar que **moedas não são copiadas** da ficha pessoal ao vincular (seção 3.2, decorrência de "não misturar"); o equipamento inicial é copiado.
- Prazo de retenção da lixeira de personagens.
- Cadastro restrito a convidados: **adiado**, como definido.

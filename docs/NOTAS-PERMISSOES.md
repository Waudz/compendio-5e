# Notas e diário — permissões, persistência e evolução

Status: **banco implementado e aplicado** (`supabase/migrations/0004_notas.sql`, no projeto `gwcttjlxzelzjhbuitmi` em 19/11/2026, junto com a `0003`; não reaplicar; reversão em `supabase/rollback/0004_notas_down.sql`). **Ainda não existem cliente de dados nem interface de notas.** O modelo de vínculos e de compartilhamento por audiência (decisão D3) é **planejado e ainda não existe no banco** (seção 4). Testes: `supabase/notas.test.ts` (32 casos, várias contas e papéis, Postgres em memória).

## 1. Regras vigentes (`0004`)

**Visibilidade** (`notes.visibility`): `private` (só o autor), `master` (autor e mestre da campanha), `campaign` (autor e participantes), `selected` (autor e participantes escolhidos em `note_shares`). Nota sem campanha só pode ser `private`. **O mestre não lê nota privada de jogador**; nada é compartilhado automaticamente.

**Leitura:** uma regra única, `note_readable(...)` / `can_read_note(id)`: o autor sempre; os demais só se a nota é de campanha e não privada, **o leitor participa agora**, **o autor também participa agora** e a visibilidade permite (`master` exige ser o mestre; `selected` exige estar em `note_shares`). `can_read_note` devolve `false` igual para nota inexistente e inacessível. Links, busca e histórico futuros devem usá-la nas próprias políticas.

**Escrita:** só o autor insere, edita, exclui e compartilha. `owner_id`, `campaign_id`, `id`, `created_at` e `version` não são graváveis por clientes (privilégio de coluna), e um gatilho recusa troca de dono/campanha até para papéis privilegiados. Limites: 5000 notas por usuário, 50 selecionados por nota, título 1–120 e corpo até 50000 caracteres.

**Selecionados:** o destinatário precisa participar da campanha e não pode ser o autor; mudar a visibilidade de `selected` apaga a lista (voltar a `selected` não a restaura).

**Concorrência:** o servidor incrementa `version`; o cliente atualiza com `where id = ? and version = ?` e **0 linhas = conflito** (nada é sobrescrito em silêncio).

**Quem sai ou é removido da campanha (política confirmada):** nada é apagado. O autor continua lendo e excluindo as próprias notas, mas **hoje não as edita fora da campanha**; o compartilhamento fica **suspenso** (mestre e demais deixam de ver) e volta a valer se ele reentrar. (Alternativas descartadas: apagar ao sair; manter visível à mesa; converter em privadas.) **Exclusão:** apagar a campanha apaga suas notas (cascata); apagar a conta apaga as notas da conta (o destino disso será discutido antes de implementar a exclusão de contas). O mestre não exclui nem modera notas de jogadores.

## 2. Revisão de segurança da `0004`
Corrigido antes de aplicar: (1) o limite de compartilhamentos rodava antes da RLS e servia de oráculo → agora `AFTER INSERT`; (2) gatilhos passaram a `SECURITY INVOKER`, restando 4 funções `SECURITY DEFINER` com `search_path` vazio e sem acesso para `anon` (`is_note_owner`, `note_readable`, `can_read_note`, `can_share_note`); (3) o selecionado só vê a própria linha de compartilhamento enquanto a nota é legível para ele; (4) limite de 5000 notas por usuário.

Verificado sem vazamento: funções expostas por `/rpc` com argumentos forjados; erros idênticos para nota, campanha ou destinatário inexistente ou alheio; predicados de usuário (`like`, divisão por zero, agregações, `exists`) não enxergam linhas barradas pela RLS; `anon` sem acesso.

Riscos residuais aceitos: `note_readable` aceita argumentos arbitrários (necessário em políticas e `INSERT … RETURNING`) e só revela o que o chamador já sabe; quem é removido e volta por convite recupera o acesso às notas `campaign`/`selected` que ainda existam; mensagens de `CHECK`/FK podem mostrar a linha que o próprio usuário tentou gravar; **não** incluir `notes`/`note_shares` (nem futuras audiências) na publicação do Realtime sem nova revisão.

## 3. Contratos de interface
`src/notePermissions.ts` (`canReadNote`, `canEditNote`) serve **só à apresentação**; nunca autoriza nada. Nunca confiar em `isCampaignMaster`, `isCampaignMember` ou `allowedUserIds` enviados pelo navegador. A edição por outros além do autor não existe (compartilhar não concede edição).

## 4. Evolução planejada (decisão D3) — NÃO implementada
**Decidido:** sistema único de anotações do usuário; **vínculos opcionais e múltiplos** (personagens, campanhas, NPCs, locais, encontros…) que **não transferem propriedade nem compartilham**; compartilhar é ação explícita; o autor mantém acesso e **edição** ao sair da campanha ou quando o personagem morre, é trocado ou excluído. A proposta de mudar `campaign_id` de `NULL` para uma campanha foi **rejeitada**.

**Incompatibilidades da `0004` com D3** (hoje `campaign_id`, único e imutável, faz de origem, de público e de pré-condição de escrita):

| Ponto na `0004` | Conflito | Mudança necessária (migração futura `0005`) |
|---|---|---|
| `check (campaign_id is not null or visibility = 'private')` | nota pessoal não pode ser compartilhada | relaxar; visibilidade passa a derivar das **audiências** |
| `campaign_id` imutável e único | impede compartilhar a mesma nota em várias campanhas, ou depois, sem mover a propriedade | manter como "campanha de origem" informativa, sem poder de acesso; acesso só por audiências |
| `note_shares (note_id, user_id)` sem campanha | `selected` precisa saber em qual campanha o destinatário participa | acrescentar `campaign_id` (preenchido das notas existentes) |
| `notes_update`: `with check (campaign_id is null or is_member(campaign_id))` | **autor fora da campanha não edita as próprias notas**, contra D3 | editar a própria nota não exige participação; só compartilhar para uma campanha exige participação atual |
| `notes_insert` exige participação | criar nota pessoal vinculada depois depende de vínculos, não de `campaign_id` | criação livre; participação só para audiência |
| `note_readable(nid, owner, campaign, vis)` | lê colunas da própria linha | reescrever lendo audiências (mesma assinatura de `can_read_note`) |
| `visibility` na tabela | duas fontes de verdade | período de transição com a coluna derivada por gatilho; remoção só em migração posterior |

**Modelo planejado:** **audiências** `(note_id, campaign_id, scope: master | campaign | selected)` mais destinatários `(note_id, campaign_id, user_id)`; uma nota pode ter várias audiências. Regras herdadas: leitor e autor participam **agora**; compartilhamento suspenso enquanto o autor está fora; limites de 50 destinatários e 5000 notas; só o autor compartilha. **Vínculos** `record_links(note_id, target_kind, target_id, target_campaign_id?, created_by)`: só o autor escreve, apenas para alvos que ele pode ler; a linha só é legível se `can_read_note(nota)`; título e existência do alvo vêm da RLS do próprio alvo; backlinks só mostram vínculos cuja nota **e** cujo alvo o leitor pode ler; **nenhum efeito de acesso**; sem cascata do alvo para a nota (alvo removido deixa o vínculo "pendente").

**Caminho:** migração **aditiva** que (1) cria audiências e vínculos, (2) preenche audiências das notas existentes com campanha e visibilidade ≠ privada, (3) troca as funções de leitura, (4) relaxa a escrita do autor, (5) mantém `campaign_id`/`visibility` por compatibilidade e traz reversão. Os 32 testes atuais viram a suíte de regressão; os de "autor fora da campanha não edita" serão **substituídos**. Risco principal: alterar regra de leitura em produção sem reabrir vazamento.

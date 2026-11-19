# Notas e diário — contratos preliminares

Os contratos TypeScript (`src/notePermissions.ts`) servem só à interface. A autorização real está no banco: `supabase/migrations/0004_notas.sql` (testada em Postgres em memória e **aplicada** ao projeto `gwcttjlxzelzjhbuitmi` em 19/11/2026, junto com a `0003`; não reaplicar). Ainda não existe editor nem acesso a `notes` pelo cliente.

## Visibilidade
- `private`: somente autor.
- `master`: autor e mestre participante da campanha.
- `campaign`: autor e participantes da campanha.
- `selected`: autor e participantes selecionados explicitamente.
- Sem campanha: somente autor, independentemente da visibilidade declarada.
- Um mestre não tem acesso automático a notas privadas de outro autor.
- Edição inicial: apenas autor; compartilhamento não concede edição.

## Requisitos para futura implementação SQL
- Aplicar RLS a notas e permissões no servidor; verificar pertencimento atual à campanha em cada consulta.
- Nunca confiar em `isCampaignMaster`, `isCampaignMember` ou `allowedUserIds` enviados pelo navegador para autorizar acesso.
- Definir política de transferência/remoção de notas ao sair da campanha, antes de criar persistência.
- Proteger links, busca, prévias e histórico com a mesma política da nota de origem.
- Proibir escalonamento de privilégios por atualização de `owner_id`, `campaign_id` ou listas de compartilhamento.
- Não criar funcionalidades de visitante; conteúdo universal é consultável por qualquer conta autenticada.

## A seguir
A `0004` está aplicada. Qualquer mudança nas regras de notas exige nova migração revisada, testes de regressão (a suíte `supabase/notas.test.ts` é a referência) e autorização explícita antes de aplicar.

## Persistência e RLS (migração 0004) — estado

Tabelas `notes` (autor, campanha opcional, título, corpo, visibilidade, `version`) e `note_shares` (selecionados).
- **Leitura:** `note_readable(...)`/`can_read_note(id)` é a única regra: autor sempre; os demais só se `visibility <> 'private'`, a nota é de campanha, **o leitor participa agora**, **o autor também participa** e (`campaign` | `master` e leitor é o mestre | `selected` e leitor está em `note_shares`). Mestre não lê nota privada de jogador.
- **Escrita:** só o autor insere, edita, exclui e compartilha. `owner_id`, `campaign_id`, `id`, `created_at` e `version` não são graváveis por clientes (privilégio de coluna) e um gatilho recusa troca de dono/campanha até para papéis privilegiados. Nota sem campanha só pode ser `private`.
- **Selecionados:** destinatário tem de participar da campanha; não vale para o próprio autor; máx. 50; mudar a visibilidade de `selected` apaga a lista (voltar a `selected` não a restaura).
- **Concorrência:** o servidor incrementa `version`; o cliente envia `update ... where id = ? and version = ?` e **0 linhas = conflito** (nada é sobrescrito em silêncio).
- **Quem sai ou é removido da campanha (política CONFIRMADA pelo responsável):** nada é apagado; o autor continua lendo e excluindo as suas notas, mas não as edita fora da campanha; o compartilhamento fica **inativo** (mestre e demais deixam de ver) e volta a valer se ele reentrar. *Alternativas:* (a) apagar as notas compartilhadas ao sair; (b) mantê-las visíveis à mesa; (c) converter para privadas na saída. A escolhida é a única que não apaga dados nem entrega dados de quem saiu.
- **Exclusão:** excluir campanha apaga suas notas (cascata); excluir a conta apaga as notas da conta. Mestre não exclui nem modera notas de jogadores.
- **Busca, links e histórico (próximas etapas):** qualquer tabela/consulta futura deve usar `can_read_note(id)` na própria política (ou `exists` sobre `notes`, já filtrado pela RLS), nunca guardar título/prévia em tabelas sem essa verificação. `can_read_note` devolve `false` igual para nota inexistente e inacessível.
- **Reversão:** `supabase/rollback/0004_notas_down.sql` (apaga todas as notas: faça backup antes).
- **Testes:** `supabase/notas.test.ts` (32 casos, várias contas e papéis).

## Revisão de segurança da 0004 (achados e decisões)

Corrigidos antes de qualquer aplicação:
1. **Oráculo no limite de compartilhamentos.** O gatilho de limite rodava ANTES da checagem de RLS; quem tentasse compartilhar uma nota alheia (conhecendo o UUID) receberia "limite" ou "RLS" conforme a nota tivesse ≥50 compartilhamentos. Agora é `AFTER INSERT`: forasteiros recebem sempre o erro genérico de RLS.
2. **Menos `SECURITY DEFINER`.** Os gatilhos passaram a `SECURITY INVOKER` (a RLS vale dentro deles). Restam 4 funções definer, todas com `search_path` vazio, sem acesso para `anon`: `is_note_owner`, `note_readable`, `can_read_note`, `can_share_note`.
3. **Linha de compartilhamento suspensa.** Um selecionado via o id de uma nota cujo autor já saiu da campanha. Agora só vê a própria linha enquanto a nota é legível para ele.
4. **Abuso de armazenamento.** Limite de 5000 notas por usuário (e 50 compartilhamentos por nota).

Verificado e sem vazamento: funções expostas por `/rpc` (`note_readable` com argumentos forjados nunca dá `true` a quem não participa nem a quem não é mestre; `can_share_note`/`is_note_owner` só dizem "sim" ao dono; `can_read_note` responde igual para nota inexistente e inacessível); erros idênticos para nota/campanha/destinatário inexistente ou alheio; predicados de usuário (`like`, divisão por zero, `count`, `max`, `exists`) não enxergam linhas barradas pela RLS; owner/campaign/version/created_at não graváveis; gatilho barra troca de dono mesmo com privilégio total; `anon` sem nenhum acesso.

Riscos residuais conhecidos (aceitos ou para etapas futuras):
- `note_readable` aceita argumentos arbitrários (necessário para valer em políticas e em `INSERT ... RETURNING`); só revela o que o chamador já sabe (a própria participação e papel).
- Quem foi removido e volta por convite recupera acesso às notas `campaign`/`selected` ainda existentes (coerente com a política de reentrada).
- Mensagens de erro de `CHECK`/FK podem exibir a linha que o PRÓPRIO usuário tentou gravar (dado dele).
- **Não** adicionar `notes`/`note_shares` à publicação do Realtime sem nova revisão.
- Links, busca e histórico (Etapa C) devem usar `can_read_note` nas próprias políticas; nunca armazenar título/prévia fora de tabelas protegidas.

## Evolução planejada (decisão D3, 19/11/2026) — NÃO implementada

Decidido: sistema único de anotações do usuário; **vínculos opcionais e múltiplos** (personagens, campanhas, NPCs, locais, encontros…) que **não transferem propriedade nem compartilham**; compartilhar é ação explícita; autor mantém acesso e edição ao sair da campanha ou quando o personagem morre/é trocado/excluído. A proposta anterior de mudar `campaign_id` de `NULL` para uma campanha foi **rejeitada**.

Impacto sobre a `0004` (detalhes em `PLANEJAMENTO-V2.md` §4.4): hoje `campaign_id` (único e imutável) faz o papel de origem, de público e de pré-condição de escrita, e a nota pessoal não pode ser compartilhada. Para D3 será preciso, em migração futura: separar **audiências** (por campanha, com escopo e destinatários) de `campaign_id` (que fica como origem informativa); criar `record_links` (sem efeito de acesso, legíveis só se `can_read_note(nota)`); e **permitir que o autor edite as próprias notas mesmo fora da campanha** (hoje o `with check` de `notes_update` exige participação — comportamento que D3 muda). O que vale **hoje**: mestre não lê nota privada; compartilhamento suspenso enquanto o autor está fora; vínculos ainda não existem.

## 5. Proposta `0005_notas_conteudo` — NÃO aplicada
Primeira migração de persistência do Planejamento (detalhes e decisões em `docs/PROPOSTA-PERSISTENCIA-PLANEJAMENTO.md`; numeração em `supabase/migrations/LEIA-ME.md`). **Proposta para aprovação; não foi executada no Supabase hospedado.** Aditiva: acrescenta a `notes` as colunas `kind` (`note` genérico, `page` da Enciclopédia e `scene`, `npc`, `location`, `faction`, `event`, `diary`), `content jsonb` (array de blocos, até 500 000 bytes, sem HTML), `content_schema`, `deleted_at` e `deleted_batch`; mantém `body` compatível (derivado do conteúdo no servidor quando há `content`).
- **Leitura e escrita não mudam:** `note_readable`, `can_read_note` e as políticas RLS permanecem; planejamento privado continua só do autor. **Nenhuma função `SECURITY DEFINER` nova** (o gatilho e `save_note_content` são `SECURITY INVOKER`).
- **Conteúdo validado no banco:** array de objetos com `type`; até 5 000 blocos e 20 níveis; `href` só `http(s)`, `mailto:` e `compendio:`; `url` (arquivos/imagens) só referência de Storage da **própria** campanha; chaves `src`, `srcset`, `poster`, `action` e `formaction` recusadas.
- **Lixeira sem brecha de compartilhamento:** excluir força `private` e apaga destinatários; restaurar volta **sempre privada**; nota na lixeira não é editada. Compartilhar de novo é ação separada.
- **Conflito explícito:** `save_note_content(id, versão, conteúdo, esquema, título)` responde `conflito_de_versao` (e `nota_nao_encontrada`, idêntico para inexistente ou alheia).
- Os **32 testes** da 0004 viram regressão; dois testes de auditoria foram atualizados para a presença da 0005 (reversão 0005→0004 e a nova função executável por `authenticated`). Novos: `supabase/notas-conteudo.test.ts` (26 casos).

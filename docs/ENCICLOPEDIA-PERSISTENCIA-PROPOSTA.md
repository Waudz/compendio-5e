# Enciclopédia — especificação de persistência para revisão (NÃO aplicada)

Status: **proposta**, não é migração executável. O PR #75 só implementa contratos de domínio; a criação de tabelas e RLS dependerá de inspeção do esquema de campanhas atual, alinhamento com PR #74 e autorização para aplicar migrações.

## Estrutura proposta

### encyclopedia_entries
- `id uuid primary key`
- `campaign_id uuid not null`, FK para `public.campaigns(id)`
- `kind text not null`, CHECK `creature | character | place | organization | knowledge`
- `name text not null`, `summary text not null default ''`, `public_description text not null default ''`
- `visibility text not null default 'hidden'`, CHECK `hidden | summary | full`
- `deleted_at timestamptz null`, `deleted_by uuid null`
- `created_at timestamptz not null default now()`, `updated_at timestamptz not null default now()`

**Atenção:** não colocar `master_notes` nem `mechanics` nesta tabela compartilhada, pois um SELECT com RLS concede acesso a todas as colunas autorizadas pela GRANT. Criar tabelas separadas para campos privados e referências mecânicas, com políticas próprias.

### encyclopedia_master_details
- `entry_id uuid primary key`, FK para entrada
- `master_notes text not null default ''`
- `mechanics_link jsonb null`, com validação de tipo, origem, revisão e destino no serviço
- SELECT/INSERT/UPDATE/DELETE apenas para o mestre da campanha, verificado no servidor

### encyclopedia_character_history
- `id uuid primary key`, `entry_id uuid not null`, `campaign_id uuid not null`
- `event_kind text not null`, `previous_value text null`, `next_value text null`
- `created_at timestamptz not null default now()`
- História narrativa do mestre separada de ficha, identidade pública e notas pessoais

## Regras de segurança obrigatórias

1. Ativar RLS em **todas** as tabelas; revogar privilégios públicos e conceder apenas operações necessárias.
2. Derivar `auth.uid()`, papel de mestre e participação **atuais** das tabelas do servidor. Nunca confiar em `actorIsMaster`, `role` ou `isActiveMember` enviados pelo cliente.
3. Para jogador, SELECT somente de entradas ativas, descobertas e pertencentes à campanha da qual participa. Entradas `hidden` e lixeira não podem aparecer em listagem, busca, contagem, Realtime, imagens nem endpoints auxiliares.
4. Para mestre, permitir leitura/escrita apenas da própria campanha. A autorização de INSERT/UPDATE deve ter `WITH CHECK`, e UPDATE também requer SELECT.
5. Campos de notas do mestre e referências mecânicas não devem ser acessíveis por SELECT de jogador, mesmo quando `visibility='full'`. RLS é **por linha**, não por coluna; a projeção pública precisa ser implementada com colunas isoladas, RPC auditada ou view `security_invoker` com grants apropriados.
6. Alterar descoberta e lixeira deve ser uma transação autorizada; restauração preserva descoberta, mas não concede acesso à ficha vinculada.
7. Não configurar cascata que apague notas privadas ou fichas canônicas ao apagar registro narrativo. Exclusão definitiva somente após confirmação explícita e checagem do servidor; sem limpeza por tempo.
8. Conferir índices por `campaign_id, visibility, deleted_at` e ordenação/paginação determinística; o filtro deve ocorrer no banco antes de `count` e `limit`.
9. Não adicionar tabelas à publicação do Realtime sem revisão específica de políticas e payloads.
10. Criar testes multiusuário no Postgres: mestre da campanha A, mestre da B, jogador ativo, ex-jogador, anônimo; testar `SELECT`, `INSERT`, `UPDATE`, `DELETE`, contagens, buscas, RPC, e ausência de vazamento de `master_notes`.

## Dependências e bloqueios

- Verificar nomes reais e políticas existentes de `campaigns`, `campaign_members`, `is_master` e `is_member` antes de escrever SQL.
- Reconciliar o vínculo de NPCs com o modelo de catálogo canônico que Claude entregará no PR #74.
- Criar migração via CLI do projeto, com nome gerado pela ferramenta e rollback testado; não inventar numeração ou aplicar em produção.
- Não publicar até testes de segurança e revisão do usuário.

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

## Revisão de integração após autorização das migrações — 21/11/2026

**Estado confirmado:** a migração remota `character_sheets_private_foundation` existe e a tabela `character_sheets` permanece sem GRANT de API. O Claude é responsável pela integração da ficha; esta frente não deve criar tabela concorrente, armazenar ficha em `encyclopedia_entries` ou duplicar a identidade pública.

**Bloqueios identificados nos três rascunhos SQL desta frente (não executar):**

1. `ENCICLOPEDIA-LEITURA-RPC-RASCUNHO.sql` e `ENCICLOPEDIA-LIXEIRA-RPC-RASCUNHO.sql` criam funções `SECURITY DEFINER` no schema exposto `public`. A concessão explícita a `authenticated` não substitui uma revisão do proprietário, do bypass de RLS e dos testes multiusuário. Preferir operações `SECURITY INVOKER` com tabelas/projeções segregadas; se um definer for indispensável, movê-lo para schema não exposto e revisar um gateway estritamente autorizado.
2. `ENCICLOPEDIA-SQL-RASCUNHO.sql` concede SELECT da tabela base somente ao mestre. Isso é seguro como bloqueio provisório, mas a RPC de leitura pública não pode ser simplesmente trocada por invoker sem redesenhar a projeção: o jogador não teria SELECT. Nunca liberar SELECT direto da tabela base ao jogador enquanto `summary` puder ocultar `public_description`.
3. A especificação nomeia `encyclopedia_character_history`, mas o SQL cria `encyclopedia_history`. Padronizar `encyclopedia_history` antes da migração.
4. O domínio possui níveis `hidden|summary|full`; a experiência de produto prevê compartilhamento seletivo de nome, descrição, imagem e mecânicas. Formalizar a projeção e seu armazenamento antes de criar grants ou endpoints. Não usar `visibility='full'` como autorização para expor ficha privada.
5. A busca SQL atual não é insensível a acentos como a busca do domínio. Alinhar sem expor resultados ocultos em filtros, contagens, paginação ou Realtime.
6. Não há implementação segura de exclusão definitiva com preservação/auditoria de histórico. Manter DELETE negado até decisão explícita; lixeira e restauração devem preservar dados.

**Ordem de execução:** (a) concluir contrato de identidade pública com o Claude; (b) definir esquema de projeção segregada, RLS, grants e operações de descoberta/lixeira; (c) criar migrações incrementais e testes PostgreSQL reais com mestre, jogador, ex-membro, outra campanha e anônimo; (d) executar apenas migrações revisadas, verificar advisors e consultar os grants; (e) conectar interface e testes E2E. Nenhuma migração da Enciclopédia está aplicada nesta etapa.

## Projeção pública segregada — proposta em revisão

Arquivo: [`ENCICLOPEDIA-PROJECAO-PUBLICA-RASCUNHO.sql`](./ENCICLOPEDIA-PROJECAO-PUBLICA-RASCUNHO.sql). O rascunho de RPC pública `SECURITY DEFINER` foi explicitamente marcado como **substituído**; **nenhum dos dois deve ser executado ainda**.

A proposta introduz `encyclopedia_publications` com apenas `entry_id, campaign_id, kind, name, summary, public_description, visibility, updated_at`. `visibility` só admite `summary|full`, e a CHECK obriga `public_description=''` em `summary`. A tabela tem RLS e SELECT apenas para membros ativos da campanha, usando `public.is_member`. Não há GRANT de INSERT/UPDATE/DELETE para clientes. Ela não contém notas privadas, mecânicas nem dados da ficha.

**Risco bloqueador:** a publicação precisa ser sincronizada **na mesma transação** que a alteração da entrada original. Ao ocultar, mover à lixeira, excluir ou alterar campanha, remover a projeção imediatamente; ao restaurar, republicar somente se a descoberta anterior permitir. Até existir essa escrita transacional com validação de mestre no servidor, a proposta não é publicável. Também é necessário decidir se a visibilidade de nome, imagem e mecânicas será mais granular que `hidden|summary|full`, testar papéis reais, contagens, busca, cache e Realtime e alinhar a identidade pública do criador com Claude. O histórico e a exclusão permanente continuam fora desta migração.

# Alpha — persistência remota de combates (preparação)

**Estado:** adaptador `src/combateRemoto.ts` criado, ainda não conectado às telas nem habilitado. Nenhuma tabela criada, nenhum dado migrado.

## Auditoria em 22/11/2026
No projeto Supabase `compendio-5e`, as tabelas `campaigns` e `campaign_members` já existem, com RLS habilitada. Não há tabela de combate/encontros. Não modificar o projeto distinto `rastreador-dnd`.

## Contrato para o banco
- Uma linha por campanha em `campaign_combats` com `campaign_id uuid` como chave primária referenciando `campaigns(id)`, `state jsonb not null`, `version bigint not null check (version >= 1)` e timestamps.
- RLS ativada e permissões de leitura, inserção e atualização **somente** para membro com `role = 'mestre'` da mesma campanha. Proibir DELETE na API para evitar perdas acidentais.
- Checar a participação no banco a cada operação, não confiar no papel armazenado no navegador. Sem acesso anônimo.
- Atualizações condicionadas a `campaign_id` e `version`; zero linhas alteradas não significa gravação bem-sucedida.
- Antes de habilitar: teste RLS com mestre, jogador, mestre de outra campanha e usuário sem vínculo; validar permissões da Data API e conflitos de duas sessões.

## Integração pendente
1. Criar migração formal via CLI Supabase em ambiente de desenvolvimento, revisar e testar antes de solicitar autorização para produção.
2. Conectar telas à API **somente após** a tabela/RLS existirem; não substituir localStorage silenciosamente.
3. Definir importação explícita de rascunhos locais sem sobrescrever registros remotos.
4. Garantir sincronização de PV com fichas sem fontes concorrentes e testar recuperação de falhas.
5. Rodar build, Vitest, testes SQL/RLS e E2E em duas sessões reais.

**O adaptador não garante segurança sozinho:** toda autorização depende de políticas RLS corretas e validadas. Não interpretar ausência de linha como prova de permissão.

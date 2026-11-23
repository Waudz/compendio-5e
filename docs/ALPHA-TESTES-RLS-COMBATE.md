# Verificação de RLS — combates (ambiente isolado)

**Não executar o rascunho SQL em produção.** O arquivo `docs/sql/alpha-campaign-combats-DRAFT.sql` não é uma migração aplicada.

## Pré-requisitos
- Ambiente de desenvolvimento com campanhas A e B; contas separadas para mestre A, jogador A, mestre B e usuário sem vínculo.
- Aplicar uma migração oficial criada via CLI, com revisão e rollback planejado.
- Testar usando clientes Supabase autenticados com JWT real de cada conta, **nunca** usando service_role (ignora RLS).
- Conferir `pg_policies`, grants e se a tabela está exposta na Data API.

## Matriz obrigatória

| Identidade | SELECT A | INSERT A | UPDATE A | DELETE A |
|---|---|---|---|---|
| Mestre A | permitido | permitido | permitido | negado |
| Jogador A | sem linhas | negado | sem linhas | negado |
| Mestre B | sem linhas | negado | sem linhas | negado |
| Não membro | sem linhas | negado | sem linhas | negado |
| Anônimo | negado | negado | negado | negado |

Repetir os testes com a campanha B. Verificar também que um mestre A não pode alterar `campaign_id` nem `created_at` via UPDATE e que um jogador não pode ler o JSON com REST direto.

## Concorrência
1. Mestre A abre o combate em duas sessões: ambas recebem `version = 1`.
2. Sessão 1 faz UPDATE condicionado a `version = 1`, recebe `version = 2`.
3. Sessão 2 tenta UPDATE com `version = 1`, recebe zero linhas e **não** sobrescreve o estado.
4. Recarregar e resolver conflito antes de nova gravação.
5. Testar INSERT simultâneo da primeira linha: apenas um vence a chave primária; o outro recebe conflito.
6. Desconectar rede e confirmar que a interface não informa sucesso antes da confirmação do servidor.

## Verificações de preservação
- Nenhuma tabela existente é truncada, renomeada ou atualizada pelo rascunho.
- O combate local não é importado automaticamente.
- Excluir um encontro não exclui fichas nem altera PV; a sincronização futura precisa de decisão própria.
- Verificar isolamento visual ao trocar usuário e campanha, inclusive durante carregamento.
- Executar `npm run build`, testes Vitest e E2E antes de aprovar integração.

## Resultado anterior (histórico)
A consulta **somente leitura** ao projeto `compendio-5e` confirmou que `public.is_master(uuid)` já existe e verifica `campaign_members.role = 'mestre'` contra `auth.uid()`. A tabela `campaign_combats` ainda não existe. **Nenhum teste de RLS da nova tabela foi executado**, porque não houve migração.

## Etapa executada — 22/11/2026

Branch `test/alpha-rls-combate`, dependente do PR #107. `supabase/combates-rls.test.ts` executa o rascunho em PGlite, com papéis anon/authenticated, auth.uid simulado e as funções reais das migrações 0001–0003. **31 testes aprovados** (PostgreSQL isolado; não JWT/REST/Realtime hospedados).

O rascunho anterior falhou em sete casos: CHECK aceitava campos ausentes por resultado NULL, rodada zero/fracionária era permitida e a versão podia permanecer igual, saltar ou exceder a precisão segura do cliente. Testes adicionados primeiro; falhas reproduzidas antes da correção.

Correções no rascunho:
- Campos obrigatórios combatentes/rodada/turno não passam por NULL implícito; rodada é inteira positiva e limitada à precisão segura do cliente.
- Versão inicial 1; UPDATE avança exatamente uma unidade, com trigger SECURITY INVOKER em schema privado e search_path vazio. O adaptador ainda deve filtrar versão esperada: o trigger sozinho não evita sobrescrita por cliente que escolha ignorar o filtro.
- Timestamp de atualização calculado no servidor. INSERT/UPDATE permitem apenas colunas necessárias; cliente não altera timestamps nem a campanha por UPDATE.
- Políticas e grants verificados para mestre A/B, jogador, não membro e anônimo; contagem alheia não revela linhas; perda de vínculo bloqueia leitura/escrita sem apagar o combate. DELETE pelo cliente é negado.
- Duas gravações com a mesma versão inicial: segunda retorna zero linhas. Segunda criação conflita na chave primária. São requisições sequenciais que simulam versões concorrentes, não teste de carga simultânea.

A segunda fatia acrescenta validação do JSON no servidor com função imutável SECURITY INVOKER no schema privado: IDs únicos e não vazios (até 128 caracteres), nomes não vazios (até 200), lado permitido, iniciativa numérica dentro da precisão segura, PV inteiro entre zero e o máximo, turno referenciando combatente existente (ou null em combate vazio). Limites técnicos de proteção: 1.000 combatentes e 1 MiB de JSON; não afetam dados existentes, pois a tabela ainda não existe e nenhuma importação foi ativada. Os dez novos testes incluem casos válidos com empate, iniciativa decimal e PV zero.

**Limites antes de promover para migração:** testar permissões e exposição real em projeto de desenvolvimento com JWTs e REST; planejar rollback preservando dados; gerar a migração oficial via CLI. O arquivo continua sendo rascunho e não foi aplicado em produção. Realtime e importação local permanecem desativados/não implementados.


Validação local consolidada: build aprovado; primeira execução completa com 21 testes SQL resultou em 107 arquivos / 1361 testes aprovados. Após os dez testes adicionais de conteúdo, suíte SQL: 31 aprovados; consultar CI para a validação consolidada final. Nenhuma migração oficial gerada nem aplicada.

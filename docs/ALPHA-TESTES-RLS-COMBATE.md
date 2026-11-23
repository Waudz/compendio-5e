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

## Resultado até agora
A consulta **somente leitura** ao projeto `compendio-5e` confirmou que `public.is_master(uuid)` já existe e verifica `campaign_members.role = 'mestre'` contra `auth.uid()`. A tabela `campaign_combats` ainda não existe. **Nenhum teste de RLS da nova tabela foi executado**, porque não houve migração.

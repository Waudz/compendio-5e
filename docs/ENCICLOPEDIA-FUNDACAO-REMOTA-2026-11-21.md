# Fundação fechada da Enciclopédia — aplicada em 21/11/2026

**Projeto:** `gwcttjlxzelzjhbuitmi` (Compêndio 5e).
**Migração remota:** `encyclopedia_private_foundation_closed`.
**Autorização:** usuário autorizou mudanças SQL em 21/11/2026.
**Estado:** aplicada, sem liberar acesso ao aplicativo.

## Objetos criados

- `public.encyclopedia_entries` — entradas, campanha, visibilidade e lixeira.
- `public.encyclopedia_master_details` — notas secretas e vínculos mecânicos.
- `public.encyclopedia_history` — histórico narrativo.
- `public.encyclopedia_publications` — projeção com campos públicos, ainda fechada.
- Índices `encyclopedia_entries_active_idx`, `encyclopedia_history_entry_idx` e `encyclopedia_publications_list_idx`.

## Segurança confirmada no banco

As quatro tabelas têm RLS habilitada, **zero policies** e **nenhum SELECT para `anon` ou `authenticated`**. Também foram revogados os demais privilégios de tabela para esses papéis. A migração não criou funções, triggers nem entradas de dados; não alterou `notes` ou `character_sheets`.

O advisor de segurança indica quatro avisos informativos `rls_enabled_no_policy`, **esperados nesta fase fechada**. Os avisos preexistentes de funções `SECURITY DEFINER` em `public` continuam pendentes e não foram introduzidos por esta migração.

## Próxima fase (não aplicada)

Revisar a sincronização da projeção, guarda da lixeira, grants e policies. Validar operações como mestre/jogador/anônimo, lixeira, restauração, rollback, ausência de vazamento por contagens e busca, antes de liberar a API. Não executar os rascunhos SQL anteriores diretamente: eles contêm `CREATE TABLE` para objetos que agora existem. Produzir migração incremental específica.

**Não confundir** esta fundação com a migração 0008 das fichas guiadas do Claude (#80), que segue separada e pendente de revisão.

# Migrações do Supabase — livro-razão de numeração

**Regras:** o número segue a **ordem de aplicação**; é **único e nunca reaproveitado**, mesmo se a migração for abandonada; cada migração tem rollback em `supabase/rollback/` e testes PGlite (`supabase/*.test.ts`); **nenhuma é aplicada ao Supabase hospedado sem autorização expressa do responsável** (um PR de migração nunca autoriza aplicar). `tests/migracoes.test.ts` verifica numeração sem repetição nem buracos e a existência do rollback.

| Nº | Conteúdo | Estado | Observação |
|---|---|---|---|
| `0001` | campanhas, perfis, membros, convites | **aplicada** | |
| `0002` | backfill de perfis | **aplicada** | |
| `0003` | mestre único | **aplicada** | |
| `0004` | notas e compartilhamento (RLS) | **aplicada** (19/11/2026) | |
| `0005` | **conteúdo estruturado das notas**: `kind`, `content jsonb`, `content_schema`, exclusão lógica em lote, `save_note_content` | **PROPOSTA — não aplicada** | PR da migração; reversão em `supabase/rollback/0005_notas_conteudo_down.sql` |
| `0006` | sessões, colunas e cartões do Planejamento | reservada (não implementada) | depende da 0005 |
| `0007` | registros rápidos e pendências | reservada (não implementada) | depende da 0006 |
| `0008` | vínculos entre páginas (`note_links`, derivada do conteúdo) | reservada (não implementada) | depende da 0005 |
| `0009` | audiências de notas (compartilhamento granular, D3) | reservada (não implementada) | **antiga "0005"**: reescreve a regra de leitura; manter a assinatura de `can_read_note` |
| `0010`+ | encontros e combates | reservada (não implementada) | com o módulo Encontros |

> A reserva anterior de "0005" para audiências/vínculos de notas (documentos de 19/11/2026) foi **substituída** pela numeração acima: o Planejamento não depende das audiências e é aplicado antes.

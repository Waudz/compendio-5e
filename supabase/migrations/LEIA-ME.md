# Migrações do Supabase — livro-razão de numeração

**Regras:** o número segue a **ordem de aplicação**; é **único e nunca reaproveitado**, mesmo se a migração for abandonada; cada migração tem rollback em `supabase/rollback/` e testes PGlite (`supabase/*.test.ts`); **nenhuma é aplicada ao Supabase hospedado sem autorização expressa do responsável** (um PR de migração nunca autoriza aplicar). `tests/migracoes.test.ts` verifica numeração sem repetição nem buracos e a existência do rollback.

| Nº | Conteúdo | Estado | Observação |
|---|---|---|---|
| `0001` | campanhas, perfis, membros, convites | **aplicada** | |
| `0002` | backfill de perfis | **aplicada** | |
| `0003` | mestre único | **aplicada** | |
| `0004` | notas e compartilhamento (RLS) | **aplicada** (19/11/2026) | |
| `0005` | **conteúdo estruturado das notas**: `kind`, `content jsonb`, `content_schema`, exclusão lógica em lote, `save_note_content` | **PROPOSTA — não aplicada** | PR da migração; reversão em `supabase/rollback/0005_notas_conteudo_down.sql` |
| `0006` | **registros de campanha**: `notes.meta`, tipos `board` e `character`, regras de papel (diário/cena/quadro só do mestre), planejamento sempre privado, capa (`campaigns.cover_path`) e bucket `campaign-assets` com políticas | **PROPOSTA — não aplicada** | depende da 0005; reversão (destrutiva, com trava) em `supabase/rollback/0006_registros_capa_personagens_down.sql`; testes em `supabase/registros.test.ts` |
| `0007` | **`character_sheets_private_foundation`**: tabela `public.character_sheets` (ficha privada do personagem guiado), RLS, privilégios de API **revogados** (fail closed) | **aplicada** (21/11/2026, remoto `character_sheets_private_foundation`) | o arquivo do repositório **reconstrói** a migração remota pela descrição (o SQL original não estava versionado): conferir com o original. Reversão guardada em `supabase/rollback/0007_character_sheets_foundation_down.sql` |
| `0008` | **persistência segura das fichas**: políticas definitivas, revisão e campos imutáveis por gatilho, vínculo composto com `notes`, meta público só com identidade, `create_guided_character`/`save_guided_character` (SECURITY INVOKER), privilégios mínimos | **PROPOSTA — não aplicada** | exige revisão e autorização; testes em `supabase/character-sheets.test.ts` (PGlite); reversão em `supabase/rollback/0008_character_sheets_persistencia_down.sql` (não apaga dados) |
| `0009` | registros rápidos e pendências do Planejamento | reservada (não implementada) | depende da 0006; **antiga reserva "0007"** |
| `0010` | vínculos entre páginas (`note_links`, derivada do conteúdo) | reservada (não implementada) | depende da 0005; **antiga reserva "0008"** |
| `0011` | audiências de notas (compartilhamento granular, D3) | reservada (não implementada) | **antiga reserva "0009"** (e antes "0005"): reescreve a regra de leitura; manter a assinatura de `can_read_note` |
| `0012`+ | encontros e combates | reservada (não implementada) | com o módulo Encontros; **antiga reserva "0010+"** |


> A reserva anterior de "0005" para audiências/vínculos de notas (documentos de 19/11/2026) foi **substituída** pela numeração acima: o Planejamento não depende das audiências e é aplicado antes.

> **Numeração de 21/11/2026:** a numeração segue a **ordem de aplicação** (e o teste `rls.test.ts` exige sequência sem lacunas). As fichas (`character_sheets`) foram o 7º conjunto aplicado ao remoto, então ficam com `0007` (aplicada) e `0008` (proposta). As **reservas ainda não implementadas** foram renumeradas (`0007`→`0009`, `0008`→`0010`, `0009`→`0011`, `0010+`→`0012+`); documentos anteriores que citam "0007–0010" falam dessas reservas, não das migrações de fichas. No remoto, as migrações de notas foram aplicadas com nomes por data (`notas_conteudo` = 0005 e `registros_capa_personagens` = 0006): **não reaplicar** esses arquivos; o remoto é a fonte do que já foi executado.

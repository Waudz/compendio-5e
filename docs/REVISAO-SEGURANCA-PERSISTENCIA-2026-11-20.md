# Revisão de segurança da persistência — 20/11/2026

> Documento de revisão; **nenhuma migração ou RPC foi aplicada** ao Supabase. Branch #75. Não confundir proposta de SQL com funcionalidade implantada.

## Estado confirmado (consultas somente leitura)

Projeto `compendio-5e` (`gwcttjlxzelzjhbuitmi`).

- `campaign_members`: `members_select` usa `is_member(campaign_id)`; `members_delete` permite saída própria ou remoção por mestre, exceto vínculo do criador. `is_master` exige `role='mestre'`; `is_member` verifica participação atual por `auth.uid()`.
- `notes`: `notes_select` usa `note_readable(id,owner_id,campaign_id,visibility)`; `notes_insert` exige proprietário e campanha válida; `notes_update` e `notes_delete` exigem proprietário. **Não usar a tabela `notes` ou `notes.meta` para guardar ficha privada de personagem em registro compartilhado.**
- Criador da branch #78 usa armazenamento local experimental, não sincronizado; o adaptador não equivale a controle de acesso.

## Fronteiras de dados obrigatórias

| Conteúdo | Quem lê | Armazenamento proposto |
|---|---|---|
| Ficha, atributos, PV, inventário, progressão | Proprietário/controlador e mestre da campanha, com vínculo atual | `character_sheets` com RLS própria |
| Identidade pública configurada | Participantes da campanha, somente campos autorizados | Projeção explicitamente pública, separada da ficha |
| Anotações privadas | Somente proprietário | `notes` privadas; não misturar com histórico |
| Enciclopédia oculta e detalhes do mestre | Mestre da campanha | `encyclopedia_entries` e `encyclopedia_master_details` protegidas |
| Enciclopédia descoberta | Participantes atuais, apenas projeção autorizada por visibilidade | RPC de leitura pública ou interface server-side equivalente |
| Histórico narrativo | Mestre, até decisão explícita de publicação de eventos | `encyclopedia_history` append-only |

**Regra crítica:** não basta filtrar campos no React. O backend precisa impedir SELECT/RPC/Realtime de retornar campos privados a jogadores não autorizados.

## Bloqueadores dos rascunhos da Enciclopédia

1. `docs/ENCICLOPEDIA-LEITURA-RPC-RASCUNHO.sql` e `docs/ENCICLOPEDIA-LIXEIRA-RPC-RASCUNHO.sql` usam `SECURITY DEFINER` em `public`. O guia de segurança Supabase recomenda evitar funções privilegiadas em schema exposto e preferir `SECURITY INVOKER` quando possível. **Não implantar os rascunhos como estão**. Revisar arquitetura: função em schema não exposto, gateway controlado, ou SELECT com RLS e projeção que não vaze descrições de visibilidade `summary`. O controle de `EXECUTE` é necessário mas não substitui essa revisão.
2. A RPC de leitura filtra registros ocultos e excluídos e mascara `public_description` em `summary`, mas ainda precisa de testes reais de autorização, paginação, contagens, busca e Realtime.
3. A lixeira usa bloqueio de linha e deriva `deleted_by` de `auth.uid()`, porém falta teste de concorrência e trilha de auditoria da transição.
4. `ON DELETE RESTRICT` impede exclusão implícita do histórico; ainda falta fluxo explícito de exclusão definitiva.
5. Antes de qualquer migração: revisar owner, `search_path`, `GRANT`, políticas `USING`/`WITH CHECK`, exposição da Data API e advisors; testar anon, jogador, mestre, membro removido e usuário de outra campanha.

## Sequência proposta de integração

1. Validar #78 (criador e catálogo na navegação) e #75 (domínio) separadamente; não mesclar sem revisão.
2. Definir `character_sheets` e identidade pública com RLS de propriedade e vínculo atual, revisão otimista e testes PGlite/integração em ambiente isolado.
3. Revisar RPCs da Enciclopédia segundo checklist acima e validar em banco de testes; somente depois solicitar autorização para migrações.
4. Integrar na ordem de dependências: #74 → #78 e #74 → #75; #76 → #77. Reexecutar testes E2E sobre a interface integrada.
5. Publicar apenas após validação de autenticação, privacidade, RLS e Realtime.

## Fontes de validação

- Definições e políticas inspecionadas diretamente no banco via consultas SQL somente leitura em 20/11/2026.
- Skill Supabase, seção *Security checklist*: `SECURITY DEFINER` pode contornar RLS; evitar schema exposto; `UPDATE` requer `SELECT`; `TO authenticated` não substitui autorização por linha.
- PR #78: https://github.com/Waudz/compendio-5e/pull/78
- PR #75: https://github.com/Waudz/compendio-5e/pull/75

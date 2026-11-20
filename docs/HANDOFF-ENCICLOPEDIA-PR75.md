# Handoff — Enciclopédia / PR #75 (20/11/2026)

> Documento de continuidade para troca de contexto. **Ler antes de qualquer alteração**.
> Fonte: branch `feat/encyclopedia-visibility-contract`, PR https://github.com/Waudz/compendio-5e/pull/75.
> **Não representa código publicado, migração aplicada ou funcionalidade integrada à UI.**

## Organização de trabalho e isolamento

- **Claude:** PR #74, branch `docs/auditoria-catalogos-personagem-2014`, criador/ficha/inventário/catálogo; o PR #75 foi criado tendo essa branch como base. **Não editar a branch do Claude.**
- **ChatGPT:** apenas branch `feat/encyclopedia-visibility-contract`, PR #75, contratos de domínio, Enciclopédia, segurança e propostas de persistência. **Não fazer merge, deploy nem migrações sem autorização.**
- **Codex:** branch independente `test/playwright-e2e`, testes E2E/responsividade. **Não editar a branch do Codex.**
- A branch base do PR #75 pode avançar enquanto Claude trabalha; verificar base/head/diff antes de integrar ou rebasear.
- Ao redigir próximos prompts para Claude ou Codex, **sempre pedir no fim um resumo completo**: funcionalidades, arquivos, commits, PR, testes, erros, pendências e conflitos, para o usuário encaminhar ao ChatGPT.
- Usuário vai dizer apenas “continue” até surgir uma decisão realmente necessária; não perguntar sobre decisões já estabelecidas.

## Regras de produto já decididas

- Navegação mestre: Início, Anotações, Iniciativa, Compêndio, Menu. Jogador: Início, Anotações, Ficha (inventário dentro), Compêndio, Menu.
- Iniciativa é **exclusiva do mestre**, inclusive autorização de servidor e Realtime.
- Mestre edita integralmente ficha de personagem vinculado à campanha, pode criar ficha para jogador, transferir controle e itens; notas pessoais do jogador não são compartilhadas.
- Notas pertencem ao usuário, persistem após sair da campanha, devem continuar editáveis, com contexto mestre/jogador separado.
- Enciclopédia: Criaturas, Personagens, Lugares, Organizações, Conhecimentos. Guarda/commoner genérico é criatura; NPC nomeado é personagem narrativo; NPC não entra na aba de fichas a menos que uma ficha completa seja criada.
- NPC pode referenciar criatura canônica/ficha existente sem duplicar estatísticas. Mecânicas e notas do mestre são privadas.
- Descoberta `hidden|summary|full` controlada explicitamente pelo mestre, `hidden` por padrão; entrar em combate não revela automaticamente.
- Cartão público de personagem usa somente campos públicos explícitos, nunca nível/PV/inventário/notas privadas.
- Estados narrativos `active|dead|retired|inactive`; personagens que saem da campanha podem ficar inativos, preservando identidade/histórico.
- Lixeira sem expiração, restauração possível, exclusão definitiva manual com confirmação.
- Regras D&D 5e **2014**, referências canônicas versionadas e uso de fontes com licença compatível.

## Código do PR #75 (módulos isolados, não conectados ao Supabase)

Todos sob `src/rules/`, com testes `.test.ts` correspondentes:
- `encyclopedia-visibility.ts`: projeção pública por allowlist, autorização de domínio por campanha/participação; **não confiar no actor enviado pelo navegador**.
- `encyclopedia-mechanics-link.ts`: referências versionadas a criatura ou ficha existente, sem copiar mecânicas.
- `encyclopedia-discovery.ts`: descoberta explícita, reversível, oculta por padrão.
- `character-narrative-lifecycle.ts`: status e mudança de controlador com eventos imutáveis.
- `encyclopedia-trash.ts`: lixeira reversível, validação de confirmação para exclusão definitiva (não executa exclusão).
- `encyclopedia-query.ts`: filtros de campanha/visibilidade/lixeira antes de busca, contagem e paginação; busca ignora acentos, limita 200 caracteres e 1–100 itens/página.
- `encyclopedia-narrative-service.ts`: funções agregadoras puras.
- `encyclopedia-state.ts`: reducer imutável de comandos.
- Foram adicionados **41 casos de teste** até o commit `3cc55e8`, conforme contagem das adições; **não afirmar que passaram sem verificar CI**.
- Correção do TypeScript em `encyclopedia-narrative-service.ts` commit `aac8d3d`; correção de quebras de linha literais em `encyclopedia-query.ts` commit `6338f34`.

## Supabase: observação real, sem escrita

Projeto **`compendio-5e`**, ref `gwcttjlxzelzjhbuitmi`; **não confundir** com projeto legado `rastreador-dnd`.
Inspecionado em 20/11/2026 com consultas somente leitura:
- Tabelas `public.profiles`, `public.campaigns`, `public.campaign_members`, `public.campaign_invites`, `public.notes`, `public.note_shares`; todas com RLS ativada.
- `campaigns.id uuid`, `campaign_members.campaign_id uuid`, `campaign_members.user_id uuid`, `campaign_members.role text`.
- Funções existentes `public.is_master(cid uuid)` e `public.is_member(cid uuid)`; **revisar suas definições e comportamento antes de usar em SECURITY DEFINER**.
- Sete migrações registradas, última `20261119193620 registros_capa_personagens`.
- **Nenhuma tabela de Enciclopédia criada, nenhuma migração aplicada, nenhum dado alterado por este trabalho.**

Documentos de proposta, **não executáveis sem revisão**:
- `docs/ENCICLOPEDIA-PERSISTENCIA-PROPOSTA.md`: requisitos, modelo conceitual e RLS.
- `docs/ENCICLOPEDIA-SQL-RASCUNHO.sql`: DDL de tabelas, índices e políticas, propositalmente bloqueia SELECT do jogador e DELETE direto; **não executar**. Contém decisões pendentes de cascata, lixeira e autorização.
- `docs/ENCICLOPEDIA-LEITURA-RPC-RASCUNHO.sql`: RPC `SECURITY DEFINER` com projeção pública e checagem de participação, limites de busca; **não executar** antes de auditar proprietário, grants, políticas e testar com identidades reais. Busca SQL atualmente não remove acentos (diferente do domínio JS). Nenhuma exposição via Realtime foi autorizada.
- Há divergência de nome/modelo entre proposta (`encyclopedia_character_history`) e SQL (`encyclopedia_history`): **reconciliar antes de criar migração**.

## Situação do CI e próximo passo obrigatório

- A execução GitHub Actions do commit `3cc55e8` **falhou** por `TS1127 Invalid character` em `encyclopedia-query.ts`, decorrente de sequências `\\n` literais. Corrigido em `6338f34`.
- Commit mais recente ao criar este handoff: `6280947`, ajuste da RPC SQL para limitar pesquisa e tratar curingas literalmente. A execução desse commit estava **pending** na última consulta, **não confirmado verde**.
- **Primeiro:** consultar GitHub Actions do head atual do PR #75, ler logs completos se falhar, corrigir, aguardar CI verde. Evitar acrescentar funcionalidades com CI vermelho.
- **Depois:** auditar políticas atuais de Supabase somente leitura, revisar projeção segura de `summary` e `full`, definir operações transacionais de lixeira no servidor, documentar testes RLS. Não executar SQL nem fazer merge.
- Verificar se PR #74 evoluiu e se base de PR #75 continua adequada. Não modificar arquivos do Claude nem do Codex.
- Atualizar este handoff e `docs/ENCICLOPEDIA-VISIBILIDADE.md` a cada marco importante, com commit, CI, pendências e arquivos afetados.

## Atenções de segurança

RLS filtra linhas, não oculta colunas por si só. Não conceder SELECT da tabela de registros a jogadores se contiver `public_description` de entradas `summary`; usar projeção auditada. Nunca expor `master_notes`, `mechanics_link`, dados ocultos, lixeira ou contagens a jogadores. `auth.uid()`/papéis devem ser verificados no servidor. Não habilitar Realtime nas tabelas base sem revisão. Não usar SQL rascunho como migração pronta.

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


### Auditoria das funções de autorização (leitura em 20/11/2026)

Consultadas as definições reais via `pg_get_functiondef`, **sem alteração no banco**:
- `public.is_master(cid uuid)` é `STABLE SECURITY DEFINER SET search_path = ''`; retorna verdadeiro quando `campaign_members.campaign_id=cid`, `user_id=auth.uid()` e **`role='mestre'`**.
- `public.is_member(cid uuid)` é `STABLE SECURITY DEFINER SET search_path = ''`; retorna verdadeiro quando há vínculo de `campaign_members` com `user_id=auth.uid()`.
- **Diferença crítica:** o modelo de domínio TS usa `role:'master'`, mas o banco usa `role='mestre'`. Nunca comparar a string TS diretamente com o banco; adaptar na camada de integração. Não reescrever a função existente sem coordenação.
- `campaign_members` não possui coluna `active` nem `left_at` no esquema inspecionado; a participação atual é representada pela existência do vínculo. Revisar regra de saída/remoção de membro antes da migração.
- A RPC pública em rascunho usa `public.is_member` e não confia em `actorIsMaster` do navegador. Falta auditoria de privilégios de execução, dono e testes de sessão autenticada antes de implantação.

### Adaptação de papéis implementada (20/11/2026)

- `src/rules/encyclopedia-membership.ts` e `src/rules/encyclopedia-membership.test.ts`: mapeiam `mestre → master` e `jogador → player`, rejeitando sessão ausente, usuário divergente, campanha divergente e papel desconhecido. **É um adaptador puro, não um serviço de autenticação.** Somente aceitar linha de participação obtida sob autenticação/RLS; servidor continua sendo a autoridade.
- O CHECK real `campaign_members_role_check` foi verificado por SQL somente leitura: apenas `mestre` e `jogador`.
- Commits `f6ab5ba` e `d831e79`. Testes adicionados; validar no CI antes de declarar sucesso.
- Nenhum arquivo do Claude/Codex foi alterado, nenhuma tabela criada, nenhum deploy.

## Situação do CI e próximo passo obrigatório

- A execução GitHub Actions do commit `3cc55e8` **falhou** por `TS1127 Invalid character` em `encyclopedia-query.ts`, decorrente de sequências `\\n` literais. Corrigido em `6338f34`.
- Commit mais recente ao criar este handoff: `6280947`, ajuste da RPC SQL para limitar pesquisa e tratar curingas literalmente. A execução desse commit estava **pending** na última consulta, **não confirmado verde**.
- **Primeiro:** consultar GitHub Actions do head atual do PR #75, ler logs completos se falhar, corrigir, aguardar CI verde. Evitar acrescentar funcionalidades com CI vermelho.
- **Depois:** auditar políticas atuais de Supabase somente leitura, revisar projeção segura de `summary` e `full`, definir operações transacionais de lixeira no servidor, documentar testes RLS. Não executar SQL nem fazer merge.
- Verificar se PR #74 evoluiu e se base de PR #75 continua adequada. Não modificar arquivos do Claude nem do Codex.
- Atualizar este handoff e `docs/ENCICLOPEDIA-VISIBILIDADE.md` a cada marco importante, com commit, CI, pendências e arquivos afetados.

## Atenções de segurança

RLS filtra linhas, não oculta colunas por si só. Não conceder SELECT da tabela de registros a jogadores se contiver `public_description` de entradas `summary`; usar projeção auditada. Nunca expor `master_notes`, `mechanics_link`, dados ocultos, lixeira ou contagens a jogadores. `auth.uid()`/papéis devem ser verificados no servidor. Não habilitar Realtime nas tabelas base sem revisão. Não usar SQL rascunho como migração pronta.

## Entrega do Codex — PR #76 (20/11/2026)

- PR https://github.com/Waudz/compendio-5e/pull/76, branch `test/playwright-e2e`, base **`main`**; commit conferido `33eab06ed1cbbfd7c5adfbe088a884c0c85419c3`; aberto e **não integrado**.
- GitHub Actions conferido diretamente: `E2E e responsividade` execução `44823453228` **success**; `Validar projeto` execução `44823453291` **success**.
- Relatório do Codex: **36 testes E2E aprovados** em Chromium, quatro viewports (1440×900, 1024×768, 390×844, 320×740), além do limite 700/701 px; **560 testes Vitest**, build e tipos aprovados. Capturas/artefatos no workflow, retenção de sete dias.
- Arquivos afetados: `.github/workflows/e2e.yml`, `.gitignore`, `README.md`, `e2e/environment.ts`, `e2e/fixtures.ts`, `e2e/loading.spec.ts`, `e2e/navigation.spec.ts`, `e2e/responsive.spec.ts`, `e2e/tsconfig.json`, `package-lock.json`, `package.json`, `playwright.config.ts`, `vite.config.ts`. **Nenhum arquivo em `src/` foi modificado no PR #76.**
- Segurança do harness: alvo fixo `http://127.0.0.1:4187/compendio-5e/`; Supabase URL/chave vazias; navegador bloqueia tráfego HTTP/WebSocket externo e service workers; contexto limpo por teste; servidor local não é reutilizado.
- Limitações explícitas: sem autenticação real, Supabase, RLS, Storage, Realtime, aparelhos físicos, Firefox/WebKit; execução local no Windows bloqueada pelo sandbox. Testa UI **da main atual**, inclusive placeholder de iniciativa; **não cobre PR #74 nem PR #75**.
- **Integração planejada:** não editar a branch do Codex. Ao integrar futuramente, reconciliar `README.md`, `vite.config.ts`, dependências e workflows; atualizar cenários E2E da UI final e criar testes multiusuário/RLS em ambiente seguro, antes de qualquer publicação. Não fazer merge automático sem autorização.

## CI recente de nosso PR #75

- GitHub Actions `Validar projeto` do commit `35aaab4b8dc16d306e0d8e56e21dda02b6adcb19`: execução `44823857671`, **concluída com sucesso** em 20/11/2026.
- Este resultado valida o código existente na branch naquele commit; **não** atesta uma migração Supabase nem integração à UI.

## Revisão de retenção e permissões do SQL (20/11/2026)

- Commit `d761eef`: no **rascunho** `docs/ENCICLOPEDIA-SQL-RASCUNHO.sql`, FKs de campanhas, detalhes e histórico passaram de `ON DELETE CASCADE` para `ON DELETE RESTRICT`, impedindo exclusões implícitas que contradizem a lixeira sem prazo.
- Ajustados privilégios do histórico: somente `SELECT, INSERT`, coerentes com a política append-only (antes havia GRANT excessivo sem políticas correspondentes).
- Corrigidas observações de revisão: exclusão direta de entradas **já estava revogada**; UPDATE de `deleted_at/deleted_by` **já estava fora** das colunas concedidas. Faltam RPCs seguras para mover/restaurar e procedimento explícito para exclusão definitiva com retenção do histórico.
- **Ainda é proposta, não migração.** Nenhuma tabela ou política foi aplicada ao Supabase.

## Lixeira: RPCs transacionais propostas (20/11/2026)

- Novo arquivo `docs/ENCICLOPEDIA-LIXEIRA-RPC-RASCUNHO.sql`, commit `9a5c8ff`: `public.encyclopedia_trash_entry(uuid)` e `public.encyclopedia_restore_entry(uuid)` como `SECURITY DEFINER`, `search_path=''`, acesso EXECUTE apenas para `authenticated`, verificação de `auth.uid()` e `public.is_master(campaign_id)` **na própria função**.
- Usa `SELECT ... FOR UPDATE` para serializar transições e `UPDATE ... WHERE deleted_at IS [NOT] NULL` para evitar mudanças repetidas; grava autor/timestamp somente no servidor; restauração limpa ambos.
- Operações retornam `false` para ausente/sem permissão/sem mudança, sem revelar existência do registro. **Não implementa exclusão definitiva** e não altera histórico.
- **Não foi aplicado ao Supabase**. Antes de promover a migração: testar transações concorrentes e RLS com identidades reais isoladas; auditar owner e EXECUTE; decidir estratégia de histórico/auditoria das transições e Realtime. Lixeira sem expiração permanece decisão do usuário.

## Entrega Claude PR #74 confirmada (20/11/2026)

- HEAD `3f5c41c745b0462540a569b7073a65adde0263f8`, PR #74 aberto em `docs/auditoria-catalogos-personagem-2014`, base `main`; 283 commits/95 arquivos alterados no momento da consulta.
- Relatório Claude: 578 itens SRD 2014 (237 mundanos, 341 mágicos) em `src/catalogue/`, validação Zod, nomes pt/en, script de conferência API, correção de três IDs de equipamento do Guerreiro, integração nos pilotos, 718 testes locais e CI `44821384241` aprovado. Catálogo e editor ainda são **pilotos**, não persistência/produção; itens mágicos não auditados externamente.
- `docs/CONTINUIDADE-DESENVOLVIMENTO.md` na branch #74 já contém decisões confirmadas sobre bestiário/discovery, recipientes comuns sem inventários aninhados, personagens ativos/inativos, transferência de controle e notas privadas. **Não reabrir essas decisões por padrão**.
- Prioridade arquitetural recomendada ao Claude: tornar fluxo vertical do Guerreiro utilizável na navegação real e com persistência segura antes de importar todos os catálogos; evitar aumentar indefinidamente o PR #74 e não fazer rebase destrutivo/merge automático.
- Atenção à sobreposição: `src/rules/public-character-encyclopedia.ts` do Claude projeta identidade pública; nossa `src/rules/encyclopedia-visibility.ts` e RPCs projetam entradas narrativas. Na integração, usar uma única fronteira de autorização no servidor, sem devolver ficha privada. Nossa branch #75 foi baseada na branch #74, mas precisa ser reconciliada com commits novos antes do merge.

## Gateway tipado da lixeira (20/11/2026)

- `src/rules/encyclopedia-trash-gateway.ts` (commit `8a750a9`) define um cliente RPC mínimo e `updateNarrativeTrash(client,'trash'|'restore',entryId)`; envia **somente** `p_entry_id`, sem aceitar papel/identidade/timestamp do cliente. Valida formato UUID e não expõe detalhes internos de erros.
- `src/rules/encyclopedia-trash-gateway.test.ts` (commit `7265750`) cobre chamada correta, restauração, negação/sem mudança, UUID inválido, erro do servidor e falha de rede. **Aguardar CI do novo HEAD** antes de afirmar aprovação.
- Ainda não há integração com UI ou Supabase ativo: RPCs são apenas rascunhos SQL. Quando autorizadas e testadas em ambiente isolado, conectar gateway ao cliente Supabase autenticado (nunca service role no navegador), atualizar estado local após sucesso e revalidar sessão/campanha.
- Estado geral: #74 catálogo/pilotos CI verde; #76 E2E CI verde; #75 domínio e rascunhos de persistência, não deploy. Próxima etapa: preparar testes de banco com múltiplos papéis e revisar contrato de histórico, depois integração de interface.

## Endurecimento do gateway (20/11/2026)

- Commits `8cfecd1` e `56e8521`: o adaptador de lixeira passou a validar também a operação em tempo de execução. Antes, qualquer valor inesperado diferente de `trash` acionava `restore` por padrão. Agora retorna `invalid_operation` sem RPC; teste de regressão incluído.
- CI do HEAD anterior `6105629` estava em execução (run `44825339046`) na consulta; **não presumir sucesso**. Conferir CI dos commits novos.
- Sem modificação em Supabase, Claude ou Codex. Integração real permanece pendente de migração autorizada e testes de RLS.

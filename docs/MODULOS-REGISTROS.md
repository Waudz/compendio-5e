# Módulos de registros: Início, Diário, Planejamento, Personagens (estado em 19/11/2026)

Documento de estado, não de decisão nova. Decisões aprovadas continuam em `docs/REGISTRO-OFICIAL-DECISOES.md`.

## Modelo de dados (sobre `notes`, sem tabelas paralelas)
| Módulo | `kind` | Quem cria | Visibilidade | Conteúdo/metadados |
|---|---|---|---|---|
| Diário | `diary` | só o mestre | `private` (rascunho) ou `campaign` (publicado) | `content` = blocos do editor; `meta.sessao` = `{dia, mes, ano}` do calendário de Harptos |
| Cena (cartão do Planejamento) | `scene` | só o mestre | sempre `private` | `content` = blocos do editor |
| Quadro do Planejamento | `board` | só o mestre | sempre `private` | `meta.colunas` = `[{id, titulo, cartoes:[idDaCena]}]`: só a ORDEM; reorganizar não altera as páginas |
| Personagem | `character` | qualquer participante (dono edita) | `private` ou `campaign` | título = nome; `meta` = `{classe, nivel, retrato}` |
| Capa | `campaigns.cover_path` | só o mestre | participantes leem | arquivo no bucket privado `campaign-assets` |

Decisão de baixo risco: o quadro é UMA nota `board` por campanha (ordem em `meta`), em vez das tabelas separadas de sessões/colunas/cartões da proposta do PR #30. Menos tabelas e a mesma RLS de `notes`; se a ordenação virar gargalo, a 0007 pode normalizar.

## Migrações
- `0004`, `0005` e `0006` foram aplicadas no projeto `compendio-5e` em 19/11/2026 (autorizado pelo responsável; backup privado de `notes` e `campaigns` feito antes). Não reaplicar. Sem elas (histórico): o Diário, o Planejamento, os Personagens e a capa mostram o erro "banco desatualizado" (nunca uma lista vazia). Ordem: 0005, depois 0006. Reversões travadas em `supabase/rollback/`.
- Testes PGlite: `supabase/notas-conteudo.test.ts` (0005) e `supabase/registros.test.ts` (0006: papéis, privacidade, planejamento privado, personagens, capa, storage com RLS, rollback). O esquema `storage` do Supabase é simulado por `supabase/stub-storage.ts`; validar num projeto de teste antes de produção.

## Interface
- Início = aba `campanha:<id>`; Diário/Planejamento/Personagens = abas de seção; registros abrem como `documento:<id>`; personagens como `ficha:<id>`.
- Editor rico: BlockNote 0.57.0 (fixo), carregado sob demanda (`EditorLazy`), sem mídia. Imagens no conteúdo dependem de upload no editor (storage já previsto na 0005).
- Modo de demonstração (somente `npm run dev`): `?demo=mestre` ou `?demo=jogador`, com dados no localStorage; não entra no build.

## Auditoria dos PRs anteriores
- #27 links de conteúdo, #31 infra GitHub, #32 migração 0005, #33 rascunhos locais, #34 teste instável, #43 decisões, #44 navegação/Início: integrados na `main` (as branches antigas ficaram "à frente" só por serem squash).
- #28 `proto/editor-blocknote`: recuperado o que vale (BlockNote 0.57.0 pinado, esquema restrito, lazy). O arrastar de cartões com `@dnd-kit` também foi recuperado (alça dedicada, mouse/toque/teclado; os botões continuam). O laboratório (`src/lab`) não entra no app. #28 pode ser fechado.
- #30 `docs/proposta-persistencia-e-fluxo`: fluxo do GitHub já implementado (#31); a proposta de persistência foi superada pela 0006 acima. Sugestão: fechar.
- `integracao/pr1-pr2-referencia`: branch de referência antiga; sem utilidade restante.

## O que ainda depende de desenvolvimento
Ficha completa do personagem (atributos, magias, inventário), upload de imagens dentro do editor, vínculos entre páginas, registros rápidos/pendências, exportação de sessão, Iniciativa/Encontros/Enciclopédia/Documentos/Compêndio.

## Validação real das políticas (script)
Os testes PGlite simulam o Storage; não substituem um teste real. `scripts/validar-supabase-0006.mjs` roda 20 verificações contra um projeto Supabase **isolado de teste** (migrações 0001–0006 aplicadas nele): envio/leitura/exclusão no bucket por participante, mestre e estranho, caminhos e tipos inválidos, limite de 5 MiB, capa, e a RLS de diário, cena, quadro e personagem. Usa só a chave pública e 3 contas informadas por variável de ambiente (instruções no cabeçalho do arquivo); limpa o que criou. Resultado esperado: todas PASS; qualquer FAIL bloqueia a aplicação em produção.

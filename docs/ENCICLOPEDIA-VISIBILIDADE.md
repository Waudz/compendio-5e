# Enciclopédia — contrato de descoberta (implementação isolada)

Branch independente do desenvolvimento de ficha/Compêndio. Módulo: `src/rules/encyclopedia-visibility.ts`; testes: `src/rules/encyclopedia-visibility.test.ts`.

## Regra de acesso
- Entrada **hidden**: apenas mestre autenticado da campanha; não aparece em listas nem contagens dos jogadores.
- Entrada **summary**: jogador ativo vê somente ID, tipo, nome e resumo explicitamente público.
- Entrada **full**: acrescenta descrição pública. Não implica revelar estatísticas de criatura, notas do mestre ou informações de bastidores.
- Mestre ativo vê a entrada completa somente na própria campanha.
- Ex-participante e mestre de outra campanha não recebem a entrada.

A projeção usa uma lista explícita de campos, nunca spread da entidade privada. Esse contrato é **defesa adicional de domínio**, não segurança de servidor: `role` e `isActiveMember` não podem ser aceitos do navegador como prova de autorização.

## Integração futura (não implementada)
1. Persistir registros e descobertas por campanha com RLS e testes multiusuário, incluindo RPC, buscas, contagens, Realtime e anexos.
2. Derivar papel e participação exclusivamente de `auth.uid()` e dos vínculos atuais; negar por padrão.
3. Vincular NPC narrativo a ficha ou criatura por ID estável, sem copiar dados mecânicos para a página pública.
4. Garantir que cartões públicos de personagens não herdem nível, PV, inventário ou anotações privadas.
5. Integrar a interface, cache por usuário/campanha e testes de navegador.
6. Reconciliar este contrato com a evolução da Enciclopédia no PR #74 antes de integrar. Nenhuma migração ou publicação autorizada por este documento.

## Evidência
Seis testes de unidade adicionados, ainda dependentes de validação pelo GitHub Actions; não alegar prontidão de produção.

## Referências mecânicas sem duplicação
`src/rules/encyclopedia-mechanics-link.ts` define vínculo opcional com criatura canônica (`sourceId`, `creatureId`, `revision`) ou personagem existente (`characterId`). Um NPC narrativo pode usar a ficha de um guarda/commoner sem se tornar automaticamente um personagem completo. Desvincular não exclui o registro narrativo nem a definição mecânica. Testes cobrem vínculos, validação e preservação dos dados.

**Importante:** o vínculo é apenas referência; não autoriza leitura da ficha ou das estatísticas. A API deve resolver o destino sob RLS e política de descoberta. O módulo ainda não valida a existência do destino no catálogo nem possui persistência.

## Controle explícito de descoberta
`src/rules/encyclopedia-discovery.ts` cria cada entrada oculta por padrão e define transições explícitas `hidden → summary → full` (e retorno para oculto). Apenas o mestre da mesma campanha pode solicitar a transição no contrato de domínio; jogadores e mestres de outras campanhas são recusados. A implementação é imutável e não dispara descoberta automaticamente ao iniciar combate, vincular criatura ou criar ficha. Quatro testes de unidade adicionais cobrem os estados e a autorização. Antes da produção, a autorização precisa ser recalculada no servidor com `auth.uid()`, RLS e auditoria das mudanças.

## Ciclo narrativo de personagens
`src/rules/character-narrative-lifecycle.ts` registra status narrativo `active | dead | retired | inactive` e mudanças de controlador com eventos identificados. Uma mudança de status não apaga personagem, ficha, inventário ou histórico. Desvincular o controlador preserva a identidade do personagem na campanha e permite atribuição posterior. Alterações são imutáveis, com proteção contra IDs duplicados de eventos; operações sem mudança não geram eventos adicionais.

**Escopo:** modelo puro de domínio; não determina quem tem permissão para editar a ficha, não altera dados privados, não implementa lixeira, não persiste eventos e não define quem pode mudar o status. Essas operações deverão passar por autorização e transações atômicas no servidor. O estado narrativo não modifica automaticamente a descoberta pública.

## Lixeira narrativa sem expiração
`src/rules/encyclopedia-trash.ts` fornece operações imutáveis para mover um registro narrativo à lixeira, restaurá-lo e filtrar registros ativos/arquivados. Não existe prazo de expiração nem rotina de limpeza automática. Uma exclusão permanente requer uma confirmação explícita do identificador de um registro que já esteja na lixeira; a função **apenas valida** o pedido e não executa remoção. Cinco testes de unidade verificam essas regras.

**Antes de produção:** persistir `deleted_at`/`deleted_by` em migração revisada, definir autorização real para mover/restaurar/excluir (mestre da campanha), aplicar RLS a listagens, pesquisas, contagens e Realtime, e transacionar exclusão definitiva com confirmação no servidor. Não apagar notas privadas de jogadores, fichas ou vínculos canônicos como efeito colateral da lixeira narrativa. A interface deve mostrar o impacto da exclusão definitiva e exigir confirmação adicional. Nenhuma migração foi aplicada por este PR.

## Busca, contagem e paginação sem vazamento
`src/rules/encyclopedia-query.ts` filtra registros por campanha, participação, descoberta e lixeira **antes** de pesquisar, contar ou paginar. A busca textual ignora acentos e pesquisa somente campos autorizados para aquele leitor; não pesquisa notas secretas do mestre para jogadores. A paginação tem limites explícitos (1–100 registros por página). A lixeira só é consultável pelo mestre da própria campanha e mediante `includeTrash` explícito. Cinco testes adicionais verificam contagens, busca, paginação, isolamento e lixeira.

O módulo opera sobre dados em memória: não evita que um servidor envie dados proibidos ao navegador antes da filtragem. **Em produção, filtrar e paginar no banco sob RLS**, incluindo políticas de contagem, busca, Realtime e armazenamento de imagens.

## Serviço integrado de domínio
`src/rules/encyclopedia-narrative-service.ts` compõe criação oculta por padrão, revelação exclusiva do mestre, busca autorizada, lixeira e restauração em um único fluxo imutável. Uma entrada descoberta deixa de aparecer para jogadores quando vai à lixeira e, ao ser restaurada, preserva seu nível de descoberta anterior. Não é possível revelar registros ainda na lixeira. Quatro testes de integração **de domínio** cobrem fluxo completo e isolamento entre campanhas.

**Limites:** não é API de rede, não é interface, não aplica RLS, não persiste dados nem realiza transações. Deve ser ligado a operações do banco somente após revisão da autorização server-side. Não incorporar este serviço diretamente como única barreira de acesso em componentes cliente.

## Máquina de estados integrada
`src/rules/encyclopedia-state.ts` organiza ações `create`, `discover`, `trash` e `restore` sobre uma coleção imutável. Rejeita mutações de jogadores, IDs duplicados, entradas ausentes e ações entre campanhas. Três testes cobrem fluxo completo, preservação de dados e erros sem alteração do estado original. O campo `actorUserId` usado em eventos de lixeira é apenas um dado do contrato de domínio: **na persistência, o servidor deve substituí-lo por `auth.uid()`**, jamais confiar no valor do cliente.

A máquina de estados não é uma API de produção, nem substitui a transação, a autorização ou a persistência server-side. O projeto deve evitar baixar a coleção completa de registros secretos ao cliente para aplicar esses filtros.

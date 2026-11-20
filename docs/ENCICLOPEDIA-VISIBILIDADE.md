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

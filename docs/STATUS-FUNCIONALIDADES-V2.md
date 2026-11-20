# Estado verificável das funcionalidades — Compêndio 5e 2.0

Atualização: 20/11/2026. **Estimativas de planejamento**, não cobertura medida de testes nem percentual calculado automaticamente. Diferenciar implementação de domínio, interface, persistência, segurança e entrega.

| Funcionalidade | Estimativa | Código de domínio | Interface real | Persistência/segurança | Principal lacuna |
|---|---:|---|---|---|---|
| Criador | 25% | Protótipo de regras, ASI, escolhas, catálogo | Piloto **somente dev** | Somente localStorage no piloto | Fluxo completo de classes/raças/origens, persistência autenticada |
| Ficha | 20% | Cálculo experimental | Perfil simples da campanha | Registros de perfil, não ficha D&D completa | Atributos, magias, recursos e ficha única |
| Inventário | 20% | Instâncias identificadas e operações | Lista simples + piloto dev | Sem instâncias reais persistidas | Itens versionados, peso, equipamento, sincronização |
| Compêndio | 15% | Registro e resolutor de definições | Seção placeholder | Sem catálogo completo persistido | Dados 2014 auditados, busca, lista/grade |
| Magias | 5% | Tipo de referência | Placeholder | Não implementada | Catálogo, escolas, regras e conjuração |
| Bestiário | 5% | Referências planejadas | Placeholder | Não implementada | Catálogo e busca |
| Iniciativa | 10% | Planejamento e navegação | Placeholder | Não implementada | Combate completo |
| Campanhas | 50% | API de campanhas | Painéis e navegação | Auth e regras existentes | Fluxos completos, integração com personagens |
| Anotações/diário | 55% | Registros, visibilidade, editor | Interface existente | Migrações propostas ainda pendentes | Persistência final e testes |
| Navegação | 70% | Layout e abas | Implementada | Layout local por escopo | Refinamento e integração |
| Segurança/persistência | 35% | Auth, RLS parcial, contrato de revisão puro | Login | Revisões de ficha ainda não ligadas ao servidor | Escrita atômica e autorização de personagens |

**Visão geral estimada: 30%.** Não é média aritmética; o peso da entrega completa é maior que o de módulos isolados. Os números podem mudar após auditoria.

## Critérios de pronto (por funcionalidade)

1. Regras corretas e dados auditados com fonte/edição/licença.
2. Interface utilizável em desktop e celular, incluindo acessibilidade.
3. Persistência autenticada com RLS, revisões atômicas e tratamento de conflito.
4. Testes de unidade, integração e navegador real para o fluxo principal.
5. Documentação, migração segura e publicação autorizada.

## Próximas entregas

- Criador/ficha: completar fluxo vertical com referências versionadas e validação de escolhas; depois integrar persistência autorizada.
- Compêndio: catálogo único consultável (lista/grade), usando IDs e revisões para regras e itens.
- Testes: adicionar Playwright em CI quando o ambiente e as dependências estiverem configurados, sem alegar cobertura E2E antecipadamente.
- Não integrar à `main` ou aplicar migrações de produção sem autorização explícita.

## Incremento Compêndio — 20/11/2026

Criado `src/rules/compendium-query.ts` com `searchCompendium`: filtro por tipo e fonte, busca textual sem diferenciação de acentos, ordenação estável pt-BR e chave imutável `sourceId:kind:id:revision`. Os resultados resolvem a **mesma definição** de `RulesCatalogue` usada pelo criador; não criam uma segunda tabela de regras. Testes cobrem renomeação sem quebrar IDs, pesquisa e falha de definições ausentes. `CompendiumView` prevê lista/grade, mas **não há componente visual implementado nem catálogo SRD completo nesta rodada**. Percentual estimado permanece 15% até integração real.

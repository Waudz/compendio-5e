> **Atualização mais recente (23/11/2026):** consulte [Estado da Alpha após integração do combate](ALPHA-STATUS-20261123.md). As porcentagens e o placeholder de iniciativa abaixo são registros históricos de 20/11, não representam a `main` atual.

> **Guia para novas conversas:** [`CONTINUIDADE-DESENVOLVIMENTO.md`](CONTINUIDADE-DESENVOLVIMENTO.md). Atualizar estimativas apenas com justificativa; registrar evidência de testes, CI e diferença entre branch e produção. Nunca transformar percentuais estimados em declaração de prontidão.

# Estado verificável das funcionalidades — Compêndio 5e 2.0

Atualização: 20/11/2026. **Estimativas de planejamento**, não cobertura medida de testes nem percentual calculado automaticamente. Diferenciar implementação de domínio, interface, persistência, segurança e entrega.

| Funcionalidade | Estimativa | Código de domínio | Interface real | Persistência/segurança | Principal lacuna |
|---|---:|---|---|---|---|
| Criador | 40% | Guerreiro SRD 2014 com escolhas, equipamento e identidade pública | **Na navegação real** (Personagens → criador guiado), desktop e celular | Armazenamento local **experimental** | Demais classes/raças/antecedentes, persistência autenticada |
| Ficha | 20% | Cálculo experimental | Perfil simples da campanha | Registros de perfil, não ficha D&D completa | Atributos, magias, recursos e ficha única |
| Inventário | 35% | Instâncias com catálogo oficial de itens | Dentro do criador, com "Consultar no Compêndio" | Local experimental | Peso total, equipar, transferência, servidor |
| Compêndio | 60% | Catálogo de itens, magias e monstros com núcleo genérico, busca e filtros | **Seção real**: categorias, filtros, lista/grade, detalhe em painel, esqueletos | Dados embutidos (pedaços sob demanda), sem persistência | Classes, raças, antecedentes, seletor de sistema, rolagens |
| Magias | 65% | 319 magias SRD validadas contra a API; contratos por classe para o criador | Catálogo, filtros e detalhe | Dados embutidos | Conjuração (espaços, preparadas) é do criador; listas de classes confirmadas no SRD |
| Bestiário | 55% | 322 monstros SRD + 1 legado (pt-BR, 100% traduzidos por IA, auditoria numérica OK; sem revisão humana) | Catálogo, filtros e ficha | Dados embutidos | Rolagens de dados; troca de forma em combate (dados por forma já estruturados); revisão humana das traduções |
| Iniciativa | Etapa 1 validada no PR #139 | Turnos, PV, condições e vínculos estáveis | Faixa central, cartões/lista, lados independentes, pesquisas e ficha completa | Local/nuvem com revisão otimista; acesso exclusivo do mestre | Conferir integração/CI do #139; contas hospedadas não testadas nesta rodada |
| Encontros | Etapa 1 validada no PR #139 | Grupos e indivíduos com herança; envio seletivo e retomada | Criaturas, Tesouros e Progresso; diálogo compartilhado | JSON opcional compatível, sem migração; testes de RLS isolados | Distribuição automática ao inventário e ligações com Anotações fora do escopo |
| Campanhas | 50% | API de campanhas | Painéis e navegação | Auth e regras existentes | Fluxos completos, integração com personagens |
| Anotações/diário | 55% | Registros, visibilidade, editor | Interface existente | Migrações propostas ainda pendentes | Persistência final e testes |
| Navegação | 70% | Layout e abas | Implementada | Layout local por escopo | Refinamento e integração |
| Segurança/persistência | 45% | Auth, RLS, `character_sheets` (0007) e **0008 proposta** com revisão e imutabilidade | Login; criador com repositório servidor/local | Fichas: validado em PGlite, **não aplicado no Supabase** | Aplicar 0008, exclusão/transferência narrativas, Realtime |

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

## Piloto visual do Compêndio — 20/11/2026

Adicionado `src/dev/compendium-pilot.tsx` com pesquisa, filtro por tipo, alternância **lista/grade** e abertura de detalhes pela chave `sourceId:kind:id:revision`; teste de interface `src/dev/compendium-pilot.test.tsx`. Acesso local em `?demo=compendio-piloto` usando `npm run dev` (respeitar base do Vite). **Não está na interface autenticada/publicada**; contém somente três entradas ilustrativas, não o SRD completo. Próxima etapa: catálogo auditado com fontes/licenças e integração à navegação real. O percentual permanece conservador até essa integração.

## Fonte única entre pilotos — 20/11/2026

Eliminadas as duas definições de demonstração divergentes: `src/dev/pilot-rules.ts` é a fonte **única** dos exemplos usados tanto em `?demo=compendio-piloto` quanto em `?demo=criador-piloto`. A consulta exibe quatro entradas (raça, antecedente, classe e item); o criador calcula atributos a partir dessas mesmas definições e revisões. Teste de integração verifica o vínculo. Continua sendo uma amostra ilustrativa, não conteúdo SRD auditado ou catálogo de produção.

## Auditoria de vínculos do catálogo — 20/11/2026

Criado `src/rules/catalogue-integrity.ts` com `auditCatalogueLinks`: analisa vínculos **explicitamente fornecidos** entre registros versionados, acusa destino/revisão ausente, origem não registrada, vínculos duplicados e suplementos sem metadados de licença. Testes automatizados cobrem casos válidos e inválidos. **Limitação deliberada:** ainda não extrai automaticamente referências internas dos payloads de raças/classes/magias/itens; isso depende de schemas tipados por categoria. Aviso de licença ausente não significa permissão concedida quando o campo estiver preenchido: licenças exigem auditoria jurídica/editorial separada. Nenhum importador real executado.

## Restrições por campanha — contrato inicial (20/11/2026)

Criado `src/rules/campaign-content-policy.ts` e testes. O mestre poderá definir `blocked` por `ContentRef` (raça, subraça, classe, subclasse, antecedente, talento, magia ou item). `campaignContentAvailability` devolve status sem remover o registro do Compêndio; `assertCharacterOptionsAllowed` rejeita seleções novas bloqueadas; `setCampaignContentBlocked` é imutável. Exemplo testado: Goblin indisponível na campanha A, disponível na B; renomear não muda a restrição. **Ainda é domínio puro, sem tela de configuração, persistência, RLS ou integração com o criador autenticado.** Personagens existentes não devem ser alterados retroativamente. Regras para revisão futura do mesmo conteúdo e exceções do mestre precisam ser especificadas antes da persistência.

## Bloqueio de classe com motivo — 20/11/2026

Adicionado motivo opcional de indisponibilidade por chave versionada, limite de 500 caracteres, remoção do motivo ao desbloquear e função de edição de política com verificação de campanha/mestre. Teste inclui **Artífice** de fonte suplementar fictícia e recusa edição por não mestre. Essa verificação em domínio é **apenas defesa adicional**: dados de papel informados pelo cliente não são confiáveis; API e RLS devem verificar o mestre autenticado antes de salvar. A configuração ainda não está no menu real nem é persistida.

## Pesquisa indexada do Compêndio — 20/11/2026

`searchCompendium` agora valida e monta um índice de descrições, nomes normalizados e fontes **uma vez por objeto de catálogo**, via `WeakMap`; consultas posteriores fazem apenas filtro linear e retornam cópias rasas das linhas. Evita validação repetida e buscas quadráticas ao digitar. O catálogo deve ser tratado como **imutável**: qualquer alteração deve criar novo objeto de catálogo (e, preferencialmente, novas coleções internas). Testes incluem filtros, acentos, renomeação e isolamento do resultado. Não significa importação de conteúdo SRD real nem interface de produção concluída.

## Catálogo de itens — 20/11/2026

`src/catalogue/` carrega 578 itens SRD 2014 validados por Zod; 237 mundanos conferidos contra a D&D 5e SRD API (`scripts/verificar-itens-api.mjs`), 341 mágicos apenas pelo esquema. Usado pelos pilotos do criador e do Compêndio. Não está na interface autenticada. Percentual do Compêndio sobe para 20% (estimativa).

## Fatia vertical na navegação real — 21/11/2026

Criador guiado (Guerreiro) e Compêndio de itens acessíveis pelo menu normal, testados em jsdom (742 testes no total). Ainda sem persistência autenticada e sem teste em navegador real. Percentuais são estimativas.

## Persistência das fichas — 21/11/2026

Código + 24 testes de RLS em PostgreSQL isolado + interface testada; **sem funcionamento real no Supabase** até a migração 0008 ser autorizada e aplicada. Percentuais são estimativas.

## Catálogo de magias, monstros e itens — 22/11/2026

Compêndio com três categorias, validado em jsdom e contra a SRD API; percentuais são estimativas. Ver `docs/CATALOGO-DND-2014.md`.

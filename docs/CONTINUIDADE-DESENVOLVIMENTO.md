# Continuidade do desenvolvimento — Compêndio 5e 2.0

> **PONTO DE ENTRADA OBRIGATÓRIO para novas conversas, agentes e colaboradores.** Revisado em 20/11/2026 na branch do [PR #74](https://github.com/Waudz/compendio-5e/pull/74). Este arquivo é um **índice operacional e registro de decisões**, não substitui os detalhes normativos dos documentos vinculados. Verifique branch, commits, CI e código novamente antes de declarar qualquer funcionalidade pronta.

## Como retomar sem o histórico do ChatGPT

1. Abrir [README](../README.md), este arquivo e [DECISOES-E-ARQUITETURA](../DECISOES-E-ARQUITETURA.md); identificar decisões atuais e supersessões.
2. Ler [PLANEJAMENTO-V2](PLANEJAMENTO-V2.md) (especialmente complemento mais recente e checklist), [STATUS-FUNCIONALIDADES-V2](STATUS-FUNCIONALIDADES-V2.md) e [CRIADOR-FICHA-INVENTARIO](CRIADOR-FICHA-INVENTARIO.md).
3. Para dados 2014, ler [AUDITORIA-CATALOGO-PERSONAGEM-2014](AUDITORIA-CATALOGO-PERSONAGEM-2014.md) e [PLANO-REAPROVEITAMENTO-LEGADO](PLANO-REAPROVEITAMENTO-LEGADO.md); para notas, ler [NOTAS-PERMISSOES](NOTAS-PERMISSOES.md); para navegação, [NAVEGACAO-ABAS](NAVEGACAO-ABAS.md).
4. Consultar PRs abertos, branch HEAD, arquivos alterados e GitHub Actions. **PR aberto não é produção.** Não presumir que CI de um commit anterior aprova o atual.
5. Inspecionar os arquivos e testes envolvidos na tarefa; executar build, testes e E2E quando disponíveis. Registrar o que **foi executado** e o que **não foi**.
6. Desenvolver uma fatia vertical pequena, atualizar registro de decisões e status, atualizar README e registrar commits, limitações e próximo passo. **Não mesclar PR, publicar ou aplicar migração sem autorização explícita.**

## Hierarquia da documentação (evitar fontes de verdade concorrentes)

| Assunto | Fonte normativa | Demais documentos |
|---|---|---|
| Decisões aprovadas e arquitetura | `DECISOES-E-ARQUITETURA.md` | Este arquivo indexa decisões e conflitos |
| Planejamento e prioridades | `docs/PLANEJAMENTO-V2.md`, **complemento mais recente prevalece** | `STATUS-FUNCIONALIDADES-V2.md` mede estado estimado |
| Implementação de criador/ficha/inventário | `docs/CRIADOR-FICHA-INVENTARIO.md` | `docs/AUDITORIA-CATALOGO-PERSONAGEM-2014.md` valida conteúdo |
| Fontes e migração de dados | `docs/PLANO-REAPROVEITAMENTO-LEGADO.md` | Catálogo auditado antes de publicar |
| Navegação, notas, RLS | `docs/NAVEGACAO-ABAS.md`, `docs/NOTAS-PERMISSOES.md` | Ver migrações e código |
| Estado real | **Código, branch, CI, banco e site publicados** | Textos de status podem ficar desatualizados |

**Não apagar documentação histórica sem avaliar referências.** Marcar decisões antigas como **SUBSTITUÍDAS** e apontar para a decisão vigente. Se documentos divergem, não escolher silenciosamente: verificar data, autoridade, implementação e registrar reconciliação.

## Registro consolidado de decisões vigentes

| ID | Decisão | Estado | Detalhes/limites |
|---|---|---|---|
| DEC-001 | Compêndio 5e 2.0 gratuito, D&D 5e **2014** primeiro; 2024 não misturado; projeto antigo independente | Aprovada | `DECISOES-E-ARQUITETURA.md` |
| DEC-002 | Catálogo central versionado (raças, classes, subclasses, antecedentes, talentos, magias, itens, características); **um motor de regras** interpreta dados para Compêndio, criador e ficha | Aprovada; parcialmente prototipada | Definições não guardam PV/inventário pessoal; IDs estáveis + revisão; não duplicar progressão |
| DEC-003 | D&D 5e API `/api/2014` como candidata primária; Open5e V2 para comparação; legado para dados e fluxos, **não copiar arquitetura** | Aprovada; importação auditada pendente | Validar fonte, licença, edição, completude e efeitos antes de liberar conteúdo |
| DEC-004 | Criador guiado, ficha única, inventário **dentro da ficha** e acesso por submenu/deslize móvel; progressão 1–20 | Aprovada; piloto dev parcial | Não apresentar piloto como funcionalidade publicada |
| DEC-005 | Uma ficha ativa por `characterId`; no máximo uma campanha ativa por personagem; participações históricas arquivadas não são segunda ficha editável | Aprovada; contratos parciais | **SUBSTITUI** o modelo anterior de estados ativos independentes por campanha |
| DEC-006 | Morte, aposentadoria, arquivamento, exclusão da biblioteca pessoal e conversão PC/NPC são dimensões diferentes | Aprovada; persistência pendente | Morte não apaga ficha; ressurreição reusa ID; substituto é novo personagem |
| DEC-007 | Excluir da biblioteca pessoal desvincula o controlador; campanha preserva ficha/snapshot histórico e antigos controladores; mestre pode transferir para outro jogador ou converter em NPC | Aprovada; domínio experimental | Transferência exige autenticação/aceite verificável, auditoria, RLS; não expor notas privadas |
| DEC-008 | Enciclopédia da campanha tem seção Personagens com PCs, mortos, órfãos e NPCs, vinculada ao ID; página narrativa **não duplica ficha** | Aprovada; UI pendente | Mestre controla publicação; dados secretos privados |
| DEC-009 | Notas pertencem ao autor, privadas por padrão; vínculos não compartilham; compartilhamento explícito, RLS e histórico | Aprovada; implementação parcial | Excluir personagem ou sair da campanha não apaga notas |
| DEC-010 | Navegação móvel por papéis: mestre Início/Anotações/Iniciativa/Compêndio/Menu; jogador Início/Anotações/Ficha/Compêndio/Menu; abas/workspace desktop e gestos coerentes | Aprovada; integração parcial | Referências de UX não são implementação |
| DEC-011 | Fluxo completo e testes antes de expandir conteúdo; nunca liberar classe sem progressão/efeitos/decisões revisados | Aprovada; execução parcial | Testar regras, UI, persistência, autorização e reabertura |
| DEC-012 | PR #74 é trabalho experimental; sem merge, deploy ou migração automática | Restrição operacional vigente | Conferir status atual do PR antes de agir |
| DEC-013 | Ferramentas adicionais somente quando agregarem valor e com lockfile/testes consistentes | Aprovada | Zod, React Hook Form, fast-check e Playwright planejados, não instalados na revisão; Dexie/TanStack Virtual/XState condicionais |
| DEC-014 | Documentar **cada decisão nova ou alteração** no mesmo conjunto de commits que o código, com motivo, alternativa, impacto, testes e pendências | Aprovada nesta rodada | Modelo abaixo |

### Registro de decisão: modelo obrigatório

Ao decidir ou alterar qualquer comportamento relevante, acrescentar uma entrada em `DECISOES-E-ARQUITETURA.md` e atualizar a linha deste índice:

```md
### DEC-XXX — Título (AAAA-MM-DD)
- **Situação:** proposta | aprovada | implementada parcialmente | implementada | substituída
- **Problema e contexto:** ...
- **Decisão:** ...
- **Alternativas consideradas e motivo da escolha:** ...
- **Consequências:** dados, UX, segurança/RLS, offline, performance, compatibilidade e licenças
- **Implementação:** arquivos, PR e commit (ou "não implementado")
- **Verificação:** comandos, testes, CI, ambiente e resultado (ou "não executado")
- **Pendências e condições de conclusão:** ...
- **Substitui/é substituída por:** ID anterior/posterior, se aplicável
```

Decisões de baixo nível (ex.: nome interno de variável) não precisam de entrada independente; decisões de arquitetura, regra, UX, segurança, fonte de dados, persistência e prioridades precisam. **Não declarar aprovação do usuário para uma escolha apenas recomendada pelo assistente.**

## Referências externas e status de adoção

| Referência | Finalidade | Status / cautela |
|---|---|---|
| [D&D 5e SRD API](https://docs.dnd5eapi.co/) | Dados SRD 2014; classes, níveis, características, equipamentos, magias | Fonte candidata; `/api/2014`; coleta staging não é conteúdo aprovado |
| [Open5e](https://open5e.com/api-docs) | Comparação e cobertura complementar | Preferir V2; conferir licença **por publicação** |
| [Foundry dnd5e](https://github.com/foundryvtt/dnd5e) e [Advancement](https://github.com/foundryvtt/dnd5e/wiki/Advancement) | Referência de progressão/ações, não fonte de conteúdo copiado | Verificar licenças distintas de código e assets |
| [Zod](https://zod.dev/) | Schemas de importação e fichas | Planejado; verificar instalação no `package.json` |
| [React Hook Form](https://react-hook-form.com/) | Formulários dinâmicos do criador | Planejado |
| [fast-check](https://fast-check.dev/) | Testes de propriedades e combinações | Planejado |
| [Playwright](https://playwright.dev/) | Testes E2E em navegador real | Planejado |
| [Dexie](https://dexie.org/) | Possível IndexedDB offline | Adiado: avaliar camada existente antes |
| [TanStack Virtual](https://tanstack.com/virtual/latest) | Virtualização de listas grandes | Adiado até medição |
| [XState](https://stately.ai/docs/xstate) | Máquina de estados para fluxos complexos | Opcional |
| [Letterboxd](https://letterboxd.com/) | Inspiração UX: barras durante rolagem e navegação móvel | Referência visual, não dependência |
| [FlexLayout](https://github.com/caplin/FlexLayout) | Abas e divisão de workspace | Conferir implementação e docs de navegação |
| [Embla Carousel](https://www.embla-carousel.com/) | Possível gesto horizontal entre seções | Referência; não presumir instalação |
| [BlockNote](https://www.blocknotejs.org/) | Editor estruturado de anotações | Ver `NOTAS-PERMISSOES.md` e implementação |
| [Compêndio 1.0](https://github.com/Waudz/rastreador-dnd) | Dados e UX legados para auditoria | Nunca modificar o legado como efeito da v2 |

Links são **referências conhecidas**, não prova de acesso ou auditoria atual de sites externos. Outras fontes, componentes e padrões devem ser adicionados aqui quando influenciarem uma decisão.

## Situação verificável em 20/11/2026

- **Produção:** https://waudz.github.io/compendio-5e/; a branch do PR #74 não foi integrada, portanto não considerar criador/catálogo experimentais publicados.
- **PR ativo para esta linha:** [#74](https://github.com/Waudz/compendio-5e/pull/74), branch `docs/auditoria-catalogos-personagem-2014`, aberta na última verificação desta documentação. PR #73 também foi reportado aberto em conversa anterior: **rever status e possíveis conflitos**, não presumir que continua aberto.
- **Código experimental:** catálogo canônico e referências versionadas, adaptação de concessões, progressão parcial, custódia de personagens, inventário e pilotos dev. Verificar arquivos/testes no HEAD antes de descrever capacidades.
- **Pilotos dev:** `?demo=criador-piloto` e `?demo=compendio-piloto` (conforme README); dados ilustrativos e armazenamento local, sem autorização real.
- **Sem comprovação de conclusão:** catálogo SRD 2014 auditado completo, criação autenticada, RLS de personagem, persistência atômica, Playwright E2E, ficha completa e UI pública.
- **CI:** consultar workflow do **último SHA**; um CI verde anterior não valida commits posteriores. Nunca inventar resultados.
- **Percentuais** em `STATUS-FUNCIONALIDADES-V2.md` são estimativas, não métricas verificadas.

## Próximas tarefas (ordem sugerida, não promessa de entrega)

1. Conferir CI do HEAD do PR #74 e revisar inconsistências introduzidas pelo adaptador (identificadores, valores permitidos, fontes) antes de ampliar.
2. Completar **uma fatia vertical auditada** do Guerreiro 2014: classe, níveis, características, escolhas, origem/raça, ficha e representação idêntica no Compêndio; testar casos normativos independentes.
3. Consolidar coleta staging, revisão editorial/licenças e promoção controlada; **não ativar registros incompletos**.
4. Integrar schemas e testes de propriedades com dependências e lockfile corretos; depois UI guiada e E2E real.
5. Projetar persistência autenticada e concorrência/RLS com testes isolados; pedir autorização antes de migrações e publicação.

## Registro de continuidade — 20/11/2026

- **Solicitação:** recuperar decisões e referências do histórico de conversa anexado e tornar o GitHub suficiente para continuidade futura.
- **Ação documental:** criado este índice; README e documentos de referência recebem links e regras para registrar decisões sem duplicar textos normativos.
- **Escopo:** somente documentação; nenhuma alteração de lógica, banco, deploy ou merge.
- **Verificação:** conferir arquivos e commits no PR; CI do último commit ainda deve ser consultado após o envio.
- **Próxima rodada:** executar checklist de retomada, conferir CI e continuar fatia vertical Guerreiro 2014.

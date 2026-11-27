# Continuidade do desenvolvimento — Compêndio 5e 2.0

## Atualização normativa — 22/11/2026

Consultar [DEC-20261122-A a F](../DECISOES-E-ARQUITETURA.md#decisões-vigentes--22112026-dec-20261122-a-a-f). As decisões novas substituem as propostas históricas incompatíveis neste arquivo: campanha obrigatória, beta fechado, sem biblioteca pessoal ou loot distribuído, inventário com pesquisa e criação rápida, preservação do Assimilação e PWA posterior. Não tratar como implementado.


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

| DEC-015 | Catálogo canônico de itens SRD 2014 (578 itens, validado com Zod, mesma fonte do Compêndio, criador e inventário) | Implementada parcialmente | Só itens; 237 mundanos conferidos na API, 341 mágicos não; ver `DECISOES-E-ARQUITETURA.md` |
| DEC-016 | Criador guiado e Compêndio na navegação real (abas `criador:`/`item:`), armazenamento local **experimental** atrás de interface | Implementada parcialmente | Guerreiro; sem Supabase; proposta de persistência em `CRIADOR-FICHA-INVENTARIO.md` |
| DEC-017 | Persistência das fichas guiadas no Supabase (`character_sheets` + identidade pública em `notes`), revisão otimista | Implementada e validada em isolamento; **0008 não aplicada** | Ver `CRIADOR-FICHA-INVENTARIO.md` |

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

### Registro técnico — validação cruzada do catálogo (20/11/2026)

- **Contexto:** adaptador já validava concessões de raça/antecedente/níveis, mas recebia progressões (`Advancement[]`) sem checagem na fronteira e não detectava IDs de escolhas repetidos entre fontes.
- **Decisão:** validar todas as concessões/alternativas da progressão e rejeitar colisões de IDs entre raça, antecedente e classe; verificar dado de vida consistente em níveis de classe única.
- **Alternativa rejeitada:** confiar somente na avaliação posterior da ficha, que poderia tratar decisões ambíguas.
- **Implementação:** `src/rules/character-catalogue-adapter.ts` e `src/rules/character-catalogue-adapter.test.ts`; PR #74.
- **Verificação:** testes adicionados; consultar GitHub Actions do HEAD antes de afirmar sucesso.
- **Pendências:** dados SRD 2014 auditados, importação, persistência autenticada e testes E2E.

### Registro técnico — integridade dos atributos-base (20/11/2026)

- **Contexto:** rascunhos malformados podiam conter `NaN`, infinito, frações ou valores fora de faixa e contaminar os cálculos de ficha.
- **Decisão:** domínio rejeita atributos-base que não sejam inteiros finitos entre 1 e 30; limite técnico não aprova métodos de distribuição nem exceções às regras 2014.
- **Alternativa rejeitada:** validação exclusiva de formulário, insuficiente para dados importados ou persistidos.
- **Implementação:** `src/rules/character-domain.ts` e testes correspondentes; PR #74.
- **Verificação:** regressões acrescentadas; consultar CI do HEAD para resultado.
- **Pendências:** schemas de importação, regras de criação, autorização e E2E.

### Registro técnico — defesa no motor puro (20/11/2026)

- **Contexto:** consumidores podem chamar `buildCharacter` diretamente, contornando o adaptador e a validação da ficha.
- **Decisão:** reforçar atributos-base inteiros finitos 1–30 e dado de vida positivo/consistente em 20 níveis no próprio motor.
- **Alternativa rejeitada:** depender só de verificações externas.
- **Implementação:** `src/rules/character-build-pilot.ts` e testes de regressão; PR #74.
- **Verificação:** testes adicionados; CI do HEAD ainda precisa ser confirmado.
- **Pendências:** auditoria de regras 2014, métodos de geração, UI autenticada e E2E.

### Entrega vertical — Guerreiro SRD 5.1 (20/11/2026)

- **Decisão:** trocar a classe ilustrativa vazia do piloto por definição de Guerreiro 2014 conferida no SRD 5.1 (https://media.wizards.com/2023/downloads/dnd/SRD_CC_v5.1.pdf), compartilhada entre criador e Compêndio. Fonte SRD 5.1 sob CC BY 4.0.
- **Implementação:** `src/rules/fighter-2014.ts` com 20 níveis estruturais, características principais, recursos e escolhas de estilo/Campeão/ASI; `src/dev/pilot-rules.ts` usa a definição; `src/dev/character-pilot.tsx` oferece escolhas e ficha calculada entre níveis 1–6.
- **Alternativa rejeitada:** duplicar regras nos dois pilotos ou declarar os 20 níveis jogáveis sem todos os efeitos.
- **Testes:** `src/rules/fighter-2014.test.ts` e `src/dev/character-pilot.test.tsx`; resultados de CI precisam ser verificados.
- **Pendências:** arquétipo Campeão acima do nível 3, efeitos contextuais de estilos, proficiências, equipamento inicial, outros conteúdos e persistência autenticada. Raça e antecedente ainda ilustrativos. Sem merge/deploy/migração.

### Incremento da ficha teste — perícias de Guerreiro (20/11/2026)

**Decisão:** implementar escolha real de duas perícias de classe do Guerreiro SRD 2014 (Acrobatics, Animal Handling, Athletics, History, Insight, Intimidation, Perception, Survival) como escolha estável `fighter-skills-1` no catálogo compartilhado. Interface usa checkboxes limitados a duas escolhas e ficha apresenta perícias calculadas. **Alternativa rejeitada:** preencher perícias automaticamente sem escolha. **Verificação:** testes de domínio e UI atualizados; confirmar novo CI. **Pendências para um personagem teste completo:** método de atributos, proficiências completas, equipamento inicial por escolhas, perícias raciais/de antecedente auditadas, detalhes do arquétipo e salvamento autenticado; no piloto local, escolha de raça/antecedente ainda não é livre.

### Decisão de UX e regras — atributos 2014 (20/11/2026)

- **Implementado:** `src/rules/ability-generation-2014.ts` valida compra de 27 pontos (8–15) e matriz padrão (15,14,13,12,10,8). O piloto apresenta ambos os métodos; a matriz troca valores entre atributos, sem criar valores duplicados. Bônus racial é aplicado no motor, após a distribuição base. Testes de regras adicionados.
- **Referência de UX:** Foundry dnd5e Advancement (`https://github.com/foundryvtt/dnd5e/wiki/Advancement`) e Character Builder (`https://foundryvtt.com/packages/dnd5e-character-builder`): escolhas reversíveis, valores únicos na matriz, revisão e ficha derivada; nenhuma dependência nova, nem código copiado. O módulo de Character Builder também suporta regras 2024, que **não** foram adotadas.
- **Alternativas:** entrada manual irrestrita rejeitada como padrão do piloto, por não validar o método 2014; adoção integral do wizard externo rejeitada por incompatibilidade arquitetural.
- **Pendências:** persistir explicitamente o método escolhido (atualmente inferido da distribuição ao reabrir), fluxo de equipamento inicial, proficiências, escolhas de raça/antecedente, ficha autenticada e testes E2E. Confirmar CI do último commit.

### Decisão pendente de validação com jogadores — recipientes (20/11/2026)

- **Decisão atual:** mochila, algibeira, saco, baú e demais recipientes são **itens normais do catálogo e do inventário**, sem subinventário, conteúdo aninhado, capacidade automática ou vínculo obrigatório com outros itens. O Pacote de Explorador e outros pacotes são conjuntos de itens, não recipientes especiais.
- **Pendência para conversar com os jogadores:** verificar se organização opcional por recipientes seria útil; somente depois avaliar interface de expansão, movimentação de itens, peso/capacidade e comportamento ao excluir recipientes. **Não implementar agora** e não bloquear criação de personagem por isso.

### Lista consolidada — consultar jogadores (20/11/2026)

1. **D7 — Bestiário:** ficha completa de monstros para jogadores, somente descrição, ou visibilidade por campanha controlada pelo mestre? Não expor estatísticas em prévias automáticas antes da decisão.
2. **Recipientes:** manter itens comuns agora. Perguntar futuramente se querem suborganização opcional, capacidade e peso por recipiente; não implementar sem validação.
3. **Personagens mortos/substituídos:** confirmar regra de um personagem ativo por jogador/campanha, preservando histórico, mortes e ressurreições.
4. **Transferência de controle:** validar com jogadores e mestre como deve funcionar aceite, acesso à ficha e histórico quando personagem muda de controlador ou vira NPC.

Esses quatro itens são **decisões de experiência de jogo**, distintas de tarefas técnicas (testes, autenticação, catálogo e interface). Não interromper o piloto para resolvê-las.

### Pacotes SRD 2014 — primeira implementação de domínio (20/11/2026)

- `src/rules/starting-equipment-2014.ts`: receitas independentes dos pacotes Explorador e Aventureiro de Masmorras, cada componente com ID de item e quantidade; quatro grupos de escolha de equipamento do Guerreiro listados.
- `src/rules/starting-equipment-2014.test.ts`: testes de quantidades, componentes e não mutação da receita.
- **Importante:** os IDs dos componentes são **candidatos** à reconciliação com o catálogo versionado de itens, não itens novos nem definições duplicadas. Antes de adicionar itens ao inventário do criador, resolver e validar todos os IDs no catálogo canônico. Opções de armas marciais e armaduras ainda precisam de expansão em itens concretos; não conceder placeholder como se fosse item real.
- Recipientes continuam itens comuns, sem subinventário. Sem alteração de Supabase, merge ou publicação.

### Piloto de equipamentos: pacotes conectados (20/11/2026)

- O piloto agora oferece seleção de pacote Explorador/Masmorras e cria entradas individuais no inventário com IDs estáveis `starting-pack:<pacote>:<item>`, origem `starting`, sem alterar a definição do pacote.
- Antes da concessão, `resolvePackItems` exige que todos os IDs existam no mesmo registro de regras usado pelo piloto; testes verificam ausência de ID. O piloto adicionou definições **provisórias** para os componentes, sem peso, preço ou características definitivas; **não confundir com catálogo canônico de produção**.
- Adicionar outro pacote inicial é bloqueado enquanto existirem entradas do pacote anterior. Próximos passos: importar itens SRD 2014 auditados e substituir as definições provisórias, completar escolhas de armadura e armas, permitir substituição segura e exibir prévia antes de confirmar.
- Recipientes continuam itens comuns; quatro decisões de experiência de jogo para conversar com jogadores permanecem na seção anterior. PR aberto, sem merge, Supabase ou publicação.

### Decisão — equipamentos iniciais, itens e pacotes usam o mesmo fluxo (20/11/2026)

- **Decisão do responsável:** pacotes, itens avulsos e equipamentos iniciais de classe/antecedente devem ser selecionados **dentro do criador**, com IDs do mesmo catálogo do Compêndio, e concedidos automaticamente como instâncias independentes no inventário da ficha. Não tratar pacotes como botão de compra manual separado do criador.
- **Implementado no piloto:** confirmação do pacote de Guerreiro como escolha de equipamento inicial, via `applyStartingEquipmentSelection`; concessão idempotente e bloqueio de substituição quando o inventário inicial já foi alterado. Testes de concessão, edição e IDs desconhecidos.
- **Limite:** somente o grupo de pacotes do Guerreiro está ligado à UI. Ainda faltam os três grupos de armaduras/armas, itens de antecedente, prévia e confirmação de substituição, catálogo definitivo auditado, salvamento real. A seleção não é aplicada automaticamente ao mudar a opção; requer confirmação explícita.

### Atualização do piloto — quatro grupos de equipamentos do Guerreiro (20/11/2026)

- O criador local exibe escolhas de **armadura, armas marciais, armas adicionais e pacote**, cada uma com prévia dos itens e quantidades. Confirmação aplica os quatro grupos em uma única atualização de rascunho, usando `applyStartingEquipmentSelection` e as mesmas referências de itens registradas no catálogo experimental.
- O registro piloto contém entradas provisórias para todos os componentes; não são definições SRD auditadas. Opções de armas marciais usam **apenas espada longa como amostra**, não a seleção completa de armas permitidas pelas regras.
- Escolhas já concedidas não são substituídas automaticamente. Ainda faltam: catálogo SRD definitivo, armas marciais livres, antecedentes, revisão/substituição assistida, persistência real e testes E2E. Não publicado nem integrado à main.

### Equipamento inicial — manutenção e CI (20/11/2026)

- Corrigidas expectativas fixas de quatro entradas nos testes do Compêndio e snapshot offline: a fixture agora contém itens adicionais necessários ao Guerreiro; os testes usam o tamanho do registro compartilhado em vez de um número antigo.
- `replaceStartingEquipmentSelection` permite **troca explícita e confirmada** de uma escolha de equipamento, preservando itens adquiridos e recusando substituir entradas iniciais consumidas, equipadas ou editadas. Cobertura unitária adicionada. **A UI ainda não expõe esse fluxo de troca**; é uma capacidade do domínio, não funcionalidade publicada.
- A falha de CI anterior era causada por expectativas de tamanho da fixture após a inclusão dos equipamentos. Confirmar o CI do novo HEAD antes de afirmar que os testes passaram.

- **Interface experimental atualizada:** o criador do Guerreiro detecta alterações nas escolhas de equipamento inicial, solicita confirmação antes da troca e usa `replaceStartingEquipmentSelection` para preservar aquisições e bloquear substituições de itens iniciais editados. A confirmação é única para os grupos alterados; o estado do rascunho só é atualizado depois que todos os grupos são validados. Ainda falta testar o fluxo completo no navegador real.

### Teste de interface de equipamentos (20/11/2026)

- Corrigido erro TypeScript TS6133 por variável não utilizada no fluxo de troca.
- Adicionados testes React em `src/dev/character-pilot.test.tsx` para confirmar quatro grupos, idempotência, recusa de substituição e substituição consentida, incluindo bloqueio após alteração da quantidade. Aguardando CI do HEAD; não declarar aprovação antes da execução.

## Decisões de produto confirmadas em 20/11/2026 — aplicação pendente

- **Iniciativa:** somente o mestre tem acesso; jogadores não consultam a ferramenta.
- **Catálogo e Enciclopédia:** pesquisa mecânica de monstros exclusiva do mestre; Enciclopédia da campanha reúne Criaturas (incluindo cultistas e guardas genéricos), Personagens (PCs e NPCs individuais), Lugares, Organizações e Conhecimentos. Inimigo/Chefe são marcadores; não revelar marcadores secretos automaticamente.
- **Conhecimento de criaturas e inimigos:** exclusivamente compartilhado por campanha, nunca individual por personagem. Mestre controla manualmente os níveis nome; nome+descrição; nome+descrição+imagem; dados mecânicos explicitamente liberados. Ação de adicionar à Enciclopédia a partir do Bestiário do mestre; sem duplicar bloco de estatísticas.
- **Identidade pública de PC:** etapa final do criador, com prévia reutilizada na campanha e Enciclopédia. Uma imagem pública; nome, sobrenome, título/alcunha, raça e classe podem ser exibidos, ocultados ou personalizados pelo jogador. **Não mostrar nível**. Descrição pública editável pelo proprietário, distinta de biografia e ficha privadas. Título pode anteceder revelação de nome real; NPCs seguem modelo semelhante sob controle do mestre.
- **Personagens do mestre:** lista somente personagens com ficha própria, ativos/inativos, jogadores vinculados e NPCs com ficha. Ativos são vivos por padrão; inativos recebem status morto ou aposentado. Todos permanecem na Enciclopédia até remoção explícita pelo mestre. NPC narrativo sem ficha só na Enciclopédia; mestre pode criar ficha própria ou vincular bloco do Bestiário (Plebeu/Commoner, Guarda etc.), sem obrigatoriamente inserir na lista de fichas.
- **Administração:** mestre pode criar fichas, vincular ou transferir personagens a jogadores, editar integralmente fichas vinculadas à campanha e transferir itens/quantidades entre personagens, com histórico/auditoria. Não dar acesso às anotações privadas. Saída da campanha deixa personagem inativo até exclusão pelo mestre.
- **Anotações:** pertencem ao usuário, persistem ao sair de campanhas, privadas inclusive perante mestre; separar visualização padrão por modo jogador/mestre, sem apagar ou transferir ao alternar.
- **Inventário:** bolsas, mochilas e recipientes são itens comuns, sem inventários aninhados. Pacotes iniciais expandem em itens do catálogo único.
- **Lixeira:** retenção indefinida até exclusão definitiva manual confirmada; restauração disponível; sem expiração automática.
- **Status:** decisões aprovadas em conversa, **não equivalem a implementação ou RLS validada**. Revisar documentos normativos conflitantes antes de migrar banco. Nenhum merge, deploy ou migração sem autorização explícita.

## Última rodada de implementação (20/11/2026)

- PR #74: corrigido teste de substituição de armadura para alterar o item certo (antes alterava a primeira entrada de inventário, de outro grupo).
- Piloto de criador: reconstitui seleção de equipamentos iniciais a partir do inventário persistido, inclusive ao reabrir; não considera ficha completa sem os quatro grupos de equipamentos. Novos testes de interface para restauração e completude.
- CI anterior ao ajuste: 675 testes aprovados e 1 reprovado; **CI dos commits novos ainda precisa ser conferido**. Piloto continua isolado de produção, sem Supabase.

### Incremento de identidade pública (20/11/2026)

- Criado `src/rules/public-identity.ts`: configuração separada da ficha privada, campos nome/sobrenome/raça/classe com modos real/personalizado/oculto, título, imagem pública e descrição. A projeção utiliza lista explícita de campos; **não inclui nível, PV, inventário ou anotações privadas**.
- Testes `src/rules/public-identity.test.ts` cobrem apresentação padrão, identidade falsa, ocultação independente e não exposição de atributos privados.
- **Ainda não conectado à UI, Supabase, Enciclopédia ou políticas RLS.** Não assumir que a privacidade está garantida em produção antes de implementar consultas seguras no servidor.
- CI do commit anterior `7fc94d4` aprovado; conferir novamente CI do HEAD atual antes de merge. Sem publicação.

### Interface experimental de identidade pública (20/11/2026)

- `src/dev/public-identity-editor.tsx`: formulário isolado para nome, sobrenome, raça e classe reais/personalizados/ocultos, título, URL de retrato, descrição pública e prévia do que os outros jogadores verão. Permite salvar via callback do chamador ou configurar depois.
- `src/dev/public-identity-editor.test.tsx`: testes de prévia, ocultação, personalização e adiamento. Ainda **não integrado ao criador real, persistência, Enciclopédia ou autorização do servidor**; nenhuma identidade pública está publicada por esta mudança.
- Próximo passo: integrar o componente à etapa final do criador e a uma persistência segura separada da ficha, com regras RLS que impeçam leitura dos campos verdadeiros por outros jogadores. Não usar o estado completo do editor como resposta pública; projetar somente `publicIdentityCard`.

### Integração do editor ao criador piloto (20/11/2026)

- O criador experimental `src/dev/character-pilot.tsx` agora abre o editor público opcional; salva a configuração em chave local separada da ficha, vinculada ao ID do personagem, e a restaura ao reabrir. Fonte real do piloto: nome editável, raça Anão, classe Guerreiro, sobrenome vazio; não representa catálogo completo.
- Teste de integração confirma edição, persistência separada e ocultação de classe na prévia.
- **Atenção:** o armazenamento local do piloto não fornece segurança entre usuários. Para produção, não publicar a ficha privada para outros jogadores e aplicar controle de acesso no backend; editor e projeção continuam protótipos.

### Projeção pública da Enciclopédia (20/11/2026)

- `src/rules/public-character-encyclopedia.ts` cria uma entrada de personagem com lista explícita de campos públicos, separando descrição do jogador e histórico narrativo do mestre. Alterar a identidade pública não apaga o histórico do mestre. Testes verificam que nível, PV, inventário e anotações privadas não aparecem na projeção.
- A projeção TypeScript **não garante confidencialidade por si só**: dados privados nunca devem ser retornados a consultas de outros jogadores. Ainda faltam tabela/visão/RPC autorizadas, RLS, testes de banco com papéis distintos e integração real à Enciclopédia.
- PR #74: CI verde no commit `f28afa4`; CI do HEAD após este incremento deve ser consultado. Não houve migração, merge ou deploy.

### Iniciativa exclusiva do mestre — validação com jogadores (20/11/2026)

- **Decisão confirmada com o grupo:** jogadores não verão a iniciativa, inclusive turno, ordem, rodadas, resultados e metadados de combatentes. Menu de jogador: Início, Anotações, Ficha (Inventário como submenu), Compêndio, Menu. Menu do mestre: Início, Anotações, Iniciativa, Compêndio, Menu.
- `src/rules/initiative-access.ts` e testes codificam contrato de leitura e gerenciamento apenas por mestre da campanha correta, retornando negação sem metadados para jogador ou mestre de outra campanha.
- **Ainda não conectado ao painel, rotas, API nem RLS**: a verificação de papel informada no cliente não é autenticação. Na futura implementação, servidor deve consultar vínculo atual e papel autenticado, bloquear SELECT/RPC/Realtime/contagens de iniciativa para jogadores, não apenas esconder menu. Atualização de PV e condições na ficha permanece separada da ordem de iniciativa.
- O plano antigo que menciona iniciativa para jogadores ou acesso a dados de combate deve ser considerado superado por esta decisão; atualizar a arquitetura de produção antes da migração. Nenhuma migração/deploy/merge nesta rodada.

### Contrato de navegação por papel (20/11/2026)

- Criado `src/rules/campaign-navigation.ts` com menus ordenados: mestre — Início, Anotações, Iniciativa, Compêndio, Menu; jogador — Início, Anotações, Ficha, Compêndio, Menu. Inventário é subpágina da Ficha. Testes verificam exclusão da iniciativa do menu do jogador.
- **Ainda não ligado à navegação real** e não é controle de acesso. A aplicação deverá filtrar menus, rotas/abas restauradas e ações; a autorização de dados exige RLS e verificação do mestre autenticado no backend.
- CI verde no commit `b12cfa6e`; conferir o novo HEAD. Sem merge, migração ou deploy.

### Integração experimental de inventário e Compêndio (20/11/2026)

- Criado `src/rules/inventory-compendium-link.ts`: resolução de item por ID ou referência versionada exata, consultando o mesmo catálogo do criador e do Compêndio. ID sem versão retorna `null` quando há múltiplas revisões/fontes; não escolhe uma silenciosamente. Testes de vínculo, ausência e ambiguidade.
- No `src/dev/character-pilot.tsx`, cada item do inventário pode abrir os detalhes da definição canônica do catálogo; teste de interface confirma a chave estável. É apenas o piloto local, não a ficha autenticada.
- Limitação: inventário ainda armazena somente `itemId`; produção deve persistir referência versionada completa por instância para suportar fontes/revisões simultâneas, sem depender da resolução por ID. Dados mecânicos do catálogo ainda não auditados.
- CI do commit `5df177c` estava em execução na última consulta; verificar resultado e HEAD atual. Sem merge, deploy ou migração.

### Entrega — catálogo real de itens SRD 2014 (20/11/2026)

- **Implementado:** `src/catalogue/` (esquema Zod, carregador e `describeItem`), dados em `src/catalogue/data/srd-2014-items.json`, `scripts/build-srd-item-catalogue.mjs` (regenera do legado) e `scripts/verificar-itens-api.mjs` (conferência manual contra a API). Os pilotos do criador e do Compêndio agora usam os **itens reais** em vez de definições provisórias; a busca aceita nome em português (sem acento) e original em inglês.
- **Defeito real encontrado e corrigido:** três IDs de equipamento inicial do Guerreiro não existiam no catálogo (`rations`, `hempen-rope-50-feet`, `light-crossbow`; corretos: `rations-1-day`, `rope-hempen-50-feet`, `crossbow-light`). Teste novo (`equipamento-inicial-catalogo.test.ts`) impede a regressão e compara as receitas de pacote com os pacotes oficiais.
- **Dependência nova:** `zod` 4.6.7 (lockfile atualizado), usada na validação de dados importados. React Hook Form, fast-check e Playwright continuam não instalados: ainda não há formulário complexo, propriedade a testar nem fluxo autenticado que justifiquem.
- **Experimental/pendente:** lista do piloto sem virtualização (578 itens); descrições são resumos derivados; mágicos sem conferência externa; classes, subclasses, raças, antecedentes, magias e criaturas ainda não têm catálogo real. Nenhuma migração, merge ou deploy.

### Entrega — primeira fatia vertical na navegação real (21/11/2026)

- **Branch dependente:** `feat/criador-ficha-navegacao` (sai de `3f5c41c`, PR #74). Não altera as branches dos PRs #75 (Enciclopédia) e #76 (Playwright).
- **Implementado:** `src/criador/` (criador guiado, armazenamento experimental, catálogo e rótulos pt-BR), `src/Compendio.tsx` (seção e página de item), abas `criador:`/`item:`, entrada em Personagens, títulos de aba, estilos. Testes: `src/criador/criadorGuiado.test.tsx`, `src/criador/armazenamento.test.ts`, `src/compendio.test.tsx`.
- **Honestidade:** caminho do usuário testado em jsdom (desktop e celular), **não** em navegador real (Playwright é do PR #76). Armazenamento local não é segurança entre usuários. Só o Guerreiro; raça e antecedente ilustrativos.

### Entrega — persistência segura das fichas (21/11/2026)

- **Branch:** `feat/criador-persistencia-supabase`, a partir de `feat/criador-ficha-navegacao` (PR #78 → #74). Sem merge, deploy ou migração aplicada; nenhum arquivo dos PRs #75/#76/#77 foi tocado.
- **Banco (proposto):** `0007` (reconstrução da base já aplicada) e `0008` (políticas, gatilho, funções, grants) com rollbacks; 24 testes PGlite (dono, outro jogador, mestre, outra campanha, ex-participante, anônimo, conflito, imutabilidade, identidade pública, isolamento, reversões).
- **Cliente:** `FichasApi`, repositório servidor/local, recuperação local, envio dos rascunhos antigos, ficha pública para quem não é dono.
- **Funcional de verdade?** No código e em PostgreSQL isolado, sim. **No Supabase hospedado, não** até a 0008 ser aplicada.

### C-E2E-01 — nomes acessíveis do inventário (corrigido, 21/11/2026)

Achado do Codex (PR #79): o nome acessível dos botões do inventário não continha o texto visível (WCAG 2.5.3 / axe `label-content-name-mismatch`). **Corrigido em `src/criador/CriadorGuiado.tsx`** com os nomes recomendados: `Consultar no Compêndio: <item>`, `+1: adicionar quantidade de <item>`, `−1: remover quantidade de <item>`; também `Enviar para a campanha: <nome>` na lista de rascunhos locais. Testes: `criadorGuiado.test.tsx` (inventário e todas as seções) e `persistenciaServidor.test.tsx` verificam que **todo botão com `aria-label` contém o texto visível** e que as ações seguem funcionando; o teste falha com os rótulos antigos (verificado). **Não validado com axe real nesta branch**: a suíte `test:creator` do PR #79 precisa ser reexecutada sobre este HEAD (seus seletores/nomes antigos de inventário também precisam acompanhar). Fora do escopo e ainda abertos: C-E2E-02 (patches do #77) e o piloto de desenvolvimento `src/dev/character-pilot.tsx` (rótulos `Adicionar quantidade ...` com texto visível `+1`).

### Revisão do PR #80 — bloqueios de segurança da 0008 (21/11/2026)

Corrigidos (ver `CRIADOR-FICHA-INVENTARIO.md`): `meta` da nota presa à existência da ficha (não ao marcador), INSERT/UPDATE com `notes.deleted_at IS NULL`, `p_meta` estrito e título derivado no servidor, 0007 alinhada ao remoto. 43 testes de RLS em PostgreSQL isolado com 6 mutações detectadas. **0008 continua NÃO aplicada** (aguarda comparação do DDL real e autorização).

**Ação final do PR #80:** `private.nota_guiada_ativa` com dono + meta válido; CHECK global removida para não travar notas legadas; 48 testes de RLS. 0008 continua NÃO aplicada.

### Entrega — catálogo de magias, monstros e itens (22/11/2026)

- **Branch:** `feat/catalogo-dnd-2014` (a partir da `main` com o PR #82). Frente exclusiva do catálogo: **não altera** autenticação, campanhas, navegação global nem o criador. O contrato para o criador está em `src/catalogue/contratos.ts` e `docs/CATALOGO-DND-2014.md` (seção 4).
- **Impacto em outras branches:** o clique em um item do Compêndio agora abre o detalhe no painel (antes abria uma aba `item:`); a aba continua disponível por "Abrir em nova aba" e é o destino de "Consultar no Compêndio" do inventário. Testes E2E que clicavam em `Abrir <item>` precisam usar o nome acessível novo (texto visível do cartão); o E2E do criador deste repositório já foi ajustado (não executado ainda).
- **Auditoria (PR #84, 2ª etapa):** traduções auditadas contra o original (57 textos do legado substituídos), campos mecânicos comparados com a SRD API/PDF (10 fichas corrigidas), Burro marcado como legado, aliases de ids, `formas` nas fichas compostas, E2E de monstro→magia. Ver seções 7 a 10 de `docs/CATALOGO-DND-2014.md`.
- **Atualização (PR #84):** 5 listas de classes confirmadas no PDF do SRD; monstros 100% traduzidos; links monstro→magia; conciliação 334×323 documentada; sem seletor de sistema (decisão do PR #83).

### Alpha — estabilização (23/11/2026, branch `alpha/estabilizacao-20261123`)
- **Entregue:** PRs #130 (navegação) e #131 (cartões/lista) integrados com 4 testes corrigidos; migrações 0009–0011 (combate, encontros, status de combate na ficha) com rollback e testes RLS/reversão/compatibilidade; modo nuvem de combate e encontros com salvamento automático e conflito explícito; sincronização autorizada de PV/condições com a ficha; Voltar/Avançar verificado; guardas do construtor de monstros consertadas; harness do Supabase real (CI) estendido.
- **Pontos de entrada:** `docs/ALPHA-CHECKLIST-20261123.md`; `src/useLinhaRemota.ts`, `src/linhaRemota.ts`, `src/encontrosRemoto.ts`, `src/statusCombate.ts`, `src/nuvem.tsx`, `src/Iniciativa.tsx`, `src/EstadoCombateFicha.tsx`; `supabase/migrations/0009–0011`, `scripts/alpha/run-local.mjs`.
- **Achados críticos:** cadastro público aberto no servidor; banco hospedado sem 0008 (persistência de personagens no servidor) e sem 0009–0011. Ver §0 do checklist.
- **Próximo passo:** com autorização, desligar cadastro, esclarecer o registro de migrações, aplicar 0008→0011 e ativar `VITE_COMBATE_REMOTO`; depois, E2E de navegador contra o Supabase real.

## Etapa 1 — Iniciativa e Encontros (24/11/2026, branch `feat/alpha-iniciativa-encontros`, PR #137, issue #134)

- **Entrega 1 (Iniciativa) concluída:** retratos padronizados, resultado das rolagens, controles compactos de dano/cura, barra de PV animada com sinal de PV baixo, turno atual em destaque, exportação JSON discreta, seleção parcial de encontros preparados. Testes: `src/iniciativaMelhorias.test.tsx`. Pendente: conferência visual da responsividade (container queries) no navegador.
- **Entrega 2 (Encontros: estrutura e interface) concluída:** lista + página na mesma aba, nome e descrição, criaturas do Bestiário ou avulsas com edição individual (nome, quantidade, PV, CA, notas), quantidade compacta, retratos padronizados, envio parcial. Testes: `src/encontrosPagina.test.tsx`. Os testes de tela e E2E antigos foram ajustados ao novo fluxo (criar abre a página; enviar tudo fica na lista).
- **Próximas:** entrega 3 (estados Preparado/Em andamento/Em combate/Concluído, configuração original x estado atual, restaurar/duplicar, vínculo com a Iniciativa) e entrega 4 (loot por criatura, recipientes, recompensas, estados Disponível/Encontrado/Coletado/Distribuído). Se alguma exigir migração: preparar, validar em ambiente isolado e pedir autorização antes de aplicar.
- **Entrega 3 (estados e persistência) concluída em 24/11/2026:** ver DEC-021. Testes: `src/estadoEncontro.test.tsx` e caso novo em `src/iniciativaNuvem.test.tsx`. Correção do CI: o E2E "navegação e responsividade" falhava desde a entrega 1 porque `getByText('Goblin', exact)` passou a casar também o seletor de encontros preparados; os specs agora escopam à lista "Ordem de iniciativa" (confirmar no CI; Chromium não está instalado localmente). Pendências: reflexo do estado na ficha do mestre não se aplica; loot/recipientes na entrega 4.
- **Entrega 4 (loot e recipientes) concluída em 24/11/2026:** ver DEC-022. Código: `src/loot.ts`, `src/LootEditor.tsx`, `src/LootEncontro.tsx`; testes: `src/loot.test.tsx`. CI da entrega 3 verde (3 workflows). Fora do escopo desta etapa (pendentes): distribuição automática para inventários/fichas, ligação com Anotações (dungeon/salas) e Documentos, escolha do personagem destinatário na distribuição. Etapas 2 a 6 aprovadas, não iniciadas.


## Revisão efetiva da etapa 1 — #138 / PR #139 (24/11/2026)

Branch `fix/138-iniciativa-encontros`, base auditada `bb634d0`. Issue e quatro comentários consultados; todos os 13 arquivos do diff original revisados. Não presumir que os 28 commits originais estavam validados: a primeira execução revelou 25 testes falhando e um worker encerrado por falta de recursos; a execução com dois workers e as correções eliminaram as falhas. Mudanças e compatibilidade: DEC-023.

Validação local: 1.534 testes unitários/integração/RLS aprovados; E2E principal 66 aprovados, 2 saltos previstos no teste de três painéis em celular. Cenário obrigatório com cinco goblins/líder validado nas quatro larguras, inclusive recarga. Capturas reais inspecionadas; corrigidos alinhamento com notas e altura da barra em painel estreito. TypeScript, build e tipos E2E executados; confirmação final/CI deve corresponder ao HEAD publicado.

Sem escrita em Supabase hospedado, sem alteração do legado e sem migrações. O backend E2E é sintético, com requisições externas bloqueadas; sincronização em duas sessões foi verificada nesse ambiente e não representa teste contra contas reais de produção. Entrega automática de loot, Anotações/Documentos e demais etapas permanecem fora do escopo. Merge e publicação do PR #139 autorizados pelo William após validação completa.

Compatibilidade SQL adicional: 24 testes de `supabase/encontros-rls.test.ts` aprovados, incluindo leitura/gravação do líder com PV feridos e bloqueio de jogador, outro mestre e usuário estranho nos campos novos. Nenhum SQL hospedado executado.

Resultado final local: 1.534 testes aprovados, nenhum falho ou pendente; build (TypeScript + Vite) e tipos E2E aprovados. E2E principal: 66 aprovados/2 saltos previstos; reconferência visual final: 6 aprovados/2 saltos. Criador: 95/96 na rodada completa e o único timeout de 30 s (Maga, 1024 px) passou isolado com um worker, sem mudar código ou aumentar limites. Qualidade nas larguras 320/1440: 23 aprovados/7 saltos previstos por papel/largura. Avisos de tamanho dos chunks e anotações de tree shaking de Zod preexistentes continuam não bloqueantes. CI do commit original `bb634d0` foi conferido: validação e E2E falhavam; stack Supabase isolada estava aprovada. Revalidar todos no SHA desta correção antes do merge.


### Correção após CI do `e69dadf`

O CI identificou uma falha de importação de `catalogueCampaignGate.test.tsx`: as 1.534 asserções anteriores passaram, mas a contagem de asserções sozinha não revelava esse arquivo que não carregou. O teste usa mock parcial do catálogo e a nova referência ao bestiário antecipava a inicialização. `MonstroPagina` agora importa a fonte sob demanda, somente quando a ficha é aberta; a barreira de campanha continua antes disso. Conferir também arquivos/suítes com falha, não apenas `numFailedTests`.

Verificação da correção: oito testes de barreira/identidade aprovados, build aprovado e os dois E2E de abertura de ficha em três painéis aprovados. Suíte completa reexecutada; resultado definitivo e publicação devem ser conferidos nos checks do SHA final do PR #139, que permanecem condição do merge. Não houve alteração de mock para esconder a falha nem redução de cobertura.


## Correções de usabilidade após #139 — 24/11/2026, local

Base `429c2c5`, branch `codex/iniciativa-busca-controles`. Pedidos: ações de turno imóveis; modos discretos; pesquisa única com fontes e cadastro manual explícito; personagens realmente disponíveis; loot de baú/criatura visível com botão contextual; faixa fixa cobrindo toda a largura interna e botões compactos em meia tela. Implementação e motivos: DEC-024.

A causa dos personagens ausentes era o consumo exclusivo de AventureirosContext sem provider na aplicação. A fonte agora reutiliza o adaptador da campanha via API autenticada; teste inclui criação de registros em memória sem provider explícito, exclusão de outra campanha e de fichas privadas. Não houve acesso a dados reais ou migração.

Validação local concluída: 1.541 testes aprovados em 126 arquivos, nenhuma falha de importação ou asserção; E2E principal 74 aprovados/2 saltos previstos; rodada visual final 10 aprovados/2 saltos (cliques na mesma coordenada, busca de personagens sem contexto injetado, loot visível, cobertura de todas as bordas e ações de 36 px em meia tela). Qualidade a 320/1440: 23 aprovados/7 saltos previstos. Build/TypeScript e tipos E2E aprovados. Capturas inspecionadas e preservadas fora do repositório. Sem push/deploy; Android físico e sessões reais hospedadas não foram utilizados.


## Refinamentos finais da Iniciativa — PR #140

Busca sob demanda por categoria, PV de personagens exclusivamente da ficha, retratos ampliados sem aumentar a altura da faixa, remoção do indicador textual redundante de turno e do indicador/exportação rotineiros de nuvem. Preservar persistência, recuperação e alertas de falha. Validação e merge ainda pendentes.

### Backlog aprovado: configurações da Iniciativa (etapa futura)

Engrenagem discreta no cabeçalho, preferências por mestre: iniciativa automática/manual separadamente para monstros e jogadores; rolagem individual/coletiva de criaturas iguais; PV iniciais de monstros pela média, dados ou entrada manual; valor padrão de dano/cura; visibilidade e salto de turnos de derrotados; cartões/lista; lados separados/unificados; tamanho dos retratos e animações; confirmações de ações destrutivas (preservar salvaguardas críticas). PV de personagens sempre da ficha. Preferências não devem alterar retroativamente combates existentes. Não implementar no PR #140; priorizar validação da etapa 1 e seguir para Personagens, Fichas e Inventário.

### Finalização do PR #140 — revisão de 24/11/2026

Retomada pelo HEAD `9e3caef`, 17 commits e três workflows consultados. Validar projeto/Alpha isolado verdes; E2E falhou. Artefatos de `85abd88` inspecionados: loot correto e visível (25 peças de ouro no Baú dourado); seletor com `has` reintroduzia a região ancestral no escopo do recipiente. Corrigido pelo nome acessível da região, com quantidade e fechamento do diálogo verificados.

Faixa: passo CSS compartilhado com a transformação (112 px amplo / 88 px estreito), retratos 80/96 px no painel amplo, 60/72 px no estreito, texto 12/14 px. Linhas fixas evitam crescimento do cabeçalho ao mudar turno; regressão mede retângulos renderizados, centralização, espaçamento e tamanhos ao avançar/voltar e em dois/três painéis. DEC-025 consolida as decisões anteriores.

Validação local: 126 arquivos e 1.541 testes aprovados; TypeScript/build aprovados. E2E local tentou executar, mas Chromium foi bloqueado por restrição de sockets; download da versão Playwright recebeu HTTP 403. Navegador disponível não alcançou o servidor local. Pedido de execução fora da restrição foi rejeitado pela política do ambiente. Portanto a geometria e a revisão visual final exigem evidências do CI antes da integração. Não declarar as capturas antigas como validação do CSS final. Merge autorizado somente com os três workflows verdes no HEAD final. Nenhum banco hospedado alterado. Configurações futuras e próxima etapa não iniciadas.


Revisão visual dos artefatos de `deb8120`: retratos/centralização passaram nas quatro resoluções e em dois/três painéis; os três workflows ficaram verdes (80 E2E principais + 4 saltos, 96 criador, 88 qualidade + 32 saltos previstos). A inspeção encontrou rótulos de controles encostados no desktop e ações cortadas no terceiro painel a 1024 px. Ajuste final permite quebra estável dos controles quando falta largura, reduz a tipografia dos rótulos e reserva espaço para o contorno azul. Regressão passa a conferir limites de TODOS os botões e overflow interno de rótulos. Validar novamente este HEAD antes de integrar; o verde anterior não aprova o ajuste final.


## Otimização de CI — 24/11/2026

Primeira fase: as três suítes Playwright executam em jobs paralelos com fail-fast desativado e artefatos separados; publicação usa uma instalação, testes e um único build com configuração oficial. Nenhuma cobertura removida, nenhuma alteração de banco ou permissões. O atraso de propagação do Pages permanece por causa da falha histórica documentada no workflow. Medir duração e verificar checks obrigatórios após CI; nomes dos jobs E2E mudam pela matriz. Próxima fase: classificação conservadora de impacto e prévias isoladas, sem dispensar validação de segurança de mudanças desconhecidas. Não considerar ganho medido nem deploy validado antes da execução real.

## PR #142 — controles compactos de turno (25/11/2026)

Causa das 2 falhas do E2E principal: a regra de container forçava a linha própria para as ações até 440 px de painel, o que deixava a faixa fixa com 237 px (limite 230) em meia tela; em três painéis o rótulo "Próximo turno" não cabia no botão. Correção: em meia tela, Rodada e ações dividem a linha; só abaixo de 300 px as ações ganham linha própria, sem o ícone e com botões de 30 px. Testes não foram alterados. Execução local do Playwright é possível com o Chrome instalado (`use.channel: 'chrome'` em uma configuração local não versionada), sem baixar navegadores.
## PR #144 — build experimental isolado (25/11/2026)

`vite build --mode preview-demo` gera um artefato estático em `/` que entra direto como mestre (`?demo=jogador` para jogador), com dados fictícios e faixa "PREVIEW EXPERIMENTAL". Isolamento em três camadas: `supabase.ts` nunca cria o cliente nesse modo; `vite.config.ts` apaga URL, chave e `VITE_COMBATE_REMOTO` na compilação (mesmo que existam no ambiente); `scripts/check-preview-demo.mjs` recusa credencial/projeto real no artefato e qualquer requisição para fora, em celular e desktop, para mestre e jogador, sem erros de página. O build oficial é verificado por `scripts/check-build-oficial.mjs` (sem faixa nem dados da demonstração), em `validar.yml` e `pages.yml`; `tests/fluxo-github.test.ts` cobre as garantias. PWA: o 2.0 hoje não tem manifesto nem service worker (só `index.html` e assets), então não há cache offline a validar.

## PR #145 e otimização do CI (25/11/2026)

Classificador com efeito real (níveis no README), classificador lido da base do PR, falha fechada, suíte do criador em duas metades, agenda diária 06:00 UTC e pilha Supabase isolada sem serviços ociosos.

Tempos **medidos** (duração do workflow, uma execução cada; há variação entre runners):

| Workflow (PR, nível completo) | Antes (3dd06df / e8fd540) | Depois (b177b29) |
|---|---|---|
| E2E e responsividade | 204 s / 239 s | 171 s |
| Alpha Supabase isolado (subida da pilha) | 202 s (87 s) / 198 s (79 s) | 189 s (73 s) |
| Validar projeto | 103 s / 93 s | 113 s (inclui a classificação) |
| Preview experimental | 54 s / 51 s | 58 s |
| Workflow mais longo do PR | 204 s / 239 s | 189 s |

Publicação (push na `main`): 143 s em 07d8dff e 152 s em c04f340, sem mudança neste PR. A diferença da pilha Supabase está dentro da variação observada; não declarar ganho. Os 91–93 s do teste do Supabase isolado vêm de um token com validade de 60 s, parte do cenário testado. **Não medidos:** níveis quick e functional (nenhum PR desses níveis rodou ainda).

Avaliado e não implementado: cache dos navegadores Playwright (a instalação mediu 14–39 s e a parte de dependências do sistema continuaria; ganho não demonstrado) e merge automático (a `main` não tem proteção de branch; exige configuração do dono no GitHub). Reexecutar só o que falhou já é nativo ("Re-run failed jobs"; a matriz não cancela as outras suítes) e execuções obsoletas já são canceladas por `concurrency`.

Retomada de Personagens, Fichas e Inventário: [PLANO-PERSONAGENS-FICHAS-INVENTARIO.md](PLANO-PERSONAGENS-FICHAS-INVENTARIO.md).

## Refinamentos visuais da Iniciativa (25/11/2026, branch fix/iniciativa-alinhamento-filtros)

- Controles de turno: Rodada à esquerda e o grupo no extremo direito do painel, na mesma linha (o limite antigo de 780 px na barra e a regra que jogava as ações para outra linha foram removidos). Abaixo de 330 px de painel o botão azul mostra só a seta, com o mesmo nome acessível.
- Categorias da busca: componente reutilizável `src/BarraExcedente.tsx` (ResizeObserver sobre a largura do componente). O que não cabe vai para o menu "Mais categorias", colado ao último filtro visível; sem rolagem horizontal. Fecha ao escolher, clicar fora ou Escape; a seleção oculta fica marcada.
- Testes: `src/barraExcedente.test.tsx` e `e2e/iniciativa-layout.spec.ts`. Specs antigos passaram a escolher categorias por `escolherCategoria` (abre o menu em telas estreitas); nenhuma verificação foi removida.
- Desenvolvido em uma worktree separada porque o clone principal tinha alterações em andamento de outra sessão em `supabase/`.

## Menu de ações do turno (25/11/2026, branch fix/menu-acoes-turno)

Regressão visual após o #146: o menu encolhia até os 36 px do botão "…" e o texto vazava. Agora usa o visual de `.barra-menu` (o do menu de categorias), ancorado à direita do botão, com largura do conteúdo limitada ao painel (`100cqw`). O fechamento por clique fora e Escape passou ao gancho compartilhado `src/useFecharMenu.ts`, usado também por `BarraExcedente` (mesmo comportamento). Regressão geométrica em `e2e/iniciativa-layout.spec.ts` (falha sem a correção). Observação não corrigida: em painel forçado a 210 px, mais estreito que as divisões testadas, o número em "Rodada N" fica parcialmente sob os botões.

## Início da campanha — conclusão (25/11/2026, branch feat/inicio-campanha-capa)

A branch `feat/alpha-inicio-campanha` já estava integrada pelo PR #133 (`9be2195`, arquivos idênticos). Concluído sobre ela: DEC-026. Código: `src/CapaCampanha.tsx`, `src/CampaignHome.tsx`, `src/capa.ts`. Testes: `src/capaCampanha.test.tsx`, `supabase/capa-enquadramento.test.ts`, `e2e/inicio-campanha.spec.ts` (gera capturas em `test-results/`) e um caso novo no Supabase isolado.

**Pendente de autorização:** aplicar `supabase/migrations/0012_campaign_cover_framing.sql` ao projeto 2.0 (`gwcttjlxzelzjhbuitmi`). Até lá, a capa funciona como antes (recorte destrutivo). Próxima prioridade: personagens, fichas e inventário (`PLANO-PERSONAGENS-FICHAS-INVENTARIO.md`).

## Ajustes do Início após o PR #149 (25/11/2026, branch feat/inicio-ajustes)

Descrição e aventureiros na largura toda (todos os autorizados, sem limite); Diário e Participantes em metades, empilhados abaixo de 720 px de painel; cartões de participantes iguais; "Sair da campanha" no menu "…" **com confirmação** (antes saía sem confirmar); degradê da capa em vários passos. Enquadramento inalterado. Os atalhos do mestre que já existiam foram mantidos (nenhum novo).

## Personagens: lista única e Aventureiros (25/11/2026, branch fix/personagens-unificados)

Causas: o Início lia só notas publicadas (a identidade guiada nasce privada); a mensagem de vazio contava só perfis simples; o mestre não abria a ficha porque a página exigia a nota privada, que ele não lê. Agora `src/personagensCampanha.ts` junta, pelo mesmo id, `notes` e `character_sheets` já filtrados pela RLS (nenhum registro novo ou copiado). Aventureiros: publicados + guiados cuja ficha quem olha pode ler, com aviso "não publicado"; perfis simples seguem aparecendo só quando visíveis para a campanha. Personagens: uma lista, um cartão por personagem. A Iniciativa não mudou (DEC-024 exclui fichas privadas): decidir se o mestre deve poder escolher nela os guiados não publicados. Sem migração.

## Iniciativa: combate vazio e PV ao remover (25/11/2026, branch fix/iniciativa-vazia-pv)

O menu e **Finalizar combate** continuam disponíveis com o combate sem participantes; só turno anterior, próximo turno e reiniciar rodadas exigem um turno. Remover um personagem grava **antes** os PV atuais em `currentHp` da ficha (mesmo `gravarPvFicha`, com revisão): a linha fica bloqueada durante a gravação; se falhar, o mestre escolhe entre manter no combate (nada se perde, inclusive ao recarregar) ou remover descartando. Reentrada continua lendo os PV da ficha. Testes em `src/iniciativaFicha.test.tsx` e `src/iniciativaNuvem.test.tsx`. Sem migração. Limite: não testado contra sessões reais hospedadas.

## Barras do celular sem oscilação (25/11/2026, branch fix/mobile-barras)

Causa: ocultar as barras encolhia as linhas do grid, a área de rolagem crescia 116 px e, no fim da página, o navegador corrigia o `scrollTop`; isso era lido como "rolar para cima". Mantido o contrato (área entre as barras visíveis; tela toda quando ocultas) e o mesmo espaço volta como respiro interno da rolagem, então o limite não muda. A lógica também ignora o efeito elástico e correções por mudança de altura da janela. Como a oscilação mascarava um caso sem saída, as barras agora reaparecem ao trocar de tela e quando a página deixa de ter rolagem. Testes: `src/chromeHide.test.tsx`, `e2e/barras-mobile.spec.ts` (falha sem a correção). `navigate` dos E2E passou a subir a página antes de abrir o menu, como a pessoa faria. Não testado em celular físico (Safari e barra de endereço do Android).

## Integração dos PRs #151 a #154 (25/11/2026)

Integrados nesta ordem, cada um com o CI completo verde no commit exato: #151 Início (`62ea918`), #152 Personagens (`8fbc0ed`), #153 Iniciativa (`40b69da`), #154 barras do celular (`72ef5e4`). Conflitos só em blocos acrescentados no fim de `src/style.css` e deste arquivo; os dois lados foram mantidos. No #153, a primeira execução falhou em uma metade da suíte do criador; a mesma metade passou localmente (48/48) e a segunda execução, sem mudança de código, passou: tratada como intermitência **não diagnosticada** (observar se repetir).

A migração `0012` **já está aplicada** em produção (informação do responsável); não reaplicar. As frases anteriores que a dão como proposta são registro histórico.

Mantidos por decisão do responsável: os atalhos atuais do mestre no Início e a regra de privacidade da Iniciativa. **Não iniciar funcionalidades novas:** navegação, identidade pública, anotações e organização da ficha do jogador estão sendo redefinidas.

## Identidade pública e ficha em três abas (25/11/2026, branch feat/ficha-identidade-tres-abas)

Decisões em [DEC-027](../DECISOES-E-ARQUITETURA.md); direção de produto em [ESPECIFICACAO-EXPERIENCIA-JOGADOR](ESPECIFICACAO-EXPERIENCIA-JOGADOR.md) (conteúdo do PR #155 integrado nesta branch). Nova orientação do responsável: **na Alpha não há retrocompatibilidade**.

- **Feito:** atalhos redundantes removidos; avisos de privacidade por papel; identidade pública redefinida com alcunha; retrato único; ficha de jogo com três abas, salvamento automático, estado preservado e gesto no celular.
- **Banco:** nenhuma migração nova; nada aplicado em produção. A 0012 já estava aplicada.
- **Testes locais:** 1639 unitários, 116 E2E principal (16 pulados), 88 de qualidade e 112 do criador, build oficial sem modo de demonstração. **Não testado:** celular físico e sessão real no Supabase hospedado (a identidade nova foi validada com a API em memória; o formato gravado respeita as chaves da 0008, coberto por teste, e as regras do banco continuam em `supabase/character-sheets.test.ts`).
- **Pendências:** nível público e nomes próprios de chaves (migração); envio de arquivo de retrato; atualização do cartão público quando o mestre edita; história/personalidade; talentos e magias concedidos; loot (distribuição, transferência, sintonização); perfis simples antigos não usam a ficha nova; Início do jogador da seção 2 da especificação; preservação de tela em outras áreas além da ficha.

## PR #156: falha do E2E `creator, 2` resolvida e publicada (25/11/2026)

**Teste:** `e2e/creator/ficha-jogo.creator.ts` (três abas, estouro horizontal), só na largura 701 px, onde o painel da ficha tem cerca de 230 px.
**Causa:** o cabeçalho da ficha era uma grade com coluna implícita `auto`. A largura natural do seletor de condições depende da fonte; com a fonte do Linux no CI passava da largura do painel e alargava o cabeçalho inteiro (cortado à direita). Defeito real de layout, não do teste.
**Correção:** `src/ficha/ficha.css`: coluna `minmax(0, 1fr)` no cabeçalho e `min-width: 0` no seletor. Reproduzido localmente alongando o texto do seletor (mesmos elementos estourando) e conferido depois da correção. Teste inalterado.
**Diagnóstico futuro:** a suíte creator usa no CI o relator `github`; o teste e o erro aparecem como anotação pública, sem precisar baixar o log.

O PR só é integrado à `main` com todos os checks verdes no HEAD exato. Nenhuma migração.

As pendências de produto estão na seção anterior e na DEC-027. As configurações `playwright.local*.config.ts` (Chrome instalado, sem vídeo) são locais e não versionadas. O outro clone, `compendio-5e`, tem alterações não commitadas de outra sessão: não mexer.

## PR #157 — Refinamento da ficha

Decisões em [DEC-028](../DECISOES-E-ARQUITETURA.md). **Prazo da Alpha: 12/12/2026.**

- [PR #157](https://github.com/Waudz/compendio-5e/pull/157) validado em `ab8fb11`, integrado à `main` em `da11592` e publicado pelo [GitHub Pages](https://github.com/Waudz/compendio-5e/actions/runs/45739662427).
- Supabase `compendio-5e`: migração `0013_ficha_moedas_itens_identidade` aplicada antes do merge, versão remota `20261126020119`. As impressões digitais de 7 fichas, notas e 2 campanhas coincidiram antes e depois. O rollback foi exercitado em banco isolado. A reversão precisa acompanhar a volta do aplicativo anterior.
- A API valida quantidades inteiras positivas e IDs únicos. O jogador pode equipar, consumir ou remover uma entrega restrita mantendo os dados da instância. Concessões dependem do mestre. O servidor projeta a identidade pública e descarta textos de campos ocultos. Cinco fichas privadas passam a exibir o cartão na próxima gravação.
- `campanha 2` usa PC, PP e PO. A configuração só altera as moedas exibidas.
- Validação: 1.677 testes locais, build oficial, Preview isolado, suítes Playwright e Auth/REST/JWT/RLS em Supabase isolado. A tela de acesso do build publicado carregou no navegador. Em produção, a leitura sob RLS confirmou acesso do dono e isolamento de outro jogador. Gravações de teste ocorreram em ambiente isolado.

**Pendências:**
- Pendente validar em celular físico e em sessão autenticada na interface hospedada.
- Imagens: os arquivos continuam no armazenamento do 1.0; falta cópia própria e a importação do acervo guardado no aparelho ([IMAGENS-V1](IMAGENS-V1.md)).
- Arquivo de retrato substituído ou removido não é apagado do bucket.
- Jogador que reduz a quantidade de um item restrito não consegue repô-la sozinho (por desenho: o mestre entrega).
- Efeito de poções: só a de cura está descrita no catálogo; a de escalada aparece sem efeito (não inventado).
- Typo de origem no catálogo de magias (`1d1O` em Raio de Fogo): a ficha mostra corrigido; a página do Compêndio ainda mostra o original.
- Perfis simples antigos não usam a ficha nova; loot, sintonização, galeria colaborativa, anotações e rolador ficam para depois.


## Próxima grande etapa — Encontros, Iniciativa e Loot

Seguir a [especificação aprovada](ESPECIFICACAO-ENCONTROS-INICIATIVA-LOOT.md). A primeira entrega começa pela auditoria das estruturas, migrações e testes existentes de identidade individual, vínculo com combate e persistência. Usar essa auditoria para delimitar a individualização, preservando IDs, estado e recompensas já entregues. O cenário de aceitação de loot continua sendo distribuir os equipamentos do primeiro goblin para Lydia e as moedas para Caleb, com baixa e histórico persistentes, sem alterar o segundo goblin.

## RETOMAR AQUI — Personagem definitivo (branch feat/personagem-definitivo)

Decisões em [DEC-029](../DECISOES-E-ARQUITETURA.md). **Não mesclar nem publicar antes da revisão e da aplicação da 0014.**

### Aplicar a 0014 (responsável pela revisão)
1. `supabase/verificacao/0014_antes.sql` (somente leitura): exigir `pre_requisitos_ok = sim` e `ja_aplicada = não`; guardar as impressões digitais.
2. Aplicar `supabase/migrations/0014_vitais_inventario_atomicos.sql` dentro de `begin; ... commit;` (não reaplicar as anteriores).
3. `supabase/verificacao/0014_depois.sql`: todas as linhas `ok_*` = sim (inclui `ok_protecoes_pv_e_app_antigo`) e as digitais iguais às de antes (comparar antes de alguém usar o app).
4. Integrar o PR **logo em seguida** e confirmar o Pages. **Ordem obrigatória: banco primeiro, depois o aplicativo.** Publicar antes da 0014 deixa PV, uso e transferência de itens com erro (funções inexistentes). No intervalo depois da 0014, o aplicativo antigo recebe erro ao tentar mudar PV (não perde nada em silêncio).
Reversão: `supabase/rollback/0014_vitais_inventario_atomicos_down.sql` junto com a volta do aplicativo anterior.

### Limites e pendências reais
- Tempo real: a interface foi exercitada com as fichas de demonstração (duas abas) e a API em memória; as funções do banco em PGlite e no Supabase isolado do CI. **Não testado** com sessões reais no projeto hospedado nem em celular físico.
- O máximo de PV é calculado no aplicativo; o servidor o limita ao teto de 30 × nível (DEC-029). Um jogador ainda pode informar um máximo maior que o real dentro desse teto; validar o valor exato exigiria as regras no banco.
- Regras: raças e classes são as do SRD 5.1; **uma subclasse por classe** (o 1.0 tem 8 extras com resumos próprios, ainda não trazidas); sem multiclasse; talentos só como melhoria já suportada pelo motor ou concessão do mestre.
- Origens além do Acólito: dados mecânicos e resumos próprios do 1.0; o texto das características e variantes oficiais não é distribuído.
- Imagens: seguem no armazenamento do 1.0 ([IMAGENS-V1](IMAGENS-V1.md)); falta cópia própria e a importação do acervo guardado nos aparelhos. Envio de imagem própria só existe para retrato e capa; itens, monstros, NPCs, locais e organizações ainda não aceitam envio (o editor está pronto para reutilizar).
- Arquivos de retrato substituídos não são apagados do bucket.
- A tabela `character_combat_status` e suas funções (0011) permanecem no banco, sem uso pelo aplicativo.

### Revisão final antes do PR (26/11/2026)

**Corrigido nesta revisão:**
- **Capa da campanha:** o novo editor abria atrás da janela "Editar campanha" (modal) e ficava sem clique nem teclado; o mestre não conseguia enquadrar. Agora abre dentro da janela, e Escape fecha só o editor.
- **Janela da campanha:** o campo de arquivo nativo aparecia cru e estourava a largura no celular (o estilo que o esconde só valia no criador).
- **Menu de ações do item:** perto do fim da tela ficava atrás da barra inferior; agora abre para cima. "Deslocamento" não quebra mais no meio a 320 px.
- **0014:** teto de PV no servidor e recusa visível da gravação do aplicativo antigo (DEC-029). Sem isso, o fim de combate numa aba antiga responderia "salvo" e perderia os PV.
- **Testes:** E2E da capa migrado para o editor único (mesmas verificações, mais clique real e Escape); teclado do criador decide pela navegação visível (a 700 px o painel mostra a coluna de etapas); a demonstração segura a trava entre abas até o `localStorage` se propagar (duas operações simultâneas perdiam uma só no simulador; no banco quem garante é o bloqueio de linha).

**Compatibilidade com o aplicativo antigo:** o 2.0 **não tem service worker nem manifest**: não há PWA instalada com cache próprio. O risco é de abas abertas ou do pacote em cache do navegador (GitHub Pages usa cache curto no HTML). Com a recusa acima, a aba antiga mostra erro; recarregar resolve. Ela também não mostra retratos com enquadramento (`#enq=`), só o ícone.

**0014 em isolamento:** PGlite (aplicação sobre 0001–0013, conferências antes e depois com impressões digitais iguais, autorização, atomicidade, idempotência, reversão e reaplicação). Auth/REST/JWT/RLS no Supabase isolado: roda no CI do PR (`Alpha Supabase isolado`), não nesta máquina. **Nada aplicado em produção.**

**Fidelidade ao Compêndio 1.0 (só referência, não alterado):** reaproveitados a geometria do enquadramento, o popup de edição de imagem, os dados e resumos das origens, os textos de condições e as regras de dano, cura, descanso e carga. Um único componente de enquadramento (retrato e capa); modal, menu de ações, etapas e moedas compartilhados. **Diferenças de organização:** ficha em três abas (1.0: Principal, Combate, Magias, Inventário, Personagem, Notas; decisão aprovada, DEC-027); criação em Identidade, Raça, Classe, Origem, Atributos, Equipamentos, Revisão (1.0: Classe e Nível, Raça, Origem, Atributos, Perícias, Magias, Equipamento, Revisão), com perícias e magias dentro de Classe (DEC-029). Confirmar com o responsável se a ordem do 1.0 for desejada.

**Validação local do estado final:** tipos, 1712 unitários (139 arquivos), build oficial sem demonstração, Playwright Creator 140 (4 pulados), Base 116 (16 pulados) e Quality 88 (32 pulados), com Chrome instalado. **Não testado:** celular físico e sessão real no Supabase hospedado.

## RETOMAR AQUI — Refinamento visual da ficha, aguardando aprovação (26/11/2026, PR #158)

Referências: 12 telas aprovadas (cópia local em `Downloads\compendio-5e-referencias`; a do cabeçalho vigente é `01-cabecalho-v2-DEFINITIVO.png`). Decisões em [DEC-030](../DECISOES-E-ARQUITETURA.md). **Parar aqui até a aprovação visual.** Não mesclar, publicar nem aplicar migrações. A bateria completa roda depois da aprovação.

**Ver a ficha de exemplo** (dados fictícios, só no navegador): `npm run dev` e abrir `/compendio-5e/?demo=jogador&fichas=1&nuvem=1&exemplo=1` → Personagens → Caleb Hawke. No preview compilado (`vite build --mode preview-demo`), o mesmo endereço sem o prefixo `/compendio-5e`. O exemplo só é criado se ainda não houver fichas de demonstração e não entra no build oficial.

**Funciona:** cabeçalho (retrato abre o editor, indicadores, dano, cura, PV temporários, condições, defesas, descansos); aba Ficha; aba Habilidades (favoritos no topo, recursos, conjuração, círculos, filtros inclusive Especial, pesquisa, detalhes e Compêndio); inventário (moedas e passo ajustável, carga, filtros, grade e lista, equipar, usar poção em si, quantidade, transferir item com destinatário e "Todas", excluir, histórico recolhido); menu inferior em telas estreitas; criação, edição e subida de nível com o novo visual.

**Só interface (desabilitado e explicado):**
| Recurso | O que falta no banco |
|---|---|
| Curar outro personagem com poção | operação atômica que consome do dono e cura o destinatário (sem expor a ficha dele). `usar_consumivel` só cura o dono |
| Transferir moedas | operação atômica, idempotente, com histórico nos dois lados |
| Cargas (gastar e recuperar) | estado por exemplar (máximo, atual e regra vindos do catálogo, que ainda não os tem) e operação protegida. A janela abre para varinhas, cajados e cetros; o contador não é mostrado porque o dado não existe. Habilidades também não exibem cargas |
| Sintonização | estado por exemplar, limite por personagem (padrão 3, ajustável pelo mestre) validado no servidor; benefícios condicionados (CA, testes, ataque, dano, resistências, magias e habilidades concedidas) |
| Identificação | **os dados verdadeiros precisam sair da ficha que o jogador lê**: hoje o `itemId` real fica no `draft` do dono. Exige identificador seguro do exemplar e armazenamento só do mestre, com revelação por função. Por isso **não há botão nem estado de "não identificado"** na interface; nada foi simulado |
| Histórico completo | recebimento de moedas/loot, cargas, identificação e sintonização entram junto das operações acima |

**Efeitos de itens mágicos** continuam sem cálculo automático (exceto concessões do mestre ligadas ao item). Itens com cargas, sintonização ou propriedades individuais não são empilhados pelo aplicativo, mas o banco ainda não impede uma pilha vinda de fora.

**0014:** não foi ampliada nesta etapa. A decidir antes de aplicá-la: quais das operações acima entram nela e quais ficam para uma migração seguinte. **Limitação separada:** o teto de PV de **30 × nível** só barra valores absurdos; não é o máximo real do personagem, e quem edita a própria ficha ainda pode informar um máximo maior até esse teto. A validação exata exigiria as regras no banco.

**Verificado nesta rodada (somente o afetado):** tipos; 636 testes de ficha, criador, Compêndio, moedas e regras (e os 1.351 de `src` antes dos ajustes finais de CSS); E2E de ficha, fluxos do criador, sincronização e acessibilidade em 320, 390 e 1440 px (40 aprovados, 2 pulados); build oficial. **Não rodados:** testes de banco, Playwright Base, Quality e demais larguras.

### Conferência após a aprovação das capturas (26/11/2026)

Direção visual aprovada pelas capturas; **falta o responsável navegar pelo Preview**. Não alterar a estrutura visual da ficha sem aprovação; bateria completa ainda não autorizada. A janela de poção mostra o resultado da rolagem separado da cura aplicada. O espaço vazio no fim das capturas anteriores vinha da janela de 2600 px usada na captura (altura mínima de 60% da janela); em 320, 390 e 1440 px, com a altura real, a sobra medida é zero nas três abas.

Observado nas telas de criação e evolução, **sem correção** (não reformular agora): em Equipamentos iniciais aparece o identificador técnico `martial-weapons`; na revisão da subida de nível, a lista "Antes de confirmar" aparece como blocos cinza; o texto de Atributos ainda fala em "moldura".

### Aprovação pessoal no Preview e lista compacta (26/11/2026)

O responsável testou o Preview e **aprovou o layout da ficha, de Habilidades e do inventário em grade: sem novas alterações visuais nessas telas.** Pediu um último ajuste só na **visualização em lista** (linhas baixas, imagem centralizada, textos agrupados, sem borda azul nos equipados), feito apenas em CSS e **aguardando aprovação das capturas**. A **bateria completa só roda depois dessa aprovação, uma única vez**; falhas são corrigidas de forma pontual, sem refatoração, mudança estética ou função nova.

Pendências funcionais confirmadas (referência visual futura: captura da lista enviada em 26/11, com contador de cargas e "Não sintonizado"):

- marcadores circulares e contador de cargas nos cartões e nas linhas dos itens;
- consumo e recuperação de cargas **por exemplar**;
- sintonização funcional;
- **equipado e sintonizado são estados separados:** um item pode estar equipado sem sintonização, mas não concede os benefícios que dependem dela. Hoje a concessão do mestre presa a um item vale quando ele está no inventário (e equipado, se equipável), **sem** considerar sintonização.

Continuam válidas as decisões da DEC-030 e os requisitos de segurança (identificação sem enviar os dados verdadeiros ao jogador; operações atômicas e protegidas no banco). Sem merge, publicação ou aplicação da 0014; revisão técnica final, segurança, banco e integração ficam com o ChatGPT.

## RETOMAR AQUI — Pronto para a revisão técnica final (26/11/2026, PR #158)

**Refinamento visual concluído e aprovado** pelo responsável: ficha, Habilidades e inventário (lista e grade). Sem novas alterações visuais nessas telas sem aprovação. Próxima etapa, com o **ChatGPT**: revisão técnica final, validação de segurança, decisão e aplicação da 0014 e integração na `main`. **Não mesclado, não publicado, 0014 não aplicada.**

**Bateria completa local, executada uma vez no commit `6766e70` (Chrome instalado):**

| Etapa | Resultado |
|---|---|
| Tipos (aplicativo e E2E) | ok |
| Unitários, incluindo os de banco em PGlite | 1714 aprovados, 139 arquivos |
| Scripts (`scripts/alpha/*.test.mjs`) | 3 aprovados |
| Build oficial (sem demonstração) | ok |
| Build de demonstração e `check-preview-demo` | ok |
| Playwright Base | 116 aprovados, 16 pulados |
| Playwright Quality | 88 aprovados, 32 pulados |
| Playwright Creator | 132 aprovados, 4 pulados e **8 falhas** (um mesmo teste nas 8 larguras) |

**Falha e correção (só no teste; o aplicativo não mudou):** `expansao-2014` "Maga completa" procurava o texto antigo da conjuração ("CD de magia 13" na lista "Conjuração"); passou a conferir a seção Conjuração (INT, CD 13, Ataque). Com isso o teste chegou ao fim e, em paralelo, estourou o limite de 30 s em 320, 360 e 390 px; sozinho leva cerca de 25 s, sem travamento nem diálogo. Recebeu `test.setTimeout(60_000)`, sem retirar verificações. Reexecutado o arquivo inteiro: 24 de 24 nas 8 larguras. A bateria não foi repetida.

**Não verificado:** celular físico, sessão real no Supabase hospedado e aplicação da 0014 fora de ambiente isolado. A etapa com Auth/REST/JWT/RLS em Supabase isolado é a do CI do PR.

**Pendências funcionais (nenhuma implementada nesta rodada):** curar outro personagem; transferir moedas; marcadores e contador de cargas nos cartões e linhas; consumo e recuperação de cargas por exemplar; sintonização funcional, separada do estado equipado (equipado sem sintonização não concede os benefícios que dependem dela); identificação, que exige tirar os dados verdadeiros da ficha lida pelo jogador; histórico dessas operações; efeitos automáticos de itens mágicos; validação do PV máximo real (hoje só o teto de 30 × nível); distribuição de loot; compartilhamento do conhecimento de itens mágicos (a decidir). Telas de criação e evolução, sem correção: identificador `martial-weapons` em Equipamentos iniciais, lista "Antes de confirmar" em blocos cinza e o texto "moldura" em Atributos. Detalhes e decisões aprovadas nas seções anteriores e na DEC-030.

### Três ajustes no editor de personagem (26/11/2026, layout geral aprovado)

- **Magias:** os grupos de escolha de magias são seções expansíveis, uma aberta por vez (começa na primeira incompleta), com o contador no título; as magias se distribuem em colunas conforme a largura. Vale no editor e na etapa de magias da subida de nível, que usam o mesmo componente. Pesquisa, seleção, limites, detalhes e motor de regras não mudaram.
- **Marcas das etapas (editor):** azul com check = concluída; amarela com atenção = pendente; neutra = opcional não preenchida; sem números. A identidade pública conta como concluída quando acompanha a ficha ou apresenta nome ou alcunha; na criação, a marca de "Revisão e identidade pública" indica a identidade, e as escolhas que faltam aparecem nas etapas delas. Para o mestre, que não edita a identidade, a marca é neutra. A subida de nível continua como estava. No painel estreito segue o seletor, sem círculos.
- **Ordem:** "História e personalidade" é a última etapa, depois da identidade pública, na criação (oito etapas; saiu de dentro de Identidade) e na edição.

Verificação só do afetado: tipos (aplicativo e E2E), unitários de `src/criador` e `src/ficha` (425 aprovados), Playwright Creator `expansao-2014`, `flows` e `accessibility` nas 8 larguras (104 aprovados; `expansao-2014` repetido após o ajuste final das colunas, 24 de 24) e build oficial. A bateria completa não foi repetida. As pendências funcionais acima continuam; sem merge, publicação ou migração.

### Compêndio Campanha/Regras — 26/11/2026 (branch em revisão)

PR **#159**: https://github.com/Waudz/compendio-5e/pull/159. Branch `feat/compendio-campanha-regras`, continuada de `c3d74a6`. Trabalho isolado em worktree; alterações não commitadas do checkout original preservadas. Sem alterações no legado, produção, merge ou deploy.

- Categorias ativas e navegáveis; consultas de origens/características/condições reutilizam as fontes atuais. Filtros, visualização e contexto preservados por sessão/campanha. Cartões em coluna única com arte provisória Lucide licenciada.
- Registros narrativos usam notes + índice/referências `campaign_codex`. Conhecimento do jogador é uma projeção no servidor, não filtro de campos privados recebidos. Bestiário com quatro níveis; itens mágicos revelados aparecem em Descobertas/Regras sem liberar adição ao inventário; portadores retornam apenas identidade já pública.
- Storage privado separado, envio só pelo mestre, referência trocada após sucesso, arquivos antigos retidos para recuperação. Notificações internas idempotentes; sem push nem revelação automática por combate/posse. Atualização por foco/evento local/poll visível (30 s), sem prometer Realtime.
- Cabeçalho mobile prova propriedade por registro/campanha, protege resposta assíncrona atrasada e não atribui nova função ao toque repetido em Ficha. Os helpers E2E usam o menu inferior quando a barra redundante foi removida.
- Imagens: 77 itens + 52 monstros preservados, 129 HTTP 200, IDs válidos. Acervo do navegador ainda requer exportação do aparelho. Nenhum arquivo do 1.0 alterado.
- **0015 proposta, NÃO aplicada**. Pré-requisitos, preflight somente leitura, SHA, rollback com arquivo privado dos dados e aplicação exata em `docs/COMPENDIO-CONHECIMENTO.md`. Verificar a situação remota da 0014 separadamente; não aplicar diretório inteiro automaticamente.
- **CI completa aprovada em `c697021`**: 141 arquivos / 1.734 testes; Playwright Base 128 aprovados + 16 condicionais, Quality 88 + 32 condicionais, Creator 140 + 4 condicionais; zero falhas. Tipos do aplicativo e E2E, build oficial, guarda sem demonstração e preview aprovados. Auth/REST/JWT/Storage **reais** aprovados na stack descartável do workflow Alpha Supabase isolado (execução 45871022790), incluindo leitura por níveis, escrita negada, segunda sessão, upload/substituição/remoção e falha de ponteiro preservando a imagem anterior. Produção não foi acessada. Os skips permanecem os condicionais de plataforma da suíte; nenhum teste foi desabilitado para passar.
- Validação local: suíte completa 1.733 aprovada antes da verificação adicional de versão nula; SQL final 13/13 e testes de navegação afetados 49/49. Base detectou quatro expectativas antigas de rolagem na entrada compacta; testes agora entram em Regras → Itens mantendo as mesmas verificações, confirmadas na CI. Quality local 88/88 aplicáveis. Capturas locais desktop/mobile em `test-results/capturas/` (não versionadas).
- Último acabamento: portadores voltam a ser consultados na atualização da projeção (inclusive após transferência em outra sessão); mudança de papel limpa a projeção em memória. Teste de regressão adicionado. Os workflows do SHA final do PR devem continuar aprovados antes da revisão.
- Limites: ilustrações de categorias são provisórias/licenciadas; acervo pessoal do navegador ainda depende de exportação; 0014/0015 exigem revisão e aplicação autorizada separada. Identificação/sintonização, construtor completo de monstros customizados, galeria global e PWA não foram antecipados. **Não integrar nem publicar sem revisão final.**

## RETOMAR AQUI — Compêndio: páginas, vínculos, pesquisa e notificações (26/11/2026)

Branch `codex/compendio-paginas-vinculos`, a partir de `dc04e83` (PR #159, já na `main`). O Codex iniciou e parou pelo limite de uso; o trabalho local foi salvo como estava no commit `d5680cd` e concluído em seguida. **Não mesclado, não publicado, 0016 não aplicada.** Revisão técnica, segurança, banco, integração e publicação ficam com o ChatGPT. Decisões na DEC-032; banco em `COMPENDIO-CONHECIMENTO.md` (seção 0016).

**Entregue:** Campanha e Regras lado a lado em painel largo (abas no estreito, pela largura do painel); pesquisa global nas duas áreas, sem diferenciar acentos, com termos relacionados; sino no cabeçalho do aplicativo, contador em Descobertas e leitura individual; listas com componentes comuns (pesquisa, filtros, ordem, lista/grade); páginas individuais de registro, identidade, criatura e regra; editor em janela com campos por categoria e enquadramento de imagem; vínculos por ID, nos dois sentidos, removíveis sem apagar registros; no máximo dois grupos no desktop; retorno preservando pesquisa, filtros, ordem, visualização e rolagem.

**Corrigido na conclusão:** checagem de tipos (retorno das páginas de item e magia); o mestre voltou a poder revelar um item pela página dele; contagem de filtros ativos, "Limpar filtros" só quando há filtro, resumo na grade e rótulo "Ordenar por"; opção "Abrir como aba deste grupo"; contador de novidades acessível; campo de imagem com botão do aplicativo; ícone da categoria quando não há imagem; nomes no singular; aviso quando não há vínculos. Removidos os componentes que as páginas substituíram.

**Validação local (Windows, dados de demonstração e banco isolado):**

| Etapa | Resultado |
|---|---|
| Tipos (aplicativo e E2E) | ok |
| Vitest, incluindo os testes de banco em PGlite | 1739 aprovados, 141 arquivos |
| `scripts/alpha/local-only.test.mjs` | 4 aprovados |
| Build e `check-build-oficial` | ok |
| Playwright Quality | 88 aprovados, 32 condicionais pulados |
| Playwright Base | 126 aprovados, 16 pulados e 14 falhas de testes da interface anterior |
| Playwright Creator | 131 aprovados, 4 pulados e 9 falhas (8 da interface anterior e 1 intermitente) |

**Depois da bateria, só testes mudaram.** `compendio-conhecimento` e `encontros-identidade` foram adaptados (janela de edição, páginas próprias, dois grupos): 18 aprovados e 2 pulados nas 4 larguras. `creator/catalogo` (monstro → magia em páginas): 8 de 8. O arrasto da ficha em 360 px falhou uma vez em paralelo e passou 3 de 3 isolado. As suítes completas Base e Creator não foram repetidas no computador; o CI do PR as executa.

**Não verificado:** Supabase hospedado, aplicação da 0016 fora do banco isolado, Auth/REST/JWT em stack real (é o workflow Alpha Supabase isolado do PR) e celular físico.

**Limites e pendências:** "Mapa", "Habitantes" e documentos são texto ou vínculos (não há anexo de mapa/documento); membros e habitantes se registram por vínculo; o editor é uma janela, não uma página; a base de vínculos ainda não é usada nas anotações do mestre; registro de monstro personalizado não tem construtor de ficha. Fora do escopo e não iniciados: PWA, Loot, Encontros, quadro infinito, dados 3D e Assimilação. As pendências funcionais da ficha continuam as registradas acima.

**Ordem obrigatória na publicação:** aplicar a 0016 **antes** de publicar este aplicativo. Sem ela, o mestre não consegue salvar registros do Compêndio (o aplicativo recusa e informa a migração necessária, sem gravar) e vínculos e notificações mostram erro.


## RETOMAR AQUI — Consolidação pós-PR #160 (26/11/2026)

Esta seção prevalece sobre estados históricos acima. Prazo Alpha: 12/12/2026. Não exigir retrocompatibilidade interna da Alpha; preservar 1.0 e segurança. Agrupar mudanças relacionadas, testes focados durante desenvolvimento e CI completo antes de integrar.

### Estado publicado e trabalho em curso
- #157–160 integrados e publicados; migrações 0013–0016 aplicadas com autorização. #160 main 2574a6c, páginas/vínculos/pesquisa/notificações; responsável confirmou funcionamento em produção. #158 inclui operações atômicas de consumo e transferência de itens e sincronização de vitais; teste real simultâneo em dois dispositivos ainda pendente.
- Branch fix/compendio-navegacao-granular, último commit 2c6ea5c: navegação local, histórico bidirecional, menu contextual, tentativa de atalhos Alt+setas, escolha de grupo oposto, CSS de abas 34px sem quebra, trilho 48px recolhido por padrão e sino centralizado. **Não validado, sem PR ou publicação.** Não tratar como concluído.
- Revisar chamadas de abertura explícita (assinatura mobile/noGrupoDaOrigem), mobile, duplicação de registros, títulos e persistência do histórico, páginas ocultas montadas (efeitos, modais e guardas de edição), foco e rolagem. Testar antes de integrar. Controles de histórico ainda em barra separada: mover para a barra de abas. Sincronizar documentação mais recente da main.

### Navegação e identidade visual (aprovado)
- Clique interno substitui conteúdo da aba atual; menu lateral abre ou foca aba da seção. Contexto nesta ordem: Abrir em nova aba (mesmo grupo), Abrir em novo grupo (oposto ou cria segundo), Abrir (atual). Máximo dois grupos, nenhum split automático. Voltar/avançar por aba, preservar filtros, pesquisa, lista/grade, rolagem, edição e estado. Ctrl+clique/botão do meio, recuperar aba fechada, arrastar/fixar, divisor ajustável, tela cheia opcional/F11. Mobile mantém navegação inferior, histórico e gestos, sem split.
- Uma única barra horizontal por grupo, títulos em uma linha, reticências e tooltip, altura ~34px, rolagem horizontal quando necessário. Redesenhar nova aba com atalhos úteis. Painel lateral expansível, compacto por padrão (~48px), ícones alinhados, tooltips, seção ativa, sino com contador sobreposto. Manter azul do sistema, sem ornamentos. Novo logo aprovado (compendio-logo.svg/png na raiz), ainda não ativo. Não adicionar segunda barra para histórico.
- Referência: ESPECIFICACAO-NAVEGACAO-GLOBAL.md.

### Compêndio — próxima etapa funcional (essencial Alpha)
- Corrigir pesquisa de vínculos: resultados diretos pesquisáveis por nome/categoria, sem acentos, miniaturas, sem depender de select. Vínculos tipados e inversos (Líder/Liderada por, Proprietário/Propriedade de, Sede/Sede de, Localizado em/Contém, Membro/Possui membro, Representa/Descoberto como). Não revelar conhecimento nem entregar item ao vincular. Permitir referências seguras a itens do catálogo, não apenas notes.
- Campos opcionais estruturados: NPC raça, idade, ocupação, naturalidade, residência, alcunha, história, personalidade; local tipo, habitantes em seção própria, mapa; organização tipo, número de membros, objetivos, sede/membros; descoberta tipo/origem/contexto/descrição/imagem/documento/item. Só nome obrigatório na criação. Melhorar miniaturas dos vínculos, checkbox de remoção de imagem, textarea e organização das páginas. Mapas/documentos anexados ainda pendentes.
- Conhecimento granular coletivo por campanha, cada campo/foto/vínculo independente; olhos, revelar/ocultar seção/tudo, prévia jogador; segredo por padrão. Nome oculto pode usar alcunha conhecida, imagem desconhecida usa interrogação. Campos ocultos ausentes da resposta, pesquisa e notificações; relações secretas invisíveis nos dois sentidos. Quatro níveis de bestiário como presets, com ajustes individuais inclusive resistências/vulnerabilidades. Projeção e Storage protegidos no servidor; conhecimento individual por personagem futuro. Ver ESPECIFICACAO-CONHECIMENTO-POR-CAMPO.md.
- Descobertas: criar/selecionar item no catálogo e marcar Registrar como descoberta, gerar página ligada à definição, herdar dados automaticamente sem duplicar, acrescentar nome conhecido/descrição narrativa/história/origem/finalidade/vínculos e visibilidade por campo. Armas, armaduras, cargas, sintonização e propriedades conforme tipo. Criar descoberta não concede item nem revela existência; portadores derivados de inventário autorizado, conhecimento persiste após perda/consumo. Chave comum pode existir só no inventário; chave estranha pode ter descoberta própria. Descobertas avulsas (mapas, documentos, informações, rumores), filtros por tipo. Ver ESPECIFICACAO-DESCOBERTAS-ALPHA.md.
- Monstros/itens padrão editáveis por campanha, restaurar original, duplicar/criar customizado sem alterar catálogo global; ficha de monstro reutilizável. Exportação/importação entre campanhas do mesmo sistema e galeria global de imagens de monstros padrão são futuras; política de exclusão de imagens ainda não decidida. Recuperar obrigatoriamente imagens do 1.0 (129 referências remotas já verificadas anteriormente; exportar acervo local do navegador, auditar mapeamento e cópia independente antes da Beta).

### Anotações
- Jogador: documento inicial Minhas anotações, documentos ilimitados privados, lista por última edição, sem pastas/tags/grade, editor de texto em tela inteira, autosave, preservar documento e rolagem ao alternar menus.
- Mestre: referência AFFiNE/BlockSuite (https://github.com/toeverything/blocksuite); testar integração antes de assumir viabilidade. Hierarquia de pastas/subpastas/documentos/canvas por campanha, sidebar recolhível, busca, arrastar/reordenar; mobile navegação por pastas. Canvas desktop espacial, mobile todos os blocos em lista vertical reordenável independente das coordenadas; conteúdo compartilhado, exclusão em ambos, sem editor espacial mobile completo.
- Links inline com alias arbitrário para registros e blocos funcionais embutidos, ambos aprovados. Inserção e abertura conforme navegação global, permissões e dados vivos. Bloco de encontro permite consultar/editar criaturas, CA/PV, loot e iniciar combate; turnos só na Iniciativa. Não duplicar dados. Blocos de monstro, personagem, item, magia, mapa, documento, NPC. Notas mestre privadas por padrão. Escopo completo e cronograma do canvas ainda precisam de validação técnica; não assumir adiamento da Beta sem aprovação.

### Encontros, iniciativa e loot
- Ver ESPECIFICACAO-ENCONTROS-INICIATIVA-LOOT.md. Criaturas individuais mesmo quando adicionadas em quantidade; edição e estado sincronizados encontro/iniciativa, bestiário original intacto; PV de jogador na ficha, ordem/rodadas só combate. Duplicar configuração inicial ou estado atual, restauração seletiva com alerta sobre recriar loot.
- Modal loot aprovado: mochila cinza em combate, dourada pendente, verde completo; progresso, seleção por item/quantidade, destinatário, entrega atômica, histórico, itens recolhidos riscados com destinatário, sem duplicação, modal permanece após entrega parcial. Desktop modal, mobile bottom sheet. Mestre exclusivo.

### Ficha, inventário, PWA e futuro
- Preservar layout aprovado da ficha em três abas. Pendentes: cura de outro personagem por poção, moedas transferíveis, cargas por exemplar e recuperação, sintonização separada de equipar, identificação com ID verdadeiro protegido, efeitos automáticos mágicos, histórico dessas operações, validação exata do PV máximo, privacidade de nomes no histórico de transferências a revisar. PC/PP/PO por campanha, PE/PL desabilitáveis sem perda. Não simular operação insegura.
- PWA obrigatório Beta: ESPECIFICACAO-PWA-BETA.md; manifest/SW, instalação pelo menu, ícones/splash novos, sessão persistente, cache estático sem dados privados, atualização segura, standalone e navegação interna.
- Assimilação é próximo sistema após D&D; customizações de assimilações/efeitos por campanha. Dados 3D futuros via @3d-dice/dice-box, motor universal, temas e símbolos Assimilação; galeria global, compartilhamento entre mestres e push futuros.
- Não alterar produção nesta etapa de documentação. Próximo passo: concluir e testar navegação; depois conhecimento granular/descobertas/vínculos, antes de encontros/loot. Reavaliar cronograma pelo progresso real.

## Revisão da navegação global — 26/11/2026 (em validação)

Branch `fix/compendio-navegacao-granular`, revisão a partir de `34edb22`, com documentação
`f84a512` incorporada. A implementação parcial não foi publicada como concluída.

- Histórico agora pertence ao modelo da aba (até 40 destinos), com uma única página
  montada por histórico. Removidos os eventos globais `compendio:abrir-local` e a pilha
  de páginas escondidas que mantinha editores e efeitos ativos.
- Clique interno navega na aba; menu abre/foca seção, criando outra instância quando
  a aba original está mostrando um registro. Registro já aberto é selecionado, sem
  outro editor. O histórico pode voltar/avançar, inclusive Alt+setas. Layout persistido
  contém IDs/índice, nunca títulos, filtros privados ou conteúdo dos registros.
- Controles na barra de abas; recuperação de até 20 abas fechadas na sessão,
  Ctrl/Cmd+Shift+T, nova aba com ferramentas, tela cheia opcional e logo oficial.
  Fixar, arrastar e redimensionar continuam pelo FlexLayout, com limite de 2 grupos.
- Pesquisa/filtros do Compêndio têm escopo de aba, usuário e campanha. Posições de
  rolagem do histórico são recuperadas na sessão, com espera limitada pelo conteúdo.
  Alternância de conta/campanha limpa posições e abas fechadas em memória.
- Mobile usa seu próprio destino para links contextuais e notificações, sem abrir
  abas desktop invisíveis. A navegação inferior não foi redesenhada.

**Verificação até este registro:** tipos e build passaram. Primeira bateria em estado
intermediário: 1693 aprovados/49 falhas; depois das correções, 1734 aprovados/5 falhas
apenas em expectativas antigas de abertura/fixação automática. Essas expectativas
foram atualizadas para as decisões vigentes; consultar o CI do SHA final para a
confirmação completa. Nenhum teste foi removido para esconder falha.
Playwright local foi tentado: seis casos bloqueados antes da execução por falta do
binário exigido; a alternativa `/usr/bin/chromium` também não tem o executável real.
Fluxos de navegador, responsividade, fullscreen, F11 e aparelhos físicos dependem de
CI/validação visual. Não declarar a etapa concluída antes dessa evidência.

**Pendências desta etapa:** conferir todos os pontos de abertura com modificadores,
histórico Avançar do navegador/mobile, foco por teclado e restauração de edição após
retorno; atualizar testes E2E que exigem a divisão automática anterior. Conhecimento
granular, vínculos tipados e Descobertas continuam como próxima etapa, sem nova
migração nesta revisão. Nenhum acesso de escrita em produção, merge ou deploy.

### Continuação da revisão (#161)

PR https://github.com/Waudz/compendio-5e/pull/161, rascunho. Commit inicial `266c09c`.
Depois do registro acima, a suíte local completa passou: **1741 testes/143 arquivos**;
os quatro testes dos scripts e os tipos de aplicativo/E2E também passaram.
No CI desse commit, Validar projeto, Preview e Alpha Supabase isolado passaram;
Quality falhou em quatro seletores do nome antigo da campanha, Base em duas
verificações da faixa fixa (regressão real de altura/rolagem do contêiner).

Correções seguintes, aguardando novo CI: contêiner preserva `.content` como rolagem
única; guardas seguem o ID real da aba e cada editor tem registro próprio (61 testes
focados aprovados); Voltar **e Avançar** no mobile usam snapshots da navegação, com
cancelamento de resposta antiga após mudança de campanha (16 testes aprovados).
Consulta de criatura usa página local `monstro`, sem a referência obsoleta `item:monstro`.
Cenários E2E novos cobrem consulta sem split, contexto ordenado, recuperação e gestos;
os antigos agora retornam pelo histórico antes de verificar os filtros preservados.
Não se declara E2E aprovado antes da nova execução. Nenhum teste foi pulado por falha.

A primeira rodada E2E terminou com Quality 4 falhas, Base 2 falhas e Creator segunda
metade 26 falhas (a primeira metade passou). As causas localizadas: seletor antigo
da campanha; contêiner sem altura limitando rolagem/sticky; guardas registradas pelo
personagem em vez da aba que agora o hospeda; retorno tentando selecionar uma aba
que passou a ser uma página do histórico; área Regras tratada sempre como botão,
mesmo quando o painel largo mostra as duas áreas. Corrigidos código e pontos de
entrada dos testes, mantendo limites, verificações de dados e acessibilidade.
Após o isolamento das guardas, a bateria local teve 1739 aprovações e 3 expectativas
antigas de chave de guarda; as três foram ajustadas para exigir o prefixo da aba e
identidade única do editor, e os 83 testes afetados passaram. Confirmar o conjunto
no novo SHA. Não foram alterados prazos nem anunciado lançamento da Alpha.

O Diário também passou a abrir registros pelo histórico da aba, mantendo o retorno
protegido ao Diário. O menu contextual lateral agora usa as mesmas três ações e a
mesma ordem do conteúdo; a fixação permanece no menu da própria aba. Os 38 testes
focados de Diário/navegação passaram. O segundo commit (`0d06931`) teve falha de
TypeScript por atributo `title` duplicado em um tooltip; corrigido antes da próxima
rodada. Não confundir o Preview aprovado com aprovação do build oficial.

**Verificação local consolidada após essas correções:** build oficial, tipos do
aplicativo e E2E aprovados; **1742 testes em 144 arquivos aprovados**. O workflow de
CI do próximo commit é a evidência exigida para Playwright e stack real. Aguardar
seus resultados antes de integrar/publicar; validação física/F11 continua pendente.

As categorias agora são destinos `categoria:<id>` do histórico global, preservando
as verificações de campanha e a projeção de jogador. Voltar/Avançar alcançam tanto
índice → categoria quanto categoria → registro; menus e gestos continuam explícitos.
Os títulos restaurados vêm das definições atuais, e a seção ativa segue a página
exibida, não o ID original da aba. Os 39 testes de Compêndio/catálogo/bloqueio passaram;
novo build e bateria completa: **1742/1742, 144 arquivos**, sem falhas.
Na rodada CI de `aa85842`, as duas metades do Creator passaram; Quality ainda procurava
a ordem antiga do contexto lateral. Corrigido mantendo as verificações de foco e
setas para as três ações atuais. Conferir o próximo SHA para o conjunto final.

A rodada Base de `aa85842` identificou uma corrida após salvar registros: o editor
limpava a antiga chave de guarda, mas a guarda agora tem identidade própria. A
liberação passa a ser explícita e exclusiva do editor confirmado pelo servidor,
antes da navegação; teste de regressão incluído. Voltar/navegar localmente consultam
as guardas da aba afetada, sem bloquear por edições preservadas em outra aba.
A cobertura lateral da faixa sticky também exigiu eliminar a diferença de referência
entre percentuais de padding e margem negativa: recuo calculado em comprimento e
compartilhado, mantendo as verificações geométricas existentes.

**Último check local consolidado:** build e tipos de aplicativo/E2E aprovados;
**1743 testes aprovados em 144 arquivos**, incluindo a regressão da guarda liberada
após salvar. A próxima execução do CI precisa confirmar as correções de navegador e
geometria; não há autorização de merge/deploy ou migração de produção nesta sessão.

No SHA `c4677f2`, Validar projeto, Preview, Supabase isolado, Quality e as duas
metades do Creator passaram. Base deixou quatro falhas em dois cenários: a consulta
global reutilizava um registro ainda aberto em outra aba desde a criação; o teste de
botão do meio usava o menu lateral para voltar à lista, embora o menu abra/focalize
seção. Preparação ajustada para voltar da criação antes da consulta e retorno pela
aba Itens já aberta. Permanecem as verificações de consulta preservada, foco e
registro sem duplicação. Sem mudança no aplicativo nesta correção dos testes.

## Próxima fatia preparada — pesquisa direta de vínculos (26/11/2026)

Branch `feat/vinculos-pesquisa-direta`, baseada na revisão #161, sem integração na main.
Substitui o dropdown de vínculos por resultados diretos com miniatura, nome e categoria;
pesquisa sem acentos/caixa; seleção explícita e protegida contra destino ausente,
carregamento e erro. Reutiliza projeção e RPC atuais, sem alterar permissões ou dados.
Quatro testes novos aprovados e cenário E2E de vínculo atualizado sem retirar suas
verificações. Ver `docs/VINCULOS-PESQUISA-DIRETA.md`. Catálogo, tipos/inversos e
conhecimento granular continuam pendentes de modelo/projeção seguros; nenhuma migração
é necessária ou aplicada nesta fatia.

Validação local consolidada dessa fatia de vínculos: build e tipos de aplicativo/E2E
aprovados; **1747 testes/145 arquivos aprovados**, incluindo os quatro casos novos.
O PR é dependente do #161, sem merge/publicação; a execução Playwright ocorre no CI,
pois o ambiente local não dispõe do binário executável exigido.

Revisão de limite após o CI verde: a expressão de instâncias de aba rejeitava sufixos
10–19 e 100–199. Corrigida para aceitar inteiros seguros a partir de 2; três testes
novos provam a restauração de 10, 19 e 100. Isso preserva abas ao recarregar, sem
alterar registros. A nova cabeça deve ter seu CI confirmado antes de publicar.

As duas entregas tiveram CI completo verde antes do ajuste final de instâncias:
#161 em `ba73257` e #162 em `d8607a6`. A cópia conjunta com a restauração de instâncias
10/19/100 passou em build/tipos e **1750 testes/145 arquivos**. Cabeças finais devem
confirmar novamente o CI; nenhum merge, deploy ou SQL de produção foi executado.

## RETOMAR AQUI — Compêndio: conhecimento granular, vínculos, descobertas e personalização (26/11/2026)

Branch `feat/compendio-conhecimento-granular`, a partir de `eed389f` (#161 e #162 integrados). **Sem merge e sem publicação; 0017 e 0018 propostas, não aplicadas.** Produção e Compêndio 1.0 não foram acessados. Revisão, banco, integração e publicação: ChatGPT. Modelo, conversão, ordem de aplicação, reversão e SHA em `COMPENDIO-CONHECIMENTO.md` (seção 0017/0018). A navegação (#161) e a pesquisa de vínculos (#162) não foram refatoradas.

**Entregue**
- Conhecimento coletivo por campanha: existência, cada campo, imagem, seção da ficha/propriedade, posse e cada vínculo, com olho na página, por seção e tudo; "Ver como jogador" usa a mesma projeção do servidor; quatro níveis do bestiário como atalhos ajustáveis; imagem desconhecida com interrogação; um aviso por operação.
- Campos aprovados de NPC, local, organização e descoberta; relações predefinidas e personalizadas com leitura inversa, agrupadas, com miniaturas; Habitantes em seção própria; vínculos com itens do catálogo por referência secreta.
- Descobertas: "Registrar como descoberta" na página do item e ao criar item; "Registrar item" na categoria; ficha herdada da definição; descobertas avulsas e filtros Todos/Itens/Mapas/Documentos/Informações/Outras; conhecimento independente do inventário.
- Monstros e itens por campanha: criar, editar, duplicar, restaurar padrão e excluir criação, nas listas, páginas e vínculos.
- Correção: o cabeçalho do celular mostrava o identificador interno do registro.

**Validação local (Windows, demonstração e PGlite):** tipos do app e E2E; Vitest 1764/1764 em 147 arquivos; `local-only` 4/4; build oficial e `check-build-oficial`; Playwright (Chrome instalado, sem vídeo) Base 148 + 20 condicionais, Quality 88 + 32, Creator 140 + 4, zero falhas. Depois do Playwright mudaram apenas SQL da conversão, preflight e documentação; a Vitest completa foi repetida e passou.

**Não verificado:** Supabase hospedado; Auth/REST/JWT/Storage reais (`scripts/alpha/run-local.mjs` foi atualizado e só foi conferida a sintaxe; roda no workflow Alpha Supabase isolado do PR); conversão sobre cópia dos dados de produção; celular físico; envio de imagem na interface (a demonstração não envia arquivos).

**Pendências e limites**
- Definições personalizadas valem no Compêndio. Inventário, ficha, encontros e iniciativa ainda usam o catálogo padrão; item criado pela campanha não pode ser concedido ao inventário.
- Identificação de itens dentro do inventário (nome verdadeiro oculto para quem possui) continua pendente na ficha: o inventário ainda mostra o nome do catálogo.
- Item personalizado identificado aparece ao jogador em Descobertas, não na lista Regras → Itens. A edição de monstros não cobre perícias, salvaguardas e sentidos (são preservados da base).
- Mapas e documentos anexados como arquivo continuam futuros (referência em texto, descrição e imagem).

**Ordem obrigatória:** aplicar 0017 e 0018 na mesma janela da publicação do aplicativo.

## RETOMAR AQUI — Compêndio finalizado: inventário, combate e itens não identificados (26/11/2026, PR #163)

Mesma branch `feat/compendio-conhecimento-granular`. **Sem merge/publicação; 0017, 0018 e 0019 propostas, não aplicadas.** Substitui as pendências da seção anterior. Banco, ordem, revisão de segurança e SHA: `COMPENDIO-CONHECIMENTO.md`.

**Concluído:** CI de `f8c56eb` e `77066b1` verde (sem falhas a corrigir); catálogo da campanha na ficha, inventário (pesquisa, detalhes, uso, ataques/CA, peso), loot, encontros e iniciativa; entrega de itens a personagens, identificados ou não, e "Identificar item" no inventário do mestre; itens criados e identificados em Regras → Itens e na pesquisa global; editor de monstros com salvaguardas, perícias e sentidos. A sobreposição do catálogo (`src/catalogue/campanha.ts`) contém só o autorizado pelo servidor e é esvaziada ao trocar de campanha/conta.

**Pendente:** anexos de mapas e documentos (etapa própria); sintonização e cargas (já pendentes na ficha); item não identificado não pode ser usado nem equipado com efeito até ser identificado. A demonstração não simula entrega/identificação (coberto por PGlite, teste de interface e script da stack real).

**Validação local sobre `9057325` (Windows, demonstração e PGlite):** tipos do app e E2E; Vitest 1771/1771 em 147 arquivos; `local-only` 4/4; build oficial e `check-build-oficial`; Playwright Base 148 + 20 condicionais, Quality 88 + 32, Creator 140 + 4, zero falhas. `run-local.mjs` ganhou a verificação da 0019 com Auth/REST/JWT reais: confirmar no workflow Alpha Supabase isolado do último commit do PR. Não verificado: Supabase hospedado, conversão sobre cópia de produção, celular físico, envio de imagem pela interface.

## RETOMAR AQUI — Cartas do Compêndio e bestiário narrativo (27/11/2026, branch `feat/compendio-cartas-bestiario`)

**0017, 0018 e 0019 já foram aplicadas em produção** e o PR #163 integrado/publicado (informado pelo responsável). As seções anteriores que dizem o contrário são históricas. Base desta branch: `main` em `9ce404a`.

**Estado:** em revisão; sem merge nem publicação. **0020 proposta, não aplicada**; aplicar junto com a publicação (o cliente exige capacidade 20). Detalhes em `COMPENDIO-CONHECIMENTO.md`; decisões em DEC-034. Capturas em `docs/evidencias/cartas-20261127/` (demonstração).

**Concluído:** cartas de consulta (desktop) e páginas (celular) para todas as categorias; bestiário narrativo com bloqueio no servidor; conhecimento em três modos; citações `@`; campos vinculáveis; carta de identidade compartilhada com o Início; abas Identidade, ficha técnica de criatura e ficha de NPC; atalho "Ver ficha" no Bestiário; ficha do monstro no outro grupo pela Iniciativa.

**Validação local (Windows, Chrome instalado sem vídeo, demonstração e PGlite):** tipos do app e E2E; Vitest 1785/1785 em 147 arquivos; `local-only` 4/4; build oficial e `check-build-oficial`; Playwright Base 148 + 20 condicionais, Quality 88 + 32, Creator 140 + 4, zero falhas (depois só mudou `compendio-paginas.spec.ts`, repetido: 12/12). Não verificado: Supabase hospedado, `run-local.mjs` com Auth/REST/JWT reais (ganhou a verificação da 0020; roda no workflow Alpha Supabase isolado do PR), conversão sobre cópia de produção, celular físico, envio de imagem pela interface, gesto lateral na ficha de criatura em navegador (usa o mesmo código da ficha de personagem).

**Testar localmente:** `npm ci`, `npm run dev`; mestre em `http://localhost:5173/compendio-5e/?demo=mestre`, jogador em outra aba com `?demo=jogador` (mesmos dados no navegador; cada visita restaura as abas daquele papel). Para fichas de personagem, acrescentar `&fichas=1&nuvem=1`.
1. Mestre: Compêndio → Personagens → Criar NPC (com `@` na descrição) → Conhecimento → revelar alguns campos → Cancelar (nada muda) → repetir e Salvar → Prévia.
2. Jogador: abrir o mesmo NPC e comparar com a prévia; conferir o sino.
3. Mestre: Bestiário → clique abre a carta narrativa; ícone "Ver ficha" abre a ficha; na aba Bestiário, registrar a criatura e revelar o nível 4. Jogador: nenhum número aparece.
4. Mestre: NPC → ⋯ → Vincular ficha de combate → Ver ficha.
5. Mestre: Iniciativa → adicionar o mesmo monstro duas vezes → clicar nos dois nomes (uma só ficha, no outro grupo).
6. Com `&fichas=1&nuvem=1`: criar personagem como jogador, aba Identidade; clicar nele no Início (próprio abre a ficha; mestre vê a carta com "Ver ficha").

**Pendências e limites:** "Abrir no Compêndio" a partir do inventário e os nomes em Encontros continuam navegando na aba (sem carta); algumas características de raças/classes seguem no idioma original (anterior a esta etapa); NPC com ficha não tem aba Inventário; nome secreto digitado fora de uma citação `@` não é detectado; registros de criatura antigos ficam com os novos campos narrativos vazios e ocultos até o mestre preencher; anexos de mapas e documentos continuam futuros.

### Refinamentos antes do PR (27/11/2026, mesma branch)

Retratos maiores nas cartas; visualizador de imagens (`src/imagem/VisualizadorImagem.tsx`, ligado pela opção `ampliar` de `RetratoQuadrado`); na ficha de personagem, tocar no retrato amplia e o lápis altera; ficha de criatura sem a seção "Estatísticas" (detalhe da armadura passou ao indicador de CA; percepção passiva saiu da linha de sentidos); "Vincular registro" no editor (e em "Editar vínculos" na identidade de aventureiro), o que também devolve a remoção de vínculos comuns à página do registro; topo compacto no celular; aviso de nome oculto. **Sem mudança no banco** (0020 inalterada).

**Imagens e permissões:** o visualizador não faz pedido novo nem guarda endereço; fecha se a imagem sair da tela. Ele mostra o arquivo original, sem o enquadramento: quem já podia ver o retrato já podia baixar o arquivo inteiro, mas agora a parte fora do recorte fica visível na interface.

**Validação local:** Vitest 1793/1793 (148 arquivos), tipos, build e `check-build-oficial`; navegador direcionado: Base 54 + 6 condicionais (inclui `compendio-imagem.spec.ts`: zoom por botões e roda, arraste, pinça sintética, Esc, Voltar e larguras do retrato), Creator 24 (ficha e catálogo), Quality 52 + 28 (layout e acessibilidade). Não repetidas as baterias completas. Não verificado: pinça em celular físico e imagens reais do Storage (no teste, as imagens externas são substituídas).


## Retomada — 28/11/2026 (feedback após PR #164)

PR #164 publicado, migração 0020 aplicada, main de publicação 09e1c46. Triagem encerrou PRs #95, #98, #103, #105, #110, #111, #112, #124 e issue #101. Antes de Encontros/Loot, corrigir em um PR: (1) abas e status da ficha centralizados na largura do conteúdo (src/ficha/ficha.css: margens de ficha-subnav e ficha-salvamento); (2) aventureiros e NPCs com relações tipadas uniformes, residência/naturalidade e habitantes inversos sem duplicação; investigar direção do vínculo em relacoes.ts e VisaoRegistro.tsx; (3) App.tsx renderSet: voltar/avançar, nova aba e fechar grupo independentes; reabrir aba e tela cheia apenas uma vez à direita; (4) mestre pode editar identidade pública de personagens da própria campanha: AbaIdentidade, CriadorGuiado, repositorio.ts, fichas.ts e RPC save_guided_character; migração 0021 prevista, testar autorização, revisão concorrente e privacidade, sem aplicar antes de autorização específica. Até a pausa de 27/11 houve apenas inspeção, nenhuma implementação dessas correções. Testar desktop 1/2 grupos e mobile. Depois retomar #134 Encontros/Iniciativa/Loot.

## RETOMAR AQUI — Preparação para jogadores reais (27/11/2026)

Branch `fix/alpha-jogadores-primeiro-acesso`, base `d0569111051b515d5cc3c16ea93b58d0ac673c92`. Não é a antiga branch de navegação. #163/#164 já integrados; sem outro PR funcional aberto na inspeção. Nenhum merge/deploy/SQL de produção nesta execução. Migração 0020 **confirmada aplicada por consulta**, não pendente.

**Implementado nesta fatia:** cadastro aberto no cliente (a main ainda recusava antes de chamar o SDK); confirmação, recuperação e convite preservados; editar nome da conta com profiles/RLS existente, sem mudar personagens; participantes montados atualizam após salvar; mudança segura de e-mail pelo Auth; menu compartilhado, sem acionador duplicado no topo mobile; seleção ativa independente de Menu; Configurações com tema existente; Sobre e versão única. Foto da conta e novas Anotações do jogador **não implementadas**: não declarar a etapa inteira concluída.

**Arquivos:** `src/auth.ts`, `AccountPanel.tsx`, `profiles.ts`, `CampaignPanels.tsx`, `GlobalMenu.tsx`, `version.ts`, `Mobile.tsx`, `App.tsx`, `Panel.tsx`, `workspace.ts`, `style.css`; testes de auth/profiles/menu e ajustes dos testes de navegação para os controles novos; fixtures e testes E2E de navegação/responsividade/acessibilidade/chrome; `scripts/alpha/prepare-local.py` e `run-local.mjs` (cadastro público, mestre + dois jogadores, isolamento/perfil); README, DEC-035, `docs/ALPHA-JOGADORES-20261127.md` e `docs/ROTEIRO-TESTES-JOGADORES.md`.

**Executado localmente:** bateria Vitest 1804 aprovados/1 falha em 150 arquivos. A única falha era a expectativa histórica “cadastro ausente” em `etapa1.test.tsx`; corrigida para a decisão vigente e repetida em execução focada: 52/52 (etapa1/auth/menu). As outras regressões encontradas na adaptação dos testes (nome do controle mobile, espera da sessão e helper do criador desktop) foram corrigidas; execução focada campanha/criador 33/33. Build TypeScript/Vite aprovado (aviso de chunks grandes já existente); tipos E2E aprovados; `check-build-oficial` aprovado (46 arquivos); guardas local-only 4/4; sintaxe Node do script isolado aprovada. Não repetir toda a bateria local apenas pela mudança de expectativa; o CI completo do PR confirma o HEAD final.

**Ainda não executado aqui:** navegador (binário Playwright ausente e Chromium do sistema incompleto), stack real local (sem Docker). Conferir E2E e Alpha Supabase isolado do PR antes de declarar aprovados. O script real usa somente loopback e contas sintéticas; produção só recebeu consultas de metadados/advisors, sem leitura de conteúdos de usuários. Configuração de confirmação de e-mail real, recebimento dos links e dispositivos físicos não certificados.

**Próximos passos exatos:**
1. Conferir os quatro workflows do PR; se falhar, baixar somente o job relevante, corrigir a causa e repetir proporcionalmente. Cadastro local agora é aberto, sem associação automática à campanha. Em `run-local.mjs`, confirmar as novas asserções de profiles e segundo jogador.
2. Concluir foto da conta com contrato próprio (profiles não possui coluna de avatar; não reutilizar identidade de personagem), testes RLS/Storage e migração preparada, nunca aplicada sem autorização.
3. Implementar “Minhas anotações” para jogador sobre notas/cenas existentes: lista/editor BlockNote, autosave versionado, recuperação local, privacidade contra mestre/segundo jogador, preservar documento/rolagem ao alternar temporariamente e Voltar para lista. Não alterar quadro do mestre. Ver DEC-035 e roteiro.
4. #100 continua confirmado: `novoRascunho` ainda define fighter/hill-dwarf/acolyte. Implementar contrato de escolhas ausentes no motor antes de remover defaults da UI. Recuperação contínua e preservação das edições durante save já existem no criador (#96/#99 parcialmente); reproduzir equipamentos e executar regressões existentes antes de mexer. Não encerrar issues inteiras com base em inspeção.
5. Pendências da retomada após #164 continuam válidas. Não iniciar Encontros/Loot antes dos bloqueadores atuais.

Prazo 12/12/2026 mantido como objetivo. Alpha **não certificada** para todos os critérios: foto, novas Anotações, contrato incompleto do criador, validação manual e problemas após #164 permanecem. Roteiro informa essas limitações aos jogadores; nenhum sistema de feedback foi criado.

### Validação e refinamento do PR #165 (mesma execução)

Primeiro commit remoto `a79971f3059ae1996aa1081007ecb084c34fe973`: workflow Validar projeto aprovado (150 arquivos Vitest); Preview aprovado; Alpha Supabase isolado aprovado com **19 verificações reais**, incluindo as novas de cadastro/perfil e os cenários de Auth/REST/JWT/RLS/Storage/concorrência/expiração. Evidência: runs 45994936817, 45994936808 e 45994936814. Não são testes em produção. E2E Quality aprovado nesse commit; Base/Creator ainda estavam executando quando os refinamentos abaixo foram preparados.

Refinamentos de conclusão: menu não captura Tab/Escape de uma confirmação de alterações não salvas aberta acima dele, e não reinicia o foco a cada render do pai; mensagem do convite agora orienta criar conta; “Meus personagens” usa rota própria estável `secao:meus-personagens`, com filtro do dono também no desktop (não apenas um título especial no celular). Adaptado helper E2E do criador para o título correto no celular e adicionado `e2e/menu-global.spec.ts` para ambos os papéis, ordem de ações, versão, foco, tema e Sobre. Testes locais: regressões mobile/criador/workspace/menu 55/55; menu final 5/5; build novamente aprovado após refinamentos; tipos E2E finais aprovados. Confirmar todos os workflows do novo HEAD; não reutilizar o resultado do commit anterior como aprovação do novo.

PR: https://github.com/Waudz/compendio-5e/pull/165. Todos os arquivos de código e documentação enviados pela branch; dependência local node_modules é apenas ligação para executar testes, não é código do projeto.

### Correção da suíte Base no HEAD a85dd78

Validação desse HEAD: **1807 Vitest / 150 arquivos** aprovados; Preview e Alpha isolado aprovados; Quality **88 aprovados + 32 condicionais**; Creator **140 aprovados + 4 condicionais** (68+72 nos dois shards). Base: **153 aprovados, 20 condicionais e 7 falhas**, run 45995625373/job 140494341051. Não declarar esse run inteiro aprovado.

Causa evidenciada nos logs: `navigate` em `e2e/fixtures.ts` fazia `count()` instantâneo dos botões inferiores depois de F5/troca de sessão; antes da montagem da barra/definição do papel, escolhia abrir o menu e esperava Iniciativa/Compêndio ali (atalhos removidos corretamente). Quatro falhas em navigation.spec e as três em retomada de combate/encontro/Compêndio passam pelo helper. Correção: esperar a barra e, para os cinco atalhos fixos, usar o botão inferior com autoespera do Playwright, sem fallback por contagem instantânea. Não houve mudança nas asserções de dados, timeout, retries ou aplicação. Tipos E2E conferidos; aguardar a nova execução do CI.

Consulta adicional somente de metadados em produção confirmou RLS ativa em profiles/notes/character_sheets/campaign_combats/campaign_encounters, políticas de combate/encontros com is_master(campaign_id), e único UPDATE de profiles em display_name. Nenhum dado de usuário consultado/alterado.


## RETOMAR AQUI — Transferência definitiva para o Codex (27/11/2026)

**Desenvolvimento encerrado a pedido do responsável; não há nova funcionalidade em implementação.** Ler primeiro [relatório completo](TRANSFERENCIA-CODEX-20261127.md) e [prompt independente com todos os critérios aprovados](PROMPT-CODEX-ALPHA-20261127.md), que prevalecem sobre a fila histórica desta página.

Main/publicado pelo Pages: **d0569111051b515d5cc3c16ea93b58d0ac673c92** (código funcional #164 em 09e1c46), run de deploy 45948379980 aprovado. **#165, fix/alpha-jogadores-primeiro-acesso, bb2aa0cf5ad2cf8ed4b2510a7f527af883664246**: todos os workflows verdes, pronto para revisão, **sem merge/publicação**. Base final 160 aprovados/20 condicionais, Quality e dois shards Creator aprovados, build/1807 unitários/150 arquivos e 19 cenários Supabase reais isolados aprovados. Fonte durável dos resultados finais: comentários do PR. As sete falhas do helper foram resolvidas, não reabrir essa investigação sem regressão.

Nova prioridade: **P0 própria ficha no desktop**. Inspeção sem correção: frase emitida por CartaoPublicoGuiado em Personagens.tsx, roteamento por FichaRoteada, proprietários/UID a reproduzir. Agregado de produção: 7 fichas, 0 owner divergente entre tabelas e 0 dono fora da campanha; não prova qual conta abriu o registro relatado. **Causa raiz ainda não confirmada.** Nenhum arquivo de aplicação alterado para esse P0; branch local vazia fix/ficha-propria-desktop não contém progresso. Testes existentes e próxima ação exata no relatório. P1 seguinte: marcar todas as notificações como lidas, preservando visual e escopo, não iniciada.

0020 confirmada aplicada; nenhuma 0021 criada/aplicada aqui. Foto da conta, novas Anotações do jogador, #100 e demais critérios permanecem conforme tabela de classificação no relatório. Cadastro aberto permanece aprovado. Contas/dados externos preservados; nenhuma escrita em produção, merge, deploy ou exclusão nesta execução. Não alterar 1.0/Assimilação.

Branch de documentação **docs/transferencia-codex-alpha-20261127**, baseada em #165; PR só documental dependente. Código e handoff enviados ao GitHub. Não há código desta sessão apenas local. Próxima IA deve usar clone/worktree limpo dos remotos e atualizar HEAD/PR antes de agir, sem repetir auditorias/testes já concluídos. Autorizações de publicação/migração continuam necessárias.


## RETOMAR AQUI — Diagnóstico corrigido e notificações (27/11/2026)

Base atualizada: `3226a7292ce7dafcb0a6ced1e5a5139079b0b32a`; #165 e #166 já integrados (confirmação Git/remoto e estado de #165). O responsável retirou expressamente o relato de inacessibilidade da própria ficha: o problema era a página pública inteira para **outro jogador** na lista Personagens. Não reabrir investigação P0 de proprietários/RLS por esse relato. Testes adicionados confirmam dono/mestre na ficha e privacidade do terceiro.

Branch `codex/ficha-propria-desktop`: Personagens usa `identidadeSpec` + `useAbrirConsulta` para terceiros, mantendo `ficha` para dono/mestre e os mesmos gestos/contexto. Nome público do responsável via API `members`/`profiles.display_name` na lista e carta, sem e-mail. Hook `jogadoresCampanha.ts` isola respostas por usuário/campanha e atualiza após edição de perfil. `FichaJogo` usa um contêiner comum `ficha-largura`, incluindo abas, salvamento e conteúdo.

Notificações: `CheckCheck`/Marcar todas como lidas no topo, oculto sem pendências; `notificacoesLote.ts` pagina os IDs autorizados além dos 50 do feed, congela a seleção e grava somente `read_at`. AbortSignal na troca de escopo; erro não simula sucesso; o feed real reconcilia sucessos parciais. Demonstração implementa o mesmo contrato; não comprova produção. **Nenhuma migração necessária ou aplicada.** Acrescentada regressão REST/JWT isolada no cenário existente para leitura persistente e proteção de outro destinatário.

Validação intermediária: 54 testes direcionados de ficha/notificações, 1820 testes completos antes da correção adicional da listagem, 62 regressões atualizadas de ficha e 16 Playwright do Compêndio aprovados. Validação final e CI serão registrados no PR; não reutilizar o resultado anterior como aprovação de arquivos posteriores. Uma tentativa paralela local foi interrompida após queda do serviço esbuild/Vite; execução repetida com concorrência reduzida.

Sem merge, deploy, consulta/escrita em produção ou mudança no legado. Foto da conta, Minhas anotações, contrato de criação sem escolhas prévias (#100) e demais itens da DEC-035 continuam planejados, não entregues por este PR. Próximo ciclo segue essa fila após a revisão desta correção; sem iniciar Encontros, Loot ou PWA.


### Ampliação prioritária solicitada após o commit 8285e50

Exclusão de personagens e identidade indevidamente oculta passam à frente de foto/notas/PWA. Investigação e critérios: [EXCLUSAO-VISIBILIDADE-PERSONAGENS.md](EXCLUSAO-VISIBILIDADE-PERSONAGENS.md). A exclusão guiada é bloqueada explicitamente no guard 0013 e não possui operação de FichasApi: exige contrato de arquivo/referências e testes backend antes de disponibilizar os menus. Não está implementada no PR #167. Visibilidade já é fixada em campaign ao salvar desde 0013; backfill de registros antigos exige diagnóstico seletivo, sem apagar escolhas privadas nem presumir intenção. Não aplicar SQL em produção.

Resultado adicional local: build final e tipos E2E aprovados. Ficha em 320/390: quatro cenários aprovados; desktop1440 repetido sozinho após timeout sob concorrência, dois cenários aprovados, incluindo alinhamento em tela cheia e dois grupos, sem aumentar timeout/retries. Compêndio: 16/16 aprovados. Suíte completa anterior 1820/1820; execução final local ainda sem relatório, conferir CI no commit 8285e50. PR #167 aberto em rascunho, sem merge/deploy.


Validação final local concluída: **1821/1821 testes** aprovados (relatório alpha-final.json), build e tipos E2E aprovados. CI de 5fba414: Validar projeto e Preview aprovados; E2E ainda em execução. Alpha falhou duas vezes antes da stack: npm 404 para @ecies/ciphers durante instalação do CLI, sem executar cenários. Ajuste pontual do workflow usa supabase/setup-cli@v3, mantendo CLI 3.2.0 e o fallback oficial verificado por checksum; mesmos comandos locais, barreiras e testes. Resultado do novo HEAD deve ser confirmado no PR.

## RETOMAR AQUI — Ciclo de vida dos personagens (27/11/2026, branch `codex/personagens-exclusao-visibilidade`)

**PR #167 integrado e publicado:** merge `a3200c3` (árvore idêntica ao HEAD aprovado `2ecc871`); "Publicar versão de testes" e E2E da `main` aprovados.

**Nesta branch (não mesclada, não publicada, nenhum SQL aplicado):** o trabalho local do Codex que não tinha sido enviado foi salvo como estava (`b3ea4a6`); a 0021 foi reescrita conforme a DEC-038, com interface do jogador e do mestre, transferência com aceite, lote, avisos e as duas origens do "oculto dos jogadores". Guia completo, aplicação e limites: [EXCLUSAO-VISIBILIDADE-PERSONAGENS.md](EXCLUSAO-VISIBILIDADE-PERSONAGENS.md).

Corrigido no caminho: no celular o menu de contexto apenas navegava, e as ações da lista ficavam inacessíveis.

**Ordem de publicação:** aplicar a 0021 antes de publicar o aplicativo (sem ela as ações simplesmente não aparecem). O reparo das identidades antigas é independente e precisa de autorização própria.

**Não feito:** consulta ou escrita em produção; verificação em celular físico; Auth/REST reais fora do CI (o cenário do ciclo foi acrescentado a `scripts/alpha/run-local.mjs` e roda no workflow Alpha Supabase isolado do PR). Decisão pendente: apagar ou manter a cópia privada após a exclusão definitiva.

**Próximo passo exato:** com o ciclo revisado e integrado, **Minhas anotações do jogador** (DEC-035): lista por última edição, título, BlockNote existente (`EditorLazy`/`PageEditor`), tela cheia no celular, salvamento automático, recuperação, retorno à lista preservando o documento, privadas por usuário e campanha inclusive para o mestre, preservando as notas atuais. Ainda não iniciado. Depois: foto da conta, #100 (criação sem escolhas prévias), #96/#99 e o roteiro com mestre e dois jogadores.

### PR #168 e decisão de retenção (27/11/2026)

PR **#168** aberto pelo responsável: https://github.com/Waudz/compendio-5e/pull/168. **Não mesclar nem aplicar a 0021** sem revisão e autorização. A decisão pendente sobre a cópia foi respondida (retenção em `EXCLUSAO-VISIBILIDADE-PERSONAGENS.md`): 30 dias em "só no Compêndio", sem prazo no arquivamento e nenhuma cópia na exclusão definitiva, com confirmação exigida também pelo banco. No commit anterior (`83f8839`) passaram Preview, Validar projeto e Alpha Supabase isolado, incluindo o cenário do ciclo com Auth/REST reais. Depois de aplicar a 0021, é obrigatório conferir o agendamento da limpeza.

## RETOMAR AQUI — DEC-039, etapa 1 concluída (branch `feat/alpha-personagens-etapa1`)

Base: `main` em `49f4600` (#168 publicado; Pages e E2E da main aprovados). 0021 já aplicada em produção — **não reaplicar**. Etapa 1 sem migração.

**Etapa 1:** página Personagens com os componentes do Compêndio (lista padrão, grade, preferência por usuário, busca por personagem e jogador, ordenação, reticências), seções Aventureiros e NPCs (convertidos e NPCs do Compêndio com ficha de criatura), filtros de situação, sem texto permanente nem "ficha de outro participante"; "+ Criar" único (`ui/BotaoCriar`); quem está só no Compêndio é gerenciado pela identidade. Foco do título sem contorno; reabrir/tela cheia só no grupo da direita; ficha de criatura alinhada (o #167 tinha trocado `.ficha-jogo > *` por `.ficha-largura` sem envolver `FichaMonstro`).

**Provisório até a etapa 3:** em Personagens, "Criar NPC" cria o NPC narrativo e abre a identidade com o aviso para atribuir a ficha ("Vincular ficha de combate", só modelo de criatura compartilhado). **Pendentes da DEC-039:** PV/condições na lista e filtro de estado vital (etapas 4 e 5).

**Próximo passo exato — etapa 2 (identidade e tipos de ficha de NPC).** Fatos já levantados:
- NPC do Compêndio = `notes` (kind `npc`) + `campaign_codex`; sua ficha de criatura é só `combat_definition_id` (0020), **referência a uma definição do catálogo ou da campanha**, compartilhada: editar altera todos que a usam.
- Ficha própria de criatura sem migração: copiar o modelo para uma `campaign_definitions` exclusiva (`custom-…`) com `codex_definition_save` e apontar com `codex_set_combat_sheet`. É preciso **ocultar essas cópias** das listas do bestiário e tratar a remoção (`codex_definition_remove` recusa definição em uso).
- Ficha de personagem exige nota `kind='character'` (`notes_ficha_guard`, `nota_guiada_ativa`, políticas de `character_sheets`). Dar ficha de personagem a um NPC do Compêndio **sem criar segunda identidade** pede migração: ou permitir a ficha ligada à nota `npc` do Codex, ou converter o registro preservando o ID, o conhecimento por campo e os vínculos. É a decisão técnica central da etapa; preparar, testar isolado e pedir autorização antes de produção.
- Personagem convertido em NPC continua nota `character` (0021) e não tem conhecimento por campo; a etapa 2 deve unificar a apresentação.
- Estado vital (etapa 5) deve entrar no registro narrativo e nas chaves de `codex_reveal`; os dois tipos de nota acima precisam dele.

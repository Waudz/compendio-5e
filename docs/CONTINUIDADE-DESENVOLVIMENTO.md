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

Branch `feat/compendio-campanha-regras`, continuada de `c3d74a6`. Trabalho isolado em worktree; alterações não commitadas do checkout original preservadas. Sem alterações no legado, produção, merge ou deploy.

- Categorias ativas e navegáveis; consultas de origens/características/condições reutilizam as fontes atuais. Filtros, visualização e contexto preservados por sessão/campanha. Cartões em coluna única com arte provisória Lucide licenciada.
- Registros narrativos usam notes + índice/referências `campaign_codex`. Conhecimento do jogador é uma projeção no servidor, não filtro de campos privados recebidos. Bestiário com quatro níveis; itens mágicos revelados aparecem em Descobertas/Regras sem liberar adição ao inventário; portadores retornam apenas identidade já pública.
- Storage privado separado, envio só pelo mestre, referência trocada após sucesso, arquivos antigos retidos para recuperação. Notificações internas idempotentes; sem push nem revelação automática por combate/posse. Atualização por foco/evento local/poll visível (30 s), sem prometer Realtime.
- Cabeçalho mobile prova propriedade por registro/campanha, protege resposta assíncrona atrasada e não atribui nova função ao toque repetido em Ficha. Os helpers E2E usam o menu inferior quando a barra redundante foi removida.
- Imagens: 77 itens + 52 monstros preservados, 129 HTTP 200, IDs válidos. Acervo do navegador ainda requer exportação do aparelho. Nenhum arquivo do 1.0 alterado.
- **0015 proposta, NÃO aplicada**. Pré-requisitos, preflight somente leitura, SHA, rollback com arquivo privado dos dados e aplicação exata em `docs/COMPENDIO-CONHECIMENTO.md`. Verificar a situação remota da 0014 separadamente; não aplicar diretório inteiro automaticamente.
- Validação final em execução: **1.733 testes unitários/integração/SQL passaram, sem falhas**; TypeScript e build passaram; 12 novos E2E passaram nas quatro larguras base, com axe; SQL/propriedade/portadores adicionados. Acompanhar o PR único e finalizar o registro dos resultados antes da entrega. Docker ausente localmente; Auth/REST/JWT/Storage reais devem passar no workflow isolado existente. **Não integrar nem publicar sem revisão final.**

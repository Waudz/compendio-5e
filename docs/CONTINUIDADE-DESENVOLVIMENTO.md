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

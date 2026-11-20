# Auditoria de conteúdo — raças, classes e origens (2014)

> **Estado:** levantamento inicial dos arquivos do Compêndio 1.0, **não** validação completa das regras. Não importar como conteúdo certificado até concluir a conferência individual. Nenhuma mudança de banco ou conteúdo publicado neste PR.

## Objetivo e método

Conferir **cada raça/variante, classe, subclasse e origem** antes de migrar para o novo Compêndio. Verificar ganhos no nível inicial, escolhas, progressão até nível 20 quando aplicável, pré-requisitos, recursos limitados, fórmulas, equipamento, proficiências, traduções, fonte e edição. Distinguir dados ausentes, erros e diferenças legítimas entre publicações de 2014 e suplementos posteriores. O aplicativo poderá oferecer opções fora do SRD; não copiar automaticamente textos protegidos.

**Fontes do legado inspecionadas:** `js/regras.js`, `js/origens.js`, `js/criador-regras.js`, `js/subclasses-2014.js`, `dados/criacao-srd2014.json`, `docs/FONTES-CRIADOR.md`, `tests/progressao-niveis.test.cjs` em `Waudz/rastreador-dnd`. Fonte declarada pelo legado para a base: SRD 5.1 / 5e-database / HeroQuill. A documentação do legado declara **12 subclasses SRD + 8 adicionais**, sem cobertura total do Livro do Jogador.

## Classes: inventário inicial (12 de 12)

O JSON possui 20 entradas de nível para **cada classe**, mas isso **não prova** que todas as características, escolhas, magias ou efeitos estejam corretos ou implementados. As subclasses abaixo são as identificadas nos arquivos consultados.

| Classe | Subclasse SRD presente | Adicional presente | Conferência por nível |
|---|---|---|---|
| Bárbaro | Berserker | Guerreiro Totêmico | Pendente 1–20 |
| Bardo | Conhecimento | Bravura | Pendente 1–20 |
| Clérigo | Vida | — | Pendente 1–20 |
| Druida | Terra | Lua | Pendente 1–20 |
| Guerreiro | Campeão | Mestre de Batalha; Cavaleiro Místico | Pendente 1–20 |
| Monge | Mão Espalmada | — | Pendente 1–20 |
| Paladino | Devoção | — | Pendente 1–20 |
| Patrulheiro | Caçador | — | Pendente 1–20 |
| Ladino | Ladrão | Assassino; Trapaceiro Arcano | Pendente 1–20 |
| Feiticeiro | Linhagem Dracônica | Magia Selvagem | Pendente 1–20 |
| Bruxo | Corruptor | — | Pendente 1–20 |
| Mago | Evocação | — | Pendente 1–20 |

**Lacuna confirmada de cobertura:** 20 subclasses presentes não equivalem à totalidade das opções de 2014. Ex.: Domínio da Guerra (Clérigo) e Escola de Abjuração (Mago) não constam entre as 20 subclasses dos arquivos inspecionados. Conferir ainda todas as subclasses do Livro do Jogador, depois suplementos, por fonte e versão; não misturar revisão de 2024.

**Teste existente:** `tests/progressao-niveis.test.cjs` percorre níveis 1–20 para 12 classes, checando progressão de nível, PV mínimo, características duplicadas e quantidade de melhorias de atributo. **Não substitui** teste de conformidade de cada recurso por nível, subclasse e escolha.

## Raças e variantes: inventário inicial (38 entradas)

`js/regras.js` contém uma lista resumida, com nome, deslocamento, modificadores e texto curto; **não é um modelo completo de características por nível**. Itens a conferir individualmente:

- Aasimar; Anão da Colina; Anão da Montanha; Autognomo; Draconato
- Elfo Alto; Elfo da Floresta; Drow; Fada; Firbolg
- Genasi do Ar, Água, Fogo e Terra; Gnomo da Floresta; Gnomo da Rocha
- Goliath; Halfling Pés Leves; Halfling Robusto; Humano; Humano Variante
- Kenku; Meio-elfo; Meio-orc; Tabaxi; Tiefling; Tritão; Metamorfo
- Bugbear; Goblin; Hobgoblin; Orc; Kobold; Povo-lagarto; Yuan-ti Puro-sangue
- Centauro; Minotauro; Sátiro

**Alerta de edição/fonte:** várias raças acima são de suplementos posteriores a 2014, e algumas têm revisões distintas. Registrar a publicação e versão **por entrada**, inclusive mudanças de bônus de atributo, tipos de criatura e traços. Verificar especialmente características raciais que desbloqueiam magias ou melhoram com nível de personagem; o resumo atual não basta para a futura ficha.

## Origens/antecedentes: inventário inicial (13 predefinidos + 1 personalizado)

`js/origens.js` inclui: Acólito, Artesão de guilda, Artista, Charlatão, Criminoso, Eremita, Forasteiro, Herói do povo, Marinheiro, Nobre, Órfão, Sábio, Soldado; além de Background personalizado.

Cada origem deve ser validada por: **duas perícias**, proficiências com ferramentas, idiomas (inclusive escolhas), equipamento e quantidades, moedas, característica narrativa, opções alternativas e vínculos para itens do catálogo. **Origens de 2014 não têm progressão de classe por nível**; suas concessões são principalmente iniciais. O registro atual tem campos `per`, `idiomas`, `ferr`, `ferrEscolhas`, `ferrTipo`, `ouro`, `caracteristica`, `equip`, mas vínculos são nomes de itens em texto, não IDs estáveis.

**Exemplo de risco:** Acólito concede um “Símbolo sagrado” genérico; o catálogo deve preservar a escolha da variação (amuleto, emblema ou relicário) e não tratar preço/peso como iguais para todas as apresentações. Conferir também se moedas em `ouro` representam dinheiro dentro da algibeira, e não uma concessão adicional duplicada.

## Modelo-alvo mínimo (a validar antes de implementar)

- IDs estáveis e exclusivos; `tipo`, `nome`, `edicao`, `fonte`, `versaoFonte`, `statusAuditoria`.
- Raça: traços iniciais, escolhas, proficiências, deslocamento, modificadores e **concessões por nível quando houver**, com subraças/variantes explícitas.
- Classe: dado de vida, proficiências, equipamento inicial, requisitos multiclasse, tabela de níveis 1–20, conjuração, escolhas e recursos por nível.
- Subclasse: classe pai, nível de escolha, concessões por nível e opções internas.
- Origem: perícias, ferramentas, idiomas, característica, equipamentos com **IDs de itens**, quantidades, escolhas e dinheiro.
- Concessões referenciam IDs de **magias, habilidades, talentos, itens e condições**; separar descrição do comportamento executável; uma ficha de personagem mantém suas próprias escolhas e instâncias de itens.
- Dados públicos de referência separados de dados personalizados e estado de jogo; não alterar o Supabase sem autorização.

## Checklist de auditoria individual

Para **cada registro**, preencher em rodada posterior: identificador; fonte e edição; campos originais; comparação com fonte verificável; concessões iniciais; concessões por nível 1–20 (se aplicável); escolhas e requisitos; vínculos existentes/quebrados; divergências; correção proposta; teste de regressão; estado **não conferido / correto / incompleto / incorreto / corrigido e validado**. Nunca marcar como correto apenas porque o teste automatizado atual passou.

## Próxima execução

1. Extrair matriz automática de níveis e recursos das 12 classes e 20 subclasses; confrontar cada nível com referência da mesma edição.
2. Revisar as 38 entradas raciais, uma a uma, incluindo subraças e poderes que escalam com nível.
3. Revisar as 13 origens, uma a uma, incluindo equipamentos e quantidades.
4. Registrar subclasses e opções ausentes, mantendo a diferença entre SRD, Livro do Jogador e suplementos.
5. Só então preparar importadores e testes de integridade para o novo Compêndio.

## Rodada 2 — integridade estrutural da progressão (verificada no código)

**Método:** leitura e análise do JSON `dados/criacao-srd2014.json` do repositório legado; conferência cruzada dos IDs de `classes[].data.levels[].features` e `subclasses[].data.levels[].features` contra os IDs em `features[]`. Inspeção das subclasses adicionais em `js/subclasses-2014.js`. Isto é **auditoria de integridade interna**, não comparação normativa concluída com livros.

### Resultado quantitativo

| Indicador | Resultado |
|---|---:|
| Classes com tabela de exatamente 20 níveis | 12/12 |
| Subclasses SRD com tabela própria de concessões | 12 |
| Subclasses adicionais declaradas em JS | 8 |
| Registros de características no JSON | 407 |
| Referências de características inexistentes nas tabelas de classes e subclasses SRD | **0** |

**Atenção:** “0 referências inexistentes” significa apenas que os IDs das tabelas apontam para registros presentes. Não garante que a habilidade seja concedida no nível correto, que as escolhas sejam válidas ou que o motor implemente seu efeito.

### Matriz de níveis das subclasses SRD existentes

| Classe — subclasse | Níveis com características declaradas |
|---|---|
| Bárbaro — Berserker | 3, 6, 10, 14 |
| Bardo — Conhecimento | 3, 6, 14 |
| Clérigo — Vida | 1, 2, 6, 8, 17 |
| Druida — Terra | 2, 6, 10, 14 |
| Guerreiro — Campeão | 3, 7, 10, 15, 18 |
| Monge — Mão Espalmada | 3, 6, 11, 17 |
| Paladino — Devoção | 3, 7, 15, 18, 20 |
| Patrulheiro — Caçador | 3, 7, 11, 15 |
| Ladino — Ladrão | 3, 9, 13, 17 |
| Feiticeiro — Linhagem Dracônica | 1, 6, 14, 18 |
| Bruxo — Corruptor | 1, 6, 10, 14 |
| Mago — Evocação | 2, 6, 10, 14 |

### Oito subclasses adicionais identificadas

- Bardo — Colégio da Bravura
- Druida — Círculo da Lua
- Guerreiro — Mestre de Batalha; Cavaleiro Místico
- Ladino — Assassino; Trapaceiro Arcano
- Feiticeiro — Magia Selvagem
- Bárbaro — Trilha do Guerreiro Totêmico

**Pendente:** validar individualmente a progressão dessas oito subclasses, incluindo escolhas internas, limites de uso, magias, substituições e recursos escaláveis. As oito estão declaradas em código JS separado, não como registros `subclasses[]` do JSON de base; o novo modelo deve unificar essa representação sem perder a proveniência.

### Níveis sem novas entradas explícitas de `features` nas classes

| Classe | Níveis |
|---|---|
| Bardo | 7, 11 |
| Clérigo | 13, 15 |
| Druida | 3, 5, 7, 9, 11, 13, 15, 17 |
| Paladino | 9, 13, 17 |
| Patrulheiro | 9, 13, 17 |
| Feiticeiro | 5, 7, 9, 11, 13, 15 |
| Bruxo | 5, 7, 9, 18 |
| Mago | 3, 5, 7, 9, 11, 13, 15, 17 |

Bárbaro, Guerreiro, Monge e Ladino têm pelo menos uma entrada explícita em todos os níveis. **Não classificar níveis vazios como erros automaticamente:** evolução de conjuração, espaços, escolhas, progressão de recursos e características da subclasse podem existir em outros campos. Conferir cada nível na fonte correspondente.

### Problemas de modelagem já demonstráveis

1. A lista de raças em `js/regras.js` usa **resumos textuais** para traços, e não concessões normalizadas por nível. A futura criação de personagens precisa de escolhas, gatilhos de nível e referências a magias/habilidades.
2. As origens em `js/origens.js` usam **nomes textuais de equipamentos** em `equip`, sem referências estáveis ao catálogo de itens. Conferir quantidades, variantes e se `ouro` representa moedas dentro da algibeira.
3. Subclasses extras vivem em **estrutura separada** da base SRD. A migração deve preservar concessões por nível e opções internas, sem assumir equivalência de campos.
4. A lista de raças mistura fontes e épocas de publicação; **não atribuir “2014” a todas** apenas porque o sistema segue regras 5e 2014.

### Próxima rodada de conformidade

Auditar por classe, começando por **Bárbaro e Bardo**, cada nível de 1 a 20, incluindo subclasses e escolhas. Em paralelo, iniciar raças base **Anão, Elfo, Halfling e Humano**, separando variantes. Depois revisar as origens individualmente, começando por **Acólito**, com vínculo para itens, quantidades e proficiências. Cada divergência normativa precisa de fonte identificada e teste específico.

## Rodada 3 — comparação externa de Bárbaro e Bardo (regras de 2014)

**Fontes de referência externas consultadas:** D&D Beyond, **Basic Rules (2014), Classes**, https://www.dndbeyond.com/sources/dnd/basic-rules-2014/classes ; Wizards of the Coast, **SRD 5.1**, https://media.wizards.com/2016/downloads/DND/SRD-OGL_V5.1.pdf . **Não usar páginas de classe atuais de 2024 como fonte de progressão 2014**.

### Bárbaro — tabela de níveis 1–20

**Conferência concluída somente para a sequência de características nomeadas e três colunas numéricas da tabela**, comparando cada um dos 20 níveis do legado com a tabela de Bárbaro das Basic Rules (2014). Resultado: **20/20 níveis compatíveis** quanto a características nomeadas, quantidade de Fúrias, bônus de dano da Fúria e dados de Crítico Brutal. O valor interno `rageCount:9999` no nível 20 representa **ilimitado**, não 9.999 usos reais; o modelo novo deve usar `unlimited: true` ou equivalente.

| Níveis | Características da classe (2014) |
|---|---|
| 1 | Fúria; Defesa sem Armadura |
| 2 | Ataque Descuidado; Sentido de Perigo |
| 3 | Caminho Primitivo |
| 4 | Melhoria de Atributo |
| 5 | Ataque Extra; Movimento Rápido |
| 6 | Característica do Caminho |
| 7 | Instinto Selvagem |
| 8 | Melhoria de Atributo |
| 9 | Crítico Brutal (1 dado) |
| 10 | Característica do Caminho |
| 11 | Fúria Implacável |
| 12 | Melhoria de Atributo |
| 13 | Crítico Brutal (2 dados) |
| 14 | Característica do Caminho |
| 15 | Fúria Persistente |
| 16 | Melhoria de Atributo |
| 17 | Crítico Brutal (3 dados) |
| 18 | Força Indomável |
| 19 | Melhoria de Atributo |
| 20 | Campeão Primitivo; Fúria ilimitada |

**Conferido no nível 1:** dado de vida d12, proficiências de armadura leve/média e escudos, armas simples/marciais, salvaguardas Força/Constituição, escolha de duas perícias dentre Adestrar Animais, Atletismo, Intimidação, Natureza, Percepção e Sobrevivência. Os campos `effects` e `hitDie` do JSON correspondem à fonte. **Equipamento:** `startingEquipment` fixa pacote de explorador e quatro azagaias; escolhas adicionais ficam em `startingChoices`, que exigem teste do fluxo completo de seleção.

**Ainda não validado:** texto integral e condições de cada habilidade, duração/recarga de Fúria, modificadores na ficha, multiclasses, escolha de Caminho e suas opções internas, cálculo de PV, escolhas de equipamento e comportamento do motor em combate.

### Bardo — tabela de níveis 1–20

**Conferência concluída somente para a sequência de características nomeadas e escalonamento de dados**: os 20 níveis no legado correspondem à tabela das Basic Rules (2014) para características de classe, Inspiração de Bardo (d6 no 1, d8 no 5, d10 no 10, d12 no 15) e Canção do Descanso (d6 no 2, d8 no 9, d10 no 13, d12 no 17). Segredos Mágicos aparecem nos níveis 10, 14 e 18, com duas escolhas em cada etapa.

| Níveis | Características da classe (2014) |
|---|---|
| 1 | Conjuração; Inspiração de Bardo (d6) |
| 2 | Pau para Toda Obra; Canção do Descanso (d6) |
| 3 | Especialização; Colégio de Bardo |
| 4 | Melhoria de Atributo |
| 5 | Inspiração (d8); Fonte de Inspiração |
| 6 | Contrafeitiço; característica do Colégio |
| 7 | Sem característica nova nomeada na tabela |
| 8 | Melhoria de Atributo |
| 9 | Canção do Descanso (d8) |
| 10 | Especialização; Inspiração (d10); Segredos Mágicos |
| 11 | Sem característica nova nomeada na tabela |
| 12 | Melhoria de Atributo |
| 13 | Canção do Descanso (d10) |
| 14 | Segredos Mágicos; característica do Colégio |
| 15 | Inspiração (d12) |
| 16 | Melhoria de Atributo |
| 17 | Canção do Descanso (d12) |
| 18 | Segredos Mágicos |
| 19 | Melhoria de Atributo |
| 20 | Inspiração Superior |

**Conferido no nível 1:** dado de vida d8, armadura leve, armas simples e armas especiais listadas na fonte, salvaguardas Destreza/Carisma, escolha de três perícias quaisquer e três instrumentos musicais. `effects` e `hitDie` conferem. Equipamento fixo `startingEquipment`: armadura de couro e adaga; escolhas adicionais em `startingChoices`.

**Lacuna crítica ainda aberta para o criador:** comparar **todos os 20 níveis** de truques conhecidos, magias conhecidas e espaços de magia de cada círculo; verificar substituição de magias, escolhas de Segredos Mágicos, interação de Segredos Adicionais do Colégio do Conhecimento, uso/recarga da Inspiração, conjuração ritual, foco e escolhas de equipamento. Os níveis 7 e 11 não são “vazios”: a progressão de conjuração continua.

### Critério obrigatório de aprovação para uso no criador

Um registro só poderá receber estado **validado para criação de personagem** quando houver evidência de:
1. **Cobertura:** opções e variantes da fonte selecionada inventariadas, sem opções silenciosamente ausentes;
2. **Dados iniciais:** PV, proficiências, atributos, idiomas, equipamentos e alternativas;
3. **Progressão:** todos os níveis 1–20, recursos escaláveis, conjuração, escolhas e pré-requisitos;
4. **Subclasses:** nível de seleção, características por nível e escolhas internas;
5. **Execução:** testes de criação, subida de nível, substituições, multiclasses e casos extremos;
6. **Rastreabilidade:** fonte, edição, diferenças de suplementos/revisões e lacunas declaradas;
7. **Regressão:** testes automáticos por nível e cenários de personagens, não apenas IDs existentes.

**Estado após rodada 3:** Bárbaro e Bardo têm **tabelas de características parcialmente validadas**, **não** estão aprovados para o criador. Nenhuma raça, origem ou subclasse foi declarada 100% validada.

## Rodada 4 — conjuração do Bardo e equipamento inicial (2014)

**Fontes externas:** SRD 5.1 da Wizards (https://media.wizards.com/2016/downloads/DND/SRD-OGL_V5.1.pdf) e versão navegável SRD 5.1 no D&D Beyond (https://www.dndbeyond.com/attachments/39j2li89/SRD5.1-CCBY4.0_License_live%20links.pdf). Comparação com `dados/criacao-srd2014.json` e `js/criador-regras.js` do legado.

### Bardo — progressão de conjuração

As 20 entradas do JSON têm `cantripsKnown`, `spellsKnown` e `spellSlots` com nove posições (círculos 1–9). A tabela coincide com a progressão de Bardo do SRD 5.1 para os valores verificados. Amostras e marcos:

| Nível | Truques | Magias conhecidas | Espaços por círculo (1–9) |
|---|---:|---:|---|
| 1 | 2 | 4 | 2 |
| 3 | 2 | 6 | 4, 2 |
| 5 | 3 | 8 | 4, 3, 2 |
| 7 | 3 | 10 | 4, 3, 3, 1 |
| 10 | 4 | 14 | 4, 3, 3, 3, 2 |
| 11 | 4 | 15 | 4, 3, 3, 3, 2, 1 |
| 14 | 4 | 18 | 4, 3, 3, 3, 2, 1, 1 |
| 17 | 4 | 20 | 4, 3, 3, 3, 2, 1, 1, 1, 1 |
| 18 | 4 | 22 | 4, 3, 3, 3, 3, 1, 1, 1, 1 |
| 20 | 4 | 22 | 4, 3, 3, 3, 3, 2, 2, 1, 1 |

**Atenção a Segredos Mágicos:** `js/criador-regras.js` calcula `qtd` de magias normais como `spellsKnown - sum(magicalSecretsMax_*)`. Isto pode representar corretamente a separação entre escolhas normais e escolhas de Segredos Mágicos **somente se** as escolhas de Segredos Mágicos forem armazenadas, validadas e contadas separadamente, sem reduzir o total da ficha. O código visto não é evidência suficiente de que o fluxo completo faz isso. **Status: risco de integração / teste funcional pendente**, não afirmar bug de perda de magias sem executar cenário.

**Casos obrigatórios de teste:** Bardo níveis 1, 3, 6 (Colégio do Conhecimento: Segredos Adicionais), 10, 14, 18 e 20; escolha de magias de outras listas quando permitido, limite por círculo, substituição ao subir de nível, espaços de magia e multiclasse. As escolhas adicionais do Colégio do Conhecimento **não devem ser descontadas** do número normal de magias conhecidas. Não misturar Segredos Mágicos normais com Segredos Adicionais.

### Equipamento inicial de Bárbaro e Bardo

Os arquivos do legado distinguem itens fixos em `startingEquipment` e alternativas em `startingChoices`. A estrutura corresponde às alternativas previstas no SRD 2014:

- **Bárbaro:** pacote de explorador + quatro azagaias; escolher machado grande **ou** arma marcial corpo a corpo; escolher dois machados de mão **ou** arma simples.
- **Bardo:** armadura de couro + adaga; escolher rapieira, espada longa **ou** arma simples; pacote de diplomata **ou** artista; alaúde **ou** outro instrumento musical.

**Status:** estrutura das alternativas conferida nos arquivos e comparada à referência; **não testada ainda** a resolução de escolhas para itens concretos, peso, inventário, duplicação e persistência.

### Critérios para próxima rodada

- Executar cenários automatizados de criação e subida de nível de Bardo (incluindo Segredos Mágicos), não apenas comparar arrays.
- Verificar todas as características e recursos de Bárbaro e Bardo em detalhe (limites, recarga, pré-requisitos e escolhas).
- Auditar subclasses Bárbaro Berserker/Totêmico e Bardo Conhecimento/Bravura, incluindo opções internas.
- Revisar raças e origens individualmente, mantendo fonte/edição explícitas.

**Situação:** nenhum registro está aprovado como 100% validado para o novo criador.

## Rodada 5 — pesquisa de criadores abertos e contrato de confiabilidade do futuro criador

**Escopo:** estudo de arquitetura, experiência de uso, licenças e riscos; **não** importar código ou dados de terceiros nesta rodada. Referências pesquisadas em novembro de 2026:

| Projeto | Evidência verificada | Aproveitar como inspiração | Não copiar/risco |
|---|---|---|---|
| [OpenPentacle](https://github.com/arrowedisgaming/OpenPentacle) | SvelteKit, pacotes JSON, validação Zod, motor de funções puras, testes Vitest/Playwright; código GPL-3.0; conteúdo embarcado SRD **2024** | rastreabilidade de bônus, validação de pacotes, testes de motor | não transplantar código GPL para app sem decisão de licença; **não** misturar progressão 2024 com 2014 |
| [Borealis](https://github.com/TeamBorealis/borealis) | suporta SRD 2014/2024 separados, multiclasses, arquivos locais, importação com prévia; licença MIT **ou** Apache-2.0 | separação rígida de edição, prévia de importação, portabilidade | não presumir que importações externas sejam legais ou corretas; conferir código específico antes de reutilizar |
| [Brainstorm Club](https://github.com/Brainstorm-Club/dnd-character-builder) | Vue/TypeScript, assistente de nove etapas, importação/exportação JSON, PDF, PWA; MIT | fluxo de etapas, revisão final, importação validada | README declara conteúdo não coberto pelo SRD; licença MIT do código **não** autoriza copiar todos os dados |
| [Fablesheet](https://github.com/fablesheet/fablesheet) | React/TypeScript, offline-first, ficha/inventário/magias, GPL-3.0-or-later, pré-1.0 | separação entre dados e ficha jogável, persistência offline | estágio inicial e licença copyleft; não reutilizar código sem análise |

### Decisão de arquitetura para o Compêndio 5e (proposta; não implementada)

**Não usar o JSON legado como verdade de produção.** O legado é fonte de *candidatos* à migração. Um registro publicado deve carregar:

- `id` estável, `kind`, `ruleset: "5e-2014"`, `sourceId`, `sourceVersion`, `license` e `reviewStatus`;
- **concessões estruturadas** (`grants`): proficiência, idioma, deslocamento, visão, resistência, recurso, magia, item, bônus, escolha, substituição e condição;
- `atLevel`, `requires`, `choices` (quantidade, opções, exclusões, dependências), `scaling` e `recharge`;
- descrição em português **separada da mecânica**; descrição não deve ser analisada por regex para aplicar bônus;
- `validationEvidence`: fonte/página ou URL, versão, revisor, casos de teste e divergências conhecidas.

**Dois modos de avaliação:** (a) *prévia de construção* determinística e sem efeitos colaterais; (b) *aplicação* transacional da escolha confirmada à ficha. Recalcular derivados a partir de escolhas e concessões, evitando acumular bônus duplicados. Inventário, magias preparadas, PV atuais e usos gastos são **estado de jogo**, distinto dos direitos de progressão.

### Funcionalidades adicionais recomendadas

1. **Por que tenho isto?** Cada bônus, proficiência, magia e habilidade na ficha exibe sua origem (raça, classe, nível, subclasse, talento, item), com link para o registro de regra.
2. **Prévia antes de confirmar:** escolher raça, classe ou subir de nível mostra alterações de PV, perícias, magias, equipamentos e recursos, com avisos de conflitos.
3. **Escolhas pendentes explícitas:** a ficha não se declara completa se houver proficiência, equipamento, magia, especialização, estilo de luta ou característica por selecionar.
4. **Linha do tempo de níveis:** histórico de decisões por nível; ao alterar uma decisão anterior, recalcular dependências e mostrar escolhas invalidadas antes de salvar.
5. **Verificador de ficha:** apontar opções ausentes, excesso de magias, proficiências repetidas, pré-requisitos não satisfeitos e conteúdos incompatíveis com a edição.
6. **Modo rascunho/homebrew isolado:** opções não auditadas podem ser testadas, mas nunca confundidas com conteúdo oficial validado.
7. **Importação com prévia e quarentena:** importar JSON externo só após validar esquema, origem, edição, IDs e integridade; jamais executar scripts de pacotes.
8. **Versão de regras por personagem:** atualização de catálogo não muda retroativamente personagens sem prévia/migração explícita; manter registro das versões utilizadas.
9. **Testes metamórficos:** subir um nível e desfazer restaura a ficha anterior; reprocessar a mesma escolha não duplica concessões; ordem de aplicação de benefícios independentes não altera o resultado; importar/exportar preserva as escolhas.
10. **Matriz de cobertura por publicação:** distinguir opções de PHB 2014, SRD 5.1 e suplementos para o sistema 2014, com estados ausente / extraído / conferido / implementado / testado.

### Critérios de bloqueio (gates)

**G0 — legal/proveniência:** fonte identificada, versão 2014 correta, direitos de distribuição verificados.

**G1 — completude:** campos obrigatórios e alternativas por nível presentes, sem referências órfãs e sem opções omitidas silenciosamente.

**G2 — equivalência normativa:** conferência contra fonte primária de cada nível, escolha e efeito, com divergências registradas.

**G3 — comportamento:** motor aplica efeitos corretamente; testes unitários para regras, escolhas, progressão, multiclasses, conjuração e inventário.

**G4 — ponta a ponta:** personagens representativos criados, evoluídos, editados, exportados/importados e usados na ficha/combate sem perda de dados.

**G5 — regressão:** suíte automatizada no CI; falha bloqueia publicação dos registros afetados.

**Status:** esta rodada entrega **pesquisa e especificação**, não código do motor, dados certificados nem testes executados. Os resultados de tabelas da auditoria anterior não substituem G0–G5. A meta “100% confiável” deve significar **nenhuma lacuna conhecida e evidência verificável** para cada opção, não promessa de infalibilidade.

### Ordem de implementação sugerida

1. Formalizar esquema TypeScript/Zod de concessões, escolhas e proveniência; fixtures 2014 pequenas e verificadas.
2. Implementar motor puro de avaliação e relatório de pendências, com testes determinísticos.
3. Auditar e importar verticalmente **uma opção completa** (por exemplo, Bárbaro 1–20 + Berserker + equipamentos) até passar G0–G5; não importar centenas de registros sem motor.
4. Replicar por classe/subclasse, raças e origens; testar combinações e multiclasses.
5. Só depois integrar criador guiado, prévia, ficha jogável e migrações de dados.

**Restrições:** não alterar Supabase sem autorização; repositório legado somente leitura; nenhum código de terceiros incorporado sem exame de licença; separar sempre 2014 e 2024.

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

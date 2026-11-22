# Catálogo de D&D 5e (2014) — itens, magias e monstros

Status: **implementado no Compêndio** (branch `feat/catalogo-dnd-2014`, PR dependente apenas da `main`). Dados e interface testados em jsdom e conferidos contra a D&D 5e SRD API; **não validado em dispositivo físico** nem com leitor de tela. Esta frente **não altera** autenticação, campanhas, navegação global nem o criador de personagens (ver "Contratos para o criador").

## 1. Auditoria: Compêndio 2.0 (main) × Compêndio 1.0 (`rastreador-dnd`)

| Conteúdo | Compêndio 2.0 antes desta entrega | Compêndio 1.0 | Decisão |
|---|---|---|---|
| Itens | 578 itens (237 mundanos + 341 mágicos), pt-BR, validados (PR #74/#78) | `dados/itens-srd2014.json` (a mesma fonte) | já reaproveitado; ganha filtros e detalhe em painel |
| Magias | **nenhuma** (seção era placeholder) | `dados/magias.json`: 319 magias SRD em português (nome, texto, círculo, classes) + `dados/srd-pt.json` | **reaproveitado integralmente**; estrutura mecânica refeita a partir da SRD API |
| Monstros | **nenhum** | `dados/bestiario/srd-2014.json`: 325 fichas (Open5e v2, SRD 5.1) + tradutor em `js/app.js` + dicionários em `srd-pt.json` | **reaproveitado**: dados, tradutor (executado em build) e dicionários |
| Características de classe | — | `dados/habilidades*.json` | **fora do escopo** (pertence ao criador/classes) |
| Imagens | — | 4 ilustrações de monstros em `fotos/` (da API Open5e) | **não importadas**: licença não confirmada |
| Ícones | lucide-react | ícones do app (logo, favicon) | os ícones do catálogo são do próprio app (lucide); a identidade visual do 1.0 não é conteúdo de catálogo |
| Funcionalidades do 1.0 | — | busca, ficha de monstro com rolagens, magias com links | pesquisa, filtros, lista/grade e ficha completa foram refeitos; **rolagens de dados e links monstro→magia não foram portados** (pendente) |

### Defeitos do legado encontrados e corrigidos (nada some em silêncio)
A auditoria comparou cada magia e cada monstro com a SRD API. O que divergiu foi decidido caso a caso e está em `scripts/catalogo/` (listas `CLASSES_AUDITADAS`, `EXCLUIDOS`, `CORRECOES`):

- **Magias:** 319 de 319 batem em nível, escola, concentração, ritual e componentes. 5 listas de classes divergem (Open5e × API) e foram decididas: Fogo das Fadas = Bardo+Druida; Criar Alimentos e Água = Clérigo+Paladino; Fundir-se à Pedra = Clérigo+Druida; Olho Arcano = Mago; Adivinhação = Clérigo. **A confirmar no PDF do SRD 5.1** (decisão tomada pelo cruzamento das fontes, não pelo livro). Defeito de grafia "Cïrculos" corrigido. Amizade Animal e Heroísmo têm texto de "círculos superiores" que a API omite (o legado e o SRD trazem).
- **Monstros:** 2 duplicatas com ND ausente removidas (`elf-drow` = `drow`; `gnome-deep-svirfneblin` = `deep-gnome-svirfneblin`); Diabo da Corrente ND 11 → 8 (3.900 XP); Alce Gigante CA 15 → 14; Burro sem dados de vida (2d8+2); XP normalizado pela tabela do SRD em 29 fichas (ND 0 vale 10 XP; Rã e Cavalo-marinho 0); **deslocamento errado no legado** (`speed_all` do Open5e inventa natação/escalada a partir da caminhada: agora usa `speed`); ambientes de livros de terceiros (`tob_*`) removidos de 12 fichas; **idiomas e defesas mal traduzidos** pelo tradutor do 1.0 ("Comum plus até five other idiomas") passaram por tradução dedicada, com trava que falha o build se sobrar inglês.
- **Divergências aceitas da API** (o catálogo segue o SRD; a API erra): CA do Basilisco (15), XP do Cavalo de Montaria, Dretch, Filhote de Dragão de Latão e Gnomo das Profundezas (tabela do SRD). Listadas em `scripts/catalogo/verificar-catalogo-api.mjs` com o motivo.

### Licenças
SRD 5.1 © Wizards of the Coast LLC, **CC BY 4.0** (atribuição exibida no detalhe, em "Atribuição", e gravada em cada arquivo de dados). Textos em português: tradução do projeto (com auxílio de IA, pode haver erros — aviso no próprio catálogo). Estrutura de dados e tradutor: Compêndio 1.0 (mesmo autor). Dados em inglês do 1.0 vieram do Open5e (SRD 5.1). **Sem imagens de terceiros.**

## 2. Arquitetura (dados centralizados, preparada para outros sistemas)

```
src/catalogue/
  nucleo/                 tipos.ts (SistemaDef, CategoriaDef, filtros), busca.ts (índice + consulta), registro.ts (sistemas, carregamento com cache)
  sistemas/dnd5e-2014/    index.ts (SistemaDef), categorias.ts (itens, magias, monstros), esquemas.ts (Zod), rotulos.ts + formatar.ts (pt-BR), data/*.json
  contratos.ts            API de leitura para o criador e outras áreas
src/compendio/            interface genérica (CompendioCatalogo), detalhes por categoria, esqueletos
src/Compendio.tsx         ponto de entrada da seção + página de item (aba `item:`)
scripts/catalogo/         construir-magias.mjs, construir-monstros.mjs, verificar-catalogo-api.mjs
```

- **Núcleo sem React e sem sistema:** uma `CategoriaDef<T>` declara como carregar, o que é pesquisável, quais filtros e ordenações existem. A interface lê só `nucleo/` e o registro.
- **Dados únicos:** cada fato existe em um lugar (arquivo de dados). Textos e rótulos pt-BR ficam separados do dado estruturado (`rotulos.ts`, `formatar.ts`), então outro idioma ou sistema não mexe nos arquivos de dados.
- **Carregamento:** itens já estão em memória (indexados na hora, sem esqueleto); **magias (~437 KB) e monstros (~900 KB, ~150 KB comprimidos) são pedaços separados** (`import()` dinâmico), baixados só quando a categoria é aberta, com esqueleto, erro e "Tentar de novo". O carregamento confere versão e contagem; a validação completa (Zod, hash, API) roda nos testes.
- **Pesquisa:** índice criado uma vez por categoria; sem acento/maiúsculas; todos os termos obrigatórios; nome (pt ou original) pesa mais que o texto; entradas de centenas de itens dispensam índice invertido (consulta linear em milissegundos). Lista com "Mostrar mais" (60 por vez) em vez de virtualização.
- **Interface:** categorias como grupo de botões (sem `tablist`, para não colidir com o modelo de abas), pesquisa, ordenação, filtros em `<details>`, lista ou grade, **painel dividido** em contêineres largos (≥ 900 px, por container query) e **tela cheia com "Voltar à lista"** em contêineres estreitos; cartões sem `aria-label` (o nome acessível é o texto visível, WCAG 2.5.3). Estilos reutilizam as variáveis e componentes do Compêndio 2.0.

### Como adicionar outro sistema de RPG
1. Criar `src/catalogue/sistemas/<id>/` com `esquemas.ts`, `rotulos.ts`/`formatar.ts`, `categorias.ts` e `data/*.json`.
2. Exportar um `SistemaDef` (id, nome, fonte e licença, categorias) e registrá-lo com `registrarSistema` (como `garantirSistemaDnd5e2014`).
3. Se a categoria exigir um detalhe próprio, acrescentar o componente em `src/compendio/` e o `case` em `Detalhe` (hoje por `cat.id`). **Pendente:** seletor de sistema na interface (hoje só há D&D 5e 2014) e um mapa categoria → componente de detalhe.

## 3. Pesquisa e filtros por categoria

| Categoria | Filtros |
|---|---|
| Itens | categoria, raridade, tipo de arma, propriedade de arma, tipo de armadura, requer sintonização |
| Magias | círculo, escola, classe, tempo de conjuração, alcance, duração, ritual, concentração, componente material, causa dano |
| Monstros | faixa de ND, tipo, tamanho, ambiente, deslocamento especial, ações lendárias, conjurador |

Ordenações: itens (nome, categoria); magias (nome, círculo); monstros (nome, ND ↑/↓, PV). Com texto digitado, "Relevância" é o padrão.

## 4. Contratos de dados para o criador (integração futura)

Somente leitura, em `src/catalogue/contratos.ts`. O criador **não precisa** importar nada de `src/compendio/`.

- **Identificadores estáveis:** `id` = `index` da SRD API (`fireball`, `adult-red-dragon`, `longsword`). Nunca usar o nome.
- **Referência versionada:** `{ sourceId: 'srd-2014', kind: 'spell' | 'item', id, revision: '1' }` — o mesmo formato de `src/rules/content-registry.ts` (`refMagia`, `refItem`). Monstros: `refMonstro(id)` (`categoria: 'monstros'`; ainda não há `ContentKind` para monstro).
- **Funções (assíncronas, com cache):**
  - `todasAsMagias()`, `magiaPorId(id)` → `Magia`.
  - `magiasDaClasse(classe, { circulo?, ate?, ritual? })` → `ResumoMagia[]` (id, nome, en, nivel, escola, classes, ritual, concentracao), ordenado por círculo e nome. Classes: `bard cleric druid paladin ranger sorcerer warlock wizard`.
  - `magiasInexistentes(ids)` → ids que **não existem nesta revisão** (validação de escolhas salvas na ficha).
  - `todosOsMonstros()`, `monstroPorId(id)`; `itemPorId(id)`, `refItem(id)` (itens: já em memória).
- **Formato da magia (`Magia`):** `id, en, nome, nivel (0–9), escola, classes[], ritual, concentracao, tempo {tipo, qtd}, alcance {tipo, pes? | milhas?}, duracao {tipo, qtd?, unidade?, ate?}, componentes {v,s,m}, material?, area?, ataque?, salvaguarda?, dano?[], subclasses?[], descricao[], superiores?`. `subclasses` lista as subclasses SRD que concedem a magia (útil para magias de domínio/juramento).
- **Regras de integração:** a ficha deve guardar **só o `id`** (e a revisão), nunca copiar o texto; ao abrir uma ficha, validar com `magiasInexistentes`. Quando a revisão do catálogo mudar, `revision` muda e fichas antigas apontam para a revisão antiga (o criador decide migrar).
- **Para evoluir sem quebrar:** acrescentar campos é compatível; renomear/remover exige nova `revision` e esquema (`schemaVersion`). As conjurações por classe/nível (espaços de magia, magias conhecidas/preparadas) são **regras de classe** e ficam com o criador; este catálogo só diz *quais* magias existem para cada classe.

## 5. Como regenerar e conferir os dados

```bash
node scripts/catalogo/construir-magias.mjs   --legado ../rastreador-dnd [--api cache.json]
node scripts/catalogo/construir-monstros.mjs --legado ../rastreador-dnd
node scripts/catalogo/verificar-catalogo-api.mjs [--magias-api cache.json] [--monstros-api cache.json]   # rede, manual
```
Os construtores abortam (sem gravar) se uma divergência não tiver decisão registrada ou se sobrar inglês em idiomas/defesas/CA. O verificador devolve código 1 se houver divergência não explicada.

## 6. Limitações e pendências
- **Tradução dos monstros:** 1.153 de 1.472 características/ações (78%) foram traduzidas pelo tradutor do 1.0; o restante aparece **no original, com aviso**, e o texto original em inglês fica disponível nas traduzidas.
- **Magias:** componentes materiais (`material`) permanecem em inglês (como no legado); distâncias em metros, com o valor original entre colchetes onde o texto traz.
- **Itens:** descrições são resumos derivados dos dados (texto integral do SRD ainda não importado); itens mágicos sem conferência externa.
- **Não portado do 1.0:** rolagens de ataque/dano das ações, links monstro → magia, imagens.
- **Classes de magias:** 5 decisões a confirmar no PDF do SRD (seção 1).
- **Seletor de sistema** e detalhe por categoria genérico: pendentes (hoje há um só sistema).
- **Sem virtualização** (paginação por "Mostrar mais"); suficiente para as 1.200+ entradas atuais.
- **Outros cartões do app** (lista de Personagens, ficha guiada) ainda têm `aria-label` que não contém o texto visível; fora desta frente.
- Testes em jsdom (não medem layout real): o painel dividido depende de container query (verificado manualmente em 375, 800 e 1440 px).

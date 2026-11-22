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
| Funcionalidades do 1.0 | — | busca, ficha de monstro com rolagens, magias com links | pesquisa, filtros, lista/grade e ficha completa foram refeitos; **links monstro→magia foram portados** (conjuração); **rolagens de dados não** (pendente) |

### Defeitos do legado encontrados e corrigidos (nada some em silêncio)
A auditoria comparou cada magia e cada monstro com a SRD API. O que divergiu foi decidido caso a caso e está em `scripts/catalogo/` (listas `CLASSES_AUDITADAS`, `EXCLUIDOS`, `CORRECOES`):

- **Magias:** 319 de 319 batem em nível, escola, concentração, ritual e componentes. 5 listas de classes divergem (Open5e × API) e foram decididas: Fogo das Fadas = Bardo+Druida; Criar Alimentos e Água = Clérigo+Paladino; Fundir-se à Pedra = Clérigo+Druida; Olho Arcano = Mago; Adivinhação = Clérigo. **Confirmado no PDF oficial do SRD 5.1** (listas de magias por classe). Defeito de grafia "Cïrculos" corrigido. Amizade Animal e Heroísmo têm texto de "círculos superiores" que a API omite (o legado e o SRD trazem).
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
node scripts/catalogo/comparar-mecanica-api.mjs --monstros-api cache.json    # campos mecânicos × API (rede ou cache), código 1 se houver diferença sem explicação
node scripts/catalogo/construir-formas.mjs --monstros-api cache.json         # dados por forma do Vampiro e dos licantropos (gera scripts/catalogo/formas-monstros.json)
node scripts/catalogo/auditar-traducoes.mjs                                  # fidelidade numérica e de termos de regra: português × original (roda também no Vitest)
```
Os construtores abortam (sem gravar) se uma divergência não tiver decisão registrada ou se sobrar inglês em idiomas/defesas/CA. O verificador devolve código 1 se houver divergência não explicada.

## 6. Limitações e pendências
- **Tradução dos monstros: 1.472 de 1.472 características/ações (100%)**, sem resto de inglês (teste `dados.test.ts`). Origem por camada, nesta ordem: (1) tradutor do 1.0 (estrutura do ataque, deslocamento em metros); (2) `scripts/catalogo/conjuracao-monstros.mjs` (as 39 características de conjuração, com ligação às magias); (3) `traducoes-monstros.json` (200 textos que o 1.0 não converte, chaveados pelo sha1 do original e **validados por assinatura numérica**: dados, CD, pontos de vida e porcentagens iguais aos do original, senão o build falha; mais 72 nomes de ações); (4) `traducoes-frases.json` + `completar-traducao.mjs` (memória de tradução por frase para o efeito em inglês que o 1.0 deixava depois da estrutura do ataque; frase sem tradução cadastrada faz o build falhar; `--frases-faltantes <arquivo>` lista o que falta). O original em inglês fica disponível em cada texto (`orig`). A interface ainda mostra o aviso "Ainda sem tradução" para qualquer texto futuro com `tr: false`. As traduções são revisão editorial minha, sem revisão de tradutor humano: erros de terminologia devem ser corrigidos nos dois JSON e o build refeito.
- **Magias:** componentes materiais (`material`) permanecem em inglês (como no legado); distâncias em metros, com o valor original entre colchetes onde o texto traz.
- **Itens:** descrições são resumos derivados dos dados (texto integral do SRD ainda não importado); itens mágicos sem conferência externa.
- **Não portado do 1.0:** rolagens de ataque/dano das ações, imagens.
- **"Ray of Sickness"** (citada nos clãs de bruxas) não existe entre as 319 magias do SRD: aparece como "raio nauseante", sem ligação. **Burro** (`donkey`) existe no legado e não na SRD API nem como ficha própria no PDF do SRD 5.1 (traz o Mule): mantido por preservação de dados, a avaliar.
- **Classes de magias:** as 5 decisões foram confirmadas no PDF oficial do SRD 5.1 (listas de magias por classe): Fogo das Fadas (Bardo, Druida), Criar Alimentos e Água (Clérigo, Paladino), Fundir-se à Pedra (Clérigo, Druida), Olho Arcano (Mago), Adivinhação (Clérigo; não consta na lista do Mago).
- **Seletor de sistema: não será implementado.** O sistema é determinado pela campanha selecionada (decisão registrada no PR #83); o catálogo não tem seletor próprio. O `sistemaDnd5e2014` fica registrado por `registrarSistema` e quem escolher o sistema pela campanha o resolve por `id` (`dnd5e-2014`), sem mudar este módulo.
- **Sem virtualização** (paginação por "Mostrar mais"); suficiente para as 1.200+ entradas atuais.
- **Outros cartões do app** (lista de Personagens, ficha guiada) ainda têm `aria-label` que não contém o texto visível; fora desta frente.
- Testes em jsdom (não medem layout real): o painel dividido depende de container query (verificado manualmente em 375, 800 e 1440 px).

## 7. Conciliação do bestiário (323) com a SRD API (334) e links monstro → magia

**Contagem.** A API tem 334 fichas; o catálogo, 323. A diferença está inteira em `src/catalogue/sistemas/dnd5e-2014/data/reconciliacao-monstros.json` e é conferida por `verificar-catalogo-api.mjs` e `dados.test.ts` (id de um lado só sem explicação = falha):
- **Duplicatas do legado (2, removidas):** `elf-drow` = `drow`; `gnome-deep-svirfneblin` = `deep-gnome-svirfneblin`.
- **Id alinhado à API:** `succubusincubus` → `succubus-incubus` (o único id do legado que diferia do da API para a mesma criatura; 316 fichas comparáveis).
- **Fichas compostas (6 no catálogo × 18 formas na API):** o legado e o PDF do SRD trazem uma ficha só para Vampiro e para os cinco licantropos (Lobisomem, Ursolaco, Javalaco, Ratolaco, Tigrolaco), com as formas descritas dentro do texto; a API as separa em forma humana/híbrida/animal (e vampiro/morcego/névoa). Não é conteúdo ausente: é o mesmo conteúdo em outra granularidade. Fichas separadas por forma ficam como evolução opcional.
- **Só no catálogo (1):** Burro (ver seção 6).
- **Conteúdo realmente ausente do catálogo:** nenhum **nos campos mecânicos comparados** (não só nomes e contagem): `comparar-mecanica-api.mjs` confere, para as 322 fichas que existem na API, características/ações/lendárias/reações (por nome), deslocamentos, sentidos, percepção passiva, salvaguardas e perícias com proficiência, resistências/imunidades/vulnerabilidades e imunidades a condições. Resultado: 0 diferenças sem explicação. As que a comparação achou e que eram **defeitos do legado** foram corrigidas na curadoria, todas confirmadas no PDF do SRD 5.1 (percepção passiva do Diabo da Corrente 11 e do Diabo de Ossos 12; sentido às cegas do Grimlock 30 (lido como 3010); escavação do Dragão Azul Jovem 20; Religião do Sacerdote +4; Aparição com resistência (e não imunidade) a dano e imunidade a veneno/exaustão; Zumbi imune a veneno; Múmia Lorde vulnerável a fogo). Dois casos são **erro da API**, não do catálogo (Vespa Gigante "nada 50"; PDF: só caminha 10 e voa 50). 334 − 18 formas + 6 compostos + 1 (Burro) = 323.
- **Fichas compostas e o que a ficha única guarda:** a ficha única mantém TODAS as características e ações das formas (o conjunto de nomes é conferido contra a união das formas da API), mas as **estatísticas que mudam por forma** (CA, deslocamento, quais ataques cada forma faz) só estavam em texto. Por isso cada ficha composta ganhou `formas`: CA, PV, deslocamento, atributos, percepção passiva, ações e características de cada forma (dados da SRD API, gerados por `construir-formas.mjs` e conferidos pelo comparador). A ficha mostra a tabela "Formas". É a base para a iniciativa/combate escolherem a forma; ainda não há regra de troca de forma em combate (frente da iniciativa).
- **Burro:** o Open5e do legado o rotula como SRD 5.1, mas ele **não está no PDF do SRD 5.1 nem na SRD API** (o SRD traz o Mule). Mantido por preservação de dados com `origem: 'legado'`: não é contado como SRD, a ficha avisa "não confirmado no SRD 5.1" e o identificador é `legado:monster:donkey:1`. Decisão pendente (sua): manter no catálogo ou mover para um acervo legado fora do canônico depois de esclarecer a origem e a licença.
- **Identificadores antigos (aliases):** `succubusincubus` → `succubus-incubus`, `elf-drow` → `drow`, `gnome-deep-svirfneblin` → `deep-gnome-svirfneblin`. Ficam em `idsAnteriores` na ficha e `monstroPorId`/`resolverIdMonstro` (em `contratos.ts`, aditivo) resolvem o id antigo para o atual; um id antigo nunca é reutilizado por outra ficha (teste). Quem guarda referências (fichas, encontros, anotações, iniciativa) deve chamar `resolverIdMonstro` ao carregar e regravar o id canônico.

**Links monstro → magia.** Cada característica de conjuração traz `magias: [{ id, nome }]` (ids do catálogo de magias, nome como aparece no texto). Na ficha, o nome da magia vira um botão ("Abrir a magia …") que abre a magia na categoria Magias e oferece "Voltar para <monstro>". É navegação interna do `CompendioCatalogo` (sem aba nova nem mudança na navegação global); o contrato do criador (`contratos.ts`) não mudou. Nome de magia desconhecido faz o build falhar.

## 8. Fidelidade das traduções (auditoria) e IA sem revisão humana

**Traduzido não é igual a correto.** A auditoria comparou o português com o original em inglês (`auditar-traducoes.mjs`, também executada no Vitest): números, dados, CD, bônus, PV, durações, distâncias (pés × 0,3, polegadas, milhas) e a presença de termos de regra (atributos, tipos de dano, condições, tamanhos). Resultado e o que isso revelou:
- O tradutor do Compêndio 1.0 **aplicava modelos de outra criatura** em vários textos: Parry da Erínia/Gladiador/Marilith dava +2 em vez de +4/+3/+5; Hold Breath da Baleia Assassina 15 min em vez de 30 e da Hidra 15 min em vez de 1 h; sopro do Dragão Dourado/Prateado com efeitos de outra espécie; Atordoar do Vrock como "paralisada"; Mímico e licantropos com o texto de metamorfose do Doppelganger; Estaca no Coração da Cria de Vampiro "paralisa" em vez de destruir; Toque Curativo do Unicórnio com cegueira/surdez; Mefites e Lobo do Inverno com salvaguarda de Constituição em vez de Destreza; Bruxa do Mar sem a condição "amedrontada"; Mudar de Forma do Couatl com o texto de um dragão. Esses 57 textos foram **substituídos** por tradução fiel ao original (`scripts/catalogo/traducoes-substituicoes.json`, sempre com o original em inglês preservado no campo `orig`).
- 200 textos que o legado não convertia e ~560 frases de efeito deixadas em inglês foram traduzidos (`traducoes-monstros.json`, `traducoes-frases.json`); as 39 conjurações têm tradutor próprio com ligação às magias.
- Terminologia padronizada ao resto do Compêndio: tamanho "Miúdo" (o legado usava "Minúsculo"); salvaguarda, círculo, metros; "contido" (restrained), "agarrado" (grappled), "caído" (prone), "atordoado" (stunned).
- Distâncias com erro de digitação na fonte (cone "1 5-foot" do Dragão de Cobre Filhote) seguem o SRD (15 pés = 4,5 m), registrado como exceção justificada no script.
- **Limite da auditoria:** ela não prova que uma frase está bem traduzida; só pega número, distância ou termo de regra divergente. Texto que o legado traduziu com os mesmos números e termos, mas com outra semântica, pode existir. Por isso a ficha exibe, em todo monstro, o aviso de que **a tradução foi produzida com apoio de IA e ainda não recebeu revisão humana**, mantém o original em inglês em cada texto e a regra vale o original em caso de dúvida. Magias e itens vêm do Compêndio 1.0 (texto do legado, sem a mesma auditoria): tratar como "traduzido, não revisado".

## 9. Contratos, identificadores e extensibilidade

- **Fonte única.** Itens, magias e monstros têm um só dado canônico (`src/catalogue/sistemas/dnd5e-2014/data/*.json`, `src/catalogue/data/srd-2014-items.json`). O criador e a ficha usam `src/catalogue/contratos.ts` (`magiaPorId`, `magiasDaClasse`, `itemPorId`, `monstroPorId`, `refMagia`, `refItem`, `refMonstro`) — nenhuma base paralela. Os contratos existentes não mudaram de assinatura; as adições são `resolverIdMonstro` e os campos opcionais `origem`, `idsAnteriores`, `formas`.
- **Identificadores estáveis.** `id` = `index` da SRD API (slug), nunca o nome, e nunca é reutilizado; renomear ou remover só com `idsAnteriores`. A referência completa é `{ sourceId, kind|categoria, id, revision }` (formato de `src/rules/content-registry.ts`).
- **Dados estruturados para a iniciativa.** O monstro traz CA (com detalhe), PV e dados de vida, deslocamentos por tipo (pés), atributos, salvaguardas e perícias, sentidos, percepção passiva, defesas (listas de tipos + texto), ND/XP e ações agrupadas (`ACTION`, `BONUS_ACTION`, `REACTION`, `LEGENDARY_ACTION` com `custo`, `LAIR_ACTION`), uso (`uso`) e, nas fichas compostas, `formas`. **Ainda texto, não estrutura:** bônus de ataque, dano e CD das ações (estão no texto; rolagens de dados não foram portadas).
- **Suplementos e conteúdo personalizado sem colisão.** Cada fonte tem seu `sourceId` e cada sistema seu `SistemaDef.id`; o id só é único dentro de (sistema, fonte, categoria). Conteúdo próprio de campanha deve usar outro `sourceId` (ex.: `homebrew:<campanha>`), nunca o `srd-2014`, e nunca um slug que já exista; essa convenção vale para quem implementar a importação (fora desta frente).
- **Outros sistemas e edições.** Entram registrando outro `SistemaDef` (`registrarSistema`) com dados, esquemas e rótulos próprios; nada do D&D 2014 é compartilhado por herança. O sistema ativo vem da campanha (PR #83); este módulo não tem seletor.
- **Mudanças em contratos compartilhados:** nenhuma que quebre código existente. Se o criador/ficha precisar de outro formato (por exemplo, referência de monstro em `ContentKind`), documentar e combinar antes.

## 10. Compatibilidade dos testes E2E com os cartões novos

O cartão do catálogo não tem mais `aria-label` (o nome acessível é o texto visível: nome + subtítulo [+ resumo], WCAG 2.5.3) e o clique abre o detalhe no painel (`article` "Detalhes de <nome>", título em `h2`), não mais a aba `item:`. `e2e/creator/accessibility.creator.ts` foi ajustado (botão localizado pelo início do nome visível; detalhe pelo `article`). `e2e/creator/flows.creator.ts` não precisou mudar: "Consultar no Compêndio" (inventário) continua abrindo a aba `item:` com `h1`. Novo E2E `e2e/creator/catalogo.creator.ts`: monstro → magia e "Voltar para o monstro", sem overflow, em desktop e celular. Resultado da execução: ver o relatório final deste PR.

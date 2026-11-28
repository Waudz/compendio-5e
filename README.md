# Compêndio 5e 2.0

## Continuidade vigente — 28/11/2026

PRs #171, #172 e #173 integrados; migração 0023 já aplicada conforme confirmação do responsável. Não reaplicar. A nova reformulação está em andamento, sem conclusão funcional nem validação completa. Consultar [handoff para Claude](docs/HANDOFF-CLAUDE-20261128.md) e [escopo aprovado](docs/REFORMULACAO-BETA-20261128.md). Preferir dois PRs; Anotações não iniciada. As informações datadas abaixo são históricas e não substituem este estado.


## Estado atual — 27/11/2026 (prevalece sobre os registros datados abaixo)

- **Publicado:** ciclo de vida dos personagens (migração 0021 aplicada) e a nova página Personagens (#168 e #169).
- **Publicado:** personagens e NPCs integrados ([PR #170](https://github.com/Waudz/compendio-5e/pull/170)); **0022 já aplicada**. Não reaplicar.
- **Em desenvolvimento:** [padronização global de interface](docs/INTERFACE-GLOBAL.md), com escopo entregue, validação e pendências explícitas. A proposta 0023 não foi aplicada.
- **Módulo encerrado:** o que faz, permissões e limitações em [Personagens e NPCs](docs/MODULO-PERSONAGENS-NPCS.md).
- **Após concluir a padronização global:** [anotações dos jogadores](docs/ANOTACOES-JOGADOR.md).
- Prazos: funcionalidades até 05/12/2026; lançamento em 12/12/2026.

## Atualização normativa — 22/11/2026

Consultar [DEC-20261122-A a F](DECISOES-E-ARQUITETURA.md#decisões-vigentes--22112026-dec-20261122-a-a-f). As decisões novas substituem as propostas históricas incompatíveis neste arquivo: campanha obrigatória, beta fechado, sem biblioteca pessoal ou loot distribuído, inventário com pesquisa e criação rápida, preservação do Assimilação e PWA posterior. Não tratar como implementado.


Ferramenta gratuita de apoio à mesa de D&D 5e (regras de 2014), para mestre e jogadores. React + TypeScript + Vite, Supabase (Auth, Postgres, RLS) e GitHub Pages. Projeto de fãs, sem afiliação oficial. O aplicativo anterior (`rastreador-dnd`) permanece independente e não é tocado.

Site publicado: https://waudz.github.io/compendio-5e/ (exige login).

## Alpha 2.0 — registro histórico de 23/11/2026

Este parágrafo registra a situação da data indicada; para a revisão atual, consulte a seção Etapa 1 abaixo e a continuidade.

**Leia primeiro:** [docs/ALPHA-CHECKLIST-20261123.md](docs/ALPHA-CHECKLIST-20261123.md) (estado real, achados, roteiro de testes, publicação e reversão). Em resumo: criador/ficha/inventário, Compêndio, Diário e Anotações, Iniciativa e Encontros (local ou **nuvem**, esta atrás de `VITE_COMBATE_REMOTO=1`), e PV/condições do combate na ficha do jogador estão implementados e testados em ambiente isolado. **Pendem autorizações suas:** desligar o cadastro público no servidor (hoje aberto), aplicar as migrações 0008–0011 no Supabase `compendio-5e` e publicar. Enciclopédia e Documentos não fazem parte da Alpha. Traduções de monstros são de IA, sem revisão humana.

## Etapa 1 — Iniciativa e Encontros (24/11/2026)

O PR #139 revisa a Iniciativa exclusiva do mestre: faixa de turnos centralizada, cartões estáveis, modos independentes de lista/cartões e lados, controles compactos, pesquisas suspensas e abertura da ficha completa no workspace. Encontros têm subabas Criaturas/Tesouros/Progresso, grupos expansíveis, personalizações individuais herdáveis e envio coletivo ou seletivo por identidade estável. Remover e reinserir uma criatura preserva seus PV e estado; nomes repetidos não duplicam identidades.

O loot registra preparação e andamento; marcar como distribuído **não entrega automaticamente** itens à ficha. Monstros sem imagem usam o placeholder. Campos novos são opcionais, sem migração. A validação usa dados sintéticos locais e PostgreSQL isolado, sem alterar campanhas reais; limites e resultados em [continuidade](docs/CONTINUIDADE-DESENVOLVIMENTO.md) e [DEC-023](DECISOES-E-ARQUITETURA.md#dec-023--identidade-individual-e-interface-de-iniciativaencontros-24112026-138139). Confirmar CI/merge do PR antes de considerar esta revisão publicada.

## Refinamentos da Iniciativa — PR #140

Faixa ampliada a 80 px (ativo 96 px) em painel amplo, com centralização adaptada ao workspace e controles estáveis. Busca por categoria sob demanda; PV dos personagens sempre da ficha. Salvamento automático, recuperação e erros preservados, com menos indicadores rotineiros. Loot de recipientes visível e verificado por origem/quantidade. Publicação condicionada aos três workflows verdes no HEAD final; evidências e limites em [continuidade](docs/CONTINUIDADE-DESENVOLVIMENTO.md). Configurações da iniciativa e etapa de Personagens/Fichas/Inventário ficam para depois.

## Estado em 25/11/2026 — Início, Personagens, Iniciativa e celular

Esta seção prevalece sobre os registros datados mais acima.

- **Início da campanha:** capa de destaque com enquadramento que preserva a imagem original (migração `0012`, aplicada em produção), um único botão "Editar" para o mestre, aventureiros com retratos, Diário e Participantes lado a lado e saída da campanha num menu com confirmação.
- **Personagens:** uma lista, um cartão por personagem. A ficha é privada (dono e mestre); os demais veem só a identidade publicada. Guiados não publicados aparecem nos Aventureiros apenas para o dono e o mestre.
- **Iniciativa (só o mestre):** um combate sem participantes pode ser finalizado; remover um personagem grava os PV na ficha antes de ele sair. O seletor da Iniciativa continua excluindo fichas privadas (DEC-024).
- **Celular:** as barras somem ao descer e voltam ao subir, sem piscar no fim da página.
- **Em redefinição, sem implementação:** navegação e anotações do jogador (identidade e ficha: ver "Ficha do personagem" abaixo). Direções já registradas em [Compêndio do jogador](docs/ESPECIFICACAO-COMPENDIO-JOGADOR.md) e [Encontros, Iniciativa e Loot](docs/ESPECIFICACAO-ENCONTROS-INICIATIVA-LOOT.md).

## Personagem D&D 5e 2014 (26/11/2026)

- **Criação por etapas** (identidade, raça, classe, origem, atributos, equipamentos iniciais, revisão e identidade pública), **edição por categorias** e **subida de nível** com comparação.
- **Ficha** em três abas, com indicadores e atributos responsivos, PV sem barra e controles sem molduras ornamentadas; Habilidades por categoria com favoritos no topo; inventário em grade quadrada ou lista, com usar, transferir e excluir.
- **PV, temporários e condições com uma única fonte**: ficha e Iniciativa em tempo real.
- **Editor único de imagens** (arraste e zoom, não destrutivo) e **tema claro** opcional em Conta.

Decisões em [DEC-029](DECISOES-E-ARQUITETURA.md). **Publicação depende da migração 0014** (proposta, não aplicada): ver "RETOMAR AQUI" em [docs/CONTINUIDADE-DESENVOLVIMENTO.md](docs/CONTINUIDADE-DESENVOLVIMENTO.md). Demonstração local com fichas e duas abas: `npm run dev` e `?demo=jogador&fichas=1&nuvem=1` (mestre em outra aba). Prazo de entrega: 12/12/2026.

## Compêndio unificado (26/11/2026, em revisão)

Campanha reúne aventureiros/NPCs, Bestiário conhecido, Locais, Organizações e Descobertas. Regras reúne sete categorias, reutilizando os dados do criador e do combate. Listas, grades e detalhes preservam as imagens selecionadas no 1.0. O mestre revela conhecimentos coletivos; jogadores recebem uma projeção autorizada no servidor, sem notas secretas. Revelar um item não libera sua adição manual ao inventário.

**Requer migração 0015, proposta e não aplicada**, além das anteriores. A publicação permanece bloqueada para revisão. Fontes, limitações, notificações, Storage privado e procedimento exato em [Compêndio e conhecimento](docs/COMPENDIO-CONHECIMENTO.md). A interface não é uma barreira para o SRD público empacotado; a segurança protege os dados privados da campanha. Sem identificação/sintonização nova, galeria global, PWA ou publicação nesta etapa.

## Cartas do Compêndio e bestiário narrativo (27/11/2026, em revisão)

Consulta em cartas, bestiário somente narrativo e fichas com abas (DEC-034). A migração 0020 consta como aplicada em produção (relatório de 27/11/2026). Para testar sem Supabase: `npm run dev` e abra `http://localhost:5173/compendio-5e/?demo=mestre` e, em outra aba, `?demo=jogador` (os dois compartilham os dados do navegador). Roteiro em `docs/CONTINUIDADE-DESENVOLVIMENTO.md`.

Ciclo de vida dos personagens (DEC-038), com a **0021 aplicada em produção**; guia em `docs/EXCLUSAO-VISIBILIDADE-PERSONAGENS.md`.

## Validação no GitHub Actions e previews

Cada pull request é classificado por `scripts/ci-impact.mjs` (usa a versão da `main`; na dúvida, completo):

| Nível | Quando | O que roda |
|---|---|---|
| quick | só documentação | checagens de `tests/` |
| functional | CSS e componentes isolados, sem acesso a dados | build, todos os testes unitários, E2E e preview; sem a pilha Supabase |
| full | todo o resto | tudo |

Os jobs continuam existindo em todos os níveis (só os passos são pulados), há validação completa diária e a publicação sempre roda testes e build. Previews no navegador: [docs/PREVIEW.md](docs/PREVIEW.md). Para rodar o Playwright sem baixar navegadores, use uma configuração local não versionada com `use.channel: 'chrome'`.

## Desenvolvimento

```bash
npm ci            # instala as dependências do package-lock.json
npm run dev       # servidor local
npm run build     # tsc -b && vite build
npm test          # vitest run (inclui os testes de RLS em Postgres em memória)
```

Configuração (sem ela o aplicativo não abre, pois exige login): copie `.env.example` para `.env.local` e preencha `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` (chave **pública**). Nunca use a `service_role` nem a `sb_secret_` no frontend.

## Retomada do projeto em uma nova conversa

**Comece por [`docs/CONTINUIDADE-DESENVOLVIMENTO.md`](docs/CONTINUIDADE-DESENVOLVIMENTO.md).** É o índice central de decisões vigentes, referências externas, limites de implementação, estado de PR/CI e roteiro para continuar sem o histórico do ChatGPT. Antes de qualquer tarefa, confira o HEAD do PR, leia a fonte normativa indicada e não confunda demo, código em branch e produção. **Cada decisão de arquitetura, regras, UX, segurança, persistência ou prioridade deve ser registrada no mesmo conjunto de commits, com contexto, alternativas, consequências, verificação e pendências.** Não realizar merge, deploy ou migrações sem autorização explícita.

## Documentação

| Arquivo | Para quê |
|---|---|
| `docs/CONTINUIDADE-DESENVOLVIMENTO.md` | **Comece aqui**: protocolo de retomada, índice de decisões e referências, hierarquia documental e próximos passos. |
| `DECISOES-E-ARQUITETURA.md` | Regras do projeto, arquitetura vigente e estado real de cada parte. **Ler primeiro.** |
| `docs/PLANEJAMENTO-V2.md` | **Documento principal**: estado, arquitetura, roteiro, pendências e decisões consolidadas de múltiplos chats (atualização de 20/11/2026). **Consultar antes de desenvolver.** |
| `docs/MODULO-PERSONAGENS-NPCS.md` | Personagens e NPCs (módulo encerrado): funcionalidades, permissões, limitações. |
| `docs/ANOTACOES-JOGADOR.md` | **Próxima tarefa**: o que está aprovado, o que falta decidir e onde está o código. |
| `docs/APLICAR-0022.md` | Aplicação da migração 0022 em produção. |
| `docs/NAVEGACAO-ABAS.md` | Navegação por abas, fixação, divisão de painéis e proteção de alterações (implementado). |
| `docs/NOTAS-PERMISSOES.md` | Notas: regras de visibilidade e RLS (`0004`, aplicada), revisão de segurança e evolução planejada. |
| `docs/CRIADOR-FICHA-INVENTARIO.md` | **Memória do desenvolvimento** do criador, ficha e inventário: ferramentas, arquitetura, código piloto, testes e pendências. |
| `docs/AUDITORIA-CATALOGO-PERSONAGEM-2014.md` | Auditoria de regras 2014, lacunas e critérios de certificação. |
| `docs/STATUS-FUNCIONALIDADES-V2.md` | Estimativas e lacunas por módulo; **não** são percentuais medidos. |
| `docs/PLANO-REAPROVEITAMENTO-LEGADO.md` | Inventário do 1.0, fontes SRD, estratégia de migração e limites de licença. |
| `docs/FUNDACAO-REGISTROS.md` | Contratos de registros/links/versões e critérios de segurança. |

Migrações SQL versionadas ficam em `supabase/migrations` (reversões em `supabase/rollback`). Mudar o banco exige autorização explícita; nada é aplicado automaticamente.


## Ver e testar localmente (modo de demonstração)

```powershell
npm ci
npm run dev
```

Abra `http://localhost:5173/compendio-5e/?demo=mestre` (ou `?demo=jogador`). Os dados ficam no localStorage do navegador e são compartilhados entre os dois papéis: publique um registro como mestre e confira como jogador. O modo existe só no `npm run dev` e não entra no build de produção. Ele não usa Supabase; a persistência real do Diário, do Planejamento e da capa depende da migração proposta em `docs/propostas/0006_registros_meta.sql` (e da 0005), ainda não aplicada.


## Estado do catálogo e do criador (PR #74 — em desenvolvimento)

**O site publicado ainda não contém estas mudanças.** O catálogo SRD 2014 e o criador estão sendo preparados na branch `docs/auditoria-catalogos-personagem-2014`, [PR #74](https://github.com/Waudz/compendio-5e/pull/74). Não há merge, deploy nem migração de banco autorizados por este trabalho.

- **Implementado e testado em código:** registro canônico de fontes e IDs, consulta do Compêndio com filtros e visualização lista/grade no piloto, restrições de conteúdo por campanha no domínio, núcleo do criador e inventário, importação e revisão de registros SRD, snapshot offline e leitura validada.
- **Pilotos locais:** `?demo=compendio-piloto` e `?demo=criador-piloto` em `npm run dev`. Usam **dados ilustrativos**, não um catálogo SRD completo. Não são funcionalidades publicadas nem substituem a persistência real.
- **Em preparação:** coleta real e revisão editorial dos dados, tradução, efeitos das habilidades e progressão completa das classes, integração com telas reais e persistência segura.
- **Cartão de Identidade público (piloto):** projeção segura de campos públicos e editor experimental com prévia e testes em `src/rules/public-identity.ts` e `src/dev/public-identity-editor.tsx`. **Ainda sem integração ao criador real, Enciclopédia, banco ou RLS**; não confundir com recurso disponível no site.
- **Projeção da Enciclopédia (domínio experimental):** `src/rules/public-character-encyclopedia.ts` gera apenas os campos autorizados para outros jogadores e mantém o histórico da campanha separado da descrição pública do jogador. Testes cobrem ausência de dados privados. **Não é endpoint seguro nem substitui RLS no Supabase.**
- **Importante:** o endpoint de classe da API não entrega sozinho todos os efeitos e escolhas necessários à ficha. `src/rules/srd-2014-class-level-staging.ts` valida os 20 níveis e registra os IDs de características, **sem inventar regras ou liberar a classe para criação**.

### Coleta controlada de dados SRD 2014

```bash
node scripts/collect-srd-2014.mjs classes
# Outras coleções: races, subraces, subclasses, spells, equipment, features, traits
```

O comando consulta a API `/api/2014` e grava registros **não aprovados** em `.srd-2014-staging/` (ignorada pelo Git), com procedência, alertas de revisão e SHA-256 impresso. Não faz commit, não publica e não concede direitos de redistribuição. Há também `.github/workflows/collect-srd-2014.yml`, acionado manualmente pelo GitHub Actions, que produz artefato temporário de revisão. Como o workflow está apenas na branch do PR, sua execução manual pela interface pode depender de integração posterior à branch padrão. Não realizar merge só para isso.

**Documentação técnica detalhada:** `docs/PLANO-REAPROVEITAMENTO-LEGADO.md`, `docs/AUDITORIA-CATALOGO-PERSONAGEM-2014.md` e `docs/CRIADOR-FICHA-INVENTARIO.md`. Revisar direitos e atribuições de cada fonte antes de distribuir dados externos.

### Validação estrita do adaptador do criador (20/11/2026)

O adaptador `src/rules/character-catalogue-adapter.ts` agora valida em runtime cada variante de concessão (`Grant`), seus campos numéricos, IDs e escolhas aninhadas antes de encaminhar dados ao cálculo da ficha. Rejeita valores inválidos, tipos desconhecidos, opções repetidas e escolhas impossíveis; há testes de regressão em `src/rules/character-catalogue-adapter.test.ts`. Isso **não** substitui a revisão editorial de regras 2014, o esquema completo por categoria, a validação no servidor, a persistência autenticada nem os testes E2E. Mudança restrita à branch do PR #74; sem deploy ou migração.

### Validação de progressão e escolhas cruzadas (20/11/2026)

O adaptador do catálogo canônico rejeita concessões malformadas também nas progressões de classe (`Advancement`), incluindo níveis fora de 1–20, escolhas com contagem inválida, alternativas repetidas e efeitos incorretos. IDs de escolhas devem ser únicos entre raça, antecedente e progressão de classe; uma classe de dado de vida único não pode mudar o dado entre níveis. Testes de regressão em `src/rules/character-catalogue-adapter.test.ts`. **Não certifica regras reais de 2014** nem habilita criação de personagens em produção; CI do último commit requer confirmação.

### Integridade de atributos de fichas (20/11/2026)

O domínio experimental rejeita atributos-base não inteiros, não finitos ou fora de 1–30 antes de calcular modificadores e PV, com regressões para `NaN`, infinito, frações e limites. O intervalo é **limite técnico de integridade**, não autorização para distribuir atributos acima dos limites normais de criação 2014; regras de geração e limites de campanha ainda exigem validação própria. Alteração restrita ao PR #74, sem banco ou deploy.

### Proteção do motor de regras chamado diretamente (20/11/2026)

`buildCharacter` também valida atributos-base inteiros finitos de 1 a 30 e dados de vida inteiros positivos e consistentes em todos os 20 níveis, independentemente do adaptador e da ficha. Novos testes cobrem chamadas diretas ao motor. Essa redundância deliberada protege usos futuros e importações que contornem a interface; **não certifica regras SRD nem publica o criador**. CI do HEAD ainda requer confirmação.

### Entrega vertical: Guerreiro SRD 5.1 (2014) — 20/11/2026

O piloto local do criador agora usa a **mesma definição versionada de Guerreiro** apresentada no Compêndio, baseada na tabela e características do SRD 5.1 (CC BY 4.0). Permite escolher estilo de luta (nível 1), Campeão (nível 3), melhoria de atributo (níveis 4 e 6) e avançar entre níveis 1–6, com características, recursos, PV e atributos na ficha calculada. Testes de domínio e interface foram adicionados. **Limites:** outros arquétipos, progressão completa do Campeão, efeitos condicionais, proficiências, equipamento inicial e catálogo completo ainda não implementados; raça/antecedente seguem amostras. Executar `npm run build` e `npm test` e confirmar CI antes de declarar pronto. Sem merge, deploy ou banco.

**Incremento do personagem de teste (20/11/2026):** Guerreiro 2014 agora oferece escolha de **duas perícias** dentre as oito opções de classe, com caixas de seleção limitadas a duas e exibição na ficha calculada. O teste de domínio e o teste da interface foram atualizados. A verificação anterior do CI (commit `93a6342`) foi aprovada; as mudanças posteriores exigem novo CI. Ainda faltam equipamentos iniciais, proficiências de armas/armaduras, método de atributos, outros arquétipos e persistência real.

### Atributos de criação 2014 — piloto (20/11/2026)

O criador local do Guerreiro agora permite **compra de 27 pontos** (atributos-base de 8 a 15 com custos SRD) e **matriz padrão** (15, 14, 13, 12, 10, 8), com troca de posições sem duplicar valores. O bônus racial da amostra continua sendo calculado separadamente na ficha; pontos de vida atuais são limitados ao novo máximo quando Constituição diminui. Testes de regras em `src/rules/ability-generation-2014.test.ts`. Inspirado no fluxo de escolhas/revisão do Foundry dnd5e, sem copiar código ou acrescentar dependências. **Ainda não há seleção livre de raça/antecedente, equipamentos iniciais completos ou integração de produção.**

**Pacotes de aventureiro (piloto):** `src/rules/starting-equipment-2014.ts` contém receitas 2014 para Explorador e Aventureiro de Masmorras, com IDs candidatos dos itens e quantidades, e os quatro grupos de escolhas iniciais do Guerreiro. Testes em `src/rules/starting-equipment-2014.test.ts`. **Ainda não conectado ao inventário**: primeiro reconciliar os IDs com o catálogo canônico; não criar itens duplicados. Mochilas e outros recipientes permanecem itens normais. Decisões pendentes para discutir com jogadores estão consolidadas em `docs/CONTINUIDADE-DESENVOLVIMENTO.md`.

**Integração experimental de pacotes (20/11/2026):** o criador local permite selecionar Explorador ou Aventureiro de Masmorras e adicionar seus componentes como instâncias individuais `origin: starting`. Os componentes são resolvidos pelo registro compartilhado do **piloto**, que contém entradas mínimas provisórias para esses itens; **isso não equivale à auditoria nem à importação do catálogo definitivo**. Uma segunda adição de pacote inicial é bloqueada para evitar duplicações; ainda faltam substituição assistida, escolhas completas de armadura/armas, imagens, pesos e valores reais. Testes de resolução rejeitam IDs inexistentes. Nenhuma mudança em produção.

**Equipamentos iniciais unificados (20/11/2026):** o piloto de Guerreiro agora confirma o pacote como **escolha de equipamento da classe**, não como aquisição manual independente. `src/rules/starting-equipment-selection.ts` aplica os componentes ao inventário com IDs de origem estáveis, valida referências ao catálogo, evita concessão duplicada e recusa substituir itens iniciais editados sem confirmação. Testes em `starting-equipment-selection.test.ts`. **Pendente:** completar as outras três escolhas de armaduras/armas, equipamentos de antecedente e reconciliação do catálogo definitivo; ainda não é um criador completo.

### Atualização do piloto — quatro grupos de equipamentos do Guerreiro (20/11/2026)

- O criador local exibe escolhas de **armadura, armas marciais, armas adicionais e pacote**, cada uma com prévia dos itens e quantidades. Confirmação aplica os quatro grupos em uma única atualização de rascunho, usando `applyStartingEquipmentSelection` e as mesmas referências de itens registradas no catálogo experimental.
- O registro piloto contém entradas provisórias para todos os componentes; não são definições SRD auditadas. Opções de armas marciais usam **apenas espada longa como amostra**, não a seleção completa de armas permitidas pelas regras.
- Escolhas já concedidas não são substituídas automaticamente. Ainda faltam: catálogo SRD definitivo, armas marciais livres, antecedentes, revisão/substituição assistida, persistência real e testes E2E. Não publicado nem integrado à main.

### Equipamento inicial — manutenção e CI (20/11/2026)

- Corrigidas expectativas fixas de quatro entradas nos testes do Compêndio e snapshot offline: a fixture agora contém itens adicionais necessários ao Guerreiro; os testes usam o tamanho do registro compartilhado em vez de um número antigo.
- `replaceStartingEquipmentSelection` permite **troca explícita e confirmada** de uma escolha de equipamento, preservando itens adquiridos e recusando substituir entradas iniciais consumidas, equipadas ou editadas. Cobertura unitária adicionada. **A UI ainda não expõe esse fluxo de troca**; é uma capacidade do domínio, não funcionalidade publicada.
- A falha de CI anterior era causada por expectativas de tamanho da fixture após a inclusão dos equipamentos. Confirmar o CI do novo HEAD antes de afirmar que os testes passaram.

- **Interface experimental atualizada:** o criador do Guerreiro detecta alterações nas escolhas de equipamento inicial, solicita confirmação antes da troca e usa `replaceStartingEquipmentSelection` para preservar aquisições e bloquear substituições de itens iniciais editados. A confirmação é única para os grupos alterados; o estado do rascunho só é atualizado depois que todos os grupos são validados. Ainda falta testar o fluxo completo no navegador real.

## Catálogo de itens SRD 2014

`src/catalogue/` contém o catálogo canônico de itens (578 itens, nomes em português, dados validados com Zod), usado pelos pilotos do criador e do Compêndio (`?demo=criador-piloto`, `?demo=compendio-piloto`). Regenerar: `node scripts/build-srd-item-catalogue.mjs <caminho/itens-srd2014.json>`; conferir contra a API (rede, manual): `node scripts/verificar-itens-api.mjs`. Dados baseados no SRD 5.1 (CC BY 4.0, Wizards of the Coast LLC); atribuição completa em `src/catalogue/data/srd-2014-items.json`. Ainda experimental: ver `docs/CONTINUIDADE-DESENVOLVIMENTO.md`.

## Criador guiado e Compêndio (experimental)

Pelo menu normal: **Personagens → Criar com o criador guiado** (Guerreiro SRD 2014, equipamento inicial do catálogo oficial, inventário e identidade pública) e **Compêndio** (busca, filtros, lista/grade e página de cada item). No celular: Menu → Personagens / barra inferior → Compêndio. Os personagens guiados ficam **só neste navegador** (armazenamento experimental; ver `docs/CRIADOR-FICHA-INVENTARIO.md`, "Persistência pendente").

## E2E do criador, ficha, inventário e Compêndio

Infraestrutura reutilizada dos PRs #76/#77 sobre o código funcional do #78; sem alterações de domínio. Execute `npm ci`, `npx playwright install --with-deps chromium`, `npm run test:e2e:types` e `npm run test:creator`. Testes isolados, sem contas ou serviços externos. Comandos, dependências e resultados: [TESTES-CRIADOR-E2E](docs/TESTES-CRIADOR-E2E.md). As suítes anteriores continuam disponíveis em `npm run test:e2e` e `npm run test:quality`.
### Persistência das fichas (proposta, não aplicada)

Com conta e a migração `supabase/migrations/0008_character_sheets_persistencia.sql` aplicada, o criador guiado salva a ficha **privada** em `character_sheets` (só o dono e o mestre leem) e publica apenas a identidade que o jogador escolher; há controle de revisão (conflitos), cópia de recuperação local e envio explícito dos rascunhos antigos do navegador. **A 0008 ainda não foi aplicada ao Supabase**: até lá o app informa "banco desatualizado" ao salvar e o modo local experimental continua disponível sem conta. Detalhes, auditoria e procedimento: `docs/CRIADOR-FICHA-INVENTARIO.md`.

## Catálogo de D&D 5e (2014): itens, magias e monstros

O **Compêndio** (menu → Compêndio) reúne 578 itens, 319 magias e 323 monstros (322 do SRD 5.1 e 1 do legado sem origem confirmada) em português, com pesquisa sem acento, filtros próprios de cada categoria, lista ou grade e detalhe completo (em painel dividido no desktop e em tela cheia no celular). Magias e monstros são baixados sob demanda. As traduções dos monstros foram produzidas com apoio de IA e **ainda não receberam revisão humana** (a ficha avisa e guarda o original em inglês). Dados, auditoria contra o Compêndio 1.0, a SRD API e o PDF do SRD, contratos para o criador, identificadores e como adicionar outro sistema: `docs/CATALOGO-DND-2014.md`. Regenerar/conferir dados: `scripts/catalogo/`.

## Criador e fichas 2014 — expansão em revisão

As fichas preservam suas regras antigas. Dentro do criador, a atualização explícita oferece opções SRD 2014 de classe, raça, origem, magias e equipamento, reutilizando a persistência existente por campanha. Não equivale ao PHB completo. [Cobertura, fontes, auditoria, testes e limites](docs/CRIADOR-2014-EXPANSAO.md).

Estabilização do PR #97: [evidências dos testes de persistência e fluxo SRD 2014](docs/ALPHA-VALIDACAO-CRIADOR-97.md). Correção de sincronização dos testes com a ficha de leitura e de seletores E2E; nenhuma alteração de dados reais.

A revisão da navegação global está em validação na branch
`fix/compendio-navegacao-granular`: histórico por aba, abertura local sem divisão
automática e controles compactos. Estado, evidências e limites em
[Continuidade](docs/CONTINUIDADE-DESENVOLVIMENTO.md#revisão-da-navegação-global--26112026-em-validação).

A pesquisa direta na janela de vínculos está preparada em branch dependente da revisão
de navegação: [escopo e limites](docs/VINCULOS-PESQUISA-DIRETA.md).

### Preparação para jogadores reais — 27/11/2026

Estado e limites da rodada em [ALPHA-JOGADORES-20261127](docs/ALPHA-JOGADORES-20261127.md); [roteiro para encaminhar aos jogadores](docs/ROTEIRO-TESTES-JOGADORES.md). Cadastro aberto é a decisão vigente. Nome da conta, menu e preferências seguem a entrega de primeiro acesso; confirmar PR/CI/publicação na continuidade antes de considerar disponível no site. Foto da conta e nova lista de Anotações do jogador continuam pendentes.

### Transferência para o Codex — 27/11/2026

[Estado verificado, evidências e pendências](docs/TRANSFERENCIA-CODEX-20261127.md) · [Prompt completo e independente](docs/PROMPT-CODEX-ALPHA-20261127.md). O PR #165 está validado e aguarda integração/publicação autorizada; a próxima tarefa é reproduzir o bloqueio da própria ficha no desktop. A leitura de notificações em lote está aprovada, ainda não iniciada. Nenhuma dessas pendências foi declarada resolvida.

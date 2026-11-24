# Alpha 2.0 — checklist, procedimento de publicação e roteiro de testes (23/11/2026)

> Fonte de verdade: código da branch `alpha/estabilizacao-20261123` (base `main` `5d53953` + PRs #130 e #131 integrados) e os resultados desta página. Onde contradiz documentos anteriores, valem as decisões mais recentes (DEC-20261123-G/H e as de 23/11 abaixo) e o código.
> **Nada foi aplicado ao Supabase hospedado, nada foi publicado e nada foi mesclado na `main`.**

## 0. Achados que exigem a sua decisão ou autorização (leia primeiro)

1. **O cadastro público está ABERTO no servidor.** Leitura somente de `GET /auth/v1/settings` do projeto `compendio-5e` (chave publicável do próprio site): `disable_signup: false`, confirmação de e-mail ligada. Só o *cliente* esconde o cadastro; qualquer pessoa pode chamar `/auth/v1/signup` direto e, com a conta, criar campanhas (`create_campaign`). **Antes de convidar testadores:** Supabase → Authentication → Sign In/Providers → desligar "Allow new users to sign up" (contas já existentes e a recuperação de senha continuam funcionando — o harness isolado confirma isso). Não alterei nada em produção.
2. ~~**O banco hospedado está atrás do repositório.**~~ **SUPERADO em 23/11:** consulta direta confirmou 0005 e 0008 aplicadas (ver o fim do documento); a sondagem anônima era enganosa. Texto original: Sondagem somente leitura (HTTP anônimo, sem credenciais privadas): existem `campaigns`, `campaign_members`, `notes`, `character_sheets`; **não existem** `create_guided_character` (0008) nem `save_note_content` (0005) — ou seja, **a persistência de personagens no servidor (criador → ficha) não funciona em produção até a 0008 ser aplicada** — e nenhuma tabela das 0009–0011. **Discrepância a esclarecer:** a 0007 (marcada como aplicada) usa `notes.kind`, criada pela 0005, mas a função da 0005 não aparece. Antes de aplicar qualquer coisa, consultar `select version, name from supabase_migrations.schema_migrations order by 1;` e comparar com o livro-razão (`supabase/migrations/LEIA-ME.md`).
3. **Desligar `VITE_COMBATE_REMOTO` não é rollback completo** quanto aos dados: o que foi gravado só na nuvem fica nas tabelas. Recuperação: botão **"Baixar cópia (JSON)"** na Iniciativa e nos Encontros (modo nuvem) e, para o conjunto, `select campaign_id, state, version from public.campaign_combats;` / `campaign_encounters` / `character_combat_status` no SQL Editor (exportar CSV/JSON) **antes** de qualquer reversão. Ver §7.
4. Aplicar as migrações **0008 → 0009 → 0010 → 0011** (e a 0005/0006 se o registro mostrar que faltam) exige a sua autorização expressa.

## 0.1 Fechamento da Alpha (24/11/2026): integração combate x ficha

Feito nesta etapa (sem nova migração; 0009–0011 já aplicadas ao Supabase 2.0, nada reaplicado; o Compêndio 1.0 não foi tocado):

| Requisito | Como ficou | Onde |
|---|---|---|
| PV e condições em tempo real | Cada alteração no combate (dano, cura, condição, entrada/saída de personagem) é enviada por `set_combat_status`; o jogador lê só o status da própria ficha (Realtime + polling de 15 s). Já existia; agora o modo nuvem vai LIGADO no build publicado (`VITE_COMBATE_REMOTO=1` em `pages.yml`). | `Iniciativa.tsx`, `statusCombate.ts`, `EstadoCombateFicha.tsx` |
| PV após finalizar o combate | **Novo.** Ao finalizar, o PV final de cada personagem é gravado em `currentHp` da ficha (mestre pode salvar a ficha pela `save_guided_character`, política da 0008). Se alguma gravação falhar, o mestre escolhe: cancelar (o combate continua aberto, nada se perde) ou finalizar descartando esses PV. | `pvFicha.ts` (`gravarPvFicha`), `Iniciativa.tsx` |
| PV atuais e máximos ao adicionar à iniciativa | **Novo.** Ao escolher o personagem, a ficha é lida e entram PV atuais e PV máximo (calculado pelas mesmas regras da ficha). Sem ficha guiada legível: entra sem PV, com aviso, usando o PV máximo manual se houver. | `pvFicha.ts` (`lerPvFicha`), `SeletorPersonagem` |
| Proteção contra sobrescrita da ficha | Só `currentHp` é alterado, sempre sobre a versão mais recente lida e com a revisão esperada; em conflito (dono salvou no meio) relê e reaplica só os PV, até 3 vezes, e desiste sem sobrescrever. `set_combat_status` nunca escreve na ficha. Monstros e combatentes avulsos nunca tocam em ficha. | `pvFicha.ts`, `pvFicha.test.ts`, `iniciativaFicha.test.tsx` |
| Iniciativa e combate só do mestre | Interface (`AcessoRestrito`, menu sem Iniciativa/Encontros para jogador, nenhuma chamada de API) e banco (RLS exclusiva do mestre nas 0009/0010). | `iniciativaNuvem.test.tsx`, `supabase/combate-*.test.ts` |

Pendências para versões posteriores (não bloqueiam a Alpha):

- Os PV vão para a ficha **ao finalizar**; durante o combate a ficha do jogador mostra o "Estado em combate", mas o `currentHp` da ficha só muda no fim. Se o navegador do mestre fechar sem finalizar, o combate continua salvo (nuvem) e os PV ainda não estão na ficha.
- Condições e PV temporários **não** são gravados na ficha ao finalizar (só PV atuais).
- A gravação final é sequencial por personagem; muitos personagens com rede lenta demoram alguns segundos.
- O jogador com a ficha aberta durante o fim do combate vê a revisão nova só ao recarregar a ficha (se ele salvar com a revisão antiga, o servidor recusa e nada é sobrescrito).
- O cadastro público do Supabase continua aberto no servidor (§0.1); fechar antes de convidar testadores.
- Testes de integração que carregam o catálogo (Bestiário) podem estourar o limite de tempo em máquinas lentas; reexecutar o arquivo isolado resolve.

## 1. Estado real (auditado no código e executado)

| Área | Estado | Evidência | Limite |
|---|---|---|---|
| Login, senha, sessão | Implementado e testado com contas simuladas; `persistSession`/`autoRefreshToken` ligados | `auth.test.tsx`, `etapa1.test.tsx`; harness isolado (CI) cobre JWT curto expirado + refresh e recuperação | Cadastro **aberto no servidor** (§0.1); e-mails reais não exercitados |
| Campanhas, convites, campanha ativa | Implementado e testado (simulado) | `campaignsUI.test.tsx`; harness isolado cobre criação, convite, papel de jogador e isolamento entre campanhas | Teste manual com contas reais (§6) |
| Criador / fichas / inventário | Integrado: 12 classes (1 subclasse SRD cada), 9 opções raciais, 319 magias, equipamento inicial, point buy/matriz, rascunhos | `src/criador/*.test.*` (369 testes focados) | Antecedente: só Acólito + origem personalizada (decisão: suficiente para a Alpha). **Persistência no servidor depende da 0008 (§0.2)** |
| Compêndio (578 itens, 319 magias, 323 monstros) | Integrado; Bestiário só no combate do mestre | testes do catálogo | Traduções de monstros por IA, sem revisão humana |
| Iniciativa e Encontros — modo local | Funciona, só mestre | `iniciativaTela.test.tsx`, E2E | Fica no navegador |
| Iniciativa e Encontros — **modo nuvem** | Implementado; **desligado por padrão** | hook (9), UI (15), RLS combates (33) / encontros / reversão em PGlite, E2E `combate-nuvem` (desktop+celular), harness real no CI | Depende das migrações 0009/0010 no banco hospedado |
| **PV e condições → ficha do jogador** | **Implementado** (migração 0011): o mestre grava por `set_combat_status`; o dono lê só o status da própria ficha (Realtime + polling); sem acesso a ordem, turno, rodada ou outros combatentes; monstros/genéricos não geram status e o Bestiário não é alterado | `supabase/combate-status.test.ts` (17), `iniciativaNuvem.test.tsx`, `estadoCombateFicha.test.tsx`; harness real (CI) | Depende da 0011; o PV *da ficha* (`draft.currentHp`) continua sendo o que o dono registra — o painel "Estado em combate" mostra o do combate, sem sobrescrever a ficha (evita conflito de revisão) |
| Voltar/Avançar do navegador | **Verificado**: desktop (Voltar e Avançar entre abas) e celular (Voltar) | `e2e/historico.spec.ts` (Chrome local) | Celular não oferece Avançar por desenho |
| Diário / Anotações | Funcionam: criar, editar, publicar, excluir→lixeira, conflito de edição sem perder texto; privacidade de notas inclusive perante o mestre | `diarioPlanejamento.test.tsx` e `planejamentoInline.test.tsx` (54, verdes após correção); harness real: nota privada invisível ao mestre, compartilhar é explícito | Sem teste manual hospedado |
| **Enciclopédia e Documentos** | **Não implementadas** (seções com aviso claro "não faz parte da Alpha"); fundação/SQL da Enciclopédia só em rascunho | — | Fora do escopo da Alpha (decisão de congelamento) |
| Navegação por abas (PR #130) | Integrada; **4 testes do PR corrigidos** (expectativa com caractere de controle no lugar de limite de palavra; passavam na `main` e quebravam no PR) | `navigation-behavior.test.ts` + suíte | — |

## 2. Combate, encontros e ficha — o que existe

- **0009** `campaign_combats` (um por campanha, mestre-only, versão otimista, finalizar = DELETE condicionado); **0010** `campaign_encounters` (mestre-only, **sem DELETE pela API**: finalizar nunca apaga encontros); **0011** `character_combat_status` + `set_combat_status`/`clear_combat_status`. Schema de apoio `private_combates` (não acopla a reversão da 0008). Rollbacks em `supabase/rollback/` (reverter **0011 → 0010 → 0009**).
- **Hook `useLinhaRemota`**: uma gravação por vez e em ordem, "salvo" só com confirmação do servidor, nova tentativa automática com recuo, conflito explícito (nada é sobrescrito; cópia local `…:nao-sincronizado`), recarga ao voltar à janela, aviso ao sair com pendências, finalização que só confirma com o servidor.
- **Interface**: modo local/nuvem sempre visível; combate antigo do navegador **não importado nem apagado** (backup com download); turno anterior; rolagem (1d20 + Destreza do monstro); condições; monstros e personagens por referência estável (`ref`); encontros: criar, renomear, duplicar, excluir, quantidades, Bestiário; enviar ao combate preserva o encontro; **Baixar cópia (JSON)** da nuvem.
- **Qualidade**: guardas do construtor de monstros que estavam **vazias** (caractere de controle no lugar de `\b`) foram consertadas; cinco detalhes de CA que passavam em inglês foram traduzidos.

## 3. Resultados de verificação

Ver "Resultados" no final.

## 4. Migrações e ordem (compatibilidade auditada)

Ordem de aplicação sobre o estado remoto provável: **(0005, 0006 se faltarem) → 0008 → 0009 → 0010 → 0011**. `supabase/estado-remoto.test.ts` aplica 0008–0011 sobre um banco 0001–0007 **com dados** (campanhas, membros, notas) e confere que nada se perde e que a RLS fica ligada; reaplicar 0009–0011 falha sem duplicar. Nenhuma migração desta fase altera dados existentes.

## 5. Limitações conhecidas da Alpha

- Modo nuvem **desligado** até a autorização; sem ele, combate/encontros ficam no aparelho.
- O harness com **Supabase real (CLI + Docker) roda só no GitHub Actions** (`Alpha Supabase isolado`): **não havia Docker nesta máquina**. Os checks novos (encontros, finalização, status da ficha, cadastro fechado no stack local) estão no `scripts/alpha/run-local.mjs`, com sintaxe validada, mas **não executados localmente**. O E2E de navegador contra o Supabase real (login por UI, criar campanha, convidar, criar personagem, combate) **não foi escrito** — escrevê-lo às cegas sem poder rodá-lo arriscaria um CI quebrado; o fluxo equivalente no nível da API está no harness e o fluxo de tela, no E2E de demonstração (servidor falso).
- Realtime do status da ficha depende da publicação `supabase_realtime` do projeto; há polling de 15 s como reserva.
- Enciclopédia e Documentos: não implementados.
- Traduções de monstros/itens/magias por IA, sem revisão humana.
- Revisão de segurança do projeto hospedado (Data API, Auth, buckets) permanece manual.

## 6. Roteiro de testes manuais (após as autorizações)

1. (Servidor) Desligar cadastro público; confirmar `GET /auth/v1/settings` com `disable_signup: true`; tentar cadastrar por fora do app → recusado.
2. Entrar como mestre → criar campanha → convidar jogador → sair; entrar como jogador (conta já existente) pelo convite. F5; fechar/reabrir o navegador (continua logado); outro aparelho.
3. Jogador: criar personagem (classe, raça, antecedente, atributos, perícias, equipamento), salvar rascunho, fechar, retomar, finalizar; ficha e inventário (adicionar/remover/equipar).
4. Mestre: abrir o personagem; Compêndio → Monstros → detalhe e links para magias.
5. Mestre: Encontros → criar, Bestiário, quantidades, duplicar, renomear; F5 e outro aparelho.
6. Mestre: Iniciativa → enviar o encontro, adicionar o personagem do jogador **com PV máximo**, rolar, turnos/rodadas, dano/cura/condições; "Salvo na nuvem"; F5; outro aparelho; cortar a rede (aviso e nova tentativa) e religar.
7. Jogador, na própria ficha: "Estado em combate" mostra PV e condições em segundos, **sem** ordem/turno/rodada/outros.
8. Dois aparelhos do mestre editando ao mesmo tempo: conflito → "Recarregar do servidor".
9. Finalizar o combate: a ficha deixa de mostrar o estado; os encontros continuam; novo combate começa limpo.
10. Jogador: sem Iniciativa/Encontros no menu; chamadas diretas à API de `campaign_combats`, `campaign_encounters` devolvem vazio/negado.
11. Voltar/Avançar do navegador; celular: repetir 3, 5, 6 e 7 em tela estreita.

## 7. Publicação e reversão (somente com autorização expressa)

**Antes:** snapshot/backup do projeto `compendio-5e` (nunca `rastreador-dnd`); `select … from supabase_migrations.schema_migrations`; rodar os testes de RLS contra uma cópia/branch de desenvolvimento.
**Publicar:** (1) desligar cadastro público; (2) aplicar as migrações pendentes na ordem (§4); (3) `VITE_COMBATE_REMOTO=1` no build do GitHub Pages; (4) build e publicação; (5) roteiro §6.
**Reverter o modo nuvem sem perder dados:** (a) pedir a cada mestre "Baixar cópia (JSON)" em Iniciativa e Encontros **ou** exportar as tabelas por SQL (`campaign_combats`, `campaign_encounters`, `character_combat_status`); (b) remover `VITE_COMBATE_REMOTO` e republicar (a interface volta ao modo local; **o conteúdo gravado só na nuvem não aparece no modo local**, por isso a cópia do passo a); (c) só então, se necessário, reverter o banco: `0011` → `0010` → `0009` (apagam o conteúdo dessas tabelas; nenhuma tabela anterior é tocada). Importar a cópia de volta ao modo local é manual (não há importação automática por decisão).

## 8. Backlog da Beta (adiado)

Importar cópia JSON no modo local; Realtime também para combate/encontros entre aparelhos do mestre; Enciclopédia e Documentos; outras subclasses e antecedentes; revisão humana das traduções; automação de regras/conjuração em combate; E2E de navegador contra o Supabase real; novos sistemas de RPG; sincronizar o PV da ficha (`draft.currentHp`) ao finalizar o combate (opção do mestre).

## Resultados (execução local em 23/11/2026, Windows, Chrome instalado)

| Verificação | Resultado |
|---|---|
| `tsc -b` e `tsc -p e2e/tsconfig.json` | passaram |
| `npm run build` (produção) | passou |
| Vitest completo | **118 arquivos, 1473 testes, todos passaram** (inclui 252+ de SQL/RLS em PGlite: combates, encontros, status, reversão, compatibilidade das migrações pendentes) |
| `node --test scripts/alpha/local-only.test.mjs` (barreiras contra produção) | 3/3 |
| Playwright (Chrome local, desktop 1440 e celular 390, 15 specs) | **30 passaram**, 0 falhas: navegação, iniciativa local, combate na nuvem (servidor falso), Voltar/Avançar, criador, fichas, inventário, Compêndio |
| Harness Supabase **real** (CLI + Docker) | **não executado localmente** (sem Docker); roda no GitHub Actions (`Alpha Supabase isolado`); novos checks adicionados e com sintaxe validada |
| E2E de navegador contra Supabase real | não existe (ver §5) |
| `playwright.quality`/`creator` (8 larguras, axe) | a configuração `creator` foi executada em partes na rodada anterior desta frente; a suíte `quality` completa **não foi reexecutada** nesta sessão |

CI do GitHub: **não verificado** (branch ainda sem PR no momento deste registro).

### Correção do workflow "E2E e responsividade" (23/11/2026, CI do PR #132 reprovou 3 grupos)

Causas reais (reproduzidas localmente com as mesmas resoluções do CI: 320, 360, 390, 700, 701, 768, 1024, 1440; nenhum teste foi desativado ou afrouxado):
1. **`e2e/historico.spec.ts`, celular estreito (320):** o teste só dispensava o "Avançar" no projeto chamado `celular`; no `celular-estreito` ele rodava e falhava. Agora o critério é a largura da tela (≤ 700), pois o celular não tem Avançar por desenho.
2. **`accessibility.creator.ts` e `expansao-2014.creator.ts` (≥ 701):** o axe acusava `label-content-name-mismatch` (WCAG 2.5.3). Com a navegação do PR #130 as abas deixam de ser substituídas, então a lista **Personagens** continua aberta ao lado do criador nas larguras de desktop e passa a ser escaneada: os botões de personagem tinham `aria-label` ("Abrir ficha de …") que não continha o texto visível ("Nome · classe · nível…"). Correção no componente: o nome acessível passa a ser o texto visível e a dica da ação vai em `title`. Os seletores de testes que dependiam do nome antigo foram atualizados (`personagens.test.tsx`, `criadorGuiado.test.tsx`, `persistenciaServidor.test.tsx`, `regressoes-persistencia.test.tsx`, `flows.creator.ts`, `expansao-2014.creator.ts`); as asserções "não aparece" continuam equivalentes.
3. **Mesmos testes, larguras 701 e 768:** o botão de abas ocultas do FlexLayout (`aria-label` "Hidden tabs" com a quantidade visível) tinha o mesmo defeito, agora exposto porque abas deixam de ser substituídas. O botão não tem mais texto no DOM (símbolo e contagem vêm do CSS) e o nome acessível deixa de divergir.

Resultado local após as correções (Chrome instalado, sem vídeo):

| Verificação | Resultado |
|---|---|
| `tsc -b`, `tsc -p e2e` e `npm run build` | passaram |
| Vitest completo | 118 arquivos, 1473 testes: passaram |
| Playwright base (`npm run test:e2e`, 4 resoluções) | **60 passaram** |
| Playwright creator (`npm run test:creator`, 8 resoluções) | **96 passaram** |
| Playwright quality (`npm run test:quality`, 8 resoluções) | **88 passaram** |

Observação: as migrações 0005 e 0008 já estão aplicadas no banco hospedado (confirmado por consulta direta); o §0.2 acima, que as dava como ausentes por sondagem anônima, fica **superado**: a sondagem anônima recebeu 404 nas funções porque o schema cache da Data API não as expunha ao papel anônimo, não porque faltassem. Não reaplicar 0005 nem 0008; pendentes: 0009, 0010 e 0011.

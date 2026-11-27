# COMPÊNDIO 5e 2.0 — DECISÕES, ARQUITETURA E ESTADO

## Atualização de itens e loot — 22/11/2026

**Decisão posterior à DEC-20261122-D:** [Itens, variantes e loot](docs/ITENS-VARIANTES-LOOT.md). Mantém adição livre de equipamentos mundanos, mas **substitui a proibição de distribuição de loot**: mestre pode preparar recompensas de encontros, liberá-las para coleta pelos jogadores ou entregá-las diretamente. Itens mágicos (inclusive de raridade comum) são privados até revelação, variantes simples +1/+2/+3 são exclusivas do mestre, sem evolução automática. **Planejado, não implementado.**

## Decisões vigentes — 22/11/2026 (DEC-20261122-A a F)

**Aprovadas pelo responsável; planejamento, não declaração de implementação.** Esta seção substitui trechos históricos incompatíveis sobre ficha pessoal, catálogo sem campanha, cadastro aberto e distribuição de loot.

- **A — Campanhas e sistemas:** conta universal; sistema e edição definidos na criação da campanha, sem seletor global. D&D 5e 2014 primeiro; demais sistemas só após estabilização. Sem campanha, tela neutra (criar, entrar por código, conta), sem catálogo ou ficha. Uma campanha disponível abre automaticamente; várias restauram a última válida, com fallback determinístico. Preferência remota para novo dispositivo, sem forçar troca de telas abertas. Validar vínculo e isolamento; não confundir erro de rede com ausência de campanhas.
- **B — Fichas:** toda ficha pertence a uma campanha, independentemente de estar selecionada. Não criar biblioteca pessoal independente. Preservar dados históricos; arquivar em vez de excluir. Planejar duplicação na mesma campanha e cópia/transferência entre campanhas do mesmo sistema e edição, com autorização, sem transportar segredos ou vínculos narrativos; exportação e recuperação antes de exclusão irreversível. Nenhuma migração destrutiva.
- **C — Beta fechado:** login e recuperação para contas existentes; bloquear novos cadastros no servidor e na interface; sem visitante em produção. A configuração real do Auth precisa de verificação e autorização antes de alteração. Implementação do bloqueio no cliente e correção de corrida de sessão em revisão: [Alpha — acesso fechado](docs/ALPHA-ACESSO-FECHADO.md); servidor não alterado.
- **D — Inventário:** remover distribuição automatizada de loot pelo mestre (incluindo fluxo distribute_loot e tabelas propostas); mestre narra, jogador registra. Campo único de pesquisa/adicionar: selecionar resultado usa definição canônica; Enter sem seleção e sem correspondência exata cria item personalizado com nome digitado, imediatamente, sem formulário obrigatório; correspondência exata usa catálogo; botão equivalente no celular. Editar posteriormente descrição, quantidade, propriedades e usos/cargas opcionais; quantidade inicial 1. Agrupar somente itens efetivamente empilháveis, sem misturar cargas, propriedades ou instâncias equipadas. Personalizados ficam na ficha, não no catálogo global. Exemplo real da one-shot: seringa de adrenalina, 6 usos, descrição recupera 6 PV; após uso restam 5. Efeitos automáticos adiados. Mestre consulta conforme permissões. Testar teclado, celular, duplicatas, persistência, isolamento e limites de usos.
- **E — Assimilação:** aplicativo separado permanece funcional; preservar contas, mesas, fichas e histórico da one-shot; só correções críticas até integração futura. Não alterar seu banco nem migrar agora.
- **F — PWA:** etapa posterior ao núcleo funcional, antes da abertura pública. Auditar e reaproveitar base validada do Assimilação sem alterá-lo: instalação iOS/Android, standalone, áreas seguras, ícone/splash, sessão offline, cache/versionamento sem perda de dados, gestos e testes reais. Push posteriormente.

**Divisão de trabalho:** Codex: criador/ficha; Claude: catálogo; ChatGPT: campanhas/auth e integração. Branches separadas; validar CI e autorizar merge/deploy/migração. PR #82 integrado (f258172), validação e E2E verdes no HEAD do PR; publicação ainda não confirmada neste registro. Prioridade: campanha atual, onboarding, beta fechado, criador/catálogo, combate, integração, PWA. Alternativas descartadas: seletor global, ficha pessoal independente e distribuição de loot. Motivação: reduzir atrito observado em sessão real e evitar arquitetura acoplada a D&D. Testes das novas decisões ainda pendentes.


> Documento de referência para qualquer pessoa ou IA que trabalhe no projeto. Atualizar quando uma decisão mudar. Não confundir **decidido**, **planejado** e **implementado**: cada seção abaixo diz o que já existe no código. Roteiro, estado detalhado e pendências: `docs/PLANEJAMENTO-V2.md`. Última revisão: 20/11/2026.

> **Retomada e registro de decisões:** [`docs/CONTINUIDADE-DESENVOLVIMENTO.md`](docs/CONTINUIDADE-DESENVOLVIMENTO.md). Cada decisão nova ou substituída deve constar aqui com ID, situação, contexto, alternativas, impactos, implementação, testes e pendências; atualizar o índice no mesmo commit. Decisões antigas devem ser marcadas como substituídas, nunca apagadas silenciosamente.

> **Novo desenvolvimento em PR #74 (não integrado):** criador/ficha/inventário em piloto isolado, decisões de ferramentas e estado detalhados em `docs/CRIADOR-FICHA-INVENTARIO.md`; auditoria em `docs/AUDITORIA-CATALOGO-PERSONAGEM-2014.md`. Não confundir com funcionalidade publicada.

## 1. Objetivo e princípios

Construir o **Compêndio 5e**, ferramenta gratuita de apoio à mesa de D&D 5e **2014**, para mestre e jogadores. Priorizar rapidez durante a sessão, estabilidade, clareza, responsividade, manutenção simples e integração consistente entre módulos.

**Regras inegociáveis:**
1. **Não concordar automaticamente com novas ideias.** Avaliar utilidade na mesa, complexidade, custo, segurança e manutenção; recomendar excluir ou adiar o que atrapalhar.
2. **Não acumular funcionalidades.** Cada módulo resolve um problema concreto, sem menus, campos e fluxos redundantes.
3. **Código limpo e coeso.** Evitar milhares de arquivos e também arquivos monolíticos; separar por responsabilidade quando houver benefício real, sem abstrações prematuras.
4. **Uma fonte de verdade para cada dado.** PV, recursos, inventário etc. refletem em todas as telas relevantes, com sincronização e tratamento de conflitos.
5. **Componentes e regras compartilhados.** Não duplicar lógica de negócio. Separar apresentação, estado do workspace, regras de D&D, acesso a dados e permissões.
6. **Não construir novas funções sobre defeitos conhecidos.** Corrigir e testar a base antes de expandir.
7. **Testar interações entre módulos**, não só funções isoladas (concorrência, latência, erros, permissões).
8. **Não prometer zero bugs** nem dizer que algo foi validado sem execução verificável. Registrar limitações.
9. **Sem custo obrigatório** para usuários; evitar infraestrutura e serviços pagos.
10. **Projeto de fãs, sem afiliação oficial.** Usar material permitido do SRD 5.1 / regras de 2014 e respeitar direitos autorais; não presumir licença de conteúdos não-SRD.

## 2. Repositórios, integração e publicação
- **Repositório:** `Waudz/compendio-5e` (público). **Projeto anterior:** `Waudz/rastreador-dnd` e seu Supabase legado **nunca são alterados**.
- **Fluxo:** branch por tarefa → PR → CI (`npm ci`, `npm run build`, `npm test`) em todo PR e na `main` → **merge somente com autorização expressa do responsável**. Nada de banco, Supabase ou publicação sem autorização.
- **Publicação:** GitHub Pages (`https://waudz.github.io/compendio-5e/`) publica a `main` por GitHub Actions a cada merge, com o Supabase correto (`gwcttjlxzelzjhbuitmi`, chave pública). Distinguir sempre **revisão estática, build, teste executado, deploy concluído e teste manual**; PR integrado não equivale a aplicativo validado em produção.
- **Segredos:** nunca no código ou no preview: senhas, `service_role`, `sb_secret_`, tokens, dados de campanhas. Só URL e chave pública do cliente, protegidas por RLS (há teste que varre o repositório).

## 3. Stack
**Em uso:** React 18, TypeScript (estrito), Vite, `flexlayout-react` 0.11 (workspace), `@supabase/supabase-js` (PKCE), `lucide-react`, Vitest + Testing Library + jsdom, `@electric-sql/pglite` (testes de SQL/RLS em Postgres em memória), CSS próprio com variáveis (sem biblioteca de UI).
**Direção, ainda não adicionada** (somente quando o módulo exigir): Tailwind/Radix, TanStack Query, Zustand, React Router (links diretos, nunca no lugar das abas), React Hook Form + Zod, Playwright, PWA instalável.
Arquitetura desejada: componentes reutilizáveis; regras de domínio fora das telas; camada de acesso a dados; estado local efêmero separado do persistente; limites claros entre dados universais, pessoais e de campanha; sem importações circulares, listeners globais soltos nem estados duplicados.

## 4. Campanhas e isolamento
- Uma **campanha ativa** por vez; trocar de campanha é explícito; não há seletor em todas as telas. Restaura a última ativa se o usuário ainda participa.
- **Campanha = ambiente independente** (como contas de CNPJs diferentes num login único): dados, permissões, encontros, documentos, registros e histórico próprios, **isolados no banco por RLS**, não só na interface. O catálogo universal (regras, magias, itens, monstros SRD) não pertence a campanha.
- **Hoje:** o isolamento real existe para `campaigns`, `campaign_members`, `campaign_invites` e `notes`; o **layout** é isolado por usuário + campanha + dispositivo. Todo módulo novo precisa de tabelas com `campaign_id`, RLS e testes multi-conta (padrão em `PLANEJAMENTO-V2.md` §3 e §7).
- Caches, IndexedDB e buscas usam `cacheKey(usuário, campanha, …)` e são limpos no logout e na troca de campanha. A troca de campanha pede confirmação se há alterações não salvas.

## 5. Workspace, abas e navegação (implementado)
- **Menu lateral** recolhível (ícones e texto; só ícones recolhido): Campanhas, Personagens, Iniciativa, Encontros, Enciclopédia, Compêndio, Documentos e Conta; no celular vira barra inferior fixa que recolhe ao rolar.
- **Colunas:** apenas colunas lado a lado, **até 3**; **proibidos** grupos empilhados, janelas flutuantes e docking complexo. FlexLayout renderiza grupos, arraste, indicadores e divisórias; as regras do produto estão em código próprio: `classifyDrop`/`allowDrop` (única fonte para indicadores, menu e ação), `prepareMove` (interceptação de movimentos), `onAction` (só ações permitidas) e `isColumnsOnly` (valida e reverte). Dividir a tela arrastando a **única aba** funciona, com painel vazio intencional preservado ao salvar/restaurar.
- **Navegação por abas:** clique normal seleciona a aba do destino ou **reutiliza a aba atual não fixada**; abas fixadas e abas com alterações não salvas nunca são substituídas; botão direito (nesta aba / nova aba / nova aba fixada), Ctrl/Cmd+clique e botão do meio abrem em nova aba interna; fixar/desafixar é propriedade da aba; celular com toque prolongado e botões acessíveis; confirmação antes de fechar aba ou coluna, sair da conta, trocar de campanha ou recarregar com alterações. Detalhes, limitações e **verificações de interface ainda pendentes**: `docs/NAVEGACAO-ABAS.md`. A navegação **não** deve ser tida como totalmente concluída enquanto essas verificações estiverem pendentes.
- **Abas por registro** com id estável `tipo:ref` (`secao`, `conta`, `campanha`, `ficha`, `npc`, `documento`); o mesmo id é uma só aba. Hoje só `campanha` e as seções têm painel real.
- **Persistência:** `compendio5e:workspace:v2:<usuario>:<campanha>:<dispositivo>`, envelope `{version:2, layout}` só com **ids, geometria e `pinned`** (nunca títulos; nomes vêm da API), reconstruída por `sanitizeLayout` (ids válidos, sem repetidas, no máximo 3 grupos, painéis vazios só se intencionais). O app só monta com sessão; é remontado por usuário; sair ou trocar de conta apaga as chaves da conta. Restos do modo visitante e do layout v1 são apagados no início.
- **Identidade visual:** azul discreto (`--accent #3B82F6`) sobre azul-grafite (`--bg #141D27`, `--panel #202C39`), botões comuns neutros e destaque só nas ações principais; paleta em variáveis CSS no topo de `src/style.css`; sem gradientes nem efeitos neon.
- Nunca criar painel lateral direito fixo de referência; qualquer conteúdo pode ocupar qualquer coluna; evitar dezenas de abas ocultas executando efeitos caros.

## 6. Autenticação e banco (implementado)
**Autenticação:** login obrigatório e sem visitante (`AuthGate`; sem Supabase configurado o app não abre). `src/supabase.ts` cria o cliente a partir de `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` (`.env.example`), recusando valores de exemplo, `service_role`/`sb_secret_` e URL fora de `*.supabase.co`. Cadastro com confirmação de e-mail, recuperação e troca de senha, sessão persistente, logout; os e-mails redirecionam para `origin + BASE_URL` (mais `?convite=` quando houver), o que exige a configuração de URLs do projeto Supabase (`PLANEJAMENTO-V2.md` §9). Cadastro segue aberto (restringir a convidados fica para depois).

**Campanhas (`0001`, `0002`, `0003`; `src/campaigns.ts`, `CampaignPanels.tsx`):** `profiles`, `campaigns`, `campaign_members`, `campaign_invites`. Tudo privado (`anon` sem acesso); clientes não inserem direto: só as funções `create_campaign`, `create_invite`, `join_campaign` (`SECURITY DEFINER`, `search_path` vazio, validação no servidor). **Mestre único = o criador** (índice único parcial, gatilho `guard_single_master` e política que impedem segundo mestre, saída ou remoção do criador; não há promoção); jogadores saem sozinhos, o mestre remove jogadores, administra convites e exclui a campanha; até 20 campanhas por usuário; mestre numa e jogador noutra. Convites: código de 12 caracteres, papel sempre jogador, 1–50 usos, 1–30 dias, um único erro genérico para qualquer falha; entrada automática pelo link. Colunas graváveis restritas por `GRANT`. A interface esconde o que não cabe ao papel, mas **a autorização é do banco**.

**Notas (`0004`, `docs/NOTAS-PERMISSOES.md`):** visibilidade `private | master | campaign | selected` por RLS, participação atual de leitor e autor, mestre sem acesso às notas privadas de jogadores, dono e campanha imutáveis, versão otimista, limites, reversão em `supabase/rollback/`. **Só o banco existe**: o modelo de vínculos e audiências (D3) exige uma migração futura (**`0009`**, antiga "0005"). A `0005` é agora a proposta de conteúdo estruturado das notas (PR #32; não aplicada); numeração em `supabase/migrations/LEIA-ME.md`.

**Aplicação:** migrações `0001`–`0004` **já aplicadas** ao projeto `gwcttjlxzelzjhbuitmi`; não reaplicar. Testes de RLS rodam em Postgres em memória (PGlite): validam as políticas, mas não substituem teste no projeto hospedado.

## 7. Celular e PWA
- Um único projeto e base de dados. Desktop com workspace de colunas; **celular (≤ 700 px) com interface específica**: painel ativo, abas com opções, "Nova aba", barra inferior; sem arraste de colunas.
- Jogadores precisam de ficha, magias, itens, regras e enciclopédia com poucos toques; não transportar a interface complexa do mestre.
- **A navegação móvel definitiva ainda precisa ser validada em celular real.** PWA instalável (ícone, manifesto, splash, offline adequado) **não existe**; sem prometer offline completo antes de implementar.

## 8. Módulos e fronteiras
Estado real: Personagens, Iniciativa, Encontros, Enciclopédia, Compêndio e Documentos são **telas demonstrativas**; o que está decidido é o abaixo (detalhes em `PLANEJAMENTO-V2.md`).
- **Personagens:** pertencem ao **usuário**; criação e administração pessoais valem sem campanha; participam de campanhas por vínculos com estado próprio (progressão, inventário e carteira independentes; carteira zerada ao vincular). O mestre edita o estado da participação **na sua campanha**, nunca a identidade nem o personagem pessoal. Exclusão **lógica** (lixeira sem prazo automático); saída ou remoção de jogador **arquiva** a participação, e restaurar não sobrescreve o estado preservado. Outros jogadores veem nome, retrato e nível; o mestre decide se veem PV. Moedas: as cinco oficiais 5e 2014, ativas por campanha (padrão PC, PP, PO); desativar nunca apaga nem converte sem confirmação.
- **Documentos e anotações:** sistema **único** sobre `notes`; anotações do usuário, privadas por padrão, com vínculos opcionais e múltiplos (personagens, campanhas, NPCs, locais, encontros…) que **não transferem propriedade nem compartilham**; compartilhar é ação explícita; morte, troca ou exclusão de personagem nunca apaga anotações; o mestre não vê as privadas. A aba Documentos concentra notas, páginas, quadros, bancos/Kanban, calendários, anexos e backup, com filtros; sem campanha ativa só as pessoais.
- **Encontros:** da campanha ativa; participantes, NPCs, cenário, dificuldade, notas, loot planejado e resultado; podem não ter combate. **Iniciativa** inicia combate a partir de um encontro; o mestre confirma o loot e o atribui com registro; nada é distribuído por morte de monstro.
- **Iniciativa:** ferramenta de combate do mestre, ligada a personagens e monstros reais; PV e recursos refletem em todas as visões; sem automatizar todo o combate nem virar VTT. O código legado não é copiado automaticamente.
- **Compêndio:** uma seção para consulta (Magias, Monstros, Itens, Regras) com busca rápida; catálogo SRD 2014 somente leitura para qualquer conta autenticada. **Visibilidade do Bestiário para jogadores: NÃO DECIDIDA (D7)** — ficha completa × só imagem, nome e descrição × configuração por campanha, a conversar com o grupo; nenhuma restrição implementada; ver impacto em `PLANEJAMENTO-V2.md` §1.
- **Enciclopédia da campanha:** wiki de NPCs, cidades, locais, facções e eventos com links; o mestre edita, mantém notas secretas e publica só o que os jogadores podem ver; sempre sob RLS.

## 9. Perfis
- **Mestre:** administra a campanha (única, a que criou), participantes, convites, encontros, iniciativa, enciclopédia, publicação e permissões. **Jogador:** acessa suas fichas e o conteúdo compartilhado, sem notas secretas, encontros privados ou dados administrativos. **Visitante:** **não existe**; o cadastro é aberto. Esconder botão não é proteção.

## 10. O que NÃO desenvolver agora
Sem reavaliação explícita: lojas, compras/vendas, comércio, economia complexa e câmbio personalizado (**exceção aprovada:** saldo das cinco moedas oficiais no inventário e distribuição de loot confirmada pelo mestre, sem lojas); combate totalmente automatizado; mapa tático/VTT; chat interno; notificações complexas; offline completo; dashboards, configurações e modais sem utilidade clara; seletor de campanha repetido em cada página. Ideias do repositório antigo não são requisitos aprovados.

## 11. Qualidade e segurança
- Verificar build, TypeScript (`tsc -b`), testes e fluxos entre módulos em cada entrega; testar permissões, concorrência, falhas de rede, cache e troca de sessão/campanha.
- Autorização sempre no servidor (RLS, funções); migrações versionadas, revisadas, reversíveis quando possível e **só aplicadas com autorização**; nada destrutivo sem plano.
- Usar `localStorage` apenas para layout e preferências locais validados e versionados, nunca para dados de jogo ou sensíveis.
- Preferir atualização otimista com rollback e conflito explícito (`version`); nunca sobrescrever em silêncio.

## 12. Estado e histórico de entregas
Integrados: base React e workspace (PRs #1–#4); FlexLayout (#8); abas compactas, testes de interface e `npm ci` (#9); tema e menu recolhido (#10); autenticação, SQL e interface de campanhas (#11–#15); mestre único (#16); contratos de registros e de notas (#17, #18); banco de notas e revisão de segurança (#19); planejamento v2 (#20); **Etapa 1, login obrigatório (#21)**; **divisão com aba única (#22)**; **navegação e abas fixadas (#23)**; planejamento de navegação (#24). Estado detalhado e roteiro por prioridade: `docs/PLANEJAMENTO-V2.md` §2 e §8.

## 13. Pendências abertas (resumo; detalhes em `PLANEJAMENTO-V2.md` §9)
- **Ciclo de correções de interface, antes de novas funcionalidades de RPG** (`docs/NAVEGACAO-ABAS.md` §6): (1) padronizar o menu de contexto e os gestos nos botões que abrem registros em abas; (2) verificar se fixar/desafixar na aba já aberta é acessível na versão publicada.
- **D7** (visibilidade do Bestiário), **exclusão de conta** vs histórico de campanha, validação de autenticação com contas reais, validação móvel em aparelho real.
- Estratégia de sincronização e de migração segura do legado; funções legadas a reaproveitar ou descartar.

## 14. Como continuar em novas conversas
1. **Ler este arquivo e `docs/PLANEJAMENTO-V2.md` antes de propor arquitetura ou implementar.**
2. Conferir código, PRs, Actions e status real; não inferir implementação só dos documentos.
3. Identificar o que está **aprovado**, **planejado**, **pendente de decisão** e **pendente de verificação**.
4. Entregas pequenas e revisáveis; pedir decisão do responsável quando a escolha for de produto, segurança ou dados.
5. Atualizar a documentação no mesmo PR quando uma decisão ou o estado mudar, **consolidando** (sem apenas acrescentar ao fim).
6. Comunicar curto, direto e objetivo; **não gerar imagens de mockup** (usar descrição curta, esquema textual ou protótipo funcional).

**Regra de ouro:** quando houver conflito entre este documento e uma decisão explícita mais recente do responsável, prevalece a decisão mais recente; atualizar o documento.

## Decisão adicional (20/11/2026) — catálogo extensível e ficha universal

**Aprovado:** o modelo de regras deve permitir futuramente raças, sub-raças, classes, subclasses, talentos e origens **homebrew** e de **suplementos licenciados**, sem reconstruir criador ou ficha. Cada opção terá fonte, edição, revisão e ID estável; conteúdo de terceiros só entra mediante direitos adequados. Contrato experimental em `src/rules/content-registry.ts`, detalhado em `docs/CRIADOR-FICHA-INVENTARIO.md`. Editor, importação, compartilhamento e persistência **ainda não implementados**.

**Ficha universal:** toda aparição do personagem aponta para **uma identidade por `characterId`**; nenhuma tela mantém cópia independente do personagem. O estado jogável é identificado também por **escopo**: pessoal ou participação específica na campanha. **Não confundir identidade única com estado global único:** a decisão anterior deste documento (§8) preserva progressão, inventário e carteira independentes por campanha. Dentro de cada contexto, ficha, iniciativa, encontro e campanha devem refletir os mesmos PV, recursos e demais alterações, respeitando RLS e controle de versões. O mestre não modifica a ficha pessoal de outro usuário.

**Implementação atual:** somente contratos e testes de domínio, sem integração com UI/Supabase; não declarar sincronização universal concluída.

## Revisão da decisão (20/11/2026) — uma campanha ativa por personagem

**Decisão mais recente do responsável, prevalece sobre o §8 e a seção de ficha universal acima:** um personagem pode estar vinculado a **no máximo uma campanha ativa por vez**. O objetivo é evitar duplicação desnecessária de fichas, progressões e inventários. O personagem mantém uma identidade estável e uma ficha canônica, utilizada por Personagens, Campanha, Encontros e Iniciativa. Vincular não cria cópia da ficha. Um personagem sem campanha continua utilizável.

**Histórico e saída:** participações encerradas podem preservar registros históricos/instantâneos da campanha, sem constituir uma segunda ficha ativa. Excluir ou remover vínculo não exclui o personagem pessoal. Eventual transferência entre campanhas deverá ser explícita, com política de continuidade de inventário, progressão e recursos definida antes da implementação. Não presumir que o mestre pode editar a identidade pessoal do jogador; permissões permanecem sob revisão.

**Implicação para banco:** projetar restrição transacional de unicidade para `character_id` entre participações com estado ativo, além de autorização/RLS e prevenção de corrida entre convites. Histórico arquivado não conta como participação ativa. **Não foi criada/aplicada migração.** A arquitetura antiga de estados jogáveis simultâneos por campanha está superada por esta decisão; atualizar os contratos experimentais de ponteiros antes de integrá-los.

## Decisão posterior — substituição de personagem após morte (20/11/2026)

**Aprovado em princípio:** um jogador pode criar outro personagem e vinculá-lo à campanha na qual seu personagem anterior morreu. A regra anterior **continua válida por personagem**: cada personagem participa de no máximo uma campanha ativa por vez; isso **não** significa limitar o jogador a um único personagem histórico por campanha. Morte não exclui personagem, ficha, inventário ou histórico; a ficha permanece acessível e identificada como **Morto** tanto em Meus Personagens quanto no histórico da campanha. Na visão operacional da campanha, personagens mortos não aparecem na lista principal de ativos, mas são consultáveis em uma seção/filtro de históricos. Anotações e vínculos não são apagados. Novo personagem tem ID, ficha e inventário próprios, sem herança automática. Ressurreição deve reativar a mesma identidade, não criar cópia.

**Regra operacional sugerida, ainda sujeita à confirmação do responsável:** um personagem *em atividade* por jogador em cada campanha; permitir múltiplos históricos mortos/aposentados. Não confundir `morto`, `arquivado`, `retirado` e `excluído logicamente`. A morte é condição narrativa reversível; arquivamento é estado de participação; exclusão lógica é ação administrativa. Se houver ressurreição enquanto substituto está ativo, exigir escolha explícita sobre qual personagem fica ativo, sem apagar nenhum. Combates históricos devem conservar seus participantes e eventos, mas não ressuscitar nem sobrescrever fichas.

**Estado técnico:** decisão de produto/documentação, não implementada; requer estados separados de personagem e participação, regras de autorização, índices de banco e testes de morte/ressurreição/troca. Nenhuma migração aplicada.

## Decisão posterior — exclusão pessoal não apaga personagem da campanha (20/11/2026)

**Aprovado pelo responsável:** quando o jogador exclui um personagem da própria conta/biblioteca, o personagem deve desaparecer de **Meus Personagens**, mas **permanecer no histórico da campanha** até que o mestre decida removê-lo. Isso vale para personagens mortos, para saída do jogador e para casos em que o jogador não queira mais vê-los. O mestre preserva acesso à ficha histórica (identidade, nível, inventário, estado e eventos relevantes) sem adquirir acesso às notas privadas ou à conta do jogador. A exclusão pessoal não quebra referências de encontros, iniciativa histórica, notas compartilhadas e registros de campanha.

**Modelo recomendado:** distinguir (a) identidade e ficha canônica durante uso ativo; (b) visibilidade/propriedade na biblioteca pessoal; (c) participação e registro histórico da campanha; (d) autorização do mestre para manter/arquivar/remover da campanha. Na exclusão pessoal, manter um **snapshot histórico imutável da ficha no contexto da campanha** ou uma projeção preservada com referências estáveis, sem criar segundo personagem ativo. A cópia histórica não deve continuar sincronizando atributos/recursos do jogador. Usar exclusão lógica/tombstone e política de retenção explícita. Não confundir a remoção do histórico pelo mestre com exclusão de dados exigida por lei; obrigações de privacidade e exclusão definitiva devem ser tratadas separadamente, inclusive quando houver pedido de eliminação de dados pessoais.

**Pendente de desenho técnico:** definir quais campos da ficha ficam na campanha, o que acontece com fotos/anexos e direitos de conteúdo, histórico de combate, retenção, permissões e reativação. Operações de exclusão/arquivamento devem ser transacionais, auditáveis, sujeitas a RLS e evitar perda acidental de registros. A regra de no máximo uma campanha ativa por personagem permanece; histórico preservado não é participação ativa. **Nenhuma migração, banco ou produção alterados nesta rodada.**

## Decisão posterior — personagem órfão, histórico de controladores e conversão para NPC

**Aprovado pelo responsável:** se o jogador excluir da biblioteca pessoal um personagem vinculado a uma campanha, o personagem **permanece na campanha**, mas **deixa de estar vinculado ao jogador** como proprietário/controlador atual. O registro preserva histórico de quem já foi seu proprietário/controlador, com datas e eventos de transferência, sem expor dados privados. O mestre pode **atribuir o personagem a outro jogador da campanha** ou **convertê-lo em NPC**, sem recriar a identidade, perder ficha, inventário, estado narrativo ou histórico. Personagem morto continua morto até evento explícito de ressurreição; mudança de controle não altera automaticamente estado de vida.

**Modelo de domínio desejado:** separar `characterId` (identidade estável), `campaignId` (única campanha ativa por personagem), `controllerType` (`player | gm | unassigned`), `controllerUserId` opcional, `characterRole` (`pc | npc`), `lifeStatus` e `participationStatus`, além de eventos append-only de titularidade/controle. Um NPC continua sendo personagem de campanha e não é cópia independente de monstro do bestiário. Atribuição a outro jogador deve exigir aceite do destinatário (recomendação de segurança/produto, pendente de confirmação). Histórico de antigo controlador não equivale a acesso atual; permissões e RLS devem verificar vínculo vigente.

**Cuidados:** exclusão da biblioteca pessoal não apaga dados de campanha nem notas compartilhadas; notas privadas do antigo jogador continuam privadas. A ficha de campanha passa a ser mantida pelo mestre/escopo de campanha após desvinculação. Não transferir automaticamente conta, propriedade intelectual, arquivos privados ou permissões do usuário anterior. Registrar ações auditáveis e concorrência, impedir duas transferências simultâneas e oferecer confirmação para conversão a NPC. Políticas de privacidade e pedidos legais de eliminação de dados continuam exigindo tratamento específico. **Não implementado no banco/UI; nenhuma migração ou publicação autorizada.**

## Decisão posterior — personagens na Enciclopédia da campanha

**Direção aprovada pelo responsável:** usar a **Enciclopédia da campanha**, com uma seção **Personagens**, para dar destino narrativo e administrativo aos personagens vinculados, inclusive personagens mortos, antigos personagens de jogadores, personagens sem controlador e NPCs. A Enciclopédia deve servir como registro histórico duradouro da campanha, independentemente de o antigo jogador manter a ficha na biblioteca pessoal.

**Fronteira importante:** a entrada enciclopédica é uma **projeção/página narrativa vinculada ao `characterId`**, não uma segunda ficha jogável nem uma duplicação de inventário, PV ou progressão. Biografia, acontecimentos, relacionamentos, controladores anteriores e visibilidade editorial podem existir na página; regras e estado do personagem continuam na ficha canônica ou no snapshot histórico de campanha quando o vínculo pessoal foi encerrado. O mestre pode administrar personagens órfãos e converter em NPC/atribuir novo controlador sem perder identidade. Morte, papel PC/NPC, controle e publicação na Enciclopédia são dimensões independentes.

**Visibilidade:** página pública aos jogadores apenas se publicada pelo mestre; notas secretas e informações de bastidores permanecem restritas, e notas privadas do antigo jogador nunca passam a ser visíveis por transferência. Preservar vínculos por IDs e histórico de alterações. A seção deve coexistir com NPCs criados diretamente pelo mestre e não exigir ficha completa de jogador para cada NPC secundário; NPCs simples podem usar registro narrativo e, se necessário, ganhar ficha depois.

**Estado:** decisão de arquitetura/documentação; ainda não há seção de personagens implementada na UI nem migração no banco. Detalhes de layout, permissões e fluxo de transferência serão refinados antes de implementar.

## Decisão aprovada — Compêndio como catálogo canônico de regras (20/11/2026)

**Aprovado explicitamente pelo responsável:** o Compêndio será a **fonte única de definições de conteúdo e regras estruturadas** para criação, progressão, ficha e inventário, em D&D 5e 2014. Não manter cópias independentes de raça, sub-raça, classe, subclasse, antecedente, talento, magia ou item em cada tela. A interface do Compêndio e o criador devem consultar o mesmo catálogo versionado e as mesmas referências estáveis; um motor de regras separado interpreta as definições e calcula a ficha.

**Separação de responsabilidades:**
- Catálogo: identificador estável, fonte/licença, versão, texto de apresentação, opções, pré-requisitos, progressão e efeitos estruturados.
- Motor: validação de escolhas, pré-requisitos e compatibilidade, cálculos e exceções de regras; não duplica a base de dados do Compêndio.
- Personagem: IDs/revisões das escolhas, valores próprios (atributos base, PV atuais, recursos gastos, inventário e anotações privadas); não duplica definições de classe/raça.
- Enciclopédia da campanha > Personagens: projeção narrativa de personagens, **distinta** do catálogo de regras e da ficha canônica.
- Conteúdo adicional: suplementos licenciados e homebrew com proveniência e versão; não misturar regras de 2014 e 2024.

**Integridade:** não alterar silenciosamente personagens quando um registro de regra for corrigido. Usar revisão fixada por personagem e migração explícita/validada. Conteúdo incompleto não pode produzir ficha aparentemente completa: apresentar escolhas pendentes e impedir finalização inválida. Testar concordância entre Compêndio, criador e ficha, níveis 1–20, reabertura, edição e progressão. Não copiar automaticamente textos protegidos de fontes externas.

**Status:** decisão registrada; há protótipos de catálogo, motor e ASI no PR #74, mas **a integração real de telas e banco ainda não foi concluída**. Não autoriza merge, deploy ou migração em produção.

## Decisão aprovada — IDs estáveis para todas as entidades (20/11/2026)

**Aprovado pelo responsável:** nenhuma ligação, regra, inventário, progressão, referência ou autorização deve depender de nomes exibidos, traduções ou títulos editáveis. Toda entidade persistida recebe identidade estável: raças/sub-raças, classes/subclasses, antecedentes, talentos, magias, itens, características, efeitos, recursos, personagens, campanhas, notas, páginas da Enciclopédia e instâncias individuais de itens. Nomes são metadados editáveis/localizáveis, não chaves de relacionamento.

**Identidade de conteúdo:** `sourceId + kind + id` identifica a entidade lógica no catálogo, e `revision` fixa uma definição imutável específica; `contentKey` representa a referência versionada. IDs devem ser únicos no escopo correspondente, nunca reciclados e nunca alterados em uma renomeação. Conteúdos criados pelo usuário devem receber IDs opacos gerados na criação (UUID/ULID, conforme a persistência adotada), não IDs derivados de nomes; slugs são somente URLs/apresentação e podem mudar. Uma instância de item no inventário tem `instanceId` próprio e referência à definição `itemRef`, permitindo múltiplas cópias, estados e personalizações sem clonar a regra.

**Integridade:** usar chaves estrangeiras/índices únicos no banco e resolver relações por IDs; preservar aliases/redirecionamentos quando slugs de URLs mudarem; proibir exclusão/reutilização de IDs referenciados sem política explícita; validar referências inexistentes, duplicações e mudanças de revisão. A API/UI não deve interpretar texto como identificador. Testar renomeações de cada tipo de conteúdo sem alterar relações existentes.

**Implementação parcial no PR #74:** `ContentKind` agora inclui magias, itens, características, traços, efeitos e recursos; testes verificam estabilidade das referências sob renomeação. Ainda não foram implementados os IDs persistentes, constraints, aliases e instâncias de inventário na UI/banco. Sem merge/deploy/migração autorizados.


## Decisão DEC-014 — continuidade documental obrigatória (20/11/2026)

- **Situação:** aprovada como processo de desenvolvimento; documentação atualizada na branch do PR #74.
- **Contexto:** conversas longas podem ser perdidas, enquanto arquivos históricos incluem decisões substituídas e protótipos não publicados.
- **Decisão:** usar `docs/CONTINUIDADE-DESENVOLVIMENTO.md` como entrada e índice, mantendo este documento como registro normativo de decisões e os guias especializados como detalhes. Registrar cada nova decisão relevante com ID, motivação, alternativas, consequências, implementação, verificação e pendências no mesmo conjunto de commits do trabalho. Atualizar README e status correspondente.
- **Alternativas:** concentrar todos os detalhes em um arquivo único foi descartado por duplicação e manutenção difícil; depender do chat foi descartado por fragilidade de continuidade.
- **Consequências:** exige disciplina de documentação; evita perder contexto e declarar funcionalidades incompletas como prontas. Não altera regras, dados, permissões ou produção.
- **Implementação:** guia central e links no README/documentos; PR #74.
- **Verificação:** conferência dos arquivos enviados ao GitHub; não se aplica teste de lógica. CI do HEAD deve ser consultado.
- **Pendências:** manter o registro vivo, reconciliar decisões históricas conforme cada módulo for desenvolvido e conferir periodicamente links e status.

## Decisão posterior validada com jogadores — 20/11/2026

**Iniciativa é exclusiva do mestre.** Nenhum jogador pode ver a ordem de iniciativa, turnos, rodadas, resultados ou metadados de participantes, nem mesmo do próprio personagem. Ocultar apenas a aba não basta: leituras e operações de iniciativa devem ser autorizadas no servidor, por campanha e papel de mestre, inclusive RPC, consultas e canais Realtime. O jogador mantém acesso aos dados permitidos de sua ficha (como PV, condições e recursos), sem receber dados do rastreador de iniciativa. Esta decisão prevalece sobre qualquer planejamento antigo que exponha iniciativa aos jogadores.

Navegação confirmada: mestre — Início, Anotações, Iniciativa, Compêndio, Menu; jogador — Início, Anotações, Ficha, Compêndio, Menu. Inventário dentro de Ficha. **Estado:** decisão aprovada e contrato de domínio em PR #74; ainda pendente de integração com interface e RLS. Não aplicar migração sem aprovação.

### DEC-015 — Catálogo canônico de itens SRD 2014 (2026-11-20)
- **Situação:** implementada parcialmente (itens; demais categorias pendentes).
- **Problema e contexto:** o piloto usava itens provisórios com IDs "candidatos" (três estavam errados: `rations`, `hempen-rope-50-feet`, `light-crossbow`) e nomes em formato de slug, sem dados mecânicos.
- **Decisão:** um arquivo de dados versionado (`src/catalogue/data/srd-2014-items.json`, 578 itens: 237 mundanos e 341 mágicos, nomes pt-BR e originais) é validado com **Zod** (`src/catalogue/item-schema.ts`) e exposto como `RulesCatalogue` (`src/catalogue/srd-2014-items.ts`), a mesma fonte para Compêndio, criador, ficha e inventário. IDs estáveis sem prefixo de fonte; aliases legados (`potion-of-healing`) resolvem para o ID canônico; revisão `1`. Peso em kg = libras × 0,5 e alcance em m = pés × 0,3 (convenção do projeto legado). Descrição é um resumo em pt-BR **derivado dos campos estruturados**; o texto integral do SRD não foi importado.
- **Origem e licença:** dados do Compêndio 1.0 (`dados/itens-srd2014.json`), baseados no SRD 5.1 (CC BY 4.0, Wizards of the Coast LLC) e no HeroQuill (MIT); atribuição gravada no próprio arquivo e exibível na interface. Regenerar com `scripts/build-srd-item-catalogue.mjs <arquivo-legado>`.
- **Validação:** os 237 itens mundanos foram conferidos contra a D&D 5e SRD API com `scripts/verificar-itens-api.mjs` (nome, custo, peso, dano, CA, propriedades): 0 divergências não explicadas; 1 conhecida (`caltrops`: livro SRD = 1 po, API = 5 pc; o catálogo segue o livro). Os 341 itens mágicos **não** foram conferidos contra a API (só pelo esquema).
- **Alternativas rejeitadas:** importar direto da API em tempo de execução (rede, sem curadoria, sem nomes pt-BR); manter itens provisórios por classe.
- **Implementação:** PR #74; busca do Compêndio passou a indexar o nome original (`en`).
- **Verificação:** tsc, build e 718 testes locais; conferir o CI do HEAD.
- **Pendências:** descrições integrais, itens mágicos auditados, demais categorias (classes, subclasses, raças, antecedentes, magias, criaturas) e virtualização da lista (578 itens renderizados de uma vez no piloto).

### DEC-016 — Criador guiado e Compêndio na navegação real (2026-11-21)
- **Situação:** implementada parcialmente (Guerreiro; armazenamento experimental).
- **Problema e contexto:** o criador e o Compêndio só existiam em `?demo=` (dev); o Compêndio real era placeholder.
- **Decisão:** novos tipos de aba `criador:<id>` e `item:<id>` (`src/workspace.ts`), seção Compêndio real (`src/Compendio.tsx`), criador em `src/criador/`, acesso por Personagens. O catálogo do criador e o editor de identidade pública saíram de `src/dev/` para `src/criador/`. Persistência por interface `ArmazenamentoCriador` com adaptador **local experimental** (por usuário e campanha, apagado no logout), sem Supabase.
- **Alternativas rejeitadas:** gravar o rascunho em `notes.meta` (vazaria a ficha privada para a campanha); criar tabela/migração sem autorização; manter só o piloto dev.
- **Consequências:** personagens guiados não são os registros `character` da campanha (coexistem até a persistência real); a lista de Personagens mostra as duas origens em seções separadas. Sem alteração de banco, RLS ou produção.
- **Verificação:** tsc, build e 742 testes locais (caminho do usuário em desktop e celular, Compêndio, armazenamento); CI do HEAD a conferir.
- **Pendências:** persistência autenticada (proposta em `docs/CRIADOR-FICHA-INVENTARIO.md`), demais classes/raças/antecedentes, publicação da identidade na Enciclopédia (PR #75), Playwright (PR #76).

### DEC-017 — Persistência das fichas do criador guiado no Supabase (2026-11-21)
- **Situação:** implementada no código e validada em PostgreSQL isolado; **migração 0008 proposta, NÃO aplicada**.
- **Problema e contexto:** o criador usava `localStorage` (sem segurança entre usuários); a tabela `character_sheets` foi criada fechada (0007) mas sem políticas definitivas, revisão controlada, imutabilidade nem integração.
- **Decisão:** ficha privada em `character_sheets`; identidade pública na linha `notes` (kind `character`, `meta.guiado`), com `meta` restrito a `identidadePublica` por CHECK; gravação por duas funções SECURITY INVOKER atômicas; revisão otimista (`conflito_de_revisao`); dono lê/edita enquanto participa, mestre lê/edita a ficha (não a identidade nem notas privadas); sem DELETE; interface com repositório `servidor`/`local-experimental`, cópia de recuperação, envio explícito dos rascunhos locais.
- **Alternativas rejeitadas:** ficha em `notes.meta` (vazaria); funções SECURITY DEFINER no schema exposto (contornam a RLS; os advisors já alertam); DELETE direto ou transferência por UPDATE de `owner_id` (contornam a auditoria narrativa); apagar o rascunho local ao enviar sem confirmação do servidor.
- **Consequências:** sem a 0008 aplicada o app mostra a mensagem de atualização pendente; ex-participantes perdem o acesso (ficha preservada, mestre mantém); personagem do servidor não pode ser excluído pela UI; a identidade publicada vira o título da nota (visível à campanha).
- **Implementação:** `supabase/migrations/0007_*`, `0008_*`, rollbacks, `src/fichas.ts`, `src/fichasMemoria.ts`, `src/criador/{repositorio,recuperacao,CriadorGuiado}.tsx`, `src/Personagens.tsx`.
- **Revisão do PR #80 (21/11):** invariantes presas à existência da ficha (gatilho em `notes`), INSERT/UPDATE com nota ativa, meta estrito e título derivado pelo servidor, 0007 corrigida; duas funções SECURITY DEFINER booleanas em schema `private` (ver `CRIADOR-FICHA-INVENTARIO.md`).
- **Verificação:** `supabase/character-sheets.test.ts` (48, incluindo compatibilidade com a 0007, notas legadas e testes negativos de RLS/ownership), `src/fichas.test.ts`, `src/criador/persistenciaServidor.test.tsx`, `recuperacao.test.ts`; tsc, build e 800 testes locais. Não validado no Supabase hospedado.
- **Pendências:** aplicar a 0008 (autorização), testar contra o remoto, exclusão/transferência narrativas (PR #75), migração das fichas simples, Realtime (fora de escopo).

### DEC-018 — Catálogo de D&D 5e (2014) multi-categoria e preparado para outros sistemas (2026-11-22)
- **Situação:** implementada (itens, magias, monstros). Sem seletor de sistema: o sistema vem da campanha selecionada (PR #83).
- **Contexto:** o Compêndio só tinha itens; magias e monstros existiam no Compêndio 1.0 (319 e 325 fichas, em português, com defeitos de dados).
- **Decisão:** núcleo genérico (`src/catalogue/nucleo`: categorias, filtros, índice de pesquisa, registro de sistemas) + sistema `dnd5e-2014` (dados validados por Zod, rótulos e formatadores pt-BR) + interface genérica `src/compendio/`. Dados de magias e monstros são pedaços separados (`import()`), com esqueleto e erro com nova tentativa. Dado estruturado vem da SRD API conferida; texto pt-BR do Compêndio 1.0; o tradutor do 1.0 é executado em build (não reescrito). Defeitos do legado corrigidos com decisões registradas nos construtores (duplicatas, ND, CA, deslocamento, XP, idiomas, defesas).
- **Alternativas rejeitadas:** copiar o app 1.0 (JS puro, tradução em tempo de execução); importar as ilustrações do Open5e (licença não confirmada); novos tipos de aba para magias/monstros (alteraria a navegação global, em desenvolvimento paralelo); virtualização de lista (desnecessária para ~1.200 entradas).
- **Consequências:** clicar numa entrada abre o detalhe no próprio painel (itens ganham "Abrir em nova aba"); o `aria-label` dos cartões foi removido (WCAG 2.5.3); o criador consome o catálogo só por `src/catalogue/contratos.ts`.
- **Atualização (PR #84, 22/11/2026):** o legado tinha textos de monstro com mecânica errada (modelos de outra criatura) e defeitos de dados; a auditoria numérica/de termos (`auditar-traducoes.mjs`) e a comparação de campos mecânicos com a SRD API e o PDF do SRD (`comparar-mecanica-api.mjs`) corrigiram 57 textos e 10 fichas. Traduções são de IA sem revisão humana (aviso na ficha). Burro = `origem: 'legado'` (não SRD). Ids antigos continuam resolvendo (`idsAnteriores`, `resolverIdMonstro`). Fichas compostas ganharam `formas`. 5 listas de classes de magias confirmadas no PDF.
- **Verificação:** testes de núcleo, dados (Zod, hash, fatos do SRD), categorias, contratos e interface; conferência com a SRD API por `scripts/catalogo/verificar-catalogo-api.mjs` (0 divergências não explicadas). Ver `docs/CATALOGO-DND-2014.md`.
- **Pendências:** (5 listas de classes de magias já confirmadas no PDF do SRD); rolagens de dados das ações; tradução dos monstros concluída (100%, revisão humana pendente) e links monstro→magia implementados (seção 7 do doc do catálogo).

### DEC-019 — Regras de personagens 2014 versionadas e isoladas (22/11/2026)
- **Situação:** implementada parcialmente, em revisão na branch feat/character-2014.
- **Contexto:** criador da main #82 fixa opções de demonstração; preservar fichas existentes e não interferir no catálogo geral.
- **Decisão:** snapshot SRD 5.1 próprio do módulo de personagens, IDs/versão novos, ativação explícita; motor existente e persistência/RPCs reaproveitados. Alternativa rejeitada: substituir silenciosamente o catálogo das fichas antigas ou copiar o aplicativo legado inteiro.
- **Impacto:** sem migração de dados ou schema, sem publicações globais. Dados carregados sob demanda. Fonte/licenças, cobertura e pendências em docs/CRIADOR-2014-EXPANSAO.md.
- **Verificação:** testes unitários e E2E dedicados; aprovação final vinculada ao SHA/CI do PR, não presumida por este documento.


## Decisão — ciclo de vida do combate (23/11/2026)

**Aprovado pelo usuário:** na versão atual, **somente um combate ativo por campanha** deve permanecer até o mestre clicar explicitamente em **Finalizar combate**. **Futuramente, permitir um segundo combate ativo**, mas isso está fora do escopo da Alpha/Beta inicial e não deve ser habilitado agora. Navegar para outra tela, recarregar (F5), fechar o navegador, abrir outra aba, sair da conta ou abrir a mesma campanha em outro dispositivo **não** finaliza nem reinicia o combate. Somente o mestre pode consultar ou alterar o combate; autorizações precisam ser verificadas no servidor, não apenas no menu.

- Combates **novos** serão criados no Supabase com salvamento automático de cada alteração (PV, iniciativa, turnos, rodadas e participantes), com tratamento de concorrência entre abas/dispositivos e indicação clara de sincronização pendente/erro. Não anunciar como salvo antes da confirmação do servidor.
- Combates **antigos locais** permanecem preservados como backup, sem importação automática e sem exclusão silenciosa. Não confundir o backup local com o combate remoto ativo.
- **Finalizar combate** requer confirmação explícita; somente depois da confirmação de persistência no servidor ele deixa de ser o combate ativo. Falhas de rede, rejeição de permissão ou conflito não podem encerrar a sessão localmente por engano.
- **Ao finalizar, o combate é descartado**, sem histórico de combates finalizados. Exigir confirmação antes do descarte; se a gravação falhar, manter o combate ativo. A finalização não pode excluir nem modificar encontros salvos.
- **Encontros preparados/salvos permanecem guardados** para reutilização em combates futuros, mesmo depois de finalizar um combate. A exclusão de um encontro deve ser uma ação separada e explícita do mestre.
- Os backups de combates antigos locais, preservados durante a migração inicial, não são apagados automaticamente pela finalização de um combate remoto.
- Estado atual: iniciativa/encontros locais integrados na main; adaptador remoto não conectado; migração de combate não aplicada em produção. Esta seção é especificação, **não** funcionalidade entregue.

### Premissa de dados da Alpha — confirmação do usuário (23/11/2026)

O usuário informa que **não há dados reais de uso no novo site além do conteúdo importado do sistema anterior**. Não construir uma migração complexa de combates locais de usuários como bloqueador do lançamento. Para o novo fluxo, criar combates diretamente na nuvem; preservar os catálogos e demais dados importados do legado. Dados de teste só podem ser descartados após identificação inequívoca de que são sintéticos; não presumir que toda linha do Supabase é descartável, nem executar limpeza de produção sem verificação e autorização. A segurança/RLS e a persistência entre dispositivos continuam obrigatórias.

### DEC-020 — Iniciativa e Encontros integrados (24/11/2026, issue #134)

- **Retratos:** componente único `RetratoQuadrado` (`src/RetratoCombate.tsx`), quadrado de cantos levemente arredondados. Personagens usam a imagem já existente na ficha/identidade pública, resolvida na hora de exibir por id estável (não é copiada para o estado do combate, preservando a compatibilidade dos dados salvos). Monstros e avulsos usam o placeholder padrão; imagem quebrada cai no placeholder.
- **Rolagens:** `rolarD20`/`textoRolagem` (`src/combate.ts`) devolvem dado, modificador e total; a Iniciativa mostra "d20 15 + 2 = 17". O resultado visível é só informativo; a iniciativa gravada continua sendo o total.
- **PV:** sem segunda fonte de verdade (ficha + `character_combat_status`, ver ciclo de vida do combate).
- **Encontro preparado → Iniciativa:** `SeletorEncontro` envia só as criaturas e quantidades marcadas; quem já está no combate é preservado e o encontro original nunca é alterado. O mesmo seletor é usado na Iniciativa e na página do encontro.
- **Encontros (entrega 2):** lista resumida e página individual na mesma aba (`EncontroPagina.tsx`). Criar um encontro já abre a página. Campos novos, todos opcionais e compatíveis com o JSON antigo `{id,nome,participantes}`: `descricao` (até 2000), por criatura `ca` e `notas` (até 500). A criatura é uma **cópia editável** do encontro; `ref` guarda só a origem do Bestiário e o catálogo nunca é alterado. Ids de encontro e de criatura continuam estáveis (base para a futura ligação Anotação/masmorra → sala → encontro, sem duplicar registros).
- **Sem migração:** o encontro continua uma linha jsonb por campanha (`campaign_encounters`); nenhuma mudança de banco nas entregas 1 e 2.
- **Fora de escopo por ora:** estados do encontro, configuração original x estado atual, loot, recipientes e recompensas (entregas 3 e 4); Anotações/Documentos e distribuição automática para inventários.

### DEC-021 — Estados do encontro e vínculo com o combate (24/11/2026, issue #134, entrega 3)

- **Original x atual, separados no mesmo registro** (sem migração; `campaign_encounters` continua uma linha jsonb): configuração original = `nome`, `descricao`, `participantes`; estado atual = `estado` (`preparado | em_andamento | em_combate | concluido`) e `atual.criaturas[]`. Jogar nunca altera a configuração original. Encontros antigos (sem os campos) valem como "preparado".
- **Vínculo por ids estáveis:** cada criatura concreta tem id `<participanteId>#<n>`; o combatente guarda `encontro: { encontroId, criaturaId }`. Nunca por nome. Um combate pode misturar criaturas de vários encontros. `enviarParaCombate` é idempotente por esse vínculo (não duplica ao retomar nem ao reenviar).
- **Fluxo:** enviar ao combate → `em_combate` (criaturas "no combate"); "Atualizar a partir do combate" copia PV/derrotados sem encerrar; ao **Finalizar combate** (só depois de o combate ser removido com sucesso) sobreviventes e PV voltam ao encontro de origem. O encontro conclui sozinho **apenas sem pendências** (`pendencias()`; hoje criaturas vivas, na entrega 4 também itens não resolvidos); com pendências fica `em_andamento`. Retomar envia só quem está vivo e fora do combate, com o PV atual.
- **Manual:** iniciar sem combate, concluir (confirma se houver pendências), reabrir. **Restaurar original** exige confirmação, descarta só o estado atual e é bloqueado em `em_combate`; nunca desfaz itens já entregues a personagens. **Duplicar original** (sem estado) e **duplicar estado atual** (novos ids de encontro, participantes e criaturas, referências remapeadas; nunca "em combate").
- **Duas instâncias da linha remota:** Iniciativa e Encontros leem `campaign_encounters` cada um com seu hook; ao gravar, a instância avisa as outras (evento interno) e elas relêem se houver versão nova e nada pendente (`reler` em `useLinhaRemota`). Conflito de versão continua sendo recusado, nunca sobrescrito.
- **Preparação para a entrega 4:** `SituacaoAtual` é o ponto de extensão (loot/recipientes/recompensas por criatura e do encontro, com estados Disponível/Encontrado/Coletado/Distribuído); `pendencias()` é onde itens não resolvidos passam a impedir a conclusão automática.

### DEC-022 — Loot, recompensas e recipientes dos encontros (24/11/2026, issue #134, entrega 4)

- **Sem inventário paralelo:** o encontro só registra o que oferece e o andamento. Reutiliza o vocabulário existente: `itemId` = id canônico do catálogo de itens (o mesmo de `InventoryEntry.itemId`), `nome` cobre o item personalizado (`customName`), moedas seguem `CharacterDraft.currency` (cp/sp/gp). Entrega automática a fichas/inventários e ligação com Anotações são etapas futuras; o modelo já tem ids estáveis para isso.
- **Configuração original** (sem migração, mesmo jsonb): `participante.loot` (por criatura **individual**: 2 goblins com 1 adaga cada = 2 adagas), `encontro.recompensas`, `encontro.recipientes[]` (`{id, nome, descricao, itens}`; baús, armários, sacos). Itens e moedas são o mesmo tipo (`ItemLoot`, moeda = linha com `moeda`).
- **Estado atual:** `atual.loot[]` (`LinhaLoot`), uma linha por item e por origem, com id estável `<origem>|<id do item>` (`c:<criaturaId>|…`, `r:<recipienteId>|…`, `g|…`), cópia dos dados do item e quantidades `coletada` e `distribuida`. O estado (Disponível, Encontrado, Coletado, Distribuído) é **derivado** das quantidades e do marcador "encontrado", nunca guardado. Coleta e distribuição são parciais; não se coleta além do total, não se distribui além do coletado e não se desfaz a coleta abaixo do já distribuído.
- **Sincronização com a configuração:** `normalizarLoot` acrescenta linhas para itens/criaturas novos e nunca altera nem apaga linhas existentes (o registro do que foi coletado/distribuído é preservado mesmo se o item sair da configuração).
- **Pendências:** loot com restante > 0 impede a conclusão automática; o loot de criatura viva não conta (a criatura viva já é a pendência). Concluir manualmente pede confirmação citando as pendências.
- **Restaurar:** descarta só o estado atual (incluindo as linhas de loot); a configuração de loot original permanece. Nada é tocado nas fichas: itens já distribuídos continuam com os personagens e a confirmação avisa quantas linhas já foram distribuídas. **Duplicar original** copia a configuração (recipientes com novos ids); **duplicar estado atual** remapeia criaturas, participantes e recipientes e recalcula os ids das linhas.
- **Interface:** loot em seções recolhíveis (por criatura, "Recompensas gerais", "Recipientes", "Andamento do loot" agrupado por origem; grupos resolvidos começam fechados) para a página não virar uma lista longa de campos.


### DEC-023 — Identidade individual e interface de Iniciativa/Encontros (24/11/2026, #138/#139)

- **Situação:** implementada na branch do PR #139; publicação depende das verificações finais e integração autorizada.
- **Problema:** envio parcial, remoção/reenvio e nomes repetidos confundiam identidade; configuração coletiva não permitia um líder diferente no mesmo grupo.
- **Decisão:** preservar `<participanteId>#<ordinal>` como identidade de criatura. `individuais[ordinal]` sobrescreve apenas os campos personalizados (nome, PV, CA, notas, loot); campos ausentes herdam o grupo. Loot próprio vazio significa nenhum loot, sem herança. Editar preparação não reinicia PV já em jogo.
- **Envio:** diálogo compartilhado oferece grupo, quantidade e indivíduos disponíveis. A seleção temporária de IDs não é persistida no encontro. Vínculo encontro/criatura impede duplicatas; nomes únicos são apresentação, nunca identidade. Instâncias ausentes de snapshots parciais antigos são completadas sem apagar as existentes. Remoção preserva PV, CA, notas, iniciativa e condições no estado atual para reinserção.
- **Interface:** identidade/retrato/ficha completa compartilhados; faixa central move uma trilha de cartões com chaves estáveis, enquanto os cartões inferiores permanecem no lugar ao passar turno. Cartões/lista e lados separados/unificados são preferências independentes por usuário. Grupos do workspace usam container queries; controles de turno ficam compactos em painel estreito. Movimento reduzido respeitado.
- **Fichas:** personagens abrem a ficha existente; monstros abrem o leitor completo já usado no Compêndio por referência `item:monstro:<id>`. Nenhuma segunda ficha resumida. Monstros sem retrato disponível usam placeholder.
- **Tesouros:** recompensas gerais e recipientes com acesso direto na subaba; loot por criatura e acompanhamento preservados. Distribuído continua sendo registro manual, sem entrega automática ao inventário. Indicador de nuvem compacto; falhas, permissões e conflitos continuam explícitos.
- **Segurança/compatibilidade:** Iniciativa e Encontros exclusivos do mestre; nenhuma migração ou alteração de produção. Campos JSON opcionais mantêm leitura dos encontros antigos. Salvamento mantém revisão otimista e backups existentes; combate e encontro ainda são registros separados, não uma transação distribuída.
- **Verificação:** 1.534 testes Vitest aprovados (inclui RLS/PGlite isolado); 66 E2E aprovados e 2 saltos previstos (três painéis no celular). Caso cinco goblins/líder, 4+1, remoção ferida, reinserção e recarga testado a 320/390/1024/1440 px. Build e testes adicionais finais registrados na continuidade.
- **Alternativa rejeitada:** duplicar o grupo para representar o líder, identificar por nome ou descartar/recriar o estado do encontro. Etapa 2 não iniciada.


### DEC-024 — Busca única, controles imóveis e loot direto (24/11/2026)

- **Problema:** o nome do turno alterava a posição das ações, a fonte de personagens da Iniciativa não era conectada ao adaptador real e a preparação do loot continuava excessivamente aninhada.
- **Decisão:** nome/rodada em linha própria e ações com colunas fixas. Em painéis de até 900 px, ações por ícone com nomes acessíveis e tooltips. Faixa sticky opaca cobre todo o recuo interno do painel. Modos de visualização ficam em ícones discretos à direita da lista.
- **Busca:** uma pesquisa com filtros Todos, Personagens, Bestiário e Encontros preparados, reutilizando os seletores existentes e o diálogo seletivo. Combatente avulso é a ação explícita para cadastro manual, não um gerador aleatório de inimigos. Formulário aparece apenas nessa opção.
- **Personagens:** `useAventureiros` usa o mesmo `fontePersonagens`/API autenticada de registros da campanha quando não há fonte explícita. Filtro de campanha/visibilidade e permissões existentes preservados; retratos usam a mesma origem. Teste cobre a integração sem injetar contexto artificial.
- **Loot:** conteúdo de criaturas, recipientes e recompensas sempre visível na preparação. Um seletor contextual compartilhado abre por Escolher loot; itens do catálogo, personalizados e moedas mantidos. Andamento fica em Progresso para não duplicar as listas de preparação.
- **Alternativa rejeitada:** mais seletores independentes, cabeçalho que muda com o nome ou formulários/itens escondidos em details aninhados. Sem alteração de JSON, schema, políticas, dados existentes ou Supabase hospedado.
- **Verificação:** testes de integração e E2E de busca real, isolamento de campanha, cliques repetidos na mesma coordenada, cinco goblins/retomada, loot visível e faixa em painel dividido. Resultados finais na continuidade. Trabalho local na branch `codex/iniciativa-busca-controles`; não confundir com o PR #139 já publicado.

### DEC-025 — Refinamentos finais e dimensões da faixa (24/11/2026, PR #140)

- Retratos em painel amplo (container a partir de 760 px): 80×80 px, ativo 96×96 px; cartões de 112 px. Painéis estreitos: 60×60 px, ativo 72×72 px, cartões de 88 px. Nome mínimo 12 px e iniciativa 14 px em ambos. A variável CSS de passo é compartilhada pelo cartão e pelo deslocamento; redimensionar o workspace mantém o ativo centralizado. Só o retrato cresce; nomes e valores conservam tamanho/posição. Destaque azul, passados discretamente escurecidos e movimento reduzido respeitado.
- Não repetir o nome do ativo abaixo da faixa. Rodada/ações compactas em posições estáveis. Busca Todos vazia sem sugestões; categorias sob interação; PV de personagem exclusivamente da ficha, sem entrada manual ou valor inventado. Ações de dano/cura/condições continuam disponíveis em todos os combatentes. Removidos indicador rotineiro de nuvem e exportação rotineira JSON; salvamento, recuperação e avisos de falha preservados.
- Loot: artefatos do CI de `85abd88` mostram 25 peças de ouro visíveis no Baú dourado. O filtro E2E falhava ao procurar a região ancestral dentro do recipiente. Verificação usa a região acessível existente e confirma texto, quantidade, uma linha e diálogo fechado, sem mudar a funcionalidade.
- Sem migração, escrita em Supabase hospedado ou mudança de permissões. Configurações da iniciativa e etapa de Personagens/Fichas/Inventário permanecem futuras. Resultados e limites de execução na continuidade.

### DEC-026 — Início da campanha: capa em destaque, edição única e enquadramento não destrutivo (25/11/2026)

- **Página é de visualização.** Capa de borda a borda do painel (altura por `cqw`), nome sobre gradiente até a cor de fundo, descrição, atalhos compactos do mestre, aventureiros com `RetratoQuadrado` (o mesmo de iniciativa e encontros), Diário e participantes. Sem imagem, a faixa é baixa.
- **Um único "Editar" (só mestre)** abre um diálogo (`<dialog>`, padrão já usado no projeto) com informações, capa e enquadramento, participantes, convites e exclusão. Fechar com algo não salvo pede confirmação; a aba fica marcada como não salva. O jogador continua podendo sair da campanha pela lista de participantes.
- **Enquadramento não destrutivo (migração 0012, aplicada em produção em 25/11/2026 conforme informado pelo responsável):** guarda só `{zoom, x, y}`; a imagem enviada permanece original e o mesmo ponto fica em foco em qualquer largura. Trocar ou remover a imagem zera o enquadramento no mesmo update (sem gatilho, para não prender a coluna `cover_path` da 0006). **Sem a 0012 no banco**, o aplicativo detecta a coluna ausente e mantém o comportamento anterior (o recorte substitui a imagem, com aviso). Alternativas rejeitadas: continuar só recortando (perde a original e a qualidade) e esconder o enquadramento no caminho do arquivo ou em registros de nota.
- **Retratos:** personagens guiados exibem apenas a imagem pública (https) escolhida na identidade pública; só personagens publicados aparecem; o nível de guiados continua privado.

### DEC-027 — Identidade pública definitiva, retrato único e ficha em três abas (25/11/2026)

- **Alpha sem retrocompatibilidade (decisão do responsável).** O modelo do 2.0 pode ser reformulado diretamente; não há adaptadores para formatos antigos. O Compêndio 1.0 não é alterado e serve só de referência. A privacidade continua obrigatória: nenhum registro existente muda de visibilidade.
- **Identidade pública** (`src/rules/public-identity.ts`): nome, alcunha, raça e classe, cada um "usar da ficha", "personalizar" ou "ocultar", mais descrição. Exige nome ou alcunha. Campo personalizado vazio nunca revela o valor da ficha. Não é uma segunda ficha.
- **Retrato único:** `draft.portrait` (https) na ficha; a apresentação publicada, o Início, Personagens, Iniciativa e Encontros usam a mesma imagem. `draft.nickname` guarda a alcunha.
- **Sem migração:** o banco (0008) aceita um conjunto fixo de chaves. A tradução fica isolada em `src/fichas.ts`: a alcunha usa `card.title` e o controle `settings.surname`; sobrenome, título digitado e imagem pública separada não existem mais no modelo. Trocar essas chaves por nomes próprios (e publicar o nível) pede uma migração futura, com autorização.
- **Publicação:** personagem **novo** nasce com a apresentação publicada (campos públicos da ficha), com caixa visível para desligar. Personagens já salvos mantêm a escolha; rascunhos locais enviados à campanha continuam privados.
- **Limite conhecido:** só o dono grava a identidade. Se o mestre alterar nome, alcunha ou retrato de uma ficha, a apresentação pública só muda quando o dono salvar de novo.
- **Ficha de jogo** (`src/ficha/`): cabeçalho compartilhado e três abas (Ficha, Habilidades, Inventário). Os cálculos continuam no motor `regras-2014`; o estado de jogo (condições, inspiração, morte, modificadores temporários, defesas anotadas, ataques personalizados, histórico do inventário) fica em `draft.play`, sem alterar a construção. Dano, cura, descansos, recarga e carga (Força × 7 kg) seguem o 1.0.
- **Salvamento automático** na ficha de jogo, com a revisão otimista existente: conflito pausa tudo e não sobrescreve; falha não é repetida em laço; sair da ficha envia o que estava pendente.
- **Estado preservado** na sessão do navegador: tela (jogo ou edição), aba, rolagem por aba, lista/grade e filtro. No celular, arrasto horizontal troca de aba, ignorando controles, rolagem lateral, rolagem vertical e a borda usada pelo gesto de voltar.
- **CA e ataques:** armaduras, escudos e armas equipados entram pelo motor; ajustes manuais são modificadores temporários separados, somados só na exibição.
- **Início:** removidos os cinco atalhos redundantes do mestre; avisos de privacidade escritos para quem está olhando ("oculto dos jogadores" para o mestre).
- **Não incluído:** distribuição e transferência de loot, sintonização, itens mágicos adicionados pelo jogador, talentos e magias concedidos pelo mestre ou por itens, campos de história/personalidade (não existem no modelo), imagens de itens e envio de arquivo de retrato.

### DEC-028 — Refinamento da ficha: edição, inventário, moedas e apresentação automática (25/11/2026)

Prazo definitivo do Compêndio: **12/12/2026**. Substitui os pontos da DEC-027 indicados.

- **Edição:** Cancelar e Salvar voltam à ficha; o Voltar do navegador sai da edição; alterações não salvas sempre pedem confirmação. A tela de edição não é estado de navegação: abrir um personagem salvo mostra a ficha. Um personagem tem uma aba só.
- **Ficha:** três abas mantidas. PV com `− [1] +`; condições compactas com efeito consultável; recursos, espaços de magia e dados de vida com marcadores clicáveis (preenchido ou vazado, sem depender de cor); ataques, magias e características em cartões, com CD por origem (classe, raça ou concessão); filtros por Ação, Ação bônus, Reação e Passiva só quando as regras informam; favoritos. Detalhe de magia ou item aberto a partir da ficha nunca a encobre no computador.
- **Concessões:** talentos, magias e habilidades são entregues pelo mestre; podem ficar presas a um item do inventário (valem só com ele). História e personalidade são campos privados da ficha.
- **Moedas por campanha:** o mestre escolhe quais das cinco a mesa usa (a mesa do responsável usará **PC, PP e PO**; PE e PL desativadas). Desativar não apaga valores: ficam na ficha, fora da tela e do total. Entregas (equipamento inicial e, no futuro, recompensas, loot e transferências) em moeda desativada chegam, pelo mesmo valor, nas ativas (`entregarNasAtivas`); sem conversão exata, o valor fica como veio. Ícone SVG próprio por moeda (`src/moedas/IconeMoeda.tsx`), a reutilizar em loot, preços e transferências. Patrimônio total em PO.
- **Disponibilidade de itens:** política explícita (`src/catalogue/disponibilidade.ts`): itens mundanos, equipamento de origem e as poções comuns (Cura e Escalada). O restante só pelo mestre, também na API (0013).
- **Apresentação pública automática** (substitui a publicação manual e a exclusão do nível): é uma projeção da ficha, sem caixa de publicar; nome, alcunha, raça, classe e **nível** herdam, são personalizados ou ocultados; o servidor calcula o cartão, inclusive quando o mestre salva. Retrato único, com envio de arquivo (bucket `campaign-assets`).
- **Imagens do 1.0:** requisito obrigatório de recuperação, registrado em [docs/IMAGENS-V1.md](docs/IMAGENS-V1.md).
- **Banco:** migração **0013 proposta, não aplicada**. Personagens antigos passam a aparecer para a campanha na próxima gravação, sem os campos ocultos.
- **Adiado:** loot, sintonização, galeria colaborativa, Assimilação, rolador 3D e anotações.

### DEC-029 — Personagem: fonte única do estado vital, criação por etapas e identidade de D&D (26/11/2026)

Prevalece sobre o que conflitar nas DEC-027 e DEC-028.

- **Fonte única:** PV, PV temporários, condições e salvaguardas contra a morte existem só na ficha (`character_sheets.draft`). Mudam por **operações** no servidor (`alterar_vitais`), com a linha travada e identificador que impede repetição; a gravação da ficha inteira **preserva** esses campos e as operações não avançam a revisão. A Iniciativa lê e altera a ficha; não grava PV de personagem "ao finalizar". Sem o cartão "Estado em combate". A `character_combat_status` (0011) deixa de ser usada. Fila única no cliente (`src/vitais/`), com tempo real e releitura de reserva.
- **Teto de PV (revisão de 26/11):** o banco não conhece as regras, então o aplicativo informa o PV máximo e o servidor o limita a **30 × nível** (curar, definir, ajustar, descansar, usar item e criar a ficha). Nenhum personagem 2014 legítimo chega ao teto. Isso impede valores absurdos; não prova o máximo exato. Quem edita a própria ficha já controla a construção (atributos, classe, nível).
- **Aplicativo anterior à 0014:** o aplicativo atual envia `_protocolo: 2` ao gravar a ficha (o banco remove antes de guardar). Sem esse sinal, uma gravação que **mudaria** PV, temporários, condições ou morte é **recusada** (`aplicativo_desatualizado`), em vez de aceita e descartada em silêncio. O resto continua sendo salvo.
- **Inventário:** usar (consumir) e transferir são funções atômicas no banco (`usar_consumivel`, `transferir_item`); a transferência preserva a instância (e as concessões presas a ela), registra nos dois lados e só sai de ficha própria (ou pelo mestre), para outro personagem guiado da mesma campanha.
- **Layout:** margens proporcionais à largura do **painel**, uma única rolagem vertical por grupo, conteúdo centralizado.
- **Imagens editáveis:** um editor só (`src/imagem/`), popup com arraste, roda, pinça e teclado; não destrutivo. O enquadramento do retrato viaja na referência (`#enq=zoom,x,y`).
- **Identidade visual por sistema:** a de D&D fica em `src/dnd/`, escopada em `.sistema-dnd` (escudo de CA, D20 de nível, molduras de atributo, dados de vida, divisórias douradas). Componentes genéricos em `src/ui/` (modal, menu de ações, etapas e cartões de escolha), reutilizáveis por outros sistemas. Tema claro é preferência em Conta; o padrão continua escuro.
- **Criação, edição e subida de nível:** criação em sete etapas com salto livre, pendências com atalho e salvamento incompleto; edição por categorias, sem controles de mesa; subida de nível em fluxo próprio, com comparação, que só altera nível, PV por nível e escolhas novas.
- **Origens:** só o Acólito vem do SRD 5.1. As demais usam os dados mecânicos e os **resumos próprios** do Compêndio 1.0 (`src/criador/origens-2014.ts`); nenhum texto oficial é distribuído. Objetos sem item no catálogo usam `background-trinket` com o nome.
- **Banco:** migração **0014 proposta, não aplicada** (inclui o enquadramento na validação da apresentação e o item `background-trinket`). Precisa ser aplicada **junto** com a publicação do aplicativo.

### DEC-030 — Aparência aprovada da ficha e do inventário (26/11/2026)

Substitui a **identidade visual** da DEC-029 (a lógica dela permanece). As referências aprovadas pelo responsável (12 telas) valem para organização, hierarquia e comportamento; cores e tipografia são as do Compêndio 2.0.

- Sem molduras, dourado, serifa, D20 de nível, escudo na CA ou barra de vida. Ícones pequenos apenas funcionais.
- Grades dos seis indicadores e dos seis atributos: **6×1, 3×2 ou 2×3** pela largura do painel.
- Vocabulário visível: **"Testes de resistência"** (nomes internos não mudam; descrições do catálogo permanecem como cadastradas).
- Tipo de ação **Especial**: só habilidades que o SRD resolve fora de ação, ação bônus e reação, e magias de conjuração longa. Sem classificação conhecida, a habilidade aparece só em "Todas".
- Operação sem suporte no banco aparece **desabilitada e explicada**; nunca simula sucesso.
- Decisões de produto já aprovadas e ainda sem implementação: mestre **e** jogador identificam itens (jogador no descanso curto ou com a magia Identificação; os dados verdadeiros nunca vão ao jogador pela API); dono e mestre recuperam cargas manualmente até o máximo; sintonização com limite 3, configurável por personagem pelo mestre e validado no servidor; transferência de moedas. **Pendente de decisão:** compartilhamento individual ou coletivo do conhecimento de itens mágicos.

### DEC-031 — Compêndio e projeção de conhecimento (26/11/2026)

Duas áreas Campanha/Regras, sem Enciclopédia e Documentos no menu independente. `notes` é a fonte narrativa; `campaign_codex` referencia registros e definições, sem duplicar fichas ou itens. Conhecimento de criaturas é coletivo (quatro níveis), sem revelação automática por combate. Itens revelados coletivamente nesta etapa são uma decisão explícita do mestre, separada da futura identificação individual/sintonização da DEC-030; posse não concede conhecimento nem adição livre.

A API projeta apenas campos autorizados; RLS preserva os registros privados até para ex-mestres. Imagens secretas ficam em `codex-assets`, separado de `campaign-assets`. Substituição usa arquivo imutável e atualização do ponteiro; sem coleta automática de arquivos antigos. Notificações internas são idempotentes por patamar e destinatário, revalidadas pela autorização atual. SRD e arquivos públicos legados não são segredos da campanha. Detalhes e aplicação da **0015 proposta, não aplicada** em `docs/COMPENDIO-CONHECIMENTO.md`.

### DEC-032 — Compêndio por páginas, vínculos e notificações (26/11/2026)

Detalhe de registro, identidade, criatura, item, magia e regra é uma **página do workspace**, nunca um painel dividido dentro da aba. Clique normal abre no segundo grupo; o botão direito também oferece abrir como aba do próprio grupo. O desktop tem **no máximo dois grupos** (substitui o limite de três); layouts salvos com mais colunas são reunidos sem perder abas. No celular a página ocupa a tela.

Vínculos usam identificadores estáveis em `codex_links` (um por par, sem direção) e só são entregues por função do servidor quando **as duas pontas** são visíveis a quem consulta: título, relação, termos de pesquisa e contadores seguem a mesma regra. Remover o vínculo não apaga registros. Campos narrativos são opcionais e ficam no registro canônico (`notes.meta`), com lista fechada validada no banco.

O sino fica no cabeçalho geral do aplicativo (substitui o sino dentro do Compêndio). Conteúdo canônico continua em `notes`; descobertas de itens referenciam a definição do catálogo, sem cópia. Substitui da DEC-031 os cartões em coluna única: painel largo mostra Campanha e Regras lado a lado.

### DEC-033 — Navegação global por abas (26/11/2026)

Substitui a abertura automática no grupo direito da DEC-032 e a exceção de detalhes
que não encobriam a ficha na DEC-028. Clique interno substitui a página da aba atual,
com histórico independente e proteção da edição. Menu lateral abre/foca seção;
contexto: nova aba no mesmo grupo, novo grupo/oposto, abrir na atual. Máximo dois
grupos, nenhum split implícito; mobile permanece sem grupos. Abas compactas em uma
faixa, trilho lateral recolhido de 48 px e logotipo oficial. Requisitos completos em
`docs/ESPECIFICACAO-NAVEGACAO-GLOBAL.md`; implementação e validação são registradas
separadamente, sem tratar a decisão como funcionalidade publicada.

### DEC-034 — Cartas de consulta, bestiário narrativo e fichas com abas (27/11/2026)

**Decisão do responsável.** Prevalece sobre DEC-031/032 e especificações anteriores no que conflitar.
- Consulta do Compêndio em **carta**: janela centralizada no grupo ativo (desktop) ou a mesma composição em página completa (celular e "Expandir"). Fechar não navega, então filtros e rolagem permanecem. Botão direito, Ctrl+clique e clique central não mudaram. Um componente (`Carta`) e um hospedeiro (`CartaHost`) para todas as categorias.
- **Bestiário é só narrativo.** Estatísticas ficam na ficha técnica, exclusiva do mestre; a barreira é o servidor (0020), não o React.
- Conhecimento em três modos: consulta limpa; "Gerenciar conhecimento" (rascunho com um olho por campo/vínculo, salvar = uma operação, cancelar = nada gravado); "Ver como jogador" (seletor Mestre/Jogador sobre `codex_preview`; o título da aba também usa a projeção).
- Fichas com abas: aventureiro Ficha/Habilidades/Inventário/**Identidade**; monstro Ficha/Habilidades/Bestiário; NPC com ficha Ficha/Habilidades/Identidade (sem Inventário: o modelo de criatura não tem). NPC só tem ficha se o mestre vincular uma criatura; nada é criado automaticamente.
- Nome de monstro na Iniciativa abre a ficha no outro grupo (uma ficha por definição; PV e condições continuam no combate). No celular, abre na própria tela e Voltar retorna ao combate.
- Início e Compêndio usam a mesma carta de identidade pública, que mostra a projeção publicada inclusive ao mestre. O próprio jogador abre a ficha.
- Citações `@` usam marcação `@[texto](id)` no texto simples existente, sem novo editor rico.
- Naturalidade, residência, liderança e sede aceitam texto livre ou vínculo tipado; o vínculo ocupa o campo e não se repete em "Registros relacionados". Vínculo novo nasce secreto.
- Sem novo sistema de navegação, abas temporárias ou retrocompatibilidade extra.
- Refinamentos (27/11/2026): retratos de personagens e criaturas nas cartas com cerca de 300 px (260 px no celular), compactos nas fichas; visualizador único em tela cheia da imagem original, somente leitura (o enquadramento continua sendo ação separada), usando apenas o endereço já autorizado da tela; ficha técnica sem repetir o que está no cabeçalho; "Vincular registro" no modo de edição; aviso ao mestre, em "Gerenciar conhecimento", quando o texto revelado cita o próprio nome oculto, sem alterar o texto.


### DEC-035 — Rodada Alpha com jogadores reais (27/11/2026)

Decisão mais recente do responsável: cadastro aberto. Substitui o bloqueio anterior de cadastro para esta rodada; campanhas privadas continuam exigindo convite e RLS. Os dados de produção agora pertencem também a usuários externos e não são descartáveis.

Menu responsivo único: celular somente na barra inferior, sem segundo acionador no topo; Conta/Configurações/Sobre separados. Preferências existentes preservadas; versão central no package.json. Nome da conta em profiles, separado da identidade dos personagens. Foto da conta exige contrato próprio de persistência/permissões antes de ser disponibilizada.

Anotações do jogador: lista “Minhas anotações” e documentos BlockNote privados por usuário/campanha, sem quadros, pastas, tags, grade ou compartilhamento novo; preservar os registros existentes. Esta é decisão aprovada, **não implementação concluída**. Não alterar as Anotações do mestre. Sem sistema interno de feedback ou telemetria adicional: relatos ao responsável, organização nas issues.

Prioridades e roteiro em docs/ALPHA-JOGADORES-20261127.md e docs/ROTEIRO-TESTES-JOGADORES.md. Sem merge/deploy/SQL de produção sem autorização específica.


### DEC-036 — Correções da rodada e transferência (27/11/2026)

Decisões explícitas do responsável: dono deve acessar/editar a própria ficha completa em desktop/celular; mestre conforme permissões vigentes; outros jogadores apenas identidade pública autorizada. Investigar o relato sem tornar fichas públicas ou flexibilizar RLS. Aprovar “Marcar todas como lidas” no topo da janela de notificações, com ícone de confirmação dupla, contador imediato, persistência, erro de rede, somente usuário/escopo atuais, sem excluir notificações e preservando leitura individual e visual existente. Ambas **pendentes de implementação**.

Encerrar esta sessão e transferir ao Codex, sem novas funcionalidades/refatorações/etapas. Planejamento e critérios completos preservados em docs/PROMPT-CODEX-ALPHA-20261127.md; estado/testes/publicação/investigação em docs/TRANSFERENCIA-CODEX-20261127.md. Restrições de produção e escopo continuam vigentes; nenhuma autorização nova de merge, deploy ou migração.


### DEC-037 — Personagens de outros jogadores e leitura em lote (27/11/2026)

Correção explícita do diagnóstico pelo responsável: o dono já abre a própria ficha normalmente. Não há bloqueador P0 de autorização nesse relato. Na lista Personagens, o dono e o mestre abrem a ficha; outro jogador abre a carta de identidade do Compêndio existente (página no celular). Não modificar RLS para mudar essa apresentação. Identificar o responsável pelo `profiles.display_name` autorizado da API de participantes, nunca por e-mail. Abas e estado de salvamento pertencem ao mesmo contêiner de largura da ficha.

Leitura em lote reutiliza as políticas existentes: campanha definida pelos IDs da projeção autorizada, IDs de notificações congelados antes das escritas, teto do feed aberto e somente `read_at` dos pendentes. Novas notificações não entram no lote. Falha parcial não é rollback: recarregar o estado real e exibir erro. Troca de usuário/campanha aborta a operação e descarta respostas antigas. Sem migração nova, exclusão, alteração de destinatário ou push.

### DEC-038 — Ciclo de vida e visibilidade dos personagens (27/11/2026)

Decisão do responsável; substitui as anteriores sobre exclusão de personagens. Excluir, pelo jogador, é **renunciar ao controle**: a ficha é preservada e o mestre decide (só no Compêndio, arquivar, converter em NPC, transferir com aceite, excluir definitivamente ou decidir depois). Só a exclusão definitiva remove o registro narrativo. O mestre gerencia diretamente e pode excluir vários de uma vez; nada é limpo automaticamente.

Implementação: a perda de controle troca o dono para o mestre, aproveitando as políticas por dono/mestre, sem RLS nova mais permissiva; situação, ofertas, histórico e cópias ficam em `private_ficha`; operações atômicas e idempotentes no servidor (0021, **proposta**). Personagens ativos de jogadores têm identidade pública visível por padrão, com as escolhas por campo preservadas; regras de descoberta de NPC e monstro não se aplicam a eles. Detalhes, limites e aplicação em `docs/EXCLUSAO-VISIBILIDADE-PERSONAGENS.md`.

**Complemento (27/11/2026) — retenção:** arquivar preserva a ficha sem prazo enquanto a campanha existir; "só no Compêndio" guarda cópia privada por 30 dias; exclusão definitiva não deixa cópia recuperável (inclusive apaga cópias anteriores), exige confirmação explícita também no servidor e preserva só registros históricos, respeitada a retenção dos backups técnicos.

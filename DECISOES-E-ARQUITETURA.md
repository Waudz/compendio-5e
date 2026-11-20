# COMPÊNDIO 5e 2.0 — DECISÕES, ARQUITETURA E ESTADO

> Documento de referência para qualquer pessoa ou IA que trabalhe no projeto. Atualizar quando uma decisão mudar. Não confundir **decidido**, **planejado** e **implementado**: cada seção abaixo diz o que já existe no código. Roteiro, estado detalhado e pendências: `docs/PLANEJAMENTO-V2.md`. Última revisão: 20/11/2026.\n\n> **Novo desenvolvimento em PR #74 (não integrado):** criador/ficha/inventário em piloto isolado, decisões de ferramentas e estado detalhados em `docs/CRIADOR-FICHA-INVENTARIO.md`; auditoria em `docs/AUDITORIA-CATALOGO-PERSONAGEM-2014.md`. Não confundir com funcionalidade publicada.

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

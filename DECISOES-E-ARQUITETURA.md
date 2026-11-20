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

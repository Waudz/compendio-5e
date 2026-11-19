# COMPÊNDIO 5e 2.0 — DECISÕES E REGRAS DO PROJETO

> Documento de referência para qualquer pessoa ou IA que trabalhe no projeto. Atualizar quando uma decisão mudar. Não confundir **decidido**, **proposto** e **implementado**.
>
> Última revisão: 19/11/2026. Fonte: decisões das conversas de planejamento. Este arquivo registra intenção de produto; **não é prova de que algo já esteja implementado ou testado**.

## 1. Objetivo e princípios

Construir o **Compêndio 5e**, ferramenta gratuita de apoio à mesa de D&D 5e **2014**, para mestre e jogadores. Priorizar rapidez durante a sessão, estabilidade, clareza, responsividade, manutenção simples e integração consistente entre módulos.

**Regras inegociáveis:**

1. **Não concordar automaticamente com novas ideias.** Avaliar utilidade na mesa, complexidade, custo, segurança e manutenção; recomendar excluir ou adiar o que atrapalhar.
2. **Não acumular funcionalidades.** Cada módulo deve resolver um problema concreto, sem menus, campos e fluxos redundantes.
3. **Código limpo e coeso.** Evitar milhares de pastas/arquivos e também evitar arquivos monolíticos. Separar por responsabilidade quando houver benefício real, sem abstrações prematuras.
4. **Uma fonte de verdade para cada dado.** Mudanças de PV, recursos, inventário etc. devem refletir em todas as telas relevantes, com sincronização e tratamento de conflitos.
5. **Componentes e regras compartilhados.** Não duplicar lógica de negócio em telas diferentes. Separar apresentação, estado do workspace, regras de D&D, acesso a dados e permissões.
6. **Não construir novas funções sobre defeitos conhecidos.** Corrigir e testar a base antes de expandir.
7. **Testar interações entre módulos**, não só funções isoladas. Considerar concorrência, atualização simultânea, latência, erros e permissões.
8. **Não prometer zero bugs** nem dizer que algo foi validado se não houve execução/resultado verificável. Registrar limitações.
9. **Sem custo obrigatório** para usuários; evitar infraestrutura e serviços pagos.
10. **Projeto de fãs, sem afiliação oficial.** Usar material permitido do SRD 5.1 / regras de 2014 e respeitar direitos autorais; não presumir licença de conteúdos não-SRD.

## 2. Repositórios e publicação

- **Novo repositório:** `Waudz/compendio-5e` — GitHub, **público** (decisão posterior à criação privada).
- **Projeto anterior:** `Waudz/rastreador-dnd` — manter intacto. Não migrar nem alterar produção sem plano e autorização explícita.
- Fluxo de trabalho: alterações em branches/PRs, revisão, build e testes; o usuário autorizou que o assistente **aprove e integre entregas rotineiras sem solicitar confirmação a cada PR**. Consultar o usuário nas decisões de produto relevantes ou ações sensíveis.
- Não afirmar que publicação, CI, migração ou funcionalidade estão prontas sem verificar. PR aprovado/mesclado não equivale a aplicativo validado em execução.
- **GitHub Pages** escolhido para preview gratuito. Repositório tornado público para habilitar Pages. Fonte de publicação configurada como **GitHub Actions**. Endereço planejado: `https://waudz.github.io/compendio-5e/`. **Disponibilidade real precisa ser verificada**.
- O preview poderá ser público: **nunca colocar senhas, chaves de serviço, tokens privados ou dados pessoais/segredos de campanhas no código**. Chaves públicas de cliente, quando usadas, ainda exigem RLS rigorosa.
- Não criar segundo projeto no Cloudflare sem necessidade: opção discutida e descartada após tornar o repositório público.

## 3. Stack técnica

**Definido como direção arquitetural:**
- React + TypeScript + Vite;
- Tailwind CSS e componentes acessíveis, com shadcn/ui/Radix quando forem úteis (não instalar tudo de antemão);
- Supabase: Postgres, Auth, Storage e políticas RLS;
- TanStack Query para dados remotos; Zustand para estado de interface/workspace;
- React Router para URLs e links diretos (não usar roteamento como substituto das abas);
- React Hook Form + Zod para formulários/validação;
- Vitest e Playwright para testes unitários, integração e fluxos críticos;
- PWA instalável posteriormente.

**Atenção:** a implementação inicial usa React/TypeScript/Vite e CSS simples; várias bibliotecas acima **ainda não foram adicionadas**. Adicionar somente quando o módulo exigir, mantendo a base enxuta.

Arquitetura desejada: interfaces/componentes reutilizáveis; serviços de domínio e regras separados das telas; camada de acesso a dados; estado local efêmero separado de dados persistentes; limites claros entre dados globais e dados de campanha. Evitar importações circulares, listeners globais descontrolados, mutações diretas e estados duplicados.

## 4. Uma campanha ativa por vez

- O usuário escolhe **uma campanha ativa** por sessão de uso, como alternar entre CNPJs em um banco.
- Para acessar outra campanha, é necessário **trocar explicitamente** de contexto; não exibir seletor de campanha em todas as telas.
- Restaurar a última campanha ativa quando apropriado.
- Dados, permissões e workspace são isolados por campanha; não misturar personagens, NPCs, documentos ou encontros de campanhas diferentes.
- O **catálogo geral do Compêndio** (regras, magias, itens e monstros permitidos) não pertence a uma campanha e pode ter consulta de visitante.
- Na troca de campanha, resolver edições não salvas, cancelar/invalidar consultas antigas e restaurar abas próprias da campanha.
- Aplicar isolamento também no **banco/RLS**, não apenas na interface.

## 5. Desktop: menu lateral e workspace

- Menu principal **lateral esquerdo recolhível**, com ícones e texto quando aberto, apenas ícones quando fechado; não voltar ao menu superior antigo.
- Seções principais: **Personagens, Iniciativa, Encontros, Enciclopédia, Compêndio, Documentos**; configurações em área apropriada.
- Área central com **abas**, inspirada na experiência de editores como VS Code.
- Cada coluna contém várias abas; clicar em aba alterna o conteúdo daquela coluna.
- **Apenas colunas verticais**, até **três** no layout normal. **Proibidas subdivisões horizontais (em cima/embaixo), layout em 1/4 de tela, janelas flutuantes e docking complexo.**
- Colunas podem ser redimensionadas. Abas podem ser arrastadas entre colunas; criar coluna nova ao separar aba, respeitando limite e largura mínima útil.
- Clicar no menu lateral abre/focaliza a seção na **coluna ativa**, sem substituir outra aba. Evitar duplicar a mesma entidade indevidamente.
- Itens concretos (ex.: ficha de Lydia, NPC Sabine, magia específica) devem ter **identificadores próprios** para coexistir como abas; não modelar tudo apenas pelo nome da seção.
- Abrir em nova aba/coluna via **botão direito** sobre alvos apropriados; considerar clique do meio. Não interceptar contexto de campos editáveis.
- Qualquer conteúdo pode ocupar qualquer coluna. **Não criar painel lateral direito fixo de referência.**
- Persistir e restaurar abas, coluna ativa, proporções e estado de navegação por **usuário + campanha + dispositivo**, com esquema versionado e recuperação de estado corrompido.
- Evitar manter dezenas de abas ocultas executando efeitos caros. Dados do jogo devem sincronizar mesmo se a aba não estiver visível.
- Confirmar/evitar perda de alterações não salvas ao fechar aba, trocar campanha ou navegar.

**Biblioteca de layout (decidido e implementado):** **FlexLayout** (`flexlayout-react` 0.11) renderiza grupos, abas, arraste, indicadores de soltura e divisórias; as regras do produto ficam em código próprio e testado. Avaliação: dockview e rc-dock também docam, mas o FlexLayout oferece o gancho `Model.setOnAllowDrop`, `onAction` e `onContextMenu`, que permitem impor o limite e a proibição de empilhar sem remendos. Restrições aplicadas em três camadas: (1) `allowDrop` rejeita soltura em cima/embaixo e esquerda/direita acima de 3 grupos (o FlexLayout então oferece o centro ou outra posição válida); (2) `onAction` só aceita adicionar/fechar/selecionar/mover aba, fechar grupo, ativar grupo e ajustar pesos (sem popout, flutuante, maximizar, bordas); (3) `isColumnsOnly` valida o modelo após cada mudança e reverte ao último estado bom. Divisórias, indicadores e menu de contexto usam o tema escuro/dourado do projeto.

**Modelo de abas:** id próprio `tipo:ref` (`secao:personagens`, `ficha:ID`, `npc:ID`, `documento:ID`); abrir uma entidade já aberta apenas foca a aba existente. Abrir pelo menu lateral adiciona ao grupo ativo sem substituir nada. Arquivos: `src/workspace.ts` (operações puras e regras), `src/persistence.ts` (armazenamento, validação, migração), `src/App.tsx` + `Mobile.tsx`, `ContextMenu.tsx`, `Panel.tsx` (interface).

**Persistência:** chave `compendio5e:workspace:v2:<usuario>:<campanha>:<dispositivo>` (hoje `visitante/demo/navegador`, preparada para usuário e campanha reais), envelope `{version:2, layout}`. Ao carregar, o layout é reconstruído por `sanitizeLayout` (ids válidos, sem abas repetidas, pesos positivos, no máximo 3 grupos, linhas aninhadas achatadas); dado irrecuperável volta ao layout padrão. O esquema v1 (`compendio5e:workspace:columns:v1`) é migrado.

**Identidade visual:** azul-grafite (`--bg #141D27`, `--panel #202C39`) com destaque **turquesa `#00CEC8`**; toda a paleta fica em variáveis CSS no topo de `src/style.css`. Texto sobre fundo turquesa usa `--on-accent`. Sem gradientes nem efeitos neon.

**Autenticação (Supabase) — camada de cliente:** `src/supabase.ts` cria o cliente único a partir de `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` (ver `.env.example`; `.env*` fora do git). Sem variáveis válidas (ou com chave `service_role`/`sb_secret_`, ou URL fora de `*.supabase.co`) o cliente é `null` e o app roda só como visitante; nada é simulado. `src/auth.ts` concentra validação, tradução de erros para pt-BR e chamadas ao SDK; `AuthContext.tsx` mantém `status` (`unconfigured | loading | guest | authenticated`), sessão persistida pelo SDK (PKCE, `detectSessionInUrl`) e o estado de recuperação de senha; `AccountPanel.tsx` é a aba `conta:perfil` (entrar, criar conta, reenviar confirmação, recuperar e alterar senha, sair), aberta pelo menu lateral dentro do workspace. Confirmação de e-mail e recuperação redirecionam para `origin + BASE_URL`; esse endereço precisa estar em *Authentication > URL Configuration* do projeto. A `service_role` nunca entra no frontend. Autorização de dados virá de RLS (PR B), não da interface.

## 6. Celular e PWA

- **Um único projeto e base de dados**, não dois aplicativos separados.
- Desktop com workspace de colunas; **celular com interface específica, simples e focada**, sem arrastar/gerenciar três colunas.
- Jogadores precisam acessar ficha, magias, itens, regras e enciclopédia com poucos toques. Não transportar a interface complexa do mestre para telas pequenas.
- A navegação móvel definitiva **ainda precisa ser desenhada e testada**. Mostrar apenas a coluna ativa no protótipo é medida transitória, não solução completa.
- Mais tarde configurar **PWA instalável** (ícone, manifesto, splash, comportamento offline adequado), sem prometer offline completo antes de implementar.
- A interface deve ser responsiva, acessível e testada em celular real.

## 7. Módulos e fronteiras

### Personagens
- Criador, edição, progressão/níveis, ficha, atributos, perícias, equipamentos, inventário, PV, recursos e magias.
- A ficha é fonte operacional de personagem; regras e itens do catálogo são referências, não substituem estado de inventário.
- Prioridade de migração após base de workspace, campanhas/autenticação e permissões.

### Iniciativa
- Ferramenta de combate do mestre, ligada a personagens e monstros reais.
- Alterações de PV/recursos devem aparecer rapidamente em todas as visões correspondentes.
- Não automatizar todo o combate nem transformar o produto em VTT.

### Encontros
- Preparação/organização de encontros pelo mestre e vínculo com a iniciativa.
- Evitar árvores, fluxos de loot e administração excessiva se não melhorarem a sessão.
- O código legado possui ideias/implementações locais ainda não validadas; **não copiar automaticamente**.

### Compêndio
- **Uma seção principal** para consulta com subáreas/filtros próprios: **Magias, Monstros, Itens e Regras**.
- Pesquisa e leitura rápidas, sem misturar consulta com operações de ficha.
- Catálogo geral disponível a visitantes onde direitos/permissões permitirem.
- **Bestiário para jogadores:** mestre controla por campanha uma permissão simples de visibilidade do catálogo; encontros privados e segredos do mestre nunca são revelados por essa opção.

### Enciclopédia da campanha
- Wiki ligada à campanha: **NPCs, cidades, locais, guildas/facções, eventos** e relações entre entradas.
- Mestre edita; pode manter notas secretas e publicar apenas conteúdo visível aos jogadores.
- Evitar formulários engessados e dezenas de categorias obrigatórias. Permitir links entre entradas.
- Respeitar RLS e visibilidade no servidor.

### Documentos
- Documentos e referências da campanha, compartilhados segundo permissões.
- Não misturar documentos de campanhas distintas.

## 8. Mestre, jogador e visitante

- **Mestre:** administra campanha, personagens conforme regras definidas, encontros, iniciativa, enciclopédia, publicação e permissões.
- **Jogador:** acessa suas fichas e conteúdo compartilhado, sem enxergar notas secretas, encontros privados ou dados administrativos do mestre.
- **Visitante (sem login):** consulta conteúdo geral permitido; acesso a iniciativas locais sem conta foi uma capacidade do app antigo, mas **precisa de decisão específica para a 2.0**, não assumir migração automática.
- Autorizações reais devem existir no Supabase/RLS; esconder botão não é proteção.

## 9. O que NÃO desenvolver agora

Não adicionar sem reavaliação explícita:
- sistema complexo de lojas, compras/vendas, moedas ou comércio;
- distribuição de loot e inventários coletivos complexos;
- combate totalmente automatizado;
- mapa tático/VTT e movimentação de tokens;
- chat interno;
- notificações complexas;
- offline completo;
- dashboards, configurações e modais sem utilidade clara;
- seletor de campanha repetido em cada página.

A existência de ideias no repositório antigo **não as transforma em requisitos aprovados**.

## 10. Qualidade, segurança e integração

- Verificar **build TypeScript, testes automatizados e fluxos entre módulos** em cada entrega relevante.
- Adicionar testes para: criação/fechamento/movimentação/restauração de abas; redimensionamento; troca de campanha; permissões; PV e inventário sincronizados; alterações simultâneas; navegação móvel.
- Distinguir claramente **revisão estática**, **build executado**, **teste executado**, **deploy concluído** e **teste manual**.
- Testar falhas de rede, atualizações concorrentes, operações repetidas, cache e mudanças de sessão.
- Preferir atualizações otimistas com rollback onde adequado; definir autoridade do servidor e estratégia de conflito antes de implementar.
- Evitar depender de `localStorage` para dados sensíveis ou de jogo compartilhados; usar somente para preferências/layout local com validação/versionamento.
- Preservar privacidade e acesso de campanhas em banco, Storage e API.
- Não executar migrações destrutivas, alterar produção, excluir dados ou conectar credenciais sem planejamento e autorização.

## 11. Sequência de entregas

1. **Base React/workspace:** tema, menu lateral, abas e restauração.
2. **Colunas verticais:** até três, mover abas e redimensionar.
3. **Refino de arquitetura e testes:** modelo do workspace separado, persistência robusta, acessibilidade, UX móvel inicial, CI.
4. **Campanha ativa, autenticação e permissões:** modelagem Supabase/RLS; isolar dados e workspace.
5. **Personagens:** migrar funcionalidade real com testes de domínio e sincronização.
6. **Compêndio, Iniciativa, Encontros, Enciclopédia e Documentos**, por fatias pequenas integradas.
7. **PWA instalável**, otimização e refinamento móvel.

**Estado conhecido na data desta nota:**
- PR #1: estrutura inicial — integrado.
- PR #2: colunas — integrado, CI reportou sucesso no PR.
- PR #3: workflow de GitHub Pages — integrado; usuário ativou Pages em Settings.
- PR #4: refatoração do workspace, testes de restauração e ajuste móvel — **aberto na última verificação**, não afirmar que foi mesclado.
- Workspace reescrito sobre FlexLayout (branch `feat/workspace-flexlayout`, ver seção 5). Substitui o arraste HTML5 manual; o PR #7 e as branches de remendos ficam obsoletos.
- A URL pública do Pages **não teve funcionamento confirmado** nesta conversa.
- Autenticação Supabase: camada de cliente pronta (PR A, ver seção 5); **não testada contra um projeto real** (faltam credenciais). Campanhas, RLS e convites ainda não existem; personagens e PWA também não.

## 12. Como continuar em novas conversas

1. **Ler este arquivo antes de propor arquitetura ou implementar funcionalidades.**
2. Conferir o código, PRs, Actions e status real do repositório; não inferir implementação apenas deste documento.
3. Identificar qual decisão está **aprovada**, qual é **proposta** e qual está **pendente**.
4. Seguir com entregas pequenas e revisáveis, sem esperar aprovação rotineira a cada passo; pedir decisão do usuário apenas quando necessária.
5. Atualizar este documento no mesmo PR quando uma decisão arquitetural ou de produto for alterada.
6. Ao comunicar progresso, ser **curto, direto e objetivo**. O usuário prefere agir/testar, não ler relatórios longos.
7. **Não gerar imagens para mockups de layout**: usar descrições curtas, esquemas textuais ou protótipos funcionais.

## 13. Atualização de estratégia do workspace (19/11/2026)

O usuário esclareceu que gostou de quase todas as interações do aplicativo de referência, inclusive **arrastar abas, redimensionar grupos e menu lateral**. A simplificação anterior foi excessiva. Não excluir recursos do workspace por serem difíceis de implementar. Preservar o comportamento da referência, exceto grupos empilhados um sobre o outro. Os PRs de remendos de drag-and-drop devem ser reavaliados antes de integrar: preferir uma substituição estrutural testada a acumular patches. Se a migração exceder a capacidade das ferramentas atuais ou apresentar erros repetidos, preparar prompt de transferência ao Claude Code com critérios de aceitação.

## 14. Questões ainda abertas

- Navegação móvel definitiva (hoje: grupo ativo + barra inferior; sem seletor de grupo além de botões simples).
- Arraste por toque no celular e acessibilidade por teclado das ações de mover abas (hoje só pelo menu de contexto com mouse).
- Modelo de entidades/tabs (seções versus fichas e registros específicos), com deep links.
- Estratégia de sincronização e migração segura do legado.
- Escopo exato de acesso visitante e de iniciativa sem login.
- Como publicar/mostrar previews e testar no celular em cada PR.
- Quais funções legadas devem ser reaproveitadas, reescritas ou descartadas após auditoria.

**Regra de ouro:** quando houver conflito entre este documento e uma decisão explícita mais recente do usuário, prevalece a decisão mais recente; atualizar o documento para refletir a mudança.

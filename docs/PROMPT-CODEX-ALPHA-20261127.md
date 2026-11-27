# Prompt independente para o Codex — Compêndio 5e 2.0 Alpha

Você assumirá o desenvolvimento do **Compêndio 5e 2.0 Alpha**. Execute o trabalho, não apenas um plano. Trabalhe em etapas coerentes, sem esperar “continue”, até um bloqueio real ou limite de execução. A sessão anterior foi encerrada a pedido do responsável; não há agente implementando a próxima correção.

## Identificação, estado e evidências

- Repositório: **Waudz/compendio-5e**.
- Produção: **https://waudz.github.io/compendio-5e/**.
- Supabase de produção: **gwcttjlxzelzjhbuitmi**.
- Prazo de lançamento: **12/12/2026**.
- Cadastro público autorizado. Já existem jogadores externos; **dados de produção não são descartáveis**.
- Main ao encerrar em 27/11/2026: **d0569111051b515d5cc3c16ea93b58d0ac673c92**. Esse commit foi publicado pelo Pages, run **45948379980**, ambos os jobs e deploy-pages aprovados. Última alteração funcional na main: **09e1c466c79b95c80a09596e6246dc7f36a2c672** (#164), após #163.
- **PR #165**: https://github.com/Waudz/compendio-5e/pull/165 ; branch **fix/alpha-jogadores-primeiro-acesso** ; HEAD **bb2aa0cf5ad2cf8ed4b2510a7f527af883664246** ; pronto para revisão, sem merge/publicação e sem conflitos na última consulta. Commits anteriores a79971f3059ae1996aa1081007ecb084c34fe973 e a85dd7876120e18efdda4ec22227d43ce12f8a97.
- Todos os workflows de bb2aa0c aprovados: Validar projeto **45996799154**, Supabase isolado **45996799173**, Preview **45996799148**, E2E **45996799143**. Base **160 aprovados/20 condicionais**; Quality/Creator aprovados (baterias a85dd78: Quality 88/32 condicionais, Creator 140/4); suíte unitária **1807/150 arquivos**; backend **19 cenários reais isolados**. Consulte os comentários do PR para evidências, não repita diagnósticos resolvidos.
- Branch de documentação **docs/transferencia-codex-alpha-20261127**, baseada em #165. Ela contém este prompt e o relatório final; consultar seu PR. Integrar #165 antes dela e retargetar a documentação à main quando aplicável, **somente com autorização**.
- Outros PRs abertos na inspeção: #117/#118 Actions, #119 dependências menores, #120 @types/node26. Não revisados nesta entrega; não ampliar o escopo para atualizá-los.
- Supabase confirmou 0017/0018/0019 e **0020 aplicada (20261127053526)**. Nenhuma migração nova criada/aplicada na sessão. Menção histórica à “0021 prevista” não comprova existência/aplicação.

Faça uma atualização curta do estado real de HEAD/PR/workflows antes de trabalhar; se nada mudou, use a investigação já registrada. Não considere commit, protótipo ou PR como funcionalidade publicada.

## Leitura obrigatória, pela decisão mais recente

1. `docs/TRANSFERENCIA-CODEX-20261127.md` e última seção de `docs/CONTINUIDADE-DESENVOLVIMENTO.md`.
2. `DECISOES-E-ARQUITETURA.md`, especialmente DEC-033 a DEC-036; decisões novas prevalecem sobre históricas.
3. `docs/ALPHA-JOGADORES-20261127.md`, `docs/ROTEIRO-TESTES-JOGADORES.md`, `docs/OPERACAO-AGENTES-ALPHA.md`.
4. Conforme a tarefa: docs/ESPECIFICACAO-NAVEGACAO-GLOBAL.md, ESPECIFICACAO-CONHECIMENTO-POR-CAMPO.md, ESPECIFICACAO-DESCOBERTAS-ALPHA.md, ESPECIFICACAO-EXPERIENCIA-JOGADOR.md, ESPECIFICACAO-ENCONTROS-INICIATIVA-LOOT.md, ESPECIFICACAO-PWA-BETA.md, COMPENDIO-CONHECIMENTO.md, PLANEJAMENTO-V2.md e STATUS-FUNCIONALIDADES-V2.md. Não reler tudo a cada pequeno ajuste.

## Próxima tarefa EXATA — P0: própria ficha do jogador no desktop

Relato em produção: ao abrir o próprio personagem no computador, jogador recebe só nome/raça/classe/nível e **“Os detalhes da ficha são privados do jogador e do mestre.”**

Esperado: dono abre/edita ficha completa; mestre acessa ficha conforme permissões vigentes; outros jogadores recebem apenas identidade pública autorizada. **Nunca tornar fichas públicas ou afrouxar RLS para corrigir.**

A sessão anterior parou na inspeção, sem correção de código e sem reprodução conclusiva:

- A mensagem vem de `CartaoPublicoGuiado` em **src/Personagens.tsx**. `FichaPagina` entra ali para guiado quando não reconhece dono nem mestre com API/campanha. Isso identifica o caminho exibido, não a causa raiz.
- **src/FichaRoteada.tsx** escolhe CriadorGuiado initialView se a ficha aparece em fichas.listar(campaignId); caso contrário vai para FichaPagina. Listagem com erro mostra aviso.
- **src/fichas.ts** e **src/registros.ts** mapeiam owner_id→ownerId; src/criador/repositorio.ts valida a campanha e decide somenteFicha pelo dono.
- **src/personagensCampanha.ts** combina notas e fichas pelo mesmo ID, calcula meu por ownerId. **CampaignHome.tsx** envia dono jogador à ficha e outros à carta. **compendio/Paginas.tsx / IdentidadePagina** tem Ver ficha para dono/mestre. Lista Personagens abre kind=ficha.
- Desktop usa App.tsx factory → Panel → CartaHost (`src/compendio/ConsultaCarta.tsx`); mobile usa Panel direto. CartaHost não intercepta ficha, só consultas narrativas. AuthProvider é comum em main.tsx; Workspace é keyed por user.id. Não concluir ausência de bug só pela inspeção.
- Consulta agregada de produção, sem PII: **7 fichas, 0 owners divergentes entre notes/character_sheets, 0 donos fora da campanha**. Não repetir essa consulta sem motivo. Isso não prova que a sessão que relatou o erro pertence ao dono do registro aberto.
- Fixtures e testes úteis: **src/criador/persistenciaServidor.test.tsx**, fichasMemoria.ts, registrosMemoria.ts, testUtils.tsx. Já há testes de mestre abrir ficha e outro jogador receber só cartão. Falta matriz de acesso do dono desktop.
- A branch local vazia fix/ficha-propria-desktop não contém implementação. Parta do #165 remoto (ou main se já integrado), crie uma branch de correção independente/PR dependente sem sobrescrever #165.

Primeiro reproduza com **dono, mestre e outro jogador**, desktop e celular, por **menu, Compêndio, lista e Início**, incluindo abas restauradas e troca de conta/campanha. Capture no teste usuário/owner/TabSpec sintéticos. Verifique reconhecimento do proprietário, UID autenticado, RLS, rotas, histórico e diferença identidade pública/ficha completa. Corrija a causa efetivamente encontrada e adicione regressões positivas/negativas. Se não reproduzir, não invente correção: documente e obtenha somente a informação mínima necessária, sem expor dados privados.

## Próxima P1: marcar todas as notificações como lidas

Depois do P0, adicionar botão **“Marcar todas como lidas”**, ícone de confirmação dupla Lucide, no topo da janela atual. **Preservar o visual aprovado**, sem reformular cartões, sino ou layout.

- Ocultar quando não há pendências.
- Atualizar contador imediatamente e persistir no banco.
- Afetar somente notificações do usuário autenticado no escopo atual da janela/campanha; respeitar autorização atual do conteúdo.
- Tratar rede/erro sem simular sucesso; preservar leitura individual.
- **Não excluir notificações.** Não marcar como lidas notificações de outros usuários/campanhas ou novas notificações que não pertenciam à operação.
- Testar recarga, outro dispositivo, chegada de novas notificações, falha de conexão e troca de usuário/campanha durante requisição.
- Começar em **src/compendio/Notificacoes.tsx** (NotificacoesProvider, feed, scope, seen) e **src/compendio/conhecimento.ts** (API feed/seen), depois verificar SQL/policies existentes. Nenhuma implementação iniciada. Não presumir que precisa migrar antes de inspecionar o contrato atual.

## O que #165 já entrega — NÃO reimplementar

Cadastro aberto no cliente com confirmação/reenvio, recuperação e convite preservado (main anterior ainda recusava antes de chamar SDK). Nome editável em profiles, erro/sucesso, preservação de edição durante requisição/saída e participantes montados atualizados; sem alterar nomes dos personagens. Alteração de e-mail por Auth com confirmação e senha existente.

Menu responsivo compartilhado, mobile sem segundo botão no topo, Menu inferior independente do destaque da página; grupos e ações por papel/campanha; sair e versão. Configurações separadas com tema já salvo e Sobre com fase Alpha, versão única de package.json, créditos, licenças, GitHub e aviso de fãs. Rota `secao:meus-personagens` filtra o dono também no desktop. Menu respeita confirmação de alterações não salvas acima dele.

Arquivos: auth.ts, AuthGate.tsx, AccountPanel.tsx, profiles.ts, CampaignPanels.tsx, GlobalMenu.tsx, version.ts, Mobile.tsx, App.tsx, Panel.tsx, workspace.ts, style.css; testes associados; scripts/alpha/prepare-local.py e run-local.mjs; README/decisões/continuidade/roteiro.

O helper e2e/fixtures.ts já foi corrigido em bb2aa0c: esperar os atalhos fixos da barra inferior após F5/auth; não voltar a usar count() instantâneo nem procurar Iniciativa/Compêndio no menu. Não aumentou timeout/retries ou enfraqueceu asserções.

## Escopo restante aprovado para testes Alpha

### Menu, Minha conta, Configurações, Sobre — P1

Preservar navegação inferior: mestre **Início/Anotações/Iniciativa/Compêndio/Menu**; jogador **Início/Anotações/Ficha/Compêndio/Menu**. Manter ocultar barras ao descer/exibir ao subir, sino, retorno e campanha; só página correspondente ativa, Menu distinto. Desktop acesso no cabeçalho, mesmo componente responsivo, workspace/histórico/grupos preservados.

Menu mestre: Campanha → Gerenciar campanhas, Personagens, Diário, Encontros, Ver como jogador **se houver suporte global real**; Conta e preferências → Minha conta, Configurações, Sobre; rodapé → Sair/versão. Jogador: Minhas campanhas, Meus personagens, Diário; mesmas conta/preferências/rodapé. Não exibir indisponíveis/duplicados. A prévia atual é por registro do Compêndio; #165 não inventou prévia global. Toque acessível, compacto, divisores discretos, ícones/tipografia consistentes, X/fora/Escape/Voltar mobile, rolagem interna, sem sobrepor barras.

Minha conta é **parcial**: falta adicionar/alterar/remover **foto de perfil**, reaproveitando editor de imagens se adequado. Esquema real profiles só tem id/display_name/created_at; UPDATE apenas display_name por RLS própria. Preparar contrato de avatar/Storage/migração não destrutiva e testes antes de expor upload; **não usar identidade/retrato do personagem como perfil de conta**. Nome deve refletir em participantes; e-mail com confirmação segura; senha/reset segundo método Auth; exibir método quando relevante; feedback claro. Cada usuário edita só seus dados, sem painel administrativo.

Configurações só reais: tema claro/escuro/sistema e preferências existentes; notificações apenas se suporte funcional já existir. Preservar valores salvos. Sobre simples: nome/versão/fase Alpha/descrição/créditos/licenças/GitHub/aviso de fãs; não duplicar fonte de versão. Essas partes básicas já estão em #165.

### Novas Anotações do jogador — P1, ainda NÃO implementadas

- Inicial **Minhas anotações**, lista simples por última edição; documentos sem limite artificial de quantidade; título editável e conteúdo próprio; tela cheia no celular.
- Reutilizar **BlockNote/EditorLazy/PageEditor** e infraestrutura existente de registros/permissões; texto, títulos, listas, checklists; controles confortáveis e sem excesso no celular.
- Criar, renomear, editar, excluir com confirmação. Sem quadros/cartões/colunas, coleções/pastas/tags/grade.
- Primeiro acesso mostra lista, **não abre último documento automaticamente**. Alternar temporariamente para Ficha/Compêndio e voltar preserva documento e rolagem. Voltar retorna à lista, respeitando navegação global.
- Autosave, sincronização entre dispositivos, recuperação de falha de conexão, concorrência sem sobrescrita silenciosa; usuário + campanha ativa; **privadas por padrão e inacessíveis ao mestre e a outros jogadores também pela API**.
- Preservar todas as notas/quadros anteriores, sem migração destrutiva. Não reformular Anotações do mestre, criar segundo editor/sistema, biblioteca central, menções universais, colaboração ou compartilhamento novo sem regras definidas.
- Documentar estrutura definitiva e testar CRUD, autosave, recarga/rede/conflitos, privacidade/isolamento e outro dispositivo; incluir no roteiro.

### Primeiro acesso e campanha — P0/P1

Testar cadastro, confirmação de e-mail quando exigida, login, recuperação, sessão persistente/expirada, convite e associação correta, criar campanha quando aplicável, alternar campanhas/contas, sair/entrar novamente, estados vazios sem campanha/personagem e permissões por papel. Uma campanha → seleção automática; várias → última válida. Falha de rede nunca significa ausência de campanhas. Não conceder acesso privado só por criar conta. Próximo passo claro, sem mensagens técnicas/erros silenciosos/botões fictícios.

### Criador, ficha e inventário — P0 de dados, P2 de completude

Consultar **#96/#99/#100** e código antes de mexer. Recuperação local contínua e preservação de edições durante save **já existem**; não reimplementar cegamente. `novoRascunho` ainda predefine fighter/hill-dwarf/acolyte: #100 permanece real. Requer contrato de escolhas ausentes no motor, não só limpar selects.

Validar criação zero → raça/classe/origem → atributos → perícias/proficiências → características → magias → equipamentos de classe/origem/quantidades/dinheiro → identidade pública/retrato → revisão → salvar/reabrir. SRD **2014** padrão, validar todas as opções atualmente oferecidas, cálculos de atributos/modificadores/proficiência/PV/CA/perícias/espaços, sem inventar regras ou ampliar catálogo não licenciado.

Sem raça/classe/origem escolhida automaticamente; não aplicar regras de classe ausente. Avançar etapas sem exigir opcionais e avisar obrigatórias. Salvar rascunho incompleto com pendências. Preservar estado em troca de etapa/aba/foco, minimização, recarga/remount e retorno. Resposta antiga de save não sobrescreve edição mais nova nem marca alterações posteriores como salvas. Tratar rede e concorrência, preservar fichas/históricos, não duplicar equipamentos ao trocar escolhas (inclusive símbolo do Acólito em #96).

Ficha: abrir/editar/salvar, identidade/retrato, PV atuais/temporários, condições, habilidades/recursos, magias, inventário/equipar/usar/remover/quantidades/moedas, nível 1–20, recarga/outro dispositivo; preservar estrutura visual aprovada. Inventário é submenu da ficha. Mundanos pesquisáveis conforme regras; mágicos restritos controlados pelo mestre, sem adição livre pelo jogador. Validar entrega/revelação/identificação já implementadas, não ampliar seu escopo agora. Ficha sempre pertence à campanha, sem biblioteca pessoal independente.

### Integração e pendências de interface — P2

Usar **mestre e dois jogadores distintos**: convites, personagens independentes, mestre vendo fichas, outros vendo só identidade autorizada, privados protegidos, PV/condições ficha↔Iniciativa, atualização entre aparelhos, Compêndio autorizado/revelação, Diário/Anotações e isolamento entre campanhas. **Iniciativa/Encontros/Combate só mestre na UI, API e banco.**

Após #164 continuam relatados: abas/botões/status da ficha fora do eixo da largura do conteúdo (ficha.css: ficha-subnav/ficha-salvamento); vínculos personagem/local separados de NPCs, relações tipadas/residência/naturalidade/inversas Habitantes sem duplicar (relacoes.ts/VisaoRegistro.tsx); mestre editar informações de vínculos/identidade da campanha respeitando campos privados do dono (AbaIdentidade, CriadorGuiado, repositorio.ts, fichas.ts, RPC save_guided_character; migração futura só preparada); dois grupos com controles duplicados (App.tsx renderSet; reabrir aba/tela cheia uma vez à direita, histórico/nova aba/fechar por grupo). Corrigir só o que ainda se reproduzir, incluindo Voltar/Avançar/tela cheia/F11.

Navegação vigente: clique interno substitui aba atual; menu lateral abre/foca seção; sem criar grupo automaticamente; máximo dois grupos; histórico independente preservando pesquisa/filtros/visualização/rolagem/estado e edição. Contexto exatamente nova aba no mesmo grupo → novo grupo/oposto → abrir na atual; Ctrl+clique/meio, Alt+setas, voltar/avançar/navegador, reabrir fechadas, arrastar/fixar, redimensionar, tela cheia. Mobile sem split, gestos/barras preservados. Sidebar recolhida ~48px, azul/logotipo oficial, faixa única compacta ~34px por grupo, sem quebra de palavras, reticências/tooltips/rolagem; não redesenhar sem necessidade. DEC-034 permite cartas narrativas no desktop e página mobile; ficha técnica separada. Não voltar à navegação histórica de split automático.

### Segurança/Supabase e roteiro — P0/P3

RLS/Storage/permissões reais; APIs não entregam campos privados/desconhecidos; conhecimento coletivo por campanha, por campo/imagem/vínculo, revelação explícita, vínculos secretos ocultos nos dois sentidos. NPC pode ser só alcunha; imagens desconhecidas com interrogação; níveis do bestiário são presets ajustáveis, estatísticas técnicas só mestre. Descoberta referencia item canônico sem duplicar/conceder/revelar automaticamente; conhecimento persiste após perder/consumir/vender/destruir item. Catálogo único compartilhado por Compêndio/criador/ficha/inventário, SRD2014/licenças/IDs/traduções auditados. Não misturar 2024 ou material protegido.

Testes de escrita **somente isolados**, nunca produção como alternativa. Stack descartável no workflow scripts/alpha já valida 19 cenários reais, JWT expirado/refresh, RLS/Storage, concorrência, persistência e isolamento. Nova mudança exige testes proporcionais, não releitura completa sem motivo. Metadados de produção foram inspecionados; advisors e limites no relatório. Não afirmar que mock/PGlite/demo/CI provam caixa postal, celular físico ou produção atual.

Roteiro português já existe em docs/ROTEIRO-TESTES-JOGADORES.md: conta/nome/foto quando disponível, convite, criação/recuperação de rascunho, salvar/reabrir/editar ficha, recursos/magias, inventário, Compêndio, Diário, Anotações/autosave/privacidade/recarga/aparelhos quando entregue, nível, logout/login e outro aparelho. Marcar indisponíveis; atualizar ao publicar. Relatos diretamente ao responsável; organizar em issues, **sem sistema interno de feedback, chamados, painel ou telemetria adicional**.

## Restrições, testes, publicação e encerramento

- **Não mesclar main, publicar/deploy, aplicar migração/SQL/policies de produção, excluir/sobrescrever dados reais ou introduzir custos obrigatórios sem autorização explícita e específica.** Preparar branches/PRs/migrações não destrutivas e rollback é permitido. Não alterar Compêndio 1.0 ou Assimilação.
- D&D5e2014 primeiro, gratuito, campanha obrigatória para fichas/catalogo, sem biblioteca pessoal de personagens, inventário dentro da ficha, combate exclusivo do mestre, notas privadas, fonte canônica única, loot conforme decisão mais recente, Beta controlada sem reverter a autorização atual de cadastro público. PWA depois do núcleo/antes da abertura pública; push não prioritário.
- Recuperação das imagens pesquisadas/adicionadas ao Compêndio1.0 continua obrigatória: não perder acervo, não alterar origem; preservar o planejamento/auditoria existente. Assimilação permanece independente e será sistema futuro; dados3D/galeria global colaborativa/referências futuras não desviam esta rodada. Biblioteca central, menções universais, novas funcionalidades de encontros, reformulação do mestre, novos sistemas/PWA adiados.
- Faça commits/PRs coerentes e incrementais, verifique conflito/concorrência antes de editar; use classificação de impacto existente. Testes focados durante desenvolvimento e bateria completa quando pronta, sem execuções redundantes nem enfraquecer testes para CI verde.
- Neste executor antigo não havia navegador local/Docker; num executor novo confira capacidade uma vez. `npm ci`, build, unitários/integração, tipos Playwright, E2E mobile/desktop e Supabase descartável conforme impacto. Não chamar produção para suprir falta de ambiente.
- Atualize README/decisões/continuidade com arquivos, SHAs/PRs, testes realmente executados, falhas, migrações e próximo passo exato. Diferencie implementado/testado/integrado/publicado. Não use percentuais arbitrários nem declare Alpha pronta sem contas/fluxos reais, persistência, privacidade, responsividade e ausência de críticos.
- Quando houver entrega pronta, solicitar a autorização protegida necessária com evidência concreta; não perguntar “continuar”. Se atingir limite, commit/push **todo progresso** e handoff preciso; nunca deixar trabalho importante apenas local.

**Comece pela reprodução e correção do P0 da própria ficha no desktop. Não inicie novas funcionalidades de encontros, biblioteca ou PWA.**

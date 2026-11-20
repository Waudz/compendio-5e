# Pendências consolidadas — Compêndio 5e

> Atualizado em **20/11/2026**. Registro vivo de decisões recuperadas de conversas anteriores e da documentação do repositório. **Não é prova de implementação**: para cada item, confirmar código, migrações, CI e uso real antes de marcar como concluído.
>
> Fontes complementares: [Decisões e arquitetura](../DECISOES-E-ARQUITETURA.md), [Planejamento V2](PLANEJAMENTO-V2.md), [Navegação](NAVEGACAO-ABAS.md), [Notas e permissões](NOTAS-PERMISSOES.md), [Fundação de registros](FUNDACAO-REGISTROS.md), PRs e histórico das conversas. Em caso de divergência, **decisão mais recente prevalece**, sem apagar a anterior; revisar os documentos antigos ao implementar.

## Legenda
- **[x]** confirmado por PR mesclado / código; não implica teste visual em produção.
- **[~]** parcial, protótipo, teste pendente ou código em PR aberto.
- **[ ]** pendente de implementação.
- **[?]** decisão ainda aberta.
- **[H]** histórico/decisão substituída, mantida para rastreabilidade.

## 0. Situação do repositório e prioridades atuais
- [x] Repositório novo **Waudz/compendio-5e**, React + TypeScript + Vite, GitHub Pages e Supabase; projeto legado `rastreador-dnd` **não deve ser alterado**.
- [x] Login obrigatório no projeto novo; **sem modo visitante em produção** (substitui proposta antiga do aplicativo legado). Modo demonstração só no desenvolvimento.
- [x] Navegação desktop por abas e até três grupos/colunas, fixação, restauração de layout, proteções de alterações não salvas; celular navega por telas, **sem grupos/abas superiores visíveis**.
- [x] Anotações/Planejamento com guias, quadros, colunas, seções e cartões; editor BlockNote; menu de guias e fixação; várias melhorias dos PRs #44–#60.
- [x] PR #62 mesclado: CSS responsivo para guias em painéis estreitos. **Conferência visual ainda pendente**; não assumir que resolveu definitivamente os cortes.
- [~] Abrir múltiplas instâncias de Anotações pelo menu lateral: PR #63 substituído pelo **#64**, ainda pendente de validação/merge na última conferência. Diferenciar abas superiores, guias internas e grupos; não duplicar os dados.
- [~] PR #61 (base de links internos) foi **fechado sem merge**, deliberadamente adiado.
- [ ] Prioridade imediata: concluir múltiplas instâncias/grupos, persistência e sincronização; corrigir responsividade; depois títulos opcionais, lixeira/menus, imagens, referências, links entre notas e encontros.
- [ ] Após cada PR: TypeScript, build, testes, revisão de conflito, teste visual real (desktop dividido 50/50 e 30/70, celular), só então merge. CI verde não garante UX correta.
- [ ] Atualizar os documentos antigos de planejamento, que ainda descrevem telas/recursos como inexistentes; **não apagar decisões históricas**.

## 1. Anotações — roteiro aprovado (prioridade alta)

### 1.1 Abas, guias e grupos
- [~] Cada guia interna (ex.: **Sessão 5**, **NPCs aleatórios**) deve poder ser aberta em **nova aba superior** e **outro grupo**, inclusive lado a lado. Menu contextual na guia interna: **Abrir em nova aba / Abrir em outro grupo**. Não confundir **fixar guia interna** com **fixar aba superior**.
- [~] Abrir Anotações em **nova aba** ou **nova aba fixada** diretamente pelo menu lateral deve criar uma instância distinta, não apenas focar a seção existente (#64).
- [ ] Cada painel guarda guia ativa, posição de rolagem e estado de edição independentes; mesmo registro mantém identidade única; alterações entre instâncias sincronizam sem sobrescrever silenciosamente. Testar concorrência, perda de acesso, troca de campanha e restauração.
- [ ] Painel largo: guias visíveis; médio: priorizar fixadas e ativa **se houver espaço**; estreito: **guia ativa sempre visível**, demais no menu **•••**, com pesquisa e indicador de fixação. Evitar guias cortadas e barras de rolagem horizontais duplicadas. O menu ••• deve continuar acessível no celular.
- [ ] Conferir funcionamento com muitas fixadas, títulos longos, painel de 220–440 px, 50/50, 30/70 e múltiplos grupos; o botão **+** deve permanecer acessível.
- [ ] Menu contextual abre perto da guia clicada; fechar `×` só a guia ativa; renomear por duplo clique/Enter/Esc; numeração de **Nova guia N** sem novas duplicações. Recursos existentes: manter e testar regressões.

### 1.2 Cartões e seções
- [ ] **Título opcional nos cartões**: permitir cartão apenas com texto, imagem ou referência; não impor “Novo cartão” como título definitivo; placeholder discreto e ação para adicionar título.
- [ ] **Seções**: título exibido por padrão, mas permitir ocultar/deixar sem título; identificador acessível em busca/menus quando não houver título visível. Confirmar a interação exata antes de implementá-la.
- [ ] Lixeira/excluir discreto: **hover no desktop**, menu **••• no celular**; padronizar menus, alça de arrastar, foco/teclado e confirmações destrutivas conforme conteúdo.
- [ ] Preservar criação rápida de cartão, cartões vazios, colunas/seções, arraste, ordem e o editor inline; não criar formulários obrigatórios para notas comuns.
- [ ] Corrigir eventuais nomes duplicados já existentes separadamente, sem renomear dados do usuário automaticamente.

### 1.3 Imagens
- [ ] Inserir **imagens no corpo** dos cartões, entre parágrafos, não somente capa: upload, visualização, zoom, substituição e remoção; suporte a celular e estados de erro.
- [ ] Habilitar mídia com segurança no BlockNote/visualizador; hoje há restrições de mídia no editor e formato salvo. Planejar Supabase Storage **privado**, RLS espelhando permissão de leitura, limites, compressão, referências estáveis, limpeza de órfãos e sem URL pública.
- [ ] Garantir que imagem não degrade a carga de quadros grandes; lazy loading e miniaturas quando apropriado.

### 1.4 Referências e links — decisão mais recente
- [ ] **Manter `/` nativo do BlockNote exatamente como está**; **não adicionar novos comandos personalizados ao slash menu nesta etapa**. Ideia antiga de `/monstro`, `/imagem` etc. foi substituída.
- [ ] Digitar **`@`** abre busca contextual de **monstros, itens, magias, personagens/NPCs e outras anotações**; `@dragão` filtra e permite selecionar a ficha correta.
- [ ] Selecionar texto → ação **Vincular** na barra contextual → buscar referência, **preservando as palavras selecionadas**. Editar/remover vínculo depois.
- [ ] Links internos por **tipo + ID estável**, não por título/URL improvisada; renomear não quebra. Prévia no painel/modal sem perder o texto; opção de abrir ficha completa em nova aba/grupo. Visualizador leve dos cartões também precisa renderizar links.
- [ ] Links entre **cartões, seções e guias**; respeitar RLS dos dois lados, sem vazar existência/título em busca, prévia, backlink ou histórico. Links externos continuam possíveis, mas não são a identidade do registro.
- [ ] Não implementar `*dragão` como atalho: `*` é reservado à formatação; `@` foi escolhido.

### 1.5 Encontros nas Anotações
- [ ] Inserir **encontro como recurso/bloco dentro do cartão comum**, sem exigir tipo rígido de cartão. Nome, descrição, participantes, monstros/quantidades do bestiário, NPCs/PCs quando cabível.
- [ ] **Iniciar combate** transfere participantes à Iniciativa existente; encontro salvo é reutilizável e não cria segundo motor de combate. Definir snapshot congelado da composição no início do combate para não alterar encontros preparados.
- [ ] Permissões de mestre/jogador e segredo de monstros conforme decisão D7 (ainda aberta).

## 2. Navegação e experiência de uso
- [x] Navegação mestre definida: **Início · Anotações · Iniciativa · Compêndio · Menu**.
- [x] Navegação jogador definida: **Início · Anotações · Ficha · Compêndio · Menu**; **Inventário dentro da Ficha**, não como item principal.
- [~] Implementação de cada tela/rota e comportamento real dessas barras: verificar no aplicativo; decisão de menu não prova funcionalidade.
- [ ] Gestos entre subáreas: arrastar horizontalmente dentro de um módulo pode navegar para submenu relacionado (ex.: Ficha → Inventário), **sem interferir com rolagem, editor, arraste de cartão ou gestos do sistema**.
- [~] Inspirar-se no Letterboxd: menus superior/inferior do celular ocultam ao rolar para baixo e retornam ao subir; skeleton durante carregamento; evitar flicker e exibição temporária de página errada. Há implementação parcial; validar todas as telas.
- [ ] Padronizar navegação de registros por clique, Ctrl/Cmd+clique, botão do meio, clique direito, toque prolongado, menu **Abrir nesta aba / em nova aba / fixada**; não apenas menu lateral (ver NAVEGACAO-ABAS §6).
- [ ] Conferir descoberta de **Fixar/Desafixar aba já aberta**, acesso por teclado e celular; não assumir bug antes de reproduzir.
- [ ] Manter layout sem sobreposição em meia tela, menus compactos, títulos truncados somente quando inevitável, skeleton com retry e boa performance em rede lenta.
- [ ] Ajustes visuais pendentes do legado, **reavaliar pertinência no projeto novo**: ícones de tamanho consistente, cabeçalho móvel fixo, botões do topo em uma linha quando couber, reduzir convite excessivamente alto, padronizar fundos/molduras/pop-ups, foto de perfil e avatar na lista de jogadores.

## 3. Campanhas, identidade, contas e segurança
- [x] Projeto novo: autenticação Supabase, e-mail, recuperação/troca de senha, sessão persistente, mestre único (criador), convites e isolamento por campanha; verificar em contas reais.
- [ ] Auditoria de RLS em todas as tabelas, inclusive **impedir que o dono altere campos exclusivos do mestre dentro de JSON**; testes adversariais com múltiplas contas e privilégios.
- [ ] Testar confirmação, recuperação, troca de senha, persistência, logout, perda de internet, reentrada, convites revogados/expirados, Android/PWA real e acesso após remoção da campanha.
- [ ] Revisar política de exclusão de conta versus retenção de histórico de campanha (**decisão aberta antes de implementar exclusão**).
- [ ] Cadastro somente por convite: **adiado**, não impor agora. Login obrigatório é decisão vigente; visitante do sistema antigo **não migrar automaticamente**.
- [ ] Campanha com regras **2014 OU 2024**, sem misturar; **implementar inicialmente só 2014**. Conversão futura com preservação de dados e confirmação; não habilitar 2024 parcialmente.
- [ ] Campanhas: seletor persistente/discreto, ações compactas, entrar com código via **+**, compartilhar/gerenciar via **•••**, sem ocupar muito espaço; confirmar quais partes já estão entregues.
- [ ] Segurança de uploads, Storage privado, limites, sanitização de conteúdo, RLS e não confiar no papel informado pelo cliente; migrações com rollback e testes; **nunca aplicar migração no Supabase real sem autorização explícita**.
- [ ] Revisar controle de permissões de anotações pessoais, do mestre e compartilhadas; links não concedem leitura; autor continua dono após sair de campanha.
- [?] **D7**: quanto da ficha de monstro jogadores podem ver — completa, só descritiva ou configurável por campanha. Até decidir, **não expor estatísticas por links/prévias**.
- [?] Exclusão de conta e histórico; comportamento de registros rápidos (editável vs append-only), prioridade de atalhos móveis e outras escolhas descritas em PLANEJAMENTO-V2/NOTAS-PERMISSOES.

## 4. Personagens, ficha, inventário e regras
- [ ] Biblioteca pessoal de personagens com criação/edição/exclusão lógica, restauração e vínculos a campanhas; personagem pertence ao usuário; mestre só edita **estado da participação**, nunca ficha pessoal alheia.
- [ ] Estado independente por campanha; ao vincular, copiar atributos/equipamentos não monetários e **zerar carteira da participação**; saída/remoção arquiva, reentrada restaura sem sobrescrever; morte/aposentadoria preservam histórico.
- [ ] Visibilidade: dono e mestre veem ficha completa; demais jogadores nome, retrato, nível e PV somente se permitido por campanha.
- [ ] Inventário **dentro da Ficha**; equipamentos iniciais por classe (não kit universal); agrupamento de itens idênticos somente quando propriedades/equipado coincidirem; edição de classes/equipamentos existentes sem bloqueio circular.
- [ ] Cinco moedas 2014 (PC, PP, PE, PO, PL); campanha ativa **PC/PP/PO por padrão**, outras configuráveis; saldos nunca somem ao desativar moeda; conversão somente confirmada, auditada e reversível.
- [ ] Catálogos e motor de regras 2014: classes, subclasses, raças, antecedentes, talentos, multiclasse, atributos, perícias com atributo visível, progressão, conjuração, equipamentos, condições, descansos e regras gerais.
- [ ] Fichas com retratos padronizados, botões coerentes, efeitos e alterações de PV rápidos e animados em todas as visualizações pertinentes.
- [ ] Revisar suporte a concessões especiais de personagem (ex.: Lydia), grimórios privados e inventários de NPCs, monstros e baús; funcionalidades do legado são **referência**, não confirmação de implementação no novo projeto.
- [ ] Escolher manualmente ícones de classes/escolas de magia no **game-icons.net**; não aplicar automaticamente versões redesenhadas/recoloridas; manter paleta e tamanhos consistentes.

## 5. Compêndio, Enciclopédia e bestiário
- [ ] Biblioteca universal **SRD 5e 2014**, somente leitura para contas autenticadas; separar dados descritivos/mecânicos e conteúdo pessoal/campanha; cópia independente para personalizações.
- [ ] Bestiário, magias, itens, regras, personagens/NPCs, locais, facções, eventos e referências cruzadas com busca segura; suportar **lista e grade** como preferência de visualização, reaproveitando padrões do app antigo quando fizer sentido.
- [ ] Padronizar layout das magias fora das fichas, sidebar do bestiário, pesquisa e comportamento em telas estreitas; testar imagens e ausência de dados de contas novas.
- [ ] Garantir que nomes em inglês/português e referências SRD sejam identificáveis sem cadastrar conteúdo protegido indevidamente; conteúdo personalizado não herda visibilidade do universal.
- [ ] Preparar referências entre Enciclopédia, bestiário, Anotações e Iniciativa; links estáveis, backlinks filtrados por RLS.

## 6. Encontros, Iniciativa e loot
- [ ] Encontros preparados, participantes com quantidades, dificuldade, cenário e notas vinculadas; mestre decide o que revelar.
- [ ] Iniciativa avulsa e iniciada de encontro, sem duplicar motor; PV de PC na participação, PV de monstro no combatente; atualizações rápidas, animações consistentes e sincronização em tempo real segura.
- [ ] Monstros ocultos e informações secretas para jogadores; efeitos/condições avançados, ordem, descansos e recursos conforme regras.
- [ ] Loot planejado/encontrado/distribuído; distribuição confirmada pelo mestre, transação atômica e auditada, sem entregar automaticamente por morte de monstro; itens e moedas apenas segundo regras da campanha.
- [ ] Investigar necessidades do legado: exportar/importar combate, usar personagem em combate sem abrir app móvel no desktop, inputs de d20 sem cortes, tamanhos de cartões e ícones padronizados.

## 7. Dados, notas, offline e PWA
- [~] Migrações `0001`–`0004` documentadas como aplicadas; **0005 e posteriores exigem conferência do estado real** antes de qualquer ação. Documentos de 19/11 podem estar desatualizados.
- [ ] Evoluir `notes` como armazenamento único, com conteúdo BlockNote estruturado, vínculos opcionais múltiplos e compartilhamento **explícito** (vínculo não transfere propriedade/acesso); compatibilizar `0005`, `0008` e `0009` sem vazamento.
- [ ] Histórico de versões append-only, desfazer, lixeira, recuperação, busca sob RLS, filtros/pastas/templates e exportação; evitar conteúdo perdido silenciosamente e resolver conflitos por versão.
- [ ] Definir ciclo de exclusão de páginas com cartões, registros rápidos e snapshots de encontros; não apagar automaticamente registros relacionados.
- [ ] Offline com IndexedDB por usuário/campanha, fila idempotente, conflitos explícitos, revalidação de acesso e limpeza de cache no logout; não prometer Realtime de notas sem auditoria.
- [ ] PWA instalável, sessão resiliente sem rede, splash/ícone minimalista dourado livro+chapéu, fundo transparente; nome completo **Compêndio 5e** e `short_name` **Compêndio** (decisão anterior, conferir implementação).
- [ ] Notificações futuras com app fechado e sino interno: definir escopo, opt-in, permissões, push/background, privacidade e custo antes de construir.
- [ ] Evitar cobrança: produto gratuito; avaliar custo de IA e infraestrutura antes de serviços pagos.

## 8. Documentos avançados — horizonte posterior
- [ ] Pastas, subpáginas, templates de RPG, editor em blocos, tabelas/Kanban, calendários, linhas do tempo, quadros/mapas de relações, anexos e exportação.
- [ ] Priorizar primeiro navegação, fichas, bestiário, iniciativa e Anotações funcionais; avançados entram gradualmente, sem recriar o editor ou banco paralelos.
- [ ] Busca universal, prévias e backlinks só com autorização efetiva; histórico não pode revelar conteúdo removido/revogado.

## 9. Decisões rejeitadas ou substituídas (não reabrir por acidente)
- [H] `/` customizado para links/imagens/encontros: **não**; manter slash do BlockNote; `@` e seleção de texto para vincular.
- [H] `*dragão` para buscar vínculo: **não**; usar `@`.
- [H] Cartões rigidamente tipados: **não**; cartão comum recebe texto/imagem/links; encontro é recurso especial.
- [H] Guias fixadas obrigatoriamente sempre visíveis em qualquer largura: **não**; ativa tem prioridade e ••• acessa demais.
- [H] Abrir outra aba de Anotações duplicando o quadro: **não**; instâncias independentes apontam ao mesmo registro.
- [H] Mover nota para campanha mudando `campaign_id` ou transferindo propriedade: **não**; vínculos/audiências separados.
- [H] Excluir personagem apagando histórico/notas: **não**; exclusão lógica, participações arquivadas.
- [H] Misturar regras 2014 e 2024: **não**; campanhas separadas, implementação 2014 primeiro.
- [H] Criar segundo motor de combate para encontros: **não**; integrar à Iniciativa.
- [H] Visitante sem login no projeto novo: **não**; somente demo em desenvolvimento.
- [H] Usar diretamente Supabase/repositório do aplicativo legado: **não**; preservar projeto antigo.

## 10. Checklist antes de declarar qualquer item concluído
1. Verificar se o código está **na main**, não apenas em branch ou PR; identificar commit.
2. Conferir build/TypeScript/testes e migrações/rollback quando aplicável.
3. Testar visualmente desktop, painéis estreitos, celular e interações de teclado/toque.
4. Testar conta mestre e jogador, campanhas distintas, acesso negado, exclusão e concorrência.
5. Atualizar este documento com **PR, data, resultado e limitações**, mantendo histórico.
6. Não confundir planejamento, demo local, PR aberto e produção publicada.

### Histórico de referência
- **19/11:** arquitetura, regras de campanhas, anotações, notas, segurança e navegação consolidadas nos documentos antigos; algumas seções estão defasadas.
- **20/11:** Anotações ganharam guias/quadros/cartões e navegação por abas (PRs #44–#60); #62 mesclado para responsividade; #61 fechado por adiamento; #63 substituído pelo #64 para múltiplas instâncias do menu lateral. Confirmar resultado atual do #64 antes de atualizar o status.
- Decisões recuperadas de chats anteriores incluídas neste documento, **sem alegar que todos os itens foram auditados no código**.

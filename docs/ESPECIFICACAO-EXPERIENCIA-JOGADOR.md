# Experiência do jogador e continuidade — 25/11/2026

Registro das decisões posteriores aos PRs #147 e #150. Não é autorização para implementar tudo imediatamente. Decisões explícitas abaixo prevalecem sobre propostas antigas conflitantes. Preservar dados, privacidade e comportamento aprovado. Consultar também ESPECIFICACAO-COMPENDIO-JOGADOR.md, ESPECIFICACAO-ENCONTROS-INICIATIVA-LOOT.md, DECISOES-E-ARQUITETURA.md e CONTINUIDADE-DESENVOLVIMENTO.md.

## 1. Navegação aprovada
- Jogador: Início, Anotações, Ficha, Compêndio, Menu.
- Mestre: Início, Anotações, Iniciativa, Compêndio, Menu. Iniciativa e encontros exclusivos do mestre.
- Inventário dentro da ficha. Não criar menu independente.
- Abandonar o nome Enciclopédia como área separada: usar somente Compêndio, com Campanha e Regras.
- Mobile: inspiração de comportamento no Letterboxd, não copiar identidade visual. Abas contextuais apenas em áreas com subseções úteis; pesquisa, detalhes de entidades e menu não precisam de abas. Permitir deslizar entre subseções quando pertinente. Barras superiores/inferiores escondem ao rolar para baixo e reaparecem ao subir, sem oscilar ou encobrir conteúdo.
- Alternar menus preserva a tela interna anterior: documento aberto, posição de rolagem e contexto. Exemplo: escrever anotação, consultar ficha, retornar à mesma anotação. Não confundir com abrir automaticamente a última nota em nova sessão.
- PC mantém workspace de até dois grupos, links internos no último grupo à direita, histórico Voltar, ficha em largura total quando há um grupo. Mudanças do workspace para notas do mestre serão discutidas depois.

## 2. Início do jogador — aprovado
- Capa em toda largura do painel, nome sobre a imagem, degradê inferior longo e suave inspirado no Compêndio 1.0; manter enquadramento/zoom e posição. Descrição opcional em toda largura, sem espaço vazio artificial.
- Todos os aventureiros autorizados, sem limite, carrossel ou seção exclusiva de Personagens no Início do jogador. Próprio personagem primeiro. Cartões com retrato quadrado arredondado, ícone de classe no canto (não revelar classe oculta), nome, classe/nível autorizados, nome do jogador menor e indicação Você. Sem PV, CA ou condições na vitrine do jogador. Grade adaptável à largura real do painel; referência mobile três colunas, ajustar quando necessário. Não esticar retratos indefinidamente.
- Clicar no próprio personagem abre a ficha; clicar em outro abre identidade pública no Compêndio, não ficha privada. Mestre mantém acesso autorizado à ficha real.
- Diário: prévia da última entrada, acesso ao Diário completo; no mobile passa à aba Diário; no PC abre no workspace. Clicar na entrada pode abrir diretamente seu conteúdo.
- Participantes recolhíveis, cartões uniformes, papel e identificação própria; sair pelo menu de reticências com confirmação.
- Mobile: apenas duas abas contextuais Início e Diário, com deslize. Não adicionar aba Personagens ao Início do jogador.
- PC: sem abas contextuais Início/Diário; descrição e aventureiros em largura total, abaixo Diário à esquerda e Participantes à direita (50/50), alinhados à esquerda, empilhar em painel estreito. Não usar limite global de 960 px nem alturas fixas artificiais.
- Não mostrar próxima sessão, missões/objetivos ou descobertas recentes na página inicial. Descobertas ficam no Compêndio e notificações.
- Seletor de campanha discreto; preservar isolamento e contexto. A criação de personagem diretamente no Início quando não há ficha é proposta, não decisão final.
- Referência histórica: Waudz/rastreador-dnd, campanha.html e js/campanha.js; a versão 1.0 tem capa com fade longo e abas Grupo/Encontros/Diário/Documentos. Não reproduzir literalmente as abas ou largura da 1.0.

## 3. Identidade pública — aprovado
Uma única entidade de personagem/ficha. Identidade pública é somente a apresentação aos outros, nunca uma segunda ficha ou alteração de atributos reais.
- Última etapa do criador oferece configuração opcional de como aparecer. Se não preencher, usar os campos públicos correspondentes da ficha; mesma apresentação no Início e Compêndio.
- Campos públicos: nome, alcunha, raça, classe, nível, descrição pública e retrato. Não divulgar mecânicas ou dados privados automaticamente. Campos não personalizados acompanham a ficha; personalizados permanecem até edição. Modelo técnico herdar/personalizar/ocultar é proposta de implementação, validar detalhes.
- Nome real obrigatório, alcunha opcional e independente, pode ser adquirida depois. Apresentação pública pode mostrar nome, alcunha ou ambos; quando ambos, nome em destaque e alcunha em itálico abaixo. Consistente no Início e Compêndio.
- UMA foto por personagem, compartilhada por ficha, identidade, Início, Compêndio, iniciativa e encontros quando aplicável. Alterar foto atualiza todos os usos autorizados. Não criar foto alternativa pública.
- Dono e mestre acessam ficha verdadeira; demais somente projeção autorizada. RLS/servidor deve garantir privacidade, inclusive acesso direto. Não duplicar registros, não perder perfis existentes.
- A lista unificada do #152 é correção intermediária; não significa que toda a identidade acima já foi implementada. A regra de publicação e transição de fichas antigas deve ser auditada antes de alterar dados.

## 4. Compêndio e descobertas
Manter especificação do #150, com atualização de nomenclatura: Compêndio é o único nome da área.
- Campanha: Personagens, Bestiário, Locais, Organizações, Descobertas.
- Regras: Raças, Classes, Origens, Talentos/habilidades, Magias, Itens, Regras. Armas/armaduras e tipos são filtros internos, não categorias adicionais. Sem aba Todos misturando Campanha/Regras.
- SRD 2014 livre para consulta; magia personalizada revelada em Magias. Itens mundanos consultáveis; mágicos só com conhecimento autorizado, sem livre adição ao inventário.
- Bestiário: quatro níveis coletivos (nome; nome+descrição; imagem; completo). Evolução individual futura.
- Descobertas: itens mágicos/de missão, mapas, cartas, livros, documentos e outros; filtros internos, sem menu Documentos separado. Descoberta narrativa pode existir sem item físico; item pode vincular documento. Reutilizar infraestrutura de registros após auditoria.
- Item mágico conhecido aparece também em Regras > Itens, mesma referência. Separar posse, identificação e conhecimento. Conhecimento individual por personagem após identificação/revelação é padrão PROVISÓRIO, usuário consultará jogadores. Mestre pode revelar ao grupo; compartilhamento posterior pelo jogador é desejado, permissão exata pendente. Conhecimento persiste após perda/transferência/venda/destruição; novo personagem não herda automaticamente.
- Mostrar Em posse de [personagem] automaticamente se houver portador autorizado; omitir linha inteira se não houver. Não mostrar Sem portador nem expor inventário/portador secreto.
- Notificações internas de novo conhecimento (criatura, aumento de nível, item, documento, NPC/local/organização); apenas destinatários que ganharam acesso, leitura individual e link autorizado. Não notificar correção textual, transferência, derrota repetida ou cadastro secreto. Sino e indicador discreto no Compêndio; push futuro. Não colocar feed de descobertas no Início.

## 5. Anotações do jogador — estrutura aprovada
Esta decisão substitui a proposta anterior de abrir automaticamente a última anotação e de usar Coleções/Tags.
- Ao iniciar a conta, documento inicial Minhas anotações criado automaticamente. Definir tecnicamente o provisionamento idempotente e o vínculo com campanha sem duplicação; não misturar dados entre campanhas.
- Entrada normal da área apresenta lista de documentos, mais recentemente editado no topo. Não abrir automaticamente o último editado. Proposta: nova sessão começa na lista; durante a sessão preservar a tela aberta ao trocar menus.
- Jogador pode criar quantos documentos quiser; cada documento é um texto em tela cheia para escrever. Sem Coleções, pastas, tags ou grade de documentos. Não exigir organização para usar.
- Lista com título, prévia breve, data de edição, busca, novo documento e menu de ações (detalhes de ações a definir). Editor abre por toque/clique, com voltar à lista, título, texto e salvamento automático. Privadas por padrão; compartilhamento futuro a definir.
- Ao alternar para Ficha/Compêndio e voltar, manter o mesmo documento e posição. Não reiniciar navegação interna nem perder edição.
- Ferramentas exatas do editor ainda NÃO definidas. Protótipo mostrou texto, formatação, imagem, links, listas, desfazer/refazer; são propostas, não requisitos finais. Tela cheia e escrita simples são essenciais.
- Inspiração: notas da ficha de Assimilação, efetivamente utilizadas pelos jogadores. AFFiNE inspira a experiência visual do mestre, não impor sua complexidade ao jogador.

## 6. Anotações do mestre — ADIADO
Não alterar a estrutura atual até discussão específica. AFFiNE como referência: árvore/organização de documentos, quadro visual desktop com blocos livres (textos, imagens, referências de RPG), documento linear mobile, modo tela cheia. A hipótese de dois modos do mesmo documento com ordem de leitura independente, blocos vinculados a monstros/NPCs/magias/itens/encontros/dados, coleções/pastas e investigação do BlockSuite é proposta não aprovada. Tags descartadas na discussão. Necessita revisão do workspace PC. Não implementar quadro, editor novo ou colaboração antecipadamente.

## 7. Ficha e menus — ainda a definir
Próxima conversa começa pela ficha, aproveitando o que já existe. Proposta não aprovada: três subseções Personagem (identidade, atributos, perícias, PV, CA), Habilidades (classe, talentos, ataques, magias), Inventário (equipamento, dinheiro, identificação/sintonização). Definir organização PC/mobile e progressão antes de implementar.
Menu jogador proposto: Minha conta, Minhas campanhas, Criar personagem, Rolador de dados, Configurações, Ajuda, Sobre, Sair. Menu mestre proposto: Minha conta, Minhas campanhas, Gerenciar campanha, Ver como jogador, Rolador de dados, Configurações, Backup/exportação, Ajuda, Sobre, Sair. Nenhum menu final aprovado. Início do mestre também pendente; proposta de abas Início/Diário/Personagens/Encontros no mobile não aprovada. Manter atalhos atuais até decisão.
Rolador futuro: Dice Box (@3d-dice/dice-box), motor independente do RPG, overlay global, dados D4/D6/D8/D10/D12/D20/D100, rolagens livres/contextuais, modificadores, vantagem/desvantagem, histórico, temas, lazy loading, offline individual; som/animação opcionais, sincronização futura. Assimilação usa D6/D10/D12 com símbolos Lobo/Cervo/Joaninha conforme distribuição oficial, investigar temas/texturas e API antes de implementar. Não alterar geometria nem inventar distribuição. Referências: https://github.com/3d-dice/dice-box e https://github.com/3d-dice/dice-themes. Não implementar agora.

## 8. Encontros e loot — já documentado no #147
Seguir ESPECIFICACAO-ENCONTROS-INICIATIVA-LOOT.md. Criaturas individuais com IDs próprios, alterações e loot persistem no encontro, nunca alteram bestiário. Modal aprovado com seleção de recompensas, destinatário, progresso, histórico, quantidades parciais, sem duplicação, entrega atômica, modal permanece após entrega parcial. Ícone mochila cinza/dourado/verde conforme estado. Duplicar configuração inicial ou estado atual; restaurar seletivamente com aviso para loot. Não redesenhar protótipo aprovado. Detalhes de UI de quantidade parcial ainda pendentes.

## 9. Estado operacional na data
- #149 integrado; migração 0012 de enquadramento aplicada e verificada em produção pelo ChatGPT, não reaplicar. #147 e #150 integrados.
- #151 (Início), #152 (personagens), #153 (combate vazio/PV), #154 (barras mobile) abertos pelo ChatGPT. Último relato do Claude às 15:23: #151 integrado após CI verde; #152 atualizado com main, 1611 unitários, 112 E2E principal e 96 criador locais aprovados, CI em execução; #153/#154 aguardam integração sequencial. Consultar GitHub para estado real, não presumir conclusão.
- Claude relatou combinação local das quatro branches: 1621 unitários, 116 E2E principal (16 pulados), 88 qualidade, 96 criador, build aprovado. Não houve teste em celular físico nem sessão real hospedada nessa rodada. Não alterar produção para testes.
- #153 persiste PV antes da remoção e permite finalizar combate vazio; não confundir com sincronização contínua completa, que precisa ser avaliada na consolidação da ficha. Regra de inclusão de fichas privadas na iniciativa ainda pendente; manter regra atual por enquanto.
- #151–154 corrigem problemas imediatos, não implementam toda esta especificação. Não começar funcionalidades novas enquanto Claude termina integrações e usuário define ficha.
- Ordem de planejamento: ficha PC/mobile, inventário, ferramentas de anotações jogador, menu jogador, Início/menus mestre, anotações mestre/workspace.
- Ordem de desenvolvimento a reavaliar após integrações: consolidar personagens/fichas/inventário, encontros/loot, Compêndio/descobertas/notificações, anotações/diário, Dice Box, segurança/offline/beta. PRs pequenos, CI verde, documentação e README atualizados, preservar dados. Aplicar decisões recentes sobre as antigas, sem assumir aprovação de propostas.

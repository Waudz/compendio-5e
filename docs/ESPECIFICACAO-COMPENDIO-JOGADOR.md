# Compêndio do jogador — decisões de 25/11/2026

Status: direção aprovada, implementação futura. Conhecimento individual padrão de itens mágicos sujeito à consulta aos jogadores. Esta especificação prevalece sobre propostas anteriores conflitantes de navegação e publicação. Não implica alterar produção agora.

## Navegação mobile
Barra inferior: Início, Anotações, Ficha (inventário dentro), Compêndio, Menu. Uma única área Compêndio/Enciclopédia; não duplicar atalhos. Mestre mantém catálogo e administração, iniciativa e encontros exclusivos. Desktop e navegação final do mestre ainda serão detalhados. Diário acessível pela seção inicial é proposta; não criar atalhos redundantes.

## Compêndio
Duas abas distintas, Campanha e Regras, sem aba Todos misturando ambas. Pesquisa contextual, lista/grade, filtros internos conforme conteúdo. Evitar guias excessivas.
- Campanha: Personagens (aventureiros e NPCs), Bestiário, Locais, Organizações, Descobertas.
- Regras: Raças, Classes, Origens, Talentos/habilidades, Magias, Itens (armas, armaduras, equipamentos), Regras (condições e mecânicas). Agrupamento final de habilidades pode ser refinado.
- Regras SRD 2014 abertas aos jogadores; conteúdo personalizado conforme publicação. Magias não precisam de categoria de descobertas; magia personalizada revelada entra em Magias.
- Itens mundanos livres para consulta; mágicos somente conforme conhecimento autorizado. Consultar não concede direito de adicionar item mágico ao inventário.
- Bestiário mantém níveis coletivos: nome; nome+descrição; imagem; completo. Preparar evolução individual, sem implementá-la agora.
- Personagens: identidade pública vinculada à ficha canônica, sem duplicação; outros jogadores veem apenas conteúdo autorizado.

## Descobertas
Uma categoria, não várias páginas: itens mágicos, itens de missão, mapas, cartas, livros, documentos e outros. Filtros internos conforme conteúdo existente; vazio com mensagem simples. Itens mágicos conhecidos também aparecem em Regras > Itens, mesma referência, sem duplicar catálogo.
Reaproveitar registros/documentos existentes após auditoria; não exigir catálogo prévio de mapas/cartas. Proposta: Nova descoberta com nome, tipo, imagem/arquivo, conteúdo e visibilidade. Documento narrativo pode existir sem item físico; item físico pode vincular documento. Não exigir inventário para publicar documento. Documentos não precisam de menu independente do jogador.

## Conhecimento e posse
Separar instância/posse, identificação e conhecimento persistente. Padrão provisório: item mágico identificado/revelado concede conhecimento individual ao personagem que o recebeu. Receber item não identificado não revela propriedades automaticamente. Mestre pode revelar diretamente a todos ou individualmente; permitir compartilhar posteriormente com grupo (permissão exata do jogador a definir). Antigos portadores que adquiriram conhecimento mantêm acesso após transferência, venda, perda ou destruição. Novo personagem não herda automaticamente conhecimento individual de outro. Conhecimento coletivo permanece na campanha. Monstros, NPCs, locais, organizações, itens de missão e documentos coletivos por padrão, sujeitos à publicação do mestre.
Uma entrada por identidade de catálogo, múltiplas instâncias independentes. Exibir “Em posse de Lydia” automaticamente a partir de inventários autorizados da campanha; atualizar na transferência. Se nenhum portador visível, omitir inteiramente a linha, sem “Sem portador” ou estado manual. Não revelar inventário alheio nem portador secreto; múltiplos portadores podem ser resumidos. Conhecimento nunca depende de posse atual. Link para identidade pública quando autorizado.

## Notificações
Internas primeiro, sem push obrigatório. Sino/indicador discreto no Compêndio; leitura individual por usuário, links para entrada autorizada. Notificar novos conhecimentos: criatura revelada, aumento de nível de conhecimento, item identificado/revelado, publicação de documento, NPC, local ou organização. Apenas destinatários que ganharam acesso. Não notificar correção textual, cadastro secreto, transferência ou derrota repetida. Evitar duplicatas; não expor título/imagem/contagem de conteúdo secreto. Persistência e isolamento por campanha; autorizações reais no servidor/RLS, não só filtros de interface. Testar acesso direto, troca de campanha, perda de posse, transferência, identificação, publicação coletiva e notificações.

## Retomada imediata (não implementar Enciclopédia agora)
1. Página inicial pós PR #149: descrição ocupa largura disponível, todos aventureiros visíveis autorizados sem limite/carrossel; Diário e Participantes lado a lado em painel largo, empilhados em painel estreito/mobile; cartões de participantes uniformes, ação sair em menu com confirmação; degradê da capa mais longo e suave como 1.0, manter enquadramento. Sem atalhos redundantes. Investigar fichas guiadas ausentes e mensagem de vazio incorreta em Personagens, preservar privacidade e dados.
2. Corrigir combate ativo vazio que não permite finalizar; manter finalizar acessível, desabilitar somente ações dependentes de turno. Corrigir perda de PV de personagem removido imediatamente após alteração; persistir na ficha, reentrada usa PV atual, tratar corridas/falhas. Corrigir oscilação das barras mobile em rolagem rápida e conteúdo encoberto no fim.
3. Personagens/fichas, inventário; depois encontros/loot conforme PR #147 e esta especificação de Compêndio. Dice Box futuro.
Separar PRs pequenos, testes regressivos e CI verde; não alterar produção para testar. Não criar dados fictícios reais nem redesenhar áreas já aprovadas. 

## Atualização de 27/11/2026 (DEC-034)
O nível "completo" do Bestiário deixa de incluir estatísticas: o conhecimento do jogador sobre criaturas é exclusivamente narrativo.

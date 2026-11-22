# Itens personalizados, identificação e loot — decisões de produto (22/11/2026)

**Situação:** decisões aprovadas em conversa, **planejadas, não implementadas**. Esta decisão mais recente substitui DEC-20261122-D apenas no que diz respeito a distribuição de loot: mantém pesquisa e inclusão direta de itens mundanos **e itens mágicos de raridade comum** pelo jogador, mas admite loot preparado e liberado pelo mestre. Nenhuma migração ou alteração do código autorizada.

## Visibilidade e aquisição
- Jogadores consultam e adicionam livremente equipamentos **mundanos** (armas, armaduras, ferramentas, suprimentos) e **itens mágicos de raridade comum** do catálogo; itens pessoais mundanos podem ser personalizados.
- Itens mágicos **comuns** do catálogo oficial são pesquisáveis e adicionáveis pelo jogador (ex.: Poção de Cura básica); não exigem entrega do mestre. Adicionar ao inventário registra uma aquisição narrada na mesa, não concede um item gratuitamente nas regras.
- Itens mágicos **incomuns ou superiores** ficam ocultos do catálogo de jogador por padrão, mas o mestre pode **revelar ou ocultar cada item oficial para todos os jogadores da campanha**, no mesmo princípio de publicação de monstros. Um item revelado aparece na pesquisa do Compêndio e pode ser selecionado/adicionado pelo jogador no inventário; um item oculto não aparece na pesquisa geral. Itens mágicos comuns são públicos por padrão. Ex.: Poção de Cura Maior (incomum), Superior (rara) e Suprema (muito rara).
- Itens mágicos incomuns ou superiores **ainda ocultos** são concedidos pelo mestre, individualmente ou por loot de encontro liberado; quando publicados para a campanha, podem ser adicionados pelo próprio jogador. Publicar não equivale a entregar fisicamente o item na narrativa. Após identificação/revelação, o jogador vê as propriedades do exemplar descoberto; não recebe acesso ao catálogo mágico inteiro nem às itens personalizados privados.
- O mestre vê o catálogo completo. Regras de autorização devem ser verificadas no servidor/RLS, sem enviar IDs ou propriedades secretas ao cliente antes da revelação. O ID interno verdadeiro pode ser preservado no servidor.
- **Raridade define o padrão inicial, não uma proibição permanente:** mundanos e mágicos comuns são públicos e adicionáveis por padrão; mágicos incomuns ou superiores exigem entrega individual ou publicação pelo mestre. Publicação/ocultação é por campanha. Ocultar não remove itens já possuídos nem apaga descobertas anteriores.
- **Publicação por campanha:** revelar/ocultar itens mágicos oficiais funciona como a publicação de monstros, visível a todos os jogadores da campanha; não revela automaticamente itens personalizados privados do mestre. Reverter para oculto remove da pesquisa geral, sem apagar cópias ou descobertas já registradas.
- **Descobertas por personagem:** ao encontrar/receber uma arma ou outro item especial, o personagem passa a ver no Compêndio > Itens > Descobertos a representação daquele exemplar, com imagem, nome e descrição liberados pelo mestre, mesmo que ainda não esteja identificado. Propriedades mágicas e bônus ocultos continuam protegidos até identificação/revelação. A descoberta persiste mesmo que o item seja perdido, consumido ou transferido, sem liberar itens personalizados privados nem itens desconhecidos. A descoberta é por personagem/campanha, não global por conta; proteger projeções com RLS.
- Diferenciar pesquisa do catálogo, posse de um exemplar, conhecimento de sua existência, conhecimento de suas propriedades e estado de sintonização.

## Equipamentos mágicos genéricos e itens personalizados
- **Apenas dois tipos de registro no Compêndio:** itens oficiais e itens personalizados. Não manter sistema paralelo de variantes salvas.
- Equipamentos genéricos +1/+2/+3 (como Espada Longa +1) são configurações da cópia entregue, vinculadas ao item oficial. Não criam registro separado, não poluem a pesquisa.
- **Compêndio > Itens > Criar item:** mestre cria um item personalizado, opcionalmente baseado em item oficial para herdar dano, peso, propriedades e demais regras. Pode personalizar nome, imagem e descrição, e selecionar bônus mágico compatível. Ex.: Agulha, baseada em Espada Longa +1.
- Um item com identidade própria (nome, imagem ou descrição personalizados) é **item personalizado com registro próprio**, privado do mestre inicialmente. Pode ser publicado por campanha ou descoberto ao ser entregue; continua vinculado ao item-base quando houver.
- **Vínculos entre registros do Compêndio:** itens personalizados podem referenciar NPCs, monstros, locais, organizações e outros itens por ID estável. Ex.: a *Foice da Herdeira das Sombras* é um item completo, com descrição que aponta para a ficha da NPC *Herdeira das Sombras*. A ficha da NPC pode mostrar o item em registros relacionados. Alterações de nome não quebram o vínculo. Respeitar permissões e visibilidade de cada registro: link não pode vazar conteúdo oculto nem revelar a existência de NPCs secretas indevidamente.
- A cópia entregue possui dono, identificação e informações reveladas próprios. Editar o item personalizado original não altera silenciosamente cópias já entregues. Não criar editor genérico de efeitos arbitrários, evolução de itens ou XP.
- Arma genérica recebida continua acessível no inventário sem ficha duplicada no Compêndio. Descobertas de itens personalizados permanecem disponíveis ao personagem, respeitando sigilo e RLS.

## Entrega e identificação
- Mestre abre um item em Compêndio > Itens e escolhe **Entregar**, ou inicia entrega no inventário do personagem. Seleciona personagem, estado revelado/não revelado e pode definir a apresentação e descrição visíveis do exemplar, sem transformar automaticamente uma cópia genérica em novo item do Compêndio.
- Para armas, armaduras e escudos com versões oficiais de bônus mágico, a entrega pode oferecer **normal, +1, +2, +3**, apenas conforme opções compatíveis do SRD 2014. Usar a definição canônica da arma/armadura-base e do bônus mágico, sem cadastrar cada combinação.
- Exemplo: o mestre cria o item personalizado 'Agulha' baseado em Espada Longa +1 e o entrega não identificado; o jogador vê o nome/descrição liberados ('Você sente uma energia mágica emanando da espada'), sem mostrar +1. Após identificação, o bônus é revelado; o nome permanece. Uma Espada Longa +1 genérica, sem personalização, não cria registro novo.
- O jogador pode solicitar **Identificar** no inventário com aviso de que, pelas regras de 2014, é necessário o procedimento adequado (p.ex. descanso curto estudando o item ou magia *Identificar*). Não confundir identificação com sintonização; quando exigida, sintonização é separada, com limite normal de três itens.
- Não presumir que o efeito mágico só existe após identificação; distinguir conhecimento do item da aplicação mecânica conforme regras.

## Loot preparado de encontros
- Mestre pode associar itens mundanos, itens personalizados mágicos, itens mágicos oficiais, quantidades e moedas ao encontro **antes da sessão**.
- Loot não é distribuído automaticamente ao vencer combate ou morrer monstro: o mestre decide **quando e quais recompensas liberar**, inclusive tesouros escondidos ou não encontrados.
- Quando liberadas, recompensas aparecem para os jogadores da campanha, que podem **recolher** itens para o próprio inventário; o sistema deve impedir que a mesma unidade seja reivindicada duas vezes (controle transacional/concorrência).
- Mestre também pode entregar diretamente a um personagem. Propriedades mágicas ocultas permanecem ocultas durante liberação e recolhimento.
- Não criar uma aba principal exclusiva para loot; usar encontro/campanha e uma visualização simples de recompensas liberadas.
- Sorteio de item mágico é **ideia futura, não requisito da primeira etapa**; poderá usar registros oficiais e arma-base compatível. Variantes pessoais ficam excluídas por padrão.

## Prioridade e validação
1. Catálogo com distinção segura entre mundano, mágico comum e mágico incomum ou superior; pesquisa de inventário permite mundanos, mágicos comuns e itens mágicos publicados pelo mestre na campanha.
2. Entrega pelo mestre e identificação, com privacidade real.
3. Bônus mágicos parametrizados e itens personalizados privados simples.
4. Loot de encontro preparado, liberação e coleta concorrente segura.
5. Sorteio opcional futuramente.

**Testes necessários:** publicação/ocultação por campanha, sem vazamento entre campanhas; item publicado pode ser pesquisado e adicionado; ocultação não apaga descoberta nem posse; itens personalizados privados nunca entram na busca pública; RLS e isolamento por campanha; jogador não consegue consultar itens personalizados privados nem dados ocultos por API; identificação não vaza segredos de outros itens; duas coletas simultâneas não duplicam loot; editar item personalizado original não modifica silenciosamente cópias entregues; opções +1/+2/+3 respeitam as categorias permitidas; manutenção de dados existentes. **Nada acima é declaração de implementação.**

# Itens, variantes, identificação e loot — decisões de produto (22/11/2026)

**Situação:** decisões aprovadas em conversa, **planejadas, não implementadas**. Esta decisão mais recente substitui DEC-20261122-D apenas no que diz respeito a distribuição de loot: mantém pesquisa e inclusão direta de itens mundanos **e itens mágicos de raridade comum** pelo jogador, mas admite loot preparado e liberado pelo mestre. Nenhuma migração ou alteração do código autorizada.

## Visibilidade e aquisição
- Jogadores consultam e adicionam livremente equipamentos **mundanos** (armas, armaduras, ferramentas, suprimentos) e **itens mágicos de raridade comum** do catálogo; itens pessoais mundanos podem ser personalizados.
- Itens mágicos **comuns** do catálogo oficial são pesquisáveis e adicionáveis pelo jogador (ex.: Poção de Cura básica); não exigem entrega do mestre. Adicionar ao inventário registra uma aquisição narrada na mesa, não concede um item gratuitamente nas regras.
- Itens mágicos **incomuns ou superiores** ficam ocultos do catálogo de jogador por padrão, mas o mestre pode **revelar ou ocultar cada item oficial para todos os jogadores da campanha**, no mesmo princípio de publicação de monstros. Um item revelado aparece na pesquisa do Compêndio e pode ser selecionado/adicionado pelo jogador no inventário; um item oculto não aparece na pesquisa geral. Itens mágicos comuns são públicos por padrão. Ex.: Poção de Cura Maior (incomum), Superior (rara) e Suprema (muito rara).
- Itens mágicos incomuns ou superiores **ainda ocultos** são concedidos pelo mestre, individualmente ou por loot de encontro liberado; quando publicados para a campanha, podem ser adicionados pelo próprio jogador. Publicar não equivale a entregar fisicamente o item na narrativa. Após identificação/revelação, o jogador vê as propriedades do exemplar descoberto; não recebe acesso ao catálogo mágico inteiro nem às variantes privadas.
- O mestre vê o catálogo completo. Regras de autorização devem ser verificadas no servidor/RLS, sem enviar IDs ou propriedades secretas ao cliente antes da revelação. O ID interno verdadeiro pode ser preservado no servidor.
- **Raridade define o padrão inicial, não uma proibição permanente:** mundanos e mágicos comuns são públicos e adicionáveis por padrão; mágicos incomuns ou superiores exigem entrega individual ou publicação pelo mestre. Publicação/ocultação é por campanha. Ocultar não remove itens já possuídos nem apaga descobertas anteriores.
- **Publicação por campanha:** revelar/ocultar itens mágicos oficiais funciona como a publicação de monstros, visível a todos os jogadores da campanha; não revela automaticamente variantes privadas do mestre. Reverter para oculto remove da pesquisa geral, sem apagar cópias ou descobertas já registradas.
- **Descobertas por personagem:** ao encontrar/receber uma arma ou outro item especial, o personagem passa a ver no Compêndio > Itens > Descobertos a representação daquele exemplar, com imagem, nome e descrição liberados pelo mestre, mesmo que ainda não esteja identificado. Propriedades mágicas e bônus ocultos continuam protegidos até identificação/revelação. A descoberta persiste mesmo que o item seja perdido, consumido ou transferido, sem liberar variantes privadas nem itens desconhecidos. A descoberta é por personagem/campanha, não global por conta; proteger projeções com RLS.
- Diferenciar pesquisa do catálogo, posse de um exemplar, conhecimento de sua existência, conhecimento de suas propriedades e estado de sintonização.

## Exibição compacta de equipamentos mágicos genéricos
- Não criar entradas independentes no Compêndio para cada combinação genérica de equipamento +1/+2/+3 (por exemplo Espada Longa +1, +2, +3 e Machado +1). Essas configurações ficam nas opções do item-base e na cópia do inventário, respeitando a publicação e a identificação.
- **Regra definitiva de criação de registro:** uma variante com nome próprio, imagem diferente ou descrição personalizada **cria um registro próprio no Compêndio do mestre**, vinculado ao item-base; começa privado e pode ser publicado na campanha ou descoberto pelo personagem. A simples seleção de +1/+2/+3 **mantendo nome, imagem e descrição originais não cria registro**: só configura a cópia entregue. O registro personalizado pode aparecer em Descobertos quando encontrado, sem expor as demais variantes privadas.
- Mesmo uma arma mágica genérica recebida deve continuar acessível pelo inventário, sem exigir ficha duplicada no Compêndio. Esta regra é de apresentação e não elimina os registros canônicos de regras nem os estados de descoberta/segredo.

## Entrega e identificação
- Mestre abre um item em Compêndio > Itens e escolhe **Entregar**, ou inicia entrega no inventário do personagem. Seleciona personagem, estado revelado/não revelado e pode personalizar nome e descrição do exemplar.
- Para armas, armaduras e escudos com versões oficiais de bônus mágico, a entrega pode oferecer **normal, +1, +2, +3**, apenas conforme opções compatíveis do SRD 2014. Usar a definição canônica da arma/armadura-base e do bônus mágico, sem cadastrar cada combinação.
- Exemplo: Espada Longa +1 entregue como 'Agulha', não revelada, aparece ao jogador com nome/descrição personalizados ('Você sente uma energia mágica emanando da espada'), sem mostrar +1. Após identificação, mostra o bônus; nome personalizado permanece.
- O jogador pode solicitar **Identificar** no inventário com aviso de que, pelas regras de 2014, é necessário o procedimento adequado (p.ex. descanso curto estudando o item ou magia *Identificar*). Não confundir identificação com sintonização; quando exigida, sintonização é separada, com limite normal de três itens.
- Não presumir que o efeito mágico só existe após identificação; distinguir conhecimento do item da aplicação mecânica conforme regras.

## Variantes salvas — somente mestre
- Dentro da ficha de um equipamento oficial no Compêndio, o mestre pode salvar variantes reutilizáveis **simples** de bônus +1/+2/+3 (somente categorias compatíveis), com nome, descrição e imagem próprios.
- Variantes são privadas do mestre, invisíveis na busca e na seção de variantes do jogador. Não há sistema de evolução de itens, encantamentos combináveis, progressão por XP nem editor de efeitos especiais.
- Itens mágicos complexos usam os **registros oficiais**, não variantes com regras arbitrárias.
- A variante referencia o item-base e a definição mágica; a **cópia entregue** tem dono, estado de identificação e personalizações próprios. Alterar a variante salva não deve alterar silenciosamente exemplares já entregues.
- Variantes podem ser preparadas antes de sessões e reutilizadas em encontros/campanhas. Não incluir variantes exclusivas em sorteios aleatórios por padrão.

## Loot preparado de encontros
- Mestre pode associar itens mundanos, variantes mágicas, itens mágicos oficiais, quantidades e moedas ao encontro **antes da sessão**.
- Loot não é distribuído automaticamente ao vencer combate ou morrer monstro: o mestre decide **quando e quais recompensas liberar**, inclusive tesouros escondidos ou não encontrados.
- Quando liberadas, recompensas aparecem para os jogadores da campanha, que podem **recolher** itens para o próprio inventário; o sistema deve impedir que a mesma unidade seja reivindicada duas vezes (controle transacional/concorrência).
- Mestre também pode entregar diretamente a um personagem. Propriedades mágicas ocultas permanecem ocultas durante liberação e recolhimento.
- Não criar uma aba principal exclusiva para loot; usar encontro/campanha e uma visualização simples de recompensas liberadas.
- Sorteio de item mágico é **ideia futura, não requisito da primeira etapa**; poderá usar registros oficiais e arma-base compatível. Variantes pessoais ficam excluídas por padrão.

## Prioridade e validação
1. Catálogo com distinção segura entre mundano, mágico comum e mágico incomum ou superior; pesquisa de inventário permite mundanos, mágicos comuns e itens mágicos publicados pelo mestre na campanha.
2. Entrega pelo mestre e identificação, com privacidade real.
3. Bônus mágicos parametrizados e variantes privadas simples.
4. Loot de encontro preparado, liberação e coleta concorrente segura.
5. Sorteio opcional futuramente.

**Testes necessários:** publicação/ocultação por campanha, sem vazamento entre campanhas; item publicado pode ser pesquisado e adicionado; ocultação não apaga descoberta nem posse; variantes privadas nunca entram na busca pública; RLS e isolamento por campanha; jogador não consegue consultar variante nem dados ocultos por API; identificação não vaza segredos de outros itens; duas coletas simultâneas não duplicam loot; editar variante não modifica cópias entregues; opções +1/+2/+3 respeitam as categorias permitidas; manutenção de dados existentes. **Nada acima é declaração de implementação.**

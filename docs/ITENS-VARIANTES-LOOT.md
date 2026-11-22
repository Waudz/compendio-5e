# Itens, variantes, identificação e loot — decisões de produto (22/11/2026)

**Situação:** decisões aprovadas em conversa, **planejadas, não implementadas**. Esta decisão mais recente substitui DEC-20261122-D apenas no que diz respeito a distribuição de loot: mantém pesquisa e inclusão direta de itens mundanos **e itens mágicos de raridade comum** pelo jogador, mas admite loot preparado e liberado pelo mestre. Nenhuma migração ou alteração do código autorizada.

## Visibilidade e aquisição
- Jogadores consultam e adicionam livremente equipamentos **mundanos** (armas, armaduras, ferramentas, suprimentos) e **itens mágicos de raridade comum** do catálogo; itens pessoais mundanos podem ser personalizados.
- Itens mágicos **comuns** do catálogo oficial são pesquisáveis e adicionáveis pelo jogador (ex.: Poção de Cura básica); não exigem entrega do mestre. Adicionar ao inventário registra uma aquisição narrada na mesa, não concede um item gratuitamente nas regras.
- Itens mágicos **incomuns ou superiores** ficam ocultos do catálogo de jogador enquanto não revelados e não aparecem na pesquisa de inclusão direta. Ex.: Poção de Cura Maior (incomum), Superior (rara) e Suprema (muito rara).
- Itens mágicos incomuns ou superiores são concedidos pelo mestre, individualmente ou por loot de encontro liberado. Após identificação/revelação, o jogador vê as propriedades do exemplar e pode consultar o item descoberto; não recebe acesso ao catálogo mágico inteiro nem às variantes privadas.
- O mestre vê o catálogo completo. Regras de autorização devem ser verificadas no servidor/RLS, sem enviar IDs ou propriedades secretas ao cliente antes da revelação. O ID interno verdadeiro pode ser preservado no servidor.
- **Raridade é critério de permissão para adição direta:** mundanos e mágicos comuns são livres; mágicos incomuns ou superiores dependem de entrega/revelação. O mestre pode entregar qualquer item já revelado.
- Diferenciar pesquisa do catálogo, posse de um exemplar, conhecimento de suas propriedades e estado de sintonização.

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
1. Catálogo com distinção segura entre mundano, mágico comum e mágico incomum ou superior; pesquisa de inventário permite mundanos e mágicos comuns.
2. Entrega pelo mestre e identificação, com privacidade real.
3. Bônus mágicos parametrizados e variantes privadas simples.
4. Loot de encontro preparado, liberação e coleta concorrente segura.
5. Sorteio opcional futuramente.

**Testes necessários:** RLS e isolamento por campanha; jogador não consegue consultar variante nem dados ocultos por API; identificação não vaza segredos de outros itens; duas coletas simultâneas não duplicam loot; editar variante não modifica cópias entregues; opções +1/+2/+3 respeitam as categorias permitidas; manutenção de dados existentes. **Nada acima é declaração de implementação.**

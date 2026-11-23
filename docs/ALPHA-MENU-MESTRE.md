# Alpha — atalhos exclusivos do mestre (22/11/2026)

Branch `fix/alpha-menu-mestre`, independente do SQL do #108 e dependente apenas do #107. Implementa a decisão já aprovada de iniciativa e combate exclusivos do mestre.

O desktop já omitia os módulos para jogadores por sua lista ordenada, mas o menu móvel e os menus de nova aba usavam outra lista que os oferecia. `sections` agora marca Iniciativa e Encontros como `masterOnly`, reaproveitando `visibleSections` em todos esses destinos. O mestre mantém ambos; jogadores e contexto sem papel não recebem esses atalhos.

Não altera nem apaga layouts ou combates existentes. Uma aba antiga/restaurada continua protegida pela checagem de papel em `IniciativaPanel`/`EncontrosPanel`, que não lê armazenamento de jogadores. Ocultar menu não substitui RLS; adaptador remoto permanece desligado.

Testes locais focados: 58 aprovados em `mobileNavegacao`, `inicioCampanha` e `iniciativaTela`. Novo teste abre o menu como jogador e mestre. E2E verifica ausência dos dois atalhos em desktop e celular; rodar no CI, pois o ambiente local bloqueia Chromium. Build e tipos E2E devem acompanhar o PR. Sem alteração de produção, banco, migração, merge ou deploy.

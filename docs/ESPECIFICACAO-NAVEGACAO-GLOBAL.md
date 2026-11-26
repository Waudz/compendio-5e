# Navegação global — Alpha

Decisão do usuário de 26/11/2026. Substitui regras anteriores de abertura automática de links no grupo direito e substituição de aba pelo menu lateral.

- Clique normal em conteúdo/link navega na própria aba, com histórico independente e retorno ao estado anterior (pesquisa, filtros, rolagem, edição protegida).
- Menu lateral abre nova aba ou seleciona a seção já aberta; não substitui o trabalho atual.
- Menu contextual de conteúdo, nesta ordem: Abrir em nova aba (mesmo grupo), Abrir em novo grupo (cria segundo grupo ou usa outro existente), Abrir (aba atual).
- Máximo dois grupos; nenhuma divisão automática por clique normal. Preservar regras de segurança, campanha, papel e alterações não salvas.
- Aplicar globalmente, incluindo Compêndio, ficha, inventário, encontros e Anotações. Mobile mantém navegação por telas e histórico, sem divisão de grupos.
- Validar navegação em um e dois grupos, retorno, menu lateral, links internos e ações contextuais. Revisar implementação inicial ada4fd9 na branch fix/compendio-navegacao-granular para adequar ao escopo global.

## Refinamento visual aprovado
- Abas compactas (~34px), altura uniforme, estilo azul existente, ícones pequenos e destaque discreto da ativa.
- Títulos sempre em uma linha, sem quebra de palavras; reticências quando necessário, nome completo em tooltip. Rolagem horizontal para excesso de abas.
- Redesenhar também a página de nova aba, mantendo acesso rápido às seções.
- Ctrl+clique e botão do meio abrem nova aba; voltar/avançar por aba; recuperar aba fechada; manter arrastar e fixar. Tela cheia opcional, mesma interface em F11, sem barra adicional volumosa.

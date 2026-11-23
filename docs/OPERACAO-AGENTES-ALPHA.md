# Operação contínua com agentes — Compêndio 5e 2.0 Alpha

## Objetivo
Reduzir pedidos repetidos de “continue”, mantendo desenvolvimento verificável e sem alterações irreversíveis. Este documento é operacional; as decisões de produto continuam em `DECISOES-E-ARQUITETURA.md` e o ponto de entrada em `docs/CONTINUIDADE-DESENVOLVIMENTO.md`.

## Execução recomendada
- **ChatGPT Work:** sessão longa de coordenação, leitura de PRs, análise de banco, documentação e implementação por etapas; retomar pelo estado do repositório, não pela memória da conversa.
- **Codex Cloud:** execução de comandos, build, Vitest, Playwright e refatorações que exijam ambiente de desenvolvimento. Pode ser iniciado pela web/celular após configurar ambiente.
- **GitHub:** branch/PR por fatia vertical, testes automatizados, revisão e histórico durável.
- **Work agendado/por evento:** monitorar alterações de PR e relatar CI/revisões/bloqueios; não autorizar merge ou migração apenas por gatilho.

## Instrução permanente para agente
Trabalhe autonomamente no próximo item desbloqueado do Compêndio 5e 2.0 Alpha. Antes de cada etapa, consulte decisões normativas, PRs e estado real do código. Prefira uma fatia pequena com implementação + teste + documentação. Se uma ferramenta falhar, registre a falha e escolha outro trabalho independente, sem simular execução. Não solicite “continuar” após cada commit. Só peça decisão quando houver conflito de produto, necessidade de credencial, risco a dados reais ou ação irreversível.

**Nunca** mesclar na main, publicar, aplicar SQL/migrações, apagar dados ou alterar políticas de produção sem autorização expressa. Nunca executar migração de desenvolvimento contra o projeto de produção. Separar os projetos Supabase `compendio-5e` e `rastreador-dnd`. Não expor iniciativa e combate aos jogadores.

## Ciclo de trabalho
1. Identificar o próximo bloqueio de maior impacto e confirmar dependências.
2. Inspecionar código e esquema; registrar critérios de aceite.
3. Implementar em branch; adicionar testes positivos, negativos e de regressão.
4. Executar comandos disponíveis e inspecionar CI; indicar claramente o que não foi executado.
5. Atualizar PR com commits, limitações, evidências e próximo passo.
6. Repetir o ciclo na mesma sessão até surgir bloqueio real ou atingir o limite da execução.

## Fila prioritária da Alpha
1. Validar build, testes e conflitos do PR #103 e seu dependente #106.
2. Gerar migração oficial em ambiente isolado e executar testes de RLS para combate (rascunho: `docs/sql/alpha-campaign-combats-DRAFT.sql`).
3. Integrar adaptador remoto somente depois de autorização, migração validada e estratégia explícita de importação local.
4. Corrigir navegação mestre/jogador, persistência de ficha e regressões.
5. Verificar segurança, desempenho e E2E antes da Beta fechada.

## Gatilhos úteis
- PR aberto/atualizado: verificar CI, testes e conflitos; registrar diagnóstico sem merge.
- Verificação diária enquanto a Alpha estiver em andamento: resumo de PRs bloqueados, testes falhando e próximo item implementável.

## Entrega ao usuário
Relatório curto com: **implementado**, **verificado**, **não verificado**, **dependências**, **PR** e **próximo passo**. Um PR aberto não é uma funcionalidade publicada.

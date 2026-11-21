# Testes E2E do criador — 21/11/2026

## Base e escopo
Branch `test/creator-e2e`, base funcional PR #78 `b1ed9e1`, dependente de #74 `3f5c41c`.
PR #76 `33eab06` fornece Playwright/isolamento; #77 `0d6f744` fornece matriz de oito larguras/axe.
Reutilizamos os arquivos de teste/configuração, sem incorporar mudanças em `src/` do #77.
Nenhuma branch dos outros autores alterada. PR empilhado sobre #78; não integrar antes das dependências.

## Inventário anterior e incremento
#74/#78 já possuem testes de domínio de atributos, Guerreiro, equipamento, inventário e vínculos, além de integração React em `src/criador/criadorGuiado.test.tsx`.
#76 testa carregamento e navegação geral; #77 testa campanha/Diário, teclado, painéis e diagnósticos.
Os novos testes exercitam o navegador real e a navegação real, não reimplementam o motor de regras.

- 8 cenários × 8 larguras (320, 360, 390, 700, 701, 768, 1024 e 1440): 64 execuções.
- Criar Guerreiro, alterar atributos, duas perícias, estilo, ficha calculada.
- Prévia/equipamento alternativo, confirmação idempotente, inventário.
- Adicionar Adaga, aumentar/diminuir quantidade e remover, abrir definição canônica e retornar.
- Cancelar/descartar e salvar pelo diálogo de alterações pendentes.
- Tab real entre campos, Enter nas seções/resultados, foco inicial de confirmação.
- Limites geométricos de controles (também detecta conteúdo cortado em painéis), lista/grade/busca pt/en.
- Quatro análises axe por largura; nenhuma regra desativada, retry, falha esperada ou tolerância a violações.

## Execução
```sh
npm ci
npx playwright install --with-deps chromium
npm run test:e2e:types
npm run test:creator
npm run test:e2e
npm run test:quality
npm run build
npm test
```
Workflow independente `e2e.yml`; etapas novas e de qualidade executam mesmo após falha anterior para registrar todos os achados. Falhas continuam deixando o job vermelho. Relatórios por suíte, capturas/árvore acessível, vídeo/trace em falha, artefatos por sete dias.

## Segurança e limites
Mesma fixture dos #76/#77: servidor exclusivo local, Supabase vazio, rede externa HTTP/WebSocket bloqueada com falha no teste, contextos descartáveis, service worker bloqueado. Não usar APIRequestContext nem contas reais.
Salvar/reabrir verifica somente armazenamento experimental local atual. Não prova sincronização, isolamento por RLS ou permissões reais. Raça/origem e catálogo de armas seguem amostras. Mobile desmonta a ficha ao abrir conteúdo: os testes de ida/volta salvam explicitamente antes, sem alegar rascunho persistente entre telas.
As correções de acessibilidade em `src/` do #77 não existem no #78: a suíte antiga preservada pode apontar novamente esses problemas. Não importar correções de outros autores nem afrouxar testes para obter CI verde.

## Resultados e encaminhamento
Em execução; números finais e defeitos serão registrados após o CI Linux. Build/Vitest locais usam `--configLoader runner` por restrição de leitura do esbuild no Windows. Não confundir listagem de 64 casos com execução aprovada.

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
CI Linux executado no commit `e4c511f`:

| Verificação | Resultado |
|---|---|
| TypeScript e build padrão | Aprovados ([workflow](https://github.com/Waudz/compendio-5e/actions/runs/44869752967)) |
| Vitest | 743 aprovados, 77 arquivos |
| Tipos E2E | Aprovados |
| E2E original #76 | 36 aprovados, 0 falhas |
| Nova suíte criador | 56 aprovados, 8 falhas axe, 0 pulados/retries |
| Qualidade #77 sobre #78 sem seus patches de app | 52 aprovados, 28 falhas, 32 não aplicáveis |

Total navegador: 212 selecionados, **180 executados: 144 aprovados / 36 reprovados**, 32 não aplicáveis exclusivamente da suíte antiga. Não somar as 32 análises axe do criador como testes extras: são verificações dentro dos oito casos de acessibilidade.
[E2E Linux](https://github.com/Waudz/compendio-5e/actions/runs/44869752993) permanece **vermelho por defeitos reais**. [Artefato](https://github.com/Waudz/compendio-5e/actions/runs/44869752993/artifacts/14693397582): relatórios, árvore acessível, capturas, vídeos e traces; expira em 28/11. JSON resumido permanente em [evidencias/criador-axe-2026-11-21.json](evidencias/criador-axe-2026-11-21.json). Capturas de Adaga em 320/1440 inspecionadas: conteúdo legível, limites de página respeitados. Os testes de geometria e fluxo passaram nas oito larguras.

### C-E2E-01 — Nomes acessíveis do inventário divergentes (gravidade alta, axe serious)
- **Responsável:** Claude / #78; não corrigido aqui por restrição de escopo.
- **Reprodução:** `?demo=jogador` → Personagens → Criar com o criador guiado → preencher nome → Equipamento inicial → escolher couro/arco → Confirmar → Inventário. Executar `npm run test:creator -- --project=qualidade-320 --grep WCAG` (também nas demais larguras).
- **Atual:** texto `Consultar no Compêndio` versus nome `Consultar Armadura de couro no Compêndio`; texto `+1` versus `Adicionar quantidade de ...`; texto `−1` versus `Remover quantidade de ...`. O texto visível não está incluído integralmente no nome acessível (WCAG 2.5.3, comandos por voz prejudicados).
- **Esperado:** nome acessível deve conter o texto visível, preservando o contexto do item.
- **Local:** `src/criador/CriadorGuiado.tsx`, botões das linhas do inventário (199–201 no commit-base).
- **Evidência:** regra `label-content-name-mismatch` no inventário em todas as oito larguras; os oito casos WCAG falham. A quantidade de nós sinalizados varia com os itens visíveis no viewport; não alegamos varredura de toda a lista rolável.
- **Recomendação ao responsável:** nomes como `Consultar no Compêndio: Armadura de couro`, `+1: adicionar quantidade de ...`, `−1: remover quantidade de ...`, seguidos de nova execução integral de axe. É proposta, não alteração implementada.

### C-E2E-02 — Correções do #77 ainda ausentes do #78 (gravidade alta para acessibilidade)
- **Responsável:** coordenação da integração; não é regressão criada por estes testes.
- **Reprodução:** modo demo, desktop → marca/seletor/abas/cartões; mobile → menu → Tab/Shift+Tab/Escape; desktop → menu contextual → setas/fechar.
- **Resultados herdados:** oito casos axe falham (contraste/nomes); quatro casos de foco do menu mobile; oito de teclado/retorno de foco do menu contextual; oito do contrato de nomes naturais/privacidade.
- **Evidência nova:** marca `#3b82f6` sobre `#202c39` tem contraste medido **3,85:1**, exigido **4,5:1**; `.campaign-main` substitui o texto visível no nome; aba do criador renomeada visualmente diverge do nome acessível depois de salvar. Nas quatro larguras mobile, ficha/equipamento/item passaram axe; o inventário continuou falhando por C-E2E-01.
- **Locais conhecidos:** `src/style.css`, `src/App.tsx`, `src/CampaignHome.tsx`, `src/Mobile.tsx`, `src/ContextMenu.tsx`. Patches e regressões já propostos no PR #77; reconciliar com #78 sob responsabilidade dos autores, sem copiar cegamente arquivos inteiros.
- **Esperado:** preservar os patches do #77 ao integrar os PRs, depois revalidar a aba do criador e todas as suítes. Os oito testes de nomes naturais foram preservados, não adaptados aos nomes incorretos do #78.

### Correções de nossa frente e pendências
Nenhum defeito de domínio/persistência corrigido. Testes usam o menu público `Fechar aba`, salvam explicitamente antes de navegar no celular e verificam a seção correta após remontagem. Não alteramos controles para facilitar seletores, não desativamos regras axe nem transformamos achados em skips/falhas esperadas.

**Próxima etapa:** Claude corrigir C-E2E-01; coordenar reconciliação #77/#78 (C-E2E-02); reexecutar as três suítes e avaliar os relatórios antes de integrar. Só após persistência real: nova rodada de autenticação, RLS, revisões/conflitos, recarga e sincronização entre contextos/dispositivos.

### Arquivos e risco de integração
- Novos testes: `e2e/creator/helpers.ts`, `flows.creator.ts`, `accessibility.creator.ts`; configuração `playwright.creator.config.ts`.
- Reutilizados sem alterar seu conteúdo: fixtures, specs #76, testes de qualidade #77 e duas configurações originais; `e2e/tsconfig.json` passa a incluir as três configurações.
- Infraestrutura: `package.json`, lockfile, `vite.config.ts` (somente exclusão de E2E no Vitest), `.gitignore`, workflow `e2e.yml`.
- Documentação: README, este relatório, JSON de evidências. **Diff de `src/` e `supabase/` contra #78 vazio.**
- Possíveis conflitos com #76/#77: mesmos arquivos reutilizados de testes/CI/dependências; reconciliar uma única infraestrutura ao integrar, sem instalar um segundo Playwright. #74/#78: somente README/configuração comuns, nenhum módulo exclusivo do Claude alterado. #75 não incorporado nem alterado; revalidar navegação após integração.
- Sem aparelho físico, leitor de tela real, Firefox/WebKit, avaliação de produção, sincronização ou segurança de servidor. Não certifica conteúdo SRD completo nem todos os níveis/classes.
 Build/Vitest locais usam `--configLoader runner` por restrição de leitura do esbuild no Windows. Não confundir listagem de 64 casos com execução aprovada.

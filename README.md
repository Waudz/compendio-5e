# Compêndio 5e 2.0

Ferramenta gratuita de apoio à mesa de D&D 5e (regras de 2014), para mestre e jogadores. React + TypeScript + Vite, Supabase (Auth, Postgres, RLS) e GitHub Pages. Projeto de fãs, sem afiliação oficial. O aplicativo anterior (`rastreador-dnd`) permanece independente e não é tocado.

Site publicado: https://waudz.github.io/compendio-5e/ (exige login).

## Desenvolvimento

```bash
npm ci            # instala as dependências do package-lock.json
npm run dev       # servidor local
npm run build     # tsc -b && vite build
npm test          # vitest run (inclui os testes de RLS em Postgres em memória)
```

Configuração (sem ela o aplicativo não abre, pois exige login): copie `.env.example` para `.env.local` e preencha `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` (chave **pública**). Nunca use a `service_role` nem a `sb_secret_` no frontend.

## Documentação

| Arquivo | Para quê |
|---|---|
| `DECISOES-E-ARQUITETURA.md` | Regras do projeto, arquitetura vigente e estado real de cada parte. **Ler primeiro.** |
| `docs/PLANEJAMENTO-V2.md` | **Documento principal**: estado, arquitetura, roteiro, pendências e decisões consolidadas de múltiplos chats (atualização de 20/11/2026). **Consultar antes de desenvolver.** |
| `docs/NAVEGACAO-ABAS.md` | Navegação por abas, fixação, divisão de painéis e proteção de alterações (implementado). |
| `docs/NOTAS-PERMISSOES.md` | Notas: regras de visibilidade e RLS (`0004`, aplicada), revisão de segurança e evolução planejada. |
| `docs/FUNDACAO-REGISTROS.md` | Contratos de registros/links/versões e critérios de segurança. |

Migrações SQL versionadas ficam em `supabase/migrations` (reversões em `supabase/rollback`). Mudar o banco exige autorização explícita; nada é aplicado automaticamente.


## Ver e testar localmente (modo de demonstração)

```powershell
npm ci
npm run dev
```

Abra `http://localhost:5173/compendio-5e/?demo=mestre` (ou `?demo=jogador`). Os dados ficam no localStorage do navegador e são compartilhados entre os dois papéis: publique um registro como mestre e confira como jogador. O modo existe só no `npm run dev` e não entra no build de produção. Ele não usa Supabase; a persistência real do Diário, do Planejamento e da capa depende da migração proposta em `docs/propostas/0006_registros_meta.sql` (e da 0005), ainda não aplicada.


## Testes end-to-end e responsividade (Playwright)

```bash
npm ci
npx playwright install chromium          # Linux/CI: acrescentar --with-deps
npm run test:e2e:types                   # tipos da configuração, fixtures e testes
npm run test:e2e                         # todos os projetos; inicia/encerra o Vite
npm run test:e2e -- --project=celular     # apenas 390 × 844 px
npm run test:e2e -- --project=desktop --headed
npm run test:e2e:ui                      # depuração interativa
npm run test:e2e:report                  # abre o relatório da última execução
```

Não precisa de `.env.local`, credenciais nem de um projeto Supabase. A configuração reserva
`http://127.0.0.1:4187/compendio-5e/`, recusa reutilizar servidores existentes e sobrescreve
as variáveis Supabase com valores vazios. Se a porta estiver ocupada, encerre apenas o seu
servidor de teste ou escolha outra porta em `e2e/environment.ts` (a configuração a reutiliza).
Não aponte esses testes para produção.

Os cenários usam o modo de demonstração **já existente**, com dados sintéticos e contexto
novo a cada teste. A fixture bloqueia requisições HTTP/WebSocket para outras origens, bloqueia
service workers e falha se detectar tentativa de saída ou exceção não tratada. Não carregar
`storageState` de usuários reais, não usar `APIRequestContext` para contornar essa proteção e
não colocar tokens ou segredos nas fixtures. Os testes não publicam nem alteram o banco.

A matriz Chromium contém desktop 1440 × 900 e 1024 × 768, celulares emulados 390 × 844 e
320 × 740, além da transição 700/701 px. Cobre carregamento/recarregamento, recusa de ambiente
sem configuração, navegação mestre/jogador, campanha → Diário → Conta → campanha,
limites horizontais, acesso aos menus e capturas de início/Diário. A Iniciativa da `main`
ainda é um placeholder: o teste confirma essa limitação, não simula combate funcionando.

`playwright-report/` contém o HTML com capturas anexadas, inclusive em testes aprovados.
`test-results/` guarda screenshot, vídeo e trace em falhas; os dois diretórios são ignorados
pelo Git. O CI independente **E2E e responsividade** publica os artefatos por sete dias,
sem segredos, deploy ou merge automático. Vitest continua separado e exclui `e2e/**`.

### Limitações

- Demonstração em Vite dev não valida o build publicado nem login/recuperação reais, RLS,
  Storage, Realtime, concorrência ou isolamento de dados de produção. Os testes existentes
  de PGlite/Vitest continuam necessários; execute também `npm run build` e `npm test`.
- Não cobre funcionalidades dos PRs #74/#75 ainda ausentes da `main`, nem criador, ficha,
  inventário, Compêndio ou permissões da Enciclopédia. Não usar resultado verde como aprovação
  desses fluxos. Nenhum módulo de domínio foi alterado para os testes.
- Emulação Chromium não equivale a Android/iPhone físico, Safari/WebKit ou Firefox. Capturas
  são evidência para revisão, sem comparação pixel a pixel; não garantem ausência de todos
  os cortes/overflows internos. Divisões 50/50 e 30/70, arraste de abas e editor rico ficam
  para uma ampliação específica da suíte.
- Sem esperas fixas ou retries automáticos para esconder falhas: os testes aguardam condições
  observáveis com assertions do Playwright e usam nomes acessíveis. Mudanças reais de UX ou
  nos dados de demonstração podem exigir atualizar o contrato testado.
- Em Windows com sandbox restringindo a leitura dos diretórios pais, o esbuild pode falhar
  antes de abrir o Vite (`Cannot read directory ...: Acesso negado`). Não é uma aprovação dos
  E2E: execute em ambiente com a leitura necessária ou no CI Linux. Para build/Vitest nesse
  ambiente, `npm run build -- --configLoader runner` e
  `npm test -- --configLoader runner --maxWorkers=2` evitam o empacotamento da configuração;
  isso não elimina a restrição do otimizador de dependências do Vite dev.


## Qualidade — segunda etapa (PR dependente do #76)

A branch `test/quality-stage-2` depende de `test/playwright-e2e` no commit `33eab06`.
Seu PR aponta para a branch do #76 para apresentar só o incremento; **integrar o #76 primeiro**
e então revisar/retargetar para `main`, sem copiar ou reaplicar os arquivos da infraestrutura.
Não incorpora os desenvolvimentos #74/#75. Escopo e resultados: [QUALIDADE-ETAPA-2](docs/QUALIDADE-ETAPA-2.md).

```bash
npm ci
npx playwright install chromium          # Linux: --with-deps
npm run test:e2e:types
npm run test:quality                     # 320, 360, 390, 700, 701, 768, 1024, 1440 px
npm run test:quality -- --project=qualidade-1440
npm run test:quality:ui
npx playwright show-report playwright-report/quality
```

A configuração importa o servidor, isolamento, navegador e proteção de rede do #76. Os arquivos
`*.quality.ts` não entram nos 36 testes originais nem no Vitest. O CI executa as duas etapas;
relatórios/capturas ficam separados. Axe verifica semântica/contraste automaticamente, não substitui
NVDA/VoiceOver. Teclado e divisões 50/50 e 30/70 usam a interface real; não se injeta o workspace.
As divisões proporcionais são exercitadas em 1024/1440 px, respeitando o mínimo de 220 px por coluna.
Métricas de rede, tarefas longas e mutações DOM são anexadas como diagnóstico, **sem orçamentos de
tempo/bytes arbitrários**; mutações não são contagem de renders React e Vite dev não mede desempenho
de produção. A proteção de rede desativa o cache HTTP do navegador; não usar esses números como
benchmark de cache. As demais limitações e o bloqueio local do Windows continuam válidos.


**Histórico da segunda etapa:** a primeira execução confirmou defeitos reais de teclado/foco e
violações axe. Correções isoladas ficam em `ContextMenu` e no menu de `Mobile`; não alteram
regras, dados ou módulos das outras frentes. Contraste e divergências de nomes acessíveis
continuam registrados em Q2-04/Q2-05. O teste axe permanece estrito e o CI da segunda etapa
não deve ser anunciado como aprovado enquanto esses achados existirem. Consulte o relatório
para resultados por execução e evidências; o PR permanece em rascunho.


A revisão de Q2-04/Q2-05 ajusta somente cores de texto e a origem dos nomes acessíveis,
com regressões para restauração/renomeação de abas e privacidade do layout persistido.
A auditoria continua estrita; resultados atuais e evidências ficam no relatório de qualidade
acima e nos checks do PR #77. Não presumir aprovação a partir dos resultados históricos.

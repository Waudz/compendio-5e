# Transferência para o Codex — 27/11/2026

## Estado verificado no encerramento

- Repositório: Waudz/compendio-5e. Produção: https://waudz.github.io/compendio-5e/ . Supabase: `gwcttjlxzelzjhbuitmi`. Prazo: **12/12/2026**.
- Main: **d0569111051b515d5cc3c16ea93b58d0ac673c92**, documentação após #164. Último código funcional integrado: **09e1c466c79b95c80a09596e6246dc7f36a2c672** (#164); #163 está integrado em 9ce404a.
- Publicação confirmada pela execução **45948379980** sobre d056911: jobs preparar/publicar aprovados, passo `actions/deploy-pages@v5` aprovado. E2E da main **45948379953** aprovado. Isto comprova a publicação pelo workflow; não substitui teste manual atual no aparelho de um jogador.
- **PR #165**, branch `fix/alpha-jogadores-primeiro-acesso`, HEAD **bb2aa0cf5ad2cf8ed4b2510a7f527af883664246**, base main d056911: aberto, pronto para revisão, sem conflitos na última consulta. **Não integrado nem publicado.**
- Commits da sessão: `a79971f3059ae1996aa1081007ecb084c34fe973` (cadastro/conta/menu), `a85dd7876120e18efdda4ec22227d43ce12f8a97` (foco/rota própria e E2E), `bb2aa0cf5ad2cf8ed4b2510a7f527af883664246` (espera correta da navegação nos testes).
- Branch deste relatório: `docs/transferencia-codex-alpha-20261127`, baseada em bb2aa0c. Apenas documentação, PR dependente de #165; integrar primeiro #165, depois retargetar a documentação à main. Não confundir esta branch com uma correção da ficha.
- Outros PRs abertos: #117 upload-artifact 4→7, #118 configure-pages 5→6, #119 grupo de seis dependências, #120 @types/node 22→26. Não revisados/atualizados nesta entrega; não são dependências funcionais de #165.
- Issues abertas relevantes: #96 (rascunho/equipamentos/fluxo), #99 (edição durante requisição), #100 (defaults/rascunho incompleto), #135 (Início), #136 (anotações, com biblioteca/menções agora adiadas), #134 (encontros), #104 (referência futura Duality), #29 (quadro). Não encerrar issues com múltiplos critérios por um teste parcial.

## CI do HEAD final do PR #165

Todos os workflows aprovados em **bb2aa0c**:

| Verificação | Evidência | Resultado |
|---|---|---|
| Validar projeto | run 45996799154, job 140498149048 | build/tipos e suíte unitária aprovados; 1807 testes em 150 arquivos no HEAD de aplicação a85dd78, sem mudanças de aplicação no bb2aa0c |
| Alpha Supabase isolado | run 45996799173, job 140498241024 | 19 cenários reais Auth/REST/JWT/RLS/Storage/concorrência/expiração aprovados |
| Preview experimental | run 45996799148 | aprovado, artefato de demonstração, não produção |
| Base Playwright | run 45996799143, job 140498209723 | **160 aprovados, 20 condicionais** |
| Quality Playwright | mesmo run, job 140498209838 | aprovado; bateria anterior a85dd78: 88 aprovados, 32 condicionais |
| Creator Playwright | mesmo run, jobs 140498209665/140498209711 | ambos aprovados; bateria anterior a85dd78: 140 aprovados, 4 condicionais |

Os condicionais são skips existentes por viewport/contexto, não testes aprovados. CI final íntegro registrado na conversa do PR #165; não é preciso repetir a investigação das falhas antigas.

Local: build TypeScript/Vite e tipos E2E aprovados; `check-build-oficial` aprovado (46 arquivos); `node --test scripts/alpha/local-only.test.mjs` 4/4; sintaxe Node do script real aprovada. Regressões de navegação/criador/menu executadas durante a implementação. A bateria completa local teve inicialmente uma expectativa histórica de cadastro fechado falhando; corrigida e confirmada no CI completo. Navegador local indisponível (Playwright sem binário e Chromium do sistema incompleto), sem Docker: navegador e stack real foram executados no GitHub, não simulados como testes locais reais.

Falha corrigida: a85dd78 teve sete falhas Base. `navigate()` usava count() instantâneo antes de barra/papel carregarem após F5/auth e procurava Iniciativa/Compêndio dentro do menu novo. bb2aa0c espera os atalhos inferiores corretos com a autoespera do Playwright. **Sem alteração de timeout, retries ou asserções de persistência.** Novo run Base 160/20 aprovado.

## Entregue nesta sessão (#165)

Cadastro aberto no cliente (a main ainda bloqueava antes do SDK), confirmação/reenvio/recuperação e convite; nome editável no profiles existente, refletido nos participantes montados; nenhuma alteração de nomes de personagens; preservação de texto digitado durante o salvamento e guardas de saída; solicitação de mudança de e-mail pelo Auth com confirmação; senha existente preservada.

Menu compartilhado: mobile sem botão no topo, mantendo Menu inferior, sino/retorno/ocultar barras; destaque da página separado do menu; ações por papel e campanha, grupos discretos, sair e versão. Desktop usa o mesmo menu a partir do cabeçalho. Minha conta, Configurações e Sobre separados; tema preserva a chave salva; versão vem de package.json via `src/version.ts`; créditos/licenças/repositório/aviso de fãs. “Meus personagens” tem rota própria estável e filtro do dono nos dois tamanhos. Menu não captura o teclado de confirmação de alterações não salvas acima dele.

Arquivos de aplicação: src/auth.ts, AuthGate.tsx, AccountPanel.tsx, profiles.ts, CampaignPanels.tsx, GlobalMenu.tsx, version.ts, Mobile.tsx, App.tsx, Panel.tsx, workspace.ts, style.css. Testes: auth/profiles/GlobalMenu, etapa1, App, navegação/mobile/campanhas/criador; e2e/fixtures.ts, creator/helpers.ts, menu-global.spec.ts, navigation/responsive e Quality acessibilidade/chrome/layout. Stack: scripts/alpha/prepare-local.py e run-local.mjs. Documentação: README, DEC-035/036, continuidade, ALPHA-JOGADORES-20261127 e roteiro.

Não implementado: foto da conta, novas Anotações do jogador, correção do relato de ficha desktop, marcar todas as notificações. Nenhum merge, deploy, migração ou escrita de dados de produção executado nesta sessão.

## Supabase real, somente leitura

0017 (20261127022534), 0018 (20261127022540), 0019 (20261127022547) e **0020 (20261127053526) aplicadas**. As seções antigas que as chamam de propostas são históricas. Nenhuma migração nova criada nesta sessão; “0021 prevista” na retomada após #164 não significa arquivo existente ou migração aplicada.

Profiles: id/display_name/created_at, SELECT autenticado conforme RLS, único UPDATE concedido em display_name. RLS de UPDATE exige id=auth.uid(). Não existe coluna/contrato de avatar da conta. RLS ativa em profiles, notes, character_sheets, campaign_combats e campaign_encounters. Políticas de combate/encontro exigem is_master(campaign_id); fichas permitem dono membro ou mestre. Não flexibilizar.

Consulta agregada específica para o relato da ficha: **7 fichas, 0 divergências de proprietário entre notes/character_sheets, 0 donos fora da campanha**. Não foram consultados nomes, e-mails, conteúdos ou IDs individuais dos usuários. Esse resultado elimina a hipótese de divergência entre as duas tabelas nos registros atuais, mas **não prova que a conta que relatou o problema é a proprietária do registro aberto**.

Advisors: quatro tabelas encyclopedia com RLS sem policy (negação padrão); 35 funções SECURITY DEFINER executáveis por authenticated (não revogar indiscriminadamente; conferir autorização interna); proteção de senhas vazadas desativada. Detalhes e URLs de remediação em ALPHA-JOGADORES-20261127. Nenhuma configuração alterada. Contas externas já existem: os dados NÃO são descartáveis.

## Investigação do novo P0 — ponto exato de parada

**Somente inspeção, nenhuma correção implementada ou teste novo escrito. Causa raiz ainda não reproduzida.** A branch local `fix/ficha-propria-desktop` foi criada sobre bb2aa0c, sem alterações de código; não há trabalho nela para recuperar. Continuar a partir do remoto #165/da main se já integrado, não depender desse nome local.

- A frase relatada é emitida por `CartaoPublicoGuiado` em **src/Personagens.tsx**, chamado por `FichaPagina` para guiado quando `reg.ownerId !== user?.id` e não é mestre com API de fichas da campanha. Não concluir que basta remover esse teste.
- **src/FichaRoteada.tsx** consulta `fichas.listar(campaignId)` antes de escolher `CriadorGuiado initialView`; se a ficha não está na lista cai em `FichaPagina`. Erro de listagem gera aviso, não fallback silencioso. Investigar por que o caminho público foi escolhido na sessão relatada.
- **src/fichas.ts** mapeia character_id→id e owner_id→ownerId; listar é filtrado pela campanha com RLS. **src/registros.ts** mapeia owner_id→ownerId. **src/criador/repositorio.ts** só carrega a ficha se campaignId coincide e calcula somenteFicha pelo dono.
- **src/CampaignHome.tsx** abre ficha para `a.meu && !mestre`; demais abrem carta de identidade. `src/personagensCampanha.ts` combina notas/fichas pelo mesmo ID, meu por ownerId. `src/Personagens.tsx` lista abre kind=ficha. `IdentidadePagina` em **src/compendio/Paginas.tsx** disponibiliza Ver ficha ao dono/mestre. Verificar todos os caminhos, inclusive Compêndio e abas restauradas.
- Desktop `App.tsx` factory/Panel/CartaHost (src/compendio/ConsultaCarta.tsx); mobile renderiza Panel diretamente. CartaHost só intercepta consultas narrativas (registro/identidade/magia/regra/item), não ficha. AuthProvider é comum no main.tsx; Workspace tem chave user.id. Isto é inspeção, não prova de ausência de erro de contexto/estado.
- Testes existentes em **src/criador/persistenciaServidor.test.tsx** já verificam mestre abrindo ficha, outro jogador vendo cartão e lista sem duplicação. **Falta reproduzir o relato do dono no desktop com matriz de entradas.** Há fixtures úteis: fichasEmMemoria/novoBancoFichas, registrosEmMemoria, renderApp; exemplos do mock de dimensões desktop no mesmo arquivo. Não confundir essas fixtures com RLS real; o CI isolado já testa privacidade/atualização por JWT.

Próxima ação: reproduzir com dono/mestre/outro jogador, desktop e celular, pelos quatro acessos (menu, Compêndio, lista, Início), capturando no teste o TabSpec final, usuário ativo e IDs/ownerIds sintéticos. Se não reproduzir, acrescentar diagnóstico seguro sem dados privados e solicitar somente o dado de conta/registro realmente necessário; não fazer correção especulativa de RLS nem tornar fichas públicas.

## Planejamento preservado e classificação

A especificação completa para a próxima execução está em **PROMPT-CODEX-ALPHA-20261127.md**. A tabela abaixo classifica o trabalho; não usa percentuais.

| Prioridade / tarefa | Estado | Dependência / limite |
|---|---|---|
| Publicação #163/#164 e 0020 | Concluída e publicada | Evidência de main/Pages/migrações acima; sem certificar toda Alpha |
| Cadastro reaberto no frontend, convite, recuperação | Concluída, aguardando publicação | #165; confirmação por caixa postal real e primeiro acesso completo ainda em validação |
| Menu responsivo, duplicação mobile, Configurações/Sobre | Concluída, aguardando publicação | #165; sem prévia global fictícia |
| Minha conta (nome/e-mail/senha) | Parcialmente implementada | Nome/e-mail #165; foto não iniciada; método Auth e confirmações devem ser validados no ambiente autorizado |
| Própria ficha desktop — novo P0 | Em validação | Investigação acima, sem causa reproduzida/correção; não alterar permissões |
| Notificações: marcar todas como lidas — P1 | Não iniciada | Preservar visual e leitura individual; usuário/campanha; banco/contador/erro |
| Novas Anotações do jogador — P1 | Não iniciada | Decisão aprovada; preservar notas existentes e quadro do mestre |
| Cadastro/login/sessão/convites/campanhas (fluxo completo real) | Em validação | Backend isolado aprovado; caixa postal/dispositivos/produção não certificados |
| Criador SRD 2014 | Parcialmente implementada | #100 defaults ainda presentes; validar todas as opções oferecidas sem inventar dados |
| Rascunhos/concorrência/equipamento | Parcialmente implementada | #96/#99; recuperação contínua e preservação durante save já existem; conferir os critérios restantes |
| Ficha/inventário/subida/recursos | Parcialmente implementada | Fluxos já existem e têm testes; novo P0 e validação completa pendentes |
| Segurança/RLS/Storage/isolamento | Em validação | 19 cenários isolados aprovados, políticas reais inspecionadas; ampliar por mudança, sem testar escrita em produção |
| Integração mestre + dois jogadores / aparelhos | Em validação | Contas sintéticas reais no CI; completar fluxos independentes e dispositivo físico |
| Pendências UI após #164 | Parcialmente implementada | Abas/status da ficha, vínculos de aventureiros e residência/naturalidade, permissões mestre na identidade, controles de dois grupos |
| Roteiro e documentação de transferência | Concluída, aguardando publicação | Roteiro em #165; este relatório/prompt na branch de documentação |
| Aplicar eventual migração / publicar novas correções | Bloqueada | Requer autorização específica; não bloqueia preparação de código/testes em branch |
| Anotações do mestre, encontros/loot, PWA e acervo 1.0 | Não iniciada nesta etapa | Planejamento histórico preservado, não começar antes dos bloqueadores atuais; recuperação das imagens continua obrigatória |

Sem feedback interno, chamados, painel administrativo de usuários, telemetria adicional, biblioteca central, menções universais, colaboração, novos encontros/PWA, outros sistemas ou Assimilação nesta rodada.

## Entrega e retomada

O código desta sessão está no GitHub, não apenas no executor. O worktree desta entrega não tem alterações de código pendentes; node_modules é uma ligação local de dependências, não um arquivo do projeto. Worktrees antigos de outras etapas não são base confiável para retomar: usar clone/worktree limpo a partir dos SHAs remotos. Não apagar nem sobrescrever arquivos antigos automaticamente.

Não foi solicitado nem feito merge/deploy/SQL de produção. Não há autorização genérica para publicar #165 ou aplicar futuras migrações. A próxima execução pode preparar correções e testes com autonomia; pedir autorização importante somente quando houver uma entrega concreta e verificável pronta para a ação protegida.

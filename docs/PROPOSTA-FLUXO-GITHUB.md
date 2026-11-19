# Proposta de fluxo no GitHub — 19/11/2026

> **Somente proposta.** Nada foi alterado nas configurações do repositório (proteção de branch, segurança, Projects, Dependabot) nem criado em `.github/`. Itens marcados **[você]** só o dono do repositório consegue aplicar no GitHub; **[arquivo]** vira um PR pequeno depois da sua aprovação. Escala: projeto de **uma pessoa responsável** + assistentes (Claude Code, ChatGPT/Codex) que abrem PRs.

## 1. Estado atual (verificado em 19/11/2026)
- Repositório **público**, branch padrão `main`; **Issues e Projects habilitados**, Wiki e Discussões desligadas.
- **`main` sem proteção** (a API informa `protected: false`, sem verificações obrigatórias): qualquer push direto na `main` publicaria o site.
- `.github/` só tem os fluxos de trabalho `validar.yml` (TypeScript, build e testes em PR e na `main`) e `pages.yml` (**publica a cada push na `main`**, sem depender do `validar.yml`).
- **Sem** modelo de PR, modelo de issue, `CODEOWNERS` ou `dependabot.yml`. Rótulos são só os padrão do GitHub. 28 PRs no histórico, 4 abertos (#25–#28), 5 issues abertas e ~29 branches remotas (a maioria de PRs já integrados).
- O segredo do Supabase **não** está no repositório (chave pública no fluxo; há teste que varre o código).

## 2. Proposta enxuta (cabe em uma tarde)
### 2.1 Proteção da `main` — **[você]**, em *Settings → Rules → Rulesets* (ou *Branches*)
Regras recomendadas, sem exigir aprovação de revisor (você é o único revisor):
1. **Exigir pull request** para entrar na `main` (bloqueia push direto). Aprovações exigidas: **0** (a sua decisão é o botão de merge).
2. **Exigir a verificação `Validar projeto`** (job `validar`) verde e a branch atualizada.
3. **Bloquear force-push e exclusão** da `main`.
4. Opcional: histórico linear e *squash merge* como único método; **apagar a branch após o merge** (*Settings → General*).
5. Deixar **administradores com contorno** ligado só se precisar de emergência; registrar o uso.
Efeito: nenhum assistente (nem você por engano) publica sem PR verde; o merge continua manual, como nas regras do projeto.

**Ligado ao deploy:** `pages.yml` roda a cada push na `main`. Com a proteção acima isso só acontece por merge de PR verde. Para não depender só da proteção, **[arquivo]** acrescentar `npm test` ao job de deploy (ou chamar `validar.yml` via `workflow_call`/`needs`). Não altera o ambiente nem os segredos.

### 2.2 Modelo de Pull Request — **[arquivo]** `.github/PULL_REQUEST_TEMPLATE.md`
Seções curtas e obrigatórias, espelhando o que já pedimos nos PRs #27/#28:
- **Objetivo** (1–2 frases) e **Fora do escopo**.
- **Alterações** (lista) e **Branch/commit**.
- **Validação executada** com caixas: `tsc -b`, `npm test` (nº de testes), `npm run build` (tamanho do bundle antes/depois), **teste manual** (desktop/celular, o que **não** foi testado).
- **Banco/Supabase:** `Nenhuma alteração` / `Migração proposta nº ____` (e que **não foi aplicada**) / `Migração aplicada com autorização de ____`.
- **Segurança e permissões** (RLS, dados de outra campanha, segredos).
- **Riscos de regressão** e **o que ainda precisa de aprovação**.
- Linha fixa: *"Não autoriza merge, publicação nem alteração do Supabase."*
Um segundo modelo `.github/PULL_REQUEST_TEMPLATE/migracao.md` (número da migração, rollback, testes PGlite, ordem de aplicação) para PRs que tocam `supabase/`.

### 2.3 Issues — **[arquivo]** `.github/ISSUE_TEMPLATE/`
Três formulários e nada mais: **Bug** (passos, esperado/obtido, navegador/dispositivo), **Funcionalidade ou decisão** (problema, critérios de aceitação, "o que NÃO fazer") e **Tarefa técnica** (contexto, escopo, validação). Desligar issues em branco (`config.yml`). A Issue #29 já segue esse formato.
**Rótulos** (substituir os de exemplo por poucos e úteis) — **[você]**: `tipo: bug`, `tipo: funcionalidade`, `tipo: decisão`, `tipo: tarefa`; `área: navegação`, `área: planejamento`, `área: encontros`, `área: banco`, `área: mobile`, `área: docs`; `precisa de decisão`, `bloqueado`, `risco: banco` (PR que mexe em RLS/migração); `prioridade: alta`.
**Marcos (*milestones*)** por etapa do roteiro (ex.: "Etapa 2: Planejamento mínimo") com data opcional.
**Convenções:** PR referencia a issue com `Closes #N`; migrações reservam o número numa issue `risco: banco` antes de abrir o PR (evita a colisão de "0005" vista em 19/11).

### 2.4 GitHub Projects — **[você]**
**Um único projeto** (*Projects → New project → Board*), "Compêndio 2.0", com 6 estados: **Backlog · Precisa de decisão · Em andamento · Em revisão (PR aberto) · Validação manual · Concluído**. Campos: *Área* e *Prioridade*. Ativar os fluxos automáticos nativos (item novo entra no Backlog; PR aberto → *Em revisão*; fechado/mesclado → *Concluído*). Adicionar as issues e os PRs automaticamente. Sem automações personalizadas, sem Actions extras, sem várias visões: uma visão em quadro e uma em tabela por área bastam. *Precisa de decisão* é a coluna que o responsável olha primeiro (espelha as listas "decisões que precisam de aprovação" dos relatórios).

### 2.5 Dependabot — **[arquivo]** `.github/dependabot.yml`
- Ecossistemas: **`npm`** e **`github-actions`**, semanal (segunda-feira), no máximo **5 PRs abertos**, rótulo `dependências`, PRs **agrupados** (um por semana para atualizações menores/de patch).
- **Ignorar atualizações maiores** (major) de `react`, `react-dom`, `flexlayout-react`, `@blocknote/*` e `@mantine/*` e das bibliotecas pré-1.0: essas passam por decisão manual e pelo protótipo, não por PR automático.
- Atualizações de **segurança** são independentes: **[você]** ativar em *Settings → Code security*: alertas do Dependabot, atualizações de segurança do Dependabot, **varredura de segredos com *push protection*** (gratuito em repositórios públicos) e, se desejar, a varredura de código (CodeQL). Não exigem arquivo no repositório.
- Cada PR do Dependabot passa pelo mesmo `Validar projeto`; **nunca** se mescla sem a verificação verde.

### 2.6 Outros ajustes pequenos
- **`CODEOWNERS`** (**[arquivo]**): `* @Waudz` e `/supabase/ @Waudz`, para que mudanças em banco peçam revisão explícita.
- **Permissões do `GITHUB_TOKEN`** dos fluxos em somente leitura por padrão (*Settings → Actions → General*); `pages.yml` já declara o que precisa (`pages: write`, `id-token: write`).
- **Higiene de branches:** apagar após o merge (automático) e limpar as ~20 branches de PRs já integrados, **só com sua autorização**.
- **Nomes de branch:** `feat/`, `fix/`, `docs/`, `proto/`; um assunto por branch; PRs pequenos (o que já fazemos).
- **Etiqueta "prévia":** hoje só a `main` publica; uma prévia por PR exigiria outro destino de publicação e fica **fora** desta proposta.

## 3. O que seria criado (se aprovado) — um PR só, sem tocar em código do aplicativo
`.github/PULL_REQUEST_TEMPLATE.md`, `.github/PULL_REQUEST_TEMPLATE/migracao.md`, `.github/ISSUE_TEMPLATE/{bug,funcionalidade,tarefa}.yml` e `config.yml`, `.github/dependabot.yml`, `.github/CODEOWNERS`, e a mudança de `pages.yml` (rodar `npm test` antes de publicar). Tudo reversível apagando os arquivos.

## 4. O que **eu não faço** sem autorização
Alterar proteção de branch, rulesets, segurança do repositório, segredos, Projects ou rótulos; apagar branches; mesclar PRs; mudar o fluxo de publicação. Os itens **[você]** acima exigem acesso de administrador no GitHub.

## 5. Ordem sugerida de adoção
1. Proteção da `main` (2.1) — o ganho de segurança maior, 5 minutos.
2. Segurança do repositório (2.5, só os botões de *Code security*).
3. Modelo de PR e de issues + rótulos (2.2, 2.3).
4. Project com 6 estados (2.4).
5. Dependabot e `CODEOWNERS` (2.5, 2.6).

# Configuração do GitHub — o que está no repositório e o que só o dono pode ligar

> Complementa `docs/PROPOSTA-FLUXO-GITHUB.md` (PR #30). Este documento descreve **o que foi implementado** em arquivos e o **procedimento manual** para o que depende de configuração administrativa. **Nenhuma configuração administrativa foi alterada** por este PR.

## 1. Já no repositório (arquivos)
| Arquivo | Efeito |
|---|---|
| `.github/workflows/validar.yml` | Verificação única (TypeScript + build + testes, PGlite inclusive). Roda em todo PR e é **reutilizável** (`workflow_call`). `contents: read`, `persist-credentials: false`, cancela execuções antigas do mesmo PR. |
| `.github/workflows/pages.yml` | A publicação **depende** da validação: o job `deploy` tem `needs: validar`, e `validar` chama `validar.yml`. Se qualquer etapa falhar, **o deploy não é executado**. Só o job `deploy` tem `pages: write` e `id-token: write`; nenhum job escreve no repositório (`contents: read`). |
| `.github/PULL_REQUEST_TEMPLATE.md` | Modelo padrão (objetivo, validação executada, banco, segurança, riscos). |
| `.github/PULL_REQUEST_TEMPLATE/migracao.md` | Modelo de migração (usar com `?template=migracao.md`). |
| `.github/ISSUE_TEMPLATE/*.yml` | Bug, funcionalidade/decisão e tarefa técnica; issues em branco desligadas. |
| `.github/dependabot.yml` | npm e GitHub Actions, semanal, no máximo 5 PRs, atualizações menores agrupadas; **ignora versões maiores** de React, FlexLayout, BlockNote, Mantine, dnd-kit, Vite e TypeScript. |
| `.github/CODEOWNERS` | Mantenedor único (`@Waudz`) para tudo, com destaque para `supabase/`, `.github/` e a arquitetura. |
| `tests/fluxo-github.test.ts` | Teste que impede regressões: deploy sem `needs`, escrita desnecessária, modelos ausentes, Dependabot sem npm ou Actions. |

**Efeito prático:** mesmo que um commit chegue à `main` com testes falhando, o site **não é publicado**. Isso protege o deploy, mas **não substitui** a proteção da `main` (seção 2), que impede o próprio commit de entrar.

## 2. Procedimento recomendado — proteção da `main` (somente o dono; não aplicado)
*Settings → Rules → Rulesets → New branch ruleset* (ou *Branches → Add rule*):
1. **Nome:** `proteger-main`; **Enforcement:** Active; **Target:** `main`.
2. Marcar **Restrict deletions** e **Block force pushes**.
3. Marcar **Require a pull request before merging**; aprovações exigidas: **0** (um único mantenedor); opcional: **Require review from Code Owners** (usa o `CODEOWNERS`; com um mantenedor, só se houver outro revisor).
4. Marcar **Require status checks to pass** e adicionar a verificação **`validar`** (job do fluxo *Validar projeto*; ela só aparece na lista depois de ter rodado em algum PR). Marcar **Require branches to be up to date** (opcional).
5. **Bypass list:** deixar vazia (ou só o proprietário, para emergências, registrando o uso).
6. Em *Settings → General → Pull Requests*: permitir só **Squash merging**, marcar **Automatically delete head branches** e **NÃO** ativar *Allow auto-merge*.
7. Em *Settings → Actions → General*: **Workflow permissions = Read repository contents** (somente leitura), e marcar que o GITHUB_TOKEN **não** pode aprovar PRs.
8. Em *Settings → Code security*: ativar **Dependabot alerts**, **Dependabot security updates**, **Secret scanning** e **Push protection** (gratuitos em repositório público).
9. Em *Settings → Pages*, a fonte já é GitHub Actions; o ambiente `github-pages` pode exigir, em *Environments → github-pages*, que a publicação só ocorra a partir de `main` (*Deployment branches: Selected branches → main*).
> Não configuro merge automático nem altero essas opções pela API.

## 3. Como verificar depois de ligar
1. Tentar `git push origin main` direto → deve ser recusado.
2. Abrir um PR de teste → deve aparecer a verificação **`validar`** como obrigatória.
3. Forçar uma falha num PR de teste → o botão de merge fica bloqueado.
4. Confirmar na aba *Actions* que, após um merge, `Validar antes de publicar` precede `deploy`.

## 4. Convenções
Branches `feat/`, `fix/`, `docs/`, `proto/`, `infra/`; um assunto por PR; PR referencia a issue com `Closes #N`; migrações reservam o número no livro-razão (`supabase/migrations/LEIA-ME.md`) antes do PR.

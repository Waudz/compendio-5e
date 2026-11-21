# Plano de integração para publicação no site atual — 21/11/2026

## Objetivo
Publicar na `main` (GitHub Pages existente), **não** em site de prévia separado, o criador guiado, inventário, catálogo e navegação, após verificação. A Enciclopédia completa não é bloqueadora do primeiro lançamento.

## Responsabilidades e bloqueios
- Claude / PR #80: corrigir a migração 0008 (marcador `guiado` removível, notas excluídas e políticas), testar banco, enviar SHA. **Não aplicar SQL remoto antes da revisão final.**
- Codex / PR #79 + #77: executar Playwright/axe no HEAD integrado, corrigir C-E2E-01 e C-E2E-02, testar responsividade 320–1440px e reportar resultados.
- ChatGPT / PR #75: manter a fundação fechada da Enciclopédia, revisar integração e segurança, não liberar projeção pública sem RLS testada.

## Sequência de integração
1. Atualizar `main` com o PR #74 (auditoria SRD 2014), após CI.
2. Integrar PR #76 e #77 (testes e acessibilidade), resolvendo conflitos.
3. Integrar PR #78 (criador e navegação), preservando as correções de acessibilidade.
4. Integrar PR #80 corrigido e testes do PR #79. Validar que as migrations 0007/0008 representam o estado remoto real.
5. Executar TypeScript, build, testes unitários/PGlite e E2E/axe. Não suprimir testes para obter CI verde.
6. Aplicar **somente a migração 0008 revisada**, com verificação posterior das constraints, grants, RLS e fluxos de dono/mestre/terceiro/anon.
7. Fazer merge final na `main`, acionar o workflow existente `.github/workflows/pages.yml` e conferir a página publicada.

## Critérios mínimos para liberar
- Criação, edição, recarga e recuperação da ficha persistem corretamente.
- Dados privados (PV, inventário, atributos e notas) não vazam para outros jogadores.
- O mestre e o dono têm permissões conforme o contrato; ex-membro e anônimo não leem fichas.
- Catálogo/inventário, navegação e layout móvel funcionam sem erros críticos.
- CI e E2E aprovados; migração remota aplicada e verificada antes de habilitar o fluxo persistente.
- O site atual permanece disponível durante a preparação; não publicar recursos incompletos.

**Situação:** plano de integração; nenhum merge/deploy autorizado ou executado por este documento.

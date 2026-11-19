# Auditoria inicial para implementação do Planejamento — 19/11/2026

## Escopo e método
Inspeção estática de arquivos do repositório Waudz/compendio-5e na branch main e das decisões na branch de documentação. **Não foram executados build, testes, navegador, consultas ao banco ou verificações de CI**. Não representa auditoria exaustiva da árvore nem validação do aplicativo publicado.

## Evidências verificadas
| Área | Arquivo / evidência | Constatação |
|---|---|---|
| Stack | package.json | React 18, TypeScript, Vite, flexlayout-react, Supabase, Vitest e PGlite já constam como dependências. Nenhuma biblioteca de editor por blocos está declarada. |
| Workspace | src/App.tsx, src/persistence.ts | FlexLayout e persistência por usuário/campanha/dispositivo, com layout reduzido a ids/geometria/fixação. Reutilizar a infraestrutura de abas; não persistir títulos ou conteúdo sensível no layout. |
| Telas | src/Panel.tsx | Personagens, Enciclopédia e Documentos ainda usam exemplos e placeholders; não há editor real de páginas ou encontros nesses painéis. |
| Campanhas | src/campaigns.ts, src/CampaignPanels.tsx | Há acesso a campanhas e telas de administração; não é um módulo de planejamento de sessões. |
| Supabase | src/supabase.ts | Cliente único com autenticação persistente; não há evidência de API cliente de blocos/quadros. |
| Notas | docs/NOTAS-PERMISSOES.md | Migração 0004 já aplicada; notes e note_shares com RLS, visibilidade e controle otimista de versão. Ainda não existe editor nem cliente de notes; vínculos e audiências precisam de projeto/migração futura. |
| Navegação | DECISOES-E-ARQUITETURA.md §5; docs/NAVEGACAO-ABAS.md | Modelo de reutilização/fixação já documentado e parcialmente implementado; nova regra de links de conteúdo sempre em aba permanente requer reconciliação com handlers e testes. |
| Mobile | src/App.tsx; registro oficial | Shell mobile atual é diferente da navegação mobile aprovada posteriormente; não misturar implementação do quadro com refatoração integral do shell. |

## Divergências e riscos antes de implementar
1. **Documentação desatualizada:** docs/NAVEGACAO-ABAS.md ainda descreve clique normal em registro como reutilizável; decisão mais recente exige links de conteúdo abrindo nova aba permanente, sem duplicar registro já aberto. A regra de aba temporária do menu não deve afetar links internos.
2. **Modelagem de notes:** banco atual armazena título/corpo e visibilidade; blocos, hierarquia, quadro, posições, atalhos, registros rápidos, pendências e vínculos a encontros exigem desenho de dados. Não assumir que JSON de blocos, novas tabelas ou migração 0005 estão aprovados.
3. **Segurança:** atalhos, prévias, busca, exportação e referências não podem contornar RLS; vínculo nunca concede leitura. Exportação só inclui dados acessíveis ao usuário e não publica Diário automaticamente.
4. **Integridade:** quadro e árvore não podem duplicar o conteúdo da página; reordenar cartões não deve mover a origem. Um encontro preparado é modelo; execução de combate deve ter estado próprio.
5. **Concorrência e perda de dados:** registros feitos durante a sessão precisam de persistência confiável, estado de sincronização e resolução de conflitos; edição não salva deve proteger a aba.
6. **Escopo:** mobile mestre deve permitir consulta e captura rápida, mas não precisa reproduzir o quadro desktop. Evitar canvas infinito, colaboração em tempo real, VTT, automação total de combate e migração 2024 nesta etapa.
7. **Dependências de PR:** verificar estado e base dos PRs #25 e #26 antes de integrar. Este documento é somente documentação; não autoriza merge.

## Proposta de entregas pequenas — para revisão, não autorização de execução
**Fase 0 — Reconciliação e contrato:** revisar navegação atual e testes; especificar entidades de sessão, coluna, posição de cartão, página, referência, registro e pendência; definir ciclo de vida, RLS, escopos e migração com testes PGlite. Não aplicar SQL sem aprovação específica.

**Fase 1 — Editor mínimo:** avaliar biblioteca madura de blocos (licença, acessibilidade, tamanho, manutenção, segurança do HTML e mobile); protótipo local com título, parágrafo, lista, links, salvamento e recuperação; sem alterar Supabase até revisão do modelo.

**Fase 2 — Quadro e estrutura:** sessões, colunas livres, cartões verticais, compacto/expandido, ordenação e atalhos sem duplicação; árvore alternativa dos mesmos dados. Testar arraste, teclado, rolagem e limites de largura dentro de 1–3 painéis.

**Fase 3 — Registro rápido e exportação:** captura durante sessão, inclusive fora de cena; pendências; separação visual entre plano e acontecimento; exportação integral por sessão com filtros e cópia em texto/Markdown. Diário permanece manual e privado até publicação explícita.

**Fase 4 — Referências e encontros:** abrir NPC/local/documento/encontro em aba permanente; prévia de encontro e editor original; criação de instância de combate sem mutar encontro preparado; teste de referências inacessíveis e histórico.

**Fase 5 — Mobile mestre e validação real:** seções expansíveis, leitura, captura rápida, histórico por destino, recuperação após falha de rede; teste com preparação real de Julkoun e durante sessão.

## Critérios de qualidade por entrega
- CI, TypeScript, testes e build executados e reportados com evidências (não presumir sucesso).
- Testes de permissão com múltiplas contas/campanhas e tentativas de acessar links/exports sem autorização.
- Preservação do layout e das abas fixadas, sem perda de rascunho.
- Dados originais de encontros e páginas não são duplicados nem modificados ao criar referências.
- Sem mudanças no legado Waudz/rastreador-dnd; sem merge, deploy ou alteração do Supabase sem autorização expressa.

## Próximo trabalho adequado ao Claude Code
Depois da revisão desta auditoria, usar Claude Code para **análise técnica e proposta de schema/editor** em branch isolada, sem migração aplicada, sem merge e sem deploy. Solicitar diff pequeno, testes e evidências, e retornar com riscos e perguntas que realmente bloqueiam a implementação.

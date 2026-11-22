# Auditoria pós-integração — 22/11/2026

> Registro de revisão documental e plano de validação. **Não é comprovação de execução de testes manuais**, nem substitui o CI. Base conferida: `main` em `ebab8d47e4339a08405c097255f576a501723708`.

## Evidências verificadas

- PRs #92, #93, #94 e #75 integrados; #87 substituído; nenhum PR aberto na consulta após os merges.
- CI pós-merge: [execução 45061962169](https://github.com/Waudz/compendio-5e/actions/runs/45061962169), `success`, SHA `ebab8d4`.
- GitHub Pages: [execução 45061962208](https://github.com/Waudz/compendio-5e/actions/runs/45061962208), `success`, mesmo SHA.
- Correções do criador, legado, recuperação e mobile: [documentação do PR #92](CORRECAO-CRIADOR-UNICO-PR92.md) e [integração](INTEGRACAO-PRS-2026-11-22.md).
- Enciclopédia #75: **contratos e testes apenas**, sem API persistente nem migração remota; ver [revisão](REVISAO-INTEGRACAO-ENCICLOPEDIA-PR75.md).

## Inconsistências documentais a reconciliar antes de delegar novas implementações

1. `README.md` ainda afirma que o PR #74 está em desenvolvimento e que o catálogo/criador não estão publicados. Isso é um **registro histórico desatualizado** frente aos merges de #84/#85/#92; não usar essa seção para inferir estado atual.
2. `docs/CONTINUIDADE-DESENVOLVIMENTO.md` ainda descreve PR #74 como aberto e Playwright como planejado. O índice deve ser revisado sem apagar o histórico.
3. `docs/STATUS-FUNCIONALIDADES-V2.md` e o começo de `docs/PLANEJAMENTO-V2.md` contêm estimativas e descrições de 20–21/11 anteriores à integração. **Não recalcular percentuais sem auditoria funcional**.
4. `docs/NOTAS-PERMISSOES.md` descreve banco `0004` aplicado, mas cliente/editor ainda ausentes no status de abertura do documento. Revalidar contra código e banco antes de afirmar que notas funcionam ponta a ponta.
5. `docs/NAVEGACAO-ABAS.md` §6 aponta verificação pendente para gestos em links internos e descoberta de fixação. Testes novos de chrome mobile não demonstram, por si, resolução desses itens.
6. `DECISOES-E-ARQUITETURA.md` traz DEC-20261122-D proibindo distribuição de loot e, acima, uma decisão posterior que **revoga essa proibição**. A decisão posterior prevalece; o texto histórico deve ser marcado como substituído em futura consolidação.
7. O nome atual do repositório e descrições históricas falam em D&D, mas a diretriz de produto acordada é **plataforma sem sistema padrão**: sistema/edição por campanha; D&D 2014 é a primeira implementação, não a escolha universal.

## Divisão de trabalho e testes

**Usuário — criação de personagem no site publicado** (não duplicar esforço): Guerreiro e classe conjuradora; escolhas incompletas; equipamento inicial; inventário; salvar, reabrir, editar; progressão; fichas antigas; celular e desktop. Registrar navegador, largura, conta de teste, passos, resultado esperado/obtido e captura; **não incluir dados privados no relatório**.

**Revisão independente — anotações e workspace** (a executar; não declarar aprovado):
- Duas notas do mesmo autor: privada e compartilhada; conta A e B na mesma campanha; conta C fora. Conferir leitura, busca, compartilhamento e edição após saída, respeitando o estado real das migrações.
- Duas abas de anotações em painéis distintos; digitar sem salvar em uma, navegar na outra; confirmação ao fechar, trocar campanha, sair e recarregar.
- Dividir uma aba única; criar painel vazio; preencher; redimensionar; fixar; fechar; restaurar após recarga; trocar usuário/campanha; nunca revelar títulos de outra conta.
- Em celular: navegação sem arraste de colunas, toque prolongado, menu de opções acessível, barras ao rolar e ausência de sobreposição.
- Clique normal, Ctrl/Cmd+clique, botão do meio e menu de contexto **nos links dentro dos painéis**, não só no menu lateral.
- Se não houver editor real ou endpoint seguro, classificar como **não implementado**, nunca como teste aprovado.

**Segurança da Enciclopédia — bloqueio de liberação:** comparar esquema remoto efetivo; preparar migração **incremental, não destrutiva**, rollback e testes com duas sessões reais (mestre/jogador, revogação, busca/count, hidden/summary/full). Nunca aplicar rascunhos CREATE TABLE do PR #75 no remoto.

## Ordem recomendada

1. Receber resultados manuais do criador; corrigir bugs reprodutíveis antes de ampliar regras.
2. Auditar anotações e workspace pelo código atual e pelos testes, distinguindo UI demonstrativa de persistência real.
3. Atualizar índice/README/status com fatos conferidos, sem apagar decisões antigas.
4. Planejar implementação vertical de anotações + divisão de telas, ferramentas universais para qualquer sistema.
5. Enciclopédia persistente somente após migração revisada, autorização e testes de isolamento.
6. Identidade visual por sistema e tema claro/escuro **depois** da estabilidade funcional.

## Limites desta rodada

Auditoria de fontes no GitHub e documentação; **não foram executados** testes manuais com contas reais, inspeção do Supabase remoto, alterações SQL, merge, deploy ou mudanças no Assimilação. Este documento propõe verificações, não declara bugs novos comprovados na produção.

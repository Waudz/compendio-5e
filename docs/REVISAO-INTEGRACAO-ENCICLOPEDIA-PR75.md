# Revisão de integração do PR #75 — 22/11/2026

## Escopo aprovado para integração
Contratos puros, testes e propostas de segurança compatíveis com main após #74/#84/#85. Não introduz interface, migração executável, endpoint nem conexão do app com os rascunhos. O adaptador de lixeira aponta RPC histórica substituída e está explicitamente obsoleto; não deve ser ligado à UI.

## Revisão de segurança
Hidden não produz publicação nem metadados para jogadores. Summary publica nome/resumo sem descrição; full acrescenta somente descrição pública explícita. Notas do mestre, vínculos mecânicos, inventário, PV e histórico ficam em tabelas privadas; busca/count usam apenas a projeção. RLS deriva campanha/papel de auth.uid()/is_member/is_master; nenhuma alegação do navegador serve como autoridade. Trigger de sincronização privado SECURITY DEFINER tem search_path vazio, EXECUTE/USAGE revogados, valida origem e agora revalida autenticação/papel do mestre. Operações são atômicas; erro na projeção reverte origem. Hard delete não concedido; estado de lixeira e autor derivados no servidor. Não há Realtime.

## Metadados remotos, somente leitura
Projeto Compêndio 2.0 gwcttjlxzelzjhbuitmi: quatro tabelas encyclopedia_* com RLS, zero policies, sem SELECT para anon/authenticated e sem publicação Realtime, conferidas em 22/11/2026. Nenhum registro de usuário lido ou gravado. Fundação permanece fechada. CREATE TABLE dos rascunhos não é compatível com reaplicação no remoto: nunca executar esses arquivos como migração.

## Verificação e pendências
68 testes de contratos/SQL existentes passaram antes dos novos negativos. Foram acrescidos testes SQL de ausência de ID/título/count, busca summary, projeção full sem segredos, mestre de outra campanha, identidade imutável, escrita direta proibida e Realtime fechado. CI final e resultados no PR #75. Esses testes usam papéis PostgreSQL em PGlite descartável; não são login remoto nem ensaio concorrente com duas conexões.

Próxima etapa de implantação exigirá migração incremental revisada contra a fundação efetiva, rollback não destrutivo, duas sessões de teste, revogação/concorrência e aprovação antes de liberar endpoints. Nenhum SQL remoto necessário para integrar esta fundação de código/documentos. Não declarar Enciclopédia persistente como funcionalidade já publicada por este PR.

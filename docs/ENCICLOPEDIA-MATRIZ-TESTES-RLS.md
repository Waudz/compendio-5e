# Matriz de validação PostgreSQL — publicações da Enciclopédia

Status: **plano de testes, não executado**. Não confundir testes de domínio TypeScript com RLS real.

## Preparação isolada

Criar duas campanhas A e B, com mestres distintos, jogadores A1/A2, jogador B1 e um ex-membro A0. Usar identidades autenticadas reais ou `SET LOCAL ROLE authenticated` com `request.jwt.claim.sub` controlado **somente em banco descartável**, verificando que `auth.uid()` corresponde ao sujeito esperado. Jamais simular papéis em produção.

Aplicar, em banco isolado e na ordem, os rascunhos revisados de `ENCICLOPEDIA-SQL-RASCUNHO.sql`, `ENCICLOPEDIA-PROJECAO-PUBLICA-RASCUNHO.sql` e `ENCICLOPEDIA-SINCRONIZACAO-PUBLICA-RASCUNHO.sql`. Não aplicar a RPC de leitura substituída. Verificar `pg_policies`, `information_schema.role_table_grants`, `pg_proc.prosecdef`, proprietários e `pg_publication_tables`.

## Cenários mínimos (todos obrigatórios)

| Caso | Operação | Resultado esperado |
| --- | --- | --- |
| P01 | Mestre A cria entrada oculta | Mestre lê origem; nenhum jogador vê publicação, busca ou contagem |
| P02 | Mestre A muda para summary | A1/A2 veem nome e resumo; descrição pública vazia |
| P03 | Mestre A muda para full | A1/A2 veem descrição pública; nenhuma nota do mestre, mecânica ou ficha |
| P04 | Mestre A muda full para summary | Descrição removida imediatamente, inclusive após nova consulta |
| P05 | Mestre A muda para hidden | Publicação excluída na mesma transação; count/list/search zeram |
| P06 | Mestre A envia à lixeira | Publicação excluída atomicamente; não há cron de limpeza |
| P07 | Mestre A restaura | Publicação reaparece apenas se nível de descoberta restaurado permitir |
| P08 | A1 tenta SELECT na origem privada | Nenhuma linha; SELECT de detalhes privados negado |
| P09 | A1 tenta INSERT/UPDATE/DELETE na publicação | Operação negada por GRANT, mesmo se conhece entry_id |
| P10 | B1/mestre B consultam publicação A | Nenhuma linha nem contagem |
| P11 | A0 perde participação na campanha A | Não pode mais consultar publicações A |
| P12 | anon consulta publicação A | Operação negada |
| P13 | Falha forçada na sincronização | Escrita na origem inteira é revertida, sem estado intermediário |
| P14 | Mestre tenta mudar campaign_id, inclusive sendo mestre nas duas campanhas | Operação negada; origem, histórico e publicação permanecem intactos |
| P15 | Mestre A tenta editar entrada da campanha B | Negado pelo RLS da origem |
| P16 | Mestre A muda summary/full rapidamente | Última transação confirmada e projeção consistente |
| P17 | Busca por texto secreto em master_notes | Não retorna publicação nem altera count |
| P18 | Realtime na publicação | Tabela não consta em nenhuma publicação exposta |
| P19 | Atualizar campos não públicos da origem | Não divulga conteúdo privado nem exige republicação |
| P20 | Atualizar identidade pública de personagem | Não revela level, PV, inventário ou notas privadas |

## Bloqueios antes de deploy

1. A lixeira ainda depende de um endpoint mestre-autorizado: os rascunhos RPC `SECURITY DEFINER` em `public` **não estão aprovados**. A atualização direta de `deleted_at` não é concedida ao cliente.
2. A alteração de `campaign_id` da origem deve ser proibida; eventual transferência terá contrato separado, conforme DEC-20261122. P14 exige rejeição mesmo quando o usuário é mestre nas duas campanhas.
3. Imagens, nomes seletivos e mecânicas compartilháveis exigem contrato adicional; não ampliar a projeção por inferência.
4. A tabela `encyclopedia_publications` não deve ser publicada em Realtime sem revisão separada.
5. Hard delete continua desabilitado; FKs `RESTRICT` impedem remoção acidental do histórico.
6. Não aplicar migrações no Supabase remoto antes da execução e aprovação desta matriz em ambiente isolado.

## Complemento de reconciliação — 22/11/2026

A fundação remota fechada foi registrada em ENCICLOPEDIA-FUNDACAO-REMOTA-2026-11-21.md. Não reaplicar CREATE TABLE dos rascunhos no banco hospedado. O ensaio descartável deve reproduzir a fundação e testar uma migração incremental antes de qualquer liberação. O estado remoto atual ainda precisa ser reconfirmado. A migração 0008 das fichas é independente; não modificar suas tabelas, RPCs ou grants neste PR.

| Caso | Operação | Resultado esperado |
| --- | --- | --- |
| P21 | INSERT com deleted_at/deleted_by fornecidos pelo cliente | Negado; entrada nova só pode nascer ativa e oculta |
| P22 | UPDATE tentando alterar id, kind ou created_at | Negado; projeção inalterada |
| P23 | Mestre tenta falsificar autor ou data da lixeira | Servidor deriva auth.uid() e timestamp; nenhum valor forjado persistido |
| P24 | Jogador tenta ler detalhes, histórico ou origem via join e contagens | Nenhuma informação privada acessível |
| P25 | Usuário não membro invoca função interna de sincronização | EXECUTE negado; esquema interno sem USAGE para API |
| P26 | Operação concorrente de lixeira com filtro de estado esperado | Somente uma transição efetiva; nenhuma republicação indevida |
| P27 | Entrada summary com palavra secreta somente na descrição | Busca e contagem públicas não encontram a palavra |
| P28 | Mestre perde participação ou papel antes da nova consulta | Permissões reavaliadas no servidor; nenhuma escrita privilegiada |

**Gate de liberação:** testes do domínio não substituem testes de autorização SQL. Nenhuma concessão ao cliente, migração remota, interface de escrita ou publicação Realtime é autorizada por este documento. Manter a fundação fechada até revisão do esquema efetivo, testes descartáveis e integração após PR #86.

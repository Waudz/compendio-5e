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
| P14 | Mudança de campanha da entrada | Publicação antiga desaparece e só campanha nova autorizada enxerga |
| P15 | Mestre A tenta editar entrada da campanha B | Negado pelo RLS da origem |
| P16 | Mestre A muda summary/full rapidamente | Última transação confirmada e projeção consistente |
| P17 | Busca por texto secreto em master_notes | Não retorna publicação nem altera count |
| P18 | Realtime na publicação | Tabela não consta em nenhuma publicação exposta |
| P19 | Atualizar campos não públicos da origem | Não divulga conteúdo privado nem exige republicação |
| P20 | Atualizar identidade pública de personagem | Não revela level, PV, inventário ou notas privadas |

## Bloqueios antes de deploy

1. A lixeira ainda depende de um endpoint mestre-autorizado: os rascunhos RPC `SECURITY DEFINER` em `public` **não estão aprovados**. A atualização direta de `deleted_at` não é concedida ao cliente.
2. Uma alteração de `campaign_id` da origem deve ser proibida ou validada explicitamente; P14 é teste de defesa, não autorização para transferir registros.
3. Imagens, nomes seletivos e mecânicas compartilháveis exigem contrato adicional; não ampliar a projeção por inferência.
4. A tabela `encyclopedia_publications` não deve ser publicada em Realtime sem revisão separada.
5. Hard delete continua desabilitado; FKs `RESTRICT` impedem remoção acidental do histórico.
6. Não aplicar migrações no Supabase remoto antes da execução e aprovação desta matriz em ambiente isolado.

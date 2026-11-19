## Migração de banco — modelo
<!-- Para usar este modelo, abra o PR com ?template=migracao.md no endereço. -->

**Número:** `00NN` (conferir o livro-razão em `supabase/migrations/LEIA-ME.md`; número nunca é reaproveitado)
**Arquivo:** `supabase/migrations/00NN_nome.sql` · **Rollback:** `supabase/rollback/00NN_nome_down.sql`
**Escopo declarado na 1ª linha do SQL:** universal / pessoal / campanha

> **Esta migração NÃO foi aplicada ao Supabase hospedado.** Aplicar exige autorização expressa do responsável, em separado deste PR.

## O que muda
- Tabelas/colunas/funções/políticas criadas ou alteradas:
- Aditiva? (sim/não — se não, explicar o risco)

## Dados existentes
- Como os registros atuais são preservados (valores padrão, backfill, nenhuma linha reescrita sem necessidade):
- Teste com dados antigos (PGlite):

## Segurança (RLS e privilégios)
- [ ] `anon` sem acesso; privilégios por coluna explícitos (`GRANT`)
- [ ] Funções `SECURITY DEFINER` com `search_path` vazio e sem execução para `anon`; gatilhos `SECURITY INVOKER`
- [ ] `campaign_id` imutável; chaves compostas entre tabelas dependentes
- [ ] Jogador, ex-membro e mestre de outra campanha **sem** acesso (testado)
- [ ] Nenhuma regra de leitura existente foi enfraquecida (a suíte de regressão das notas passa)
- [ ] Limites (tamanho/quantidade) definidos

## Reversão
- O rollback devolve o banco ao estado anterior? O que **não** é reversível (dados criados depois)?

## Testes
- [ ] `supabase/*.test.ts` (PGlite) — resultado:
- [ ] `npm test` completo — resultado:

## Ordem e dependências
- Depende de: `00NN`. Bloqueia: `00NN`.

## Aprovação
- [ ] Revisado por: ____ · Autoriza **aplicar**: sim / não / ainda não

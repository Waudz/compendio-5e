# Notas e diário — contratos preliminares

Os contratos TypeScript (`src/notePermissions.ts`) servem só à interface. A autorização real está no banco: `supabase/migrations/0004_notas.sql` (**preparada e testada em Postgres em memória; NÃO aplicada à produção**). Ainda não existe editor nem acesso a `notes` pelo cliente.

## Visibilidade
- `private`: somente autor.
- `master`: autor e mestre participante da campanha.
- `campaign`: autor e participantes da campanha.
- `selected`: autor e participantes selecionados explicitamente.
- Sem campanha: somente autor, independentemente da visibilidade declarada.
- Um mestre não tem acesso automático a notas privadas de outro autor.
- Edição inicial: apenas autor; compartilhamento não concede edição.

## Requisitos para futura implementação SQL
- Aplicar RLS a notas e permissões no servidor; verificar pertencimento atual à campanha em cada consulta.
- Nunca confiar em `isCampaignMaster`, `isCampaignMember` ou `allowedUserIds` enviados pelo navegador para autorizar acesso.
- Definir política de transferência/remoção de notas ao sair da campanha, antes de criar persistência.
- Proteger links, busca, prévias e histórico com a mesma política da nota de origem.
- Proibir escalonamento de privilégios por atualização de `owner_id`, `campaign_id` ou listas de compartilhamento.
- Não criar funcionalidades de visitante; conteúdo universal é consultável por qualquer conta autenticada.

## A seguir
Projetar e revisar esquema SQL + testes RLS em ambiente de desenvolvimento antes de pedir autorização para aplicar migrações à produção.

## Persistência e RLS (migração 0004) — estado

Tabelas `notes` (autor, campanha opcional, título, corpo, visibilidade, `version`) e `note_shares` (selecionados).
- **Leitura:** `note_readable(...)`/`can_read_note(id)` é a única regra: autor sempre; os demais só se `visibility <> 'private'`, a nota é de campanha, **o leitor participa agora**, **o autor também participa** e (`campaign` | `master` e leitor é o mestre | `selected` e leitor está em `note_shares`). Mestre não lê nota privada de jogador.
- **Escrita:** só o autor insere, edita, exclui e compartilha. `owner_id`, `campaign_id`, `id`, `created_at` e `version` não são graváveis por clientes (privilégio de coluna) e um gatilho recusa troca de dono/campanha até para papéis privilegiados. Nota sem campanha só pode ser `private`.
- **Selecionados:** destinatário tem de participar da campanha; não vale para o próprio autor; máx. 50; mudar a visibilidade de `selected` apaga a lista (voltar a `selected` não a restaura).
- **Concorrência:** o servidor incrementa `version`; o cliente envia `update ... where id = ? and version = ?` e **0 linhas = conflito** (nada é sobrescrito em silêncio).
- **Quem sai ou é removido da campanha (política atual, a confirmar):** nada é apagado; o autor continua lendo e excluindo as suas notas, mas não as edita fora da campanha; o compartilhamento fica **inativo** (mestre e demais deixam de ver) e volta a valer se ele reentrar. *Alternativas:* (a) apagar as notas compartilhadas ao sair; (b) mantê-las visíveis à mesa; (c) converter para privadas na saída. A escolhida é a única que não apaga dados nem entrega dados de quem saiu.
- **Exclusão:** excluir campanha apaga suas notas (cascata); excluir a conta apaga as notas da conta. Mestre não exclui nem modera notas de jogadores.
- **Busca, links e histórico (próximas etapas):** qualquer tabela/consulta futura deve usar `can_read_note(id)` na própria política (ou `exists` sobre `notes`, já filtrado pela RLS), nunca guardar título/prévia em tabelas sem essa verificação. `can_read_note` devolve `false` igual para nota inexistente e inacessível.
- **Reversão:** `supabase/rollback/0004_notas_down.sql` (apaga todas as notas: faça backup antes).
- **Testes:** `supabase/notas.test.ts` (25 casos, várias contas e papéis, inclusive mutações que provam que os testes detectam regressões).

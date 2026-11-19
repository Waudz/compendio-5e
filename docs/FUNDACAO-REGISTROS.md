# Fundação de registros — proposta v1

Status: contratos iniciais. **Atualização 19/11/2026:** notas já têm persistência e RLS (`0004`, aplicada); o restante segue sem tabelas. Planejamento consolidado e ordem de entregas em `PLANEJAMENTO-V2.md`.

## Decisões confirmadas
- Aplicativo requer autenticação. Não investir em experiência de visitante agora.
- Qualquer conta autenticada pode consultar o bestiário universal SRD 5e 2014.
- Conteúdo universal é somente leitura; personalizações ficam em registros pessoais ou de campanha.
- O criador é o único mestre da própria campanha; usuário pode mestrar várias campanhas.
- Não misturar conteúdo secreto de campanha com o catálogo universal.

## Contratos iniciais
- `RecordRef`: identidade por tipo e ID estável. UUID será exigido nas futuras tabelas; o tipo evita colisão entre domínios.
- `RecordScope`: universal, pessoal (proprietário) ou campanha (ID).
- `RecordMetadata.version`: versão inteira monotônica controlada pelo servidor.
- `RecordLink`: links entre registros, com backlinks derivados e filtrados pela permissão de **ambas** as pontas.
- `PendingOperation`: identificador de operação, autor, registro, versão esperada e ação. Nenhuma fila offline foi implementada.
- `canDiscoverRecord` é apenas filtro de interface, **não** mecanismo de autorização.

## Próximos passos em PRs independentes
> Ordem vigente e dependências: `PLANEJAMENTO-V2.md` §8 (a lista abaixo é o plano original e foi reordenada; modelo de vínculos de notas: §4).
1. Definir modelo SQL e RLS para notas, links e biblioteca; testes de acesso cruzado entre contas e campanhas.
2. Definir esquema versionado do IndexedDB por usuário; limpeza ao trocar de conta; armazenamento limitado e criptografia/privacidade conforme necessidade.
3. Projetar API de escrita com controle otimista de versão e deduplicação por `operationId`. Não aceitar operações offline de permissões ou exclusão de campanha.
4. Criar protótipo de diário e links com verificação de permissão no servidor.
5. Implementar pesquisa universal respeitando RLS; `Ctrl+K` e botão no celular.
6. Adicionar histórico, restauração segura e resolução explícita de conflitos, antes de ativar escrita offline.

## Critérios de segurança
- RLS e RPCs devem aplicar autorização no banco, não confiar em `RecordAccess` enviado pelo cliente.
- Resultados de busca, backlinks, títulos e histórico não podem revelar conteúdo sem acesso.
- Atualizações concorrentes não devem sobrescrever alterações silenciosamente.
- Reversões de esquema exigem migração reversa e plano de preservação de dados.
- Biblioteca universal pode ser consultada por qualquer usuário **autenticado**, não por visitantes.
- Nenhum dado do projeto legado Supabase deve ser alterado.

## Limitações deliberadas
- Sem tabelas, migrations, UI, sincronização, armazenamento local ou publicação neste PR.
- A regra de visibilidade de campanha ainda precisará de permissões mais finas para notas privadas e conteúdo exclusivo do mestre.
- O contrato não determina se uma cópia de monstro herda alterações do original: padrão planejado é cópia independente.

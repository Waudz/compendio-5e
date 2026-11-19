# Fundação de registros — contratos e critérios de segurança

Status: **contratos puros em `src/records.ts` e `src/notePermissions.ts`, com testes, ainda não consumidos por módulos de dados.** Persistência existe só para campanhas e notas (`supabase/migrations`). Roteiro e dependências: `PLANEJAMENTO-V2.md` §8. Notas: `NOTAS-PERMISSOES.md`.

## Decisões vigentes
- Login obrigatório; sem experiência de visitante.
- Qualquer conta **autenticada** consulta o bestiário universal SRD 5e 2014; o conteúdo universal é somente leitura e personalizações ficam em registros pessoais ou de campanha (**cópia independente** do original, sem herdar alterações).
- O criador é o único mestre da própria campanha; um usuário pode mestrar várias.
- Conteúdo secreto de campanha nunca se mistura ao catálogo universal.

## Contratos
- `RecordRef`: identidade por tipo e id estável (UUID nas futuras tabelas; o tipo evita colisão entre domínios).
- `RecordScope`: universal, pessoal (proprietário) ou campanha (id).
- `RecordMetadata.version`: inteiro monotônico controlado pelo servidor; `decideVersion` decide aplicar ou conflito.
- `RecordLink`: vínculo entre registros; backlinks derivados e filtrados pela permissão de **ambas** as pontas (`visibleLinks`).
- `PendingOperation`: id da operação, autor, registro, versão esperada e ação; **nenhuma fila offline existe**.
- `canDiscoverRecord` é só filtro de interface, **nunca** autorização.

## Critérios de segurança
- RLS e funções no banco aplicam a autorização; nada de confiar em `RecordAccess` vindo do cliente.
- Busca, backlinks, títulos, prévias e histórico não revelam conteúdo sem acesso.
- Atualizações concorrentes não sobrescrevem em silêncio (versão + conflito explícito).
- Mudanças de esquema trazem migração reversa e plano de preservação de dados.
- Nada do projeto Supabase legado é alterado.

## Limitações
O contrato não decide a visibilidade de estatísticas de monstros para jogadores (pendência D7) nem o modelo de vínculos de notas (`NOTAS-PERMISSOES.md` §4).

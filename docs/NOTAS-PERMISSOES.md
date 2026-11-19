# Notas e diário — contratos preliminares

Este PR contém **somente** tipos e testes de comportamento da interface. Não existe ainda tabela `notes`, endpoint, editor ou migração aplicada.

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

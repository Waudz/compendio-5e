# Alpha — acesso fechado e ordem da sessão (22/11/2026)

Branch `fix/alpha-acesso-fechado`, baseada na main `ebab8d4`, independente das branches de combate e do criador #97. Implementa no cliente a decisão DEC-20261122-C, sem modificar o Auth hospedado.

## Critérios e implementação

- Tela de entrada oferece login e recuperação para contas existentes, sem cadastro. Convite de campanha não é autorização para criar conta; mensagem esclarecida sem perder o código da URL.
- `AuthApi.signUp` continua no contrato para compatibilidade, mas retorna cadastro fechado sem chamar o SDK. Não há chave de configuração pública que possa reabrir o fluxo.
- Login de conta ainda não confirmada mantém o reenvio de confirmação. Recuperação mantém mensagem neutra e redirecionamento com convite válido; códigos inválidos não são propagados.
- Corrida reproduzida: resposta inicial atrasada de getSession desfazia SIGNED_IN ou restaurava usuário após SIGNED_OUT. Os dois testes falharam antes da correção. AuthProvider agora ignora a resposta inicial quando já recebeu evento do SDK, inclusive erros atrasados; evento atual limpa erro antigo de carregamento.

## Validação e limites

66 testes focados aprovados em auth/etapa1/campaignsUI. Build, suíte completa e CI devem acompanhar o HEAD do PR. Contas e sessões são simuladas; nenhum login, cadastro ou e-mail foi disparado para contas reais.

**Não declarar cadastro fechado no servidor:** esta mudança só bloqueia o cliente oficial. É necessário conferir a configuração de Auth e, com autorização explícita, desabilitar novos cadastros no servidor. Depois verificar em ambiente de desenvolvimento que o endpoint direto recusa signup, preservando login, recuperação e contas já existentes. Não alterar confirmação de e-mail, senhas, usuários ou convites para simular esse teste.

Inspeção remota somente leitura nesta sessão: main continua em ebab8d4; PRs #107/#108/#109 com build/testes e Playwright verdes. Supabase compendio-5e mantém RLS nas tabelas públicas; tabelas privadas de Enciclopédia sem políticas de acesso e tabela de combates ainda ausente. Nenhum SQL/configuração/dado de produção alterado.

## Próxima prioridade

Resolver falhas de carregamento e concorrência da campanha ativa sem tratar perda de rede como lista vazia; preparar validação de Auth com contas reais somente quando houver ambiente e autorização adequados. Alpha não concluída: persistência remota de combate, Enciclopédia e critérios de fluxo real ainda pendentes.

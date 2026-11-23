# Validação Alpha em Supabase descartável

## Estado e critérios

Não foi encontrado projeto/branch de desenvolvimento no Supabase conectado. Os projetos
`compendio-5e` e `rastreador-dnd` não são alvos desta suíte. Não foi criada branch paga.
O executor desta sessão não possui Docker; a execução real foi delegada ao workflow
`Alpha Supabase isolado`, com Docker no runner efêmero do GitHub. A existência do
workflow não significa aprovação: consultar o resultado do job e seu relatório.

A suíte cria contas sintéticas pelo Auth Admin **somente em loopback** e testa a Data
API com JWTs reais de usuário. Service role nunca é usada no PostgREST.
Critérios: cadastro público recusado; login e recuperação existentes disponíveis;
convite atribui jogador; isolamento entre campanhas; notas privadas inclusive para
mestre e compartilhamento explícito; ficha/inventário recuperados; revisão obsoleta
recusada; combate invisível e não gravável por jogador, mestre de outra campanha ou
anônimo; compare-and-swap; JWT expirado recusado e refresh funcional.

## Execução e proteção de dados

Abrir/atualizar PR dispara `.github/workflows/alpha-supabase.yml`. Não são necessários
secrets de produção. CLI fixada em 3.2.0; projeto criado em `/tmp`, sem `link`,
`db push`, acesso remoto ou reaproveitamento de `.temp/project-ref`. Migrações 0001–0008
são copiadas; o rascunho de combate do PR #108 é copiado para uma migração de fixture
cujo nome é gerado pela CLI **apenas no diretório temporário**.

`auth.enable_signup=false` é aplicado somente nessa configuração descartável;
autenticação por email permanece habilitada e JWT expira em 60 segundos.
O cliente aceita exclusivamente `http://127.0.0.1:54321`, recusa redirecionamentos,
usa timeout e restringe rotas. Logs de inicialização/status podem conter chaves locais:
não são publicados. O artefato contém somente nomes dos checks e limitações.

Verificações disponíveis sem Docker:

```sh
node --test scripts/alpha/local-only.test.mjs
node --check scripts/alpha/run-local.mjs
```

## Limites e integração

A suíte é baseada em #108 e depende de #103 → #106 → #107; não habilita combate
remoto na interface. Encontros continuam locais. Recuperação verifica aceitação do
pedido, ainda não entrega de email/troca de senha. Não comprova realtime, falhas de
rede, migração dos dados locais nem fluxos de navegador/múltiplos dispositivos.
A Enciclopédia permanece fechada por padrão até políticas específicas validadas.

Ordem proposta, sujeita à revisão e autorização de merge: #97, #102; cadeia
#103 → #106 → #107 → #108; #109; depois #110, #111, #112. #109 e #108 são
irmãos sobre #107: preservar ambos. #105/#98/#95 são documentais e exigem conciliação
com o estado real, sem substituir evidências por textos históricos. Os conflitos
locais conhecidos são adições ao README; preservar registros e atualizar a conclusão.
Executar a suíte real e o CI completo na árvore conjunta antes de integrar main.

Recuperação: manter main intacta; corrigir/reverter somente commits da branch de
integração. Nenhum rollback SQL de produção é autorizado. Importação futura de combate
local deve exigir confirmação do mestre, cópia preservada, validação de conteúdo e
versão, campanha explícita, inserção condicional e recusa de sobrescrita remota.
Não remover dados locais antes de confirmar leitura remota equivalente.

Pendências bloqueadoras da Beta: stack real verde, fluxo completo de recuperação,
políticas/avisos de segurança revisados em ambiente isolado, combate remoto conectado,
importação segura, encounters persistentes, testes de perda de conexão/realtime,
validação conjunta de mestre/jogador e encerramento de cadastro em produção somente
após autorização. Nenhum desses itens é declarado concluído por esta preparação.

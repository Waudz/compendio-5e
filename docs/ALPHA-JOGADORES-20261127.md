# Preparação dos testes com jogadores — 27/11/2026

## Estado confirmado

Base inspecionada: `main` d056911, após #163/#164. Não há PR funcional aberto concorrendo com esta entrega; #117–#120 são atualizações de dependências e não foram incluídos. Issues #96/#99/#100 continuam abertas: a recuperação local contínua e a preservação das edições durante o salvamento já existem; a criação ainda predefine Guerreiro/Anão da Colina/Acólito. Não encerrar as três issues como um único problema resolvido.

Produção `gwcttjlxzelzjhbuitmi`: consulta de metadados confirmou migrações 0017, 0018, 0019 e **0020 aplicada** (20261127053526). `profiles` contém id/display_name/created_at; UPDATE somente em display_name, com RLS `id = auth.uid()`. A edição do nome usa essa estrutura, sem migração. Participantes leem o nome de profiles, não o nome dos personagens.

Nenhuma conta, campanha, ficha, nota, imagem ou política foi alterada em produção nesta execução. Os testes que escrevem dados são preparados exclusivamente para a stack descartável em 127.0.0.1:54321 no workflow Alpha Supabase isolado.

## Entrega desta branch

- Cadastro reaberto no cliente, seguindo a decisão mais recente do responsável. E-mail/senha validados; confirmação e reenvio; mensagem neutra para evitar enumeração; convite válido preservado no redirecionamento. A decisão anterior de cadastro fechado é histórica.
- Nome da conta editável em profiles, escopo do usuário e feedback de erro/sucesso; atualização de participantes já abertos no mesmo navegador. Alterações digitadas durante a requisição permanecem pendentes; proteção ao sair da página.
- Solicitação de alteração de e-mail pelo Supabase Auth, com instrução de confirmação; não altera o endereço exibido antes da atualização real da sessão. Senha e recuperação existentes preservadas.
- Menu compartilhado entre desktop/celular; celular sem menu no topo, com Menu inferior independente do destaque da página. Agrupamentos Campanha/Conta, sair e versão; sem atalhos duplicados para as quatro páginas da barra inferior. Jogador sem Encontros/Iniciativa no menu.
- Configurações separadas: tema funcional usando a chave existente. Sobre: versão do package.json, fase Alpha, créditos, licenças, repositório e aviso de fãs.
- Stack isolada preparada para cadastro público e para mestre, dois jogadores e outra campanha. Acrescentadas asserções REST/JWT de edição exclusiva do próprio perfil, ausência de associação automática após cadastro e privacidade da nota perante o segundo jogador.

Não há opção global fictícia “Ver como jogador”: a prévia existente é por registro no Compêndio. Não foram criadas configurações de notificações sem implementação.

## Validação e limites

Resultados detalhados e SHA final em CONTINUIDADE-DESENVOLVIMENTO.md e no PR. Não confundir testes com mocks, PGlite, demonstração e stack real. A demonstração não possui API de perfis e informa a indisponibilidade em vez de simular salvamento.

Sem Docker e sem navegador Playwright utilizável neste executor: Auth/REST/JWT/RLS/Storage reais e navegador devem ser confirmados no CI do PR. Não testar criação de contas nem edição de dados em produção como substituição. Confirmação/alteração de e-mail por caixa postal e celular físico ainda exigem validação humana controlada.

Advisors de produção (somente leitura): quatro tabelas encyclopedia com RLS sem policy (negação padrão); 35 funções SECURITY DEFINER executáveis por authenticated (requerem revisão das verificações internas, não revogação indiscriminada); proteção de senhas vazadas desativada. Não houve alteração dessas configurações. Referências: [RLS sem policy](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy), [funções definer](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable), [senhas](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection).

## Pendências exatas

1. Foto de perfil: não existe coluna nem contrato de Storage para avatar da conta; preparar migração não destrutiva e políticas de leitura/edição antes de expor upload. Não usar retrato do personagem nem bucket público de campanha como atalho.
2. Minhas anotações: implementar lista/editor sobre `notes` existente, preservando cenas e quadros antigos, sem alterar as Anotações do mestre. Requer recuperação local, fila de salvamento com versionamento, sincronização e testes de privacidade. Ainda não implementado nesta entrega.
3. #100: contrato de rascunho sem raça/classe/origem, com cálculos parciais; não basta remover valores dos selects. #96: finalizar reprodução de equipamentos/origem e recuperação em navegador; #99: conferir testes de latência para todos os campos antes de encerrar.
4. Feedback após #164: abas da ficha, vínculos tipados de aventureiros, edição da identidade pelo mestre, controles de dois grupos. Registro de retomada anterior permanece válido; não foi reimplementado aqui.
5. Testes completos de cadastro/convite, duas contas de jogadores, ficha/inventário e outro dispositivo, conforme roteiro. Nenhuma certificação de Alpha concluída ou prazo garantido.

Sem merge, deploy ou migração em produção sem autorização específica. Prazo de lançamento continua 12/12/2026; esta entrega elimina bloqueios de entrada e conta, mas não certifica os critérios finais.

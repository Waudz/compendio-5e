# Compêndio unificado e conhecimento da campanha — 26/11/2026

Implementação na branch `feat/compendio-campanha-regras`. **Sem merge, deploy ou SQL em produção.** A decisão deste documento/DEC-031 substitui o bloqueio provisório do Bestiário e a antiga navegação Enciclopédia/Documentos. Prazo Beta: 12/12/2026.

## Interface e fontes

- Duas áreas: Campanha e Regras. Cartões panorâmicos em coluna única, limitados pela área do painel. Arte provisória feita com os ícones Lucide já utilizados (licença ISC); não são imagens comerciais nem substituem imagens selecionadas pelo mestre.
- Categorias substituem a entrada; retorno compacto. Preferências de consulta ficam em memória por sessão, usuário, campanha e categoria, incluindo pesquisa, filtros, ordem, grade/lista e detalhe. Não persistem conteúdo privado. No mobile, o histórico e a restauração de rolagem existentes continuam responsáveis pelo retorno entre seções.
- Origens vêm de `origens-2014.ts`: Acólito SRD; demais resumos próprios e origem personalizada claramente identificados. Talentos e habilidades consulta as características já existentes em `character-2014.json`, sem inventar um catálogo de talentos comerciais. Condições reutilizam os resumos do combate; não são o texto integral de todas as regras.
- Retratos do catálogo e detalhes usam `RetratoQuadrado`, com recorte existente, carregamento preguiçoso e placeholder em falha. Associação legada preservada; auditoria em `IMAGENS-V1.md`.
- Meus personagens mobile depende da propriedade efetiva de `notes` na campanha atual. A preferência do último ID apenas escolhe um candidato entre registros próprios. Resposta atrasada de outra campanha/conta não navega para a ficha antiga. Detalhes internos e proteção de alterações não salvas permanecem.

## Uma fonte, duas fronteiras

`notes` continua sendo o registro canônico de NPC, local, organização e descoberta. `campaign_codex` guarda apenas o vínculo, a referência de catálogo/instância, versão, divulgação e caminho de imagem. NPC narrativo não cria outra ficha nem copia os aventureiros existentes. Referências de item e monstro são únicas por campanha/sistema/definição; os itens revelados aparecem em Descobertas e Regras sem duplicar definições.

Os registros canônicos do Compêndio ficam privados. Jogadores recebem **somente `codex_list`**, uma projeção verificada no servidor: nível 0 ausente; 1 nome; 2 descrição autorizada; 3 imagem; 4 dados completos autorizados. Notas privadas nunca são projetadas. Cadastro e edição exigem mestre atual, campanha e versão esperada. Política restritiva adicional impede que um ex-mestre use a antiga propriedade da nota para continuar lendo ou editando segredos. Registros anteriores à migração não são alterados nem reclassificados automaticamente; abas/documentos existentes continuam suportados pelo workspace.

O SRD empacotado e as imagens públicas do 1.0 são públicos por natureza. Ocultar consulta ou link não promete torná-los secretos. Dados particulares da campanha e imagens secretas usam a projeção e o Storage privados; nunca entram no índice público de pesquisa. Jogadores só pesquisam criaturas reveladas e itens permitidos/revelados; links diretos e títulos de abas de itens seguem a mesma disponibilidade.

Itens revelados não se tornam livremente adicionáveis: a política de inventário da 0013/0014 permanece. `codex_holders` retorna só IDs e nomes de identidades já publicadas, nunca o restante do inventário. A descoberta não depende da posse. Não implementamos identificação individual, sintonização ou inferência automática de conhecimento por combate/posse; essas decisões e operações continuam separadas.

## Imagens privadas e substituição

Bucket novo **`codex-assets`**, privado, JPEG/PNG/WebP, até 5 MiB. Caminho `<campanha>/<registro>/<uuid>`. Apenas o mestre atual envia e exclui; membros leem somente o caminho publicado e a partir do nível 3. Não reutiliza `campaign-assets`, cuja política permite leitura mais ampla entre membros.

Uploads não usam upsert. A referência anterior só é substituída após upload concluído e gravação transacional bem-sucedida; erro mantém a imagem anterior. Arquivos substituídos ficam retidos para recuperação, sem exclusão automática. Em registro novo, é criado um rascunho secreto antes do upload; falha mantém esse rascunho, e a mesma tela permite tentar novamente. Downloads autenticados viram URLs de Blob locais revogadas ao desmontar; não são geradas URLs assinadas compartilháveis. Conteúdo já visto/baixado por usuário autorizado não pode ser retirado de seu aparelho retroativamente.

O editor é de registros/conhecimento, não um construtor completo de fichas customizadas de monstros. A projeção suporta estatísticas particulares autorizadas, mas o catálogo e a ficha completa reutilizados nesta etapa são do SRD 2014.

## Notificações e atualização

Notificações internas no sino do Compêndio, leitura individual. Apenas primeira revelação/aumento de nível gera evento; chave única registro/destinatário/nível impede duplicatas, inclusive após revogar e revelar novamente o mesmo patamar. Correção textual, transferência e cadastro secreto não notificam. RLS revalida vínculo e nível atuais, ocultando avisos revogados. Sem push. A tela recarrega ao receber evento local, voltar ao foco e a cada 30 segundos enquanto visível; não é uma implementação de Realtime global.

## Aplicação pelo responsável (não executada)

1. Confirmar no painel o projeto **2.0**, sem tocar no projeto legado. Garantir backup recuperável conforme o procedimento operacional do responsável.
2. Verificar no histórico remoto a correspondência das migrações 0001–0014. A 0014 ainda consta como proposta no livro-razão: não presumir aplicação nem executar pendências em lote. Resolver sua aplicação/aprovação separadamente antes da 0015.
3. Executar somente leitura de `supabase/preflight/0015_compendio_conhecimento.sql`. Pré-requisitos não podem ser nulos; funções/tabelas `codex_*` não podem colidir. Registrar as três contagens.
4. Com autorização explícita e SHA revisado, executar **o arquivo completo** `supabase/migrations/0015_compendio_conhecimento.sql` no SQL Editor do projeto confirmado. O arquivo já contém `BEGIN/COMMIT`; não executar fragmentos nem `db push` de todo o diretório.
5. Repetir contagens, confirmar bucket privado/limites, RLS nas novas tabelas e políticas do Storage. Testar mestre, jogador e usuário de outra campanha em dados temporários autorizados, incluindo troca de imagem com falha e revogação. Só depois liberar o aplicativo correspondente.
6. Se necessário reverter, voltar também a versão do aplicativo e executar `supabase/rollback/0015_compendio_conhecimento_down.sql` **com aprovação**. O rollback arquiva registros, vínculos e avisos em `private_codex_archive.snapshots`, sem acesso por anon/authenticated; mantém notes e arquivos. Uma reaplicação não restaura automaticamente esse arquivo: revisar/restaurar o snapshot ou backup antes de reabrir a funcionalidade.

Sem 0015, consultas públicas de regras continuam funcionando; ações dependentes de conhecimento mostram erro explícito/configuração pendente, sem simular gravações.

## Validação

Testes SQL isolados em `supabase/compendio-rls.test.ts`; fluxo real de Auth/REST/JWT/Storage em `scripts/alpha/run-local.mjs`, executado pelo workflow existente Alpha Supabase isolado. Não há Docker nesta máquina Windows; a execução real da stack fica no Linux da CI. O adaptador `src/dev/codexDemo.ts` existe só no build de demonstração e não substitui os testes de autorização do banco.

Resultados finais e PR: consultar a última entrada de `CONTINUIDADE-DESENVOLVIMENTO.md`.

SHA-256 da migração revisada: `dd94fe349e2781dd0e79c9aabd98ea9b0d418dbdbc1efd6e0cf14a704f0c460c`. Calcular novamente se o SQL mudar antes da aplicação.

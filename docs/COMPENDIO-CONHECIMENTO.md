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

SHA-256 da migração revisada: `74a15d93ec5f8d1c42e46412720d69bcd426ceb54cd74a5259eaebf08b4ca7a9`. Calcular novamente se o SQL mudar antes da aplicação.


## 0016 — páginas e vínculos (proposta, não aplicada)

A 0015 foi aplicada em produção e **não deve ser reaplicada**. A 0016 é aditiva, requer a 0015 e não reescreve registros existentes.

- Substitui `codex_list` (acrescenta `fields` e `relatedTerms` a partir do nível 2 e `framing` a partir do 3), `codex_save` (valida os campos opcionais e o enquadramento) e `codex_note_guard` (a versão passa a subir também em mudanças feitas direto em `notes`).
- Cria `codex_links` (RLS; leitura direta só do mestre; sem escrita pela API) e `codex_node_visible`, `codex_links_for`, `codex_link`, `codex_unlink`, `codex_notification_feed` e `codex_capabilities`.
- Visibilidade de uma ponta: registro do Compêndio com conhecimento 2 ou mais (o mestre vê todos), ou personagem publicado para a campanha ou do próprio usuário. O título devolvido de um personagem é o título público derivado pelo servidor (0008).
- O feed conta todas as notificações autorizadas e devolve as 50 mais recentes; revogar o conhecimento retira o aviso.

**Aplicação (pelo responsável, não executada):** confirmar o projeto 2.0 e o backup; executar só leitura de `supabase/preflight/0016_compendio_paginas_vinculos.sql` e anotar as contagens; aplicar o arquivo completo `supabase/migrations/0016_compendio_paginas_vinculos.sql` (já contém `BEGIN/COMMIT`); repetir as contagens; testar mestre, jogador e usuário de outra campanha; só então publicar o aplicativo. Reversão, com aprovação e junto da versão anterior do aplicativo: `supabase/rollback/0016_compendio_paginas_vinculos_down.sql`, que arquiva vínculos e campos antes de removê-los.

SHA-256 do arquivo revisado: `2a6b162c8a5c602ddaa74aadf4270f6931767d6f6bc3a109c5420485e867f857` (fim de linha LF, como no repositório) ou `ad1346ecfa61248118b3c0f46da309926c55c03b5a26fbc92c7ad45facb46b09` (CRLF, como na cópia local no Windows). Calcular novamente se o SQL mudar.


## 0017 e 0018 — conhecimento granular, vínculos tipados, descobertas e personalização (propostas, não aplicadas)

Requerem 0015 e 0016 (informadas como aplicadas). As seções acima sobre níveis 0–4 descrevem o estado anterior à 0017.

**Modelo (0017).** `campaign_codex.visible` (existência) + `revealed text[]` (chaves: `name`, `nickname`, `description`, `image`, cada campo, `holders`, `sheet` ou `sheet:<seção>`). `codex_links` ganha `kind`, `inverse` e `revealed`; um vínculo só chega ao jogador se estiver revelado **e** as duas pontas forem visíveis. `codex_project` é a única projeção do jogador (lista e prévia). `codex_save` só grava conteúdo; `codex_reveal` grava a visibilidade, numa transação. Registro novo é secreto.

- Título do jogador: nome revelado, senão alcunha/nome provisório revelado, senão título neutro. Vale para listas, vínculos, termos de pesquisa, notificações e abas.
- ID de catálogo só sai com identificação completa (nome + ficha inteira); item não identificado aparece com categoria `discovery`. Imagem do catálogo só sai com imagem **e** nome revelados (a URL contém o ID).
- `sheet` são seções derivadas da definição (CA, vulnerabilidades, dano, efeitos…) calculadas pelo aplicativo do mestre, porque o servidor não tem o catálogo. A definição continua sendo a fonte: a página do mestre regrava quando divergem, e a 0018 atualiza na mesma transação da edição.
- Um aviso por operação quando algo ainda não anunciado fica visível; correção, ocultação e repetição não avisam. Com a ficha inteira revelada, ela conta como uma única informação.
- Posse continua derivada dos inventários; o jogador só a vê com `holders` revelado. Registrar descoberta ou vincular item não concede nada. Item citado só por vínculo cria uma referência secreta (`registered=false`), fora de Descobertas até ser registrada ou publicada.

**Conversão dos dados existentes.** Nível 0 continua secreto. Bestiário: 1 nome; 2 + descrição e campos; 3 + imagem; 4 + ficha. Demais tipos publicados: tudo o que o nível já entregava. Vínculos que o jogador via (pontas com nível 2+) nascem revelados; os outros, ocultos. Campos genéricos `identity`/`region`/`history` passam a `occupation`/`residence`/`inhabitants`/`type`/`context`. Nenhum aviso é gerado pela conversão. `meta.stats` (sem interface) permanece guardado e deixa de ser projetado.

**Definições (0018).** `campaign_definitions` guarda só substituições (mesmo ID) e criações (`custom-…`) por campanha; leitura direta apenas do mestre, escrita só por `codex_definition_save`/`codex_definition_remove`. Restaurar apaga a substituição e devolve a ficha original à página. Criação com página ligada não é excluída. O catálogo global não muda; dado inválido é ignorado e o padrão volta a valer. Sem a 0018, o catálogo padrão segue funcionando.

**Aplicação (pelo responsável; nada foi aplicado):** confirmar projeto 2.0 e backup; rodar `supabase/preflight/0017_0018_compendio_granular.sql`; aplicar os arquivos completos 0017 e depois 0018; repetir as contagens; publicar o aplicativo correspondente **na mesma janela** (o aplicativo anterior deixa de gravar registros após a 0017 e o novo exige capacidade 17). Testar mestre, jogador e outra campanha. A ficha dos registros antigos é preenchida quando o mestre abre a página (sem aviso novo); até lá, quem tinha acesso completo continua vendo a definição. Reversão, com aprovação: 0018_down e depois 0017_down, junto da versão anterior do aplicativo; a 0017_down falha para o lado fechado (só permanece visível o que estava totalmente revelado; vínculos ocultos/repetidos e avisos são removidos, com arquivo privado).

SHA-256 (LF, vigentes): 0017 `09f74d0ac34ca7163982ed80fc20aaf1bdd45177254249c39f5beb3e0c7ef66c`; 0018 `18c9257486e2c8dbada8e73a35604dc6168bcbaac910693e6e3b70aa4cee57a9`; 0019 `450c5bf44a3c6a08015a5a87d747396e91b558f509fe68bbf551fe6d0bf4b0df`.


## 0019 — catálogo da campanha no inventário e itens não identificados (proposta, não aplicada)

Requer 0014, 0017 e 0018. Aplicar 0017 → 0018 → 0019 na mesma janela da publicação (reversão na ordem inversa).

- `codex_definitions_for` é a única leitura de definições feita pelo aplicativo. Mestre: tudo, inclusive `identifiesAs`. Jogador: substituições/criações de itens que um personagem seu já teve, definições com identificação completa publicada e a aparência dos códigos que são seus.
- Item não identificado: o inventário guarda só `unid-<32 hex>`; a definição verdadeira fica em `private_ficha.mascaras`, sem privilégio de API. Nome, propriedades, histórico, Realtime e transferências levam apenas o código. O jogador não cria nem troca códigos (guarda de entregas da 0013/0014).
- `codex_grant_item` (mestre, idempotente) entrega identificado ou não; `codex_identify_item` troca o código pelo ID real em todos os inventários e históricos da campanha. Entregar não cria nem revela descoberta.
- `private_ficha.itens_vistos` mantém o nome no histórico após consumo/perda; é preenchida por gatilho a partir de gravações já autorizadas e retroativamente na aplicação.
- `usar_consumivel` passa a obedecer à fórmula/categoria da definição da campanha. Item não identificado não pode ser usado antes da identificação.
- `codex_holders` considera também os itens não identificados (jogador só vê com `holders` revelado).
- Substituição de um item comum (de livre adição) vale para a campanha: quem o tiver no inventário recebe a definição da mesa. Segredo deve usar criação própria ou item restrito.
- Limites: a identificação protege dados do servidor; não esconde o que o próprio mestre escrever na aparência. Textos de histórico já gravados mantêm o nome aparente. Itens verdadeiros que já estavam nos inventários continuam identificados.

### Revisão de segurança da 0017/0018 (26/11/2026)

Corrigido na 0017 (ainda não aplicada; SHA alterado): (1) a regra de vínculos permitia ao mestre ligar a ficha privada de outro usuário e ler o título dela; voltou a valer só ficha publicada ou própria; (2) a projeção do jogador deixou de enviar `version`, que contava edições secretas. Conferidos sem alteração: RLS e privilégios das tabelas novas, funções auxiliares sem execução pela API, isolamento entre campanhas, Storage, notificações, conversão dos níveis e reversões. A 0018 não mudou.

Conferência na aplicação da 0019: além do preflight da 0017/0018, comparar antes e depois a contagem de `character_sheets` e confirmar que `select count(*) from private_ficha.itens_vistos` cobre os inventários existentes.

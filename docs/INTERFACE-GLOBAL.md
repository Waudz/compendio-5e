# Interface global — 27/11/2026

Base: `main` `1e6e2f206091791ebade01bcab474b4196bbe821`. Branch `feat/interface-global-consistente`.

## Implementado nesta branch

- Retorno de categorias e cartas do Compêndio usa o cabeçalho global; retorno não aparece na raiz. Histórico de navegador/Android e limite de dois grupos não foram reescritos.
- Barra compartilhada: busca separada, filtros em select por largura do painel, ordenação compacta e uma única alternância lista/grade. Reticências sem ações não aparecem; abertura de novas abas fica fora dos menus mobile.
- Grade compartilhada: retratos quadrados, nome/alcunha sobre degradê, sem subtítulos e rodapés de categoria repetidos. Estado operacional (PV/condições) e responsável continuam presentes onde fornecidos. Retratos individuais não foram reduzidos.
- Edição/conhecimento/ficha de NPC entram no menu da carta. Registros da campanha também oferecem editar/excluir nas listas, preservando autorização e confirmação existentes.
- Modal começa com foco no diálogo, com Tab/Shift+Tab/Escape e retorno ao acionador não textual. Não retorna automaticamente a uma busca, evitando abrir teclado virtual. Formulários extensos ficam em tela cheia no celular, com corpo rolável e ações fixas; imagem aparece antes do nome. Viewport inclui `interactive-widget=resizes-content`.
- Removidos nomes redundantes de campanha dos cabeçalhos internos de Personagens, Diário, Anotações, Iniciativa, Encontros, criador e ficha.
- Modo global **Ver como jogador** no Menu: mantém sessão e RLS reais, troca apenas apresentação, bloqueia mutações, usa `codex_preview` do servidor para registros, vínculos, títulos e imagens. Nenhum nome salvo em títulos antigos é usado como fallback para páginas privadas. Navegação comum mantém a prévia; Menu retorna ao mestre. A prévia é de um jogador genérico: não representa a conta de um participante, sua ficha nem notas pessoais; não reutiliza notificações, posses ou definições privadas do mestre.
- Vínculos do editor do Compêndio ficam em rascunho (inclusões/remoções); cancelar não chama a API. Salvamento conjunto depende da proposta 0023. Sem sua capacidade, há mensagem **antes de qualquer gravação/upload**; texto e seleção permanecem no editor. Edições sem mudanças de vínculos continuam usando a infraestrutura 0022.
- Relações comuns ficam em linhas compactas, com miniatura, nome, relação e categoria. Destinos de campos próprios (residência, naturalidade, habitantes) também usam a lista compacta única, sem duplicação em fatos ou seções por relação. Texto livre dos campos é preservado.
- Quadro do mestre no celular com rolagem horizontal e colunas roláveis verticalmente; sensores/alças reutilizados. A composição das anotações do jogador permanece como na base.

## Banco: 0023 proposta, não aplicada

`supabase/migrations/0023_edicao_codex_atomica.sql` adiciona somente `codex_save_edit` e `codex_edit_capability`. Reutiliza as funções atuais de autorização/validação de conteúdo, caminho de imagem, versão, criação e remoção de relações. Conteúdo e vínculos fazem parte da mesma transação. Rejeita relações que não envolvam o registro editado e limita/valida o JSON. Não modifica as migrações 0001–0022, RLS ou dados existentes.

Rollback: `supabase/rollback/0023_edicao_codex_atomica_down.sql` remove apenas as duas funções. Isso preserva todos os registros/vínculos gravados e devolve o frontend à mensagem de capacidade indisponível. Testes locais PGlite cobrem autorização de mestre/jogador/anônimo, outra campanha, versão, estrutura inválida, reversão integral e relações inversas. Nenhum SQL foi executado remotamente. **0022 já aplicada em produção: não reaplicar.**

Uploads são novos objetos; nunca sobrescrevem a imagem antiga. Uma falha posterior ao upload pode deixar objeto sem referência; não há limpeza automática nem exclusão de imagens nesta entrega.

## Conclusão do trabalho recuperado (27/11/2026)

O limite de uso interrompeu a finalização com 25 arquivos alterados e 4 novos sem commit; foram recuperados e preservados. Entregue com eles:

- Formulário do NPC em seções recolhíveis (identidade, origem e residência, descrição e história, vínculos, notas privadas), com estado vital gravado só em Salvar e confirmação de morte.
- Identidade do aventureiro em janela com Salvar/Cancelar, com idade, ocupação, naturalidade, residência, observações, personalidade e história na ficha privada (`draft.story`); a aba Ficha mostra esses campos.
- Referência a item de catálogo ainda sem página criada dentro da mesma transação (0023).
- Retorno de Encontros e da ficha própria no cabeçalho; ações do catálogo em menu; barra de PV no cartão.
- Sem a 0023, o estado vital **alterado sozinho** continua gravando pela operação da 0022; junto de outra alteração ou de vínculos, o app avisa e não grava nada.

## Pendências

1. Notas privadas do mestre para **aventureiros** não existem: a ficha deles não tem registro privado só do mestre; exige armazenamento novo (SQL e RLS) e decisão do responsável. Os vínculos de aventureiros continuam na carta (gravação imediata), fora do formulário; o estado vital deles continua na janela do mestre, com Salvar e confirmação.
2. Revisar os menus dos demais tipos de catálogo e identidade (não houve varredura completa).
3. Revisar, autorizar e aplicar a 0023; sem ela, não há salvamento conjunto de vínculos.
4. Confirmar arraste em Android físico, teclado físico e leitor de tela.
5. Otimizar a prévia em campanhas grandes (até seis projeções simultâneas; não há leitura em lote).

Anotações: não iniciadas; ver [ANOTACOES-BETA-HANDOFF](ANOTACOES-BETA-HANDOFF.md). Sem merge, publicação ou migração.

## Validação

Local (Windows), sobre o resultado final, sem acesso a Supabase real:

- TypeScript (aplicativo e E2E) e build aprovados; permanece o aviso de pacote acima de 500 kB.
- Vitest: **1.889/1.889** (158 arquivos), incluindo PGlite com a 0023 e sua reversão.
- Playwright principal: 168 aprovados e 20 não aplicáveis na rodada completa; o cenário de encontro na nuvem falhou nas 4 larguras porque procurava o botão de retorno antigo. Ajustado para o botão do cabeçalho, o arquivo passou (8/8).
- Playwright criação: 140 aprovados, 4 não aplicáveis. Qualidade: 88 aprovados, 32 não aplicáveis.
- Localmente os testes usaram a porta 4199 (temporária, não commitada) e não gravaram capturas novas.
- Não executados: Supabase isolado do CI, sessões reais e aparelho físico. As capturas abaixo são anteriores à conclusão e não mostram os formulários finais.

## Capturas verificadas em navegador

Dados inteiramente fictícios. Inspeção visual de cartões mobile/desktop, formulário e prévia de jogador; o título real Varyn não aparece na prévia nem na aba.

| Tela | Celular (390 px) | Desktop (1440 px) |
|---|---|---|
| Cartões | [Captura](evidencias/interface-global/cartoes-390.png) | [Captura](evidencias/interface-global/cartoes-1440.png) |
| Formulário | [Captura](evidencias/interface-global/formulario-390.png) | [Captura](evidencias/interface-global/formulario-1440.png) |
| Prévia pública | [Captura](evidencias/interface-global/previa-390.png) | [Captura](evidencias/interface-global/previa-1440.png) |

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
- Vínculos do editor ficam em rascunho (inclusões/remoções); cancelar não chama a API. Salvamento conjunto depende da proposta 0023. Sem sua capacidade, há mensagem **antes de qualquer gravação/upload**; texto e seleção permanecem no editor. Edições sem mudanças de vínculos continuam usando a infraestrutura 0022.
- Relações comuns ficam em linhas compactas, com miniatura, nome, relação e categoria. Destinos de campos próprios (residência, naturalidade, habitantes) também usam a lista compacta única, sem duplicação em fatos ou seções por relação. Texto livre dos campos é preservado.
- Quadro do mestre no celular com rolagem horizontal e colunas roláveis verticalmente; sensores/alças reutilizados. A composição das anotações do jogador permanece como na base.

## Banco: proposta, não aplicada

`docs/propostas/0023_edicao_codex_atomica.sql` adiciona somente `codex_save_edit` e `codex_edit_capability`. Reutiliza as funções atuais de autorização/validação de conteúdo, caminho de imagem, versão, criação e remoção de relações. Conteúdo e vínculos fazem parte da mesma transação. Rejeita relações que não envolvam o registro editado e limita/valida o JSON. Não modifica as migrações 0001–0022, RLS ou dados existentes.

Rollback: remover apenas as duas funções (comandos no fim da proposta). Isso preserva todos os registros/vínculos gravados e devolve o frontend à mensagem de capacidade indisponível. Testes locais PGlite cobrem autorização de mestre/jogador/anônimo, outra campanha, versão, estrutura inválida, reversão integral e relações inversas. Nenhum SQL foi executado remotamente. **0022 já aplicada em produção: não reaplicar.**

Uploads são novos objetos; nunca sobrescrevem a imagem antiga. Uma falha posterior ao upload pode deixar objeto sem referência; não há limpeza automática nem exclusão de imagens nesta entrega.

## Validação

- Suíte completa: **1.885/1.885** aprovados (158 arquivos; `vitest --configLoader runner`).
- TypeScript e build local aprovados; aviso existente de bundle acima de 500 kB.
- E2E/axe direcionados: **45/45 aprovados**; larguras 320/390/700/768/1440, incluindo dois grupos nos testes de Compêndio. Não há exceções axe, retries ou testes marcados como falha esperada.
- Capturas reais geradas pelo Playwright em `test-results/` e anexadas ao relatório. Capturas selecionadas em `docs/evidencias/interface-global/`.
- Ambiente isolado sem credenciais Supabase; requisições externas bloqueadas pelas fixtures. PGlite descartável; nenhuma conta/dado real.
- Windows: o otimizador de dependências do Vite falha por acesso negado a `C:\Users`; a validação de navegador usa build local com `NODE_ENV=development`, modo `e2e`, credenciais vazias e `vite preview`. CI Linux mantém os comandos normais.

## Pendências explícitas — não considerar o pedido integral concluído

1. Unificar integralmente o formulário narrativo de aventureiros e NPCs (incluindo origem, personalidade, observações, vínculos e notas privadas), com autorização e persistência próprias do aventureiro, sem duplicar raça/classe/nível da ficha. Esta branch ainda usa os editores existentes de identidade pública dos aventureiros.
2. Mover o estado vital para esse formulário, com alteração só ao salvar e confirmação de morte. O controle atual e a fonte `character_life` foram preservados; não houve segunda fonte.
3. Revisar o retorno interno de Encontros e a barra especial da ficha própria mobile. O retorno interno duplicado da ficha de criatura foi removido nesta continuação.
4. Completar padronização dos menus de todos os tipos de catálogo/identidade. A entrada da seleção múltipla já está no menu compartilhado da barra; confirmações e restrições dos selecionados foram preservadas.
5. No editor transacional, a criação de referência a item de catálogo ainda não cadastrado continua pendente. Registros existentes funcionam; a apresentação compacta de todos os vínculos foi unificada.
6. Revisão/autorização da proposta 0023 antes de habilitar salvamento conjunto em produção; não aplicar automaticamente nem publicar como migração já instalada.
7. Confirmar arraste real em Android com colunas roláveis e teclado físico/leitor de tela. Simulação Chromium não equivale a validação em aparelho físico.
8. Otimizar leitura da prévia em campanhas grandes: usa até seis projeções simultâneas; não há endpoint de lote dedicado nesta entrega.

Um único PR reúne o trabalho. Deve permanecer em rascunho enquanto estas lacunas impedirem considerá-lo a entrega integral solicitada. Sem merge ou deploy.

## Capturas verificadas em navegador

Dados inteiramente fictícios. Inspeção visual de cartões mobile/desktop, formulário e prévia de jogador; o título real Varyn não aparece na prévia nem na aba.

| Tela | Celular (390 px) | Desktop (1440 px) |
|---|---|---|
| Cartões | [Captura](evidencias/interface-global/cartoes-390.png) | [Captura](evidencias/interface-global/cartoes-1440.png) |
| Formulário | [Captura](evidencias/interface-global/formulario-390.png) | [Captura](evidencias/interface-global/formulario-1440.png) |
| Prévia pública | [Captura](evidencias/interface-global/previa-390.png) | [Captura](evidencias/interface-global/previa-1440.png) |

### Verificação adicional

A inspeção do cartão operacional encontrou uma regra antiga que limitava placeholders a 76 px. Ela foi removida; no navegador mobile, cartão e miniatura mediram **179,09 × 179,09 px**, com PV e responsável preservados. [Captura operacional](evidencias/interface-global/operacional-390.png).

Primeira rodada Linux: validação (1.885 testes), Supabase isolado, preview, quality e as duas partes de creator aprovados. E2E geral: 168 aprovados, quatro expectativas antigas de menu não incluíam a nova ação "Ver como jogador"; a lista explícita de ações do mestre foi atualizada, preservando a lista do jogador. As 20 omissões condicionais dessa suíte já pertencem à infraestrutura; nenhuma foi adicionada para encobrir falhas. Verificar o resultado do HEAD no PR antes de integrar.

### Continuação priorizada — somente #171

Instrução posterior: concentrar esta IA exclusivamente em concluir #171. **Nenhuma implementação de Anotações foi iniciada.** A especificação completa está no documento [ANOTACOES-BETA-HANDOFF](ANOTACOES-BETA-HANDOFF.md), para outra IA.

Nesta continuação: seleção múltipla abre pelo menu da barra e mantém elegibilidade/confirmacões; relações de campos próprios usam a lista única; nomes acessíveis separam título e relação com espaço; retorno duplicado da ficha de criatura removido. Testes direcionados: **50/50** (persistência/seleção/interface) e **20/20** (Compêndio/relações). Não houve execução redundante da suíte completa, migração de produção ou início do módulo de Anotações. E2E adaptado para continuar verificando relações ocultas, sem mascarar vazamento por mudança de nome acessível.

**Ainda não concluído:** formulário narrativo unificado de aventureiros/NPCs; estado vital dentro dele com confirmação e gravação apenas em Salvar; retorno interno de Encontros/barra de ficha própria mobile; demais menus de catálogo/identidade; referência de catálogo ainda não registrada dentro da transação; revisão/autorização da proposta 0023; validação física em Android; otimização de leitura da prévia. Não declarar o PR pronto para integrar com base apenas nos testes aprovados.

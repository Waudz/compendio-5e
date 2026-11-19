# Contrato de implementação — Planejamento e registros de sessão

> Proposta técnica para revisão, 19/11/2026. Não equivale a implementação, aprovação de schema, migração, merge ou deploy. Decisões de produto aprovadas constam em REGISTRO-OFICIAL-DECISOES.md. Inspeção estática da main: src/navigation.ts, src/App.tsx, src/Mobile.tsx, src/workspace.ts, src/Panel.tsx e docs/NOTAS-PERMISSOES.md.

## 1. Fronteiras do produto
- **Página** é conteúdo canônico editado por blocos; pode representar cena, anotação global, entrada da Enciclopédia ou documento. Não copiar conteúdo ao criar atalhos.
- **Sessão** agrupa preparação e registros de jogo. Não é a mesma coisa que o texto final do Diário.
- **Coluna** é organização livre de uma sessão no quadro. Cartões têm ordem vertical, podem ser expandidos e contraídos. A visão Estrutura usa os mesmos objetos.
- **Cartão** é referência tipada a página ou encontro, ou bloco de organização próprio da sessão. Não guardar cópia da descrição original de encontro ou página.
- **Registro rápido** é um acontecimento ou observação escrita durante a sessão, com autor, instante e vínculo opcional a cartão. Não altera o planejamento original; pode existir sem cartão.
- **Pendência** é item marcado para resolver depois (ex.: criar NPC), opcionalmente derivado de registro rápido. Não é automaticamente um NPC real.
- **Encontro** é definição reutilizável. **Combate executado** é instância com estado e resultados próprios; não atualizar a definição do encontro por dano ou condições.

## 2. Proposta de modelo lógico (não SQL aprovado)
Entidades sugeridas:
- planning_sessions: id, campaign_id, title, status, created_by, created_at, updated_at.
- planning_columns: id, session_id, title, sort_key.
- planning_cards: id, column_id, target_type (page | encounter | text), target_id opcional, sort_key, collapsed, dados mínimos do cartão local.
- notes (já existente): página canônica, owner_id, campaign_id opcional, visibilidade e version. Evolução de conteúdo por blocos e metadados de hierarquia deve ser proposta separadamente.
- note_links: id, source_note_id ou origem tipada, target_type, target_id; vínculo não concede permissão.
- session_entries: id, session_id, card_id opcional, author_id, body, occurred_at, created_at, kind (event | observation); preservação de edições/histórico a definir.
- session_tasks: id, session_id, entry_id opcional, card_id opcional, body, status, created_by, created_at.
- encounters e combat_runs: apenas nomes conceituais; schema específico depende do módulo Encontros e deve ser coordenado com ele.

**Não aprovar ainda:** tipos de IDs, índices, limites, posição fracionária vs inteiros, CAS/versão, blocos JSON vs tabelas, histórico append-only, política de exclusão, armazenamento offline e política de RLS. Todas essas decisões exigem análise com a migração 0004 e testes PGlite. Não criar migração 0005 sem aprovação.

## 3. Fluxos mínimos de usuário
1. Mestre cria sessão e colunas livres (ex.: Julkoun, Estrada, Floresta).
2. Adiciona cena/página ou referência a encontro a uma coluna; ordena verticalmente; expande para consultar. Abrir página completa não perde posição do quadro.
3. Durante a sessão, em desktop ou celular, escreve 'Conversaram com o guarda Hawthorne; cadastrar NPC depois' como registro vinculado ao cartão, e marca pendência sem alterar o texto preparado.
4. Pode registrar evento mesmo quando os jogadores desviam do planejado, sem criar uma cena artificial.
5. Após a sessão, exporta/copía o conjunto completo organizado por coluna e cartão, com PLANEJAMENTO / REGISTROS / PENDÊNCIAS separados. Mestre redige manualmente o Diário; exportar não publica nada.
6. Cartão de encontro mostra prévia permitida e abre a definição original. Execução de combate usa instância separada.

## 4. Contrato de navegação
- Menu lateral: modo reuse; seleciona aba existente ou reutiliza aba limpa/não fixada do grupo ativo. Ctrl/Cmd, botão do meio ou menu contextual podem pedir nova aba.
- **Link interno dentro de conteúdo:** modo new (nova aba interna permanente); se id já está aberto, selecionar sem duplicar. Nunca substituir a origem. A aba de destino pode ser fixada manualmente.
- A função atual navigate(model, spec, mode='reuse', isDirty) já suporta new; o problema é a origem do evento: App.tsx passa onOpen={open} a Panel e Mobile, e Panel.tsx chama onOpen(spec) sem mode nos exemplos. Portanto, implementar uma API explícita openContentLink(spec) => open(spec,'new'), distinta de openMenu(spec) => open(spec,'reuse'); não depender de largura, quantidade de abas ou inferência de origem pelo tipo de registro.
- Garantir que clicar na prévia de encontro ou em link de NPC usa openContentLink; botões de menu usam openMenu. Ação programática já pode usar new.
- workspace.ts Kind só inclui secao/conta/campanha/ficha/npc/documento; introduzir novos kinds (ex.: cena, encontro) requer atualizar parseTabId, tabJson, titleOf, factory, testes e sanitização. Nunca usar nome como identificador; garantir escopo por campanha.
- **Importante:** a implementação atual usa config.pinned para fixação, não aba 'preview' nativa do VS Code. O termo 'temporária' aqui significa reutilizável/não fixada, não deve levar a uma refatoração de semântica não aprovada.
- Mobile atual renderiza FlexLayout como faixa de abas; shell mobile aprovado é futuro e separado. Não estender esta faixa como solução final.

## 5. Segurança e privacidade
- notes já possui RLS e visibilidades private/master/campaign/selected na 0004. Reutilizar can_read_note e checar permissões também em cartão, vínculo, prévia, busca e exportação; jamais entregar título, conteúdo ou existência de registro inacessível por join indireto.
- O fato de mestre criar o quadro não concede acesso a nota privada de outro autor. Definir regra de autoria e leitura para registros rápidos antes de implementar; recomendação: registros de condução do mestre privados por padrão.
- Validar membership atual do autor e do leitor na campanha, incluindo saída e reentrada; evitar acesso cruzado entre campanhas e caches de usuário anterior.
- Concorrência: não sobrescrever bloco ou registro silenciosamente; reportar conflitos e preservar rascunhos. Não presumir offline funcional.

## 6. Exportação mínima verificável
- Um comando 'Copiar sessão' e 'Exportar' deve operar sobre todas as colunas e cartões visíveis/autorizados, em ordem determinística.
- Cada cartão tem cabeçalho e indicação de tipo. Seções PLANEJAMENTO, REGISTROS DA SESSÃO e PENDÊNCIAS separadas; registro sem cartão vai para seção 'Registros gerais'.
- Opções independentes incluir planejamento, registros, pendências; preservar links como texto/identificador seguro quando permitido. Formatos iniciais sugeridos: texto e Markdown.
- Não exportar segredos para leitores sem permissão; não alterar Diário, notas nem encontro ao exportar.
- Testar sessão vazia, múltiplas colunas, múltiplos registros, caracteres especiais, registros sem cartão, links quebrados e dados inacessíveis.

## 7. Editor: decisão técnica ainda aberta
Comparar bibliotecas de editor por blocos (por exemplo Tiptap/ProseMirror, BlockNote e Lexical) com evidências de licença atual, manutenção, bundle, suporte a React 18/TypeScript, serialização, tabelas, imagens, colagem, links internos, acessibilidade, uso no celular e sanitização. Não adotar uma dependência só por semelhança visual com AFFiNE. Priorizar protótipo com texto, listas, links, histórico e salvamento confiável antes de imagens/tabelas avançadas.

## 8. Critérios de aceite e não escopo
- Quadro e Estrutura são duas visões do mesmo conteúdo; não há duplicação de páginas/encontros ao mover cartões.
- Registros rápidos não alteram o planejamento, funcionam em desktop e celular e podem ser exportados em lote.
- Links internos preservam a aba de origem; menu mantém regra atual. Mesmo registro não duplica aba.
- Testes de RLS multiusuário, conflito de edição, restauração e isolamento de campanha.
- Fora deste incremento: canvas infinito, colaboração simultânea estilo Google Docs, VTT, publicação automática de Diário, suporte 2024, editor visual completo no celular e integração com o legado.
- A primeira tarefa do Claude Code é **produzir diagnóstico, comparação de editor e schema proposto**, sem alterações de produção, sem aplicar SQL e sem merge. Entregar diffs, testes executados e pendências para aprovação.

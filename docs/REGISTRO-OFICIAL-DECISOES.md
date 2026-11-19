# Registro oficial de decisões e pendências — Compêndio 5e 2.0

> Atualizado em 19/11/2026. **Fonte:** decisões expressas nas conversas de planejamento, confrontadas com `DECISOES-E-ARQUITETURA.md` e `docs/PLANEJAMENTO-V2.md`. Este registro distingue **APROVADO**, **PENDENTE**, **PROPOSTA** e **IMPLEMENTADO**. Não equivale a código pronto. Em conflito, confirmar com o responsável e atualizar os documentos canônicos; não inferir aprovação de uma sugestão.

## A. Decisões aprovadas — navegação e campanha

1. **Um projeto, duas apresentações independentes:** React/TypeScript e dados/regras compartilhados; desktop com FlexLayout e até três colunas; mobile com navegação própria por telas, **sem abas nem grupos de workspace**. Um painel desktop estreito jamais deve renderizar o aplicativo mobile dentro dele. A decisão de qual shell renderizar ocorre no nível da aplicação, não na largura de um painel.
2. **Campanha ativa persistente:** restaurar a última campanha acessível. Seletor de campanha discreto e secundário, sem seleção repetida em cada entrada. Trocar de campanha preserva o isolamento de dados e exige proteção para alterações não salvas.
3. **Visão geral como Início:** mostrar capa escolhida pelo mestre, descrição e personagens/participantes, com acessos úteis. No desktop, é uma aba que pode ser reaberta, não substitui restauração de workspace existente. No celular, é a tela inicial. Campanhas deixa de ser destino administrativo de destaque; criação, convites e configurações ficam em acesso secundário. Sem campanha, oferecer criar/entrar sem tela vazia.
4. **Mobile jogador — quatro destinos fixos:** Início, Ficha, Inventário e Compêndio. Enciclopédia, Diário e Documentos são acessados dentro de Início (e podem ter atalhos na visão geral), não ocupam a barra inferior.
5. **Histórico independente por destino mobile:** ao sair de Início → Enciclopédia → página e entrar em Ficha, voltar a Início recupera a mesma página, filtros e rolagem. Tocar em Início novamente, quando Início já está selecionado, retorna à raiz Início. Botão Voltar navega no histórico interno. Preservar estados de Ficha, Inventário e Compêndio analogamente; separar por usuário/campanha e não expor dados de contexto anterior.
6. **Ficha mobile:** abre prioritariamente o personagem vinculado à campanha ativa, sem etapa de seleção quando há apenas um. Oferece seletor discreto de outros personagens. **PENDENTE:** comportamento ao abrir ficha pessoal de personagem não vinculado, e como o Inventário reage; não escolher antecipadamente.
7. **Mobile mestre — foco em condução de sessão:** quatro destinos inicialmente propostos e aceitos como direção: Início, Iniciativa, Encontros e Compêndio. Priorizar leitura de planejamento/anotações, resumos de sessão e encontro, fichas de monstros, iniciativa, PV e condições; ações rápidas são úteis, mas edição extensa/preparação complexa pode continuar no desktop. Não tentar reproduzir o AFFiNE completo no celular. A implementação detalhada da UI do mestre fica para etapa posterior. Preservar leitura e combate ao alternar destinos.

## B. Decisões aprovadas — conhecimento e planejamento

8. **Uma infraestrutura de páginas/anotações**, não editores e bancos paralelos para cada módulo; reaproveitar o modelo de permissões de `notes` e planejar evolução antes de migrar. **Não** significa que planejamento, Enciclopédia, Diário e Documentos tenham a mesma finalidade.
9. **Enciclopédia = conhecimento persistente do mundo/campanha:** histórias e origens dos personagens dos jogadores, NPCs, lugares, facções, acontecimentos e relações. Uma página narrativa pode referenciar a ficha mecânica real do personagem, sem duplicar a ficha. Entradas podem conter material público e privado do mestre; nunca retornar segredos para clientes sem permissão.
10. **Planejamento = preparação narrativa:** sessões, locais/etapas, cenas alternativas e referências a encontros. Organização não obriga sequência linear. Exemplo: Sessão 5 → Julkoun (bar, prefeito, mercearia), Estrada (encontro aleatório, carroça atolada), Floresta (cabana do eremita → criação de poções).
11. **Duas visualizações do mesmo planejamento:** desktop em **quadro de colunas** para visualizar possibilidades lado a lado (inspirado no uso do AFFiNE, mas **sem canvas infinito como requisito**); alternativa hierárquica em pastas/seções/páginas. Cada cena é página editável, com referências internas. No mobile do mestre, a mesma estrutura aparece como seções expansíveis e leitura de páginas. Não duplicar conteúdo entre visualizações.
12. **Anotações globais da campanha:** páginas de apoio independentes de uma sessão (NPCs recorrentes, nomes de NPCs improvisados, ideias, regras próprias, pistas, lembretes). **Atalhos** para uma página global podem aparecer em várias cenas/colunas/sessões sem criar cópias; remover atalho não exclui a origem. Distinguir atalhos de cópias e compartilhamento de visibilidade.
13. **Integração por referências:** cena → NPC/local da Enciclopédia, encontro, monstro, documento ou anotação global; abrir referência e voltar preserva o ponto de leitura. Diário registra o que aconteceu; Planejamento, o que se pretende; Documentos armazena cartas/mapas/arquivos. Favoritos e captura rápida de observações foram **propostos**, mas o detalhamento não está aprovado.
14. **Permissões:** planejamento e notas do mestre privados por padrão; publicação/compartilhamento explícitos. Vínculo/atalho não concede acesso por si. Proteção no Supabase/RLS e na busca/prévias, não apenas na interface. Considerar conteúdos compartilhados com toda a campanha e, futuramente, destinatários específicos.

## C. Decisões de regras e escopo

15. **Primeira implementação: D&D 5e 2014 / SRD 5.1.** Preparar arquitetura para 2024 no futuro, com `ruleset_version` por campanha e catálogos/mecânicas versionados. **Não misturar 2014 e 2024 na mesma campanha** inicialmente. Converter uma campanha entre versões, se oferecido futuramente, requer fluxo guiado, prévia de incompatibilidades, backup e confirmação; não basta trocar um campo.
16. A biblioteca de regras de 2014 deve planejar, além de monstros/magias/itens, classes/progressões, raças, antecedentes, talentos, condições, perícias, testes, descanso, combate e demais regras **efetivamente permitidas pelo SRD**; distinguir conteúdo SRD de material proprietário e personalizado. Automação completa de combate e VTT continuam fora do escopo.
17. **Não reconstruir AFFiNE:** o objetivo é oferecer preparação e consulta suficientes para que o mestre possa deixar de depender dele, sem prometer paridade de canvas, colaboração ou edição móvel avançada. A implementação deve ser incremental.

## D. Pendências para conversar com os jogadores — não implementar uma resposta presumida

| ID | Tema | Pergunta em aberto | Observação |
|---|---|---|---|
| J1 / D7 | Bestiário para jogadores | Ficha mecânica completa, apenas nome/imagem/descrição, ou configuração por campanha? | **Já constava na documentação anterior**. Não aplicar restrição definitiva até decidir. |
| J2 | História dos personagens | Jogadores editam diretamente a Enciclopédia ou pela Ficha, com organização/publicação pelo mestre? | **Explicitamente deixada para discutir com o grupo em 19/11/2026.** |
| J3 (a confirmar) | Informações de colegas | A regra já aprovada é nome/retrato/nível, com PV configurável pelo mestre. O grupo deseja reavaliá-la? | **Não é decisão aberta por padrão:** D4 já está aprovada. Só reabrir se o responsável quiser. |

## E. Outras pendências — não confundir com votação dos jogadores

| ID | Questão | Estado |
|---|---|---|
| P1 | Abrir personagem pessoal não vinculado no seletor Ficha mobile e efeito sobre Inventário/contexto | Pendente de decisão de produto |
| P2 | Como apresentar múltiplas fichas de personagens vinculados à mesma campanha | Detalhe de UX pendente |
| P3 | Exclusão de conta versus retenção de histórico de campanha | Pendente, já documentado; resolver antes de personagens |
| P4 | Testar mobile real, gestos, persistência de leitura e isolamento de shells | Pendente de implementação e validação |
| P5 | Editor, modelo de quadros/atalhos, ordenação, versões, links e migrações de notas (`0005` conteúdo; `0008` vínculos; `0009` audiências) | Projeto técnico pendente; **não alterar Supabase sem autorização** |
| P6 | Reaproveitamento seguro do legado e plano de sincronização/offline | Pendente; não tocar no projeto 1.0 |
| P7 | Verificar itens 1c da navegação desktop (gestos de abrir registros e acesso ao menu de fixar) | Já registrado em `docs/NAVEGACAO-ABAS.md` |
| P8 | Favoritos e notas rápidas no celular; múltiplas cenas abertas lado a lado | Propostas interessantes, ainda não requisitos fechados |
| P9 | Interface mobile completa do mestre e edição avançada no celular | Detalhamento adiado, sem bloquear módulos compartilhados |

## F. Decisões anteriores preservadas (não reabrir sem pedido)

- D1: exclusão lógica de personagem, lixeira restaurável, histórico e anotações preservados.
- D2: saída/remoção arquiva participação; retorno restaura estado preservado.
- D3: nota tem dono; vínculos múltiplos não transferem propriedade nem concedem compartilhamento.
- D4: dono e mestre veem ficha completa da participação; colegas veem nome/retrato/nível, PV conforme configuração do mestre.
- D5: `notes` é a base única de anotações/documentos.
- D6: cinco moedas oficiais 2014, campanha escolhe ativas, carteira independente e inicialmente zerada ao vincular; sem economia complexa.
- D7: bestiário de jogadores **a decidir com o grupo**.
- Uma campanha ativa por vez; RLS e isolamento por usuário/campanha; projeto 1.0 intocado; PR e merge somente mediante autorização.

## G. Situação de implementação e próximos passos

**Registro de decisões, não entrega de funcionalidades.** No momento de referência, desktop com FlexLayout, autenticação, campanhas e banco básico de notas existem; módulos RPG e editor/planejamento não estão implementados; mobile atual ainda usa navegação antiga e não corresponde a esta especificação. PWA/offline também não estão prontos.

**Ordem recomendada (proposta, não autorização para código/banco):** (1) fechar correções 1c e consolidar documentação; (2) criar shell mobile independente e visão geral Início sem romper desktop; (3) projetar modelo de páginas, links, audiências e atalhos compatível com `notes`; (4) implementar por incrementos editor, planejamento e Enciclopédia, em paralelo à biblioteca SRD e fichas conforme dependências; (5) testar RLS e uso real; (6) interface mobile do mestre para leitura/combate.

**Procedimento para novas conversas:** ler este registro junto com `DECISOES-E-ARQUITETURA.md` e `docs/PLANEJAMENTO-V2.md`; conferir estado real de branch/PR antes de afirmar que algo está implementado; registrar novas decisões com data e status; não converter proposta em aprovação; não sobrescrever decisões anteriores sem explicitar a mudança.

## H. Decisões adicionais aprovadas em 19/11/2026 — planejamento e navegação

### Editor e quadro
- Editor por blocos inspirado em AFFiNE/Notion para páginas, cenas e anotações; desenvolvimento incremental, sem canvas infinito obrigatório.
- Colunas livres independentes de pastas, com cartões em lista vertical. Reorganizar cartões não move a página original; atalhos não duplicam conteúdo.
- Cartão compacto com título/prévia ou expandido com blocos, com edição no quadro quando viável; página completa em aba própria. No mobile mestre, colunas são seções expansíveis e cenas abrem para leitura, preservando contexto.

### Registros rápidos, exportação e Diário
- Registro rápido por cartão/cena durante sessão no desktop e celular, sem alterar planejamento. Permitir registro sem cena preparada e marcação de pendências, como cadastrar NPC depois.
- Registros brutos privados por padrão e preservados cronologicamente. Diário é redigido manualmente pelo mestre; registros não são publicados nem transformados automaticamente em resumo.
- Exportar/copiar todos os cartões de uma sessão de uma vez, por coluna e cena, distinguindo PLANEJAMENTO, REGISTROS DA SESSÃO e PENDÊNCIAS. Filtros e formatos texto/Markdown são proposta de primeira entrega; exportação lado a lado com Diário é melhoria não bloqueante.

### Encontros
- Cartão de encontro especial no planejamento, com resumo, criaturas/quantidades e link para encontro original em aba própria. Vínculo não duplica dados; mudanças no original atualizam prévias; duplicação explícita cria variante.
- Iniciar combate cria instância independente com PV, condições e resultados, sem alterar encontro original. Histórico deve preservar o estado executado, a detalhar tecnicamente.
- Vincular encontro como bloco dentro de cena também foi sugerido; não é requisito obrigatório da primeira entrega.

### Navegação desktop — decisão mais recente
- Modelo inspirado no VS Code: clique normal no menu ativa destino existente ou reutiliza aba temporária/não fixada; aba fixada ou com edição não salva não é substituída. Iniciar edição protege a aba; fixação manual disponível.
- Links internos de conteúdo para NPC, local, encontro, documento ou cena abrem nova aba permanente no workspace, sem substituir origem. Se o registro já está aberto, ativar aba existente sem duplicar. Menu permite abrir em nova aba explicitamente. Regra independe da quantidade de painéis; mobile usa histórico próprio.
- Esta decisão altera a regra anterior de navegação normal por registros em docs/NAVEGACAO-ABAS.md. Reconciliar documentação, código e testes antes de considerar implementado.

**Pendências:** J1/D7 bestiário dos jogadores; J2 autoria da história dos personagens; compartilhamento granular da Enciclopédia; modelo de blocos e vínculos; sincronização; teste real. Nenhuma autorização de migração, merge ou publicação está implícita.

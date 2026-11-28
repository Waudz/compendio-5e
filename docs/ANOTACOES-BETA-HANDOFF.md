# Anotações da Beta — transferência de contexto

## Estado e responsabilidade

Requisitos aprovados pelo responsável em 27/11/2026. **Implementação não iniciada por esta IA.** A instrução mais recente é concentrar esta rodada exclusivamente em concluir o PR #171; outra IA pode assumir Anotações a partir desta especificação. Este arquivo documenta escopo, não entrega nem autorização de banco.

Repositório: `Waudz/compendio-5e`, React/TypeScript/Vite, Supabase. Main verificada: `1e6e2f206091791ebade01bcab474b4196bbe821`; PR #171 de componentes compartilhados aberto na branch `feat/interface-global-consistente`. Conferir HEAD/main e coordenação antes de criar uma branch própria, sem sobrescrever mudanças. Entregar o módulo completo em **um único PR dedicado**, sem fracionar em publicações intermediárias. Nenhum merge/deploy está autorizado implicitamente por esta documentação.

## Experiência aprovada

- Mestre: **documentos e quadros**. Jogador: **somente documentos**.
- Mesmo editor BlockNote e componentes compartilhados para ambos os papéis; reaproveitar a infraestrutura existente.
- Desktop: barra lateral recolhível de navegação entre documentos/quadros, inspirada no AFFiNE.
- Mobile: listagem com alternância Documentos/Quadros para mestre; jogador somente Documentos.
- Preservar a última anotação aberta ao navegar para Ficha, Compêndio ou outras áreas e voltar.

## Pendência herdada do #171: notas privadas sobre aventureiros

Por decisão do responsável (27/11/2026), entra neste módulo. Hoje o mestre tem notas privadas em registros do Compêndio (como NPCs), mas **não** sobre aventureiros: não há onde guardá-las sem que o dono da ficha possa lê-las. Requer armazenamento privado do mestre por campanha e personagem, com RLS (nem o dono do personagem nem os outros jogadores leem), fora da ficha e da identidade pública, com testes isolados e reversão; SQL somente como proposta, sem aplicação sem autorização. Não implementado.

## Quadros do mestre

- Remover a obrigatoriedade de seções; **preservar todos os cartões e conteúdos existentes**.
- Adicionar cartões ao lado e abaixo; área de trabalho finita que se expande conforme a quantidade/posição dos cartões.
- Movimentação horizontal, vertical e diagonal.
- Não adotar proposta de grade responsiva ou tamanhos pequeno/médio/largo.
- Pinça para zoom no celular; controles de zoom no desktop; botão para enquadrar todos os cartões.
- Abrir cartão em tela cheia para leitura/edição no celular, utilizando o editor compartilhado.
- Avaliar bibliotecas de gestos, por exemplo React Zoom Pan Pinch, antes de implementar zoom/pan do zero. A biblioteca ainda **não foi escolhida nem instalada**.
- **Fora do escopo:** quadro infinito, desenhos livres e conexões/setas entre cartões.

## Referências e encontros

- Vincular encontros existentes diretamente aos cartões, com visualização e envio para a Iniciativa pelo mecanismo existente.
- Documentos e cartões permitem referências a personagens, NPCs, monstros, locais, itens, magias e organizações do Compêndio.
- Referências devem apontar para os registros originais, sem duplicar fichas, encontros ou dados de catálogo.
- Resolver nomes/imagens/conteúdo segundo as permissões do usuário; uma referência não concede descoberta, acesso ou divulgação de segredos.

## Persistência, privacidade e compatibilidade

- Salvamento automático e sincronização entre dispositivos, por usuário e campanha.
- Anotações privadas: mestre não lê notas privadas do jogador; colegas não leem notas uns dos outros. Aplicar autorização no servidor, preservando RLS.
- Preservar integralmente documentos, cartões, vínculos, encontros, IDs e conteúdo BlockNote existentes.
- Não apagar os quadros antigos dos jogadores. A nova experiência é somente documentos: preparar adaptação/conversão **não destrutiva**, mantendo conteúdo e referências recuperáveis. O responsável não escolheu um algoritmo de conversão; documentar e testar a compatibilidade antes de gravar qualquer transformação.
- Preservar rascunhos em falha de salvamento, tratar concorrência/versões e não substituir silenciosamente conteúdo novo de outro dispositivo.
- Não aplicar migrações em produção sem autorização. Se necessárias, preparar proposta revisável, testes isolados e rollback não destrutivo.
- A migração 0022 já está aplicada em produção; **não reaplicar**. A 0023 do #171 (`supabase/migrations/0023_edicao_codex_atomica.sql`) não está aplicada; confirmar situação atual em vez de presumir sua disponibilidade.

## Infraestrutura de partida (conferir código atualizado)

- `src/Planning.tsx`: tela atual compartilhada por mestre/jogador; quadros em registros `board`, cartões/páginas em `scene`, privados. Modelo antigo: colunas → seções → cartões.
- `src/quadro.ts`: modelo e operações do quadro antigo. Leitura de compatibilidade deve preservar cartões de todas as seções/colunas, inclusive casos vazios e referências repetidas.
- `src/EditorLazy.tsx`, `src/PageEditor.tsx`, `src/ConteudoLeve.tsx`: BlockNote, editor sob demanda e leitura de conteúdo.
- `src/registros.ts`, `src/RegistrosContext.tsx`, `src/registrosStore.ts`: acesso autenticado a `notes`, versões, avisos entre telas e tratamento de alterações.
- `src/Panel.tsx`, `src/Mobile.tsx`, `src/workspace.ts`, `src/tabHistory.ts`: entrada `planejamento`, navegação e histórico; reaproveitar sem criar shell paralelo.
- `src/compendio/referencias.tsx`, `src/compendio/consulta.tsx`, `src/compendio/navegacao.ts`: referências, projeções e destinos do Compêndio. Avaliar adaptação ao editor de blocos, sem copiar dados privados.
- `src/Encontros.tsx`, `src/EncontroPagina.tsx`, infraestrutura de combate: usar operações existentes de visualização/envio para iniciativa, sem reimplementar encontros.
- `src/ui/Modal.tsx`, `src/ui/MenuDeAcoes.tsx` e componentes compartilhados do #171: foco, menus e formulários mobile.
- `docs/NOTAS-PERMISSOES.md`, `DECISOES-E-ARQUITETURA.md`, documentação de continuidade: consultar antes de alterar persistência. O contrato TypeScript de registros e os tipos SQL podem diferir; verificar os tipos aceitos, não presumir que `note`/`page` já funciona integralmente.

## Validação e entrega

Executar testes direcionados durante a implementação e bateria completa ao final (TypeScript, build, unitários/integração, E2E, axe e responsividade). Evitar suítes completas intermediárias redundantes.

Cobrir: isolamento por usuário/campanha; autosave/falha/conflito; sincronização/reabertura; preservação de registros antigos; vínculos com registros originais; encontros e envio para iniciativa; retorno à última anotação; sidebar/listagem; leitura/edição fullscreen mobile; pinça, pan horizontal/vertical/diagonal; enquadrar tudo; teclado/foco; zoom sem rolagem indevida da página. Validar especialmente gestos no celular, além da simulação de navegador. Não declarar aparelho físico validado sem evidência.

Documentar arquitetura escolhida, compatibilidade do modelo antigo, testes, capturas reais, limitações e eventuais propostas SQL. Um PR do módulo completo, sem expandir o escopo para VTT, desenhos, setas ou canvas infinito.

## Decisões históricas substituídas

As restrições em `docs/ANOTACOES-JOGADOR.md` que diziam **não alterar o mestre**, **não reabrir a última anotação** ou separar a entrega apenas do jogador foram substituídas pelo pedido acima. As decisões anteriores de privacidade, preservação dos dados e reutilização do BlockNote continuam válidas. Não confundir propostas históricas com funcionalidades implementadas.

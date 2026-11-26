# Compêndio — conhecimento granular (Alpha)

Decisão aprovada em 26/11/2026 após teste do PR #160. Requisitos obrigatórios da Alpha, antes da conclusão do Compêndio. Conhecimento coletivo por campanha; conhecimento individual por personagem fica para evolução futura.

## Navegação e interface
- Clique normal em categoria, registro e vínculo mantém aba/grupo; Voltar retorna ao histórico local e restaura pesquisa, filtros, lista/grade e rolagem. Nova aba/outro grupo somente por ação contextual explícita.
- Seletor de vínculos com resultados pesquisáveis diretamente, imagem, nome e categoria; pesquisa sem distinção de acentos/caixa. Incluir itens do catálogo sem duplicar ou conceder inventário.
- Corrigir sino no menu recolhido, checkbox de remoção de imagem e campos de texto. Preservar registros existentes.

## Campos e apresentação
- Nome obrigatório; demais opcionais. NPC: nome, alcunha, raça, idade, ocupação, naturalidade, residência, descrição, história, personalidade, observações de relações. Local: nome, alcunha, tipo, região, mapa, habitantes, descrição, história. Organização: nome, sigla/alcunha, tipo, quantidade de membros, descrição, história, objetivos. Descoberta: nome, tipo, origem, contexto, descrição, item associado opcional. Todos: imagem, vínculos e notas privadas. Mapa/arquivo anexado completo pode evoluir separadamente; não confundir referência textual com upload.
- Habitantes em seção própria; sede, fundador, membros, proprietário e hierarquia de locais derivados de vínculos tipados quando disponíveis. Relações predefinidas ou personalizadas, com sentido inverso coerente e sem duplicação. Exibir miniaturas e agrupar relações conforme categoria/tipo.

## Conhecimento
- Registro secreto por padrão. Mestre controla existência pública e visibilidade de cada campo, inclusive nome, alcunha, imagem, mapa e cada vínculo. Não exigir sequência fixa. Nome oculto nunca aparece; usar alcunha revelada ou título neutro. Imagem desconhecida: interrogação. Campos ocultos não exibidos. Notas privadas nunca compartilhadas.
- Controles de olho diretamente na página, revelar/ocultar seção ou tudo, prévia como jogador. Bestiário mantém quatro níveis como atalhos (nome; descrição; imagem; completo), com revelação granular adicional, inclusive vulnerabilidades. Vínculo oculto não aparece em nenhuma direção mesmo se ambas entidades conhecidas. Vínculo revelado não revela automaticamente destino nem item mágico.
- Notificar novas informações sem multiplicar notificações de uma única operação; não vazar títulos secretos. Pesquisa, listas, detalhes, vínculos, notificações, títulos de abas e imagens devem usar projeção autorizada no servidor. RLS/RPC/Storage devem impedir acesso direto aos segredos; ocultação CSS não é segurança. Não expor identificadores de catálogo que permitam inferir informação oculta. Dados públicos SRD não equivalem a conhecimento de uma criatura da campanha.
- Conhecimento coletivo agora; preparar evolução futura sem implementar permissões individuais nesta etapa. Manter conhecimento de itens separado de posse e transferência.

## Validação
Testar mestre/jogador com nome oculto e alcunha visível, imagem privada, vínculo oculto em ambas direções, pesquisa por segredo sem resultados, item associado sem concessão, notificações sem vazamento, navegação em um/dois grupos e mobile, e preservação de dados existentes. Validar Auth/REST/JWT/RLS/Storage reais em ambiente isolado antes de produção. Migração de produção exige autorização e verificação de integridade. Não alterar Compêndio 1.0.

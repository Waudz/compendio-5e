# Imagens do Compêndio 1.0 no 2.0

**Requisito obrigatório do projeto:** as imagens de monstros e itens que o responsável cadastrou no Compêndio 1.0 têm de chegar ao 2.0. São horas de trabalho que não podem ser perdidas. Não substituir por imagens genéricas, não apagar nem alterar nada no 1.0.

## Onde estão
| Origem | Conteúdo | Situação no 2.0 |
|---|---|---|
| Catálogo global do 1.0: bucket público `catalogos` do Supabase do 1.0, associação por `tipo` + `chave` (`catalogo_publicado.dados.globais`, lida pela função pública `catalogo_imagens_publicas()`) | 77 itens e 52 monstros em 25/11/2026 | **Associadas e exibidas** (todas com correspondência) |
| Fotos publicadas no repositório do 1.0 (`fotos/`) | 4 monstros | 3 já têm imagem no catálogo global. A remoção de `adult-gold-dragon` foi respeitada |
| Imagens que o administrador **removeu** no 1.0 | 2 registros | Respeitada a remoção; listadas em `removidasNo1` |
| Acervo pessoal guardado **no aparelho** (IndexedDB `img` e biblioteca local de imagens de itens, `inventario-imagens.js`) | Desconhecido: só existe no navegador de quem cadastrou | **Pendente de importação** |
| Fotos embutidas em fichas de monstro e itens personalizados do 1.0 (`data:` na conta ou no aparelho) | Desconhecido (dados privados) | **Pendente de importação** (essas criações ainda não existem no 2.0) |

## Como o 2.0 usa
- `src/catalogue/data/imagens-v1.json` guarda a **associação** (id do 2.0 → chave do 1.0 e caminho do arquivo original). É também a cópia de segurança dessas associações no repositório.
- Os **arquivos continuam no 1.0**: nada foi baixado, copiado, movido ou apagado. As telas apontam para o endereço público do arquivo original.
- Onde aparecem: inventário (lista e grade), página do item, ficha do monstro no Compêndio, busca de monstros, iniciativa, faixa de turnos e encontros. Sem imagem, ou se ela não carregar, fica o ícone padrão.
- Regerar: salve a resposta da função pública do 1.0 num arquivo e rode `node scripts/catalogo/mapear-imagens-v1.mjs <arquivo> AAAA-MM-DD`. Chaves sem correspondência saem em `semCorrespondencia` e no terminal.
- Imagem trocada no 1.0 depois da consulta só aparece no 2.0 após regerar o mapa (o 1.0 não apaga arquivos do bucket, então o endereço antigo continua válido).

## O que falta
1. **Cópia própria dos arquivos.** Hoje o 2.0 depende do armazenamento do 1.0: desligar o projeto do 1.0 faria as imagens sumirem. Antes disso, copiar os arquivos para o armazenamento do 2.0 (exige autorização: baixa arquivos e grava em produção) e trocar `base` no mapa.
2. **Acervo do aparelho e criações personalizadas:** exportar pelo backup do 1.0 no aparelho em que foram cadastradas e importar quando o 2.0 tiver imagens por campanha.
3. Galeria colaborativa global (decisões das seções 13 a 18 da especificação): não implementada nesta etapa.

## Revalidação de 26/11/2026

`node scripts/catalogo/auditar-imagens-v1.mjs --http`: 77 itens e 52 monstros, 129 IDs canônicos encontrados, nenhuma URL inválida, **129 respostas HTTP 200**. Nenhuma associação substituída ou removida; nenhuma nova imagem genérica foi introduzida. Lista/grade e detalhes agora usam o mesmo retrato e fallback do inventário/combate.

Consulta somente leitura ao checkout legado: 12 arquivos de imagem no repositório, incluindo os quatro retratos SRD já auditados em `fotos/`; os outros oito são ícones das escolas de magia, não retratos pendentes de criaturas/itens. O dragão de ouro removido do catálogo continua excluído do mapa; a existência do arquivo não autoriza desfazer a remoção. Nenhum arquivo do 1.0 foi alterado. IndexedDB e bibliotecas pessoais do navegador não são arquivos desse checkout e **não foram recuperados**; exigem exportação pelo aparelho que os guarda. Não foi acessado banco privado legado. Permanecem as dependências de hospedagem e de exportação descritas acima.

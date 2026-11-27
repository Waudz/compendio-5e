# Anotações dos jogadores — ponto de partida

**Próxima tarefa aprovada.** Ainda não iniciada. Fontes normativas: [ESPECIFICACAO-EXPERIENCIA-JOGADOR, seção 5](ESPECIFICACAO-EXPERIENCIA-JOGADOR.md) e DEC-035 em [DECISOES-E-ARQUITETURA](../DECISOES-E-ARQUITETURA.md). Em caso de conflito, vale a decisão mais recente do responsável.

## O que está aprovado
- Documento inicial **"Minhas anotações"** criado automaticamente, sem duplicar e sem misturar campanhas.
- A entrada é uma **lista de documentos**, o editado mais recentemente no topo; não abrir sozinho o último.
- Quantos documentos o jogador quiser; cada um é um texto em **tela cheia**, no editor BlockNote.
- Lista com título, prévia curta, data de edição, busca, novo documento e menu de ações (as ações ainda não foram definidas).
- Editor: voltar à lista, título, texto e **salvamento automático**.
- **Privadas** por usuário e campanha; nenhum compartilhamento novo.
- Trocar para Ficha ou Compêndio e voltar mantém o mesmo documento e a posição.
- **Sem** quadros, pastas, coleções, tags ou grade.
- **Preservar os registros existentes.** **Não alterar as Anotações do mestre.**

## Em aberto (perguntar antes de decidir)
- Ferramentas do editor (texto, formatação, imagem, links, listas e desfazer apareceram só em protótipo).
- Ações do menu de cada documento.
- Como o jogador enxerga os quadros e cartões que já criou na tela atual (manter acesso, converter em documentos ou outra forma). Nada pode ser apagado.

## Como está hoje
- Jogador e mestre usam a mesma tela: `PlanningPanel` (`src/Planning.tsx`, seção `planejamento`; rota em `src/Panel.tsx`, atalho em `src/Mobile.tsx` e `src/workspace.ts`). Ela grava registros `board` e `scene` em `notes`, sempre privados (migração 0006), e cria sozinha os planejamentos iniciais.
- O editor BlockNote já é usado no Diário e no Planejamento: `src/EditorLazy.tsx` / `src/PageEditor.tsx`.
- Acesso a dados: `src/registros.ts` (`RegistrosApi`); conteúdo estruturado e versão otimista da 0005. Regras de visibilidade em [NOTAS-PERMISSOES](NOTAS-PERMISSOES.md) (o mestre não lê nota privada de jogador).
- `notes` já aceita o tipo `note`/`page`, privado: **é provável que não precise de migração**; confirmar antes (restrições de `kind`, limites e a criação idempotente do documento inicial).

## Primeiros passos sugeridos
1. Ler as duas fontes normativas e conferir no banco isolado o que um jogador pode gravar como `note`/`page`.
2. Propor ao responsável o destino dos quadros existentes do jogador (única decisão que bloqueia).
3. Implementar a lista e o editor do jogador numa branch nova a partir da `main` (depois do #170), sem mudar o `PlanningPanel` do mestre.
4. Testes: separação por campanha e usuário, criação idempotente, salvamento automático com conflito, volta ao mesmo documento, celular (320 e 390 px) e acessibilidade.

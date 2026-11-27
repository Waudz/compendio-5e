# Próxima prioridade Alpha: exclusão e identidades ocultas

Solicitação do responsável em 27/11/2026, após a correção do diagnóstico de acesso. Não é implementação concluída. Nenhuma leitura/escrita em produção nesta investigação.

## Evidência local

- `private.notes_ficha_guard`, migrações 0008/0013, rejeita soft-delete com `personagem_guiado_nao_exclui`. `FichasApi` não oferece exclusão. Não basta mostrar a ação ou reutilizar a remoção genérica de notas.
- Desde 0013, o guard recalcula o cartão público e fixa `visibility=campaign` ao salvar uma ficha. A alteração preserva as escolhas de campos da identidade. Não há backfill geral nessa função.
- A lista usa `notes.visibility`, ou a ausência de nota legível para uma ficha autorizada, para indicar ocultação. `codex_node_open` (0017) distingue personagens sem `campaign_codex` das regras de descoberta; verificar classificações indevidas antes de alterar qualquer registro.
- Não há evidência suficiente para afirmar quais registros de produção estão afetados nem se a ocultação global antiga foi intencional. A consulta agregada de proprietários da sessão anterior não responde essa pergunta e não deve ser repetida.

## Fatia de exclusão a implementar antes de foto/notas/PWA

1. Confirmar contrato de soft-delete/arquivo com IDs preservados. Dono participante e mestre responsável da campanha podem excluir; outro jogador, outra campanha e não participante não podem. Validar isso na função e nas políticas.
2. Preparar migração aditiva, preflight e rollback, com exclusão transacional/versionada e proteção contra repetição. Preservar histórico e dados dos demais personagens. Não usar exclusão física indiscriminada nem apagar arquivos compartilhados.
3. Inventário pertence à ficha excluída; preservar no arquivo privado para recuperação operacional. Vínculos deixam de aparecer nas projeções dos dois sentidos; referências narrativas mantêm um destino removido identificável, sem expor informação privada. Criaturas no histórico de combate conservam nome/PV/condições históricos e deixam de executar operações sobre a ficha excluída. Inspecionar todos os contratos antes de codificar essa transição.
4. Menu vermelho separado na ficha e no contexto da lista, confirmação com nome e consequências, atualização das listas e fechamento das abas relevantes em todos os grupos. No celular, retornar à lista sem estado inválido. Falha de rede/conflito não deve fechar nem simular exclusão.
5. Testar matriz mestre/dono/outro participante/outra campanha, inventário, vínculos, texto narrativo, combate ativo/histórico, repetição, recarga e outra sessão em stack isolada. Só pedir autorização de produção após scripts e resultados concretos.

## Fatia de visibilidade

Investigar criação e atualização com duas contas isoladas. Identidade de aventureiros visível por padrão à campanha; ficha completa privada. Preservar integralmente a seleção de campos públicos. Aventureiros não herdam descoberta/ocultação de NPC/monstro.

Preparar preflight de contagem de fichas com nota privada, notas ausentes/removidas e classificação indevida em campaign_codex, sem conteúdos pessoais. Não corrigir registros cuja intenção não possa ser determinada por um critério seguro. Validar reparo seletivo e idempotente antes de solicitar aplicação em produção. Não ocultar apenas o aviso visual para disfarçar um registro que continua inacessível aos demais.


Preflight agregado preparado em `supabase/preflight/personagens_exclusao_visibilidade.sql`, ainda não executado em produção. Confere notas ocultas/removidas, formato de identidade, classificação no Codex, campos legitimamente ocultos e referências de combate/encontro sem imprimir conteúdos. Não substitui o teste da migração nem autoriza reparo indiscriminado.

Direção técnica em análise: manter o ID canônico da nota como tombstone e arquivar a ficha/inventário com acesso bloqueado nas APIs normais; invalidar edições e sincronização após exclusão; preservar snapshots de combate e desativar seus vínculos vivos à ficha. Rollback não poderá tornar arquivos excluídos legíveis inadvertidamente. Nenhuma migração de exclusão ou reparo foi gerada nesta fatia de preparação.


Validação do preflight: 23 testes SQL/PGlite de Compêndio aprovados, incluindo a execução somente leitura e igualdade das notas antes/depois. Não é consulta de produção. A primeira tentativa usou a fixture histórica até 0013 e falhou por ausência de campaign_codex; o teste foi movido para a fixture completa, sem modificar o esquema antigo.

Dependências confirmadas: `private_ficha.itens_vistos` (0019) e status de combate da ficha (0011) referenciam character_sheets com ON DELETE CASCADE. Uma exclusão física apagaria histórico; **não usar DELETE físico da ficha como atalho para contornar notes_ficha_guard**. A futura migração precisa arquivar/desativar preservando esses fatos e fechar leituras/mutações de fichas arquivadas, inclusive RPCs SECURITY DEFINER, não apenas RLS/UI. Nenhum script de reparo de dados foi aplicado ou gerado por suposição.

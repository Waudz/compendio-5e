# Especificação aprovada — Encontros, Iniciativa e Loot
25/11/2026 — Compêndio 5e 2.0 Alpha. Registro de continuidade independente do chat. Não representa implementação concluída. Aguardar integração e publicação do PR #146 antes de iniciar código funcional. Não tocar em alterações locais de outros agentes nem em produção durante testes.

## Decisões de produto
- Iniciativa e encontros são exclusivos do mestre. Bestiário é modelo original imutável por alterações de combate.
- Encontro é registro persistente de criaturas de um local, não mero multiplicador de modelos. Adicionar N criaturas continua possível, mas cria N instâncias com identificadores independentes, nomes automáticos (Goblin 1, Goblin 2...), atributos e loot próprios. Personalização opcional; herdar padrões do bestiário sem preenchimento obrigatório.
- Encontro e iniciativa devem compartilhar identidade e estado persistente do combatente vinculado. Dano, cura, CA, PV máximos, nome, loot adicionado/coletado, morte, fuga e condições vigentes refletem no encontro. Ordem de iniciativa e rodadas são exclusivas do combate. Combatentes avulsos também podem ser editados e ter loot, sem obrigar a criar encontro. Não sobrescrever bestiário.
- Reutilizar cartão individual, versão lista compacta, indicadores de PV/estado, menu de ações e modais nas duas telas. Encontros não têm controles de turno. Preservar recursos existentes de envio parcial, reinserção, locais e salas.
- Personagens de jogadores: PV atuais sincronizados com ficha; CA temporária pode ser específica do combate. Não tratar inventário do jogador como loot automaticamente; escopo de saque de personagens não aprovado.

## Layout de loot — referência visual aprovada, não redesenhar
O usuário aprovou expressamente a demonstração interativa com itens entregues riscados, destinatário e barra de progresso. PC: modal centralizado sobre interface escurecida. Celular: bottom sheet, mesma organização, conteúdo rolável internamente quando necessário. Não expandir cartões nem adicionar linhas permanentes. Usar tokens de tema e componentes existentes; cores abaixo são referências do protótipo escuro, não impor tema fixo.
No cartão: mochila discreta ao lado das reticências. Cinza em combate, dourada quando derrotado com loot pendente (inclusive parcialmente coletado), verde quando totalmente recolhido. Sem loot cadastrado: ocultar mochila e oferecer adicionar pelo menu. Após conclusão, mochila permanece acessível para consultar histórico.
Modal: fundo escuro #151d27, cantos arredondados, espaçamento confortável. Cabeçalho com mochila dourada #e2ba71 (verde #7ac99a após conclusão), título forte "Loot — Goblin 1", subtítulo discreto "Derrotado · 4 recompensas disponíveis". Logo abaixo, barra fina de progresso (trilho #303b48, preenchimento verde #65aa80), separador.
Cada linha: checkbox à esquerda, ícone do item em quadrado arredondado de ~38 px (#293746), nome em destaque, quantidade em texto secundário abaixo. Quando entregue: checkbox desabilitado e desmarcado, nome riscado em cor secundária, texto verde "Entregue para Lydia", check-circle verde à direita. Manter linhas e ordem, não esconder entregues.
Após separador: link "Selecionar disponíveis" à esquerda, contador "0 selecionados" à direita. Rótulo "Entregar para", seletor de personagem, botão primário de largura total "Entregar itens (N)", desabilitado sem seleção válida. Ao entregar, limpar seleção, manter modal aberto e atualizar barra, contadores e linhas. Ao concluir tudo, substituir controles de entrega por check-circle e mensagem verde "Todo o loot foi recolhido". Remover botão de reiniciar demonstração (era apenas do protótipo). Fechar modal por X/Escape conforme padrões acessíveis; não fechar após entrega. Adição/edição de loot acessível sem poluir layout aprovado; posição exata dessa ação ainda não aprovada na versão final.
Exemplo visual textual (estado intermediário):
```
[mochila dourada] Loot — Goblin 1
                  Derrotado · 1 recompensa disponível
[███████████████-----] 75%
────────────────────────────────────
[ ] [espada] Cimitarra (riscado)    ✓
             Entregue para Lydia
[ ] [escudo] Escudo (riscado)       ✓
             Entregue para Lydia
[ ] [arco]   Arco curto (riscado)   ✓
             Entregue para Lydia
[ ] [moedas] Peças de ouro
             8 PO
────────────────────────────────────
Selecionar disponíveis     0 selecionados
Entregar para
[ Lydia                            ▾ ]
[         Entregar itens (0)         ]
```
Estado final: moedas riscadas, "Entregue para Caleb", barra cheia, mochila verde, zero recompensas disponíveis, mensagem de conclusão. Sem botão de reinício. Os ícones de espada, escudo, arco e moedas são referências ilustrativas; os itens reais vêm do loot.

## Distribuição e persistência
- Exemplo de aceitação obrigatório: Goblin 1 tem Cimitarra 1, Escudo 1, Arco curto 1, 8 PO. Selecionar três equipamentos, entregar a Lydia. Moedas permanecem disponíveis. Selecionar moedas, escolher Caleb, entregar. Equipamentos nunca podem ser selecionados novamente; histórico mostra os destinatários corretos. Encontro vinculado reflete as duas entregas; Goblin 2 não é afetado.
- Permitir entrega parcial de quantidades, inclusive dividir moedas. Para linha parcialmente entregue, representar saldo disponível e histórico por destinatário/quantidade; layout exato do controle de quantidade ainda precisa ser definido sem alterar a estrutura aprovada. Progresso do exemplo é por linhas totalmente recolhidas; semântica para quantidades parciais a definir.
- Entrega e baixa do saldo devem ser atômicas no banco, com validação de campanha, mestre, destinatário, quantidade e saldo; concorrência, repetição de requisição, duplo clique e falha de rede não podem duplicar ou perder itens. Histórico persistente de item, quantidade, destinatário e momento. F5, outro dispositivo e reabertura não restauram saldo.
- Itens vão ao inventário da ficha; moedas ao saldo apropriado. Respeitar regras existentes de identificação e revelação de mágicos. Origem: equipamento cadastrado no bestiário quando disponível, configuração do encontro ou inclusão manual. Não inventar loot automaticamente quando não houver dados.
- Consultar/editar loot durante combate; destaque de coleta após derrota. Possibilidade de distribuir loot restante ao finalizar combate foi sugerida, sem layout final aprovado; não descartar silenciosamente recompensas pendentes. Definir regras de coleta antes da derrota e fluxo de finalização antes de implementar.

## Edição individual
Menu de reticências com "Editar combatente", "Gerenciar loot", "Consultar criatura", "Remover combatente" conforme aplicabilidade. Modal compacto com Nome, CA, bônus de iniciativa, PV atuais e máximos em duas colunas quando couber. Demais personalizações opcionais: atributos, habilidades, equipamentos, resistências/imunidades, imagem e anotações; herdar bestiário. Não inserir campos permanentemente nos cartões. Validar valores e preservar identidade. Para encontro vinculado, aviso deve dizer que alterações refletem no encontro (substitui texto antigo do protótipo que dizia somente combate atual). Diferenciar bônus de iniciativa de ordem/resultado do turno.

## Duplicar e restaurar — aprovados
Duplicar cria encontro independente com novos IDs, sem alterar original. Opção padrão: duplicar configuração inicial, PV cheios, atributos personalizados e loot novamente disponível como novas recompensas. Alternativa: duplicar estado atual, mantendo PV, estados e loot já recolhido indisponível; não executar transferências nem duplicar histórico como novas entregas.
Restaurar: modal com ícone rotate-ccw, título "Restaurar encontro", nome do encontro e contagem, separador, texto "Selecione o que deseja restaurar:". Checkboxes: Pontos de vida (marcado), Estados e condições (marcado), Atributos da configuração inicial (desmarcado), Loot da configuração inicial (desmarcado). Botão "Restaurar selecionados" desabilitado se nada selecionado. Se loot marcado, aviso destacado: "Restaurar o loot disponibilizará novas recompensas. Os itens anteriormente entregues permanecerão nos inventários dos personagens." Exigir confirmação explícita para gerar novo saldo; preservar histórico anterior, distinguir nova geração de recompensas e impedir duplicação acidental. Sem reset automático de loot. Preservar personalizações não selecionadas. Definir comportamento de restauração durante combate ativo antes de implementar.

## Ordem e critérios de entrega
1. Auditar estrutura atual (há testes de identidade individual existentes; não presumir que tudo precisa ser refeito), persistência, inventário, RLS, migrações e documentação de decisões.
2. Individualizar encontros e migrar dados antigos sem perda, duplicação ou alteração de recompensas já entregues; preservar IDs existentes quando possível.
3. Unificar cartões/lista e edição individual.
4. Sincronizar estado entre encontros e iniciativa sem cópias divergentes.
5. Implementar modal de loot conforme referência, integração transacional e histórico.
6. Duplicação e restauração seletiva.
7. Testes unitários, E2E desktop/tela dividida/mobile, teclado e acessibilidade, persistência F5 e entre dispositivos, isolamento de campanhas, RLS/JWT real em ambiente isolado, concorrência, falhas e migração de legado. Testar cenário Lydia/Caleb, loot independente de goblins iguais, reentrada em combate, bestiário intacto e restauração sem duplicação involuntária.
Usar PRs pequenos, documentação de continuidade e CI por impacto. Não alterar produção para testar. Não considerar design aprovado como evidência de implementação. As capturas originais aprovadas estão no chat de 25/11/2026; esta especificação textual reproduz o layout, mas não inclui os arquivos binários das capturas.

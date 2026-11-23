# Alpha 2.0 — contrato de acesso e persistência de combate

**Estado:** especificação para implementação; não há autorização para deploy ou migração.  
**Referências:** DECISOES-E-ARQUITETURA.md (decisões vigentes de 22/11/2026), PR #103.

## Regra funcional

Somente o mestre da campanha acessa a iniciativa e o combate, inclusive participantes, ordem, PV, condições, notas e encontros privados. Jogadores não recebem o estado de combate, mesmo que conheçam a URL ou chamem a API diretamente. Não há iniciativa compartilhada com jogadores.

## Contrato de persistência

- Cada combate tem identificador estável, `campaign_id`, mestre responsável, versão monotônica e timestamps.
- A API confirma gravação antes de a interface sinalizar sucesso; falha mantém edição pendente e oferece nova tentativa.
- Alterações de PV em ficha e combate devem ter fonte de verdade única e controle de concorrência; não duplicar silenciosamente.
- `localStorage` é rascunho experimental, nunca fonte canônica de uma versão multi-dispositivo.
- Troca de conta ou campanha não deve exibir dados em cache de outra identidade.
- Exclusão de personagem não apaga histórico de encontros ou combates; preferir referências históricas/snapshots autorizados.
- Migração de dados locais exige importação explícita e reversível, sem substituir registros remotos.

## Matriz de autorização mínima

| Ator | Ler combate | Criar/alterar | Ler dados de outra campanha |
|---|---|---|---|
| Mestre da campanha | Sim | Sim | Não |
| Jogador da campanha | Não | Não | Não |
| Mestre de outra campanha | Não | Não | Não |
| Usuário autenticado sem vínculo | Não | Não | Não |
| Anônimo | Não | Não | Não |

As políticas devem ser verificadas no banco (RLS e funções), não somente no React. Revogação de participação deve impedir leituras subsequentes. O criador da campanha é o mestre segundo as regras atuais; não criar papel alternativo sem decisão explícita.

## Cenários de aceitação

1. Mestre cria combate, adiciona personagens e monstros, muda iniciativa, PV e condições; recarrega e recupera exatamente o estado confirmado.
2. Mestre abre outra sessão/dispositivo; observa o estado persistido e não perde alterações concorrentes.
3. Jogador autenticado tenta abrir rota e consultar API: recebe acesso negado, sem payload privado.
4. Mestre de campanha B tenta ler ou modificar combate A: negado.
5. Troca rápida de campanha e logout não deixam dados privados visíveis.
6. Erro de rede, quota, conflito de versão ou gravação rejeitada não produz falso indicador de salvamento.
7. Remover/reordenar combatente preserva turno atual de modo determinístico; números inválidos, negativos, frações e não finitos são rejeitados conforme regras do domínio.
8. Integração com ficha não cria duas versões independentes de PV; efeitos são consistentes em todas as telas autorizadas.
9. Verificar desktop e celular com E2E, inclusive retorno de aba e reload.

## Marcos de maturidade

- **Alpha fechada (atual):** implementar e integrar recursos essenciais, autenticação, campanhas, fichas, catálogos e combate exclusivo do mestre; validar permissões e integridade dos dados.
- **Critério para Beta fechada:** fluxos essenciais completos, persistência confiável entre dispositivos, testes de autorização/RLS, CI e E2E passando, sem falhas conhecidas de perda de dados ou acesso indevido.
- **Beta fechada (futura):** testes de uso real com grupo limitado, ajustes de experiência e correções de estabilidade.
- **Lançamento público (futuro):** somente após aprovação explícita e critérios de segurança, suporte e operação atendidos.

## Integração

- Revisar o PR #103 contra os PRs #97 e #102 antes de resolver conflitos.
- Conferir código, schema, RLS e testes existentes antes de propor SQL. Não criar tabelas paralelas sem necessidade.
- Rodar `npm ci`, `npm run build`, `npm test`, testes RLS com múltiplos usuários e E2E real; registrar SHA e resultado.
- Sem merge, deploy, alteração no Auth ou aplicação de migrations sem autorização expressa.

**Limite desta entrega:** documentação de contrato e critérios de aceite; nenhum comportamento de produção foi alterado ou validado.

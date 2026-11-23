# Alpha — recuperação da lista de campanhas (22/11/2026)

Branch `fix/alpha-carregamento-campanhas`, base main `ebab8d4`, independente do #110 e das branches de combate/criador.

## Problema reproduzido

`CampaignsProvider.refresh` esperava sempre uma resposta Res. Quando a API rejeitava a promessa (erro inesperado de rede ou adaptador), havia rejeição não tratada e loading permanecia true. No primeiro carregamento isso impedia usar Tentar novamente; no refresh deixava a interface presa apesar de já haver campanhas conhecidas. Dois testes falharam antes da correção.

## Implementação e aceitação

A exceção é convertida em erro público genérico, sem detalhes internos. Loading encerra; lista e campanha conhecidas são preservadas. A preferência salva não é apagada por erro. Nova tentativa pode recuperar a última campanha válida.

Quatro testes de contexto cobrem: exceção inicial com recuperação; exceção no refresh preservando contexto; respostas fora de ordem (somente a requisição atual prevalece); vínculo revogado com resposta válida e fallback determinístico, recusando seleção de ID não autorizado. Reutiliza o mecanismo existente de tickets e isolamento por API/conta, sem criar outra fonte de verdade.

69 testes focados aprovados (contexto, interface de campanhas, início e navegação). Build e suíte completa registrados no PR. Testes usam contas simuladas; não houve alteração de preferências remotas, produção ou políticas RLS.

## Limites

Manter contexto conhecido durante erro não concede autorização: acesso aos dados continua sujeito à participação atual no servidor. Preferência entre dispositivos ainda exige contrato remoto/migração e testes próprios. Requisição que nunca resolve ainda depende do timeout do transporte; esta correção cobre rejeições e respostas de erro, não promete offline completo.

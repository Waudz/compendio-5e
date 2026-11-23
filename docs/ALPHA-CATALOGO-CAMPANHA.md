# Alpha — campanha obrigatória no Compêndio (22/11/2026)

Branch `fix/alpha-catalogo-campanha`, base main `ebab8d4`. Aplica DEC-20261122-A sem criar biblioteca pessoal, seletor global ou outra fonte de catálogo.

Seção do Compêndio e aba de item exigem uma campanha presente na lista validada de vínculos. Sem campanha, orientam a criar/entrar/escolher por botão que abre a gestão já existente. Enquanto a lista carrega mostram carregamento; erro de consulta oferece nova tentativa e não é apresentado como ausência de campanhas.

Aba de item restaurada sem vínculo não consulta a definição do item. Ao perder a campanha ativa, o catálogo é desmontado imediatamente. Uma campanha conhecida pode continuar disponível durante refresh de rede, conforme o contexto existente. Não altera nem apaga preferências, layouts, personagens ou catálogo.

## Evidências

Os cinco novos testes falharam antes da correção. Depois passaram, junto dos nove testes reais de integração do catálogo: 14 testes focados aprovados. Build e tipos E2E/suíte completa acompanham o PR. Casos de tela usam contexto simulado; os testes existentes usam navegação e campanha em memória. Não substituem validação com contas reais.

Este é um requisito de navegação/produto. Dados SRD continuam empacotados na aplicação; não se está tratando o SRD público como segredo nem usando ocultação de UI para proteger dados privados. A autorização de fichas/notas/combate permanece responsabilidade do servidor/RLS.

## Critérios de conclusão da Alpha nesta retomada

| Critério | Evidência e pendência |
|---|---|
| Autenticação e campanhas | #110 prepara cliente fechado e corrige corrida de sessão; #111 trata falhas de carregamento. Servidor de signup e contas reais ainda precisam verificação/autorização. |
| Criador/fichas/inventário | Persistência 0008 consta no histórico remoto; #97 ainda tem falhas de CI a corrigir. Não declarar fluxo completo validado. |
| Catálogo canônico | Itens, magias e monstros estão no código; esta branch aplica exigência de campanha. Auditorias de conteúdo e integração da progressão continuam sujeitas aos critérios registrados. |
| Iniciativa/encontros/combate | #103 → #106 → #107 e complementos #108/#109 não integrados. #107–#109 tiveram CI verde. Persistência remota/REST/JWT e importação preservadora ainda pendentes. |
| Anotações/Enciclopédia | Notas têm políticas remotas; fundação da Enciclopédia permanece sem políticas de acesso. UI/compartilhamento/histórico exigem validação completa antes de liberação. |
| Interface e fluxos | Playwright do #107–#109 verde; este PR requer CI próprio. Celular real ainda não certificado. |
| Preservação e operação | Nenhum merge na main, deploy, SQL de escrita, alteração do Assimilação ou exclusão de dados nesta retomada. |

**Alpha não concluída.** PRs e testes isolados não equivalem a funcionalidades publicadas. Histórico de percentuais em documentos anteriores não mede conclusão desta retomada.

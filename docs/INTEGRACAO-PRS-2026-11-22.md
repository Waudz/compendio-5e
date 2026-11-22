# Integração dos PRs pendentes — 22/11/2026

## #94 / #93 / #87
#94 validado no CI (36 básicos, 96 criador, 80 qualidade; 32 condicionais herdados) e integrado em 8429ce7. Regra restrita ao criador, sem mudar login.
#93 original teve 48 falhas mobile: o cabeçalho interceptava cliques. O grid herdava position:absolute nas barras e padding no scroll container da main. Corrigidos position:static e padding:0 somente no grid mobile; overflow-anchor:none evita compensação de rolagem durante a expansão. Teste real mede retângulos, clica em Criar personagem e verifica ocultar/mostrar sem temporização fixa; desktop verifica largura inteira do painel. #87 é substituído: atalhos de campanha já existem na main (incluindo Anotações), sem necessidade de portar sua implementação antiga.

## Limites
Nenhuma alteração no Assimilação ou em dados de produção. Enciclopédia: rascunhos SQL só em Postgres descartável após revisão; não aplicados ao remoto. Resultados finais e SHAs serão registrados nos PRs e no relatório final.

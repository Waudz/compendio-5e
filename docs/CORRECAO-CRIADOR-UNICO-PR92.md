# Correção do criador único — PR #92

## Diagnóstico e solução
Testes antigos esperavam ativação manual, perícias com IDs visíveis, equipamento do protótipo e Nome→Método. Foram atualizados para os controles SRD 2014 reais (Nome→Classe), alternativas/categorias e nomes acessíveis sem desativar axe ou reduzir fluxos. Criação de Guerreiro/Maga, inventário e salvar/reabrir continuam testados.

Regressões reais: o PR bloqueava fichas antigas; a recuperação validava rascunhos modernos com o catálogo antigo; o cálculo inicial podia ficar memorizado antes do carregamento das regras. Novos personagens nascem v2, aguardam regras e calculam PV pelo motor. Fichas existentes usam seu catálogo original e continuam editáveis; não são regravadas ao abrir, nem convertidas em lote. Recuperação escolhe o validador correto e mantém o método dos atributos.

Rascunhos incompletos com nome podem navegar, salvar e reabrir; avisos de escolhas/equipamentos pendentes permanecem. Não há mudança de RLS, RPCs, dados de usuários ou Assimilação. Foram preservados inventários, moedas, campanhas e revisões.

## Evidências
19 testes de persistência e 12 de interface aprovados localmente, incluindo legado sem conversão e conflitos/offline; quatro E2E direcionados (Guerreiro, equipamentos, Maga com salvar/reabrir e Bárbaro 20) aprovados no Chromium local. Build/tipos executados; resultado completo do CI registrado no PR antes do merge. E2E locais usam build isolado com NODE_ENV=development, modo e2e, chaves vazias e preview por limitação do otimizador Vite no sandbox Windows; CI mantém Vite normal no Linux.

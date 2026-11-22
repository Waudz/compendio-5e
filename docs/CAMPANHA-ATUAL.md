# Campanha atual — 22/11/2026

Primeiro incremento de DEC-20261122-A: `CampaignsContext` filtra snapshots pela API da sessão e invalida requisições anteriores; escolhe a preferência local válida ou fallback determinístico por ID após listagem bem-sucedida. Não limpa preferência em falha de rede. `setActive(null)` não desativa campanhas. Criação/entrada continuam usando ID explícito.

Pendente: testes de regressão de troca de conta, respostas fora de ordem, remoção, criação, entrada, erro de rede e preferência local; conferir consumidores de setActive(null). CI do PR ainda não confirmado. Persistência remota, onboarding neutro e cadastro fechado são incrementos separados. Nenhuma migração aplicada nem alteração ao catálogo/criador.

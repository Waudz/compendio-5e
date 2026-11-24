# Estado da Alpha após integração do combate — 23/11/2026

> **Atualizado:** este quadro é anterior à branch `alpha/estabilizacao-20261123`. O estado vigente (combate remoto implementado e testado em ambiente isolado, status na ficha, migrações 0009–0011, achados sobre cadastro e banco hospedado) está em [ALPHA-CHECKLIST-20261123.md](ALPHA-CHECKLIST-20261123.md).

> Fonte de verdade: código na `main`, resultados do GitHub Actions e estado efetivo do banco. Este documento complementa o histórico em `STATUS-FUNCIONALIDADES-V2.md`, cujas porcentagens de 20/11 não representam a versão atual.

## Evidências integradas

- PRs #97 e #102: criador/ficha/inventário e testes de persistência; PRs #114 e #115: autenticação e recuperação de campanhas; PR #116: catálogo restrito por campanha.
- PR #122, merge `2fd21745b83356a7cea6739e71577bc454882153`: iniciativa e encontros locais exclusivos do mestre, lógica de turnos/PV, testes de UI, domínio e navegação.
- No último commit do #122 (`48774da`), workflows `Validar projeto`, `E2E e responsividade` e `Alpha Supabase isolado` concluíram com sucesso.
- Testes isolados exercitam RLS/JWT com dados sintéticos; **não** validam a configuração hospedada de produção.

## O que funciona na árvore integrada

| Área | Estado confirmado | Limite |
|---|---|---|
| Login, campanhas e recuperação | Fluxos integrados com testes | Teste final hospedado/convites ainda necessário |
| Criador, ficha e inventário | Fluxos iniciais integrados | Não equivalem à progressão completa 1–20 |
| Catálogo de itens/magias/monstros | Consulta integrada e gate por campanha | Auditoria editorial/licenças e regras avançadas pendentes |
| Iniciativa e encontros | UI local com escopo por usuário/campanha, mestre apenas | Dados ficam no navegador; outro dispositivo não recebe combate |
| Persistência remota de combate | Adaptador `src/combateRemoto.ts` e testes | **Não conectado à UI; tabela `campaign_combats` não implantada** |
| SQL de combate | `docs/sql/alpha-campaign-combats-DRAFT.sql` testado em stack descartável | **Rascunho, não migração de produção** |
| Segurança | Testes de RLS em Supabase isolado aprovados | Verificar configuração real, Data API e controles de Auth |
| Notas/diário | Interface existente | Revisar persistência, privacidade e fluxo de compartilhamento |

## Próxima fatia vertical: combate remoto sem perda de dados

1. Criar migração formal via CLI em ambiente descartável/de desenvolvimento e repetir testes JWT/RLS, inclusive acesso direto à API por jogador e usuário de outra campanha.
2. Implementar acesso remoto **atrás de configuração explicitamente habilitada**, sem substituir `localStorage` silenciosamente. O usuário deve saber se está no modo local ou remoto.
3. Garantir que um estado remoto existente nunca seja sobrescrito por um estado local. Na primeira sincronização, oferecer escolha explícita ao mestre e cópia de segurança; não apagar o local antes de verificar leitura de volta.
4. Tratar versão obsoleta/conflito, offline, troca de campanha/conta, duas abas, dois aparelhos e sessão expirada.
5. Só depois de revisão e autorização específica, aplicar migração no projeto hospedado; não habilitar gravação remota antes da RLS validada no ambiente de destino.

**Decisão pendente do usuário:** importar rascunhos locais por confirmação, mantê-los separados, ou iniciar combates remotos novos. Até a decisão, preservar integralmente dados locais e não automatizar migração.

## Critério para Beta fechada

Nenhum bloqueador acima pode ser considerado concluído por aprovação de CI isolado. Antes do convite de testadores: fluxos mestre/jogador e recuperação de conta em ambiente hospedado, persistência real sem perda de dados, testes de autorização e revisão de segurança, documentação de operação e plano de rollback. Não confundir merge na `main` com publicação do site.

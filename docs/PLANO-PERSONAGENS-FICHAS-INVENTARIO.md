# Personagens, Fichas e Inventário — retomada do planejamento (25/11/2026)

Documento de planejamento: **nada aqui está aprovado nem implementado** além do indicado como "existe". Fontes: `CRIADOR-FICHA-INVENTARIO.md`, `CONTINUIDADE-DESENVOLVIMENTO.md` (decisões de 20/11) e `ALPHA-CHECKLIST-20261123.md`. Conferir o código antes de implementar.

## O que existe

- Criador guiado SRD 2014, ficha e inventário; fichas persistidas em `character_sheets` com revisão otimista (migrações 0008–0011 já aplicadas ao Supabase 2.0).
- PV e condições do combate refletidos na ficha; PV final gravado ao finalizar o combate.
- Loot dos encontros com `itemId` canônico, moedas cp/sp/gp e ids estáveis por linha (DEC-022). "Distribuído" é só registro: nada entra em ficha.

## Fatias propostas (nesta ordem)

1. **Receber loot na ficha:** na distribuição, o mestre escolhe o personagem; o item vira `InventoryEntry` (ou moeda em `currency`) usando a gravação com revisão já existente. Precisa de proteção contra entrega repetida (guardar na linha de loot quem recebeu e quanto) e de definir o desfazer. A princípio sem migração (jsonb), a confirmar.
2. **Transferência de itens e moedas entre personagens** pelo mestre, com histórico. O histórico durável provavelmente exige tabela nova (migração: preparar, validar isolada e pedir autorização).
3. **Ficha simples antiga:** o inventário em `notes.meta.inventario` pode ficar visível à campanha quando o personagem é publicado. Migrar para a ficha guiada e restringir o `meta` (há dados reais: exige plano e autorização).
4. **Lista de personagens do mestre:** ativos/inativos, mortos e aposentados, vínculo de jogadores e NPCs com ficha.

## Decisões necessárias antes da fatia 1

1. Quem confirma a entrega: só o mestre, ou o jogador aceita?
2. Personagem sem ficha guiada pode receber loot?
3. Restaurar um encontro mantém o que já foi entregue (regra vigente). A linha restaurada deve avisar quem já recebeu?
4. Moedas além de pc/pp/po são necessárias?

## Etapas já aprovadas e ainda não iniciadas

Refinamentos do Início, seleção explícita de seções nas Anotações, biblioteca de Documentos, referências com `@` e integração entre Anotações, Encontros, Documentos e loot; configurações da Iniciativa (backlog).

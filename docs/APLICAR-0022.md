# Aplicação da migração 0022 em produção

Projeto Supabase: **compendio-5e** (`gwcttjlxzelzjhbuitmi`). Nunca no projeto legado `rastreador-dnd`.
**Aplicar somente com autorização do responsável.** Nenhuma senha, token ou chave secreta entra no repositório ou na conversa.

Arquivo: `supabase/migrations/0022_npc_ficha_de_personagem.sql` (uma transação; ou aplica tudo, ou nada).

## O que muda
- Substitui 12 funções existentes; cria `character_life`, `private_ficha.npc_ficha_eventos`, `codex_npc_sheet_set`, `character_life_set`, `private.npc_do_compendio` e duas políticas restritivas.
- Combate e encontros passam a aceitar a referência `npc`. A limpeza diária da 0021 passa a apagar também as cópias vencidas de fichas de NPC.
- **Não altera nem apaga dados existentes.**

## Passos
1. Confirmar que existe backup recente do banco.
2. Rodar `supabase/preflight/0022_conferir.sql` e **guardar o resultado**. Esperado: 12 funções com `antes`; versão 21; três colunas falsas; zeros na última consulta. Se alguma função vier `DIVERGENTE` ou `AUSENTE`, **parar** e avisar.
3. Aplicar o arquivo da migração inteiro. Ele recusa rodar se a versão não for 21.
4. Rodar o diagnóstico de novo. Esperado: 12 funções com `depois`; versão 22; três colunas verdadeiras; contagens da consulta 3 iguais às de antes; zeros na consulta 4.
5. Rodar `supabase/preflight/0021_conferir_retencao.sql`: o agendamento `compendio-purgar-copias-de-ficha` deve estar ativo (a mesma tarefa limpa as cópias de NPC).
6. Avisar para mesclar o PR #170 e conferir a publicação.

## Se algo der errado
- Erro durante a aplicação: a transação é desfeita sozinha; nada muda.
- Depois de aplicada e antes de qualquer uso: `supabase/rollback/0022_npc_ficha_de_personagem_down.sql` restaura a versão 21.
- Depois do primeiro uso (ficha de NPC, estado vital, cópia em retenção, combate ou encontro com NPC) a reversão **recusa**, para não perder dados; corrigir com nova migração.
- O aplicativo publicado funciona com o banco 21 e com o 22.

## Conferência depois de publicar
Com uma conta de mestre e uma de jogador, seguir a seção "NPCs, fichas e estado vital" de `docs/ROTEIRO-TESTES-JOGADORES.md`.

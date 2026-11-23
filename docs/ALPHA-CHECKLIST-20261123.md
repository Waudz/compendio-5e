# Alpha 2.0 — checklist, procedimento de publicação e roteiro de testes (23/11/2026)

> Fonte de verdade: código da branch `alpha/estabilizacao-20261123` (base `main` `5d53953` + PRs #130 e #131 integrados) e os resultados abaixo. Onde este documento contradiz documentos anteriores, valem as decisões mais recentes (DEC-20261123-G/H) e o código.
> **Nada foi aplicado ao Supabase hospedado, nada foi publicado e nada foi mesclado na `main`.**

## 1. Estado real (auditado no código e executado)

| Área | Estado | Evidência | Limite |
|---|---|---|---|
| Login, senha, sessão, cadastro fechado | Implementado e testado com contas simuladas | `auth.test.tsx`, `etapa1.test.tsx`; `persistSession`/`autoRefreshToken` ligados em `src/supabase.ts`; `signUp` recusado no cliente | **Cadastro fechado só no cliente**: conferir/desabilitar no servidor (Auth) com autorização; login/recuperação reais por e-mail não foram exercitados nesta sessão |
| Campanhas, convites, campanha ativa | Implementado e testado (simulado) | `campaignsUI.test.tsx`, PRs #114/#115 na main | Fluxo com contas e convites reais no projeto hospedado ainda precisa de teste manual (roteiro §6) |
| Criador / fichas / inventário | Integrado: 12 classes (1 subclasse SRD cada), 9 opções raciais, 319 magias, equipamento inicial por classe, point buy/matriz, rascunhos e `character_sheets` (0007/0008, aplicadas) | `src/criador/*.test.*`, `docs/CRIADOR-2014-EXPANSAO.md` | **Antecedente: só Acólito + origem personalizada** (SRD); demais subclasses/antecedentes dependem de fonte autorizada; não é a progressão completa de todas as opções do 1.0 |
| Compêndio (itens 578, magias 319, monstros 323) | Integrado e restrito por campanha; Bestiário só para o mestre na Iniciativa/Encontros | PR #84/#116; testes do catálogo | Traduções de monstros por IA sem revisão humana |
| Iniciativa e Encontros — **modo local** | Funciona, só mestre, por usuário e campanha | `iniciativaTela.test.tsx`, E2E | Fica no navegador |
| Iniciativa e Encontros — **modo nuvem** | **Implementado e testado em ambiente isolado; desligado por padrão** (`VITE_COMBATE_REMOTO=1` liga) | `useLinhaRemota.test.tsx` (9), `iniciativaNuvem.test.tsx` (11), `supabase/combates-rls.test.ts`, `encontros-rls.test.ts`, `combates-reversao.test.ts`, E2E `combate-nuvem.spec.ts` | **Depende das migrações 0009 e 0010 aplicadas no projeto hospedado (não aplicadas).** O E2E usa servidor falso; não prova o Supabase real |
| Diário / Anotações / Enciclopédia | Existem; Diário e Anotações com persistência/permissões nos PRs anteriores | testes existentes | **Não reauditados nesta sessão**; Enciclopédia continua com fundação e SQL em rascunho (sem políticas aplicadas) — não é critério da Alpha mínima |
| Navegação por abas (PR #130) | Integrada | `navigation-behavior.test.ts` e suíte de navegação | Voltar/Avançar do navegador **dentro do app** não foi tratado nesta sessão (ver §5) |
| PV do jogador na ficha a partir do combate | **Não implementado** | — | Exige fluxo autorizado de ficha (RPC); decisão de produto/segurança pendente (§5) |

## 2. Combate e encontros — o que foi feito nesta sessão

- **Migração `0009_campaign_combats.sql`** (promove o rascunho): uma linha por campanha, mestre-only (RLS via `public.is_master`), versão otimista, `DELETE` condicionado à versão para finalizar; valida estado, condições e referências no servidor. Rollback: `supabase/rollback/0009_campaign_combats_down.sql`.
- **Migração `0010_campaign_encounters.sql`**: encontros preparados, mestre-only, **sem DELETE pela Data API** (finalizar um combate nunca apaga encontros). Rollback: `0010_campaign_encounters_down.sql` (reverter **0010 antes da 0009**).
- Schema de apoio próprio `private_combates` (não `private`, para que reverter a 0008 não dependa dessas funções). Livro-razão `supabase/migrations/LEIA-ME.md` renumerado (reservas futuras passaram para 0011+).
- **Hook `useLinhaRemota`**: uma gravação por vez e em ordem, confirmação antes de dizer "salvo", nova tentativa automática com recuo, conflito explícito (nada é sobrescrito; cópia local em `…:nao-sincronizado`), recarga ao voltar à janela (outro aparelho), aviso ao sair com pendências, finalização que só confirma com o servidor.
- **Interface**: modo local/nuvem sempre visível; combate antigo do navegador **não importado nem apagado** (backup com botão de baixar); turno anterior; rolagem de iniciativa (1d20 + Destreza para monstros do Bestiário); condições; monstros do Bestiário e personagens da campanha por referência estável (`ref`); encontros: criar, renomear, duplicar, excluir, quantidade, adicionar do Bestiário, enviar ao combate preservando o encontro.
- **Segurança**: jogador não vê o módulo (cliente) e nem a API recebe chamada dele (teste); no banco, RLS nega jogador, mestre de outra campanha, sem vínculo e `anon` (PGlite com `auth.uid()` simulado — **não** valida a configuração hospedada).

## 3. Resultados de verificação

Ver a seção "Resultados" no final deste arquivo (preenchida com a última execução local).

## 4. Migrações necessárias para ativar o modo nuvem

1. `0009_campaign_combats.sql` e 2. `0010_campaign_encounters.sql`, nessa ordem, no projeto Supabase **`compendio-5e`** (nunca no `rastreador-dnd`/Assimilação).
Nenhuma altera dados existentes (só criam tabelas/funções novas).

## 5. Limitações conhecidas da Alpha (não escondidas)

- Modo nuvem **desligado** até a autorização das migrações; sem ele, combate/encontros ficam no aparelho.
- PV/condições do combate **não** atualizam a ficha do jogador (fluxo autorizado de ficha não implementado; sem expor o combate ao jogador). Decisão pendente.
- Voltar/Avançar do navegador dentro do app: não implementado/auditado.
- Notas, Diário publicado, Enciclopédia e a revisão de segurança hospedada não foram reauditados aqui.
- Cadastro fechado no servidor, e-mails de convite/recuperação e RLS/Data API do projeto hospedado precisam de verificação manual com autorização.
- Criador: uma subclasse por classe e um antecedente SRD; sem suplementos.
- Traduções dos monstros/itens/magias não revisadas por humanos.
- Playwright rodou no Chrome local (sem ffmpeg/Chromium do Playwright); responsividade completa em 8 larguras e acessibilidade (axe) estão nas configs `test:quality`/`test:creator`.

## 6. Roteiro de testes manuais (com o modo nuvem após a autorização)

1. Entrar como mestre → criar campanha → convidar jogador por link → sair; entrar como jogador com a conta autorizada pelo convite → confirmar que cadastro livre está fechado.
2. Fechar o navegador, reabrir: continua logado; abrir outro aparelho: mesma campanha ativa.
3. Jogador: criar personagem (classe, raça, antecedente, atributos, perícias, equipamento), salvar rascunho, fechar, retomar, finalizar; conferir ficha e inventário (adicionar/remover/equipar).
4. Mestre: abrir o personagem do jogador; Compêndio → Monstros → ver detalhe e links para magias.
5. Mestre: Encontros → criar, adicionar monstros do Bestiário e quantidades, duplicar, renomear; recarregar (F5) e abrir em outro aparelho: continua salvo.
6. Mestre: Iniciativa → enviar o encontro, adicionar o personagem do jogador, rolar iniciativa, avançar/voltar turnos e rodadas, dano/cura, condições; ver "Salvo na nuvem"; F5; outro aparelho; desligar a rede (aviso e nova tentativa) e religar.
7. Dois aparelhos editando ao mesmo tempo: o segundo recebe o aviso de conflito e escolhe recarregar.
8. Finalizar o combate; os encontros continuam; iniciar outro combate.
9. Jogador: não vê Iniciativa/Encontros no menu; pela API (token do jogador) `campaign_combats` e `campaign_encounters` devolvem vazio/negado.
10. Celular: repetir 3, 5 e 6 em tela estreita (sem corte de botões, sem rolagem horizontal).

## 7. Publicação (somente com autorização expressa) e reversão

**Antes:** merge do PR da Alpha na `main` (só após revisão); backup do projeto Supabase (snapshot) e conferência do projeto-alvo (`compendio-5e`).
**Publicar:** (1) aplicar `0009` e `0010` por Supabase CLI/SQL Editor no `compendio-5e`; (2) rodar `supabase/combates-rls.test.ts`/`encontros-rls.test.ts` contra uma cópia/branch de desenvolvimento antes; (3) configurar `VITE_COMBATE_REMOTO=1` no ambiente de build do GitHub Pages; (4) gerar o build e publicar o site; (5) executar o roteiro §6.
**Reverter:** (a) remover `VITE_COMBATE_REMOTO` e republicar (volta ao modo local; nada se perde nos aparelhos); (b) se necessário, `rollback/0010_campaign_encounters_down.sql` e depois `0009_campaign_combats_down.sql` (apagam os dados dessas duas tabelas: exportar antes). Nenhuma tabela existente é tocada.

## 8. Backlog da Beta (adiado, não implementar na Alpha)

PV de jogadores sincronizado com a ficha por fluxo autorizado; Voltar/Avançar do navegador no app; outras subclasses e antecedentes; revisão humana das traduções; automação de regras e conjuração em combate; sistemas além de D&D 5e 2014; Realtime (atualização ao vivo entre aparelhos sem recarregar); exportar/importar combates e encontros; Enciclopédia completa com visibilidade por campanha.

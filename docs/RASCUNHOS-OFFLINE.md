# Proteção local de rascunhos (offline seletivo) — 19/11/2026

> **Infraestrutura implementada e testada (`src/drafts/`), ainda NÃO ligada ao aplicativo e NÃO conectada ao Supabase.** Dados de teste fictícios. Fonte principal dos dados: **Supabase**. Este módulo só impede a perda silenciosa de anotações (queda de conexão, aba fechada, falha ao salvar). Não é um espelho do banco.

## 1. O que existe
| Peça | Arquivo | Função |
|---|---|---|
| Armazenamento | `backend.ts` | IndexedDB (camada fina, sem dependência) e memória. Falha de IndexedDB (navegação privada, bloqueio, cota) **nunca lança**: cai para memória com aviso `persistent: false`. |
| Repositório | `store.ts` | `createDraftStore({ backend, userId, campaignId })`: salvar, ler, listar, remover, conflito, resolver, exportar, limites, limpeza, `wipe`. Toda operação é do **escopo usuário + campanha**. |
| Estados | `status.tsx` | `deriveSyncState` + `<SyncStatus/>`: **Salvo · Salvando… · Pendente de sincronização · Offline · Conflito**, sempre com texto (não só ícone/cor) e aviso de espaço. |
| Envio (contrato) | `sync.ts` | `flushPending(store, adapter)` com um **adaptador injetado**. Não existe adaptador real: nada é enviado ao Supabase. Só testado com adaptadores falsos. |
| Exportação | `exportar.ts` | Baixa os rascunhos pendentes e em conflito como `.json` (sem ids de conta, tokens nem chaves internas). |

## 2. Regras de proteção (todas com teste)
1. **Supabase é a fonte principal.** Só se guarda o que o usuário está editando e ainda não foi confirmado: nada de campanhas, monstros, imagens ou páginas baixados em massa.
2. **Isolamento:** a chave é `usuário|campanha|tipo|id` e o índice é `usuário|campanha`. Outro usuário, outra campanha e o escopo pessoal (`_pessoal`) **nunca** leem, listam, exportam ou apagam o que não é seu; um registro forjado com dono diferente é ignorado mesmo estando no mesmo banco. Trocar de conta no mesmo navegador não revela nada da anterior.
3. **Nunca sobrescreve o servidor.** Cada rascunho guarda a **versão-base** do servidor. Se o servidor avançou (`decideVersion`), o rascunho vira **conflito**: nada é enviado nem apagado. Editar durante o conflito **não** o resolve. Só uma escolha explícita resolve: **manter o meu** (reassenta sobre a versão do servidor), **usar o do servidor** (descarta o rascunho) ou **salvar como cópia** (devolve o conteúdo e libera o original).
4. **Edição durante o envio não se perde:** se o usuário digitou enquanto o envio estava em andamento, o rascunho continua pendente com o texto novo.
5. **Nada de segredos:** recusa conteúdo com `access_token`, `refresh_token`, `password`/`senha`, chaves secretas do Supabase, JWT com `role`/`sub`/`exp`. O módulo não importa autenticação nem Supabase (teste estático) e não usa `localStorage`, cookies ou rede.
6. **Recuperação:** após fechar e reabrir o navegador os rascunhos voltam (testado com IndexedDB simulado e nova conexão). Um estado "salvando" nunca é persistido (cairia preso após um travamento): ao reabrir, o rascunho é só "pendente".

## 3. Política de armazenamento (configurável)
| Limite | Valor inicial | Motivo |
|---|---|---|
| Total no navegador (todas as contas) | **20 MiB** | texto de planejamento é pequeno (uma página típica tem 1,6–3 kB) |
| Por rascunho | **600 000 bytes** | cabe o teto de 500 kB do conteúdo estruturado + metadados |
| Quantidade | **300** | evita acúmulo |
| Aviso | a partir de **80%** (e "cheio" a partir de 98%) | também considera `navigator.storage.estimate()` (90% da cota do navegador = cheio) |
| Retenção de rascunhos **já salvos** | **7 dias** | só o recuperável é limpo |
- **Prioridade absoluta: não perder pendentes.** Sem espaço: (1) limpa **só** rascunhos já salvos do **próprio** escopo; (2) se ainda não couber, **recusa o novo** com a mensagem "nada foi descartado" e oferece exportar. Pendente e conflito **nunca** são descartados automaticamente.
- O limite global **conta** o tamanho de todas as contas, mas a limpeza só toca no escopo do usuário atual.
- Falha de cota do navegador ao gravar: o rascunho anterior permanece intacto e a mensagem pede exportação.

## 4. Riscos de privacidade (dispositivo compartilhado)
- O IndexedDB fica no **perfil do navegador**: quem usa o mesmo perfil e as ferramentas de desenvolvedor pode ler rascunhos em texto claro. O isolamento por usuário protege contra o **aplicativo**, não contra uma pessoa com acesso ao perfil.
- **Mitigações previstas para a integração:** ao **sair da conta**, perguntar se há pendentes e oferecer **exportar e apagar** (`hasUnsynced()` + `wipe()`); opção "este é um aparelho compartilhado" que apaga os rascunhos do escopo ao sair; avisar quando o armazenamento local não é persistente (navegação privada).
- Os rascunhos **não** são criptografados (sem chave segura no cliente); portanto notas sensíveis do mestre ficam legíveis no aparelho até serem sincronizadas e limpas. Decisão pendente: exigir apagar ao sair, e prazo de retenção.
- Nada de credenciais é guardado; a exportação omite ids de conta.
- Duas abas editando o mesmo item: vale a última gravação **local**; o conflito de versão é detectado no envio. Um canal entre abas é melhoria futura.

## 5. Limitações desta entrega
Não está ligada ao editor nem ao app; não há adaptador de envio real; não há tela de resolução de conflitos; não há canal entre abas; não há teste em navegador real nem em celular (IndexedDB testado com implementação simulada em Node); a cota real varia por navegador; `fake-indexeddb` (Apache-2.0) entrou **só como dependência de desenvolvimento** (**precisa de aprovação**).

## 6. Como funcionará "Disponibilizar sessão offline" (futuro; NÃO implementado)
Objetivo: o mestre escolhe **uma sessão** do Planejamento e a deixa legível sem conexão (ex.: no celular durante a partida), sem baixar a campanha inteira.
1. **Pacote da sessão** (somente leitura): a sessão, suas colunas e cartões, o conteúdo JSON das **páginas referenciadas** por esses cartões (inclusive atalhos, uma vez só), as **prévias de encontros** vinculados e os **registros e pendências** da sessão. **Páginas linkadas por `ref`** entram só se o mestre marcar "incluir links" (profundidade 1; sem fecho transitivo) e nunca o que a RLS não permite ler.
2. **Imagens: opcionais**, desligadas por padrão, com estimativa de tamanho antes ("+12 MB"), redimensionadas e com teto por sessão; sem imagem, o texto abre normalmente com um espaço reservado.
3. **Limites:** 1–3 sessões offline ao mesmo tempo; teto de **15 MiB por sessão** (texto) e de **50 MiB no total** (com imagens); acima disso o app mostra o tamanho e pede para escolher o que incluir. Separado do espaço dos rascunhos (que têm prioridade).
4. **Escopo e privacidade:** chaves por usuário + campanha + sessão; cada item guarda a **versão** do servidor; o pacote é apagado ao sair da conta ou ao trocar de usuário (com aviso sobre o que será perdido). Segue o mesmo aviso de dispositivo compartilhado.
5. **Invalidação:** a cada abertura online, compara-se `version`/`updated_at` por item; item mais novo no servidor → "desatualizado" (atualizar ou manter); item removido/na lixeira/sem permissão → some do pacote (nunca fica visível offline algo que a permissão atual proibiria). Botão "Atualizar" e atualização automática quando há conexão; validade máxima do pacote (ex.: 14 dias) após a qual ele pede nova sincronização.
6. **Edição offline:** o pacote é leitura. Registros rápidos feitos offline entram como **rascunhos pendentes** (infraestrutura desta entrega) com `client_id` para envio idempotente; edição de páginas offline continua só pelos rascunhos, com conflito explícito.
7. **Primeiro passo técnico:** um segundo repositório no mesmo IndexedDB (`sessoes_offline`) com a mesma disciplina de escopo e limites, e uma função de montagem do pacote que **usa a RLS** (lê como o usuário), nunca um endpoint privilegiado.
Requer decisões: tamanhos, retenção, e se haverá criptografia local. Nada disso começa sem aprovação.

## 7. Próximos passos
Aprovar a dependência de teste; ligar `useUnsavedGuard` ao `DraftStore` no editor (PR futuro); adaptador de envio real (depende da `0005` aplicada); tela de conflito; avisos ao sair da conta; teste em aparelhos reais.

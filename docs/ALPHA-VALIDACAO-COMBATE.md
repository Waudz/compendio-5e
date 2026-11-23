# Alpha — validação de combate e encontros (22/11/2026)

Branch `fix/alpha-validacao-combate`, dependente do PR #106 → #103. Sem merge, deploy ou alteração no Supabase.

## Etapa 1: base executável e gravação confiável

- Reproduzido no HEAD `9bc7f2f`: build falha com TS2304 e três testes de Encontros falham por `podeGerenciar` não declarado. Corrigida a obtenção da permissão no contexto.
- Erro ao gravar localmente mantém a edição visível e permite repetir a gravação. A aba registra alterações não salvas no mecanismo existente de navegação/logout/troca de campanha/reload; o diálogo pode tentar salvar. O dado anterior em disco não é apagado. Isso não torna localStorage uma persistência aprovada para a Beta.
- Leitura rejeita PV fracionário, fora do intervalo, IDs vazios e quantidades de encontro fora de 1–50; não sobrescreve dados inválidos ao carregar. Domínio bloqueia PV infinito e IDs repetidos. Não houve conversão ou exclusão de dados existentes.
- Adaptador remoto ainda desligado da tela: valida a versão retornada em INSERT/UPDATE, impede overflow e testa filtros de campanha/versão, conflito, RLS, ausência de confirmação e rede indisponível.
- E2E antigo esperava um placeholder de iniciativa removido pelo #103. Atualizado para o fluxo local real (adicionar, dano, rodada, reload) e bloqueio do jogador.

## Evidências locais

- `npm ci --no-audit --no-fund`: executado.
- `npm run build`: aprovado; avisos de chunks grandes e anotações de dependências permanecem.
- Vitest completo final: 106 arquivos, 1340 testes aprovados. Suíte focada de combate/adaptador/tela: 47 testes aprovados. Confirmar CI no HEAD publicado.
- `npm run test:e2e:types`: aprovado.
- Playwright local: bloqueado antes de executar as páginas. Navegador esperado ausente; download recebe HTTP 403; Chromium instalado falha ao criar socket (`Operation not permitted`). Não é evidência de aprovação ou falha funcional da aplicação. Executar no CI habitual com Chromium gerenciado.

## Auditoria remota somente leitura

Projeto correto: `gwcttjlxzelzjhbuitmi` (`compendio-5e`), saudável. Legado não alterado. `campaign_combats` ausente; adaptador não deve ser ativado. Histórico inclui fundação privada de fichas, Enciclopédia e persistência 0008 (documentos antigos que dizem não aplicada são históricos).

Advisors: saúde sem avisos; quatro tabelas da Enciclopédia com RLS sem políticas; dez funções SECURITY DEFINER executáveis por autenticados (algumas são RPCs intencionais, exigem análise individual); proteção contra senhas vazadas desativada. Desempenho: quatro FKs sem índice e oito políticas com avaliação de auth por linha, além de índices ainda sem uso e backups sem PK. Nenhuma configuração ou política alterada.

Referências: [RLS sem política](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy), [funções privilegiadas](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable), [senhas](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection), [índices de FKs](https://supabase.com/docs/guides/database/database-linter?lint=0001_unindexed_foreign_keys), [initplan](https://supabase.com/docs/guides/database/database-linter?lint=0003_auth_rls_initplan).

## Próxima etapa

Testar o SQL de combate em PostgreSQL isolado, incluindo RLS entre mestre/jogador/campanhas, grants, versão e conteúdo obrigatório. Não ativar o adaptador nem importar armazenamento local até estratégia de recuperação e migração revisadas e autorizadas. Validação manual em celular real e bloqueio de cadastros no servidor continuam pendentes.

## Continuação — remoção de quem está no último turno (22/11/2026)

Reproduzido defeito funcional: remover o último combatente da ordem durante seu turno selecionava o anterior e não avançava a rodada. Corrigida a transição para o primeiro restante da próxima rodada. Remover antes/depois do combatente atual preserva seu ID e a rodada; remover o único mantém turno nulo.

Dois testes de domínio falharam antes da correção. Adicionados três testes de domínio e um de interface com remontagem para comprovar turno/rodada persistidos, sem repetir o turno anterior. Os 51 testes focados de combate/adaptador/tela passaram; build aprovado. Aguardar suíte completa e CI do novo HEAD do #107. Mudança em código experimental, sem merge/deploy, conexão de escrita ao Supabase ou alteração de combates reais.

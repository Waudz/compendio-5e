# Transferência para Claude — 28/11/2026

## Estado real e fonte de referência

- Repositório `Waudz/compendio-5e`; main verificada `3ad9e77dddbfa43a4c6f4f3294a56873285dfc7e` (merge #173). #172 também integrado.
- **#171 foi integrado** (head final `fe507e5601a0f87a88d0b03d5ef9e88407ae7fdc`). Não reabrir nem tentar concluir o antigo rascunho.
- **0023 já aplicada em produção, conforme confirmação do responsável. Não reaplicar 0022/0023.** Esta IA só fez consultas de metadados no Supabase, nenhuma aplicação remota.
- Trabalho vigente parte de `fix/compendio-identidade-simplificada`, commit `9e398add55b523052c02c155ba0ab1dd9f0c0570` (ChatGPT), baseado exatamente na main atual. Esse commit altera `src/compendio/campos.ts`; ainda não estava testado quando recebido.
- Fonte normativa completa: [REFORMULACAO-BETA-20261128](REFORMULACAO-BETA-20261128.md), cópia integral do pedido. Preferência de **dois PRs no máximo**, não um por correção. Não há PR funcional novo aberto nesta rodada.

## Cópias locais e trabalho antigo

Workspace atual: `C:\Users\William\Documents\Codex\compendio-identidades-beta`, branch `fix/compendio-identidade-simplificada`.

A pasta antiga `C:\Users\William\Documents\Codex\compendio-5e` ficou parada em `38eb3d6` com alterações locais antigas. Elas foram preservadas sem reset/descarte em `C:\Users\William\Documents\Codex\arquivo-interface-171-20261128`: patch binário e os arquivos não rastreados (`retornoLocal`, `CamposHistoria`, `SecaoNarrativa`, SQL 0023). **Não mesclar esse patch indiscriminadamente:** boa parte foi implementada por outra IA no #171; ele contém decisões agora rejeitadas, como campos de idade/personalidade e acordeões. A SQL 0023 local antiga não deve substituir a migração efetivamente aplicada.

A suíte executada nessa cópia antiga terminou com 1.886 aprovados e duas falhas (allowlist de funções RPC e rollback 0023 ausente). **Esse resultado não representa a main atual**. O #171 integrado já contém seu próprio rollback/validação; conferir a versão atual em vez de repetir correções antigas.

## Alterações desta continuação na branch correta

- Aproveitado o commit 9e398ad: simplifica campos de NPC/local/organização e adiciona tipos selecionáveis de local.
- Editor narrativo deixa de esconder campos longos em “Mais detalhes”: formulário direto, preservando os valores antigos no objeto `fields` ao salvar.
- Estado vital renomeado para **Estado**; Vivo deixa de aparecer continuamente na consulta. A autorização e a fonte `character_life` não mudaram.
- Rótulo privado passa a “Observações privadas do mestre”; mantém a propriedade `secret`, sem transferir notas privadas de jogadores nem migrar dados.
- Interface da história privada do aventureiro remove idade, personalidade, ideais e defeitos; os valores continuam no draft canônico e são preservados pelo spread ao editar outro campo. “Vínculos pessoais” permanece distinto das relações estruturadas.
- Documentação de continuidade/README precisa registrar o estado atual, removendo afirmações vigentes de #171 aberto/0023 pendente. Registros históricos podem ficar claramente datados.

## O que NÃO está concluído

### Primeiro PR: identidades e relacionamentos

1. Consolidar layout direto aprovado: retrato; nome/alcunha; raça/ocupação; naturalidade/residência; Estado; descrição; história; vínculos; observações privadas; ações acessíveis. Sem acordeões, etapas extras ou menus aninhados.
2. Derivar classe, nível e antecedente da ficha técnica, sem duplicar preenchimento. Respeitar identidade pública do dono e projeção autorizada; não expor ficha privada em nome de unificação visual.
3. Naturalidade/residência de PCs hoje têm IDs em `draft.story`, mas **ainda não são relações estruturadas bidirecionais**. Persistir pelo servidor com permissão para o jogador editar apenas seus vínculos autorizados. A 0023 é majoritariamente do mestre; não afrouxar a RLS para resolver isso. Nova migração precisa de proposta/testes e autorização, não aplicar remotamente.
4. Locais: parent por vínculo `located`; impedir ciclos e hierarquias incompatíveis no servidor. Tipos contextuais e filtro de naturalidade (excluir bares/comércios) ainda faltam. Texto livre deve continuar aceito; residência é mais flexível.
5. Relações: cargo opcional, tipos trabalha/frequenta/governa/aliado/inimigo, mesma fonte de verdade nas duas direções, edição por qualquer ponta autorizada. Agrupar múltiplas relações do mesmo alvo numa linha, preservando visibilidade de cada relação/cargo/registro.
6. Organizações: membros/cargos e contagem derivados dos vínculos; liderança como membro. Não criar hierarquia complexa.
7. Seleção múltipla deve incluir NPCs e PCs simultaneamente, respeitando filtros e operações diferentes de exclusão/ciclo de vida. Não chamar a exclusão de aventureiros para NPCs.
8. Validar preservação de campos removidos e de referências antigas; atualizar apenas os testes cujas expectativas foram substituídas pelo pedido, sem suprimir verificações de segurança.

### Segundo PR: fichas, consultas e mecânica

- Cabeçalho compartilhado destacado, editar/menu no canto, sem retrato duplicado nas abas; mesma largura no popup/página e para mestre/jogador.
- Abas por tipo, nenhuma barra quando só há Identidade. Preservar aba ativa ao maximizar e proteger rascunhos ao fechar.
- Bestiário simples, lista/grade com tipo/tamanho/ND sem CA/PV; licença e informações originais preservadas. Conhecimento do jogador continua sendo projeção no servidor.
- Edição direta de NPC com ficha; substituição confirma só no final depois de escolher/configurar novo modelo, sem perder ficha anterior em cancelamento/falha.
- Inventário de NPC de criatura independente do modelo, reutilizando inventário/transferências/loot; retirar itens da fonte persistente ao coletar, sem duplicação.
- Ataques/rolagens compartilhados, atributos/modificadores e PV legíveis, danos alternativos não somados. Consultar o 1.0 só como referência, sem alterá-lo.
- Menus e consultas compartilhados, abertura de aba/grupo só no desktop, dois grupos máximos. Preservar filtros/rolagem/histórico e não abrir várias abas ao salvar.

## Segurança, validação e publicação

Não aplicar migrações novas em produção sem autorização. Não tocar em 1.0/Assimilação, nem em dados reais. Sem perda de IDs, fichas, inventários, campanhas, conteúdo antigo ou permissões.

Usar testes direcionados por conjunto. TypeScript/build e CI abrangente ao finalizar cada PR. Não repetir a bateria completa local a cada ajuste; não declarar testes aprovados sem resultado. Esta rodada ainda precisa validar os novos rótulos/campos contra os testes vigentes e revisar desktop/mobile.

No Windows, o Vite pode falhar no otimizador por acesso a `C:\Users`; `--configLoader runner` funcionou para Vitest/build na cópia antiga. Para navegador foi usado build isolado com `NODE_ENV=development`, modo e2e, credenciais vazias e `vite preview`, sem chamadas externas. Não tratar esse workaround local como alteração necessária de produção.

## Anotações

Não implementada e não iniciar antes de concluir a reformulação acima. Preservar [ANOTACOES-BETA-HANDOFF](ANOTACOES-BETA-HANDOFF.md). Novo pedido vigente tem prioridade sobre os documentos antigos: não reconstruir contexto a partir apenas de relatórios históricos do #171.

## Evidência do checkpoint

- 28/11/2026: 33/33 testes passaram em dois arquivos: conhecimento.test.tsx e conhecimento-granular.test.ts, com Vitest --configLoader runner.
- As expectativas de campos foram atualizadas para o pedido aprovado; nenhuma verificação de privacidade foi desativada.
- README e continuidade receberam aviso normativo atual, mantendo registros históricos.
- Não executados neste checkpoint: build, bateria completa, E2E e revisão visual. Não aprovar merge com base somente nesses 33 testes.
- Nenhum novo SQL foi aplicado; nenhuma publicação foi feita. O progresso é parcial, destinado à continuidade na mesma branch.

- TypeScript: npx tsc -b concluído com código 0 neste checkpoint.

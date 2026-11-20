# Criador, ficha e inventário — decisões e estado (20/11/2026)

> **Memória de implementação**. Ler junto de `DECISOES-E-ARQUITETURA.md`, `docs/PLANEJAMENTO-V2.md` e `docs/AUDITORIA-CATALOGO-PERSONAGEM-2014.md`. Não confundir pesquisa, protótipo, implementação, testes executados e produção.

## Objetivo integrado

Criador de personagens D&D 5e **2014** (raça/variante, classe, subclasse, origem, atributos, perícias, proficiências, idiomas, escolhas, equipamento, magias e progressão 1–20) que alimenta **uma ficha** com inventário, carteira de cinco moedas, magias, recursos, condições, PV, dados de vida e iniciativa. O inventário fica **dentro da ficha** e deve ser acessível por submenu/deslize no celular. A mesma fonte de verdade abastece jogador, mestre, campanha e combate; não duplicar estados.

### Ferramentas escolhidas

| Função | Decisão | Situação |
|---|---|---|
| Linguagem, app, testes | React 18 + TypeScript + Vite + Vitest + Testing Library | Já instalados; manter |
| UI base | Componentes e CSS existentes; FlexLayout para abas | Manter; não adicionar framework de UI |
| Catálogo aberto | D&D 5e SRD API **/api/2014** + snapshot local versionado | Fonte candidata; não consumir em tempo de execução; não importado |
| Comparação de dados | Open5e V2 | Fonte auxiliar, revisar licenças por publicação; não importado |
| Schemas de conteúdo e fichas | Zod | Escolhido para etapa seguinte; **ainda não instalado** |
| Criador guiado | React Hook Form + resolver Zod | Escolhido para etapa de UI; **ainda não instalado** |
| Testes de propriedades | fast-check junto do Vitest | Escolhido para próxima etapa; **ainda não instalado** |
| E2E real | Playwright | Escolhido para etapa de UI; **ainda não instalado** |
| Offline | armazenamento já existente; avaliar Dexie somente se necessário | **Não instalar agora** |
| Listas grandes | TanStack Virtual sob medição de desempenho | Adiado |
| Máquina de estados | XState apenas se fluxos exigirem | Adiado |

**Motivo de não instalar tudo agora:** alterações de dependências precisam atualizar `package-lock.json` com `npm install` e passar `npm ci`; adicionar somente entradas ao `package.json` quebra CI. Primeiro manter domínio puro, depois instalar dependências em lote pequeno com lockfile validado.

**Referências de arquitetura:** [Foundry dnd5e Advancement](https://github.com/foundryvtt/dnd5e/wiki/Advancement) e [Activities](https://github.com/foundryvtt/dnd5e/wiki/Activities) para separação de progressão/ações; [5e SRD API](https://docs.dnd5eapi.co/introduction) para estrutura de dados 2014; [React Hook Form](https://react-hook-form.com/docs/useform), [Zod](https://zod.dev/), [fast-check](https://fast-check.dev/), [Playwright](https://playwright.dev/) para ferramentas. **Não copiar código nem conteúdo fora de licenças autorizadas.**

## Implementado neste PR (piloto isolado)

- `src/rules/character-build-pilot.ts`: motor puro experimental, ainda incompleto (efeitos, magias, escolhas de classe, multiclasses e muitas outras regras faltam).
- `src/rules/character-build-pilot.test.ts`: caso de anão da colina, bárbaro, acólito e níveis 1–20, com fixtures parciais.
- `src/rules/character-domain.ts`: **novo** contrato de rascunho com `ruleset`, `catalogueVersion`, escolhas por IDs estáveis, separação entre direitos concedidos e inventário instanciado, recursos gastos, PV atuais/temporários, ficha derivada e proveniência.
- `src/rules/character-domain.test.ts`: **novo** teste de ficha, escolhas inválidas/pendentes, inventário, isolamento de estado, versões e níveis 1–20.

**Importante:** nenhum dos módulos acima está conectado à interface, ao Supabase, ao armazenamento de personagens ou ao motor de iniciativa. Nenhum dado real de usuário é criado ou alterado. São contratos/fixtures para validar a arquitetura. O inventário do piloto tem operações básicas, **não** cobre equipamentos de classe, contêineres, peso, sintonização, dinheiro ou pilhagem. A progressão ainda não cobre escolhas por nível nem todas as características. **Não chamar de criador completo.**

## Modelo pretendido

1. **Catálogo imutável**: IDs, edição, fonte/licença, versão, concessões e avanços. Pacotes de opções são validados antes da publicação.
2. **Decisões de criação**: eventos/seleções por nível com IDs estáveis, revisáveis, pendências e dependências explícitas.
3. **Ficha derivada**: cálculo puro de atributos, perícias, CA, PV máximos, magias, resistências, atividades, proficiências, recursos e proveniência.
4. **Estado mutável**: PV atuais, PV temporários, usos consumidos, magias preparadas, inventário e moedas; nunca reconstruir automaticamente o inventário ao subir de nível.
5. **Participação em campanha**: personagem pessoal e estado da campanha separados conforme D1–D6; mestre não sobrescreve propriedade do personagem.
6. **Sincronização**: persistência offline/local + Supabase com RLS, controle de versões, conflitos e isolamento por usuário/campanha, **somente após aprovação explícita de migrações**.

## Próximas etapas com critérios de aceite

1. CI verde dos arquivos novos, correção de falhas e cobertura do piloto.
2. Reescrever o piloto para motor de progressão por eventos e escolhas por nível, incluindo ASI, subclasses, proficiências e equipamento inicial, sem perda de dados ao editar.
3. Adicionar Zod + fast-check com lockfile correto; schemas de importação, testes de propriedades, oráculos independentes de regras 2014.
4. Completar **uma vertical real**: Bárbaro/Berserker 1–20, raça e origem completas, escolhas, ficha, inventário, PV e recursos; comparar com fonte primária e registrar exceções.
5. Integrar criador guiado com React Hook Form + Mantine/CSS existente, com prévia antes de confirmar; ficha e inventário em abas/submenu.
6. Integrar com iniciativa e campanha, sem duplicar PV e recursos; só depois propor migração Supabase com RLS e testes.
7. Testar com Playwright: criação, edição, nível, rollback, reload, offline, export/import, jogador/mestre e isolamento.

## Restrições e histórico

- O legado `Waudz/rastreador-dnd` é **somente referência**; não alterar.
- Não mesclar PR nem publicar sem autorização; não alterar banco/Supabase sem aprovação.
- D&D 2014 é o alvo; suplementos compatíveis com 2014 podem existir, mas requerem fonte e licença individual.
- O PR #74 começou como auditoria; passou a conter **código experimental**, portanto título/descrição antigos não representam mais todo o escopo.
- A primeira falha de CI foi provocada por sequências `\\n` literais no TypeScript; corrigidas. Run `44696263213` do commit `7923144` terminou com **build e testes verdes**. Novos commits exigem nova execução e verificação.
- Fonte de verdade sobre auditoria e cobertura: `docs/AUDITORIA-CATALOGO-PERSONAGEM-2014.md`.

## Registro de continuidade — sessão 20/11/2026 (handoff para outro chat/IA)

### Instruções obrigatórias de retomada

1. Abrir `README.md`, `DECISOES-E-ARQUITETURA.md`, `docs/PLANEJAMENTO-V2.md`, **este arquivo** e `docs/AUDITORIA-CATALOGO-PERSONAGEM-2014.md`. Não inferir que as decisões de um documento mais antigo foram implementadas; conferir o código.
2. Consultar [PR #74](https://github.com/Waudz/compendio-5e/pull/74), branch `docs/auditoria-catalogos-personagem-2014`, verificar se continua aberto, diff, SHA e último workflow. **Não fazer merge sem autorização explícita**. O nome da branch e o título do PR são históricos e não refletem todo o código incluído.
3. Ler os quatro arquivos `src/rules/character-build-pilot.ts`, `src/rules/character-build-pilot.test.ts`, `src/rules/character-domain.ts`, `src/rules/character-domain.test.ts` antes de editar. Verificar também o estado atual do app e dos módulos de personagens/iniciativa, sem presumir que os protótipos já estão ligados à UI.
4. Rodar `npm ci && npm run build && npm test` no checkout do PR (ou inspecionar workflow equivalente); registrar **SHA + run ID + resultado**. CI verde não substitui testes manuais de interface.
5. Ao final de **cada rodada**, atualizar este arquivo com: objetivo, arquivos modificados, decisões, regras consultadas, testes e resultados, falhas conhecidas, próximos passos, PR/commit/run e restrições. Atualizar também `DECISOES-E-ARQUITETURA.md` se uma decisão mudar e `docs/AUDITORIA-CATALOGO-PERSONAGEM-2014.md` quando uma regra for auditada.
6. Evitar duas IAs alterando os mesmos arquivos simultaneamente; cada tarefa em branch/PR próprio quando necessário. Não adicionar bibliotecas sem atualizar lockfile e verificar `npm ci`.

### Evidências verificadas até esta sessão

- CI do PR #74, commit `f914d01869e24cc74cfc0c8adc42d4b94b75cfa0`, run [44697189171](https://github.com/Waudz/compendio-5e/actions/runs/44697189171): **success**, com build e testes aprovados. Essa evidência é anterior às alterações posteriores e **não valida novos commits**.
- O primeiro erro histórico no CI foi causado por sequências `\\n` literais em TypeScript; corrigido e revalidado. Evitar edições de texto que introduzam escapes literais.
- **Novo bug detectado por revisão do domínio:** duas decisões com o mesmo `id` eram aceitas silenciosamente, usando a primeira. Corrigido em `src/rules/character-domain.ts` e criado teste de regressão em `src/rules/character-domain.test.ts`. **Ainda exige confirmação de CI após o commit.**

### Limitações técnicas conhecidas (não esconder)

- `character-build-pilot.ts` é um agregador simplificado de concessões, não o motor definitivo: faltam ASI como escolha, subclasses, multiclasse, dados de vida por classe, proficiências/armaduras, CA, salvaguardas, perícias escolhidas pela classe, magias, espaços, recursos com descanso, resistências, efeitos condicionais e atividades.
- O cálculo de PV do piloto usa o modificador de Constituição final em todos os níveis, sem histórico de multiclasse/rolagens. Deve ser conferido contra as regras 2014 antes de produção.
- `character-domain.ts` aceita escolhas de raça e origem por IDs estáveis, **não** escolhas de classe/nível. `pending` registra pendências, mas não impede salvar porque ainda não há persistência. O inventário permite apenas adicionar/remover quantidades adquiridas não equipadas; não é um sistema completo de transações, peso ou equipamento.
- `currentHp > maxHp` é rejeitado no protótipo; uma futura política para redução de PV máximo, progressão reversa e sincronização deverá definir se ajusta automaticamente, bloqueia ou pede confirmação.
- **Ainda não há schemas Zod, fast-check, Playwright, React Hook Form, catálogo importado, migrações ou integração com UI**. Não relatar essas funcionalidades como prontas.
- O conteúdo de teste é **fixture parcial**, não certificação de que o Bárbaro 2014 foi integralmente implementado. Testar 20 níveis de fixture incompleta não prova cobertura de todas as regras.
- Os documentos do repositório prevalecem sobre lembranças de conversas antigas quando houver divergência; registrar e resolver conflitos explicitamente, sem apagar decisões anteriores.

### Ordem imediata recomendada

1. Confirmar CI dos novos commits e corrigir falhas antes de expandir.
2. Especificar esquema versionado de progressão `advancement` com IDs estáveis, pré-requisitos, opções compostas, escolhas de nível, efeitos condicionais e proveniência; escrever testes independentes.
3. Construir a vertical Bárbaro/Berserker 2014 com uma raça e origem **completas**, incluindo progressão 1–20, equipamento inicial, inventário, ASI, PV, recursos e edição reversível; revisar contra SRD 5.1 e direitos de conteúdo.
4. Adicionar Zod/fast-check com lockfile validado, depois UI do criador/ficha/inventário com React Hook Form e testes Playwright.
5. Integrar com campanha/iniciativa, isolamento e sincronização; propor migrações com RLS e obter autorização antes de aplicá-las.

### Regra de qualidade para próximas implementações

Para cada nova regra: **fonte e licença → exemplo normativo independente → contrato e testes → implementação pura → CI → teste de integração → documentação**. Não preencher lacunas de regras com suposições nem copiar automaticamente comportamentos do legado ou do Foundry.

## Rodada seguinte — PRs abertos e avanço da progressão

**Verificação GitHub:** PRs abertos identificados pela busca `repo:Waudz/compendio-5e is:pr is:open`: [#73](https://github.com/Waudz/compendio-5e/pull/73) (somente `docs/PLANEJAMENTO-V2.md`, pendências das Anotações e prioridade do Compêndio; mergeável), [#74](https://github.com/Waudz/compendio-5e/pull/74) (auditoria + protótipos de criador; mergeável). Não há conflito direto de arquivos entre #73 e #74 **nesta consulta**; ambos partem do mesmo `main` base `c651368e`. #73 ainda deve ser revisado quanto a coerência das prioridades antes de merge. **Nenhum PR foi integrado.**

**CI confirmado:** run [44767460941](https://github.com/Waudz/compendio-5e/actions/runs/44767460941), commit `6487ee7b1ae8fc4da88ec1e1357ef8f21f2dedf7`: job `validar` concluído com **success**. Novos commits desta rodada ainda precisam de CI próprio.

**Código novo:**
- `src/rules/character-advancement.ts`: avaliador puro e isolado de progressões por nível (1–20), concessões automáticas, escolhas por IDs persistentes, opções que concedem pacotes, seleção de subclasse e ASI como **exemplos de contrato**. Valida IDs duplicados e escolhas incoerentes, sinaliza pendências; não aplica escolhas de níveis futuros antes do nível correspondente.
- `src/rules/character-advancement.test.ts`: cenários de nível 1, escolha de subclasse no nível 3, ASI no nível 4, IDs inválidos/duplicados, determinismo 1–20. Os dados são fixtures parciais; não são certificação completa do Bárbaro 2014.

**Atenção:** esse avaliador **ainda não está ligado** a `character-domain.ts` nem à interface. Não adicionar `Advancement.grants` ao `ClassDefinition.levels.grants` sem prevenir dupla concessão. ASI 2014 permite +2 em um atributo **ou** +1 em dois diferentes; fixture atual modela só um exemplo, e deve ser expandida. Seleções de classe devem ser revalidadas quando raça/classe/nível mudar; decisões futuras podem ser armazenadas, mas não aplicadas prematuramente. O próximo trabalho é integrar o avaliador à ficha de forma sem duplicação, com testes e fonte normativa.

**Próxima validação:** confirmar CI do novo commit `9dd33b1` ou posterior; corrigir falhas antes de expandir. Atualizar este registro com o resultado.

## Rodada — integração experimental da progressão à ficha (20/11/2026)

**Pré-condição verificada:** PR #74 aberto; run [44767937231](https://github.com/Waudz/compendio-5e/actions/runs/44767937231) concluído com **success** no commit `9b2bcb82f2b56ceb2af9282f48316941b39d419e`. Esse resultado **não** cobre os commits desta rodada.

**Alterações:**
- `src/rules/character-domain.ts`: `CharacterCatalog.advancements?` associa progressões por classe. `createCharacterSheet` passa a chamar `evaluateAdvancements`, integrar concessões de escolhas de classe por nível aos atributos/características/proveniência e agregar pendências. IDs de decisões de classe deixam de ser tratados como desconhecidos. A interface pública do rascunho é mantida.
- `src/rules/character-domain.test.ts`: regressão da seleção de subclasse no nível 3 e ASI no nível 4, com ficha reconstruída, inventário preservado, escolhas inválidas e pendências.
- Nenhuma dependência instalada, nenhuma migração ou alteração de Supabase, nenhum merge/deploy.

**Limites e cuidado:** `advancements` é opcional e **experimental**; não representa catálogo SRD completo. Concessões fixas de classe que já estejam em `ClassDefinition.levels[].grants` **não devem** ser repetidas em `advancements[].grants`; o contrato definitivo precisará consolidar uma única fonte por característica. Ainda não há efeitos, magias, inventário inicial completo, ASI de +1/+1, multiclasse ou integração visual. Os testes são fixtures de contrato, não homologação da classe.

**Próximo passo:** confirmar CI do commit `efe9df0` ou posterior, corrigir qualquer erro, depois validar invariantes de progressão (opções, IDs, concessões duplicadas e edição de nível), refatorar a dupla representação de concessões e avançar com catálogo 2014 auditado. Atualizar SHA/run após verificação.

## Rodada — proteção contra concessões automáticas duplicadas

**Pré-condição:** run [44768373013](https://github.com/Waudz/compendio-5e/actions/runs/44768373013) do commit `65a114e737ac29fcad44dc08317e6495c630a6a8` concluído com **success**. PR #74 continua aberto; nenhuma alteração em `main`, Supabase ou produção.

**Código:** `src/rules/character-domain.ts` agora rejeita concessões automáticas **idênticas** (mesmo objeto serializado) quando repetidas entre `ClassDefinition.levels[].grants` e `advancements[].grants`, e também dentro de avanços automáticos. Mantém exceção provisória para repetição de recursos no catálogo legado de níveis (o piloto usa substituição do máximo por nível). `src/rules/character-domain.test.ts` contém teste de regressão para característica `rage` duplicada.

**Limite importante:** a verificação é estrutural (JSON idêntico), **não semântica**; benefícios equivalentes com fontes diferentes podem passar. Nem toda concessão repetida é erro: proficiências vindas de origens diferentes podem se sobrepor e recursos de classe podem ser atualizados em níveis sucessivos. A solução definitiva é definir **propriedade única de cada progressão de classe** e efeitos tipados com semântica de acumulação/substituição. Não transformar essa guarda provisória em deduplicação universal.

**Próximo passo:** confirmar CI do novo SHA; criar esquema definitivo de `advancement` como única fonte de concessões de classe, migrando gradualmente fixtures, sem reescrever dados de usuários; ampliar testes de mudanças de nível, subclasses e ASI +1/+1 e verificar regras contra SRD 2014.

## Rodada — reaproveitamento concreto de fonte externa SRD 2014

**CI anterior:** run [44768872042](https://github.com/Waudz/compendio-5e/actions/runs/44768872042), commit `c89824bc936c2e24e7f5a19bdece3941debbd3c4`, concluído com **success**. Novos commits ainda aguardam CI.

**Fonte primária de dados selecionada:** [D&D 5e SRD API — níveis de classe 2014](https://docs.dnd5eapi.co/api/get-all-level-resources-for-a-class), endpoint `GET https://www.dnd5eapi.co/api/2014/classes/{index}/levels`. A API expõe nível, bônus de proficiência, total de bônus de atributos, referências de características, campos específicos da classe e magia. A [FAQ](https://docs.dnd5eapi.co/faq) deixa claro que a base contém **somente SRD**, não todo o conteúdo de livros comerciais; conferir licença/atribuição antes de importar e distribuir.

**Implementação:** `src/rules/srd-2014-level-adapter.ts` contém um adaptador **puro e sem rede** que recebe a estrutura da API, verifica sequência de 20 níveis, progressão de proficiência, campos obrigatórios, IDs únicos de características e totais não decrescentes de bônus de atributos. Retorna índice local de referências, sem inventar efeitos ou conceder habilidades automaticamente. `src/rules/srd-2014-level-adapter.test.ts` testa contrato com **fixture sintética**, erros e imutabilidade.

**Não confundir:** este passo **não fez download nem importação real** de JSON da API, não confirmou que a resposta atual do servidor passa pelo adaptador e não criou um catálogo completo. Para produção, baixar snapshot de fonte aberta, fixar versão/checksum e licença, validar o JSON real, revisar inconsistências, então traduzir referências de características em efeitos tipados com testes independentes. Não consultar API durante o jogo: usar snapshot local/offline. O adaptador é deliberadamente restritivo e poderá exigir ajustes após testar dados reais, sem relaxar validações silenciosamente.

**Próximo passo:** CI do novo commit, teste com resposta real versionada da API, snapshot auditável e conversão de características para o motor sem duplicar concessões. Nenhum PR foi mesclado, nenhum dado de usuário alterado.

## Decisão aprovada — extensibilidade e ficha universal (20/11/2026)

**Decisão explícita do responsável:** reservar arquitetura para **classes, subclasses, raças, sub-raças, talentos e origens personalizados**, além de suplementos futuros; a ficha deve ser **universal**, e todas as aparições do personagem (personagens, campanha, iniciativa, encontros, notas/vínculos, visualizações do mestre e do jogador) devem referenciar sua identidade, nunca duplicar registros independentes.

**Nuance fundamental já aprovada em `DECISOES-E-ARQUITETURA.md` §8:** o personagem pertence ao usuário, mas **participações em campanhas possuem estado próprio** (progressão, inventário, carteira etc.). Logo, **identidade universal não significa PV/inventário global em todas as campanhas**. Cada visualização usa `characterId` + contexto `personal` ou `campaignId/participationId`. Ficha, combate e campanha **dentro do mesmo contexto** compartilham PV, recursos e inventário com sincronização/concorrência controladas; diferentes contextos não sobrescrevem uns aos outros. Mestre edita apenas estado de participação autorizado; não edita personagem pessoal. O vínculo pode mostrar retrato/nome da identidade com permissão, e estado derivado do contexto.

**Novo contrato experimental:** `src/rules/content-registry.ts` + testes:
- Fontes `srd-2014 | supplement | homebrew`, identificadores compostos `sourceId:kind:id:revision`, `ruleset` 2014, licença e editora como metadados; permitem duas classes com mesmo slug em fontes diferentes sem colisão.
- Categorias `race | subrace | class | subclass | feat | background`, referências estáveis, revisão, pré-requisitos referenciados; validação de fonte, duplicações e dependências ausentes.
- `CharacterPointer` para identidade e escopo `personal` ou `campaign`, com `characterPointerKey` e testes de isolamento.
- **Atenção:** isso é **somente contrato/validação**; não é editor de homebrew, importador de suplementos, banco de conteúdo ou sincronização implementada. O `CharacterDraft` atual ainda usa IDs simples para raça/classe/origem: futura migração para `ContentRef` versionado exigirá compatibilidade e testes. Talentos ainda não têm motor de efeitos nem pré-requisitos semânticos. Não importar conteúdo de suplementos sem licença/direitos; conteúdo pessoal não equivale a autorização para redistribuição.

**Requisitos para a futura implementação:** registro de fontes com visibilidade (oficial, privado do usuário, compartilhado/autorizado), versões imutáveis e migração explícita; editor seguro com validação de esquema e efeitos tipados; pré-requisitos por classe, nível, atributo e talentos; escolha de suplementos por campanha; fallback quando conteúdo externo for removido; RLS de conteúdo próprio e compartilhado; ficha universal como projeção de identidade + estado contextual; links apenas por IDs; atualização otimista e propagação para iniciativa, campanha e ficha; testes de isolamento e concorrência.

**CI de base:** run [44769285986](https://github.com/Waudz/compendio-5e/actions/runs/44769285986) do commit `959a92e298ab7946f4396a0818e5166951926311` **success**. Commits desta rodada precisam de CI próprio. Sem alterações de Supabase, `main` ou produção.

## Correção de arquitetura — personagem em somente uma campanha ativa

**Decisão posterior do responsável substitui o plano anterior de múltiplos estados de campanha simultâneos.** Uma ficha canônica por personagem, no máximo **uma campanha ativa** por `characterId`; personagens não vinculados continuam pessoais. Campanha, iniciativa, encontros e listagem usam o mesmo `characterId` e estado atual, sem cópias. Participações encerradas podem manter histórico arquivado sem criar ficha ativa paralela. Saída/remover vínculo não apaga personagem. Transferência e regras de continuidade do histórico/inventário ainda exigem especificação antes da migração.

**Ponto de atenção técnico:** `CharacterPointer` em `src/rules/content-registry.ts` ainda reflete o modelo experimental anterior de escopos separados; não o tratar como contrato final. Atualizar para `characterId` canônico + vínculo ativo opcional, com restrição de unicidade no banco, teste de concorrência e políticas de edição do mestre antes de conectar a UI. Sem migração, deploy ou alteração em dados existentes nesta rodada.

## Decisão — personagens mortos preservados e substituição na mesma campanha

O jogador poderá manter um personagem **morto** com ficha e histórico consultáveis na campanha e em Meus Personagens, e criar/vincular **outro personagem** à mesma campanha sem duplicar a identidade anterior. Cada personagem continua limitado a uma campanha ativa por vez, mas uma campanha pode conter vários personagens históricos do mesmo jogador. Morte não é exclusão, e ressurreição reusa o mesmo `characterId`. Lista principal prioriza ativos; histórico/filtros mostram mortos. Inventário, progressão e anotações do falecido não são automaticamente transferidos ao substituto.

**Pendente de confirmação:** limitar a um personagem em atividade por jogador/campanha (recomendado), com troca explícita se houver ressurreição. Modelar separadamente estado narrativo `alive/dead` e participação `active/retired/archived`; validar regras de acesso e persistência antes de implementar. Nenhuma alteração de banco/produção.

## Nova decisão — jogador remove da biblioteca, mestre preserva na campanha

Quando um jogador exclui um personagem em **Meus Personagens**, a exclusão afeta sua **visibilidade/biblioteca pessoal**, não apaga o histórico da campanha. A campanha conserva a ficha histórica consultável e os vínculos de encontros, combates e notas compartilhadas até que o mestre decida removê-la. Morte e exclusão pessoal são estados distintos. Acesso do mestre restringe-se a informações pertencentes ao contexto da campanha, não às notas privadas do jogador.

**Implicação:** ficha canônica enquanto ativa, snapshot/projeção histórica independente de sincronização após remoção pessoal; referências por IDs estáveis; exclusão lógica, tombstones e RLS. Histórico não conta como personagem ativo nem cria duplicação operacional. Política de dados pessoais, retenção, anexos e exclusão definitiva exigem especificação própria antes de migração. Sem código de persistência implementado.

## Nova decisão — personagem sem jogador pode ser transferido ou virar NPC

Ao excluir personagem da biblioteca pessoal, o jogador encerra seu vínculo atual com o personagem; a campanha conserva **o mesmo `characterId`**, ficha, inventário e histórico. O registro mantém histórico de antigos proprietários/controladores, sem expor dados pessoais privados. Mestre pode atribuir o personagem a outro jogador ou convertê-lo em NPC, sem duplicar o registro. `characterRole` (PC/NPC), `controllerType` (jogador/mestre/sem controlador), `lifeStatus` (vivo/morto) e `participationStatus` são dimensões separadas. Mudança de controlador não ressuscita mortos nem altera inventário automaticamente.

**Pendente:** aceite do novo jogador, permissões de edição, direitos de dados, histórico de eventos, política de NPC e migração. Criar contratos e testes antes da persistência. Não há implementação em UI/Supabase.

## Direção de produto — Enciclopédia > Personagens

Criar uma seção **Personagens** na Enciclopédia de cada campanha para reunir NPCs, personagens atuais, mortos e antigos personagens de jogadores. Cada página aponta para o mesmo `characterId` quando existe ficha, com histórico narrativo e de controladores, sem duplicar a ficha. Após exclusão da biblioteca pessoal, a campanha mantém seu registro histórico; o mestre pode administrar o registro, convertê-lo em NPC ou transferir controle. Uma página de NPC secundário não precisa obrigatoriamente de ficha completa.

A visibilidade de cada entrada depende de publicação pelo mestre; informações secretas e notas privadas ficam protegidas. Requisitos para futura integração: referência estável, ficha canônica ou snapshot histórico, páginas narrativas com permissões, pesquisa/filtros e histórico auditável. **Não implementado; nenhum banco ou produção alterados.**

## Implementação incremental — custódia e Enciclopédia (20/11/2026)

Adicionados `src/rules/character-custody.ts` e `src/rules/character-custody.test.ts` ao PR #74. O módulo puro modela `characterId` imutável, `creatorUserId` histórico, `personalLibraryUserId` atual, `campaignId` opcional, `controllerUserId` opcional, papel PC/NPC, vida, arquivamento, versão e histórico de eventos. Operações: entrar na campanha, desvincular biblioteca pessoal, atribuir a outro jogador com aceite, converter órfão em NPC, morrer, ressuscitar e arquivar. Uma entrada enciclopédica é projeção narrativa com visibilidade independente, não ficha duplicada. Testes unitários cobrem fluxo de morte/desvinculação/conversão, impedimento de segunda campanha, autorização, aceite, versão e visibilidade.

**Limitações e próximos passos obrigatórios:** regras ainda são puras, sem UI nem persistência; `acceptedByUserId` é dado de entrada e **não prova aceite autenticado** — exigir token/solicitação confirmada por sessão autenticada no backend. `isCampaignMaster` também deve ser calculado no backend/RLS, nunca confiado ao navegador. O índice único de campanha ativa, transações de atribuição, autorização por RLS, retenção histórica e políticas de dados pessoais devem ser implementados/testados no ambiente isolado antes de qualquer migração em produção. Revisar também se a retirada de biblioteca pessoal sem campanha deve ser exclusão real, e tratar `characterPointerKey` legado de `content-registry.ts` como contrato obsoleto. Nenhuma migração, merge ou publicação autorizada.

## Incremento no criador — ASI 2014 (20/11/2026)

Adicionados `src/rules/ability-improvement.ts` e `src/rules/ability-improvement.test.ts`. O gerador puro oferece **21 opções** por melhoria de atributo (6 opções +2; 15 pares distintos +1/+1), com identificadores estáveis e teto 20 em cada concessão. Testes cobrem cardinalidade, unicidade, opções divididas, teto e entradas inválidas. A implementação é independente da UI e deve ser integrada às escolhas de avanço da classe somente nos níveis em que a classe concede ASI, respeitando exceções e talentos opcionais. Não substituir o catálogo oficial por heurísticas; testar as progressões por classe.

**Verificação:** confirmar status da CI do PR após os commits. Não houve alteração de banco, merge nem publicação. O contrato de custódia continua experimental: aceite de transferência e papel de mestre precisam de validação autenticada no servidor.

## Progressão de ASI por classe — incremento de 20/11/2026

Implementados `src/rules/class-asi-2014.ts` e `src/rules/class-asi-2014.test.ts`, mapeando os níveis de melhoria de atributo das **12 classes básicas de 2014**: padrão 4/8/12/16/19; guerreiro com 6 e 14 extras; ladino com 10 extra. Cada marco gera 21 escolhas com IDs estáveis. Os testes percorrem todos os níveis 1–20 de todas as classes, verificam escolhas pendentes apenas após o nível alcançado, e verificam a opção +1/+1 no nível 6 de guerreiro.

**Integração pendente:** ligar `coreClassAsiAdvancements` ao catálogo real, evitar duplicação com grants existentes, implementar substituição opcional por talentos, validar regras raciais/atributos, fluxos UI e persistência. Não interpretar testes do domínio como E2E. Migrações de banco e publicação continuam fora de escopo até aprovação explícita.

## Decisão aprovada — Compêndio como catálogo canônico de regras (20/11/2026)

**Aprovado explicitamente pelo responsável:** o Compêndio será a **fonte única de definições de conteúdo e regras estruturadas** para criação, progressão, ficha e inventário, em D&D 5e 2014. Não manter cópias independentes de raça, sub-raça, classe, subclasse, antecedente, talento, magia ou item em cada tela. A interface do Compêndio e o criador devem consultar o mesmo catálogo versionado e as mesmas referências estáveis; um motor de regras separado interpreta as definições e calcula a ficha.

**Separação de responsabilidades:**
- Catálogo: identificador estável, fonte/licença, versão, texto de apresentação, opções, pré-requisitos, progressão e efeitos estruturados.
- Motor: validação de escolhas, pré-requisitos e compatibilidade, cálculos e exceções de regras; não duplica a base de dados do Compêndio.
- Personagem: IDs/revisões das escolhas, valores próprios (atributos base, PV atuais, recursos gastos, inventário e anotações privadas); não duplica definições de classe/raça.
- Enciclopédia da campanha > Personagens: projeção narrativa de personagens, **distinta** do catálogo de regras e da ficha canônica.
- Conteúdo adicional: suplementos licenciados e homebrew com proveniência e versão; não misturar regras de 2014 e 2024.

**Integridade:** não alterar silenciosamente personagens quando um registro de regra for corrigido. Usar revisão fixada por personagem e migração explícita/validada. Conteúdo incompleto não pode produzir ficha aparentemente completa: apresentar escolhas pendentes e impedir finalização inválida. Testar concordância entre Compêndio, criador e ficha, níveis 1–20, reabertura, edição e progressão. Não copiar automaticamente textos protegidos de fontes externas.

**Status:** decisão registrada; há protótipos de catálogo, motor e ASI no PR #74, mas **a integração real de telas e banco ainda não foi concluída**. Não autoriza merge, deploy ou migração em produção.

## Catálogo canônico compartilhado — incremento de 20/11/2026

Criados `src/rules/rules-catalogue.ts` e `src/rules/rules-catalogue.test.ts`. Um `RulesCatalogue` associa cada entrada do registro de conteúdo a **exatamente uma definição** de regra, com mesma referência (fonte, tipo, ID, revisão). `resolveRule` atende à consulta do Compêndio; `resolveCharacterRules` atende às referências persistidas na ficha/criador, **sem duplicar definições**. Valida definições ausentes/duplicadas, referências desconhecidas e revisão inexistente, evitando atualização silenciosa. Testes verificam que ambas as consultas retornam a mesma definição e que revisões novas não substituem antigas.

**Escopo atual:** contrato puro e testes; ainda não substitui o catálogo de produção nem alimenta páginas reais. Antes de usar em produção, adicionar esquemas tipados por tipo de conteúdo (evitar `Record<string,unknown>` em runtime), validar licenças, armazenar revisões de forma imutável, tratar migrações explícitas, integrar adaptadores de conteúdo e UI, e testar com fixtures 2014 completas.

## Correção de identidade da ficha — 20/11/2026

Auditoria encontrou divergência entre a decisão aprovada (uma única ficha ativa por `characterId`) e o protótipo `CharacterPointer`, que anteriormente criava chaves diferentes para visões pessoal e campanha. Corrigido em `src/rules/content-registry.ts`: `characterPointerKey({characterId})` aponta para **uma única ficha viva**, independente da visualização. `campaignCharacterSnapshotKey` representa somente um **snapshot histórico imutável**, nunca uma segunda ficha editável. Testes atualizados para impedir regressão.

Ainda não há migração de dados, persistência ou autorização de produção. Antes de integrar, auditar consumidores existentes do ponteiro e garantir que remoção pessoal/transferência não duplique estado nem exponha notas privadas.

## Auditoria crítica e próximos critérios de aceite — 20/11/2026

**Avanço:** funções puras `addInventoryInstance` e `changeInventoryInstanceQuantity` permitem duas instâncias distintas do mesmo item do Compêndio, com IDs estáveis, quantidades/equipamento independentes e validação de duplicatas. IDs devem ser gerados na borda da aplicação/persistência; não são nomes ou slugs. O legado `applyInventoryChange` ainda agrupa itens adquiridos por `itemId` e usa ID determinístico `acquired:<itemId>`: **não usar como caminho definitivo para itens únicos/equipáveis**. Planejar migração e remoção/compatibilidade após integrar UI.

**Críticas de arquitetura a resolver antes de produção:**
1. `CharacterCatalog` ainda usa `raceId/backgroundId/classId` simples e `catalogueVersion` global, em vez de `ContentRef` por escolha. Criar adaptador canônico e persistir revisões de cada definição; evitar duas fontes de verdade.
2. `RuleDefinition.data` é `Record<string,unknown>`: adicionar schemas tipados e validação runtime para cada tipo de conteúdo; rejeitar dados incompletos.
3. Prototipagem ainda não integra telas, API, armazenamento, RLS nem fluxos completos de criação/edição/nível/inventário. CI verde confirma build/testes existentes, não uso real.
4. Transferências/aceites devem ser transacionais e autorizados no servidor; jamais confiar em `isCampaignMaster` ou `acceptedByUserId` enviados pelo cliente.
5. Garantir IDs opacos únicos para instâncias, referências de item versionadas, registro de alterações, políticas de migração, compatibilidade offline e testes E2E.
6. Auditoria de licenças e fontes antes de importar texto de D&D 2014. Não assumir que todo conteúdo de livro é SRD.

**Documentação:** decisões em `DECISOES-E-ARQUITETURA.md`; planejamento e riscos neste documento; auditoria de catálogo em `docs/AUDITORIA-CATALOGO-PERSONAGEM-2014.md`; testes unitários junto aos módulos. Atualizar documentação e testes no mesmo PR a cada mudança substancial. **Nenhum merge/deploy/migração autorizado.**

## Primeiro fluxo vertical por catálogo canônico — 20/11/2026

Implementado `src/rules/character-catalogue-adapter.ts` com teste de integração de domínio `character-catalogue-adapter.test.ts`: resolve referências versionadas de raça, antecedente e classe no mesmo `RulesCatalogue` utilizado pelo Compêndio; exige tipos e IDs coerentes; converte as definições em um catálogo temporário compatível com `createCharacterSheet`, usando chaves compostas `sourceId:kind:id:revision`. O teste monta um anão guerreiro nível 1 a partir dessas definições, confere Constituição/PV, testa renomeação do personagem e bloqueia revisão ausente e classe incompleta.

**Limitação deliberada:** esse é um teste de integração **entre módulos de domínio**, não E2E no navegador nem fluxo de salvamento. O adaptador ainda usa checagem estrutural parcial de grants; substituir por schemas discriminados completos antes de aceitar conteúdo externo. Progressão, escolhas, inventário e persistência serão integrados incrementalmente. Não confundir o exemplo sintético com catálogo oficial completo de 2014.

## Teste integrado de progressão e inventário — 20/11/2026

Acrescentado teste ao `character-catalogue-adapter.test.ts` que usa **as mesmas definições versionadas** para criar um guerreiro anão de nível 1, chegar ao nível 4, detectar a escolha ASI pendente, selecionar +2 em Força e manter duas espadas longas como instâncias independentes (uma equipada, outra com quantidade alterada). Verifica ficha recalculada sem perda de escolhas ou mistura de inventário.

**Não é teste de navegador nem de persistência:** falta UI, salvamento/reabertura e validação runtime discriminada. CI deve ser conferida após o commit do teste; não presumir sucesso.

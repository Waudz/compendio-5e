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

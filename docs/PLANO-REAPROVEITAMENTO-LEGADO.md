# Reaproveitamento do Compêndio 1.0 — plano executável

## Fontes inspecionadas no repositório legado
- `dados/criacao-srd2014.json` (~704 KB): classes, subclasses e características; **não copiar como regras certificadas**.
- `dados/magias.json` (~375 KB): candidato para migração de magias, mediante auditoria de fonte, licença, campos e referências.
- `dados/descricoes-monstros-2014.json` (~110 KB): descrições de monstros; checar licenças e vínculos.
- `js/regras.js` (~29 KB): lista de raças/variantes resumidas, insuficiente para concessões executáveis.
- `js/origens.js` (~9 KB): antecedentes; equipamento referenciado por nome, precisa de IDs estáveis.
- `js/subclasses-2014.js` (~13 KB): oito subclasses adicionais, estrutura distinta da base.
- `js/criador-regras.js` (~46 KB), `js/ficha-criacao.js` (~23 KB), `js/equipamento-ficha.js` (~20 KB): úteis como **referência de fluxos e comportamento**, não para copiar lógica DOM/JS diretamente para React.
- `js/magias-jogo.js`, `js/magias-ui.js`: aproveitar estrutura e terminologia da interface depois de validar dados.

## Decisão
**Reaproveitar dados e conhecimento, não a arquitetura antiga.** Preservar nomes/ícones/imagens somente quando origem e licença permitirem. Migrar cada registro para `ContentRef` versionado e `RuleDefinition`, com auditoria de edição, texto e comportamento. Não transportar armazenamento local, autenticação ou mutações de personagem antigas para o React/Supabase.

## Ordem para entregar uma versão utilizável
1. **Recorte jogável:** quatro raças base (Anão, Elfo, Halfling, Humano), classes e antecedentes básicos auditados; para cada classe, níveis 1–20 e pelo menos subclasse SRD. Iniciar com Guerreiro e Bárbaro, e Acólito.
2. Extrator somente-leitura do JSON legado: inventário de IDs, progressões e referências; gerar relatório de divergências, sem publicar conteúdo.
3. Adaptadores de importação por categoria com validação estrita, proveniência e testes. Manter descrições licenciadas separadas da lógica.
4. Criador React: escolher raça/subraça, classe/subclasse, antecedente, atributos, proficiências, equipamento; aplicar restrições por campanha.
5. Ficha real persistida: escolhas, progressão, PV, recursos, magias e inventário por instância, com controle de versão e autorização no servidor.
6. Expandir conteúdo para demais raças, classes, subclasses, magias e itens; testes de regressão por classe e nível.

## Estimativa de esforço (não é prazo contratado)
Para um **primeiro criador jogável com conteúdo reduzido**: cerca de 2–4 semanas de trabalho concentrado, se não houver bloqueios de dados e integrações. Para **criador e catálogo amplos, auditados, com persistência, permissões e testes**: aproximadamente 6–12 semanas ou mais. A maior incerteza é a auditoria de conteúdo e implementação de escolhas e magias, não o layout.

## Critério de pronto
Não confundir protótipo de domínio e telas `?demo` com funcionalidades completas: pronto exige interface de produção, dados conferidos, criação/edição/reabertura autenticada, validação no servidor, testes de integração e revisão de licenças.

## Estratégia híbrida aprovada — implementação inicial (20/11/2026)

A fonte inicial é a API versionada `https://www.dnd5eapi.co/api/2014`, não o endpoint sem versão; Open5e **V2** fica como fonte complementar com filtragem por documento/licença. Dados do 1.0 servem de referência de tradução e comparação, sem cópia automática. Documentação: https://docs.dnd5eapi.co/introduction e https://open5e.com/api-docs .

Criado `src/rules/srd-2014-import.ts` com `srd2014ResourcePath` e `importReviewedSrd2014`. O adaptador aceita **somente registros marcados como revisados**, cria `ContentRef` estável, rejeita duplicados, IDs malformados e dados não revisados e produz `RulesCatalogue` para o mesmo Compêndio. Os testes usam **fixtures ilustrativas**, não conteúdo importado da API. O campo `reviewed` é um bloqueio operacional, **não uma certificação automática**. O campo de licença é uma advertência e não uma autorização para publicar.

**Próxima etapa:** criar processo de coleta externa controlada com registro de URL, data, hash e licença; auditoria por tipo; validação semântica das concessões e progressões; snapshot local para uso offline. Não existe integração de rede nem publicação de dados reais neste commit.

## Melhorias propostas proativamente — 20/11/2026

- **Pipeline em duas etapas:** `stageSrd2014Record` e `stageSrd2014Batch` recebem payloads da API, verificam identidade, preservam dados brutos e URL/data da origem, geram avisos e sempre marcam `reviewed:false`. Só a etapa posterior `importReviewedSrd2014` admite registros revisados. Isso impede que uma mudança silenciosa na API altere fichas existentes.
- **Snapshots versionados e offline:** congelar conjuntos aprovados em arquivos locais; evitar buscar dados ao abrir ficha. Registrar hash e atribuição na próxima etapa.
- **Recorte vertical antes de cobertura total:** entregar um personagem Guerreiro nível 1–4 do começo ao fim, com raça, antecedente, ficha e inventário persistidos, antes de tentar todas as subclasses.
- **Contratos automatizados por fonte:** testes para mudança de formato da API e diferenças 2014/2024; avisar em vez de aceitar conteúdo incompatível.
- **Tradução desacoplada:** manter nome original e localização PT-BR separados da identidade; revisões de tradução não devem invalidar fichas.
- **Segurança por servidor:** autorizações de mestre e validação de opções bloqueadas precisam ser conferidas no backend, nunca confiar no booleano fornecido pelo navegador.
- **Auditoria de licenças:** não pressupor que todo texto de uma API ou do legado pode ser republicado; atribuição e licença por fonte/entrada.

A etapa de staging é **somente uma função pura e testes**; ainda não há coletor HTTP, snapshot real, revisão de licenças nem integração ao app publicado.

## Implementação de tradução independente (20/11/2026)

`src/rules/catalogue-localization.ts` implementa `localizeCatalogue`: aplica nomes e descrições traduzidos a um **novo** objeto de catálogo, preservando `ContentRef`, revisões, dados mecânicos e catálogo original. Traduções inexistentes usam o idioma original. Traduções duplicadas, vazias ou sem registro correspondente são rejeitadas. `searchCompendium` usa o objeto localizado sem mudanças, permitindo pesquisa em português. Testes em `catalogue-localization.test.ts`. Ainda não há arquivo de traduções reais, interface de idioma nem importação de API.

## Gate editorial (20/11/2026)

Implementados `approveStagedSrd2014` e `reviewedRecordsForImport` com testes. Um registro staged só pode receber aprovação explícita após resolver todos os avisos e registrar responsável, data, licença verificada, confirmação de regras 2014 e direito de redistribuição. Dados são copiados para impedir alterações acidentais na fonte. **A confirmação é uma declaração editorial**, não verificação jurídica automatizada; uma aplicação de produção precisará de autenticação e trilha de auditoria no servidor. Ainda não foi aprovado/importado nenhum registro real.

## Coletor controlado de API (20/11/2026)

Criados `src/rules/srd-2014-collector.ts` e testes. `collectSrd2014Collection` recebe um cliente HTTP injetável, lê o índice da coleção em `/api/2014`, exige contagem completa, índices únicos e válidos, busca detalhes sequencialmente e devolve registros **staged não aprovados**, com URL e data de origem. Falha integralmente em caso de resposta incompleta, identidade inválida ou HTTP malsucedido. Nenhuma busca ocorre ao importar o módulo ou abrir fichas. Testes usam HTTP simulado. **Ainda não foi feita coleta externa real**, nem foi gerado snapshot ou publicado catálogo.

## Snapshot offline (20/11/2026)

Implementados `createOfflineCatalogueSnapshot` e `readOfflineCatalogueSnapshot`, com testes de serialização JSON, pesquisa no Compêndio, revisão, procedência, índice e isolamento de mutações. O formato é versionado e rejeita catálogo incompleto ou inconsistência entre revisão e IDs. O índice **não é um hash criptográfico** e não detecta adulterações em descrições/dados mecânicos: assinatura ou hash verificado de artefatos aprovados continua pendente. Os testes utilizam apenas o catálogo fictício do piloto. Não há snapshot de API real nem mudança no aplicativo publicado.

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

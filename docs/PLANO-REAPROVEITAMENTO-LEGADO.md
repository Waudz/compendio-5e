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

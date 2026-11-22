# Expansão do criador e fichas 2014 — 22/11/2026

## Base e limites de responsabilidade
Branch `feat/character-2014`, main `f258172` (PR #82). Não altera autenticação, arquitetura de campanhas, navegação global, catálogo geral ou migrations. Modifica somente domínio de personagem, criador/ficha, lista e API de fichas, testes e documentação.

## Auditoria da base
- Editor fixava Guerreiro/Anão/Acólito e níveis 1–6, embora o motor já aceitasse tabelas 1–20.
- Campos raciais/origem eram amostras; proficiências, grimório, preparo, slots, perícias de origem e equipamento por categoria não estavam integrados.
- Itens canônicos, point buy de 27, matriz padrão, escolhas de Guerreiro, recursos, inventário e guarda de alterações já existiam: reaproveitados.
- Servidor já usa `character_sheets`, RPCs com revisão otimista e identidade pública separada. Não criar outro sistema de persistência.
- Compêndio 1.0 contém 12 classes/20 níveis, 12 subclasses SRD, 407 características e receitas. Outras entradas do legado misturam suplementos ou não têm auditoria/licença suficiente: não importadas.

## Dados e fontes
Snapshot isolado de personagens em `src/criador/data/character-2014.json`, com hash em `manifest.json` e atribuições/MIT em `LICENCAS.md`. Mecânicas/descrições de classe, subclasse e receitas reaproveitadas de `dados/criacao-srd2014.json` do legado. Nomes/traduções de magias reaproveitados de `dados/magias.json`, limitados por interseção com os 319 IDs da coleção **2014** de 5e-bits. Raças, subraças e traços vêm da mesma coleção 2014. Fonte normativa: [SRD 5.1 CC BY 4.0](https://media.wizards.com/2023/downloads/dnd/SRD_CC_v5.1.pdf). Não é importação de conteúdo 2024, nem do PHB completo. Não publica dados no catálogo geral.

### Correções verificadas do legado
- `rageCount=9999` no Bárbaro 20 é tratado como ilimitado (`maximum=null`), não 9999 usos.
- Sorte do Próprio Obscuro: o legado usava modificador de Carisma como quantidade; corrigido para um uso por descanso curto/longo, conforme SRD.
- Restauração Feiticeira: removido do snapshot o teto incorreto de um uso por descanso longo; o SRD restaura quatro pontos a cada descanso curto.
- ASIs são aplicadas antes de Campeão Primitivo elevar Força/Constituição e seus tetos no nível 20.
- Pré-requisitos estruturados de invocações, magia preparada por atributo final e perícias de origem passam a ser validados; magias raciais não retiram a possibilidade de aprender a magia pela classe.

## Funcionalidades
- Ativação explícita de regras versionadas: mantém nome, atributos, inventário e moedas; reinício de escolhas confirmado pelo usuário. Fichas antigas continuam sendo lidas pelo catálogo original, sem migração automática ou regravação.
- Doze classes, uma subclasse SRD por classe, seleção nos níveis próprios e tabelas 1–20; escolhas, perícias, ferramentas, expertise, estilos, melhorias de atributos e pré-requisitos estruturados de invocações.
- Nove opções raciais SRD com suas subraças publicadas; bônus, habilidades e idiomas da fonte. Traços mantêm descrição, não apenas o nome.
- Acólito e origem personalizada conforme o SRD: perícias/idiomas/ferramentas, característica própria, pacote de origem e 15 po idempotentes. Pacotes fora do Acólito precisam de fonte autorizada adicional e acordo com o mestre.
- Point buy/matriz existentes reaproveitados; rolagens manuais 3–18 e método preservado para valores antigos, sem coerção nem erro de compra de pontos. Bônus raciais, ASI e teto do Campeão Primitivo na ordem correta; PV e dados de vida pelo motor existente.
- 319 magias: truques, conhecidas, preparo, grimório por nível (seis iniciais + duas/nível), domínio/juramento e magia racial, lista expandida do Corruptor, slots e recursos. Não transforma lista expandida em magia conhecida gratuita.
- Equipamentos iniciais por classe com escolhas de categorias, quantidades e expansão de pacotes usando os IDs atuais; nunca substitui inventário adquirido nem concede outro conjunto após consumo.
- Moedas, itens de origem personalizados na ficha, equipar, CA, perícias, salvaguardas, percepção passiva, deslocamento, ataques básicos, CD/ataque de magia e recursos/dados de vida. Gasto de dado de vida separado da cura física/manual.
- Condições de combate (fúria ativa, dano situacional, crítico, ações, transformações e interpretação da característica narrativa) permanecem descritas; não são aplicadas como bônus permanentes indevidos.

## Persistência e preservação
As escolhas/recursos/moedas são dados do `draft`, gravados pelas RPCs existentes, sem novo schema. O snapshot não é salvo em cada ficha. Ficha exige campanha ativa; repositório recusa carregar outra campanha, mesmo se o usuário puder acessar ambas. RLS, funções de segurança e migrations intactas.

**Verificação remota somente leitura em 22/11:** projeto `gwcttjlxzelzjhbuitmi` (`compendio-5e`); histórico inclui `character_sheets_persistencia_0008` em `20261121075413`. As RPCs `create_guided_character` e `save_guided_character` existem com `security_definer=false`; `character_sheets` tem RLS habilitada. Os comentários antigos que dizem “0008 não aplicada” são históricos. Não reexecutar SQL com base neles. Nenhum dado de usuário lido/gravado e nenhuma migração aplicada por esta tarefa. Testes de gravação/reabertura/conflito usam a API de servidor em memória; testes SQL existentes usam PGlite isolado. Não alegar teste de login/gravação com conta real.

## Verificação e pendências
Comandos: `npm run test:e2e:types`, `npm run build`, `npm test`, `npm run test:creator`, `npm run test:quality` e `npm run test:e2e`. No Windows restrito, build/Vitest com `--configLoader runner`; navegador no CI Linux.

Testes novos cobrem tabelas 12×20, bônus raciais/ASI, duplicação de perícia, expertise, referências de equipamento, grimório por nível, preparo/domínios, requisitos, origem idempotente e persistência por campanha/revisão. E2E novo cria Maga, distribui atributos/escolhas, prepara grimório, confirma equipamentos, salva/reabre e valida Bárbaro 20, reabre atributos antigos/rolados sem mudar o registro, axe e oito larguras. Resultados reais serão registrados no PR, sem confundir enumeração de casos com aprovação.

**Limites de cobertura:** não é catálogo completo de todas as publicações de 2014. Subclasses/raças/antecedentes não SRD, multiclasse, talentos opcionais, troca de magias aprendidas em níveis anteriores, automação de efeitos contextuais e personagens legados de ficha simples não ganham conversão automática. Regras descritivas e traduções reaproveitadas ainda precisam de revisão editorial independente; a bateria de integridade 12×20 não certifica sozinha todos os efeitos do livro. Não rotular cobertura do PHB como concluída.

### Regressões encontradas durante a implementação
Primeira execução E2E: 24 falhas no criador (16 na ativação sem nome, oito na ordem de foco Nome → Método), 56 aprovados; suíte de qualidade 80 aprovados/32 não aplicáveis. Corrigidos o cálculo de prévia sem nome (o salvamento continua exigindo nome) e a posição dos controles opcionais para preservar o Tab do fluxo existente. Novo fluxo valida Nome → Classe; nova regressão unitária mantém o nome vazio no rascunho, sem inventar um nome persistido. Também incluída reabertura de atributos antigos/rolados sem coerção. Resultados finais vinculados ao SHA e CI do PR.

### Validação integrada — árvore 11d9694
[Workflow padrão](https://github.com/Waudz/compendio-5e/actions/runs/44990048013) e [E2E Linux](https://github.com/Waudz/compendio-5e/actions/runs/44990048009) aprovados. Fluxos novos executados nas oito larguras, com criação completa da Maga, inventário/moedas e reabertura, Bárbaro 20 e preservação dos atributos antigos. Verificações adicionais independentes das tabelas de dados de vida, PV, espaços, recursos, salvaguardas, ataques e movimento acrescentadas em seguida; o SHA e os resultados finais são registrados no PR #86. Nenhuma exceção axe, retry ou skip novo. Os 32 casos não aplicáveis de layout são herdados da suíte anterior.


### Complementos de progressão e preservação
PV podem usar média fixa ou resultados físicos informados por nível, com confirmação explícita (médias provisórias não contam como rolagens concluídas). Reduzir/subir o nível e alternar o método recuperam resultados confirmados. Magias mostram descrição antes da seleção. A ativação de uma ficha antiga mantém uma cópia privada exata do rascunho anterior em `previousRulesDraft`, além de preservar inventário, nome e atributos ativos; não há migração em massa nem alteração de identidade pública. A cópia não é recursiva e continua sujeita ao limite existente de tamanho do draft. Troca explícita de classe reinicia sua progressão de PV com aviso. Sentido Divino respeita 1 + modificador de Carisma (mínimo efetivo zero), sem o mínimo de um não previsto na descrição.


### Responsividade do painel interno
A inspeção das capturas de 320 px encontrou corte lateral no inventário: a largura do documento continuava correta, mas a subnavegação do criador podia alargar o scroll container mobile. Corrigido exclusivamente no CSS do criador com quebra de suas seções/controles e mínimo inline de fieldsets. Acrescentada asserção dos retângulos reais de todos os controles, fieldsets, navegação e itens do criador, incluindo margens negativas; a asserção anterior apenas do documento é mantida.


### Resultado final da implementação funcional — 8009394
A main avançou durante o trabalho; incorporados integralmente os PRs #83 e #85 (main `878914d`), sem conflitos. Código de campanhas, autenticação, navegação global, catálogo geral e migrations permanece idêntico à main recebida.

- [CI TypeScript/build/unitários](https://github.com/Waudz/compendio-5e/actions/runs/44991838934): **85 arquivos / 1.124 testes aprovados**, zero falhas.
- [CI Playwright Linux](https://github.com/Waudz/compendio-5e/actions/runs/44991838856): **36 básicos + 88 criador + 80 qualidade = 204 aprovados**, zero falhas; 32 casos de layout condicionais herdados não aplicáveis. Oito larguras: 320, 360, 390, 700, 701, 768, 1024 e 1440 px.
- Artefato `14741414466`: analisados os relatórios HTML/JSON, **72 varreduras axe, zero violações**. Capturas do inventário inspecionadas em 320, 701 e 1440 px; corte lateral corrigido. [Baixar evidências pelo GitHub Actions](https://github.com/Waudz/compendio-5e/actions/runs/44991838856/artifacts/14741414466) (retenção até 29/11/2026).
- 287 verificações específicas acrescentadas de regras, atributos e persistência; a enumeração de 12×20 níveis é complementada por valores esperados independentes de PV/dados de vida, recursos, espaços, movimento, ataques e salvaguardas.
- Snapshot confere com SHA-256 do manifest. Origem legada fixada em `Waudz/rastreador-dnd@6086b360a7522d54a3cce3c40fcff7a7e20d4507`.
- Build aprovado com avisos de chunks acima de 500 kB e anotações de dependências; dados novos são carregados sob demanda. Não foi executado login/gravação com contas reais; segurança/persistência verificadas em ambiente isolado e metadados remotos somente leitura.

O commit seguinte registra apenas documentação, evidências e correção da referência da fonte no manifest, sem alterar código funcional ou snapshot. Riscos de integração: seleção de campanha e identidade são compartilhadas por outras frentes; manter os testes de campanha/RLS e executar uma rodada com duas sessões sintéticas em Supabase local antes de liberar sincronização para usuários. Os limites de conteúdo e automação acima continuam pendentes; não apresentar como PHB completo.


### Regressão adicional da auditoria de recursos
Forma Selvagem passa a ser ilimitada no Druida 20 (Arquidruida); níveis 2–19 mantêm dois usos. Teste explícito compara 19 e 20 e os estados `maximum/remaining=null`. A validação 8009394 acima precede esta correção; o CI final do PR registra o novo SHA e total de 1.125 unitários se aprovados.


### Integração do catálogo publicado durante esta rodada
Incorporado integralmente o PR #84, main `e97199f`, sem editar os seus módulos/dados. Resolvidos somente conflitos de acréscimos no README e decisões, mantendo ambos os textos; decisão do criador renumerada DEC-019. Os IDs dos itens seguem os mesmos contratos. Novo teste usa `todasAsMagias/itemPorId` públicos para conferir todos os 319 IDs/círculos/listas de classe do snapshot versionado. Cinco divergências de listas herdadas de 5e-bits foram reconciliadas com a auditoria SRD do catálogo: Fogo das Fadas também Bardo; Criar Alimentos não Druida; Mesclar-se às Rochas também Druida; Olho Arcano só Mago; Adivinhação Clérigo. O snapshot privado permanece versionado para preservar fichas, sem publicar catálogo concorrente. Hash e correção registrados no manifest. CI anterior acima corresponde à base antes do PR #84; os resultados integrados finais ficam no PR #86.

> Pedido vigente do responsável, recebido em 28/11/2026. Prevalece sobre decisões anteriores incompatíveis: **formulário direto, sem acordeões**, 0023 já aplicada, PRs #171/#172/#173 integrados. Limitar preferencialmente a **dois PRs**: identidades/relacionamentos/seleção no primeiro; fichas/consultas/inventário/combate no segundo. Commits organizam o progresso dentro de cada branch. CI completo somente ao finalizar cada conjunto; testes direcionados durante o trabalho. Anotações permanece fora do escopo até concluir estas funcionalidades.

# Compêndio 5e 2.0 — Reformulação das fichas, identidades e Compêndio

Continue autonomamente o desenvolvimento do Compêndio 5e 2.0 Alpha.

## 1. Contexto e estado atual

- Repositório: `Waudz/compendio-5e`
- Produção: https://waudz.github.io/compendio-5e/
- Supabase: `gwcttjlxzelzjhbuitmi`
- Prazo para conclusão do desenvolvimento das funcionalidades: 05/12/2026.
- Prazo para lançamento do Compêndio 2.0: 12/12/2026.
- O cadastro está aberto e existem usuários externos testando o sistema.

Os PRs #172 e #173 foram integrados à main.

A última alteração foi iniciada pelo ChatGPT:

- Branch: `fix/compendio-identidade-simplificada`
- Commit: `9e398add55b523052c02c155ba0ab1dd9f0c0570`
- Arquivo alterado: `src/compendio/campos.ts`

Esse commit simplifica parcialmente os campos narrativos de NPCs, locais e organizações e adiciona uma lista selecionável de tipos de locais. Ainda não foi testado.

Consulte a branch, a main e a documentação de continuidade antes de prosseguir. Aproveite o trabalho existente, corrigindo-o quando necessário.

A migração 0023 já foi aplicada em produção. Existem documentos desatualizados que ainda a descrevem como pendente. Corrija essa informação.

## 2. Diretrizes de desenvolvimento

Quero velocidade e entregas concretas. Não quero horas de auditorias, centenas de testes redundantes ou refinamentos pequenos que atrasem o projeto.

- Reutilize componentes, funções, estilos e estruturas existentes.
- Agrupe alterações relacionadas.
- Execute testes direcionados aos comportamentos modificados.
- Utilize o CI obrigatório do GitHub para a validação abrangente.
- Não repita suítes completas localmente sem necessidade.
- Não implemente funcionalidades que não foram solicitadas.
- Preserve os dados, IDs, fichas, inventários, campanhas e permissões existentes.
- Não aplique novas migrações em produção sem minha autorização.
- Não altere o Compêndio 1.0 nem o Assimilação.
- Tome decisões técnicas autonomamente, perguntando apenas quando houver uma decisão funcional importante ou risco real aos dados.

## 3. Simplificação da identidade de aventureiros e NPCs

Utilize o mesmo padrão de identidade para aventureiros e NPCs, respeitando as permissões e a existência de ficha técnica.

### Campos mantidos

- Retrato.
- Nome.
- Alcunha.
- Raça.
- Ocupação.
- Estado.
- Naturalidade.
- Residência.
- Descrição.
- História.
- Vínculos.
- Observações privadas do mestre.

Classe, nível e antecedente devem ser obtidos automaticamente da ficha técnica quando existirem, sem duplicar o preenchimento.

Apenas o nome é obrigatório na criação de registros narrativos.

### Campos removidos da interface

- Gênero.
- Idade.
- Altura.
- Peso.
- Tendência, exceto para monstros.
- Descrição física separada.
- Traços de personalidade.
- Ideais.
- Defeitos.
- Objetivos.
- Segredos como campo independente.
- Campos redundantes de personalidade e relacionamentos.

A aparência, personalidade, motivações e demais características podem ser escritas livremente na descrição.

Os segredos do mestre passam a integrar as observações privadas. Não transfira automaticamente informações privadas de jogadores para observações acessíveis ao mestre.

Preserve os vínculos pessoais existentes e diferencie-os dos relacionamentos estruturados do Compêndio, sem exigir preenchimento duplicado.

Não apague os dados antigos dos campos removidos. Preserve-os de maneira não destrutiva e não exponha informações anteriormente privadas.

Renomeie Estado vital para Estado, mantendo Vivo, Morto e Desconhecido. Não exiba constantemente o estado Vivo na consulta.

### Formulário

IMPORTANTE: não quero seções expansíveis, acordeões, formulários escondidos, menus aninhados ou uma etapa de informações adicionais.

O modelo aprovado é um formulário direto:

- Retrato.
- Nome e alcunha.
- Raça e ocupação lado a lado.
- Naturalidade e residência lado a lado.
- Estado.
- Descrição em largura total.
- História em largura total.
- Vínculos com botão Adicionar.
- Observações privadas em largura total.
- Cancelar e Salvar.

No desktop, utilize duas colunas para campos curtos. No celular, adapte conforme o espaço disponível.

Mantenha as ações de salvar e cancelar acessíveis durante a rolagem.

Não mostre campos vazios na visualização de consulta.

NPCs podem ser criados sem ficha técnica e receber uma posteriormente. Não force a abertura do gerenciamento de ficha após criar um NPC.

## 4. Locais

Campos:

- Imagem.
- Nome.
- Nome alternativo.
- Tipo de local.
- Local superior.
- Descrição.
- História.
- Vínculos.
- Observações privadas do mestre.

Habitantes, estabelecimentos, organizações e outros locais relacionados devem ser derivados dos vínculos existentes.

Não criar campos específicos para população, economia, governo, clima, infraestrutura ou religião.

### Tipos de locais

Utilize um seletor com tipos como:

- Plano, mundo, continente, região, reino e ilha.
- Floresta, montanha, rio, lago, deserto e caverna.
- Cidade, vila, aldeia e povoado.
- Bairro, distrito, rua e praça.
- Taverna, bar, hospedaria, loja e oficina.
- Castelo, fortaleza, torre, templo e residência.
- Ruína, masmorra, acampamento e esconderijo.
- Outro.

O tipo selecionado determina os relacionamentos disponíveis, sem transformar o formulário em várias telas diferentes.

Exemplo de hierarquia:

Faerûn → Costa da Espada → Valebruma → Taverna da Névoa.

Ao vincular a taverna à vila, a taverna aparece automaticamente entre os locais pertencentes à vila.

Impeça relações circulares e hierarquias incompatíveis.

Não exija cadastrar toda a hierarquia antes de criar um local.

### Relacionamentos contextuais

- Região: assentamentos, locais naturais e organizações.
- Cidade ou vila: habitantes, governantes, estabelecimentos e organizações.
- Bar ou taverna: proprietários, funcionários e frequentadores.
- Residência: moradores e proprietários.
- Templo: responsáveis, membros e frequentadores.
- Outros: relacionamentos pertinentes ao tipo.

Naturalidade deve permitir cidades, vilas, regiões e locais naturais compatíveis, mas não bares ou estabelecimentos comerciais.

Residência deve ser mais flexível, pois um personagem pode morar em uma taverna, templo ou caverna.

Naturalidade e residência devem permitir selecionar registros existentes ou utilizar texto livre.

## 5. Organizações

Campos:

- Imagem ou símbolo.
- Nome.
- Nome alternativo.
- Tipo de organização.
- Sede vinculada a um local.
- Descrição.
- História.
- Membros.
- Vínculos.
- Observações privadas do mestre.

Remova os campos separados de liderança, quantidade de membros e objetivos.

A quantidade de membros deve ser derivada dos vínculos.

Liderança faz parte de Membros. Não crie uma seção separada.

Exemplo:

Guarda de Daggerford:

- Sabine — Capitã da guarda.
- Aldric — Guarda.
- Dain — Tesoureiro.
- Thoren — Sargento.

Todos possuem relacionamento Membro, com cargo ou função opcional.

Não implemente organogramas, hierarquias militares, níveis de autoridade ou sistemas complexos de cargos.

## 6. Relacionamentos bidirecionais

Este é um dos pontos mais importantes da reformulação.

Utilize uma estrutura compartilhada de relacionamentos contendo:

- Registro relacionado.
- Tipo de relacionamento.
- Cargo ou função opcional, quando pertinente.

O cargo é texto livre. Não precisamos cadastrar todos os cargos possíveis do universo de fantasia.

Exemplos:

- Membro — Capitã da guarda.
- Membro — Tesoureiro.
- Governante — Duquesa.
- Funcionário — Cozinheira.
- Proprietário — Taverneiro.

Se eu cadastrar um NPC como proprietário de um bar, essa informação deve aparecer automaticamente na identidade do NPC.

Se eu editar ou remover o vínculo por qualquer um dos lados, ambos devem refletir a alteração.

Exemplos de relações inversas:

- Reside em ↔ Habitante.
- Naturalidade ↔ Natural do local.
- Local superior ↔ Contém.
- Trabalha em ↔ Funcionário.
- Proprietário de ↔ Proprietário.
- Frequenta ↔ Frequentador.
- Integra ↔ Membro.
- Governa ↔ Governante.
- Sede de ↔ Sede.
- Aliado ↔ Aliado.
- Inimigo ↔ Inimigo.

Utilize uma fonte de verdade para cada relacionamento. Não mantenha duas informações independentes que possam ficar inconsistentes.

Permita múltiplos relacionamentos com o mesmo registro, agrupando-os visualmente.

Exemplo:

Valebruma
Residência · Naturalidade

Não mostrar duas linhas idênticas para Valebruma.

Não deduza relações que não foram cadastradas. Trabalhar em um estabelecimento não significa morar nele.

Respeite a visibilidade de registros, cargos e relacionamentos. Um personagem pode ser conhecido como guarda, mas secretamente integrar um culto.

Utilize as permissões existentes sempre que possível.

### Persistência e segurança

Corrija a pendência em que a naturalidade e residência dos aventureiros são gravadas apenas na ficha privada, sem aparecer corretamente nos registros relacionados.

O jogador deve conseguir editar os vínculos autorizados da própria identidade sem receber permissões indevidas sobre outros registros.

Reutilize a infraestrutura de edição atômica da migração 0023 quando pertinente.

Criar ou editar registros com vínculos deve ser uma operação consistente. Cancelar não deve gravar vínculos, e falhas não devem deixar registros parcialmente atualizados.

## 7. Bestiário

Simplifique a parte narrativa dos monstros.

Mantenha:

- Nome.
- Retrato.
- Tipo de criatura.
- Tamanho.
- Tendência.
- Ambientes.
- Descrição.
- Vínculos.
- Observações privadas do mestre.
- Fontes e licenças.

Não criar campos narrativos separados para alimentação, comportamento, aparência, estratégias, avistamentos e outras informações que podem integrar a descrição.

Preserve informações originais do catálogo e atribuições obrigatórias.

As estatísticas ficam na ficha técnica. Ataques, ações e habilidades ficam na aba Habilidades.

Os jogadores continuam sujeitos aos níveis de conhecimento do Bestiário já implementados. Não exponha estatísticas ou informações ocultas sem autorização.

Os cartões do Bestiário devem apresentar tipo, tamanho e ND, tanto na lista quanto na grade, sem exibir PV e CA no catálogo.

## 8. Unificação das fichas e consultas

O mesmo componente deve ser utilizado em pop-ups e páginas completas, evitando implementações duplicadas.

### Cabeçalho

Aplicar a aventureiros, NPCs e monstros:

- Retrato único, com bom destaque.
- Retrato clicável para ampliar.
- Nome e informações básicas ao lado.
- Botão Editar e menu de reticências no canto superior direito.
- Não colocar ações abaixo do nome ocupando espaço desnecessário.
- No celular, adaptar os botões ao espaço disponível.
- Não repetir retrato ou cabeçalho dentro das abas Identidade e Bestiário.
- Manter a mesma largura e alinhamento ao trocar de aba.

### Abas

Aventureiro e NPC com ficha:

Ficha | Habilidades | Inventário | Identidade

NPC sem ficha:

Identidade

Monstro do Bestiário:

Ficha | Habilidades | Bestiário

Locais e organizações:

Consulta narrativa sem barra de abas desnecessária.

Quando existir apenas uma aba disponível, não mostrar a barra de abas.

### Mestre e jogador

A visualização deve ter a mesma estrutura visual para ambos, mudando apenas as informações autorizadas.

- Mestre: acesso completo.
- Jogador proprietário: acesso à própria ficha.
- Outros jogadores: identidade autorizada.
- Monstros: informações liberadas conforme conhecimento.
- Observações privadas do mestre nunca são enviadas aos jogadores.

Não basta esconder informações confidenciais com CSS. Preserve a proteção no servidor e nas políticas de acesso.

### Pop-ups

- Consultas do Compêndio abrem primeiro em pop-up.
- Permitir maximizar para a página completa.
- Preservar a aba interna selecionada ao maximizar.
- Fechar retorna à lista mantendo filtros e rolagem.
- Evitar abas duplicadas.
- Respeitar o limite de dois grupos no desktop.
- Não perder alterações não salvas ao fechar ou maximizar.

## 9. Recuperar funcionalidades úteis das fichas do Compêndio 1.0

A ficha de monstros do 1.0 tinha uma apresentação funcional melhor em alguns pontos.

Consulte o código existente do 1.0 como referência, sem modificar aquela versão.

Recupere ou adapte:

- Modificadores de atributos com destaque visual.
- Valor do atributo em posição secundária.
- Barra visual de PV.
- Cartões individuais de ataques.
- Botões de rolagem de acerto e dano.
- Melhor hierarquia visual das informações de combate.

Preserve a organização, tradução e identidade visual do 2.0.

Não copie erros antigos de cálculo.

Por exemplo, um ataque que causa 1d6+1 com uma mão ou 1d8+1 com duas mãos possui duas alternativas de dano, não uma soma dos dois valores.

Utilize componentes compartilhados para ataques de aventureiros, NPCs, monstros e consultas durante o combate.

Traduza rótulos em inglês que ainda aparecem indevidamente, preservando o texto original quando necessário.

## 10. NPCs com ficha técnica

NPCs com ficha de criatura devem ter acesso direto à edição, assim como aventureiros.

O botão Editar deve atuar sobre o conteúdo pertinente à aba atual.

Gerenciar ficha deve servir para adicionar, substituir ou remover a ficha técnica, não ser o único caminho para editar o NPC.

Remova atalhos redundantes quando a mesma informação já está disponível nas abas.

### Substituição de ficha

Atualmente, o usuário precisa marcar uma confirmação antes de conseguir escolher outra ficha. Isso gera a impressão de que os botões estão quebrados.

Altere o fluxo:

1. Escolher o novo modelo.
2. Configurar ou visualizar a ficha.
3. Confirmar a substituição no final.

Opções:

- Modelo do Bestiário.
- Criatura personalizada.
- Ficha de personagem.

Cancelar ou falhar não pode alterar a ficha anterior.

Preserve identidade, retrato, história, vínculos e inventário.

### Inventário

Todos os NPCs com ficha devem possuir inventário, inclusive aqueles baseados em criaturas.

Reutilize o inventário existente sempre que possível.

- Adicionar, editar e remover itens.
- Moedas.
- Equipamentos.
- Transferências.
- Integração com loot.

O inventário do NPC é independente do modelo original do Bestiário.

Ao coletar loot de um NPC persistente, os itens devem sair do inventário correspondente, sem duplicação.

NPC sem ficha permanece apenas como registro narrativo.

## 11. Página Personagens

Corrigir os problemas encontrados nos testes manuais:

- NPCs não podem ser selecionados atualmente na seleção múltipla.
- Existe espaço vertical excessivo na barra de seleção.
- Integrar a seleção à mesma linha das ferramentas de lista e grade.
- Permitir selecionar aventureiros e NPCs simultaneamente.
- Selecionar todos deve respeitar o filtro atual.
- Exclusão múltipla deve respeitar o ciclo de vida e as permissões de cada tipo de personagem.
- Não utilizar indiscriminadamente a operação de exclusão de aventureiros para NPCs.

Nos cartões operacionais, apresentar:

- Retrato quadrado.
- Nome.
- Alcunha.
- Classe e nível, quando aplicável.
- PV atual e máximo com barra visual.
- Condições relevantes.
- Jogador responsável, quando aplicável.

Nos cartões narrativos do Compêndio, não mostrar PV ou condições de combate.

Evite informações duplicadas, textos cortados desnecessariamente e gradientes pesados em cartões sem imagem.

## 12. Navegação e menus

Padronize os menus de ações e consultas.

- Clique normal abre a consulta correspondente.
- Menu contextual e reticências compartilham as mesmas ações pertinentes.
- Abrir em outra aba e outro grupo apenas no desktop.
- No celular, não mostrar opções de grupos ou abas internas.
- Não criar submenus desnecessários.
- Remover ícones redundantes de ficha.
- Não abrir várias abas automaticamente após salvar registros.
- Preservar o histórico de navegação.

## 13. Ordem de implementação

### Etapa 1 — Identidades e relacionamentos

- Aproveitar a branch existente.
- Simplificar os formulários.
- Corrigir naturalidade e residência.
- Implementar tipos de locais.
- Implementar cargos nos vínculos.
- Garantir sincronização bidirecional.
- Corrigir seleção múltipla de NPCs.

### Etapa 2 — Fichas e consultas

- Unificar cabeçalhos e retratos.
- Padronizar mestre e jogador.
- Corrigir edição de NPCs.
- Simplificar Bestiário.
- Recuperar funcionalidades úteis das fichas do 1.0.
- Corrigir navegação e pop-ups.

### Etapa 3 — Inventário e combate

- Inventário de NPCs.
- Ataques e rolagens compartilhados.
- Substituição de fichas.
- Integração com loot, iniciativa e encontros.

Não iniciar a reformulação de Anotações antes de concluir essas etapas.

A documentação `docs/ANOTACOES-BETA-HANDOFF.md` deve continuar preservada para a próxima fase.

## 14. Validação e publicação

Priorize testes direcionados para:

- Criação e edição de registros.
- Persistência e cancelamento.
- Vínculos bidirecionais.
- Hierarquia de locais.
- Permissões de mestre e jogador.
- Preservação de dados antigos.
- Inventário e loot sem duplicação.
- Rolagens de ataques.
- Navegação desktop e mobile.

Execute verificação de tipos e build.

Não crie dezenas de testes que verificam essencialmente o mesmo comportamento.

Abra PRs coerentes por etapa e utilize os workflows existentes. Não deixe branches ou alterações importantes sem documentação.

Se uma etapa depender de migração, prepare a migração, valide-a em ambiente isolado e informe exatamente o que precisa ser aplicado em produção.

Não aplique migrações em produção sem autorização.

Integre as alterações aprovadas quando estiverem estáveis, com os checks obrigatórios aprovados e sem dependência de migração de produção pendente.

Atualize a documentação de continuidade e o README quando pertinente.

## 15. Resultado esperado

Quero um Compêndio mais simples de utilizar, mais consistente visualmente e mais fácil de manter.

O mestre deve conseguir criar um NPC, local ou organização rapidamente, escrever uma descrição livre e estabelecer relacionamentos sem preencher dezenas de campos.

A complexidade deve ficar na sincronização, segurança e persistência, não na interface.

Não responda apenas com outro planejamento. Comece a implementação imediatamente, aproveitando o trabalho existente.

Ao concluir cada etapa, informe objetivamente:

- O que foi implementado.
- PRs e commits.
- Testes e situação do CI.
- Migrações necessárias.
- Pendências reais.
- Próxima etapa.

Continue autonomamente enquanto houver trabalho dentro do escopo aprovado.
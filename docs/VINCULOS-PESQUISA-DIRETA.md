# Pesquisa direta de vínculos — Alpha

Fatia de interface dependente da revisão de navegação (#161), sem nova migração.
O seletor deixa de esconder os resultados dentro de um select: mostra nome, categoria
e miniatura autorizada, com seleção explícita do destino. Pesquisa por nome e categoria
sem distinção de acentos/caixa. A seleção permanece identificada quando o termo muda
e pode ser limpa; falha de consulta é diferente de nenhum resultado.

Reutiliza as mesmas linhas e imagens autorizadas da campanha. Não faz consultas extras
nem acrescenta conteúdo privado ao índice. O mestre continua sendo o único que cria
vínculos; a RPC e a autorização do servidor permanecem intactas. IDs atuais e relações
existentes são preservados. O envio é bloqueado durante carregamento/erro ou se o ID
selecionado não pertence mais aos candidatos disponíveis.

## Aceitação e verificação

- Julkoun é encontrado com `JÚLKOÙN locais`; Aldren com `NPC ÁLDRÉN`.
- Resultados selecionáveis diretamente, sem abrir dropdown, com identificação visual.
- Seleção não muda silenciosamente ao pesquisar e pode ser limpa.
- Não apresentar falha/carregamento como lista vazia.
- E2E existente de vínculo bidirecional atualizado para selecionar o resultado visível;
  mantém verificações de segredo, publicação, persistência e notificações.
- Quatro testes unitários novos aprovados; consultar CI e continuidade para build e
  suíte completa. Playwright local continua bloqueado pela falta do binário.

## Ainda não implementado

Referências a itens de catálogo sem registro narrativo, relações tipadas/inversas,
visibilidade individual de vínculo e conhecimento por campo exigem evolução do modelo
e da projeção no servidor, com testes isolados e autorização separada de migração.
Esta interface não simula essas operações, não entrega itens e não revela registros.

Validação consolidada local: build e tipos de aplicativo/E2E aprovados;
1747 testes aprovados em 145 arquivos. Aguardar CI do PR para Playwright real.

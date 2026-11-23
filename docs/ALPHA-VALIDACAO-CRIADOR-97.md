# Alpha — estabilização dos testes do PR #97 (22/11/2026)

Retomada sobre o HEAD f29e71d do PR existente, sem criar PR duplicado. Branch remota observada sem novas alterações durante a inspeção; atualização deve usar comparação do HEAD esperado.

## Reproduzido

Build do HEAD anterior passou, mas a suíte teve seis falhas em persistenciaServidor (1287 aprovados/6 falhos). O helper examinava Editar personagem apenas uma vez, antes de a ficha terminar de carregar; depois aguardava indefinidamente um campo de edição enquanto a ficha abria corretamente em leitura. Corrigido para aguardar o carregamento e acionar Editar quando a ação estiver disponível, sem ignorar falhas de acesso/rede.

No CI, oito variações de viewport do fluxo da Maga falhavam esperando o rótulo removido Aplicar equipamento da origem e 15 po. Seletores atualizados para as ações visíveis reais: Adicionar itens da origem e 15 PO ao inventário, depois Atualizar símbolo sagrado da origem. A segunda ação continua exercitada, com conferência do saldo 15, sem eliminar a verificação de não duplicação de equipamento/origem.

## Evidências e limites

19 testes de persistência passaram após a correção, incluindo dono, mestre, outro dispositivo simulado, conflito, falhas de rede e recuperação. Build/tipos/suíte completa e CI do novo HEAD devem ser registrados no PR. O ambiente local não permite executar Chromium; o Playwright real precisa passar no CI antes de qualquer integração.

Nenhuma alteração de código de produção, banco, contas, personagens, recursos ou inventário nesta fatia. Não representa validação de contas reais nem autorização de merge/deploy. Critérios funcionais e pendências do criador continuam em CRIADOR-FICHA-INVENTARIO.md.

Validação local consolidada concluída: build TypeScript/Vite e tipos E2E aprovados; **103 arquivos / 1293 testes aprovados**. O HEAD anterior teve 6 falhas reproduzidas; após correção, nenhuma falha na suíte local. Aguardar Playwright do novo commit para certificar o fluxo da Maga no navegador.

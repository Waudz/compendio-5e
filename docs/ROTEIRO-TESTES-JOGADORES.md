# Roteiro de testes Alpha — jogadores

Use apenas campanhas e personagens criados para esta rodada. Não apague personagens antigos para testar. O responsável deve informar qual versão está publicada: um PR aberto ainda não está no site.

Avise o responsável diretamente quando encontrar problemas. Informe aparelho/navegador, ação, resultado esperado e o que ocorreu; envie captura se ajudar. **Nunca envie senha, token, link de recuperação ou conteúdo privado de outra pessoa.** Não existe formulário de feedback no aplicativo.

## Conta e campanha

1. Abra o Compêndio, escolha **Criar conta** e informe e-mail e senha de pelo menos oito caracteres. Se solicitado, confirme o e-mail. Entre novamente e confira se não recebeu acesso a campanhas privadas automaticamente.
2. Depois da publicação da entrega de primeiro acesso, abra **Menu → Minha conta**. Altere o nome de exibição e salve. Peça a outro participante para conferir o nome na campanha. O nome do personagem deve permanecer igual.
3. Foto da conta ainda indisponível; não confundir com retrato do personagem. Alteração de e-mail exige confirmação pelos links enviados; só teste com endereços seus. Recuperação: saia e use **Esqueci a senha**.
4. Entre pelo convite enviado pelo mestre. Verifique o nome da campanha ativa. Se participar de duas campanhas, alterne entre elas e confira que dados privados de uma não aparecem na outra.

## Personagem, ficha e inventário

5. Em **Ficha/Meus personagens**, crie um personagem de teste. Confira explicitamente raça, classe e origem: a Alpha ainda pode iniciar com escolhas predefinidas. Preencha atributos, perícias, características e magias oferecidas para sua classe.
6. Escolha os equipamentos de classe e origem; confira nomes, quantidades e moedas no inventário. Troque uma escolha e verifique que o item antigo não é duplicado. Não use conteúdo fora das opções disponíveis.
7. Preencha um nome reconhecível, interrompa a edição e volte. Antes de sair da conta, salve: cópias locais de recuperação são apagadas no logout. Recarregue durante uma edição de teste e, se houver aviso de recuperação, restaure e confira as escolhas. Não descarte dados se tiver dúvida.
8. Salve, reabra e confira atributos, PV, CA, proficiência, perícias, magias e itens. Registre qualquer diferença; os cálculos de todas as opções ainda estão em validação.
9. Edite a identidade pública e o retrato do personagem. Outro jogador deve ver apenas as informações autorizadas, sem inventário, atributos ou anotações privadas.
10. Altere PV atuais/temporários e condições; use recursos e magias disponíveis. Recarregue e confira a persistência. Botões desabilitados com explicação indicam operação ainda indisponível.
11. Adicione um item mundano, ajuste quantidade, equipe/use quando permitido e remova somente o item de teste. Itens mágicos restritos dependem do mestre; não devem estar livremente disponíveis para adição.
12. Faça uma subida de nível de teste, confira as escolhas solicitadas, salve e reabra. Não avance o personagem da campanha real apenas para testar.

## Consulta e recuperação

13. Abra Compêndio e Diário. Confira somente o conteúdo revelado pelo mestre. Iniciativa e Encontros são exclusivos do mestre.
14. Saia, entre novamente e confira os dados salvos. Abra a mesma conta em outro aparelho e confira a mesma campanha/personagem. Deixe uma edição pendente em cada aparelho para verificar que um conflito é avisado, sem sobrescrita silenciosa. Faça isso apenas com personagem de teste.
15. Desconecte a rede durante uma edição de teste. Confira a mensagem de erro/pendência; reconecte e tente salvar. Nunca interprete erro de conexão como “não há personagens”.

## Anotações — aguardando a reformulação do jogador

O fluxo novo **Minhas anotações** ainda não está disponível nesta entrega. Não use o quadro atual como evidência de que a reformulação foi concluída. Após a publicação correspondente, validar:

- Primeira abertura mostra lista; criar dois documentos, renomear, escrever títulos/listas/checklists e conferir ordem por última edição.
- Alternar para Ficha/Compêndio e retornar preserva documento e rolagem; Voltar retorna à lista.
- Conferir salvamento automático, recarga, queda de conexão e recuperação; abrir em outro dispositivo.
- Mestre e outro jogador não devem acessar os documentos privados, inclusive por API (verificação técnica do responsável).
- Excluir somente documento de teste, com confirmação, verificando antes que cancelar não exclui.

O responsável registra os problemas nas issues do GitHub e avisa quais correções foram publicadas. Este roteiro não declara a Alpha concluída.


### Após publicar a correção DEC-037 (ainda em revisão)

- Desktop: Personagens → próprio personagem abre ficha; outro jogador abre carta e fecha sem sair da lista. Mestre mantém acesso à ficha. Conferir nome do jogador responsável, sem e-mail.
- Abas e Tudo salvo devem alinhar ao cabeçalho em janela larga, dividida, tela cheia e celular.
- Sino → Marcar todas como lidas: contador e Descobertas atualizam; recarregar/abrir em outro aparelho deve preservar leitura. Notificação recebida depois não deve desaparecer. Em falha de rede, conferir aviso e tentar novamente, sem excluir notificações.

## Ciclo de vida dos personagens (só depois que a 0021 for aplicada e o aplicativo publicado)

1. Jogador: na ficha (reticências) ou na lista, "Excluir personagem". Confirme o aviso. A ficha some para você, em todos os seus aparelhos; crie outro personagem.
2. Mestre: abra o aviso no sino. Teste "Decidir depois" e retome em Personagens → "Aguardando decisão".
3. Mestre: arquive um personagem, converta outro em NPC e reative. Confira que ficha, inventário e vínculos continuam.
4. Mestre: transfira para outro jogador. Antes do aceite nada muda; depois, só o destinatário controla.
5. Mestre: "Manter apenas no Compêndio" e "Excluir definitivamente" em personagens de teste. Confira combate, diário e textos.
6. Mestre: para limpar personagens de teste, Selecionar → "Selecionar todos da campanha" → Excluir (digite EXCLUIR). É definitivo.
7. Início, Personagens e Compêndio não devem mostrar "oculto dos jogadores" em personagem ativo.

# PWA e navegação mobile — requisitos da Beta

Prazo da Beta: 12/12/2026. Implementação PWA adiada por decisão do responsável até retomar esta etapa; não interromper a reorganização do Compêndio.

## Instalação
- Manifesto com ícone oficial, identidade visual, start_url e scope sob /compendio-5e/, display standalone.
- Menu: Instalar aplicativo quando disponível; instruções Safari/iOS e alternativa manual Android. Sem faixa permanente. Ocultar opção quando instalação detectável.
- Splash conforme suporte do sistema; manter sessão persistente.
- Service worker com cache versionado de recursos estáticos; não armazenar respostas privadas de API/auth indiscriminadamente. Atualização segura sem perda de edição. Offline integral é etapa separada.

## Navegação instalada
- Evitar saída do escopo e exposição da URL GitHub Pages na navegação normal; investigar comportamento observado no 1.0, causa ainda não confirmada.
- Login e recuperação retornam ao escopo; links externos separados; Voltar Android respeita histórico interno; atualização não abre abas externas.
- Validar instalação, lançamento, navegação, autenticação, atualização e retorno em Android e iOS reais. UI do sistema operacional não é totalmente controlável pelo PWA.

## Ficha mobile
- Retirar cabeçalho global redundante na ficha própria; manter retorno em detalhes internos. Remover identificação textual redundante acima do retrato.
- Atalho compacto Meus personagens, inclusive com apenas uma ficha; lista própria por campanha, seleção e criação. Aba Ficha abre última ficha utilizada, sem ação dupla ao tocar novamente.
- Preservar funções, guardas de alterações não salvas, rolagem e navegação inferior. Validar zero/um/vários personagens, troca de campanha e retorno do navegador.

## Retomada
Prioridade imediata: Compêndio Campanha/Regras, integração de registros, imagens, permissões, testes. PWA é requisito posterior obrigatório da Beta, não implementado neste documento.

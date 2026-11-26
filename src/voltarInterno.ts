// "Voltar" tratado por uma tela interna (ex.: edição da ficha) antes da navegação por abas (computador) ou por telas (celular).
// Quem trata devolve true. O mesmo evento é consultado por mais de um ouvinte de `popstate`: a resposta é calculada uma vez só.
type Interceptor = () => boolean;
const pilha: Interceptor[] = [];
const respondidos = new WeakMap<Event, boolean>();

export function registrarVoltar(f: Interceptor): () => void {
  pilha.push(f);
  return () => { const i = pilha.lastIndexOf(f); if (i >= 0) pilha.splice(i, 1); };
}

export function consumirVoltar(evento?: Event): boolean {
  const ja = evento ? respondidos.get(evento) : undefined;
  if (ja !== undefined) return ja;
  let consumido = false;
  for (let i = pilha.length - 1; i >= 0 && !consumido; i--) consumido = pilha[i]();
  if (evento) respondidos.set(evento, consumido);
  return consumido;
}

/** Alguém abriu o personagem pela interface (lista, Início, link): a tela dele deve mostrar a ficha, não uma edição esquecida. */
export const EVENTO_ABRIR_FICHA = "compendio:abrir-ficha";
export const pedirFicha = (id: string) => { window.dispatchEvent(new CustomEvent<string>(EVENTO_ABRIR_FICHA, { detail: id })); };
/** Uma tela pede para ser fechada (ex.: cancelar a criação de um personagem que nunca foi salvo). */
export const EVENTO_FECHAR_TELA = "compendio:fechar-tela";
export const pedirFechamento = (tabId: string) => { window.dispatchEvent(new CustomEvent<string>(EVENTO_FECHAR_TELA, { detail: tabId })); };

/** Falso quando o elemento está numa aba oculta do espaço de trabalho. */
export function estaVisivel(el: HTMLElement | null): boolean {
  if (!el || !el.isConnected) return false;
  for (let n: HTMLElement | null = el; n; n = n.parentElement) if (n.hidden || n.style.display === "none") return false;
  return true;
}

// ---------------------------------------------------------------- um personagem, uma aba
/** id do personagem (do servidor) → ref da aba `criador:novo-…` onde ele nasceu. Vale enquanto a página estiver aberta. */
const aliases = new Map<string, string>();
export const registrarAliasPersonagem = (personagem: string, refAba: string) => { if (personagem !== refAba) aliases.set(personagem, refAba); };
export const aliasDoPersonagem = (personagem: string) => aliases.get(personagem) ?? null;

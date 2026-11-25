// Ocultar/mostrar cabeçalho e navegação inferior no celular conforme a rolagem (qualquer contêiner, não só window).
import { useEffect, useState } from "react";

/** A navegação do celular avisa que trocou de tela: as barras voltam a aparecer. */
export const EVENTO_TELA = "compendio5e:tela-mobile";
export const THRESHOLD = 10; // px de rolagem acumulada antes de trocar de estado (evita tremor)
export const MIN_TOP = 48;   // perto do topo, os controles sempre aparecem

/** Função pura: dado o estado anterior e o scrollTop atual, devolve o novo estado. */
export function nextChrome(prev: { hidden: boolean; last: number }, top: number): { hidden: boolean; last: number } {
  if (top <= MIN_TOP) return { hidden: false, last: top };
  const delta = top - prev.last;
  if (delta >= THRESHOLD) return { hidden: true, last: top };
  if (delta <= -THRESHOLD) return { hidden: false, last: top };
  return prev;
}

/** Posição dentro dos limites reais: o efeito elástico (passar do topo ou do fim e voltar) não conta como rolagem. */
export const posicaoUtil = (scrollTop: number, scrollHeight: number, clientHeight: number) => Math.min(Math.max(0, scrollTop), Math.max(0, scrollHeight - clientHeight));

/** Quando a própria área muda de altura (barra de endereço do navegador, teclado, rotação) e a posição está presa no fim, foi o navegador que
 *  corrigiu o scrollTop: só atualiza a referência, sem alternar as barras (exceto perto do topo, onde elas sempre aparecem). */
export function passoDeRolagem(prev: { hidden: boolean; last: number; altura: number }, top: number, altura: number, max: number) {
  if (altura !== prev.altura && top >= max - 1) return { hidden: top <= MIN_TOP ? false : prev.hidden, last: top, altura };
  return { ...nextChrome(prev, top), altura };
}

/** Há interação importante em andamento (edição, menu, diálogo)? Então os controles não somem. */
export function interactionActive(doc: Document = document): boolean {
  const a = doc.activeElement as HTMLElement | null;
  if (a && (a.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName))) return true;
  return !!doc.querySelector('[role="menu"],[role="dialog"],[aria-modal="true"]');
}

export function useChromeHidden(enabled: boolean): boolean {
  const [hidden, setHidden] = useState(false);
  useEffect(() => {
    if (!enabled) { setHidden(false); return; }
    let state = new WeakMap<EventTarget, { hidden: boolean; last: number; altura: number }>();
    const onScroll = (e: Event) => {
      const t = e.target;
      const el = t instanceof Element ? t : (document.scrollingElement as Element | null);
      if (el?.classList.contains("mobile-screen") && el.scrollHeight <= el.clientHeight + 1) { setHidden(false); return; }   // o conteúdo encolheu: sem rolagem, não haveria como trazer as barras de volta
      if (!el || el.scrollHeight <= el.clientHeight + 1) return; // ignora faixas só horizontais
      if (interactionActive()) { setHidden(false); return; }
      const altura = el.clientHeight, top = posicaoUtil(el.scrollTop, el.scrollHeight, altura);
      const prev = state.get(el) ?? { hidden: false, last: top, altura };
      const next = passoDeRolagem(prev, top, altura, Math.max(0, el.scrollHeight - altura));
      state.set(el, next);
      setHidden(next.hidden);
    };
    const show = () => setHidden(false);
    document.addEventListener("scroll", onScroll, { capture: true, passive: true }); // scroll não borbulha: captura pega os contêineres internos
    const novaTela = () => { state = new WeakMap(); setHidden(false); };
    window.addEventListener(EVENTO_TELA, novaTela);
    document.addEventListener("focusin", show); // foco por teclado/toque em controle traz tudo de volta
    return () => { window.removeEventListener(EVENTO_TELA, novaTela); document.removeEventListener("scroll", onScroll, true); document.removeEventListener("focusin", show); };
  }, [enabled]);
  return enabled && hidden;
}

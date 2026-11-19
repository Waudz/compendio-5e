// Ocultar/mostrar cabeçalho e navegação inferior no celular conforme a rolagem (qualquer contêiner, não só window).
import { useEffect, useState } from "react";

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
    const state = new WeakMap<EventTarget, { hidden: boolean; last: number }>();
    const onScroll = (e: Event) => {
      const t = e.target;
      const el = t instanceof Element ? t : (document.scrollingElement as Element | null);
      if (!el || el.scrollHeight <= el.clientHeight + 1) return; // ignora faixas só horizontais
      if (interactionActive()) { setHidden(false); return; }
      const prev = state.get(el) ?? { hidden: false, last: el.scrollTop };
      const next = nextChrome(prev, Math.max(0, el.scrollTop)); // ignora overscroll negativo
      state.set(el, next);
      setHidden(next.hidden);
    };
    const show = () => setHidden(false);
    document.addEventListener("scroll", onScroll, { capture: true, passive: true }); // scroll não borbulha: captura pega os contêineres internos
    document.addEventListener("focusin", show); // foco por teclado/toque em controle traz tudo de volta
    return () => { document.removeEventListener("scroll", onScroll, true); document.removeEventListener("focusin", show); };
  }, [enabled]);
  return enabled && hidden;
}

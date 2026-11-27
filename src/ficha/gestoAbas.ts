/** Troca das abas internas de uma ficha por arrasto lateral no celular (personagem e criatura). */
import { useRef } from "react";

/** Margem das bordas reservada ao gesto de voltar do celular. */
const BORDA = 28;
/** O toque começou num controle, ou numa área com rolagem lateral própria: não é gesto de troca de aba. */
export function toqueEmControle(alvo: EventTarget | null, limite: Element) {
  if (!(alvo instanceof Element)) return true;
  if (alvo.closest("input,textarea,select,button,a,summary,label,[contenteditable],[role=menu],.sem-gesto")) return true;
  for (let n: Element | null = alvo; n && n !== limite; n = n.parentElement) if (n.scrollWidth > n.clientWidth + 1 && /auto|scroll/.test(getComputedStyle(n).overflowX)) return true;
  return false;
}
/** Para qual aba um arrasto leva (ou `null` se não for um gesto horizontal claro). Sem volta ao início: as pontas param. */
export function abaVizinha<T extends string>(ids: readonly T[], atual: T, dx: number, dy: number): T | null {
  if (Math.abs(dx) < 65 || Math.abs(dx) < Math.abs(dy) * 1.6) return null;
  return ids[ids.indexOf(atual) + (dx < 0 ? 1 : -1)] ?? null;
}
export function useGestoAbas<T extends string>(ids: readonly T[], atual: T, trocar: (aba: T) => void) {
  const toque = useRef<{ x: number; y: number } | null>(null);
  return {
    onTouchStart: (e: React.TouchEvent) => {
      const t = e.touches[0];
      toque.current = e.touches.length !== 1 || t.clientX < BORDA || t.clientX > window.innerWidth - BORDA || toqueEmControle(e.target, e.currentTarget) ? null : { x: t.clientX, y: t.clientY };
    },
    onTouchEnd: (e: React.TouchEvent) => {
      const inicio = toque.current; toque.current = null;
      if (!inicio || window.matchMedia?.("(min-width:701px)").matches) return;
      const t = e.changedTouches[0], aba = abaVizinha(ids, atual, t.clientX - inicio.x, t.clientY - inicio.y);
      if (aba) trocar(aba);
    },
    onTouchCancel: () => { toque.current = null; },
  };
}

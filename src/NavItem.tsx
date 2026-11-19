import { useRef, type ReactNode } from "react";
import type { NavMode } from "./navigation";
import type { TabSpec } from "./workspace";

/** Toque prolongado (mouse não conta: lá existe o botão direito). Cancela se o dedo se mover ou soltar antes do tempo. */
export function useLongPress(onLongPress: (x: number, y: number) => void, ms = 500) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null), fired = useRef(false), origin = useRef({ x: 0, y: 0 });
  const clear = () => { if (timer.current) clearTimeout(timer.current); timer.current = null; };
  return {
    handlers: {
      onPointerDown: (e: React.PointerEvent) => {
        if (e.pointerType === "mouse") return;
        fired.current = false; origin.current = { x: e.clientX, y: e.clientY };
        clear(); timer.current = setTimeout(() => { fired.current = true; onLongPress(origin.current.x, origin.current.y); }, ms);
      },
      onPointerMove: (e: React.PointerEvent) => { if (timer.current && Math.hypot(e.clientX - origin.current.x, e.clientY - origin.current.y) > 10) clear(); },
      onPointerUp: clear, onPointerCancel: clear, onPointerLeave: clear,
    },
    /** O clique que sucede um toque prolongado não deve navegar. */
    consumeClick: () => { const f = fired.current; fired.current = false; return f; },
  };
}

/** Item de navegação: clique normal reutiliza; Ctrl/Cmd+clique e botão do meio abrem nova aba; botão direito, tecla de menu e toque prolongado abrem o menu. */
export function NavItem({ spec, className, title, ariaLabel, children, onNavigate, onMenu }: {
  spec: TabSpec; className: string; title: string; ariaLabel?: string; children: ReactNode;
  onNavigate: (s: TabSpec, mode: NavMode) => void; onMenu: (s: TabSpec, x: number, y: number) => void;
}) {
  const lp = useLongPress((x, y) => onMenu(spec, x, y));
  return <button className={className} title={title} aria-label={ariaLabel} {...lp.handlers}
    onClick={e => { if (lp.consumeClick()) { e.preventDefault(); return; } onNavigate(spec, e.ctrlKey || e.metaKey ? "new" : "reuse"); }}
    onMouseDown={e => { if (e.button === 1) e.preventDefault(); }}      // evita o autoscroll do botão do meio
    onAuxClick={e => { if (e.button === 1) { e.preventDefault(); onNavigate(spec, "new"); } }}
    onContextMenu={e => {
      e.preventDefault();
      const r = e.currentTarget.getBoundingClientRect();                  // menu pelo teclado chega com clientX/Y = 0
      onMenu(spec, e.clientX || r.left + r.width / 2, e.clientY || r.top + r.height / 2);
    }}>{children}</button>;
}

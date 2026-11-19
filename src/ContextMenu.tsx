import { useEffect, useRef } from "react";

export type MenuItem = { label: string; onSelect: () => void; disabled?: boolean } | "-";
export type MenuState = { x: number; y: number; items: MenuItem[] };

export function ContextMenu({ menu, onClose }: { menu: MenuState; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const away = (e: Event) => { if (!ref.current?.contains(e.target as Node)) onClose(); };
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("pointerdown", away, true); window.addEventListener("keydown", esc); window.addEventListener("blur", onClose); window.addEventListener("resize", onClose);
    ref.current?.querySelector<HTMLButtonElement>("button:not(:disabled)")?.focus();
    return () => { window.removeEventListener("pointerdown", away, true); window.removeEventListener("keydown", esc); window.removeEventListener("blur", onClose); window.removeEventListener("resize", onClose); };
  }, [onClose]);
  const x = Math.min(menu.x, window.innerWidth - 250), y = Math.min(menu.y, window.innerHeight - menu.items.length * 34 - 12);
  return <div className="ctx" role="menu" ref={ref} style={{ left: Math.max(4, x), top: Math.max(4, y) }} onContextMenu={e => e.preventDefault()}>
    {menu.items.map((it, i) => it === "-" ? <hr key={i}/> :
      <button key={i} role="menuitem" disabled={it.disabled} onClick={() => { onClose(); it.onSelect(); }}>{it.label}</button>)}
  </div>;
}

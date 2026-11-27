// Janela modal compartilhada (confirmações, detalhes, formulários curtos): foco preso, Escape cancela e o foco volta a quem abriu.
import { X } from "lucide-react";
import { useEffect, useId, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import "./ui.css";

export function Modal({ titulo, onFechar, children, acoes, ocupado = false, largura = 440, sistema }: {
  titulo: string; onFechar: () => void; children: ReactNode; acoes?: ReactNode; ocupado?: boolean; largura?: number;
  /** Classe do sistema de jogo (ex.: `sistema-dnd`), para a janela manter a identidade de quem a abriu. */ sistema?: string;
}) {
  const id = useId(), caixa = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const antes = document.activeElement as HTMLElement | null;
    // O diálogo é anunciado sem abrir o teclado virtual. Tab alcança os controles.
    caixa.current?.focus({ preventScroll: true });
    return () => { if (antes?.isConnected && !antes.matches("input, textarea, select, [contenteditable=true]")) antes.focus({ preventScroll: true }); };
  }, []);
  const tecla = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") { e.stopPropagation(); if (!ocupado) onFechar(); return; }
    if (e.key !== "Tab" || !caixa.current) return;
    const focaveis = [...caixa.current.querySelectorAll<HTMLElement>("button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea, a[href], summary")];
    const primeiro = focaveis[0], ultimo = focaveis[focaveis.length - 1];
    if (document.activeElement === caixa.current) { e.preventDefault(); (e.shiftKey ? ultimo : primeiro)?.focus(); }
    else if (e.shiftKey && document.activeElement === primeiro) { e.preventDefault(); ultimo?.focus(); }
    else if (!e.shiftKey && document.activeElement === ultimo) { e.preventDefault(); primeiro?.focus(); }
  };
  return createPortal(<div className={"modal-fundo" + (sistema ? ` ${sistema}` : "")} onKeyDown={tecla} onPointerDown={e => { if (e.target === e.currentTarget && !ocupado) onFechar(); }}>
    <div ref={caixa} className={"modal-caixa" + (largura >= 600 ? " modal-extensa" : "")} role="dialog" aria-modal="true" aria-labelledby={id} tabIndex={-1} style={{ maxWidth: largura }}>
      <div className="modal-topo"><h2 id={id}>{titulo}</h2><button type="button" className="modal-fechar" aria-label="Fechar" onClick={onFechar} disabled={ocupado}><X size={16} aria-hidden="true"/></button></div>
      <div className="modal-corpo">{children}</div>
      {acoes && <div className="modal-acoes">{acoes}</div>}
    </div>
  </div>, document.body);
}

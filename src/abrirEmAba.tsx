// Menu de contexto "Abrir em nova aba" único para todo o aplicativo (reutiliza o ContextMenu e o openContentLink do workspace).
import { createContext, useContext, type MouseEvent as ReactMouseEvent } from "react";
import type { TabSpec } from "./workspace";

export type AbrirEmAba = { abrir: (s: TabSpec, origem?: string) => void; mostrar: (x: number, y: number, s: TabSpec, origem?: string) => void };
export const AbrirEmAbaContext = createContext<AbrirEmAba | null>(null);
/** Id da aba (painel) que está desenhando o conteúdo: a nova aba abre no mesmo grupo dela. */
export const OrigemAbaContext = createContext<string | undefined>(undefined);

/** Campos de texto e o editor rico mantêm o menu nativo do navegador (copiar, colar, corretor). */
export const ehAreaDeEdicao = (alvo: EventTarget | null) => alvo instanceof Element && !!alvo.closest("input, textarea, select, [contenteditable], .page-editor, .bn-container");

export function useAbrirEmAba() {
  const c = useContext(AbrirEmAbaContext), origem = useContext(OrigemAbaContext);
  return {
    disponivel: !!c,
    abrir: (s: TabSpec) => c?.abrir(s, origem),
    /** onContextMenu do item: abre o menu "Abrir em nova aba" (exceto sobre campos de texto/editor). */
    aoClicarDireito: (e: ReactMouseEvent, s: TabSpec) => { if (!c || ehAreaDeEdicao(e.target)) return; e.preventDefault(); c.mostrar(e.clientX, e.clientY, s, origem); },
    /** Alternativa sem botão direito (celular/teclado): abre o mesmo menu junto de um botão. */
    abrirMenuEm: (el: Element, s: TabSpec) => { const r = el.getBoundingClientRect(); c?.mostrar(r.left, r.bottom, s, origem); },
  };
}

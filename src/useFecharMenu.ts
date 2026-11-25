// Fechamento comum dos menus suspensos: clique/toque fora do menu e do botão que o abre, ou Escape (que devolve o foco ao botão).
// Não depende de foco (há navegadores em que tocar num botão não o foca).
import { useEffect, type RefObject } from "react";

export function useFecharMenu(aberto: boolean, menu: RefObject<HTMLElement | null>, gatilho: RefObject<HTMLElement | null>, fechar: () => void) {
  useEffect(() => {
    if (!aberto) return;
    const fora = (e: Event) => { const alvo = e.target as Node; if (!menu.current?.contains(alvo) && !gatilho.current?.contains(alvo)) fechar(); };
    const tecla = (e: KeyboardEvent) => { if (e.key === "Escape") { e.stopPropagation(); fechar(); gatilho.current?.focus(); } };
    document.addEventListener("pointerdown", fora, true); document.addEventListener("keydown", tecla, true);
    return () => { document.removeEventListener("pointerdown", fora, true); document.removeEventListener("keydown", tecla, true); };
  }, [aberto]);   // eslint-disable-line react-hooks/exhaustive-deps
}

/** Visualização ampliada, somente leitura, da imagem ORIGINAL (sem recorte nem enquadramento). Não busca nada: mostra o
 *  endereço que a tela já recebeu com a autorização dela, e some junto com a imagem se o acesso deixar de existir. */
import { Minus, Plus, RotateCcw, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { registrarVoltar } from "../voltarInterno";
import "./visualizador.css";

export const ZOOM_MAXIMO = 6;
const PASSO = 1.4;
type Vista = { escala: number; x: number; y: number };
const INICIAL: Vista = { escala: 1, x: 0, y: 0 };
const MARCA = "compendioImagem";

/** Nova escala mantendo parado o ponto (px, py), medido a partir do centro da área. Na escala 1 a imagem volta ao centro. */
export function ampliar(v: Vista, fator: number, px = 0, py = 0): Vista {
  const escala = Math.min(ZOOM_MAXIMO, Math.max(1, v.escala * fator));
  if (escala === 1) return INICIAL;
  const k = escala / v.escala;
  return { escala, x: px - (px - v.x) * k, y: py - (py - v.y) * k };
}

export function VisualizadorImagem({ src, titulo, onFechar }: { src: string; titulo: string; onFechar: () => void }) {
  const [vista, setVista] = useState(INICIAL);
  const caixa = useRef<HTMLDivElement>(null), area = useRef<HTMLDivElement>(null);
  const toques = useRef(new Map<number, { x: number; y: number }>());
  /** Ponto em relação ao centro da área, que é a origem da transformação. */
  const doCentro = useCallback((x: number, y: number) => { const r = area.current!.getBoundingClientRect(); return [x - r.left - r.width / 2, y - r.top - r.height / 2] as const; }, []);
  /** Impede que a imagem arrastada saia por completo da área. */
  const limitar = useCallback((v: Vista): Vista => {
    const r = area.current?.getBoundingClientRect();
    if (!r?.width) return v;
    const mx = (r.width * (v.escala - 1)) / 2, my = (r.height * (v.escala - 1)) / 2;
    return { escala: v.escala, x: Math.min(mx, Math.max(-mx, v.x)), y: Math.min(my, Math.max(-my, v.y)) };
  }, []);
  const zoom = useCallback((fator: number, px = 0, py = 0) => setVista(v => limitar(ampliar(v, fator, px, py))), [limitar]);

  const fechar = useRef(onFechar); fechar.current = onFechar;
  useEffect(() => {
    const antes = document.activeElement as HTMLElement | null;
    caixa.current?.focus();
    return () => antes?.focus?.({ preventScroll: true });
  }, []);
  // roda do mouse: precisa de ouvinte não passivo para a página de baixo não rolar
  useEffect(() => {
    const el = area.current; if (!el) return;
    const roda = (e: WheelEvent) => { e.preventDefault(); const [px, py] = doCentro(e.clientX, e.clientY); zoom(e.deltaY < 0 ? 1.2 : 1 / 1.2, px, py); };
    el.addEventListener("wheel", roda, { passive: false });
    return () => el.removeEventListener("wheel", roda);
  }, [doCentro, zoom]);
  // Voltar do navegador/celular fecha só o visualizador
  const saiuPeloVoltar = useRef(false);
  useEffect(() => {
    // um único passo, mesmo que o efeito rode duas vezes (modo estrito do React no desenvolvimento)
    if (!(window.history.state as Record<string, unknown> | null)?.[MARCA]) window.history.pushState({ ...window.history.state, [MARCA]: true }, "");
    return registrarVoltar(() => { saiuPeloVoltar.current = true; fechar.current(); return true; });
  }, []);
  /** Fechamento pela interface: retira do histórico a entrada criada ao abrir. */
  const sair = () => {
    if (!saiuPeloVoltar.current && (window.history.state as Record<string, unknown> | null)?.[MARCA]) {
      const desfazer = registrarVoltar(() => { desfazer(); return true; });
      window.history.back();
    }
    onFechar();
  };

  const baixar = (e: React.PointerEvent) => {
    try { e.currentTarget.setPointerCapture?.(e.pointerId); } catch { /* ponteiro já encerrado: o gesto segue sem captura */ }
    toques.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
  };
  const mover = (e: React.PointerEvent) => {
    const anterior = toques.current.get(e.pointerId); if (!anterior) return;
    const atual = { x: e.clientX, y: e.clientY };
    const outro = [...toques.current].find(([id]) => id !== e.pointerId)?.[1];
    toques.current.set(e.pointerId, atual);
    if (!outro) { setVista(v => (v.escala === 1 ? v : limitar({ ...v, x: v.x + atual.x - anterior.x, y: v.y + atual.y - anterior.y }))); return; }
    // pinça: escala pela variação da distância, centrada entre os dois dedos, acompanhando o deslocamento do centro
    const antesD = Math.hypot(anterior.x - outro.x, anterior.y - outro.y), agoraD = Math.hypot(atual.x - outro.x, atual.y - outro.y);
    if (!antesD) return;
    const [px, py] = doCentro((atual.x + outro.x) / 2, (atual.y + outro.y) / 2);
    setVista(v => { const n = ampliar(v, agoraD / antesD, px, py); return limitar(n.escala === 1 ? n : { ...n, x: n.x + (atual.x - anterior.x) / 2, y: n.y + (atual.y - anterior.y) / 2 }); });
  };
  const soltar = (e: React.PointerEvent) => { toques.current.delete(e.pointerId); };

  // No nível da janela: um botão que fica desativado perde o foco, e Esc precisa continuar valendo.
  const tecla = useRef<(e: KeyboardEvent) => void>(() => {});
  tecla.current = e => {
    e.stopPropagation();
    if (e.key === "Escape") { e.preventDefault(); sair(); }
    else if (e.key === "+" || e.key === "=") zoom(PASSO);
    else if (e.key === "-") zoom(1 / PASSO);
    else if (e.key === "0") setVista(INICIAL);
    else if (e.key === "Tab") {
      const focaveis = [...caixa.current!.querySelectorAll<HTMLElement>("button:not(:disabled)")], i = focaveis.indexOf(document.activeElement as HTMLElement);
      if (i < 0 || (e.shiftKey ? i === 0 : i === focaveis.length - 1)) { e.preventDefault(); focaveis[e.shiftKey ? focaveis.length - 1 : 0]?.focus(); }
    }
  };
  useEffect(() => {
    const ouvir = (e: KeyboardEvent) => tecla.current(e);
    window.addEventListener("keydown", ouvir, true);
    return () => window.removeEventListener("keydown", ouvir, true);
  }, []);

  // O portal propaga eventos pela árvore do React: nada daqui pode chegar à carta, à ficha ou ao gesto de troca de aba.
  const parar = (e: React.SyntheticEvent) => e.stopPropagation();
  return createPortal(<div ref={caixa} className="visualizador" role="dialog" aria-modal="true" aria-label={`Imagem ampliada: ${titulo}`} tabIndex={-1}
    onClick={parar} onPointerDown={parar} onContextMenu={parar} onTouchStart={parar} onTouchEnd={parar} onTouchMove={parar}>
    <div className="visualizador-barra">
      <span className="visualizador-titulo">{titulo}</span>
      <button type="button" aria-label="Reduzir" title="Reduzir" disabled={vista.escala <= 1} onClick={() => zoom(1 / PASSO)}><Minus size={18} aria-hidden="true"/></button>
      <span className="visualizador-escala" role="status">{Math.round(vista.escala * 100)}%</span>
      <button type="button" aria-label="Ampliar" title="Ampliar" disabled={vista.escala >= ZOOM_MAXIMO} onClick={() => zoom(PASSO)}><Plus size={18} aria-hidden="true"/></button>
      <button type="button" aria-label="Restaurar zoom" title="Restaurar zoom" disabled={vista.escala === 1} onClick={() => setVista(INICIAL)}><RotateCcw size={17} aria-hidden="true"/></button>
      <button type="button" aria-label="Fechar imagem" title="Fechar (Esc)" onClick={sair}><X size={20} aria-hidden="true"/></button>
    </div>
    <div ref={area} className="visualizador-area" data-ampliada={vista.escala > 1 || undefined} onPointerDown={baixar} onPointerMove={mover} onPointerUp={soltar} onPointerCancel={soltar}
      onDoubleClick={e => { const [px, py] = doCentro(e.clientX, e.clientY); if (vista.escala > 1) setVista(INICIAL); else zoom(2.5, px, py); }}>
      <img src={src} alt={titulo} draggable={false} style={{ transform: `translate(${vista.x}px, ${vista.y}px) scale(${vista.escala})` }}/>
    </div>
  </div>, document.body);
}

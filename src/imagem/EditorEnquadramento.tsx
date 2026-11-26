// Editor ÚNICO de enquadramento, usado por toda imagem editável (retratos, capa da campanha e os próximos módulos). Como no Compêndio
// 1.0: popup com a imagem exatamente como ficará no cartão; arraste com o mouse ou o dedo, zoom pela roda, pela pinça ou pelo controle.
// Teclado: setas movem, + e − aproximam. Restaurar, Cancelar e Confirmar. Nada é recortado: só o enquadramento muda.
import { RotateCcw, ZoomIn, ZoomOut } from "lucide-react";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { arrastar, ENQUADRAMENTO_PADRAO, estiloEnquadramento, medir, normalizar, ZOOM_MAXIMO, type Enquadramento } from "./enquadramento";
import "./enquadramento.css";

export type PropsEditor = {
  titulo: string; src: string; inicial?: Enquadramento;
  /** Largura ÷ altura do quadro onde a imagem aparece (retrato 1; capa 3,5). */
  proporcao: number;
  /** Prévias em outros tamanhos usados pelo aplicativo (largura em px). */
  previas?: number[];
  ocupado?: boolean; erro?: string | null; nota?: ReactNode; confirmar?: string;
  onConfirmar: (e: Enquadramento) => void; onCancelar: () => void;
};

export function EditorEnquadramento({ titulo, src, inicial = ENQUADRAMENTO_PADRAO, proporcao, previas = [], ocupado = false, erro, nota, confirmar = "Confirmar enquadramento", onConfirmar, onCancelar }: PropsEditor) {
  const [enq, setEnq] = useState(() => normalizar(inicial));
  const [natural, setNatural] = useState<{ largura: number; altura: number } | null>(null);
  const [falhou, setFalhou] = useState(false);
  const idTitulo = useId(), idAjuda = useId();
  const quadro = useRef<HTMLDivElement>(null), caixa = useRef<HTMLDivElement>(null);
  const toques = useRef(new Map<number, { x: number; y: number }>());
  const atual = useRef(enq); atual.current = enq;
  // Aberto de dentro de uma janela modal (`<dialog>` com showModal, como "Editar campanha"), o popup precisa ficar DENTRO dela: fora, o
  // navegador o desenha atrás e o deixa inerte (sem clique nem teclado).
  const [destino] = useState<HTMLElement>(() => [...document.querySelectorAll<HTMLElement>("dialog[open]")].pop() ?? document.body);
  const natRef = useRef(natural); natRef.current = natural;

  // foco: entra no quadro e volta para quem abriu
  useEffect(() => {
    const antes = document.activeElement as HTMLElement | null;
    quadro.current?.focus();
    return () => antes?.focus?.();
  }, []);
  const zoom = (fator: number) => setEnq(e => normalizar({ ...e, zoom: e.zoom * fator }));
  useEffect(() => {
    const el = quadro.current; if (!el) return;
    const roda = (ev: WheelEvent) => { ev.preventDefault(); zoom(ev.deltaY < 0 ? 1.08 : 1 / 1.08); };   // não passivo: a página não rola junto
    el.addEventListener("wheel", roda, { passive: false });
    return () => el.removeEventListener("wheel", roda);
  }, []);   // eslint-disable-line react-hooks/exhaustive-deps

  const sobra = (e: Enquadramento) => {
    const el = quadro.current, n = natRef.current;
    return el && n ? medir(n, { largura: el.clientWidth, altura: el.clientHeight }, e) : { sobraX: 0, sobraY: 0 };
  };
  const mover = (ev: React.PointerEvent) => {
    const anterior = toques.current.get(ev.pointerId); if (!anterior) return;
    const outros = [...toques.current.entries()].filter(([id]) => id !== ev.pointerId).map(([, p]) => p);
    toques.current.set(ev.pointerId, { x: ev.clientX, y: ev.clientY });
    if (outros.length) {   // pinça: o zoom acompanha a distância entre os dois dedos
      const antes = Math.hypot(anterior.x - outros[0].x, anterior.y - outros[0].y), agora = Math.hypot(ev.clientX - outros[0].x, ev.clientY - outros[0].y);
      if (antes > 0) zoom(agora / antes);
      return;
    }
    const dx = ev.clientX - anterior.x, dy = ev.clientY - anterior.y;
    setEnq(e => arrastar(e, dx, dy, sobra(e)));
  };
  const soltar = (ev: React.PointerEvent) => { toques.current.delete(ev.pointerId); };
  const tecla = (ev: React.KeyboardEvent) => {
    const passo = ev.shiftKey ? 10 : 2;
    const delta: Record<string, [number, number]> = { ArrowLeft: [-passo, 0], ArrowRight: [passo, 0], ArrowUp: [0, -passo], ArrowDown: [0, passo] };
    if (ev.key in delta) { ev.preventDefault(); const [dx, dy] = delta[ev.key]; setEnq(e => normalizar({ ...e, x: e.x + dx, y: e.y + dy })); }
    else if (ev.key === "+" || ev.key === "=") { ev.preventDefault(); zoom(1.1); }
    else if (ev.key === "-") { ev.preventDefault(); zoom(1 / 1.1); }
  };
  /** Escape cancela; Tab fica dentro do popup. */
  const teclaDaCaixa = (ev: React.KeyboardEvent) => {
    if (ev.key === "Escape") { ev.preventDefault(); ev.stopPropagation(); if (!ocupado) onCancelar(); return; }   // sem preventDefault, o Escape fecharia também a janela de baixo
    if (ev.key !== "Tab" || !caixa.current) return;
    const focaveis = [...caixa.current.querySelectorAll<HTMLElement>("button:not(:disabled), input, [tabindex='0']")];
    const primeiro = focaveis[0], ultimo = focaveis[focaveis.length - 1];
    if (ev.shiftKey && document.activeElement === primeiro) { ev.preventDefault(); ultimo.focus(); }
    else if (!ev.shiftKey && document.activeElement === ultimo) { ev.preventDefault(); primeiro.focus(); }
  };

  return createPortal(<div className="enq-fundo" onKeyDown={teclaDaCaixa}>
    <div ref={caixa} className="enq-caixa" role="dialog" aria-modal="true" aria-labelledby={idTitulo} style={{ maxWidth: proporcao > 1.5 ? 760 : 420 }}>
      <h2 id={idTitulo}>{titulo}</h2>
      <div ref={quadro} className="enq-quadro" tabIndex={0} role="application" aria-label="Posicionar a imagem" aria-describedby={idAjuda} style={{ aspectRatio: String(proporcao) }}
        onPointerDown={ev => { toques.current.set(ev.pointerId, { x: ev.clientX, y: ev.clientY }); ev.currentTarget.setPointerCapture?.(ev.pointerId); }}
        onPointerMove={mover} onPointerUp={soltar} onPointerCancel={soltar} onKeyDown={tecla}>
        <img src={src} alt="Prévia do enquadramento" draggable={false} style={estiloEnquadramento(enq)} onError={() => setFalhou(true)}
          onLoad={ev => { setFalhou(false); setNatural({ largura: ev.currentTarget.naturalWidth, altura: ev.currentTarget.naturalHeight }); }}/>
      </div>
      <p id={idAjuda} className="muted enq-ajuda">Arraste a imagem. Use a roda do mouse, a pinça ou o controle para o zoom. No teclado: setas, + e −.</p>
      <div className="enq-zoom">
        <button type="button" className="btn-secondary" aria-label="Afastar" onClick={() => zoom(1 / 1.1)} disabled={enq.zoom <= 1}><ZoomOut size={15} aria-hidden="true"/></button>
        <input type="range" aria-label="Zoom da imagem" min={1} max={ZOOM_MAXIMO} step={0.01} value={enq.zoom} onChange={ev => setEnq(e => normalizar({ ...e, zoom: Number(ev.target.value) }))}/>
        <button type="button" className="btn-secondary" aria-label="Aproximar" onClick={() => zoom(1.1)} disabled={enq.zoom >= ZOOM_MAXIMO}><ZoomIn size={15} aria-hidden="true"/></button>
        <output aria-label="Zoom atual">{Math.round(enq.zoom * 100)}%</output>
      </div>
      {previas.length > 0 && <div className="enq-previas"><span className="muted">Como aparece:</span>{previas.map(largura => <span key={largura} className="enq-previa" style={{ width: largura, aspectRatio: String(proporcao) }}><img src={src} alt="" style={estiloEnquadramento(enq)}/></span>)}</div>}
      {nota && <p className="muted enq-ajuda">{nota}</p>}
      {falhou && <p role="alert" className="notice err">Não foi possível abrir esta imagem.</p>}
      {erro && <p role="alert" className="notice err">{erro}</p>}
      <div className="enq-acoes">
        <button type="button" className="btn-secondary" onClick={() => setEnq(ENQUADRAMENTO_PADRAO)} disabled={ocupado}><RotateCcw size={14} aria-hidden="true"/> Restaurar</button>
        <span className="enq-espaco"/>
        <button type="button" className="btn-secondary" onClick={onCancelar} disabled={ocupado}>Cancelar</button>
        <button type="button" className="btn-primary" onClick={() => onConfirmar(enq)} disabled={ocupado || falhou}>{ocupado ? "Salvando…" : confirmar}</button>
      </div>
    </div>
  </div>, destino);
}

// Barra de categorias em uma única linha: o que não cabe vai para um menu "…" colado ao último filtro visível.
// A decisão usa a largura real do componente (ResizeObserver), não a da janela. Sem rolagem e sem corte parcial.
import { Ellipsis } from "lucide-react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";

/** Quantos itens, a partir do primeiro, cabem em `disponivel`. Todos cabendo, não há "…"; senão o "…" (mais o espaçamento) é reservado. */
export function quantosCabem(larguras: readonly number[], disponivel: number, larguraMais: number, vao: number): number {
  const total = larguras.reduce((s, l) => s + l, 0) + vao * Math.max(0, larguras.length - 1);
  if (total <= disponivel + 0.5) return larguras.length;
  let usado = larguraMais, n = 0;
  for (const l of larguras) { if (usado + l + vao > disponivel + 0.5) break; usado += l + vao; n++; }
  return n;
}

export function BarraExcedente<T extends string>({ itens, ativo, onSelecionar, rotulo, className = "" }: { itens: readonly T[]; ativo: T; onSelecionar: (v: T) => void; rotulo: string; className?: string }) {
  const caixa = useRef<HTMLDivElement>(null), medidas = useRef<HTMLDivElement>(null), mais = useRef<HTMLButtonElement>(null), menu = useRef<HTMLDivElement>(null);
  const [cabem, setCabem] = useState(itens.length), [aberto, setAberto] = useState(false), [esquerda, setEsquerda] = useState(0);

  useLayoutEffect(() => {
    const el = caixa.current, regua = medidas.current; if (!el || !regua) return;
    const medir = () => {
      const disponivel = el.getBoundingClientRect().width;
      if (!disponivel) { setCabem(itens.length); return; }   // sem layout (painel oculto): nada a decidir
      const filhos = [...regua.children].map(c => c.getBoundingClientRect().width);
      setCabem(quantosCabem(filhos.slice(0, itens.length), disponivel, filhos[itens.length] ?? 0, parseFloat(getComputedStyle(el).columnGap) || 0));
    };
    medir();
    let vivo = true; void document.fonts?.ready.then(() => { if (vivo) medir(); });
    if (typeof ResizeObserver === "undefined") return () => { vivo = false; };
    const observador = new ResizeObserver(medir); observador.observe(el); observador.observe(regua);
    return () => { vivo = false; observador.disconnect(); };
  }, [itens]);

  const visiveis = itens.slice(0, cabem), ocultos = itens.slice(cabem), ativoOculto = ocultos.includes(ativo);
  useEffect(() => { if (!ocultos.length) setAberto(false); }, [ocultos.length]);
  useEffect(() => {
    if (!aberto) return;
    const fora = (e: Event) => { const alvo = e.target as Node; if (!menu.current?.contains(alvo) && !mais.current?.contains(alvo)) setAberto(false); };
    const tecla = (e: KeyboardEvent) => { if (e.key === "Escape") { e.stopPropagation(); setAberto(false); mais.current?.focus(); } };
    document.addEventListener("pointerdown", fora, true); document.addEventListener("keydown", tecla, true);
    return () => { document.removeEventListener("pointerdown", fora, true); document.removeEventListener("keydown", tecla, true); };
  }, [aberto]);
  // o menu abre sob o "…", puxado para a esquerda se passaria da borda do componente
  useLayoutEffect(() => {
    if (!aberto || !caixa.current || !mais.current || !menu.current) return;
    const c = caixa.current.getBoundingClientRect(), b = mais.current.getBoundingClientRect(), m = menu.current.getBoundingClientRect();
    setEsquerda(Math.max(0, Math.min(b.left - c.left, c.width - m.width)));
  }, [aberto, cabem]);
  const escolher = (v: T) => { onSelecionar(v); if (aberto) { setAberto(false); mais.current?.focus(); } };

  return <div ref={caixa} className={`barra-excedente ${className}`} role="group" aria-label={rotulo}>
    {visiveis.map(v => <button key={v} type="button" className="btn-secondary barra-item" aria-pressed={ativo === v} onClick={() => escolher(v)}>{v}</button>)}
    {ocultos.length > 0 && <button ref={mais} type="button" className="btn-secondary barra-item barra-mais" data-ativo={ativoOculto ? "true" : undefined} aria-expanded={aberto}
      aria-label={ativoOculto ? `Mais categorias (selecionada: ${ativo})` : "Mais categorias"} title={ativoOculto ? ativo : "Mais categorias"} onClick={() => setAberto(a => !a)}><Ellipsis size={16} aria-hidden="true"/></button>}
    {aberto && ocultos.length > 0 && <div ref={menu} className="barra-menu" role="group" aria-label="Categorias restantes" style={{ left: esquerda }}>
      {ocultos.map(v => <button key={v} type="button" className="btn-secondary barra-item" aria-pressed={ativo === v} onClick={() => escolher(v)}>{v}</button>)}
    </div>}
    {/* régua invisível com as larguras naturais; o texto vem do CSS para não duplicar conteúdo no DOM */}
    <div className="barra-regua" aria-hidden="true"><div ref={medidas}>
      {itens.map(v => <span key={v} className="btn-secondary barra-item" data-rotulo={v}/>)}
      <span className="btn-secondary barra-item barra-mais"><Ellipsis size={16}/></span>
    </div></div>
  </div>;
}

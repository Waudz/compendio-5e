import { useState, type ReactNode } from "react";

export function PesquisaCatalogo({ rotulo, valor, onChange, resultados, vazio, minimo = 2, somenteResultados = false }: { rotulo: string; valor: string; onChange: (v: string) => void; resultados: ReactNode; vazio: boolean; minimo?: number; somenteResultados?: boolean }) {
  const [aberto, setAberto] = useState(false);
  if (somenteResultados) return vazio ? <p className="muted" role="status">Nenhum resultado encontrado.</p> : <ul className="ini-achados">{resultados}</ul>;
  return <div className="pesquisa-catalogo" onFocus={() => setAberto(true)} onBlur={e => { if (!e.currentTarget.contains(e.relatedTarget)) setAberto(false); }} onKeyDown={e => { if (e.key === "Escape") { setAberto(false); e.stopPropagation(); } }}>
    <label>{rotulo}<input type="search" value={valor} onChange={e => { onChange(e.target.value); setAberto(true); }} placeholder="Nome em português ou inglês"/></label>
    {aberto && valor.trim().length >= minimo && <div className="pesquisa-resultados">{vazio ? <p className="muted" role="status">Nenhum resultado encontrado.</p> : <ul className="ini-achados">{resultados}</ul>}</div>}
  </div>;
}

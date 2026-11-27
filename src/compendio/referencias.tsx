/** Citações no texto narrativo: `@[texto exibido](id do registro)`. O servidor saneia a projeção do jogador (0020):
 *  destino fechado chega só como texto, sem o ID. */
import { useId, useRef, useState, type ReactNode } from 'react';
import { useAbrirEmAba } from '../abrirEmAba';
import { normalizar } from '../catalogue/nucleo/busca';
import type { TabSpec } from '../workspace';
import { nomesRegistro, type LinhaCompendio } from './consulta';
import { registroSpec } from './navegacao';

const REF = /@\[([^\]\n]{1,120})\]\(([0-9a-fA-F-]{36})\)/g;
export const semReferencias = (t: string) => t.replace(REF, '$1');
export const montarReferencia = (nome: string, id: string) => `@[${nome.replace(/[[\]\n]/g, ' ').trim().slice(0, 120)}](${id})`;

export function BotaoReferencia({ spec, children, onAbrir }: { spec: TabSpec; children: ReactNode; onAbrir: (s: TabSpec) => void }) {
  const nav = useAbrirEmAba();
  return <button type="button" className="carta-ref" onClick={e => { if (!nav.aoClicar(e, spec)) onAbrir(spec); }} onAuxClick={e => nav.aoBotaoDoMeio(e, spec)}
    onMouseDown={e => { if (e.button === 1) e.preventDefault(); }} onContextMenu={e => nav.aoClicarDireito(e, spec)}>{children}</button>;
}

function linha(texto: string, rows: readonly LinhaCompendio[], onAbrir: (s: TabSpec) => void): ReactNode[] {
  const partes: ReactNode[] = [];
  let ultimo = 0;
  for (const m of texto.matchAll(REF)) {
    if (m.index > ultimo) partes.push(texto.slice(ultimo, m.index));
    const id = m[2].toLowerCase(), spec = rows.find(r => r.id === id)?.spec ?? registroSpec(id, m[1]);
    partes.push(<BotaoReferencia key={m.index} spec={spec} onAbrir={onAbrir}>{m[1]}</BotaoReferencia>);
    ultimo = m.index + m[0].length;
  }
  if (ultimo < texto.length) partes.push(texto.slice(ultimo));
  return partes;
}

/** Leitura contínua: parágrafos separados por linha em branco; linha iniciada por `## ` é um subtítulo. */
export function TextoNarrativo({ texto, rows, onAbrir }: { texto: string; rows: readonly LinhaCompendio[]; onAbrir: (s: TabSpec) => void }) {
  return <>{texto.split(/\n{2,}/).filter(p => p.trim()).map((p, i) => {
    const titulo = /^##\s+(.+?)(?:\n([\s\S]*))?$/.exec(p.trim());
    if (!titulo) return <p key={i} className="cd-texto">{linha(p, rows, onAbrir)}</p>;
    return <div key={i}><h3>{titulo[1]}</h3>{titulo[2] && <p className="cd-texto">{linha(titulo[2], rows, onAbrir)}</p>}</div>;
  })}</>;
}

/** Área de texto com busca de registros ao digitar `@`. O texto entre colchetes pode ser trocado livremente. */
export function CampoNarrativo({ label, value, onChange, maxLength, rows }: {
  label: string; value: string; onChange: (v: string) => void; maxLength: number; rows: readonly LinhaCompendio[];
}) {
  const id = useId(), area = useRef<HTMLTextAreaElement>(null);
  const [busca, setBusca] = useState<{ inicio: number; fim: number; termo: string } | null>(null);
  const atualizar = (texto: string, caret: number) => {
    const m = /(?:^|[\s(])@([^@\n[\]]{0,40})$/.exec(texto.slice(0, caret));
    setBusca(m ? { inicio: caret - m[1].length - 1, fim: caret, termo: m[1] } : null);
  };
  const achados = busca ? rows.filter(r => (r.entry || r.pc) && normalizar(r.title).includes(normalizar(busca.termo))).slice(0, 6) : [];
  const escolher = (r: LinhaCompendio) => {
    if (!busca) return;
    onChange((value.slice(0, busca.inicio) + montarReferencia(r.title, r.id) + value.slice(busca.fim)).slice(0, maxLength));
    setBusca(null);
    area.current?.focus();
  };
  return <div className="ref-campo">
    <label htmlFor={id}>{label}</label>
    <textarea ref={area} id={id} value={value} maxLength={maxLength} onKeyDown={e => { if (e.key === 'Escape' && busca) { e.stopPropagation(); setBusca(null); } }}
      onChange={e => { onChange(e.target.value); atualizar(e.target.value, e.target.selectionStart); }}/>
    {achados.length > 0 && <ul className="ref-sugestoes" aria-label={`Registros para citar em ${label}`}>{achados.map(r => <li key={r.id}>
      <button type="button" onClick={() => escolher(r)}><strong>{r.title}</strong><small>{nomesRegistro[r.category]}</small></button></li>)}</ul>}
  </div>;
}

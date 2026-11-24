// Seleção de encontro preparado para a Iniciativa, com escolha parcial de criaturas e quantidades. Nada é gravado aqui: devolve um encontro filtrado.
import { Swords } from "lucide-react";
import { useMemo, useState } from "react";
import type { Encontro } from "./combate";

type Marca = Record<string, { incluir: boolean; qtd: string }>;

/** Monta o encontro a enviar: só as criaturas marcadas, com as quantidades escolhidas (1 a 50). Pura, testável. */
export function selecionarParticipantes(enc: Encontro, marcas: Marca): Encontro {
  const participantes = enc.participantes.flatMap(p => {
    const m = marcas[p.id]; if (m && !m.incluir) return [];
    const n = m ? Number(m.qtd) : p.quantidade;
    return Number.isInteger(n) && n >= 1 && n <= 50 ? [{ ...p, quantidade: n }] : [];
  });
  return { ...enc, participantes };
}

function CartaoEncontro({ enc, onEnviar }: { enc: Encontro; onEnviar: (e: Encontro) => void }) {
  const [marcas, setMarcas] = useState<Marca>(() => Object.fromEntries(enc.participantes.map(p => [p.id, { incluir: true, qtd: String(p.quantidade) }])));
  const escolhido = useMemo(() => selecionarParticipantes(enc, marcas), [enc, marcas]);
  const total = escolhido.participantes.reduce((s, p) => s + p.quantidade, 0);
  return <li className="ini-enc-sel">
    <strong>{enc.nome}</strong>
    {enc.participantes.length === 0 ? <p className="muted">Sem criaturas.</p> : <ul className="ini-enc-criaturas">{enc.participantes.map(p => <li key={p.id}>
      <label className="ini-enc-marca"><input type="checkbox" aria-label={`Incluir ${p.nome} de ${enc.nome}`} checked={marcas[p.id]?.incluir ?? true} onChange={e => setMarcas(m => ({ ...m, [p.id]: { incluir: e.target.checked, qtd: m[p.id]?.qtd ?? String(p.quantidade) } }))}/> {p.nome}</label>
      <input className="ini-enc-qtd" inputMode="numeric" aria-label={`Quantidade de ${p.nome} a enviar de ${enc.nome}`} value={marcas[p.id]?.qtd ?? String(p.quantidade)} onChange={e => setMarcas(m => ({ ...m, [p.id]: { incluir: m[p.id]?.incluir ?? true, qtd: e.target.value } }))}/>
      <small className="muted">de {p.quantidade}</small></li>)}</ul>}
    <button type="button" className="btn-secondary" disabled={total === 0} onClick={() => onEnviar(escolhido)} aria-label={`Incluir no combate: ${enc.nome}`}><Swords size={14} aria-hidden="true"/> Incluir {total || ""} no combate</button>
  </li>;
}

/** Quem já está no combate é preservado (o chamador só acrescenta). Sem encontros: orientação para criá-los. */
export function SeletorEncontro({ encontros, onEnviar }: { encontros: readonly Encontro[] | null; onEnviar: (e: Encontro) => void }) {
  const [aberto, setAberto] = useState(false);
  return <details className="ini-seletor" open={aberto} onToggle={e => setAberto((e.target as HTMLDetailsElement).open)}>
    <summary>Adicionar encontro preparado</summary>
    {encontros === null ? <p className="muted" role="status">Carregando os encontros…</p>
      : encontros.length === 0 ? <p className="muted">Nenhum encontro preparado. Crie um em Encontros.</p>
      : <><p className="muted">Escolha quais criaturas e quantas entram. Quem já está no combate continua lá.</p><ul className="ini-enc-lista">{encontros.map(enc => <CartaoEncontro key={enc.id} enc={enc} onEnviar={onEnviar}/>)}</ul></>}
  </details>;
}

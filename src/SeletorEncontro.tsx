// Seleção de encontro preparado para a Iniciativa, com escolha parcial de criaturas e quantidades. Nada é gravado aqui: devolve um encontro filtrado.
import { Swords } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { instanciasParaEnviar, type Encontro } from "./combate";

const disponivel = (enc: Encontro, id: string, quantidade: number) => Math.max(0, quantidade - (enc.atual?.criaturas.filter(c => c.participanteId === id && (c.noCombate || c.situacao === "derrotada")).length ?? 0));

type Marca = Record<string, { incluir: boolean; qtd: string }>;

/** Monta o encontro a enviar: só as criaturas marcadas, com as quantidades escolhidas (1 a 50). Pura, testável. */
export function selecionarParticipantes(enc: Encontro, marcas: Marca): Encontro {
  const participantes = enc.participantes.flatMap(p => {
    const m = marcas[p.id]; if (m && !m.incluir) return [];
    const n = m ? Number(m.qtd) : p.quantidade;
    return Number.isInteger(n) && n >= 1 && n <= disponivel(enc, p.id, p.quantidade) ? [{ ...p, quantidade: n }] : [];
  });
  return { ...enc, participantes };
}

function CartaoEncontro({ enc, onEnviar }: { enc: Encontro; onEnviar: (e: Encontro) => void }) {
  const disponiveis = useMemo(() => instanciasParaEnviar(enc), [enc]);
  const [ids, setIds] = useState(() => disponiveis.map(c => c.criaturaId));
  const escolhidos = disponiveis.filter(c => ids.includes(c.criaturaId));
  const marcar = (grupo: string[], incluir: boolean) => setIds(antes => incluir ? [...new Set([...antes, ...grupo])] : antes.filter(id => !grupo.includes(id)));
  return <li className="ini-enc-sel">
    <strong>{enc.nome}</strong><div className="ini-barra"><button type="button" className="btn-secondary" onClick={() => setIds(disponiveis.map(c => c.criaturaId))}>Selecionar todos</button><button type="button" className="btn-secondary" onClick={() => setIds([])}>Limpar seleção</button></div>
    {!disponiveis.length && <p className="muted">Sem criaturas disponíveis. As que estão em combate ou derrotadas não serão duplicadas.</p>}
    <ul className="ini-enc-criaturas">{enc.participantes.map(p => {
      const grupo = disponiveis.filter(c => c.participanteId === p.id), marcados = grupo.filter(c => ids.includes(c.criaturaId));
      return <li key={p.id}><label><input type="checkbox" aria-label={`Incluir ${p.nome} de ${enc.nome}`} disabled={!grupo.length} checked={!!grupo.length && marcados.length === grupo.length} onChange={e => marcar(grupo.map(c => c.criaturaId), e.target.checked)}/> {p.nome}</label>
        <input className="ini-enc-qtd" type="number" min={0} max={grupo.length} aria-label={`Quantidade de ${p.nome} a enviar de ${enc.nome}`} value={marcados.length} onChange={e => { const n = Number(e.target.value); if (Number.isInteger(n) && n >= 0 && n <= grupo.length) { marcar(grupo.map(c => c.criaturaId), false); marcar(grupo.slice(0, n).map(c => c.criaturaId), true); } }}/>
        <small className="muted">de {grupo.length} disponíveis · {p.quantidade} no grupo</small>
        <details className="enc-individuais"><summary>Escolher criaturas específicas</summary>{grupo.map(c => <label key={c.criaturaId}><input type="checkbox" checked={ids.includes(c.criaturaId)} onChange={e => marcar([c.criaturaId], e.target.checked)}/> {c.nome}{c.pvMax ? ` · PV ${c.pv}/${c.pvMax}` : ""}{c.ca ? ` · CA ${c.ca}` : ""}</label>)}</details>
      </li>;
    })}</ul>
    <button type="button" className="btn-secondary" disabled={!escolhidos.length} onClick={() => onEnviar({ ...enc, selecao: escolhidos.map(c => c.criaturaId) })} aria-label={`Incluir no combate: ${enc.nome}`}><Swords size={14} aria-hidden="true"/> Incluir {escolhidos.length || ""} no combate</button>
  </li>;
}

/** Quem já está no combate é preservado (o chamador só acrescenta). Sem encontros: orientação para criá-los. */
export function SeletorEncontro({ encontros, onEnviar, rotulo = "Adicionar encontro preparado", automatico = false, aoFechar }: { encontros: readonly Encontro[] | null; onEnviar: (e: Encontro) => void; rotulo?: string; automatico?: boolean; aoFechar?: () => void }) {
  const [aberto, setAberto] = useState(automatico);
  const dialogo = useRef<HTMLDialogElement>(null);
  useEffect(() => { if (aberto && !dialogo.current?.open) dialogo.current?.showModal(); }, [aberto]);
  const fechar = () => { dialogo.current?.close(); setAberto(false); };
  return <>{!automatico && <button type="button" className="btn-secondary" onClick={() => setAberto(true)}><Swords size={15} aria-hidden="true"/> {rotulo}</button>}
    <dialog ref={dialogo} className="ini-dialogo" aria-label={rotulo} onClose={() => { setAberto(false); aoFechar?.(); }}>
      {aberto && <><h3>{rotulo}</h3>
      {encontros === null ? <p className="muted" role="status">Carregando os encontros…</p>
      : encontros.length === 0 ? <p className="muted">Nenhum encontro preparado. Crie um em Encontros.</p>
      : <><p className="muted">Escolha as criaturas disponíveis. Quem já está no combate continua lá.</p><ul className="ini-enc-lista">{encontros.map(enc => <CartaoEncontro key={enc.id} enc={enc} onEnviar={e => { onEnviar(e); fechar(); }}/>)}</ul></>}
      <button type="button" className="btn-secondary" onClick={fechar}>Cancelar</button></>}
    </dialog></>;
}

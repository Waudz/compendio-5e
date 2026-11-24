// Seção "Loot e recompensas" da página do encontro: configuração (recompensas gerais e recipientes) e andamento (encontrado, coletado, distribuído).
// A entrega automática a fichas/inventários não existe ainda: "distribuído" é o registro do mestre.
import { Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { novoId, type Encontro } from "./combate";
import { LootEditor } from "./LootEditor";
import { ROTULO_LOOT, ROTULO_MOEDA, ajustarColeta, ajustarDistribuicao, estadoLoot, marcarEncontrado, restante, type LinhaLoot, type Recipiente } from "./loot";

function Linha({ l, enc, salvar }: { l: LinhaLoot; enc: Encontro; salvar: (e: Encontro) => void }) {
  const [qtd, setQtd] = useState("1");
  const n = Number(qtd), estado = estadoLoot(l), nome = l.moeda ? ROTULO_MOEDA[l.moeda] : l.nome;
  return <li className="loot-linha" data-estado={estado}>
    <span className="loot-nome"><strong>{l.quantidade}× {nome}</strong> <span className="enc-estado" data-loot={estado}>{ROTULO_LOOT[estado]}</span>
      <small className="muted"> coletado {l.coletada}/{l.quantidade} · distribuído {l.distribuida}/{l.quantidade}</small>{l.descricao && <small className="muted"> — {l.descricao}</small>}</span>
    <div className="loot-acoes">
      {l.coletada === 0 && <button type="button" className="btn-secondary" onClick={() => salvar(marcarEncontrado(enc, l.id, !l.encontrado))}>{l.encontrado ? "Desmarcar encontrado" : "Marcar encontrado"}<span className="sr-only">: {nome}</span></button>}
      <input className="loot-qtd" inputMode="numeric" aria-label={`Quantidade a mover de ${nome}`} value={qtd} onChange={e => setQtd(e.target.value)}/>
      <button type="button" className="btn-secondary" disabled={l.coletada >= l.quantidade} onClick={() => salvar(ajustarColeta(enc, l.id, n))} aria-label={`Coletar ${nome}`}>Coletar</button>
      <button type="button" className="btn-secondary" disabled={l.coletada <= l.distribuida} onClick={() => salvar(ajustarColeta(enc, l.id, -n))} aria-label={`Desfazer coleta de ${nome}`}>Desfazer coleta</button>
      <button type="button" className="btn-secondary" disabled={restante(l) <= 0 || l.coletada <= l.distribuida} onClick={() => salvar(ajustarDistribuicao(enc, l.id, n))} aria-label={`Distribuir ${nome}`}>Distribuir</button>
      <button type="button" className="btn-secondary" disabled={l.distribuida <= 0} onClick={() => salvar(ajustarDistribuicao(enc, l.id, -n))} aria-label={`Desfazer distribuição de ${nome}`}>Desfazer distribuição</button>
    </div>
  </li>;
}

/** Andamento do loot, agrupado por origem. Cada grupo é recolhível; grupos resolvidos começam fechados. */
function Andamento({ enc, salvar }: { enc: Encontro; salvar: (e: Encontro) => void }) {
  const linhas = enc.atual?.loot ?? [];
  const grupos = new Map<string, { titulo: string; linhas: LinhaLoot[] }>();
  for (const l of linhas) {
    const chave = l.origem.tipo === "criatura" ? `c${l.origem.criaturaId}` : l.origem.tipo === "recipiente" ? `r${l.origem.recipienteId}` : "g";
    const titulo = l.origem.tipo === "criatura" ? `Loot de ${enc.atual?.criaturas.find(c => c.id === (l.origem as { criaturaId: string }).criaturaId)?.nome ?? "criatura"}`
      : l.origem.tipo === "recipiente" ? (enc.recipientes?.find(r => r.id === (l.origem as { recipienteId: string }).recipienteId)?.nome ?? "Recipiente removido") : "Recompensas gerais";
    (grupos.get(chave) ?? grupos.set(chave, { titulo, linhas: [] }).get(chave)!).linhas.push(l);
  }
  if (!grupos.size) return null;
  return <div className="loot-andamento" role="group" aria-label="Andamento do loot">
    <h4>Andamento do loot</h4>
    {[...grupos.entries()].map(([k, g]) => <details key={k} open={g.linhas.some(l => restante(l) > 0)} className="loot-grupo">
      <summary>{g.titulo} <small className="muted">({g.linhas.filter(l => restante(l) <= 0).length}/{g.linhas.length} distribuídos)</small></summary>
      <ul className="loot-lista">{g.linhas.map(l => <Linha key={l.id} l={l} enc={enc} salvar={salvar}/>)}</ul>
    </details>)}
  </div>;
}

export function LootEncontro({ enc, salvar }: { enc: Encontro; salvar: (e: Encontro) => void }) {
  const [nome, setNome] = useState(""), [desc, setDesc] = useState("");
  const recompensas = enc.recompensas ?? [], recipientes = enc.recipientes ?? [];
  const mudarRec = (id: string, f: (r: Recipiente) => Recipiente) => salvar({ ...enc, recipientes: recipientes.map(r => (r.id === id ? f(r) : r)) });
  const novoRecipiente = (e: React.FormEvent) => {
    e.preventDefault(); const n = nome.trim(); if (!n) return;
    salvar({ ...enc, recipientes: [...recipientes, { id: novoId(), nome: n.slice(0, 60), ...(desc.trim() ? { descricao: desc.trim().slice(0, 300) } : {}), itens: [] }] }); setNome(""); setDesc("");
  };
  return <section className="enc-loot" aria-label="Loot do encontro">
    <h3>Loot e recompensas</h3>
    <section className="enc-bloco">
      <h4>Recompensas gerais <small className="muted">({recompensas.length})</small></h4>
      <LootEditor rotulo="recompensas gerais" itens={recompensas} onChange={i => salvar({ ...enc, recompensas: i })}/>
    </section>
    <section className="enc-bloco">
      <h4>Recipientes <small className="muted">({recipientes.length})</small></h4>
      <form className="ini-form" aria-label="Novo recipiente" onSubmit={novoRecipiente}>
        <label>Nome do recipiente<input value={nome} maxLength={60} onChange={e => setNome(e.target.value)} required placeholder="Baú, armário, saco…"/></label>
        <label>Descrição (opcional)<input value={desc} maxLength={300} onChange={e => setDesc(e.target.value)}/></label>
        <button type="submit" className="btn-secondary"><Plus size={15} aria-hidden="true"/> Criar recipiente</button>
      </form>
      {recipientes.map(r => <details key={r.id} className="loot-recipiente" aria-label={`Recipiente ${r.nome}`}>
        <summary>{r.nome} <small className="muted">({r.itens.length} item(ns))</small></summary>
        {r.descricao && <p className="muted">{r.descricao}</p>}
        <LootEditor rotulo={r.nome} itens={r.itens} onChange={i => mudarRec(r.id, x => ({ ...x, itens: i }))}/>
        <button type="button" className="btn-secondary" onClick={() => { if (window.confirm(`Remover o recipiente "${r.nome}" e a configuração dos itens dele? O que já foi coletado ou distribuído continua registrado.`)) salvar({ ...enc, recipientes: recipientes.filter(x => x.id !== r.id) }); }} aria-label={`Remover recipiente ${r.nome}`}><Trash2 size={14} aria-hidden="true"/> Remover recipiente</button>
      </details>)}
    </section>
    <Andamento enc={enc} salvar={salvar}/>
  </section>;
}

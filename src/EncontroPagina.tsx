// Página individual de um encontro (aberta na mesma aba da lista): nome, descrição e criaturas editáveis. Só edita o próprio encontro; o catálogo nunca é alterado.
import { ArrowLeft, Minus, Pencil, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { adicionarParticipante, definirDescricao, editarParticipante, removerParticipante, renomearEncontro, type Encontro, type ParticipanteEncontro, type RefCombate } from "./combate";
import type { Monstro } from "./catalogue/sistemas/dnd5e-2014/esquemas";
import { RetratoQuadrado } from "./RetratoCombate";
import { SeletorEncontro } from "./SeletorEncontro";
import { SeletorMonstro, numero } from "./CombateCompartilhado";

function Criatura({ enc, p, salvar }: { enc: Encontro; p: ParticipanteEncontro; salvar: (e: Encontro) => void }) {
  const [editando, setEditando] = useState(false);
  const [f, setF] = useState({ nome: p.nome, quantidade: String(p.quantidade), pv: p.pv ? String(p.pv) : "", ca: p.ca ? String(p.ca) : "", notas: p.notas ?? "" });
  const [erro, setErro] = useState(false);
  const mudarQtd = (n: number) => { if (Number.isInteger(n) && n >= 1 && n <= 50 && n !== p.quantidade) salvar(editarParticipante(enc, p.id, { quantidade: n })); };
  const abrir = () => { setF({ nome: p.nome, quantidade: String(p.quantidade), pv: p.pv ? String(p.pv) : "", ca: p.ca ? String(p.ca) : "", notas: p.notas ?? "" }); setErro(false); setEditando(true); };
  const enviarEdicao = (e: React.FormEvent) => {
    e.preventDefault();
    const q = numero(f.quantidade), pv = f.pv.trim() ? numero(f.pv) : null, ca = f.ca.trim() ? numero(f.ca) : null;
    const novo = q === undefined || pv === undefined || ca === undefined ? enc : editarParticipante(enc, p.id, { nome: f.nome, quantidade: q, pv, ca, notas: f.notas });
    if (novo === enc) { setErro(true); return; }
    salvar(novo); setEditando(false);
  };
  const tipo = p.ref?.tipo === "monstro" ? "monstro" : "avulso";
  if (editando) return <li className="enc-criatura editando">
    <form className="ini-form" aria-label={`Editar ${p.nome}`} onSubmit={enviarEdicao}>
      <label>Nome<input value={f.nome} onChange={e => setF({ ...f, nome: e.target.value })} required maxLength={60}/></label>
      <label>Quantidade<input inputMode="numeric" value={f.quantidade} onChange={e => setF({ ...f, quantidade: e.target.value })}/></label>
      <label>PV de cada<input inputMode="numeric" value={f.pv} onChange={e => setF({ ...f, pv: e.target.value })}/></label>
      <label>CA<input inputMode="numeric" value={f.ca} onChange={e => setF({ ...f, ca: e.target.value })}/></label>
      <label className="enc-notas">Notas<textarea rows={2} maxLength={500} value={f.notas} onChange={e => setF({ ...f, notas: e.target.value })}/></label>
      {erro && <p role="alert" className="muted">Confira os valores: quantidade de 1 a 50, PV e CA positivos.</p>}
      {p.ref?.tipo === "monstro" && <p className="muted">Esta é uma cópia só deste encontro; o Bestiário não é alterado.</p>}
      <button type="submit" className="btn-secondary">Salvar criatura</button><button type="button" className="btn-secondary" onClick={() => setEditando(false)}>Cancelar</button>
    </form></li>;
  return <li className="enc-criatura">
    <RetratoQuadrado tipo={tipo} tamanho={44}/>
    <div className="enc-criatura-info"><strong>{p.nome}</strong>
      <small>{p.ref?.tipo === "monstro" ? "Bestiário" : "Avulsa"}{p.pv ? ` · PV ${p.pv}` : ""}{p.ca ? ` · CA ${p.ca}` : ""}</small>
      {p.notas && <small className="muted">{p.notas}</small>}</div>
    <div className="ini-pv-controles">
      <button className="btn-secondary ini-icone" onClick={() => mudarQtd(p.quantidade - 1)} aria-label={`Diminuir quantidade de ${p.nome}`} title="Menos um"><Minus size={14} aria-hidden="true"/></button>
      <input aria-label={`Quantidade de ${p.nome} em ${enc.nome}`} inputMode="numeric" defaultValue={p.quantidade} key={p.quantidade} onBlur={e => { const n = numero(e.target.value); if (n !== undefined) mudarQtd(n); }}/>
      <button className="btn-secondary ini-icone" onClick={() => mudarQtd(p.quantidade + 1)} aria-label={`Aumentar quantidade de ${p.nome}`} title="Mais um"><Plus size={14} aria-hidden="true"/></button></div>
    <button className="btn-secondary ini-icone" onClick={abrir} aria-label={`Editar criatura ${p.nome}`} title="Editar"><Pencil size={14} aria-hidden="true"/></button>
    <button className="btn-secondary ini-icone" onClick={() => salvar(removerParticipante(enc, p.id))} aria-label={`Remover ${p.nome} de ${enc.nome}`} title="Remover"><Trash2 size={14} aria-hidden="true"/></button>
  </li>;
}

export function EncontroPagina({ enc, salvar, voltar, enviar }: { enc: Encontro; salvar: (e: Encontro) => void; voltar: () => void; enviar: (e: Encontro) => void }) {
  const [renomeando, setRenomeando] = useState(false), [novoNome, setNovoNome] = useState(enc.nome);
  const [nome, setNome] = useState(""), [qtd, setQtd] = useState("1"), [pv, setPv] = useState(""), [ca, setCa] = useState("");
  const adicionarMonstro = (m: Monstro) => salvar(adicionarParticipante(enc, { nome: m.nome, quantidade: 1, pv: m.pv, ca: m.ca, ref: { tipo: "monstro", id: m.id } as RefCombate }));
  const total = enc.participantes.reduce((s, p) => s + p.quantidade, 0);
  return <section className="enc-pagina" aria-label={`Página do encontro ${enc.nome}`}>
    <button className="btn-link" onClick={voltar}><ArrowLeft size={14} aria-hidden="true"/> Voltar à lista de encontros</button>
    {renomeando
      ? <form className="ini-form" aria-label={`Renomear ${enc.nome}`} onSubmit={e => { e.preventDefault(); salvar(renomearEncontro(enc, novoNome)); setRenomeando(false); }}>
        <label>Novo nome<input value={novoNome} onChange={e => setNovoNome(e.target.value)} required maxLength={80}/></label>
        <button type="submit" className="btn-secondary">Salvar nome</button><button type="button" className="btn-secondary" onClick={() => setRenomeando(false)}>Cancelar</button></form>
      : <h2>{enc.nome} <button className="btn-link" onClick={() => { setNovoNome(enc.nome); setRenomeando(true); }} aria-label={`Renomear encontro ${enc.nome}`}><Pencil size={13} aria-hidden="true"/></button></h2>}
    <label className="enc-descricao">Descrição<textarea rows={3} maxLength={2000} defaultValue={enc.descricao ?? ""} key={enc.descricao ?? ""} placeholder="O que acontece, onde, como começa…"
      onBlur={e => { if (e.target.value.trim() !== (enc.descricao ?? "")) salvar(definirDescricao(enc, e.target.value)); }}/></label>
    <h3>Criaturas <small className="muted">{enc.participantes.length ? `${enc.participantes.length} tipo(s), ${total} no total` : ""}</small></h3>
    {enc.participantes.length === 0 ? <p className="muted">Sem criaturas. Adicione do Bestiário ou crie uma avulsa abaixo (um encontro também pode não ter combate).</p>
      : <ul className="enc-criaturas">{enc.participantes.map(p => <Criatura key={p.id} enc={enc} p={p} salvar={salvar}/>)}</ul>}
    <SeletorMonstro rotulo="Adicionar do Bestiário" onEscolher={adicionarMonstro}/>
    <form className="ini-form" aria-label={`Adicionar participante a ${enc.nome}`} onSubmit={e => { e.preventDefault(); salvar(adicionarParticipante(enc, { nome, quantidade: numero(qtd) ?? 1, pv: numero(pv), ca: numero(ca) })); setNome(""); setQtd("1"); setPv(""); setCa(""); }}>
      <label>Nome<input value={nome} onChange={e => setNome(e.target.value)} required maxLength={60}/></label>
      <label>Quantidade<input inputMode="numeric" value={qtd} onChange={e => setQtd(e.target.value)}/></label>
      <label>PV de cada (opcional)<input inputMode="numeric" value={pv} onChange={e => setPv(e.target.value)}/></label>
      <label>CA (opcional)<input inputMode="numeric" value={ca} onChange={e => setCa(e.target.value)}/></label>
      <button type="submit" className="btn-secondary"><Plus size={15} aria-hidden="true"/> Adicionar</button>
    </form>
    <SeletorEncontro rotulo="Enviar só parte para a Iniciativa" encontros={[enc]} onEnviar={enviar}/>
  </section>;
}

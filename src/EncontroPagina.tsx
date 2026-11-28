import {useRetornoLocal} from "./retornoLocal";
// Página individual de um encontro (aberta na mesma aba da lista): nome, descrição e criaturas editáveis. Só edita o próprio encontro; o catálogo nunca é alterado.
import { SeletorNpc, type NpcEscolhido } from "./npc/SeletorNpc";
import { ArrowLeft,Pencil, Plus, Trash2 } from "lucide-react";
import { useRef,useState } from "react";
import { adicionarParticipante, configurarCriatura, personalizarCriatura, definirDescricao, editarParticipante, removerParticipante, renomearEncontro, type Encontro, type ParticipanteEncontro, type RefCombate } from "./combate";
import type { Monstro } from "./catalogue/sistemas/dnd5e-2014/esquemas";
import { ControleNumerico } from "./ControleNumerico";
import { CriaturaIdentidade } from "./CriaturaIdentidade";
import { ROTULO_ESTADO, avisoEntregas, concluirEncontro, estadoDe, iniciarSemCombate, normalizarLoot, pendencias, podeRestaurar, reabrirEncontro, restaurarOriginal } from "./estadoEncontro";
import { LootEditor } from "./LootEditor";
import { LootEncontro, AndamentoLoot } from "./LootEncontro";
import { SeletorEncontro } from "./SeletorEncontro";
import { SeletorMonstro, numero } from "./CombateCompartilhado";

function Criatura({ enc, p, salvar }: { enc: Encontro; p: ParticipanteEncontro; salvar: (e: Encontro) => void }) {
  const [editando, setEditando] = useState(false);
  const [expandido, setExpandido] = useState(false);
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
  const tipo = p.ref?.tipo === "monstro" ? "monstro" : p.ref ? "npc" : "avulso";
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
    <CriaturaIdentidade nome={p.nome} tipo={tipo} referencia={p.ref} className="enc-criatura-info" detalhes={<>{p.ref?.tipo === "monstro" ? "Bestiário" : "Avulsa"}{p.pv ? ` · PV ${p.pv}` : ""}{p.ca ? ` · CA ${p.ca}` : ""}</>}>{p.notas && <small className="muted">{p.notas}</small>}</CriaturaIdentidade>
    <ControleNumerico campo={{ "aria-label": `Quantidade de ${p.nome} em ${enc.nome}`, defaultValue: p.quantidade, onBlur: e => { const n = numero(e.target.value); if (n !== undefined) mudarQtd(n); } }} key={p.quantidade} menos={{ rotulo: `Diminuir quantidade de ${p.nome}`, titulo: "Menos um", acao: () => mudarQtd(p.quantidade - 1) }} mais={{ rotulo: `Aumentar quantidade de ${p.nome}`, titulo: "Mais um", acao: () => mudarQtd(p.quantidade + 1) }}/>
    <button className="btn-secondary ini-icone" onClick={abrir} aria-label={`Editar criatura ${p.nome}`} title="Editar"><Pencil size={14} aria-hidden="true"/></button>
    <button className="btn-secondary ini-icone" onClick={() => salvar(removerParticipante(enc, p.id))} aria-label={`Remover ${p.nome} de ${enc.nome}`} title="Remover"><Trash2 size={14} aria-hidden="true"/></button>
    <div className="enc-individuais"><button type="button" className="btn-secondary" aria-expanded={expandido} onClick={() => setExpandido(!expandido)}>Personalizar indivíduos ({p.quantidade})</button>
      {expandido && <ul className="enc-instancias">{Array.from({ length: p.quantidade }, (_, i) => <Individual key={`${p.id}#${i + 1}`} enc={enc} p={p} n={i + 1} salvar={salvar}/>)}</ul>}</div>
    <section className="enc-loot-criatura" aria-label={`Loot de cada ${p.nome}`}><h4>Loot de cada {p.nome} <small className="muted">({p.loot?.length ?? 0})</small></h4>
      <LootEditor rotulo={`loot de ${p.nome}`} itens={p.loot ?? []} onChange={loot => salvar({ ...enc, participantes: enc.participantes.map(x => { if (x.id !== p.id) return x; const { loot: _l, ...resto } = x; void _l; return loot.length ? { ...resto, loot } : resto; }) })}/></section>
  </li>;
}

/** Estado do encontro: configuração original (editável abaixo) x estado atual (o que já aconteceu). */
function Individual({ enc, p, n, salvar }: { enc: Encontro; p: ParticipanteEncontro; n: number; salvar: (e: Encontro) => void }) {
  const efetivo = configurarCriatura(p, n), id = `${p.id}#${n}`;
  const individual = p.individuais?.[String(n)] ?? {};
  const [editando, setEditando] = useState(false), [erro, setErro] = useState(false);
  const atual = enc.atual?.criaturas.find(c => c.id === id);
  const restaurar = () => { const individuais = { ...p.individuais }; delete individuais[String(n)]; salvar({ ...enc, participantes: enc.participantes.map(x => x.id === p.id ? { ...x, individuais } : x) }); };
  return <li className="enc-instancia">
    <CriaturaIdentidade nome={efetivo.nome ?? p.nome} tipo={p.ref?.tipo ?? "avulso"} referencia={p.ref} detalhes={<>{efetivo.pv ? `PV ${efetivo.pv}` : "Sem PV"}{efetivo.ca ? ` · CA ${efetivo.ca}` : ""}{atual?.noCombate ? " · no combate" : ""}</>}/>
    <button type="button" className="btn-secondary" onClick={() => setEditando(!editando)} aria-label={`Personalizar ${efetivo.nome}`}>Editar</button>
    {Object.keys(individual).length > 0 && <button type="button" className="btn-link" onClick={restaurar}>Usar padrões do grupo</button>}
    {editando && <form className="ini-form enc-individual-form" aria-label={`Personalização de ${id}`} onSubmit={e => {
      e.preventDefault(); const f = new FormData(e.currentTarget);
      const valores: typeof individual = { ...individual };
      for (const campo of ["nome", "notas"] as const) { const v = String(f.get(campo) ?? "").trim(); if (v) valores[campo] = v; else delete valores[campo]; }
      for (const campo of ["pv", "ca"] as const) { const v = String(f.get(campo) ?? "").trim(); if (v) valores[campo] = Number(v); else delete valores[campo]; }
      const novo = personalizarCriatura(enc, p.id, n, valores);
      if (novo === enc) { setErro(true); return; } salvar(novo); setEditando(false); setErro(false);
    }}>
      <p className="muted">Campos vazios herdam o grupo. Alterações de preparação não substituem PV já em jogo.</p>
      <label>Nome individual<input name="nome" maxLength={60} defaultValue={individual.nome ?? ""} placeholder={efetivo.nome}/></label>
      <label>PV individual<input name="pv" type="number" min={1} step={1} defaultValue={individual.pv ?? ""} placeholder={String(p.pv ?? "")}/></label>
      <label>CA individual<input name="ca" type="number" min={1} max={40} step={1} defaultValue={individual.ca ?? ""} placeholder={String(p.ca ?? "")}/></label>
      <label>Notas individuais<textarea name="notas" maxLength={500} defaultValue={individual.notas ?? ""}/></label>
      {erro && <p role="alert">Confira os valores de PV e CA.</p>}
      <button type="submit" className="btn-secondary">Salvar personalização</button>
    </form>}
    <section className="enc-loot-criatura" aria-label={`Loot de ${efetivo.nome}`}><h4>Loot de {efetivo.nome}</h4>
      <label><input type="checkbox" checked={individual.loot !== undefined} onChange={e => { const valores = { ...individual }; if (e.target.checked) valores.loot = structuredClone(efetivo.loot ?? []); else delete valores.loot; salvar(personalizarCriatura(enc, p.id, n, valores)); }}/> Loot próprio (substitui o grupo)</label>
      {individual.loot !== undefined && <LootEditor rotulo={`loot de ${efetivo.nome}`} itens={individual.loot} onChange={loot => salvar(personalizarCriatura(enc, p.id, n, { ...individual, loot }))}/>}
    </section>
  </li>;
}

function EstadoEncontro({ enc, salvar, sincronizar, duplicarAtual }: { enc: Encontro; salvar: (e: Encontro) => void; sincronizar: () => void; duplicarAtual: () => void }) {
  const estado = estadoDe(enc), emCombate = estado === "em_combate", pend = pendencias(enc);
  const concluir = () => { if (pend.length && !window.confirm(`Ainda há pendências (${pend.join("; ")}). Concluir mesmo assim?`)) return; salvar(concluirEncontro(enc)); };
  const restaurar = () => { if (window.confirm(`Restaurar "${enc.nome}" à configuração original? O estado atual (sobreviventes, PV, andamento e loot) será descartado.${avisoEntregas(enc) || " Itens já entregues a personagens não são desfeitos."}`)) salvar(restaurarOriginal(enc)); };
  return <section className="enc-estado-bloco" aria-label="Estado do encontro">
    <h3>Estado <span className="enc-estado" data-estado={estado}>{ROTULO_ESTADO[estado]}</span></h3>
    <p className="muted">A configuração original (criaturas abaixo) não muda durante o jogo. O que acontece fica no estado atual.</p>
    <div className="ini-barra">
      {estado === "preparado" && <button className="btn-secondary" onClick={() => salvar(iniciarSemCombate(enc))}>Iniciar sem combate</button>}
      {emCombate && <button className="btn-secondary" onClick={sincronizar}>Atualizar a partir do combate</button>}
      {estado === "concluido" && <button className="btn-secondary" onClick={() => salvar(reabrirEncontro(enc))}>Reabrir encontro</button>}
      {estado !== "concluido" && <button className="btn-secondary" onClick={concluir} disabled={emCombate} title={emCombate ? "Termine o combate ou atualize o estado primeiro" : undefined}>Concluir encontro</button>}
      <button className="btn-secondary" onClick={restaurar} disabled={!podeRestaurar(enc)} title={emCombate ? "Não é possível restaurar durante um combate ativo" : undefined}>Restaurar original</button>
      {enc.atual && <button className="btn-secondary" onClick={duplicarAtual}>Duplicar estado atual</button>}
    </div>
    {emCombate && <p className="muted" role="status">Há um combate ativo com criaturas deste encontro: restaurar e concluir ficam bloqueados até ele terminar.</p>}
    {enc.atual && (enc.atual.criaturas.length === 0 ? <p className="muted">Sem criaturas no estado atual.</p>
      : <ul className="enc-atual" aria-label="Estado atual das criaturas">{enc.atual.criaturas.map(c => <li key={c.id} data-situacao={c.situacao}><strong>{c.nome}</strong> <small>{c.situacao === "derrotada" ? "derrotada" : "viva"}{c.pvMax ? ` · PV ${c.pv ?? c.pvMax}/${c.pvMax}` : ""}{c.noCombate ? " · no combate" : ""}</small></li>)}</ul>)}
  </section>;
}

export function EncontroPagina({ enc, salvar: salvarBruto, voltar, enviar, sincronizar, duplicarAtual }: { enc: Encontro; salvar: (e: Encontro) => void; voltar: () => void; enviar: (e: Encontro) => void; sincronizar: () => void; duplicarAtual: () => void }) {
  const raiz=useRef<HTMLElement>(null);const temCabecalho=useRetornoLocal(voltar,raiz);
  const salvar = (e: Encontro) => salvarBruto(normalizarLoot(e));   // mantém o loot do estado atual em dia com a configuração
  const [aba, setAba] = useState<"criaturas" | "tesouros" | "progresso">("criaturas");
  const [renomeando, setRenomeando] = useState(false), [novoNome, setNovoNome] = useState(enc.nome);
  const [nome, setNome] = useState(""), [qtd, setQtd] = useState("1"), [pv, setPv] = useState(""), [ca, setCa] = useState("");
  const adicionarMonstro = (m: Monstro) => salvar(adicionarParticipante(enc, { nome: m.nome, quantidade: 1, pv: m.pv, ca: m.ca, ref: { tipo: "monstro", id: m.id } as RefCombate }));
  // NPC é uma identidade permanente: um participante, uma unidade
  const adicionarNpc = (n: NpcEscolhido) => { if (!enc.participantes.some(p => p.ref?.id === n.id)) salvar(adicionarParticipante(enc, { nome: n.nome, quantidade: 1, pv: n.pvMax, ...(n.tipo === "npc" ? { ca: n.ca } : {}), ref: { tipo: n.tipo, id: n.id } })); };
  const total = enc.participantes.reduce((s, p) => s + p.quantidade, 0);
  return <section ref={raiz} className="enc-pagina" aria-label={`Página do encontro ${enc.nome}`}>
    {!temCabecalho&&<button className="btn-link" onClick={voltar}><ArrowLeft size={14} aria-hidden="true"/> Voltar à lista de encontros</button>}
    {renomeando
      ? <form className="ini-form" aria-label={`Renomear ${enc.nome}`} onSubmit={e => { e.preventDefault(); salvar(renomearEncontro(enc, novoNome)); setRenomeando(false); }}>
        <label>Novo nome<input value={novoNome} onChange={e => setNovoNome(e.target.value)} required maxLength={80}/></label>
        <button type="submit" className="btn-secondary">Salvar nome</button><button type="button" className="btn-secondary" onClick={() => setRenomeando(false)}>Cancelar</button></form>
      : <h2>{enc.nome} <button className="btn-link" onClick={() => { setNovoNome(enc.nome); setRenomeando(true); }} aria-label={`Renomear encontro ${enc.nome}`}><Pencil size={13} aria-hidden="true"/></button></h2>}
    <label className="enc-descricao">Descrição<textarea rows={3} maxLength={2000} defaultValue={enc.descricao ?? ""} key={enc.descricao ?? ""} placeholder="O que acontece, onde, como começa…"
      onBlur={e => { if (e.target.value.trim() !== (enc.descricao ?? "")) salvar(definirDescricao(enc, e.target.value)); }}/></label>
    <div className="enc-subabas" role="group" aria-label="Seções do encontro">{(["criaturas", "tesouros", "progresso"] as const).map(v => <button key={v} type="button" className="btn-secondary" aria-pressed={aba === v} onClick={() => setAba(v)}>{v === "criaturas" ? "Criaturas" : v === "tesouros" ? "Tesouros" : "Progresso"}</button>)}</div>
    {aba === "progresso" && <><EstadoEncontro enc={enc} salvar={salvar} sincronizar={sincronizar} duplicarAtual={duplicarAtual}/><AndamentoLoot enc={enc} salvar={salvar}/></>}
    {aba === "criaturas" && <>
    <h3>Criaturas <small className="muted">{enc.participantes.length ? `${enc.participantes.length} tipo(s), ${total} no total` : ""}</small></h3>
    {enc.participantes.length === 0 ? <p className="muted">Sem criaturas. Adicione do Bestiário ou crie uma avulsa abaixo (um encontro também pode não ter combate).</p>
      : <ul className="enc-criaturas">{enc.participantes.map(p => <Criatura key={p.id} enc={enc} p={p} salvar={salvar}/>)}</ul>}
    <SeletorMonstro rotulo="Adicionar do Bestiário" onEscolher={adicionarMonstro}/>
    <SeletorNpc onEscolher={adicionarNpc}/>
    <form className="ini-form" aria-label={`Adicionar participante a ${enc.nome}`} onSubmit={e => { e.preventDefault(); salvar(adicionarParticipante(enc, { nome, quantidade: numero(qtd) ?? 1, pv: numero(pv), ca: numero(ca) })); setNome(""); setQtd("1"); setPv(""); setCa(""); }}>
      <label>Nome<input value={nome} onChange={e => setNome(e.target.value)} required maxLength={60}/></label>
      <label>Quantidade<input inputMode="numeric" value={qtd} onChange={e => setQtd(e.target.value)}/></label>
      <label>PV de cada (opcional)<input inputMode="numeric" value={pv} onChange={e => setPv(e.target.value)}/></label>
      <label>CA (opcional)<input inputMode="numeric" value={ca} onChange={e => setCa(e.target.value)}/></label>
      <button type="submit" className="btn-secondary"><Plus size={15} aria-hidden="true"/> Adicionar</button>
    </form>
    </>}
    {aba === "tesouros" && <LootEncontro enc={enc} salvar={salvar}/>}
    <SeletorEncontro rotulo="Enviar só parte para a Iniciativa" encontros={[enc]} onEnviar={enviar}/>
  </section>;
}

// Editor compacto de uma lista de loot (usado por criatura, recompensas gerais e recipientes). Itens do catálogo existente, personalizados ou moedas.
import { Plus, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { PesquisaCatalogo } from "./PesquisaCatalogo";
import { srdItemFile, describeItem } from "./catalogue/srd-2014-items";
import { novoId } from "./combate";
import { ROTULO_MOEDA, itemLootValido, textoLoot, type ItemLoot, type Moeda } from "./loot";

const sem = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
type Tipo = "catalogo" | "personalizado" | "moeda";

export function LootEditor({ itens, onChange, rotulo }: { itens: readonly ItemLoot[]; onChange: (i: ItemLoot[]) => void; rotulo: string }) {
  const [tipo, setTipo] = useState<Tipo>("catalogo"), [busca, setBusca] = useState(""), [nome, setNome] = useState(""), [desc, setDesc] = useState(""), [qtd, setQtd] = useState("1"), [moeda, setMoeda] = useState<Moeda>("gp"), [erro, setErro] = useState(false);
  const achados = useMemo(() => {
    if (tipo !== "catalogo" || busca.trim().length < 2) return [];
    const q = sem(busca.trim());
    return srdItemFile().items.filter(i => sem(i.nome).includes(q) || sem(i.en).includes(q)).slice(0, 8);
  }, [tipo, busca]);
  const q = Number(qtd);
  const incluir = (i: Omit<ItemLoot, "id">) => {
    const v = itemLootValido({ id: novoId(), ...i });
    if (!v) { setErro(true); return; }
    setErro(false); onChange([...itens, v]); setNome(""); setDesc(""); setBusca(""); setQtd("1");
  };
  const mudarQtd = (id: string, n: number) => { if (Number.isSafeInteger(n) && n >= 1 && n <= 9999) onChange(itens.map(i => (i.id === id ? { ...i, quantidade: n } : i))); };
  return <div className="loot-editor">
    {itens.length === 0 ? <p className="muted">Nada configurado.</p>
      : <ul className="loot-lista">{itens.map(i => <li key={i.id}>
        <span className="loot-nome"><strong>{i.moeda ? ROTULO_MOEDA[i.moeda] : i.nome}</strong>{i.itemId ? <small className="muted"> · catálogo</small> : i.moeda ? null : <small className="muted"> · personalizado</small>}{i.descricao && <small className="muted"> — {i.descricao}</small>}</span>
        <input className="loot-qtd" inputMode="numeric" aria-label={`Quantidade de ${i.moeda ? ROTULO_MOEDA[i.moeda] : i.nome} em ${rotulo}`} defaultValue={i.quantidade} key={i.quantidade} onBlur={e => mudarQtd(i.id, Number(e.target.value))}/>
        <button type="button" className="btn-secondary ini-icone" onClick={() => onChange(itens.filter(x => x.id !== i.id))} aria-label={`Remover ${textoLoot(i)} de ${rotulo}`} title="Remover"><Trash2 size={14} aria-hidden="true"/></button>
      </li>)}</ul>}
    <details className="loot-adicionar">
      <summary>Adicionar a {rotulo}</summary>
      <div className="ini-form">
        <label>Tipo<select aria-label={`Tipo de item em ${rotulo}`} value={tipo} onChange={e => setTipo(e.target.value as Tipo)}><option value="catalogo">Item do catálogo</option><option value="personalizado">Item personalizado</option><option value="moeda">Moeda</option></select></label>
        <label>Qtd.<input inputMode="numeric" aria-label={`Quantidade a adicionar em ${rotulo}`} value={qtd} onChange={e => setQtd(e.target.value)}/></label>
        {tipo === "catalogo" && <PesquisaCatalogo rotulo="Buscar item" valor={busca} onChange={setBusca} vazio={!achados.length} resultados={achados.map(i => <li key={i.id}><button type="button" className="btn-secondary" onClick={() => incluir({ itemId: i.id, nome: i.nome, quantidade: q })} aria-label={`Adicionar ${i.nome} do catálogo a ${rotulo}`}><strong>{i.nome}</strong><small>{describeItem(i)}</small></button></li>)}/>}
        {tipo === "personalizado" && <><label>Nome do item<input value={nome} maxLength={80} onChange={e => setNome(e.target.value)}/></label><label>Descrição (opcional)<input value={desc} maxLength={300} onChange={e => setDesc(e.target.value)}/></label></>}
        {tipo === "moeda" && <label>Moeda<select value={moeda} onChange={e => setMoeda(e.target.value as Moeda)}>{(Object.keys(ROTULO_MOEDA) as Moeda[]).map(m => <option key={m} value={m}>{ROTULO_MOEDA[m]}</option>)}</select></label>}
        {tipo !== "catalogo" && <button type="button" className="btn-secondary" onClick={() => incluir(tipo === "moeda" ? { moeda, nome: ROTULO_MOEDA[moeda], quantidade: q } : { nome, quantidade: q, descricao: desc })}><Plus size={15} aria-hidden="true"/> Incluir {tipo === "moeda" ? "moeda" : "item"}</button>}
      </div>
      {erro && <p role="alert" className="muted">Confira o nome e a quantidade (1 a 9999).</p>}
    </details>
  </div>;
}

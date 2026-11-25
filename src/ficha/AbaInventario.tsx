// Aba "Inventário": itens (lista ou grade), busca e filtros, equipar, moedas, carga e histórico. Armas equipadas geram ataques em
// Habilidades e armaduras/escudos entram na CA pelo motor 2014: nada aqui soma bônus por conta própria.
import { Backpack, LayoutGrid, List, Minus, Plus, Shield, Swords } from "lucide-react";
import { useEffect, useState } from "react";
import { srdItem } from "../catalogue/srd-2014-items";
import { itemSpec } from "../compendio/DetalheItem";
import { searchCompendium } from "../rules/compendium-query";
import { addInventoryInstance, changeInventoryInstanceQuantity, type InventoryEntry } from "../rules/character-domain";
import { criadorRules } from "../criador/catalogo-criador";
import { capacidadeDeCarga, categoriaDoItem, definirMoeda, MOEDAS_FICHA, pesoCarregado, podeEquipar, registrarMovimento, type ChaveMoeda } from "./estadoJogo";
import { novoId, type PropsAba } from "./tipos";

export type FiltroInv = "todos" | "equipados" | "armas" | "protecao" | "outros";
export type VistaInv = "lista" | "grade";
const FILTROS: [FiltroInv, string][] = [["todos", "Todos"], ["equipados", "Equipados"], ["armas", "Armas"], ["protecao", "Armaduras e escudos"], ["outros", "Outros"]];
const nome = (i: InventoryEntry) => (typeof i.customName === "string" ? i.customName : srdItem(i.itemId)?.nome ?? i.itemId);
const kg = (n: number) => `${n.toLocaleString("pt-BR", { maximumFractionDigits: 2 })} kg`;

type Props = PropsAba & { vista: VistaInv; onVista: (v: VistaInv) => void; filtro: FiltroInv; onFiltro: (f: FiltroInv) => void };

export function AbaInventario({ draft, sheet, stats, estado, onChange, onOpenContent, vista, onVista, filtro, onFiltro }: Props) {
  const [texto, setTexto] = useState(""), [novo, setNovo] = useState("");
  const peso = pesoCarregado(draft), capacidade = capacidadeDeCarga(sheet.abilities.str);
  const termo = texto.trim().toLocaleLowerCase("pt-BR");
  const itens = sheet.inventory.filter(i => (!termo || nome(i).toLocaleLowerCase("pt-BR").includes(termo)) && (filtro === "todos" || (filtro === "equipados" ? i.equipped : categoriaDoItem(i.itemId) === filtro)));
  const sugestoes = novo.trim().length >= 2 ? searchCompendium(criadorRules, { kind: "item", text: novo }).filter(l => srdItem(l.ref.id)?.raridade === "mundano").slice(0, 8) : [];

  const quantidade = (i: InventoryEntry, delta: 1 | -1) => onChange(registrarMovimento(changeInventoryInstanceQuantity(draft, i.id, delta),
    delta > 0 ? `+1 ${nome(i)}` : i.quantity === 1 ? `Removido: ${nome(i)}` : `−1 ${nome(i)}`));
  const equipar = (i: InventoryEntry, equipped: boolean) => onChange(registrarMovimento({ ...draft, inventory: draft.inventory.map(x => (x.id === i.id ? { ...x, equipped } : x)) }, `${equipped ? "Equipado" : "Desequipado"}: ${nome(i)}`));
  const adicionar = (itemId: string, rotulo: string) => { onChange(registrarMovimento(addInventoryInstance(draft, { id: novoId(), itemId, quantity: 1, equipped: false, origin: "acquired" }), `Adicionado: ${rotulo}`)); setNovo(""); };

  return <div className="ficha-colunas">
    <section className="ficha-bloco" aria-label="Moedas e carga">
      <h2>Moedas</h2>
      <div className="ficha-moedas">{MOEDAS_FICHA.map(([chave, rotulo]) => <Moeda key={chave} chave={chave} rotulo={rotulo} valor={draft.currency?.[chave] ?? 0} onDefinir={n => onChange(definirMoeda(draft, chave, n))}/>)}</div>
      <p><strong>Carga:</strong> <span data-testid="carga">{kg(peso)} de {kg(capacidade)}</span></p>
      <div className="ficha-barra" role="meter" aria-label="Carga" aria-valuemin={0} aria-valuemax={capacidade} aria-valuenow={Math.min(peso, capacidade)}><span style={{ width: `${Math.min(100, capacidade ? (peso / capacidade) * 100 : 0)}%` }} className={peso > capacidade ? "excesso" : ""}/></div>
      {peso > capacidade && <p role="note" className="notice err">Carga acima da capacidade.</p>}
      {stats.ambiguousArmor && <p role="note" className="notice err">Há mais de uma armadura equipada; revise o equipamento.</p>}
      {stats.armorWithoutProficiency && <p role="note" className="notice err">Há armadura equipada sem proficiência.</p>}
    </section>

    <section className="ficha-bloco ficha-larga" aria-label="Inventário do personagem">
      <div className="row-between"><h2>Itens</h2>
        <div className="row" role="group" aria-label="Exibição do inventário">
          <button type="button" className={"btn-secondary" + (vista === "lista" ? " active" : "")} aria-pressed={vista === "lista"} aria-label="Ver em lista" onClick={() => onVista("lista")}><List size={15} aria-hidden="true"/></button>
          <button type="button" className={"btn-secondary" + (vista === "grade" ? " active" : "")} aria-pressed={vista === "grade"} aria-label="Ver em grade" onClick={() => onVista("grade")}><LayoutGrid size={15} aria-hidden="true"/></button>
        </div></div>
      <div className="ficha-form">
        <input type="search" aria-label="Buscar no inventário" placeholder="Buscar no inventário" value={texto} onChange={e => setTexto(e.target.value)}/>
        <select aria-label="Filtrar inventário" value={filtro} onChange={e => onFiltro(e.target.value as FiltroInv)}>{FILTROS.map(([v, r]) => <option key={v} value={v}>{r}</option>)}</select>
      </div>
      {sheet.inventory.length === 0 ? <p className="muted">Inventário vazio.</p> : itens.length === 0 ? <p className="muted" role="status">Nenhum item com esse filtro.</p> :
        <ul className={"ficha-itens " + vista}>{itens.map(i => { const cat = categoriaDoItem(i.itemId), def = srdItem(i.itemId), Icone = cat === "armas" ? Swords : cat === "protecao" ? Shield : Backpack; return <li key={i.id} className={i.equipped ? "equipado" : ""}>
          <span className="ficha-item-icone" aria-hidden="true"><Icone size={18}/></span>
          <span className="ficha-item-nome">{def ? <button type="button" className="ficha-link" aria-label={`Consultar ${nome(i)} no Compêndio`} onClick={() => onOpenContent(itemSpec(i.itemId, nome(i)))}>{nome(i)}</button> : nome(i)}
            <small className="muted">×{i.quantity}{def?.peso != null ? ` · ${kg(def.peso * i.quantity)}` : ""}{i.equipped ? " · equipado" : ""}</small></span>
          <span className="ficha-item-acoes">
            {podeEquipar(i.itemId) && <label className="check"><input type="checkbox" aria-label={`Equipar ${nome(i)}`} checked={i.equipped} onChange={e => equipar(i, e.target.checked)}/> Equipar</label>}
            <button type="button" className="ficha-remover" aria-label={`Diminuir ${nome(i)}`} onClick={() => quantidade(i, -1)}><Minus size={14} aria-hidden="true"/></button>
            <button type="button" className="ficha-remover" aria-label={`Aumentar ${nome(i)}`} onClick={() => quantidade(i, 1)}><Plus size={14} aria-hidden="true"/></button>
          </span></li>; })}</ul>}
      <label className="ficha-adicionar">Adicionar item do catálogo<input type="search" aria-label="Adicionar item do catálogo" placeholder="Digite ao menos 2 letras" value={novo} onChange={e => setNovo(e.target.value)}/></label>
      {novo.trim().length >= 2 && <ul className="ficha-linhas" aria-label="Resultados da pesquisa de itens">
        {sugestoes.length === 0 && <li className="muted">Nenhum item mundano encontrado.</li>}
        {sugestoes.map(l => <li key={l.key}><span>{l.name}</span><button type="button" className="btn-secondary" aria-label={`Adicionar ${l.name}`} onClick={() => adicionar(l.ref.id, l.name)}><Plus size={14} aria-hidden="true"/> Adicionar</button></li>)}
      </ul>}
    </section>

    {estado.historico.length > 0 && <section className="ficha-bloco ficha-larga" aria-label="Histórico de movimentações">
      <details><summary>Histórico de movimentações ({estado.historico.length})</summary>
        <ol className="ficha-linhas">{estado.historico.map((m, i) => <li key={m.em + i}><span>{m.texto}</span><small className="muted">{m.em ? new Date(m.em).toLocaleString("pt-BR") : ""}</small></li>)}</ol></details>
    </section>}
  </div>;
}

/** Campo de moeda: grava ao sair ou com Enter, para não registrar cada tecla. */
function Moeda({ chave, rotulo, valor, onDefinir }: { chave: ChaveMoeda; rotulo: string; valor: number; onDefinir: (n: number) => void }) {
  const [texto, setTexto] = useState(String(valor));
  useEffect(() => setTexto(String(valor)), [valor]);
  const gravar = () => { const n = Number(texto); if (texto.trim() && Number.isSafeInteger(n) && n >= 0 && n <= 10_000_000) { if (n !== valor) onDefinir(n); } else setTexto(String(valor)); };
  return <label>{rotulo}<input type="number" inputMode="numeric" min={0} data-moeda={chave} aria-label={`Moedas ${rotulo}`} value={texto} onChange={e => setTexto(e.target.value)} onBlur={gravar} onKeyDown={e => { if (e.key === "Enter") gravar(); }}/></label>;
}

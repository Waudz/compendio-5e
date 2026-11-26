// Aba "Inventário": moedas e carga lado a lado, itens (lista ou grade) com busca, filtros e informações de jogo, adição pelo
// catálogo e histórico. Armas equipadas geram ataques em Habilidades e armaduras/escudos entram na CA pelo motor 2014: nada aqui
// soma bônus por conta própria. O que o jogador pode adicionar segue `catalogue/disponibilidade` (o banco aplica a mesma lista).
import { Backpack, FlaskConical, LayoutGrid, List, Minus, Plus, Shield, Swords, X } from "lucide-react";
import { useState } from "react";
import { jogadorPodeAdicionar } from "../catalogue/disponibilidade";
import { srdItem } from "../catalogue/srd-2014-items";
import { itemSpec } from "../compendio/DetalheItem";
import { searchCompendium } from "../rules/compendium-query";
import { addInventoryInstance, changeInventoryInstanceQuantity, type InventoryEntry } from "../rules/character-domain";
import { criadorRules } from "../criador/catalogo-criador";
import { CartaoMoedas } from "../moedas/CartaoMoedas";
import { TODAS_AS_MOEDAS, type ChaveMoeda } from "../moedas/moedas";
import { capacidadeDeCarga, categoriaDoItem, definirMoeda, pesoCarregado, podeEquipar, registrarMovimento } from "./estadoJogo";
import { imagemDoItem } from "./imagensCatalogo";
import { infoDoItem } from "./infoItem";
import { novoId, type PropsAba } from "./tipos";

export type FiltroInv = "todos" | "equipados" | "armas" | "protecao" | "consumiveis" | "outros";
export type VistaInv = "lista" | "grade";
const FILTROS: [FiltroInv, string][] = [["todos", "Todos"], ["equipados", "Equipados"], ["armas", "Armas"], ["protecao", "Armaduras e escudos"], ["consumiveis", "Poções e consumíveis"], ["outros", "Outros"]];
const nome = (i: InventoryEntry) => (typeof i.customName === "string" ? i.customName : srdItem(i.itemId)?.nome ?? i.itemId);
const kg = (n: number) => `${n.toLocaleString("pt-BR", { maximumFractionDigits: 2 })} kg`;

type Props = PropsAba & {
  vista: VistaInv; onVista: (v: VistaInv) => void; filtro: FiltroInv; onFiltro: (f: FiltroInv) => void;
  moedas?: readonly ChaveMoeda[]; /** O mestre pode entregar qualquer item. */ mestre?: boolean;
  usarItem: (instancia: string, cura: number) => Promise<string | null>;
  transferir?: (destino: string, instancia: string, quantidade: number) => Promise<string | null>;
  personagemId?: string; campaignId?: string;
};

export function AbaInventario({ draft, sheet, stats, estado, onChange, onOpenContent, vista, onVista, filtro, onFiltro, moedas = TODAS_AS_MOEDAS, mestre = false }: Props) {
  const [texto, setTexto] = useState(""), [novo, setNovo] = useState(""), [adicionando, setAdicionando] = useState(false);
  const peso = pesoCarregado(draft), capacidade = capacidadeDeCarga(sheet.abilities.str);
  const termo = texto.trim().toLocaleLowerCase("pt-BR");
  const itens = sheet.inventory.filter(i => (!termo || nome(i).toLocaleLowerCase("pt-BR").includes(termo)) && (filtro === "todos" || (filtro === "equipados" ? i.equipped : categoriaDoItem(i.itemId) === filtro)));
  const permitido = (id: string) => mestre || jogadorPodeAdicionar(id);
  const sugestoes = novo.trim().length >= 2 ? searchCompendium(criadorRules, { kind: "item", text: novo }).filter(l => permitido(l.ref.id)).slice(0, 12) : [];

  const quantidade = (i: InventoryEntry, delta: 1 | -1) => onChange(registrarMovimento(changeInventoryInstanceQuantity(draft, i.id, delta),
    delta > 0 ? `+1 ${nome(i)}` : i.quantity === 1 ? `Removido: ${nome(i)}` : `−1 ${nome(i)}`));
  const equipar = (i: InventoryEntry, equipped: boolean) => onChange(registrarMovimento({ ...draft, inventory: draft.inventory.map(x => (x.id === i.id ? { ...x, equipped } : x)) }, `${equipped ? "Equipado" : "Desequipado"}: ${nome(i)}`));
  const adicionar = (itemId: string, rotulo: string) => { if (!permitido(itemId)) return; onChange(registrarMovimento(addInventoryInstance(draft, { id: novoId(), itemId, quantity: 1, equipped: false, origin: "acquired" }), `Adicionado: ${rotulo}`)); setNovo(""); };

  return <div className="ficha-pilha">
    <div className="ficha-dupla ficha-resumo-inv">
      <section className="ficha-bloco" aria-label="Moedas">
        <h2>Moedas</h2>
        <CartaoMoedas carteira={draft.currency} ativas={moedas} onDefinir={(chave, n) => onChange(definirMoeda(draft, chave, n))}/>
      </section>
      <section className="ficha-bloco" aria-label="Carga">
        <h2>Carga</h2>
        <p><strong data-testid="carga">{kg(peso)} de {kg(capacidade)}</strong></p>
        <div className="ficha-barra" role="meter" aria-label="Carga" aria-valuemin={0} aria-valuemax={capacidade} aria-valuenow={Math.min(peso, capacidade)}><span style={{ width: `${Math.min(100, capacidade ? (peso / capacidade) * 100 : 0)}%` }} className={peso > capacidade ? "excesso" : ""}/></div>
        {peso > capacidade && <p role="note" className="notice err">Carga acima da capacidade.</p>}
        {stats.ambiguousArmor && <p role="note" className="notice err">Há mais de uma armadura equipada; revise o equipamento.</p>}
        {stats.armorWithoutProficiency && <p role="note" className="notice err">Há armadura equipada sem proficiência.</p>}
      </section>
    </div>

    <section className="ficha-bloco" aria-label="Inventário do personagem">
      <div className="ficha-titulo"><h2>Itens</h2>
        <div className="ficha-barra-itens">
          <button type="button" className="btn-primary ficha-compacto" aria-expanded={adicionando} onClick={() => { setAdicionando(a => !a); setNovo(""); }}>{adicionando ? <><X size={14} aria-hidden="true"/> Fechar adição</> : <><Plus size={14} aria-hidden="true"/> Adicionar item</>}</button>
          <span className="ficha-vistas" role="group" aria-label="Exibição do inventário">
            <button type="button" className={"btn-secondary ficha-compacto" + (vista === "lista" ? " active" : "")} aria-pressed={vista === "lista"} aria-label="Ver em lista" onClick={() => onVista("lista")}><List size={15} aria-hidden="true"/></button>
            <button type="button" className={"btn-secondary ficha-compacto" + (vista === "grade" ? " active" : "")} aria-pressed={vista === "grade"} aria-label="Ver em grade" onClick={() => onVista("grade")}><LayoutGrid size={15} aria-hidden="true"/></button>
          </span>
        </div></div>
      {adicionando && <div className="ficha-adicionar">
        <label>Adicionar item do catálogo<input type="search" autoFocus aria-label="Adicionar item do catálogo" placeholder="Digite ao menos 2 letras" value={novo} onChange={e => setNovo(e.target.value)}/></label>
        <p className="muted">{mestre ? "Como mestre, você pode entregar qualquer item do catálogo." : "Você adiciona itens comuns e as poções comuns. Itens mágicos e raros são entregues pelo mestre."}</p>
        {novo.trim().length >= 2 && <ul className="ficha-linhas" aria-label="Resultados da pesquisa de itens">
          {sugestoes.length === 0 && <li className="muted">Nenhum item disponível com esse nome.</li>}
          {sugestoes.map(l => <li key={l.key}><span>{l.name} <small className="muted">{infoDoItem(l.ref.id)[0]}</small></span><button type="button" className="btn-secondary" aria-label={`Adicionar ${l.name}`} onClick={() => adicionar(l.ref.id, l.name)}><Plus size={14} aria-hidden="true"/> Adicionar</button></li>)}
        </ul>}
      </div>}
      <div className="ficha-filtros">
        <input type="search" aria-label="Buscar no inventário" placeholder="Buscar no inventário" value={texto} onChange={e => setTexto(e.target.value)}/>
        <select aria-label="Filtrar inventário" value={filtro} onChange={e => onFiltro(e.target.value as FiltroInv)}>{FILTROS.map(([v, r]) => <option key={v} value={v}>{r}</option>)}</select>
      </div>
      {sheet.inventory.length === 0 ? <p className="muted">Inventário vazio.</p> : itens.length === 0 ? <p className="muted" role="status">Nenhum item com esse filtro.</p> :
        <ul className={"ficha-itens " + vista}>{itens.map(i => { const def = srdItem(i.itemId), info = infoDoItem(i.itemId); return <li key={i.id} className={i.equipped ? "equipado" : ""} aria-label={nome(i)}>
          <ImagemItem itemId={i.itemId}/>
          <span className="ficha-item-nome">{def ? <button type="button" className="ficha-link" aria-label={`Consultar ${nome(i)} no Compêndio`} onClick={() => onOpenContent(itemSpec(i.itemId, nome(i)))}>{nome(i)}</button> : <strong>{nome(i)}</strong>}
            {info.length > 0 && <small className="ficha-item-info">{info.join(" · ")}</small>}
            <small className="muted">×{i.quantity}{def?.peso != null ? ` · ${kg(def.peso * i.quantity)}` : ""}{i.equipped ? " · equipado" : ""}</small></span>
          <span className="ficha-item-acoes">
            {podeEquipar(i.itemId) && <label className="check"><input type="checkbox" aria-label={`Equipar ${nome(i)}`} checked={i.equipped} onChange={e => equipar(i, e.target.checked)}/> Equipar</label>}
            <button type="button" className="ficha-remover" aria-label={`Diminuir ${nome(i)}`} onClick={() => quantidade(i, -1)}><Minus size={14} aria-hidden="true"/></button>
            <button type="button" className="ficha-remover" aria-label={`Aumentar ${nome(i)}`} disabled={!permitido(i.itemId)} title={permitido(i.itemId) ? undefined : "Só o mestre entrega mais deste item"} onClick={() => quantidade(i, 1)}><Plus size={14} aria-hidden="true"/></button>
          </span></li>; })}</ul>}
    </section>

    {estado.historico.length > 0 && <section className="ficha-bloco" aria-label="Histórico de movimentações">
      <details><summary>Histórico de movimentações ({estado.historico.length})</summary>
        <ol className="ficha-linhas">{estado.historico.map((m, i) => <li key={m.em + i}><span>{m.texto}</span><small className="muted">{m.em ? new Date(m.em).toLocaleString("pt-BR") : ""}</small></li>)}</ol></details>
    </section>}
  </div>;
}

/** Imagem cadastrada do item; sem imagem (ou se ela não carregar), o ícone da categoria. */
function ImagemItem({ itemId }: { itemId: string }) {
  const [falhou, setFalhou] = useState(false), url = imagemDoItem(itemId), cat = categoriaDoItem(itemId);
  if (url && !falhou) return <img className="ficha-item-imagem" src={url} alt="" loading="lazy" onError={() => setFalhou(true)}/>;
  const Icone = cat === "armas" ? Swords : cat === "protecao" ? Shield : cat === "consumiveis" ? FlaskConical : Backpack;
  return <span className="ficha-item-icone" aria-hidden="true"><Icone size={18}/></span>;
}

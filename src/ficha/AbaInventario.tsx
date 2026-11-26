// Aba "Inventário": moedas e carga juntas, itens em grade de cartões quadrados ou em lista (organização do Compêndio 1.0), com busca,
// filtros, adição pelo catálogo e histórico. As ações de cada item ficam no menu de reticências, sempre no mesmo lugar. Armas equipadas
// geram ataques em Habilidades e armaduras/escudos entram na CA pelo motor 2014: nada aqui soma bônus por conta própria. O que o jogador
// pode adicionar segue `catalogue/disponibilidade` (o banco aplica a mesma lista).
import { ArrowLeftRight, Backpack, Check, FlaskConical, Hash, Info, LayoutGrid, List, Plus, Shield, ShieldCheck, ShieldOff, Sparkles, Swords, Trash2, X } from "lucide-react";
import { useState } from "react";
import { jogadorPodeAdicionar } from "../catalogue/disponibilidade";
import { srdItem } from "../catalogue/srd-2014-items";
import { searchCompendium } from "../rules/compendium-query";
import { addInventoryInstance, changeInventoryInstanceQuantity, type InventoryEntry } from "../rules/character-domain";
import { criadorRules } from "../criador/catalogo-criador";
import { CartaoMoedas } from "../moedas/CartaoMoedas";
import { TODAS_AS_MOEDAS, type ChaveMoeda } from "../moedas/moedas";
import { MenuDeAcoes, type AcaoDeMenu } from "../ui/MenuDeAcoes";
import { DetalhesItem, ExcluirItem, kg, nomeDaInstancia as nome, podeUsar, QuantidadeItem, TransferirItem, UsarItem } from "./DialogosItem";
import { capacidadeDeCarga, categoriaDoItem, definirMoeda, pesoCarregado, podeEquipar, registrarMovimento } from "./estadoJogo";
import { imagemDoItem } from "./imagensCatalogo";
import { infoDoItem } from "./infoItem";
import { novoId, type PropsAba } from "./tipos";

export type FiltroInv = "todos" | "equipados" | "armas" | "protecao" | "consumiveis" | "outros";
export type VistaInv = "lista" | "grade";
const FILTROS: [FiltroInv, string][] = [["todos", "Todos"], ["equipados", "Equipados"], ["armas", "Armas"], ["protecao", "Armaduras e escudos"], ["consumiveis", "Poções e consumíveis"], ["outros", "Outros"]];

type Props = PropsAba & {
  vista: VistaInv; onVista: (v: VistaInv) => void; filtro: FiltroInv; onFiltro: (f: FiltroInv) => void;
  /** Moedas em uso na campanha; `null` enquanto a configuração carrega (nada de mostrar moedas que a mesa não usa). */
  moedas?: readonly ChaveMoeda[] | null; /** O mestre pode entregar qualquer item. */ mestre?: boolean;
  usarItem: (instancia: string, cura: number) => Promise<string | null>;
  transferir?: (destino: string, instancia: string, quantidade: number) => Promise<string | null>;
  personagemId?: string; campaignId?: string;
};
type Janela = { tipo: "detalhes" | "usar" | "transferir" | "quantidade" | "excluir"; item: InventoryEntry } | null;

export function AbaInventario({ draft, sheet, stats, estado, onChange, onOpenContent, vista, onVista, filtro, onFiltro, moedas = TODAS_AS_MOEDAS, mestre = false, usarItem, transferir, personagemId, campaignId }: Props) {
  const [texto, setTexto] = useState(""), [novo, setNovo] = useState(""), [adicionando, setAdicionando] = useState(false), [janela, setJanela] = useState<Janela>(null);
  const peso = pesoCarregado(draft), capacidade = capacidadeDeCarga(sheet.abilities.str);
  const termo = texto.trim().toLocaleLowerCase("pt-BR");
  const itens = sheet.inventory.filter(i => (!termo || nome(i).toLocaleLowerCase("pt-BR").includes(termo)) && (filtro === "todos" || (filtro === "equipados" ? i.equipped : categoriaDoItem(i.itemId) === filtro)));
  const permitido = (id: string) => mestre || jogadorPodeAdicionar(id);
  const sugestoes = novo.trim().length >= 2 ? searchCompendium(criadorRules, { kind: "item", text: novo }).filter(l => permitido(l.ref.id)).slice(0, 12) : [];

  const definirQuantidade = (i: InventoryEntry, n: number) => onChange(registrarMovimento(changeInventoryInstanceQuantity(draft, i.id, n - i.quantity), `${nome(i)}: quantidade de ${i.quantity} para ${n}`));
  const excluir = (i: InventoryEntry) => onChange(registrarMovimento(changeInventoryInstanceQuantity(draft, i.id, -i.quantity), `Removido: ${i.quantity > 1 ? `${i.quantity}× ` : ""}${nome(i)}`));
  const equipar = (i: InventoryEntry, equipped: boolean) => onChange(registrarMovimento({ ...draft, inventory: draft.inventory.map(x => (x.id === i.id ? { ...x, equipped } : x)) }, `${equipped ? "Equipado" : "Desequipado"}: ${nome(i)}`));
  const adicionar = (itemId: string, rotulo: string) => { if (!permitido(itemId)) return; onChange(registrarMovimento(addInventoryInstance(draft, { id: novoId(), itemId, quantity: 1, equipped: false, origin: "acquired" }), `Adicionado: ${rotulo}`)); setNovo(""); };

  const acoes = (i: InventoryEntry): AcaoDeMenu[] => [
    { rotulo: "Ver detalhes", icone: Info, acao: () => setJanela({ tipo: "detalhes", item: i }) },
    ...(podeEquipar(i.itemId) ? [{ rotulo: i.equipped ? "Desequipar" : "Equipar", icone: i.equipped ? ShieldOff : ShieldCheck, acao: () => equipar(i, !i.equipped) }] : []),
    ...(podeUsar(i.itemId) ? [{ rotulo: "Usar", icone: Sparkles, acao: () => setJanela({ tipo: "usar", item: i }) }] : []),
    { rotulo: "Transferir", icone: ArrowLeftRight, acao: () => setJanela({ tipo: "transferir", item: i }), desabilitada: !transferir, motivo: "Disponível para personagens salvos na campanha" },
    { rotulo: "Alterar quantidade", icone: Hash, acao: () => setJanela({ tipo: "quantidade", item: i }) },
    { rotulo: "Excluir", icone: Trash2, perigo: true, acao: () => setJanela({ tipo: "excluir", item: i }) },
  ];
  // o item da janela é sempre o atual (a quantidade pode ter mudado enquanto ela estava aberta)
  const doDialogo = janela ? sheet.inventory.find(i => i.id === janela.item.id) ?? janela.item : null;

  return <div className="ficha-pilha">
    <section className="ficha-bloco ficha-moedas-carga" aria-label="Moedas e carga">
      <div className="ficha-moedas-area" role="region" aria-label="Moedas">
        <h2>Moedas</h2>
        {moedas ? <CartaoMoedas carteira={draft.currency} ativas={moedas} onDefinir={(chave, n) => onChange(definirMoeda(draft, chave, n))}/> : <p className="muted" role="status">Carregando as moedas da campanha…</p>}
      </div>
      <div className="ficha-carga" role="region" aria-label="Carga">
        <p><span className="ficha-carga-rotulo">Carga</span> <strong data-testid="carga">{kg(peso)} de {kg(capacidade)}</strong></p>
        <div className="ficha-barra" role="meter" aria-label="Carga" aria-valuemin={0} aria-valuemax={capacidade} aria-valuenow={Math.min(peso, capacidade)}><span style={{ width: `${Math.min(100, capacidade ? (peso / capacidade) * 100 : 0)}%` }} className={peso > capacidade ? "excesso" : ""}/></div>
        {peso > capacidade && <p role="note" className="notice err">Carga acima da capacidade.</p>}
        {stats.ambiguousArmor && <p role="note" className="notice err">Há mais de uma armadura equipada; revise o equipamento.</p>}
        {stats.armorWithoutProficiency && <p role="note" className="notice err">Há armadura equipada sem proficiência.</p>}
      </div>
    </section>

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
        <ul className={"ficha-itens " + vista}>{itens.map(i => {
          const def = srdItem(i.itemId), info = infoDoItem(i.itemId);
          return <li key={i.id} className={"item-cartao" + (i.equipped ? " equipado" : "")} aria-label={nome(i)}>
            <button type="button" className="item-abrir" aria-label={`Detalhes de ${nome(i)}`} onClick={() => setJanela({ tipo: "detalhes", item: i })}>
              <ImagemItem itemId={i.itemId}/>
              <span className="item-texto">
                <span className="item-nome">{nome(i)}</span>
                {vista === "lista" && info.length > 0 && <small className="item-info">{info.join(" · ")}</small>}
                {vista === "lista" && def?.peso != null && <small className="muted">{kg(def.peso * i.quantity)}</small>}
              </span>
            </button>
            <span className="item-quantidade" aria-label={`Quantidade: ${i.quantity}`}>×{i.quantity}</span>
            {i.equipped && <span className="item-equipado" title="Equipado"><Check size={12} aria-hidden="true"/><span className="sr-only">Equipado</span></span>}
            <span className="item-menu"><MenuDeAcoes rotulo={`Ações de ${nome(i)}`} acoes={acoes(i)}/></span>
          </li>;
        })}</ul>}
    </section>

    {estado.historico.length > 0 && <section className="ficha-bloco" aria-label="Histórico de movimentações">
      <details><summary>Histórico de movimentações ({estado.historico.length})</summary>
        <ol className="ficha-linhas">{estado.historico.map((m, i) => <li key={m.em + i}><span>{m.itemId ? m.texto.replace("{item}", srdItem(m.itemId)?.nome ?? "item") : m.texto}</span><small className="muted">{m.em ? new Date(m.em).toLocaleString("pt-BR") : ""}</small></li>)}</ol></details>
    </section>}

    {janela && doDialogo && <>
      {janela.tipo === "detalhes" && <DetalhesItem item={doDialogo} draft={draft} onOpenContent={onOpenContent} onFechar={() => setJanela(null)}/>}
      {janela.tipo === "usar" && <UsarItem item={doDialogo} vida={draft.currentHp} maximo={sheet.maxHp} onUsar={cura => usarItem(doDialogo.id, cura)} onFechar={() => setJanela(null)}/>}
      {janela.tipo === "transferir" && transferir && <TransferirItem item={doDialogo} campaignId={campaignId} personagemId={personagemId} onTransferir={(destino, q) => transferir(destino, doDialogo.id, q)} onFechar={() => setJanela(null)}/>}
      {janela.tipo === "quantidade" && <QuantidadeItem item={doDialogo} podeAumentar={permitido(doDialogo.itemId)} onDefinir={n => definirQuantidade(doDialogo, n)} onFechar={() => setJanela(null)}/>}
      {janela.tipo === "excluir" && <ExcluirItem item={doDialogo} restrito={!mestre && !jogadorPodeAdicionar(doDialogo.itemId)} onExcluir={() => excluir(doDialogo)} onFechar={() => setJanela(null)}/>}
    </>}
  </div>;
}

/** Imagem cadastrada do item; sem imagem (ou se ela não carregar), o ícone da categoria. */
function ImagemItem({ itemId }: { itemId: string }) {
  const [falhou, setFalhou] = useState(false), url = imagemDoItem(itemId), cat = categoriaDoItem(itemId);
  const Icone = cat === "armas" ? Swords : cat === "protecao" ? Shield : cat === "consumiveis" ? FlaskConical : Backpack;
  return <span className="item-imagem">{url && !falhou ? <img src={url} alt="" loading="lazy" onError={() => setFalhou(true)}/> : <Icone aria-hidden="true"/>}</span>;
}

// Ações de um item do inventário: detalhes, usar (consumir), transferir, alterar quantidade e excluir. Cada uma numa janela curta;
// consumo e transferência são operações atômicas (o resultado vem do servidor), sem criar itens nem repetir o efeito.
import { useEffect, useState } from "react";
import { categoriaDoItemRotulo, raridadeRotulo, srdItem } from "../catalogue/srd-2014-items";
import { itemSpec } from "../compendio/DetalheItem";
import { ehGuiado } from "../fichas";
import { useRegistros } from "../RegistrosContext";
import type { CharacterDraft, InventoryEntry } from "../rules/character-domain";
import type { TabSpec } from "../workspace";
import { Modal } from "../ui/Modal";
import { infoDoItem } from "./infoItem";
import { lerEstadoJogo } from "./estadoJogo";

export const nomeDaInstancia = (i: InventoryEntry) => (typeof i.customName === "string" && i.customName ? i.customName : srdItem(i.itemId)?.nome ?? i.itemId);
export const kg = (n: number) => `${n.toLocaleString("pt-BR", { maximumFractionDigits: 2 })} kg`;

/** Itens mundanos que se gastam ao usar (sem efeito automatizado no catálogo). */
const GASTAVEIS = new Set(["rations-1-day", "torch", "candle", "oil-flask", "acid-vial", "alchemists-fire-flask", "antitoxin-vial", "holy-water-flask", "poison-basic-vial", "block-of-incense", "chalk-1-piece", "paper-one-sheet", "parchment-one-sheet", "soap", "perfume-vial", "sealing-wax"]);
export function podeUsar(itemId: string): boolean {
  const d = srdItem(itemId);
  return !!d && (d.categoria === "pocao" || d.categoria === "pergaminho" || !!d.cura || GASTAVEIS.has(itemId));
}
/** Menor e maior resultado de uma fórmula de cura como `2d4+2`. */
export function faixaDaFormula(formula: string): { min: number; max: number } | null {
  const m = /^\s*(\d+)d(\d+)\s*(?:\+\s*(\d+))?\s*$/i.exec(formula);
  if (!m) return null;
  const [n, faces, bonus] = [Number(m[1]), Number(m[2]), Number(m[3] ?? 0)];
  return { min: n + bonus, max: n * faces + bonus };
}

type Comum = { item: InventoryEntry; onFechar: () => void };

export function DetalhesItem({ item, draft, onFechar, onOpenContent }: Comum & { draft: CharacterDraft; onOpenContent: (s: TabSpec) => void }) {
  const d = srdItem(item.itemId), nome = nomeDaInstancia(item);
  const concessoes = lerEstadoJogo(draft).concedidos.filter(c => c.itemInstancia === item.id);
  return <Modal titulo={nome} onFechar={onFechar} sistema="sistema-dnd"
    acoes={d && <button type="button" className="btn-secondary" aria-label={`Abrir no Compêndio: ${nome}`} onClick={() => { onOpenContent(itemSpec(item.itemId, nome)); onFechar(); }}>Abrir no Compêndio</button>}>
    {d && <p>{[categoriaDoItemRotulo(d.categoria), d.raridade !== "mundano" ? raridadeRotulo(d.raridade) : null, d.sintonia ? "requer sintonização" : null].filter(Boolean).join(" · ")}</p>}
    <dl className="ficha-dados">
      <dt>Quantidade</dt><dd>{item.quantity}</dd>
      {d?.peso != null && <><dt>Peso</dt><dd>{kg(d.peso)} cada · {kg(d.peso * item.quantity)} no total</dd></>}
      <dt>Situação</dt><dd>{item.equipped ? "Equipado" : "Guardado"}</dd>
    </dl>
    {infoDoItem(item.itemId).map(x => <p key={x}>{x}</p>)}
    {concessoes.length > 0 && <p>Concede enquanto estiver no inventário: {concessoes.map(c => c.nome).join(", ")}.</p>}
  </Modal>;
}

export function UsarItem({ item, vida, maximo, onFechar, onUsar }: Comum & { vida: number; maximo: number; onUsar: (cura: number) => Promise<string | null> }) {
  const d = srdItem(item.itemId), nome = nomeDaInstancia(item);
  const faixa = d?.cura ? faixaDaFormula(d.cura) : null;
  const [rolagem, setRolagem] = useState(""), [ocupado, setOcupado] = useState(false), [erro, setErro] = useState<string | null>(null);
  const n = Number(rolagem), valido = !faixa || (rolagem.trim() !== "" && Number.isInteger(n) && n >= faixa.min && n <= faixa.max);
  const confirmar = async () => {
    if (!valido || ocupado) return;
    setOcupado(true); setErro(null);
    const r = await onUsar(faixa ? n : 0);
    setOcupado(false);
    if (r) setErro(r); else onFechar();
  };
  return <Modal titulo={`Usar ${nome}`} onFechar={onFechar} ocupado={ocupado} sistema="sistema-dnd"
    acoes={<><button type="button" className="btn-secondary" onClick={onFechar} disabled={ocupado}>Cancelar</button><button type="button" className="btn-primary" disabled={!valido || ocupado} onClick={() => void confirmar()}>{ocupado ? "Usando…" : faixa ? "Usar e curar" : "Confirmar consumo"}</button></>}>
    {faixa ? <form onSubmit={e => { e.preventDefault(); void confirmar(); }}>
      <label>Resultado da rolagem de {d!.cura} (de {faixa.min} a {faixa.max})<input type="number" inputMode="numeric" min={faixa.min} max={faixa.max} value={rolagem} onChange={e => setRolagem(e.target.value)}/></label>
      <p>PV agora: {vida} de {maximo}{valido ? `. Depois: ${Math.min(maximo, vida + (vida < maximo ? n : 0))} de ${maximo}.` : "."}</p>
    </form> : <p>Este item não tem efeito automatizado no catálogo. Uma unidade sai do inventário; aplique o efeito na mesa.</p>}
    <p>Restam {item.quantity} antes do uso.</p>
    {erro && <p role="alert" className="notice err">{erro}</p>}
  </Modal>;
}

/** Seletor de outro personagem da campanha (só a apresentação pública dos guiados: nada da ficha alheia). */
function useDestinos(campaignId: string | undefined, personagemId: string | undefined) {
  const registros = useRegistros();
  const [lista, setLista] = useState<{ id: string; nome: string }[] | null>(null), [erro, setErro] = useState<string | null>(null);
  useEffect(() => {
    if (!registros || !campaignId) { setLista([]); return; }
    let vivo = true;
    void registros.list(campaignId, "character").then(r => {
      if (!vivo) return;
      if (!r.ok) { setErro(r.error); setLista([]); return; }
      setLista(r.data.filter(x => x.id !== personagemId && ehGuiado(x.meta)).map(x => ({ id: x.id, nome: x.title })).sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR")));
    });
    return () => { vivo = false; };
  }, [registros, campaignId, personagemId]);
  return { lista, erro };
}

export function TransferirItem({ item, campaignId, personagemId, onFechar, onTransferir }: Comum & { campaignId?: string; personagemId?: string; onTransferir: (destino: string, quantidade: number) => Promise<string | null> }) {
  const nome = nomeDaInstancia(item), { lista, erro: erroLista } = useDestinos(campaignId, personagemId);
  const [destino, setDestino] = useState(""), [texto, setTexto] = useState("1"), [ocupado, setOcupado] = useState(false), [erro, setErro] = useState<string | null>(null);
  const quantidade = Number(texto), valida = Number.isInteger(quantidade) && quantidade >= 1 && quantidade <= item.quantity;
  const confirmar = async () => {
    if (!destino || !valida || ocupado) return;
    setOcupado(true); setErro(null);
    const r = await onTransferir(destino, quantidade);
    setOcupado(false);
    if (r) setErro(r); else onFechar();
  };
  return <Modal titulo={`Transferir ${nome}`} onFechar={onFechar} ocupado={ocupado} sistema="sistema-dnd"
    acoes={<><button type="button" className="btn-secondary" onClick={onFechar} disabled={ocupado}>Cancelar</button><button type="button" className="btn-primary" disabled={!destino || !valida || ocupado} onClick={() => void confirmar()}>{ocupado ? "Transferindo…" : "Transferir"}</button></>}>
    {lista === null ? <p role="status">Carregando personagens…</p> : lista.length === 0 ? <p>{erroLista ?? "Não há outro personagem desta campanha para receber o item."}</p> : <>
      <label>Para quem<select value={destino} onChange={e => setDestino(e.target.value)}><option value="">Escolha um personagem</option>{lista.map(p => <option key={p.id} value={p.id}>{p.nome}</option>)}</select></label>
      <label>Quantidade (de 1 a {item.quantity})<input type="number" inputMode="numeric" min={1} max={item.quantity} value={texto} onChange={e => setTexto(e.target.value)}/></label>
      <p>O item sai do seu inventário e chega desequipado, com os mesmos dados. A movimentação fica no histórico dos dois.</p></>}
    {erro && <p role="alert" className="notice err">{erro}</p>}
  </Modal>;
}

export function QuantidadeItem({ item, podeAumentar, onFechar, onDefinir }: Comum & { podeAumentar: boolean; onDefinir: (n: number) => void }) {
  const [texto, setTexto] = useState(String(item.quantity)), n = Number(texto);
  const maximo = podeAumentar ? 1_000_000 : item.quantity;
  const valida = Number.isInteger(n) && n >= 1 && n <= maximo;
  const aplicar = () => { if (valida) { if (n !== item.quantity) onDefinir(n); onFechar(); } };
  return <Modal titulo={`Quantidade de ${nomeDaInstancia(item)}`} onFechar={onFechar} sistema="sistema-dnd"
    acoes={<><button type="button" className="btn-secondary" onClick={onFechar}>Cancelar</button><button type="button" className="btn-primary" disabled={!valida} onClick={aplicar}>Salvar quantidade</button></>}>
    <form onSubmit={e => { e.preventDefault(); aplicar(); }}><label>Quantidade<input type="number" inputMode="numeric" min={1} max={maximo} value={texto} onChange={e => setTexto(e.target.value)}/></label></form>
    {!podeAumentar && <p>Só o mestre entrega mais deste item; você pode reduzir.</p>}
  </Modal>;
}

export function ExcluirItem({ item, restrito, onFechar, onExcluir }: Comum & { restrito: boolean; onExcluir: () => void }) {
  return <Modal titulo={`Excluir ${nomeDaInstancia(item)}?`} onFechar={onFechar} sistema="sistema-dnd"
    acoes={<><button type="button" className="btn-secondary" data-foco onClick={onFechar}>Cancelar</button><button type="button" className="btn-secondary danger" onClick={() => { onExcluir(); onFechar(); }}>Excluir</button></>}>
    <p>{item.quantity > 1 ? `As ${item.quantity} unidades saem` : "O item sai"} do inventário. A movimentação fica no histórico.</p>
    {restrito && <p>Este item só pode ser entregue de novo pelo mestre.</p>}
  </Modal>;
}

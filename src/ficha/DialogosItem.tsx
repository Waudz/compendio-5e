// Ações de um item do inventário: detalhes, usar (consumir), transferir, alterar quantidade e excluir. Cada uma numa janela curta;
// consumo e transferência são operações atômicas (o resultado vem do servidor), sem criar itens nem repetir o efeito.
import { useEffect, useState } from "react";
import { categoriaDoItemRotulo, raridadeRotulo, srdItem } from "../catalogue/srd-2014-items";
import { itemDaCampanha, nomeIndisponivel } from "../catalogue/campanha";
import { itemSpec } from "../compendio/DetalheItem";
import { ehGuiado } from "../fichas";
import { useRegistros } from "../RegistrosContext";
import type { CharacterDraft, InventoryEntry } from "../rules/character-domain";
import type { TabSpec } from "../workspace";
import { Modal } from "../ui/Modal";
import { infoDoItem } from "./infoItem";
import { lerEstadoJogo } from "./estadoJogo";
import { imagemDoItem } from "./imagensCatalogo";
import { MOEDAS, type Carteira, type ChaveMoeda } from "../moedas/moedas";

export const nomeDaInstancia = (i: InventoryEntry) => (typeof i.customName === "string" && i.customName ? i.customName : srdItem(i.itemId)?.nome ?? nomeIndisponivel(i.itemId));
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
  const d = srdItem(item.itemId), nome = nomeDaInstancia(item), daMesa = itemDaCampanha(item.itemId), oculto = !!daMesa?.mascara;
  const concessoes = lerEstadoJogo(draft).concedidos.filter(c => c.itemInstancia === item.id);
  return <Modal titulo={nome} onFechar={onFechar} sistema="sistema-dnd"
    acoes={d && !oculto && <button type="button" className="btn-secondary" aria-label={`Abrir no Compêndio: ${nome}`} onClick={() => { onOpenContent(itemSpec(item.itemId, nome)); onFechar(); }}>Abrir no Compêndio</button>}>
    {oculto && <p>Item não identificado</p>}
    {d && !oculto && <p>{[categoriaDoItemRotulo(d.categoria), d.raridade !== "mundano" ? raridadeRotulo(d.raridade) : null, d.sintonia ? "requer sintonização" : null].filter(Boolean).join(" · ")}</p>}
    <dl className="ficha-dados">
      <dt>Quantidade</dt><dd>{item.quantity}</dd>
      {d?.peso != null && <><dt>Peso</dt><dd>{kg(d.peso)} cada · {kg(d.peso * item.quantity)} no total</dd></>}
      <dt>Situação</dt><dd>{item.equipped ? "Equipado" : "Guardado"}</dd>
    </dl>
    {!oculto && infoDoItem(item.itemId).map(x => <p key={x}>{x}</p>)}
    {daMesa?.descricao && <p style={{ whiteSpace: "pre-wrap" }}>{daMesa.descricao}</p>}
    {concessoes.length > 0 && <p>Concede enquanto estiver no inventário: {concessoes.map(c => c.nome).join(", ")}.</p>}
  </Modal>;
}

/** Cabeçalho das janelas de item: imagem, nome e o que importa. */
function Resumo({ item, linhas }: { item: InventoryEntry; linhas: (string | null)[] }) {
  const url = imagemDoItem(item.itemId);
  return <div className="janela-item">{url && <img src={url} alt="" onError={e => { e.currentTarget.hidden = true; }}/>}<div><strong>{nomeDaInstancia(item)}</strong>{linhas.filter(Boolean).map(l => <p key={l}>{l}</p>)}</div></div>;
}
/** Escolha de uma pessoa entre opções, com as indisponíveis claramente desabilitadas. */
function Opcoes({ rotulo, nome, opcoes, valor, onEscolher }: { rotulo: string; nome: string; valor: string; onEscolher: (id: string) => void; opcoes: { id: string; rotulo: string; desabilitada?: boolean }[] }) {
  return <fieldset className="janela-opcoes"><legend>{rotulo}</legend>
    {opcoes.map(o => <label key={o.id} className={o.desabilitada ? "indisponivel" : ""}><input type="radio" name={nome} value={o.id} checked={valor === o.id} disabled={o.desabilitada} onChange={() => onEscolher(o.id)}/> {o.rotulo}</label>)}
  </fieldset>;
}

export function UsarItem({ item, vida, maximo, nomeProprio, campaignId, personagemId, onFechar, onUsar }: Comum & { vida: number; maximo: number; nomeProprio: string; campaignId?: string; personagemId?: string; onUsar: (cura: number) => Promise<string | null> }) {
  const d = srdItem(item.itemId), nome = nomeDaInstancia(item);
  const faixa = d?.cura ? faixaDaFormula(d.cura) : null;
  const { lista } = useDestinos(faixa ? campaignId : undefined, personagemId);
  const [rolagem, setRolagem] = useState(""), [ocupado, setOcupado] = useState(false), [erro, setErro] = useState<string | null>(null);
  const n = Number(rolagem), valido = !faixa || (rolagem.trim() !== "" && Number.isInteger(n) && n >= faixa.min && n <= faixa.max);
  // a rolagem é o que os dados deram; a cura aplicada para no PV máximo (a mesma regra da operação no servidor)
  const aplicada = faixa && valido ? Math.max(0, Math.min(maximo - vida, n)) : 0;
  const confirmar = async () => {
    if (!valido || ocupado) return;
    setOcupado(true); setErro(null);
    const r = await onUsar(faixa ? n : 0);
    setOcupado(false);
    if (r) setErro(r); else onFechar();
  };
  const outros = lista ?? [];
  return <Modal titulo={`Usar ${nome}`} onFechar={onFechar} ocupado={ocupado} sistema="sistema-dnd">
    <Resumo item={item} linhas={[d?.cura ? `${d.cura} PV` : null, `${item.quantity} disponíve${item.quantity > 1 ? "is" : "l"}`]}/>
    {faixa ? <form onSubmit={e => { e.preventDefault(); void confirmar(); }}>
      <Opcoes rotulo="Utilizar em" nome="alvo-da-cura" valor="proprio" onEscolher={() => {}} opcoes={[{ id: "proprio", rotulo: `${nomeProprio} (você)` }, ...outros.map(p => ({ id: p.id, rotulo: p.nome, desabilitada: true }))]}/>
      {outros.length > 0 && <p className="janela-pendente">Curar outro personagem ainda não está disponível.</p>}
      <label>Resultado da rolagem ({d!.cura}: de {faixa.min} a {faixa.max})<input type="number" inputMode="numeric" min={faixa.min} max={faixa.max} value={rolagem} onChange={e => setRolagem(e.target.value)}/></label>
      <dl className="ficha-dados" data-testid="previa-da-cura">
        <div className="ficha-par"><dt>Cura aplicada</dt><dd>{valido ? `${aplicada} PV${aplicada < n ? ` (${n - aplicada} da rolagem passam do máximo)` : ""}` : "informe a rolagem"}</dd></div>
        <div className="ficha-par"><dt>PV</dt><dd>{valido ? `${vida} → ${vida + aplicada} de ${maximo}` : `${vida} de ${maximo}`}</dd></div>
      </dl>
      <p>Uma unidade sai do seu inventário{valido && aplicada === 0 ? ", mesmo sem recuperar PV" : ""}.</p>
    </form> : <p>Este item não tem efeito automatizado no catálogo. Uma unidade sai do inventário; aplique o efeito na mesa.</p>}
    {erro && <p role="alert" className="notice err">{erro}</p>}
    <button type="button" className="btn-primary janela-principal" disabled={!valido || ocupado} onClick={() => void confirmar()}>{ocupado ? "Usando…" : !faixa ? "Confirmar consumo" : valido ? `Curar ${nomeProprio} em ${aplicada} PV` : `Curar ${nomeProprio}`}</button>
  </Modal>;
}

/** Varinhas, cajados e cetros mágicos guardam cargas. O catálogo ainda não traz o máximo nem a regra de cada um. */
export const temCargas = (itemId: string) => /^(wand|staff|rod)-of-/.test(itemId);
/** Janela preparada: sem contagem de cargas por exemplar no banco, nada é alterado. */
export function RecuperarCargas({ item, onFechar }: Comum) {
  return <Modal titulo="Recuperar cargas" onFechar={onFechar} sistema="sistema-dnd">
    <Resumo item={item} linhas={["Cargas ainda não registradas neste item"]}/>
    <p className="janela-pendente">A contagem e a recuperação de cargas ainda não estão disponíveis. Controle as cargas na mesa, pela descrição do item.</p>
    <label>Quantidade recuperada<span className="janela-linha"><input type="number" disabled value=""/><button type="button" className="btn-secondary" disabled>Todas</button></span></label>
    <button type="button" className="btn-primary janela-principal" disabled>Recuperar cargas</button>
  </Modal>;
}

/** Janela preparada: a transferência de moedas precisa de uma operação protegida no banco. */
export function TransferirMoedas({ carteira, ativas, campaignId, personagemId, onFechar }: { carteira: Carteira | undefined; ativas: readonly ChaveMoeda[]; campaignId?: string; personagemId?: string; onFechar: () => void }) {
  const { lista } = useDestinos(campaignId, personagemId);
  const [moeda, setMoeda] = useState<ChaveMoeda>(ativas.includes("gp") ? "gp" : ativas[0]), [quantidade, setQuantidade] = useState("1"), [destino, setDestino] = useState("");
  const saldo = carteira?.[moeda] ?? 0;
  return <Modal titulo="Transferir moedas" onFechar={onFechar} sistema="sistema-dnd">
    <p className="janela-pendente">A transferência de moedas ainda não está disponível. Nada é alterado por esta janela.</p>
    <label>Moeda<select value={moeda} onChange={e => setMoeda(e.target.value as ChaveMoeda)}>{MOEDAS.filter(m => ativas.includes(m.chave)).map(m => <option key={m.chave} value={m.chave}>{m.nome} ({m.sigla})</option>)}</select></label>
    <p>Saldo disponível: {saldo}</p>
    <label>Quantidade<span className="janela-linha"><input type="number" min={1} max={saldo} value={quantidade} onChange={e => setQuantidade(e.target.value)}/><button type="button" className="btn-secondary" onClick={() => setQuantidade(String(saldo))}>Todas</button></span></label>
    {lista && lista.length > 0 && <Opcoes rotulo="Destinatário" nome="destino-moedas" valor={destino} onEscolher={setDestino} opcoes={lista.map(p => ({ id: p.id, rotulo: p.nome }))}/>}
    <button type="button" className="btn-primary janela-principal" disabled>Transferir moedas</button>
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
  const escolhido = lista?.find(p => p.id === destino)?.nome;
  return <Modal titulo={`Transferir ${nome}`} onFechar={onFechar} ocupado={ocupado} sistema="sistema-dnd">
    <Resumo item={item} linhas={[`${item.quantity} disponíve${item.quantity > 1 ? "is" : "l"}`]}/>
    {lista === null ? <p role="status">Carregando personagens…</p> : lista.length === 0 ? <p>{erroLista ?? "Não há outro personagem desta campanha para receber o item."}</p> : <>
      <Opcoes rotulo="Destinatário" nome="destino-item" valor={destino} onEscolher={setDestino} opcoes={lista.map(p => ({ id: p.id, rotulo: p.nome }))}/>
      <label>Quantidade (de 1 a {item.quantity})<span className="janela-linha"><input type="number" inputMode="numeric" min={1} max={item.quantity} value={texto} onChange={e => setTexto(e.target.value)}/><button type="button" className="btn-secondary" onClick={() => setTexto(String(item.quantity))}>Todas</button></span></label>
      <p>O item sai do seu inventário e chega desequipado, com os mesmos dados. A movimentação fica no histórico dos dois.</p></>}
    {erro && <p role="alert" className="notice err">{erro}</p>}
    <button type="button" className="btn-primary janela-principal" disabled={!destino || !valida || ocupado} onClick={() => void confirmar()}>{ocupado ? "Transferindo…" : escolhido && valida ? `Transferir ${quantidade} para ${escolhido}` : "Transferir"}</button>
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

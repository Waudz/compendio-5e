// Planejamento (só o mestre): quadro de colunas livres com cartões em lista vertical. Cada cartão é uma página (cena) editável em aba própria.
// Persistência: um registro `board` (ordem das colunas/cartões, em meta) + um registro `scene` por cartão, ambos privados do mestre.
import { DndContext, KeyboardSensor, PointerSensor, TouchSensor, closestCorners, useDroppable, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, ClipboardList, GripVertical, Plus, Trash2 } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useCampaigns } from "./CampaignsContext";
import { primeiroParagrafo, resumirTexto } from "./inicio";
import { adicionarCartao, deslocarCartao, excluirColuna, lerQuadro, moverColuna, novaColuna, novoId, removerCartao, renomearColuna, soltarCartao, type Quadro } from "./quadro";
import { validarTitulo, type Registro } from "./registros";
import { useRegistros } from "./RegistrosContext";
import { avisarRegistros } from "./registrosStore";
import type { TabSpec } from "./workspace";

export function PlanningPanel({ onOpenContent }: { onOpenContent?: (s: TabSpec) => void } = {}) {
  const { active } = useCampaigns(), api = useRegistros();
  const cid = active?.campaign.id;
  const [board, setBoard] = useState<Registro | null>(null), [cenas, setCenas] = useState<Record<string, Registro>>({});
  const [carregado, setCarregado] = useState(false), [erro, setErro] = useState<string | null>(null), [aviso, setAviso] = useState<string | null>(null);
  const fila = useRef<Promise<unknown>>(Promise.resolve());   // grava o quadro em ordem, uma operação por vez (versão otimista)
  const boardRef = useRef<Registro | null>(null); boardRef.current = board;
  // Arrastar com mouse/toque (alça dedicada, para não atrapalhar a rolagem) ou teclado (alça + espaço + setas); os botões continuam como alternativa.
  const sensores = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }), useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 8 } }), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));
  const versao = useRef(0);   // versão do quadro no servidor, atualizada a cada gravação confirmada

  const carregar = useCallback(async () => {
    if (!api || !cid) return;
    const [b, s] = await Promise.all([api.list(cid, "board"), api.list(cid, "scene")]);
    if (!b.ok || !s.ok) { setErro(!b.ok ? b.error : (s as { error: string }).error); setCarregado(true); return; }
    let quadro: Registro | undefined = b.data[0];
    if (!quadro) {   // primeira vez: cria o quadro com uma coluna
      const c = await api.create({ kind: "board", campaignId: cid, title: "Quadro de planejamento", visibility: "private", meta: { colunas: [{ id: novoId(), titulo: "Sessão 1", cartoes: [] }] } });
      if (!c.ok) { setErro(c.error); setCarregado(true); return; }
      quadro = c.data;
    }
    setErro(null); versao.current = quadro.version; boardRef.current = quadro; setBoard(quadro); setCenas(Object.fromEntries(s.data.map(r => [r.id, r]))); setCarregado(true);
  }, [api, cid]);
  useEffect(() => { setCarregado(false); setBoard(null); void carregar(); }, [carregar]);

  if (!active) return <div className="content"><h1>Planejamento</h1><div className="notice" role="status">O Planejamento pertence a uma campanha. Escolha uma campanha ativa na barra lateral.</div></div>;
  if (active.role !== "mestre") return <div className="content"><h1>Planejamento</h1><div className="notice" role="status">O Planejamento é exclusivo do mestre desta campanha.</div></div>;
  if (!api) return <div className="content"><h1>Planejamento</h1><div className="notice" role="status">Conta necessária para usar o Planejamento.</div></div>;

  const quadro: Quadro = lerQuadro(board?.meta);
  /** Aplica a mudança na tela já e grava em fila; em conflito ou erro recarrega do servidor. */
  const gravar = (fn: (q: Quadro) => Quadro) => {
    const atual = boardRef.current; if (!atual) return;
    const novo = fn(lerQuadro(atual.meta)); if (JSON.stringify(novo) === JSON.stringify(lerQuadro(atual.meta))) return;
    setAviso(null);
    const otimista = { ...atual, meta: { ...atual.meta, colunas: novo.colunas } }; boardRef.current = otimista; setBoard(otimista);
    fila.current = fila.current.then(async () => {
      const r = await api.update(otimista.id, versao.current, { meta: otimista.meta });
      if (r.ok) versao.current = r.data.version; else { setAviso(r.error); await carregar(); }
    });
  };
  const novoCartao = async (colunaId: string, titulo: string) => {
    const bad = validarTitulo(titulo); if (bad) { setAviso(bad); return false; }
    const r = await api.create({ kind: "scene", campaignId: active.campaign.id, title: titulo, visibility: "private" });
    if (!r.ok) { setAviso(r.error); return false; }
    setCenas(c => ({ ...c, [r.data.id]: r.data })); gravar(q => adicionarCartao(q, colunaId, r.data.id)); return true;
  };
  const excluirCartao = async (id: string) => {
    const r = await api.remove(id); if (!r.ok) { setAviso(r.error); return; }
    setCenas(c => { const n = { ...c }; delete n[id]; return n; }); gravar(q => removerCartao(q, id)); avisarRegistros();
  };
  const soltar = (e: DragEndEvent) => gravar(q => soltarCartao(q, String(e.active.id), e.over ? String(e.over.id) : null));
  const abrir = (r: Registro) => onOpenContent?.({ kind: "documento", ref: r.id, title: r.title });

  return <div className="content planejamento" data-testid="planejamento">
    <div className="eyebrow">{active.campaign.name.toLocaleUpperCase("pt-BR")}</div>
    <h1>Planejamento</h1>
    <p>Prepare as sessões em colunas livres. Cada cartão é uma página privada sua; reorganizar o quadro não move nem duplica a página.</p>
    {erro && <div className="notice err" role="alert">{erro} <button className="btn-link" onClick={() => { setErro(null); setCarregado(false); void carregar(); }}>Tentar de novo</button></div>}
    {aviso && <div className="notice err" role="alert">{aviso}</div>}
    {!carregado && <p className="muted" role="status">Carregando o planejamento…</p>}
    {carregado && board && <DndContext sensors={sensores} collisionDetection={closestCorners} onDragEnd={soltar}><div className="quadro" role="list" aria-label="Colunas do planejamento">
      {quadro.colunas.map((col, ci) => <section key={col.id} className="coluna" role="listitem" aria-label={`Coluna ${col.titulo}`}>
        <header>
          <input className="coluna-titulo" aria-label={`Nome da coluna ${col.titulo}`} defaultValue={col.titulo} maxLength={80} onBlur={e => { if (e.target.value.trim() && e.target.value !== col.titulo) gravar(q => renomearColuna(q, col.id, e.target.value)); else e.target.value = col.titulo; }}/>
          <button className="icon" aria-label={`Mover coluna ${col.titulo} para a esquerda`} disabled={ci === 0} onClick={() => gravar(q => moverColuna(q, col.id, -1))}><ArrowLeft size={14}/></button>
          <button className="icon" aria-label={`Mover coluna ${col.titulo} para a direita`} disabled={ci === quadro.colunas.length - 1} onClick={() => gravar(q => moverColuna(q, col.id, 1))}><ArrowRight size={14}/></button>
          <button className="icon" aria-label={`Excluir coluna ${col.titulo}`} title={col.cartoes.length ? "Esvazie a coluna para excluí-la" : "Excluir coluna"} disabled={col.cartoes.length > 0} onClick={() => gravar(q => excluirColuna(q, col.id))}><Trash2 size={14}/></button>
        </header>
        <ListaColuna colId={col.id} ids={col.cartoes.filter(id => cenas[id])}>{col.cartoes.map((id, i) => { const c = cenas[id]; if (!c) return null; const t = primeiroParagrafo(c.content); return <Ordenavel key={id} id={id} alca={`Arrastar o cartão ${c.title}`}>
          <button className="cartao-abrir" onClick={() => abrir(c)}><strong>{c.title}</strong>{t && <span className="cartao-previa">{resumirTexto(t, 140)}</span>}</button>
          <div className="cartao-acoes">
            <button className="icon" aria-label={`Subir ${c.title}`} disabled={i === 0} onClick={() => gravar(q => deslocarCartao(q, id, "cima"))}><ArrowUp size={13}/></button>
            <button className="icon" aria-label={`Descer ${c.title}`} disabled={i === col.cartoes.length - 1} onClick={() => gravar(q => deslocarCartao(q, id, "baixo"))}><ArrowDown size={13}/></button>
            <button className="icon" aria-label={`Mover ${c.title} para a coluna anterior`} disabled={ci === 0} onClick={() => gravar(q => deslocarCartao(q, id, "esquerda"))}><ArrowLeft size={13}/></button>
            <button className="icon" aria-label={`Mover ${c.title} para a próxima coluna`} disabled={ci === quadro.colunas.length - 1} onClick={() => gravar(q => deslocarCartao(q, id, "direita"))}><ArrowRight size={13}/></button>
            <button className="icon danger" aria-label={`Excluir cartão ${c.title}`} onClick={() => { if (window.confirm(`Excluir o cartão “${c.title}” e a página dele?`)) void excluirCartao(id); }}><Trash2 size={13}/></button>
          </div></Ordenavel>; })}</ListaColuna>
        <NovoCartao onCriar={t => novoCartao(col.id, t)}/>
      </section>)}
      <NovaColuna onCriar={t => gravar(q => novaColuna(q, t))}/>
    </div></DndContext>}
    {carregado && board && quadro.colunas.length === 0 && <div className="placeholder"><ClipboardList size={30} aria-hidden="true"/><strong>Nenhuma coluna</strong><span>Crie a primeira coluna (por exemplo, “Sessão 5” ou “Julkoun”).</span></div>}
  </div>;
}

function NovoCartao({ onCriar }: { onCriar: (t: string) => Promise<boolean> }) {
  const [t, setT] = useState(""), [busy, setBusy] = useState(false);
  return <form className="novo" onSubmit={async e => { e.preventDefault(); if (busy) return; setBusy(true); const ok = await onCriar(t); setBusy(false); if (ok) setT(""); }}>
    <input value={t} onChange={e => setT(e.target.value)} placeholder="Novo cartão" aria-label="Título do novo cartão" maxLength={120}/>
    <button className="icon" aria-label="Adicionar cartão" disabled={busy || !t.trim()}><Plus size={15}/></button></form>;
}
function NovaColuna({ onCriar }: { onCriar: (t: string) => void }) {
  const [t, setT] = useState("");
  return <form className="coluna nova-coluna" onSubmit={e => { e.preventDefault(); if (t.trim()) { onCriar(t); setT(""); } }}>
    <input value={t} onChange={e => setT(e.target.value)} placeholder="Nova coluna" aria-label="Nome da nova coluna" maxLength={80}/>
    <button className="btn-secondary" disabled={!t.trim()}>Adicionar coluna</button></form>;
}

/** Lista de cartões de uma coluna: zona de soltura (inclusive coluna vazia) e contexto de ordenação. */
function ListaColuna({ colId, ids, children }: { colId: string; ids: string[]; children: React.ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id: `col:${colId}` });
  return <SortableContext items={ids} strategy={verticalListSortingStrategy}><ul ref={setNodeRef} className={isOver ? "cartoes sobre" : "cartoes"}>{children}</ul></SortableContext>;
}
function Ordenavel({ id, alca, children }: { id: string; alca: string; children: React.ReactNode }) {
  const s = useSortable({ id });
  return <li ref={s.setNodeRef} className={s.isDragging ? "cartao arrastando" : "cartao"} style={{ transform: CSS.Transform.toString(s.transform), transition: s.transition }}>
    <button type="button" className="alca" aria-label={alca} {...s.attributes} {...s.listeners}><GripVertical size={14}/></button>{children}</li>;
}

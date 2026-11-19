// Planejamento (só o mestre): quadro de colunas livres com cartões em lista vertical. Cada cartão é uma página (cena) privada.
// Clique no cartão: expande e edita ali mesmo (editor rico), sem abrir aba. Botão direito (ou "⋯"): "Abrir em nova aba". Arrastar pela alça (dnd-kit) ou botões.
// O RASCUNHO de cada cartão vive aqui no painel (não no cartão): mover, reordenar ou recolher nunca perde o que foi digitado, e fechar a aba pede confirmação.
import { DndContext, KeyboardSensor, PointerSensor, TouchSensor, closestCorners, useDroppable, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { horizontalListSortingStrategy } from "@dnd-kit/sortable";
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, ClipboardList, GripVertical, MoreHorizontal, Plus, Trash2 } from "lucide-react";
import { createContext, useCallback, useContext, useEffect, useRef, useState, type MouseEvent as RMouseEvent, type ReactNode } from "react";
import { useAbrirEmAba } from "./abrirEmAba";
import { useCampaigns } from "./CampaignsContext";
import { ConflitoAviso } from "./ConflitoAviso";
import { EditorLazy } from "./EditorLazy";
import { previaTexto, type BlocoTexto } from "./inicio";
import { adicionarCartao, deslocarCartao, excluirColuna, lerQuadro, moverColuna, novaColuna, novoId, proximoNomeColuna, moverParaNovaColuna, removerCartao, renomearColuna, soltarCartao, soltarColuna, type Quadro } from "./quadro";
import { validarTitulo, type Registro } from "./registros";
import { useRegistros } from "./RegistrosContext";
import { novaOrigem, publicarExclusao, publicarRegistro, useAssinaturaGeral, type Conflito } from "./registrosStore";
import { useUnsavedGuard } from "./unsaved";
import type { TabSpec } from "./workspace";

/** Estado de edição de um cartão (rascunho incluído). `aberto` = expandido; o editor continua montado quando recolhido, então nada se perde. */
type Ed = { aberto: boolean; titulo: string; blocos: BlocoTexto[]; editou: boolean; base: Registro; chave: number; conflito: Conflito | null; salvando: boolean; erro: string | null };
export const edSujo = (e: Ed) => e.editou || e.titulo !== e.base.title;
const novoEd = (r: Registro): Ed => ({ aberto: true, titulo: r.title, blocos: r.content, editou: false, base: r, chave: 0, conflito: null, salvando: false, erro: null });

export function PlanningPanel(_: { onOpenContent?: (s: TabSpec) => void } = {}) {
  const { active } = useCampaigns(), api = useRegistros(), { aoClicarDireito, abrirMenuEm } = useAbrirEmAba();
  const cid = active?.campaign.id;
  const origem = useRef(novaOrigem()).current;
  const [board, setBoard] = useState<Registro | null>(null), [cenas, setCenas] = useState<Record<string, Registro>>({});
  const [ed, setEd] = useState<Record<string, Ed>>({}); const edRef = useRef(ed); edRef.current = ed;
  const [carregado, setCarregado] = useState(false), [erro, setErro] = useState<string | null>(null), [aviso, setAviso] = useState<string | null>(null);
  const fila = useRef<Promise<unknown>>(Promise.resolve());   // grava o quadro em ordem, uma operação por vez (versão otimista)
  const boardRef = useRef<Registro | null>(null); boardRef.current = board;
  const versao = useRef(0);   // versão do quadro no servidor, atualizada a cada gravação confirmada
  const sensores = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }), useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 8 } }), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));

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
    setErro(null); versao.current = quadro.version; boardRef.current = quadro; setBoard(quadro);
    setCenas(prev => { const novo = Object.fromEntries(s.data.map(r => [r.id, r])); for (const id of Object.keys(edRef.current)) if (prev[id] && !novo[id]) novo[id] = prev[id]; return novo; });   // cartão com rascunho nunca some numa recarga
    setCarregado(true);
  }, [api, cid]);
  useEffect(() => { setCarregado(false); setBoard(null); setEd({}); void carregar(); }, [carregar]);

  /** Aplica a mudança do quadro na tela já e grava em fila; em conflito ou erro recarrega do servidor. */
  const gravar = (fn: (q: Quadro) => Quadro) => {
    const atual = boardRef.current; if (!atual || !api) return;
    const novo = fn(lerQuadro(atual.meta)); if (JSON.stringify(novo) === JSON.stringify(lerQuadro(atual.meta))) return;
    setAviso(null);
    const otimista = { ...atual, meta: { ...atual.meta, colunas: novo.colunas } }; boardRef.current = otimista; setBoard(otimista);
    fila.current = fila.current.then(async () => {
      const r = await api.update(otimista.id, versao.current, { meta: otimista.meta });
      if (r.ok) versao.current = r.data.version; else { setAviso(r.error); await carregar(); }
    });
  };

  const removerLocal = (id: string) => { setCenas(c => { const n = { ...c }; delete n[id]; return n; }); setEd(p => { const n = { ...p }; delete n[id]; return n; }); gravar(q => removerCartao(q, id)); };

  // Alterações salvas em OUTRO lugar (aba do mesmo registro em outro grupo): atualiza título/prévia e, se o cartão não tem rascunho, o conteúdo; senão, avisa o conflito.
  useAssinaturaGeral(e => {
    if (e.origem === origem || !boardRef.current) return;
    if (!e.registro) {
      const x = edRef.current[e.id];
      if (x && edSujo(x)) setEd(p => p[e.id] ? { ...p, [e.id]: { ...p[e.id], conflito: { registro: null } } } : p);
      else if (lerQuadro(boardRef.current.meta).colunas.some(c => c.cartoes.includes(e.id))) removerLocal(e.id);
      return;
    }
    const r = e.registro;
    setCenas(c => c[r.id] && r.version > c[r.id].version ? { ...c, [r.id]: r } : c);
    setEd(p => {
      const x = p[r.id]; if (!x || r.version <= x.base.version) return p;
      return { ...p, [r.id]: edSujo(x) ? { ...x, conflito: { registro: r } } : { ...x, base: r, titulo: r.title, blocos: r.content, editou: false, chave: x.chave + 1, conflito: null } };
    });
  });

  const mexer = (id: string, f: (x: Ed) => Ed) => setEd(p => p[id] ? { ...p, [id]: f(p[id]) } : p);
  const alternar = (id: string) => { const c = cenas[id]; if (!c) return; setEd(p => p[id] ? { ...p, [id]: { ...p[id], aberto: !p[id].aberto } } : { ...p, [id]: novoEd(c) }); };

  const salvar = useCallback(async (id: string): Promise<boolean> => {
    const x = edRef.current[id]; if (!x || !api || x.salvando) return !x || !edSujo(x);
    const bad = validarTitulo(x.titulo); if (bad) { mexer(id, y => ({ ...y, erro: bad })); return false; }
    mexer(id, y => ({ ...y, salvando: true, erro: null }));
    const r = await api.update(x.base.id, x.base.version, { title: x.titulo, content: x.blocos });
    if (!r.ok) {
      let conflito: Conflito | null = null;
      if (/alterou/i.test(r.error)) { const g = await api.get(id); if (g.ok) conflito = { registro: g.data }; }   // conflito com o servidor: mesmo caminho seguro
      mexer(id, y => ({ ...y, salvando: false, erro: r.error, conflito: conflito ?? y.conflito })); return false;
    }
    // editou=false só se nada foi digitado durante o salvamento
    mexer(id, y => ({ ...y, salvando: false, base: r.data, editou: y.blocos === x.blocos ? false : y.editou, titulo: y.titulo === x.titulo ? r.data.title : y.titulo, conflito: null }));
    setCenas(c => ({ ...c, [id]: r.data })); publicarRegistro(r.data, origem);
    return true;
  }, [api, origem]); // eslint-disable-line react-hooks/exhaustive-deps

  // Fechar/trocar a aba do Planejamento com rascunhos pede confirmação (e oferece salvar tudo).
  const algumSujo = Object.values(ed).some(edSujo);
  const salvarTodos = useCallback(async () => { let ok = true; for (const [id, x] of Object.entries(edRef.current)) if (edSujo(x)) ok = (await salvar(id)) && ok; return ok; }, [salvar]);
  useUnsavedGuard("secao:planejamento", algumSujo, salvarTodos);

  if (!active) return <div className="content"><h1>Planejamento</h1><div className="notice" role="status">O Planejamento pertence a uma campanha. Escolha uma campanha ativa na barra lateral.</div></div>;
  if (active.role !== "mestre") return <div className="content"><h1>Planejamento</h1><div className="notice" role="status">O Planejamento é exclusivo do mestre desta campanha.</div></div>;
  if (!api) return <div className="content"><h1>Planejamento</h1><div className="notice" role="status">Conta necessária para usar o Planejamento.</div></div>;

  const quadro: Quadro = lerQuadro(board?.meta);
  const novoCartao = async (colunaId: string, titulo: string) => {
    const nome = titulo.trim() || "Novo cartão";   // o nome é opcional: dá para renomear ao editar
    const bad = validarTitulo(nome); if (bad) { setAviso(bad); return false; }
    const r = await api.create({ kind: "scene", campaignId: active.campaign.id, title: nome, visibility: "private" });
    if (!r.ok) { setAviso(r.error); return false; }
    setCenas(c => ({ ...c, [r.data.id]: r.data })); setEd(p => ({ ...p, [r.data.id]: novoEd(r.data) })); gravar(q => adicionarCartao(q, colunaId, r.data.id)); return true;
  };
  const excluirCartao = async (id: string) => {
    const r = await api.remove(id); if (!r.ok) { setAviso(r.error); return; }
    removerLocal(id); publicarExclusao(id, origem);
  };
  const soltar = (e: DragEndEvent) => {
    const a = String(e.active.id), o = e.over ? String(e.over.id) : null;
    if (a.startsWith("coluna:")) gravar(q => soltarColuna(q, a.slice(7), o));                      // arrastou uma coluna
    else if (o === "nova-coluna") gravar(q => moverParaNovaColuna(q, a, proximoNomeColuna(q)));      // soltou um cartão na área de nova coluna
    else gravar(q => soltarCartao(q, a, o));
  };

  return <div className="content planejamento" data-testid="planejamento">
    <div className="eyebrow">{active.campaign.name.toLocaleUpperCase("pt-BR")}</div>
    <h1>Planejamento</h1>
    <p>Prepare as sessões em colunas livres. Clique em um cartão para editá-lo aqui mesmo; clique com o botão direito (ou em “⋯”) para abri-lo em uma nova aba. Reorganizar o quadro não move nem duplica a página.</p>
    {erro && <div className="notice err" role="alert">{erro} <button className="btn-link" onClick={() => { setErro(null); setCarregado(false); void carregar(); }}>Tentar de novo</button></div>}
    {aviso && <div className="notice err" role="alert">{aviso}</div>}
    {!carregado && <p className="muted" role="status">Carregando o planejamento…</p>}
    {carregado && board && <DndContext sensors={sensores} collisionDetection={closestCorners} onDragEnd={soltar}><SortableContext items={quadro.colunas.map(c => `coluna:${c.id}`)} strategy={horizontalListSortingStrategy}><div className="quadro" role="list" aria-label="Colunas do planejamento">
      {quadro.colunas.map((col, ci) => <ColunaOrdenavel key={col.id} id={col.id} titulo={col.titulo} larga={col.cartoes.some(id => ed[id]?.aberto)}>
        <header>
          <ColunaAlca titulo={col.titulo}/>
          <input className="coluna-titulo" aria-label={`Nome da coluna ${col.titulo}`} defaultValue={col.titulo} maxLength={80} onBlur={e => { if (e.target.value.trim() && e.target.value !== col.titulo) gravar(q => renomearColuna(q, col.id, e.target.value)); else e.target.value = col.titulo; }}/>
          <button className="icon" aria-label={`Mover coluna ${col.titulo} para a esquerda`} disabled={ci === 0} onClick={() => gravar(q => moverColuna(q, col.id, -1))}><ArrowLeft size={14}/></button>
          <button className="icon" aria-label={`Mover coluna ${col.titulo} para a direita`} disabled={ci === quadro.colunas.length - 1} onClick={() => gravar(q => moverColuna(q, col.id, 1))}><ArrowRight size={14}/></button>
          <button className="icon" aria-label={`Excluir coluna ${col.titulo}`} title={col.cartoes.length ? "Esvazie a coluna para excluí-la" : "Excluir coluna"} disabled={col.cartoes.length > 0} onClick={() => gravar(q => excluirColuna(q, col.id))}><Trash2 size={14}/></button>
        </header>
        <ListaColuna colId={col.id} ids={col.cartoes.filter(id => cenas[id])}>{col.cartoes.map((id, i) => {
          const c = cenas[id]; if (!c) return null;
          const x = ed[id], sujo = !!x && edSujo(x), t = previaTexto(c.content, 500, "\n"), spec: TabSpec = { kind: "documento", ref: id, title: c.title };
          return <Ordenavel key={id} id={id} alca={`Arrastar o cartão ${c.title}`} onContextMenu={e => aoClicarDireito(e, spec)}>
            <CartaoTopo>
              <button className="cartao-abrir" aria-expanded={!!x?.aberto} onClick={() => alternar(id)}>
                <strong>{c.title}{sujo && <span className="sujo" title="Alterações não salvas" aria-label="alterações não salvas"> ●</span>}</strong>
                {!x?.aberto && t && <span className="cartao-previa">{t}</span>}
              </button>
              <button className="icon" type="button" aria-label={`Mais ações de ${c.title}`} aria-haspopup="menu" onClick={e => abrirMenuEm(e.currentTarget, spec)}><MoreHorizontal size={14}/></button>
            </CartaoTopo>
            {x && <div className="cartao-editor" hidden={!x.aberto}>
              <label>Título<input value={x.titulo} maxLength={120} onChange={e => { const v = e.target.value; mexer(id, y => ({ ...y, titulo: v })); }}/></label>
              <div className="campo-editor"><span className="campo-rotulo">Conteúdo</span>
                <EditorLazy key={x.chave} inicial={x.blocos} rotulo={`Conteúdo de ${x.base.title}`} onChange={b => mexer(id, y => ({ ...y, blocos: b, editou: true }))}/></div>
              {x.conflito && <ConflitoAviso conflito={x.conflito}
                onUsarRemoto={() => mexer(id, y => { const r = x.conflito?.registro; return r ? { ...y, base: r, titulo: r.title, blocos: r.content, editou: false, chave: y.chave + 1, conflito: null } : y; })}
                onManter={() => mexer(id, y => x.conflito?.registro ? { ...y, base: { ...y.base, version: x.conflito.registro.version }, conflito: null } : { ...y, conflito: null })}
                onFechar={() => mexer(id, y => ({ ...y, conflito: null }))}/>}
              {x.erro && <p role="alert" className="notice err">{x.erro}</p>}
              <div className="row">
                <button className="btn-primary" type="button" disabled={x.salvando} onClick={() => void salvar(id)}>{x.salvando ? "Salvando…" : "Salvar"}</button>
                {sujo && <button type="button" className="btn-secondary" onClick={() => mexer(id, y => ({ ...y, titulo: y.base.title, blocos: y.base.content, editou: false, chave: y.chave + 1, erro: null }))}>Descartar alterações</button>}
                <button type="button" className="btn-secondary" onClick={() => alternar(id)}>Recolher</button>
              </div>
              {sujo && <p className="muted">Recolher não descarta o que você digitou; as alterações ficam aqui até salvar ou descartar.</p>}
            </div>}
            <div className="cartao-acoes">
              <button className="icon" aria-label={`Subir ${c.title}`} disabled={i === 0} onClick={() => gravar(q => deslocarCartao(q, id, "cima"))}><ArrowUp size={13}/></button>
              <button className="icon" aria-label={`Descer ${c.title}`} disabled={i === col.cartoes.length - 1} onClick={() => gravar(q => deslocarCartao(q, id, "baixo"))}><ArrowDown size={13}/></button>
              <button className="icon" aria-label={`Mover ${c.title} para a coluna anterior`} disabled={ci === 0} onClick={() => gravar(q => deslocarCartao(q, id, "esquerda"))}><ArrowLeft size={13}/></button>
              <button className="icon" aria-label={`Mover ${c.title} para a próxima coluna`} disabled={ci === quadro.colunas.length - 1} onClick={() => gravar(q => deslocarCartao(q, id, "direita"))}><ArrowRight size={13}/></button>
              <button className="icon danger" aria-label={`Excluir cartão ${c.title}`} onClick={() => { if (window.confirm(`Excluir o cartão “${c.title}” e a página dele?${sujo ? " As alterações não salvas deste cartão serão perdidas." : ""}`)) void excluirCartao(id); }}><Trash2 size={13}/></button>
            </div>
          </Ordenavel>;
        })}</ListaColuna>
        <NovoCartao onCriar={t => novoCartao(col.id, t)}/>
      </ColunaOrdenavel>)}
      <NovaColuna onCriar={t => gravar(q => novaColuna(q, t.trim() ? t : proximoNomeColuna(q)))}/>
    </div></SortableContext></DndContext>}
    {carregado && board && quadro.colunas.length === 0 && <div className="placeholder"><ClipboardList size={30} aria-hidden="true"/><strong>Nenhuma coluna</strong><span>Crie a primeira coluna (por exemplo, “Sessão 5” ou “Julkoun”).</span></div>}
  </div>;
}

function NovoCartao({ onCriar }: { onCriar: (t: string) => Promise<boolean> }) {
  const [t, setT] = useState(""), [busy, setBusy] = useState(false);
  return <form className="novo" onSubmit={async e => { e.preventDefault(); if (busy) return; setBusy(true); const ok = await onCriar(t); setBusy(false); if (ok) setT(""); }}>
    <input value={t} onChange={e => setT(e.target.value)} placeholder="Novo cartão (nome opcional)" aria-label="Título do novo cartão" maxLength={120}/>
    <button className="icon" aria-label="Adicionar cartão" disabled={busy}><Plus size={15}/></button></form>;
}
function NovaColuna({ onCriar }: { onCriar: (t: string) => void }) {
  const [t, setT] = useState("");
  const { setNodeRef, isOver } = useDroppable({ id: "nova-coluna" });
  return <form ref={setNodeRef} className={isOver ? "coluna nova-coluna sobre" : "coluna nova-coluna"} onSubmit={e => { e.preventDefault(); onCriar(t); setT(""); }}>
    <input value={t} onChange={e => setT(e.target.value)} placeholder="Nome da nova coluna (opcional)" aria-label="Nome da nova coluna" maxLength={80}/>
    <button className="btn-secondary">Adicionar coluna</button>
    <small className="muted">Ou arraste um cartão até aqui para criar uma coluna com ele.</small></form>;
}

/** Lista de cartões de uma coluna: zona de soltura (inclusive coluna vazia) e contexto de ordenação. */
function ListaColuna({ colId, ids, children }: { colId: string; ids: string[]; children: ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id: `col:${colId}` });
  return <SortableContext items={ids} strategy={verticalListSortingStrategy}><ul ref={setNodeRef} className={isOver ? "cartoes sobre" : "cartoes"}>{children}</ul></SortableContext>;
}
const CartaoCtx = createContext<Record<string, unknown>>({});
/** Cabeçalho do cartão: clicar expande; arrastar (movimento > 6px) move o cartão. A alça continua para teclado e acessibilidade. */
function CartaoTopo({ children }: { children: ReactNode }) {
  const l = useContext(CartaoCtx);
  return <div className="cartao-topo arrastavel" {...l}>{children}</div>;
}
function Ordenavel({ id, alca, onContextMenu, children }: { id: string; alca: string; onContextMenu: (e: RMouseEvent) => void; children: ReactNode }) {
  const s = useSortable({ id });
  return <CartaoCtx.Provider value={(s.listeners ?? {}) as Record<string, unknown>}><li ref={s.setNodeRef} className={s.isDragging ? "cartao arrastando" : "cartao"} style={{ transform: CSS.Transform.toString(s.transform), transition: s.transition }} onContextMenu={onContextMenu}>
    <button type="button" className="alca" aria-label={alca} {...s.attributes} {...s.listeners}><GripVertical size={14}/></button>{children}</li></CartaoCtx.Provider>;
}

/** Coluna arrastável (pela alça no cabeçalho): o id "coluna:<id>" a distingue dos cartões no mesmo DndContext. */
function ColunaOrdenavel({ id, titulo, larga, children }: { id: string; titulo: string; larga: boolean; children: ReactNode }) {
  const s = useSortable({ id: `coluna:${id}` });
  return <ColunaCtx.Provider value={{ attributes: s.attributes as unknown as Record<string, unknown>, listeners: (s.listeners ?? {}) as Record<string, unknown> }}>
    <section ref={s.setNodeRef} className={(larga ? "coluna coluna-larga" : "coluna") + (s.isDragging ? " arrastando" : "")} role="listitem" aria-label={`Coluna ${titulo}`} style={{ transform: CSS.Translate.toString(s.transform), transition: s.transition }}>{children}</section></ColunaCtx.Provider>;
}
const ColunaCtx = createContext<{ attributes: Record<string, unknown>; listeners: Record<string, unknown> }>({ attributes: {}, listeners: {} });
function ColunaAlca({ titulo }: { titulo: string }) {
  const c = useContext(ColunaCtx);
  return <button type="button" className="alca-coluna" aria-label={`Arrastar a coluna ${titulo}`} {...c.attributes} {...c.listeners}><GripVertical size={14}/></button>;
}

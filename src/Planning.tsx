// Planejamento (só o mestre): colunas fixas e redimensionáveis, com cartões em lista vertical. Cada cartão é uma página (cena) privada.
// O cartão é só o texto: título editável no cabeçalho, conteúdo inteiro abaixo; clique no conteúdo para editar ali mesmo (editor rico).
// Salva SOZINHO (alguns instantes depois de parar de digitar, ao clicar fora e ao fechar a aba). O rascunho vive aqui no painel: mover,
// arrastar ou clicar em outro cartão nunca perde o que foi digitado; se o salvamento falhar, o texto continua na tela com aviso e "tentar de novo".
import { DndContext, KeyboardSensor, PointerSensor, TouchSensor, closestCorners, useDroppable, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, horizontalListSortingStrategy, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { ClipboardList, GripVertical, MoreHorizontal, Plus, Trash2 } from "lucide-react";
import { createContext, useCallback, useContext, useEffect, useRef, useState, type KeyboardEvent as RKeyEvent, type MouseEvent as RMouseEvent, type PointerEvent as RPointerEvent, type ReactNode } from "react";
import { useAbrirEmAba } from "./abrirEmAba";
import { useCampaigns } from "./CampaignsContext";
import { ConflitoAviso } from "./ConflitoAviso";
import { ConteudoLeve, temConteudo } from "./ConteudoLeve";
import { EditorLazy } from "./EditorLazy";
import type { BlocoTexto } from "./inicio";
import { LARGURA_MAX, LARGURA_MIN, LARGURA_PADRAO, adicionarCartao, excluirColuna, lerQuadro, limitarLargura, moverParaNovaColuna, novaColuna, novoId, proximoNomeColuna, redimensionarColuna, removerCartao, renomearColuna, soltarCartao, soltarColuna, type Quadro } from "./quadro";
import { validarTitulo, type Registro } from "./registros";
import { useRegistros } from "./RegistrosContext";
import { novaOrigem, publicarExclusao, publicarRegistro, useAssinaturaGeral, type Conflito } from "./registrosStore";
import { useUnsavedGuard } from "./unsaved";
import type { TabSpec } from "./workspace";

/** Estado de edição de um cartão (rascunho incluído). `editando` = editor aberto; fora disso o cartão mostra o conteúdo em leitura. */
type Ed = { editando: boolean; titulo: string; blocos: BlocoTexto[]; editou: boolean; base: Registro; chave: number; conflito: Conflito | null; salvando: boolean; erro: string | null };
export const edSujo = (e: Ed) => e.editou || e.titulo !== e.base.title;
const novoEd = (r: Registro, editando = false): Ed => ({ editando, titulo: r.title, blocos: r.content, editou: false, base: r, chave: 0, conflito: null, salvando: false, erro: null });
export const ATRASO_AUTOSSALVAR = 900;   // ms depois da última alteração

export function PlanningPanel(_: { onOpenContent?: (s: TabSpec) => void } = {}) {
  const { active } = useCampaigns(), api = useRegistros(), { aoClicarDireito, abrirMenuEm } = useAbrirEmAba();
  const cid = active?.campaign.id;
  const origem = useRef(novaOrigem()).current;
  const [board, setBoard] = useState<Registro | null>(null), [cenas, setCenas] = useState<Record<string, Registro>>({});
  const cenasRef = useRef(cenas); cenasRef.current = cenas;
  const [ed, setEd] = useState<Record<string, Ed>>({}); const edRef = useRef(ed); edRef.current = ed;
  const [carregado, setCarregado] = useState(false), [erro, setErro] = useState<string | null>(null), [aviso, setAviso] = useState<string | null>(null);
  const fila = useRef<Promise<unknown>>(Promise.resolve());   // grava o quadro em ordem, uma operação por vez (versão otimista)
  const boardRef = useRef<Registro | null>(null); boardRef.current = board;
  const versao = useRef(0);   // versão do quadro no servidor, atualizada a cada gravação confirmada
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());
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
  useEffect(() => () => { timers.current.forEach(clearTimeout); timers.current.clear(); }, []);

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

  const removerLocal = (id: string) => { timers.current.delete(id); setCenas(c => { const n = { ...c }; delete n[id]; return n; }); setEd(p => { const n = { ...p }; delete n[id]; return n; }); gravar(q => removerCartao(q, id)); };

  // Alterações salvas em OUTRO lugar (aba do mesmo registro em outro grupo): atualiza título/conteúdo e, se o cartão não tem rascunho, o texto; senão, avisa o conflito.
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

  /** Atualiza o estado de edição do cartão (criando-o a partir do registro salvo se ainda não existir). */
  const mexer = (id: string, f: (x: Ed) => Ed) => setEd(p => { const x = p[id] ?? (cenasRef.current[id] ? novoEd(cenasRef.current[id]) : null); return x ? { ...p, [id]: f(x) } : p; });

  const salvar = useCallback(async (id: string): Promise<boolean> => {
    const t = timers.current.get(id); if (t) { clearTimeout(t); timers.current.delete(id); }
    const x = edRef.current[id]; if (!x || !api) return true;
    if (!edSujo(x)) return true;
    if (x.salvando) { timers.current.set(id, setTimeout(() => { timers.current.delete(id); void salvar(id); }, 300)); return false; }   // termina o salvamento atual e tenta de novo
    const bad = validarTitulo(x.titulo); if (bad) { mexer(id, y => ({ ...y, erro: bad })); return false; }
    mexer(id, y => ({ ...y, salvando: true, erro: null }));
    const r = await api.update(x.base.id, x.base.version, { title: x.titulo, content: x.blocos });
    if (!r.ok) {
      let conflito: Conflito | null = null;
      if (/alterou/i.test(r.error)) { const g = await api.get(id); if (g.ok) conflito = { registro: g.data }; }   // conflito com o servidor: caminho seguro (escolher versão)
      mexer(id, y => ({ ...y, salvando: false, erro: r.error, conflito: conflito ?? y.conflito })); return false;
    }
    // "editou" só zera se nada foi digitado durante o salvamento; o que foi digitado depois é salvo na sequência
    let sobrou = false;
    mexer(id, y => { sobrou = y.blocos !== x.blocos || y.titulo !== x.titulo; return { ...y, salvando: false, base: r.data, editou: y.blocos === x.blocos ? false : y.editou, titulo: y.titulo === x.titulo ? r.data.title : y.titulo, conflito: null }; });
    setCenas(c => ({ ...c, [id]: r.data })); publicarRegistro(r.data, origem);
    if (sobrou) timers.current.set(id, setTimeout(() => { timers.current.delete(id); void salvar(id); }, 200));
    return true;
  }, [api, origem]); // eslint-disable-line react-hooks/exhaustive-deps

  const agendar = (id: string) => { const t = timers.current.get(id); if (t) clearTimeout(t); timers.current.set(id, setTimeout(() => { timers.current.delete(id); void salvar(id); }, ATRASO_AUTOSSALVAR)); };

  // Clicar fora do cartão que está sendo editado: salva e volta a mostrar o conteúdo em leitura (popovers do editor não contam como "fora").
  useEffect(() => {
    const h = (e: PointerEvent) => {
      const alvo = e.target as Element | null; if (!alvo || alvo.closest("[class*='mantine'], [class*='bn-']")) return;
      const dentro = alvo.closest("[data-cartao]")?.getAttribute("data-cartao");
      for (const [id, x] of Object.entries(edRef.current)) if (x.editando && id !== dentro) { if (edSujo(x)) void salvar(id); setEd(p => p[id] ? { ...p, [id]: { ...p[id], editando: false } } : p); }
    };
    document.addEventListener("pointerdown", h, true); return () => document.removeEventListener("pointerdown", h, true);
  }, [salvar]);

  // Fechar/trocar a aba do Planejamento com algo ainda não salvo (falha de rede, por exemplo) pede confirmação e oferece salvar.
  const algumSujo = Object.values(ed).some(edSujo);
  const salvarTodos = useCallback(async () => { let ok = true; for (const [id, x] of Object.entries(edRef.current)) if (edSujo(x)) ok = (await salvar(id)) && ok; return ok; }, [salvar]);
  useUnsavedGuard("secao:planejamento", algumSujo, salvarTodos);

  if (!active) return <div className="content"><h1>Planejamento</h1><div className="notice" role="status">O Planejamento pertence a uma campanha. Escolha uma campanha ativa na barra lateral.</div></div>;
  if (active.role !== "mestre") return <div className="content"><h1>Planejamento</h1><div className="notice" role="status">O Planejamento é exclusivo do mestre desta campanha.</div></div>;
  if (!api) return <div className="content"><h1>Planejamento</h1><div className="notice" role="status">Conta necessária para usar o Planejamento.</div></div>;

  const quadro: Quadro = lerQuadro(board?.meta);
  const novoCartao = async (colunaId: string, titulo: string) => {
    const nome = titulo.trim() || "Novo cartão";   // o nome é opcional: dá para renomear no próprio cartão
    const bad = validarTitulo(nome); if (bad) { setAviso(bad); return false; }
    const r = await api.create({ kind: "scene", campaignId: active.campaign.id, title: nome, visibility: "private" });
    if (!r.ok) { setAviso(r.error); return false; }
    setCenas(c => ({ ...c, [r.data.id]: r.data })); setEd(p => ({ ...p, [r.data.id]: novoEd(r.data, true) })); gravar(q => adicionarCartao(q, colunaId, r.data.id)); return true;
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
    <p>Clique no texto de um cartão para editá-lo (salva sozinho). Arraste cartões e colunas pelas alças; ajuste a largura de uma coluna pela borda direita. Botão direito no cartão: abrir em nova aba.</p>
    {erro && <div className="notice err" role="alert">{erro} <button className="btn-link" onClick={() => { setErro(null); setCarregado(false); void carregar(); }}>Tentar de novo</button></div>}
    {aviso && <div className="notice err" role="alert">{aviso}</div>}
    {!carregado && <p className="muted" role="status">Carregando o planejamento…</p>}
    {carregado && board && <DndContext sensors={sensores} collisionDetection={closestCorners} onDragEnd={soltar}><SortableContext items={quadro.colunas.map(c => `coluna:${c.id}`)} strategy={horizontalListSortingStrategy}><div className="quadro" role="list" aria-label="Colunas do planejamento">
      {quadro.colunas.map(col => <ColunaOrdenavel key={col.id} id={col.id} titulo={col.titulo} largura={col.largura ?? LARGURA_PADRAO} onLargura={w => gravar(q => redimensionarColuna(q, col.id, w))}>
        <header>
          <ColunaAlca titulo={col.titulo}/>
          <input className="coluna-titulo" aria-label={`Nome da coluna ${col.titulo}`} defaultValue={col.titulo} maxLength={80} onBlur={e => { if (e.target.value.trim() && e.target.value !== col.titulo) gravar(q => renomearColuna(q, col.id, e.target.value)); else e.target.value = col.titulo; }}/>
          <button className="icon" aria-label={`Excluir coluna ${col.titulo}`} title={col.cartoes.length ? "Esvazie a coluna para excluí-la" : "Excluir coluna"} disabled={col.cartoes.length > 0} onClick={() => gravar(q => excluirColuna(q, col.id))}><Trash2 size={14}/></button>
        </header>
        <ListaColuna colId={col.id} ids={col.cartoes.filter(id => cenas[id])}>{col.cartoes.map(id => {
          const c = cenas[id]; if (!c) return null;
          const x = ed[id], sujo = !!x && edSujo(x), blocos = x?.blocos ?? c.content, spec: TabSpec = { kind: "documento", ref: id, title: c.title };
          const editar = () => mexer(id, y => ({ ...y, editando: true }));
          return <Ordenavel key={id} id={id} alca={`Arrastar o cartão ${c.title}`} onContextMenu={e => aoClicarDireito(e, spec)}>
            <CartaoTopo>
              <div className="cartao-linha">
                <input className="cartao-titulo" aria-label={`Título do cartão ${c.title}`} value={x?.titulo ?? c.title} maxLength={120} onPointerDown={e => e.stopPropagation()}
                  onChange={e => { const v = e.target.value; mexer(id, y => ({ ...y, titulo: v })); agendar(id); }}
                  onBlur={() => { const v = edRef.current[id]; if (v && !v.titulo.trim()) mexer(id, y => ({ ...y, titulo: y.base.title })); else void salvar(id); }}
                  onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); (e.target as HTMLInputElement).blur(); } }}/>
                <Estado x={x} sujo={sujo} onTentar={() => void salvar(id)}/>
                <button className="icon" type="button" aria-label={`Mais ações de ${c.title}`} aria-haspopup="menu" onClick={e => abrirMenuEm(e.currentTarget, spec)}><MoreHorizontal size={14}/></button>
              </div>
            </CartaoTopo>
            <div className="cartao-corpo" data-cartao={id}>
              {x?.editando
                ? <EditorLazy key={x.chave} inicial={x.blocos} focar rotulo={`Conteúdo de ${c.title}`} onChange={b => { mexer(id, y => ({ ...y, blocos: b, editou: true })); agendar(id); }}/>
                : <div className="cartao-conteudo" role="button" tabIndex={0} aria-label={`Editar o texto de ${c.title}`} onClick={editar} onKeyDown={(e: RKeyEvent) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); editar(); } }}>
                  {temConteudo(blocos) ? <ConteudoLeve blocos={blocos}/> : <span className="muted">Clique para escrever…</span>}</div>}
              {x?.conflito && <ConflitoAviso conflito={x.conflito}
                onUsarRemoto={() => mexer(id, y => { const r = x.conflito?.registro; return r ? { ...y, base: r, titulo: r.title, blocos: r.content, editou: false, chave: y.chave + 1, conflito: null } : y; })}
                onManter={() => { mexer(id, y => x.conflito?.registro ? { ...y, base: { ...y.base, version: x.conflito.registro.version }, conflito: null } : { ...y, conflito: null }); agendar(id); }}
                onFechar={() => mexer(id, y => ({ ...y, conflito: null }))}/>}
              {x?.erro && <p role="alert" className="notice err">{x.erro} <button className="btn-link" onClick={() => void salvar(id)}>Tentar de novo</button></p>}
            </div>
            <div className="cartao-rodape">
              <button className="icon danger" aria-label={`Excluir cartão ${c.title}`} title="Excluir cartão" onClick={() => { if (window.confirm(`Excluir o cartão “${c.title}” e a página dele?${sujo ? " As alterações não salvas deste cartão serão perdidas." : ""}`)) void excluirCartao(id); }}><Trash2 size={13}/></button>
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

/** Estado discreto do salvamento automático: nada quando salvo; "●" pendente; "salvando…"; falha com tentar de novo. */
function Estado({ x, sujo, onTentar }: { x?: Ed; sujo: boolean; onTentar: () => void }) {
  if (!x) return null;
  if (x.erro && sujo) return <button type="button" className="estado estado-erro" onClick={onTentar} title={x.erro}>não salvou</button>;
  if (x.salvando) return <span className="estado" role="status">salvando…</span>;
  if (sujo) return <span className="estado sujo" title="Alterações ainda não salvas (salvam sozinhas)" aria-label="alterações não salvas">●</span>;
  return null;
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
/** Cabeçalho do cartão: arrastar (movimento > 6px) move o cartão. A alça continua para teclado e acessibilidade. */
function CartaoTopo({ children }: { children: ReactNode }) {
  const l = useContext(CartaoCtx);
  return <div className="cartao-topo arrastavel" {...l}>{children}</div>;
}
function Ordenavel({ id, alca, onContextMenu, children }: { id: string; alca: string; onContextMenu: (e: RMouseEvent) => void; children: ReactNode }) {
  const s = useSortable({ id });
  return <CartaoCtx.Provider value={(s.listeners ?? {}) as Record<string, unknown>}><li ref={s.setNodeRef} className={s.isDragging ? "cartao arrastando" : "cartao"} style={{ transform: CSS.Transform.toString(s.transform), transition: s.transition }} onContextMenu={onContextMenu}>
    <button type="button" className="alca" aria-label={alca} {...s.attributes} {...s.listeners}><GripVertical size={14}/></button>{children}</li></CartaoCtx.Provider>;
}

/** Coluna arrastável (pela alça no cabeçalho) e redimensionável (pela borda direita): todos os cartões dela acompanham a largura. */
function ColunaOrdenavel({ id, titulo, largura, onLargura, children }: { id: string; titulo: string; largura: number; onLargura: (w: number) => void; children: ReactNode }) {
  const s = useSortable({ id: `coluna:${id}` });
  const [vivo, setVivo] = useState<number | null>(null);   // largura durante o arraste; só vira dado ao soltar
  const ref = useRef<{ x: number; w: number } | null>(null);
  const w = vivo ?? largura;
  const comecar = (e: RPointerEvent) => { e.preventDefault(); e.stopPropagation(); (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); ref.current = { x: e.clientX, w: largura }; setVivo(largura); };
  const mover = (e: RPointerEvent) => { if (ref.current) setVivo(limitarLargura(ref.current.w + e.clientX - ref.current.x)); };
  const soltar = (e: RPointerEvent) => { if (!ref.current) return; const nova = limitarLargura(ref.current.w + e.clientX - ref.current.x); ref.current = null; setVivo(null); if (nova !== largura) onLargura(nova); };
  const teclas = (e: RKeyEvent) => { const d = e.key === "ArrowRight" ? 20 : e.key === "ArrowLeft" ? -20 : 0; if (d) { e.preventDefault(); onLargura(limitarLargura(largura + d)); } };
  return <ColunaCtx.Provider value={{ attributes: s.attributes as unknown as Record<string, unknown>, listeners: (s.listeners ?? {}) as Record<string, unknown> }}>
    <section ref={s.setNodeRef} className={"coluna" + (s.isDragging ? " arrastando" : "") + (vivo !== null ? " redimensionando" : "")} role="listitem" aria-label={`Coluna ${titulo}`}
      style={{ transform: CSS.Translate.toString(s.transform), transition: s.transition, flexBasis: w, width: w }}>{children}
      <div className="coluna-redim" role="separator" aria-orientation="vertical" aria-label={`Redimensionar a coluna ${titulo}`} aria-valuemin={LARGURA_MIN} aria-valuemax={LARGURA_MAX} aria-valuenow={w} tabIndex={0}
        onPointerDown={comecar} onPointerMove={mover} onPointerUp={soltar} onPointerCancel={soltar} onKeyDown={teclas} title="Arraste para ajustar a largura da coluna"/>
    </section></ColunaCtx.Provider>;
}
const ColunaCtx = createContext<{ attributes: Record<string, unknown>; listeners: Record<string, unknown> }>({ attributes: {}, listeners: {} });
function ColunaAlca({ titulo }: { titulo: string }) {
  const c = useContext(ColunaCtx);
  return <button type="button" className="alca-coluna" aria-label={`Arrastar a coluna ${titulo}`} {...c.attributes} {...c.listeners}><GripVertical size={14}/></button>;
}

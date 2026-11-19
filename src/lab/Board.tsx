// PROTÓTIPO: quadro de planejamento (colunas livres, cartões verticais, compacto/expandido, reorganização).
// - Desempenho: cartões mostram prévia leve ou o renderizador somente leitura; só UM cartão por vez monta um editor completo.
// - Arrastar e soltar (@dnd-kit, MIT): só pela ALÇA do cartão (mouse, toque com pressão longa e teclado); o corpo do cartão e o editor nunca iniciam arrasto.
//   Os botões ↑ ↓ ← → continuam como alternativa. O cartão referencia uma página: mover o cartão nunca altera a página.
import { useEffect, useMemo, useRef, useState } from "react";
import { closestCorners, DndContext, pointerWithin, DragOverlay, KeyboardSensor, MouseSensor, TouchSensor, useDroppable, useSensor, useSensors, type Announcements, type CollisionDetection, type DragEndEvent, type DragOverEvent, type DragStartEvent } from "@dnd-kit/core";
import { SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, ChevronDown, ChevronRight, GripVertical, Pencil } from "lucide-react";
import { useCreateBlockNote } from "@blocknote/react";
import { BlockNoteView } from "@blocknote/mantine";
import "@blocknote/mantine/style.css";
import { labSchema } from "./schema";
import { Preview } from "./Preview";
import { columnOf, moveCard, moveCardTo, pageOf, previewText, sampleBoard, setCardMode, updatePage, type Board as BoardData, type Card, type Dir, type LabBlock, type Page } from "./model";

const colId = (id: string) => `col:${id}`;
/** Destino do arrasto: o que está SOB o ponteiro (previsível com cartões altos); fora de qualquer alvo, o mais próximo pelos cantos. */
const collision: CollisionDetection = args => { const hits = pointerWithin(args); return hits.length ? hits : closestCorners(args); };
const isColId = (id: unknown): id is string => typeof id === "string" && id.startsWith("col:");

function CardEditor({ page, onSave, onCancel }: { page: Page; onSave: (blocks: LabBlock[]) => void; onCancel: () => void }) {
  const editor = useCreateBlockNote({ schema: labSchema, initialContent: page.blocks as never });
  const [dirty, setDirty] = useState(false);
  return <div className="lab-card-edit">
    <BlockNoteView editor={editor} theme="dark" onChange={() => setDirty(true)}/>
    <div className="lab-actions"><button onClick={() => onSave(editor.document as unknown as LabBlock[])}>Salvar{dirty ? " *" : ""}</button><button onClick={onCancel}>Cancelar</button></div>
  </div>;
}

type CardProps = {
  card: Card; page: Page; editing: boolean; shortcut: boolean; canMove: Record<Dir, boolean>; reduced: boolean;
  onMode: () => void; onMove: (d: Dir) => void; onEdit: () => void; onSave: (b: LabBlock[]) => void; onCancel: () => void; onRef: (k: string, id: string) => void;
};

function CardBody({ card, page, editing, shortcut, canMove, onMode, onMove, onEdit, onSave, onCancel, onRef, handle }: Omit<CardProps, "reduced"> & { handle?: JSX.Element }) {
  const expanded = card.mode === "expanded";
  const preview = useMemo(() => previewText(page.blocks), [page.blocks]);
  const mv = (d: Dir, label: string, icon: JSX.Element) => <button className="lab-mv" aria-label={`${label}: ${page.title}`} title={label} disabled={!canMove[d]} onClick={() => onMove(d)}>{icon}</button>;
  return <>
    <header>
      {handle}
      <button className="lab-toggle" aria-expanded={expanded} aria-label={`${expanded ? "Recolher" : "Expandir"} ${page.title}`} onClick={onMode}>{expanded ? <ChevronDown size={16}/> : <ChevronRight size={16}/>}<strong>{page.title}</strong>{shortcut && <span className="lab-shortcut" title="Atalho: este cartão mostra a mesma página de outro cartão">atalho</span>}</button>
      <span className="lab-moves" role="group" aria-label={`Mover ${page.title}`}>{mv("up", "Subir", <ArrowUp size={14}/>)}{mv("down", "Descer", <ArrowDown size={14}/>)}{mv("left", "Coluna à esquerda", <ArrowLeft size={14}/>)}{mv("right", "Coluna à direita", <ArrowRight size={14}/>)}</span>
    </header>
    {!expanded && <p className="lab-prev">{preview}</p>}
    {expanded && !editing && <><Preview blocks={page.blocks} onRef={onRef}/><div className="lab-actions"><button onClick={onEdit}><Pencil size={13}/> Editar</button></div></>}
    {expanded && editing && <CardEditor page={page} onSave={onSave} onCancel={onCancel}/>}
  </>;
}

function SortableCard(props: CardProps) {
  const { card, page, editing, reduced } = props;
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id: card.id, disabled: editing, transition: reduced ? null : undefined });
  const style = { transform: CSS.Transform.toString(transform), transition: reduced ? undefined : transition };
  const handle = <button ref={setActivatorNodeRef} className="lab-grip" aria-label={`Arrastar cartão: ${page.title}`} title={editing ? "Salve ou cancele a edição para arrastar" : "Arrastar (mouse, toque prolongado ou teclado: Espaço, setas, Espaço)"} disabled={editing} {...attributes} {...listeners}><GripVertical size={16}/></button>;
  return <article ref={setNodeRef} style={style} className={`lab-card${props.card.mode === "expanded" ? " expanded" : ""}${isDragging ? " lab-ghost" : ""}`} data-card={card.id} data-page={page.id}>
    <CardBody {...props} handle={handle}/>
  </article>;
}

function ColumnView({ col, children, count }: { col: { id: string; title: string }; children: React.ReactNode; count: number }) {
  const { setNodeRef, isOver } = useDroppable({ id: colId(col.id) });
  return <section className={`lab-col${isOver ? " lab-over" : ""}`} aria-label={`Coluna ${col.title}`} data-col={col.id}>
    <h3>{col.title} <span className="lab-count">{count}</span></h3>
    <div ref={setNodeRef} className={`lab-cards${count === 0 ? " lab-empty" : ""}`}>{children}{count === 0 && <p className="lab-drop-hint">Solte um cartão aqui</p>}</div>
  </section>;
}

function usePrefersReducedMotion() {
  const [r, setR] = useState(() => typeof window !== "undefined" && !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches);
  useEffect(() => {
    const q = window.matchMedia?.("(prefers-reduced-motion: reduce)"); if (!q) return;
    const on = () => setR(q.matches); q.addEventListener?.("change", on); return () => q.removeEventListener?.("change", on);
  }, []);
  return r;
}

export function Board({ initial, onEvent }: { initial?: BoardData; onEvent?: (s: string) => void }) {
  const [board, setBoard] = useState<BoardData>(() => initial ?? sampleBoard());
  const [editing, setEditing] = useState<string | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const start = useRef<BoardData | null>(null);          // estado de antes do arrasto: Esc/cancelamento volta a ele
  const reduced = usePrefersReducedMotion();
  const emit = (s: string) => onEvent?.(s);
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),                    // pequeno movimento: um clique na alça não arrasta
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 8 } }),       // toque: pressão longa na alça (a rolagem da página continua livre)
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const title = (id: unknown) => { const c = board.columns.flatMap(x => x.cards).find(k => k.id === id); return c ? pageOf(board, c)?.title ?? "cartão" : "cartão"; };
  const where = (id: unknown) => { const c = isColId(id) ? board.columns.find(x => colId(x.id) === id) : columnOf(board, String(id)); return c ? `coluna ${c.title}` : "fora das colunas"; };
  const announcements: Announcements = {
    onDragStart: ({ active }) => `Cartão ${title(active.id)} pego na ${where(active.id)}. Use as setas para mover, Espaço para soltar e Esc para cancelar.`,
    onDragOver: ({ active, over }) => (over ? `Cartão ${title(active.id)} sobre a ${where(over.id)}.` : undefined),
    onDragEnd: ({ active, over }) => (over ? `Cartão ${title(active.id)} solto na ${where(active.id)}.` : `Cartão ${title(active.id)} solto sem mudança.`),
    onDragCancel: ({ active }) => `Movimento cancelado. O cartão ${title(active.id)} voltou à posição original.`,
  };

  // Destino de um "sobre": coluna e posição final. Sobre uma coluna (inclusive vazia) = fim; sobre um cartão = a posição dele.
  const target = (b: BoardData, overId: string) => {
    if (isColId(overId)) { const c = b.columns.find(x => colId(x.id) === overId); return c ? { column: c.id, index: c.cards.length } : null; }
    const c = columnOf(b, overId); return c ? { column: c.id, index: c.cards.findIndex(k => k.id === overId) } : null;
  };
  const onStart = (e: DragStartEvent) => { start.current = board; setActiveId(String(e.active.id)); };
  const onOver = ({ active, over }: DragOverEvent) => {                                   // entre colunas: o cartão "entra" na coluna enquanto se arrasta (marca o destino)
    if (!over) return;
    setBoard(b => { const t = target(b, String(over.id)), from = columnOf(b, String(active.id)); return t && from && t.column !== from.id ? moveCardTo(b, String(active.id), t.column, t.index) : b; });
  };
  const onEnd = ({ active, over }: DragEndEvent) => {
    setActiveId(null);
    const t = over ? target(boardRef.current, String(over.id)) : null;
    const next = t ? moveCardTo(boardRef.current, String(active.id), t.column, t.index) : boardRef.current;
    if (next !== boardRef.current) { boardRef.current = next; setBoard(next); }
    const order = (b: BoardData) => JSON.stringify(b.columns.map(c => c.cards.map(k => k.id)));
    const moved = !!start.current && order(start.current) !== order(next);
    emit(moved ? `arrastou ${title(active.id)}` : "arrasto sem mudança"); start.current = null;
  };
  const onCancel = () => { setActiveId(null); if (start.current) setBoard(start.current); start.current = null; emit("arrasto cancelado"); };
  const boardRef = useRef(board); boardRef.current = board;
  const activeCard = activeId ? board.columns.flatMap(c => c.cards).find(k => k.id === activeId) : undefined;

  return <div className="lab-board" aria-label={board.title}>
    <h2 className="lab-title">{board.title}</h2>
    <DndContext sensors={sensors} collisionDetection={collision} onDragStart={onStart} onDragOver={onOver} onDragEnd={onEnd} onDragCancel={onCancel}
      accessibility={{ announcements, screenReaderInstructions: { draggable: "Para mover o cartão, foque a alça e pressione Espaço. Use as setas para escolher o destino, Espaço para soltar e Esc para cancelar. Os botões de seta do cartão também movem." } }}>
      <div className="lab-cols">{board.columns.map((col, ci) => {
        const seen = (pid: string) => board.columns.reduce((n, c) => n + c.cards.filter(k => k.pageId === pid).length, 0) > 1;
        return <ColumnView key={col.id} col={col} count={col.cards.length}>
          <SortableContext items={col.cards.map(k => k.id)} strategy={verticalListSortingStrategy}>
            {col.cards.map((card, i) => { const page = pageOf(board, card); return <SortableCard key={card.id} card={card} page={page} editing={editing === card.id} reduced={reduced} shortcut={seen(card.pageId)}
              canMove={{ up: i > 0, down: i < col.cards.length - 1, left: ci > 0, right: ci < board.columns.length - 1 }}
              onMode={() => { if (editing === card.id) return; setBoard(b => setCardMode(b, card.id, card.mode === "compact" ? "expanded" : "compact")); }}
              onMove={d => { setBoard(b => moveCard(b, card.id, d)); emit(`mover ${page.title} ${d}`); }}
              onEdit={() => setEditing(card.id)}
              onSave={blocks => { setBoard(b => updatePage(b, card.pageId, { blocks })); setEditing(null); emit(`salvou ${page.title}`); }}
              onCancel={() => setEditing(null)}
              onRef={(k, id) => emit(`referência ${k}:${id}`)}/>; })}
          </SortableContext>
        </ColumnView>;
      })}</div>
      <DragOverlay dropAnimation={reduced ? null : undefined}>{activeCard ? <div className="lab-card lab-overlay"><header><GripVertical size={16}/><strong>{pageOf(board, activeCard)?.title}</strong></header><p className="lab-prev">{previewText(pageOf(board, activeCard)?.blocks ?? [])}</p></div> : null}</DragOverlay>
    </DndContext>
  </div>;
}

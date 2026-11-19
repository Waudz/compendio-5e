// PROTÓTIPO: quadro de planejamento (colunas livres, cartões verticais, compacto/expandido, reorganização).
// Estratégia de desempenho: cartões mostram prévia leve (texto) ou o renderizador somente leitura; só UM cartão por vez monta um editor completo.
import { useMemo, useState } from "react";
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, ChevronDown, ChevronRight, Pencil } from "lucide-react";
import { useCreateBlockNote } from "@blocknote/react";
import { BlockNoteView } from "@blocknote/mantine";
import "@blocknote/mantine/style.css";
import { labSchema } from "./schema";
import { Preview } from "./Preview";
import { moveCard, previewText, sampleBoard, updateCard, type Board as BoardData, type Card, type Dir, type LabBlock } from "./model";

function CardEditor({ card, onSave, onCancel }: { card: Card; onSave: (blocks: LabBlock[]) => void; onCancel: () => void }) {
  const editor = useCreateBlockNote({ schema: labSchema, initialContent: card.blocks as never });
  const [dirty, setDirty] = useState(false);
  return <div className="lab-card-edit">
    <BlockNoteView editor={editor} theme="dark" onChange={() => setDirty(true)}/>
    <div className="lab-actions"><button onClick={() => onSave(editor.document as unknown as LabBlock[])}>Salvar{dirty ? " *" : ""}</button><button onClick={onCancel}>Cancelar</button></div>
  </div>;
}

function CardView({ card, editing, canMove, onMode, onMove, onEdit, onSave, onCancel, onRef }: {
  card: Card; editing: boolean; canMove: Record<Dir, boolean>;
  onMode: () => void; onMove: (d: Dir) => void; onEdit: () => void; onSave: (b: LabBlock[]) => void; onCancel: () => void; onRef: (k: string, id: string) => void;
}) {
  const expanded = card.mode === "expanded";
  const preview = useMemo(() => previewText(card.blocks), [card.blocks]);
  const mv = (d: Dir, label: string, icon: JSX.Element) => <button className="lab-mv" aria-label={`${label}: ${card.title}`} title={label} disabled={!canMove[d]} onClick={() => onMove(d)}>{icon}</button>;
  return <article className={expanded ? "lab-card expanded" : "lab-card"} data-card={card.id}>
    <header>
      <button className="lab-toggle" aria-expanded={expanded} aria-label={`${expanded ? "Recolher" : "Expandir"} ${card.title}`} onClick={onMode}>{expanded ? <ChevronDown size={16}/> : <ChevronRight size={16}/>}<strong>{card.title}</strong></button>
      <span className="lab-moves" role="group" aria-label={`Mover ${card.title}`}>{mv("up", "Subir", <ArrowUp size={14}/>)}{mv("down", "Descer", <ArrowDown size={14}/>)}{mv("left", "Coluna à esquerda", <ArrowLeft size={14}/>)}{mv("right", "Coluna à direita", <ArrowRight size={14}/>)}</span>
    </header>
    {!expanded && <p className="lab-prev">{preview}</p>}
    {expanded && !editing && <><Preview blocks={card.blocks} onRef={onRef}/><div className="lab-actions"><button onClick={onEdit}><Pencil size={13}/> Editar</button></div></>}
    {expanded && editing && <CardEditor card={card} onSave={onSave} onCancel={onCancel}/>}
  </article>;
}

export function Board({ initial, onEvent }: { initial?: BoardData; onEvent?: (s: string) => void }) {
  const [board, setBoard] = useState<BoardData>(() => initial ?? sampleBoard());
  const [editing, setEditing] = useState<string | null>(null);
  const emit = (s: string) => onEvent?.(s);
  return <div className="lab-board" aria-label={board.title}>
    <h2 className="lab-title">{board.title}</h2>
    <div className="lab-cols">{board.columns.map((col, ci) => <section key={col.id} className="lab-col" aria-label={`Coluna ${col.title}`}>
      <h3>{col.title} <span className="lab-count">{col.cards.length}</span></h3>
      <div className="lab-cards">{col.cards.map((card, i) => <CardView key={card.id} card={card} editing={editing === card.id}
        canMove={{ up: i > 0, down: i < col.cards.length - 1, left: ci > 0, right: ci < board.columns.length - 1 }}
        onMode={() => { if (editing === card.id) return; setBoard(b => updateCard(b, card.id, { mode: card.mode === "compact" ? "expanded" : "compact" })); }}
        onMove={d => { setBoard(b => moveCard(b, card.id, d)); emit(`mover ${card.title} ${d}`); }}
        onEdit={() => setEditing(card.id)}
        onSave={blocks => { setBoard(b => updateCard(b, card.id, { blocks })); setEditing(null); emit(`salvou ${card.title}`); }}
        onCancel={() => setEditing(null)}
        onRef={(k, id) => emit(`referência ${k}:${id}`)}/>)}</div>
    </section>)}</div>
  </div>;
}

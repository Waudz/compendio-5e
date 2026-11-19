// PROTÓTIPO: bancada do editor (um editor completo): blocos, aninhamento, tabela, link, referência interna, JSON ida e volta, desfazer/refazer.
import { useRef, useState } from "react";
import { useCreateBlockNote } from "@blocknote/react";
import { BlockNoteView } from "@blocknote/mantine";
import "@blocknote/mantine/style.css";
import { labSchema } from "./schema";
import { sampleBoard, serialize, deserialize, type LabBlock } from "./model";

/* O tipo genérico do editor com esquema customizado é pesado; a bancada usa uma visão estreita do que precisa. */
type Ed = { document: unknown[]; undo(): void; redo(): void; insertInlineContent(c: unknown): void; insertBlocks(b: unknown[], ref: unknown, place: "before" | "after"): void; replaceBlocks(r: unknown[], b: unknown[]): void; getTextCursorPosition(): { block: unknown } };

export const initialBlocks = (): LabBlock[] => sampleBoard().columns[0].cards[0].blocks;

export function EditorBench({ onMetric }: { onMetric?: (s: string) => void }) {
  const editor = useCreateBlockNote({ schema: labSchema, initialContent: initialBlocks() as never }) as unknown as Ed;
  const [editable, setEditable] = useState(true), [json, setJson] = useState(""), [msg, setMsg] = useState("");
  const view = useRef<HTMLDivElement>(null);
  const say = (s: string) => { setMsg(s); onMetric?.(s); };

  const exportJson = () => { setJson(JSON.stringify(editor.document, null, 1)); say(`JSON exportado (${JSON.stringify(editor.document).length} bytes, ${editor.document.length} blocos de topo).`); };
  const importJson = () => {
    const blocks = deserialize(json);
    if (!blocks) return say("JSON inválido: nada foi alterado.");
    editor.replaceBlocks(editor.document, blocks); say(`JSON carregado: ${blocks.length} blocos de topo.`);
  };
  const roundtrip = () => {
    const before = serialize(editor.document as LabBlock[]);
    const blocks = deserialize(before)!; editor.replaceBlocks(editor.document, blocks);
    const after = serialize(editor.document as LabBlock[]);
    say(before === after ? `Ida e volta idêntica (${before.length} bytes).` : `DIFERENÇA na ida e volta: antes ${before.length} bytes, depois ${after.length}.`);
  };
  const insertTable = () => editor.insertBlocks([{ type: "table", content: { type: "tableContent", rows: [{ cells: ["A", "B"] }, { cells: ["1", "2"] }] } }], editor.getTextCursorPosition().block, "after");
  const insertRef = () => editor.insertInlineContent([{ type: "ref", props: { kind: "npc", refId: "marta", label: "Marta" } }, " "]);
  const insertLink = () => editor.insertInlineContent([{ type: "link", href: "https://exemplo.com", content: "link de teste" }, " "]);
  const typingBench = () => {
    const times: number[] = [];
    for (let i = 0; i < 300; i++) { const t0 = performance.now(); editor.insertInlineContent("a"); times.push(performance.now() - t0); }
    times.sort((a, b) => a - b);
    say(`300 inserções de caractere (sintético, sem digitação real): mediana ${times[150].toFixed(2)} ms, p95 ${times[285].toFixed(2)} ms, máx ${times[299].toFixed(2)} ms.`);
  };
  const bigDoc = () => {
    const t0 = performance.now();
    const blocks: LabBlock[] = Array.from({ length: 500 }, (_, i) => ({ type: i % 5 === 0 ? "heading" : "paragraph", props: i % 5 === 0 ? { level: 2 } : {}, content: [{ type: "text", text: `Bloco ${i}: texto de exemplo para medir a carga de um documento grande.`, styles: {} }] }));
    editor.replaceBlocks(editor.document, blocks as never);
    say(`Documento de 500 blocos carregado em ${(performance.now() - t0).toFixed(0)} ms.`);
  };

  return <section className="lab-sec" aria-label="Bancada do editor">
    <div className="lab-tools" role="toolbar" aria-label="Ferramentas da bancada">
      <button onClick={() => setEditable(v => !v)} aria-pressed={!editable}>{editable ? "Modo leitura" : "Modo edição"}</button>
      <button onClick={() => editor.undo()}>Desfazer</button><button onClick={() => editor.redo()}>Refazer</button>
      <button onClick={insertTable} disabled={!editable}>Inserir tabela</button><button onClick={insertRef} disabled={!editable}>Inserir referência (NPC)</button><button onClick={insertLink} disabled={!editable}>Inserir link</button>
      <button onClick={exportJson}>Exportar JSON</button><button onClick={importJson}>Carregar JSON</button><button onClick={roundtrip}>Ida e volta</button>
      <button onClick={typingBench} disabled={!editable}>Medir digitação</button><button onClick={bigDoc}>Documento de 500 blocos</button>
    </div>
    <p className="lab-msg" role="status">{msg}</p>
    <div className="lab-editor" ref={view}><BlockNoteView editor={editor as never} theme="dark" editable={editable}/></div>
    <label className="lab-json">JSON dos blocos (formato canônico)<textarea value={json} onChange={e => setJson(e.target.value)} rows={8} spellCheck={false}/></label>
  </section>;
}

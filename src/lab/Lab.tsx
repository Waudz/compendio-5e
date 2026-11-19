// PROTÓTIPO (somente desenvolvimento): laboratório do editor de blocos. Acesso: ?lab=editor (ver src/main.tsx). Sem Supabase, sem persistência.
import { useLayoutEffect, useMemo, useRef, useState } from "react";
import { Layout, Model, type TabNode } from "flexlayout-react";
import "flexlayout-react/style/dark.css";
import { useCreateBlockNote } from "@blocknote/react";
import { BlockNoteView } from "@blocknote/mantine";
import { Board } from "./Board";
import { EditorBench, initialBlocks } from "./EditorBench";
import { countCards, manyCards, sampleBoard } from "./model";
import { Preview } from "./Preview";
import { labSchema } from "./schema";
import "./lab.css";

type Tab = "editor" | "quadro" | "paineis" | "desempenho";
const heap = () => { const m = (performance as unknown as { memory?: { usedJSHeapSize: number } }).memory; return m ? m.usedJSHeapSize / 1048576 : null; };

/** Quadro dentro de 1 a 3 painéis reais do FlexLayout (arraste, redimensione, divida). */
function PanelsLab() {
  const [n, setN] = useState(2);
  const model = useMemo(() => Model.fromJson({
    global: { tabEnableClose: false, tabSetEnableMaximize: false, tabSetMinWidth: 220 },
    layout: { type: "row", children: Array.from({ length: n }, (_, i) => ({ type: "tabset", weight: 100 / n, children: [{ type: "tab", name: `Sessão 5 (${i + 1})`, component: "board" }] })) },
  }), [n]);
  return <section className="lab-sec"><div className="lab-tools"><span>Painéis:</span>{[1, 2, 3].map(k => <button key={k} aria-pressed={n === k} onClick={() => setN(k)}>{k}</button>)}</div>
    <div className="lab-flex"><Layout model={model} factory={(_node: TabNode) => <div className="lab-panel"><Board/></div>}/></div></section>;
}

function Editors({ k }: { k: number }) {
  const ed = useCreateBlockNote({ schema: labSchema, initialContent: initialBlocks() as never });
  return <div className="lab-mini"><BlockNoteView editor={ed} theme="dark" editable={false}/><span className="lab-count">{k}</span></div>;
}

/** Medições comparáveis: prévia leve × editores completos. Valores variam por máquina; ver relatório do PR. */
function PerfLab() {
  const [rows, setRows] = useState<string[]>([]);
  const [big, setBig] = useState<{ cols: number; per: number } | null>(null);
  const [editors, setEditors] = useState(0);
  const t0 = useRef(0), h0 = useRef<number | null>(null), kind = useRef("");
  const log = (s: string) => setRows(r => [...r, s]);
  useLayoutEffect(() => {
    if (!t0.current) return;
    const start = t0.current, name = kind.current, base = h0.current; t0.current = 0;
    const commit = performance.now() - start;
    // dois quadros adiante = layout e pintura concluídos
    requestAnimationFrame(() => requestAnimationFrame(() => {
      const painted = performance.now() - start, h = heap();
      log(`${name}: commit ${commit.toFixed(0)} ms, pintado ${painted.toFixed(0)} ms, ${document.querySelectorAll(".lab-perf *").length} nós DOM${h !== null && base !== null ? `, memória +${(h - base).toFixed(1)} MB` : ""}`);
    }));
  });
  const start = (k: string) => { kind.current = k; h0.current = heap(); t0.current = performance.now(); };
  return <section className="lab-sec"><div className="lab-tools">
    {[[5, 20], [5, 100], [10, 100]].map(([c, p]) => <button key={`${c}x${p}`} onClick={() => { start(`Quadro ${c * p} cartões compactos`); setEditors(0); setBig({ cols: c, per: p }); }}>{c * p} cartões</button>)}
    {[1, 5, 20].map(k => <button key={k} onClick={() => { start(`${k} editores completos montados`); setBig(null); setEditors(k); }}>{k} editor(es) completo(s)</button>)}
    <button onClick={() => { setBig(null); setEditors(0); setRows([]); }}>Limpar</button></div>
    <p className="lab-msg" role="status">{heap() === null ? "Memória indisponível neste navegador (somente Chromium expõe performance.memory)." : "Memória lida de performance.memory (heap JS, sem coleta forçada)."}</p>
    <ul className="lab-log">{rows.map((r, i) => <li key={i}>{r}</li>)}</ul>
    <div className="lab-perf">
      {big && <Board key={`${big.cols}x${big.per}`} initial={manyCards(big.cols, big.per)}/>}
      {editors > 0 && <div className="lab-minis">{Array.from({ length: editors }, (_, i) => <Editors key={i} k={i + 1}/>)}</div>}
    </div></section>;
}

export default function Lab() {
  const [tab, setTab] = useState<Tab>("quadro");
  const [events, setEvents] = useState<string[]>([]);
  const tabs: [Tab, string][] = [["quadro", "Quadro de planejamento"], ["editor", "Editor (bancada)"], ["paineis", "Painéis FlexLayout"], ["desempenho", "Desempenho"]];
  return <div className="lab">
    <header className="lab-head"><strong>Laboratório do editor (protótipo)</strong><span>BlockNote 0.57.0 · dados fictícios locais · sem Supabase</span></header>
    <nav className="lab-tabs" role="tablist">{tabs.map(([k, l]) => <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)}>{l}</button>)}</nav>
    <main className="lab-main">
      {tab === "quadro" && <Board onEvent={s => setEvents(e => [s, ...e].slice(0, 5))}/>}
      {tab === "editor" && <EditorBench/>}
      {tab === "paineis" && <PanelsLab/>}
      {tab === "desempenho" && <PerfLab/>}
      <p className="lab-msg" aria-live="polite">{events[0] ? `Último evento: ${events[0]}` : ""}</p>
      <details className="lab-dbg"><summary>Dados: {countCards(sampleBoard())} cartões de exemplo; formato canônico = JSON de blocos</summary><Preview blocks={initialBlocks()}/></details>
    </main>
  </div>;
}

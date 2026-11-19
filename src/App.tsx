import { useEffect, useRef, useState } from "react";
import { BookOpen, ChevronLeft, ChevronRight, FileText, GripVertical, PanelRight, ScrollText, Shield, Swords, Users, X } from "lucide-react";

type Page = "personagens" | "iniciativa" | "encontros" | "enciclopedia" | "compendio" | "documentos";
type Tab = { id: string; page: Page; title: string };
type Column = { id: string; tabs: Tab[]; active: string; width: number };
type Workspace = { columns: Column[]; focused: string };
const sections: { page: Page; title: string; icon: typeof Users }[] = [
  { page: "personagens", title: "Personagens", icon: Users },
  { page: "iniciativa", title: "Iniciativa", icon: Swords },
  { page: "encontros", title: "Encontros", icon: Shield },
  { page: "enciclopedia", title: "Enciclopédia", icon: BookOpen },
  { page: "compendio", title: "Compêndio", icon: ScrollText },
  { page: "documentos", title: "Documentos", icon: FileText },
];
const key = "compendio5e:workspace:columns:v1";
const first: Workspace = { columns: [{ id: "col-1", tabs: [{ id: "personagens", page: "personagens", title: "Personagens" }], active: "personagens", width: 100 }], focused: "col-1" };
const makeId = () => crypto.randomUUID();
function restore(): Workspace {
  try {
    const data: unknown = JSON.parse(localStorage.getItem(key) || "null");
    if (!data || typeof data !== "object" || !("columns" in data) || !Array.isArray(data.columns) || data.columns.length < 1 || data.columns.length > 3) return first;
    const columns: Column[] = [];
    for (const col of data.columns) {
      if (!col || typeof col.id !== "string" || !Array.isArray(col.tabs) || !Number.isFinite(col.width) || col.width <= 0) return first;
      const tabs: Tab[] = [];
      for (const t of col.tabs) {
        const section = sections.find(s => s.page === t?.page);
        if (!section || typeof t.id !== "string" || t.id !== t.page || tabs.some(x => x.id === t.id)) return first;
        tabs.push({ id: t.id, page: t.page, title: section.title });
      }
      if (tabs.length === 0) return first;
      columns.push({ id: col.id, tabs, active: tabs.some(t => t.id === col.active) ? col.active : tabs[0].id, width: col.width });
    }
    if (new Set(columns.flatMap(c => c.tabs.map(t => t.id))).size !== columns.reduce((n,c) => n+c.tabs.length,0)) return first;
    const sum = columns.reduce((n,c) => n+c.width,0);
    return { columns: columns.map(c => ({ ...c, width: c.width * 100 / sum })), focused: columns.some(c => c.id === (data as Workspace).focused) ? (data as Workspace).focused : columns[0].id };
  } catch { return first; }
}
export default function App() {
  const [workspace, setWorkspace] = useState<Workspace>(restore);
  const [collapsed, setCollapsed] = useState(false);
  const [dragging, setDragging] = useState(false);
  const container = useRef<HTMLDivElement>(null);
  useEffect(() => { localStorage.setItem(key, JSON.stringify(workspace)); }, [workspace]);
  const update = (fn: (old: Workspace) => Workspace) => setWorkspace(fn);
  const focusTab = (columnId: string, tabId: string) => update(w => ({ ...w, focused: columnId, columns: w.columns.map(c => c.id === columnId ? { ...c, active: tabId } : c) }));
  const open = (page: Page) => update(w => {
    const existing = w.columns.find(c => c.tabs.some(t => t.id === page));
    if (existing) return { ...w, focused: existing.id, columns: w.columns.map(c => c.id === existing.id ? { ...c, active: page } : c) };
    const target = w.columns.find(c => c.id === w.focused) || w.columns[0];
    const tab = { id: page, page, title: sections.find(s => s.page === page)!.title };
    return { ...w, focused: target.id, columns: w.columns.map(c => c.id === target.id ? { ...c, tabs: [...c.tabs, tab], active: tab.id } : c) };
  });
  const close = (columnId: string, tabId: string) => update(w => {
    let columns = w.columns.map(c => {
      if (c.id !== columnId) return c;
      const tabs = c.tabs.filter(t => t.id !== tabId);
      return { ...c, tabs, active: c.active === tabId ? (tabs.at(-1)?.id || "") : c.active };
    }).filter(c => c.tabs.length);
    if (!columns.length) columns = [{ id: "col-1", tabs: [], active: "", width: 100 }];
    const sum = columns.reduce((n,c) => n+c.width,0);
    columns = columns.map(c => ({ ...c, width: c.width * 100 / sum }));
    return { columns, focused: columns.some(c => c.id === w.focused) ? w.focused : columns[0].id };
  });
  const move = (tabId: string, destination: string) => update(w => {
    const source = w.columns.find(c => c.tabs.some(t => t.id === tabId));
    if (!source || source.id === destination) return w;
    const tab = source.tabs.find(t => t.id === tabId)!;
    let columns = w.columns.map(c => c.id === source.id
      ? { ...c, tabs: c.tabs.filter(t => t.id !== tabId), active: c.active === tabId ? (c.tabs.filter(t => t.id !== tabId).at(-1)?.id || "") : c.active }
      : c.id === destination ? { ...c, tabs: [...c.tabs, tab], active: tabId } : c);
    columns = columns.filter(c => c.tabs.length);
    const sum = columns.reduce((n,c) => n+c.width,0);
    return { columns: columns.map(c => ({ ...c, width: c.width * 100 / sum })), focused: destination };
  });
  const split = (tabId: string) => update(w => {
    if (w.columns.length >= 3) return w;
    const source = w.columns.find(c => c.tabs.some(t => t.id === tabId));
    if (!source) return w;
    const tab = source.tabs.find(t => t.id === tabId)!;
    const id = makeId();
    let columns = w.columns.map(c => c.id === source.id ? { ...c, tabs: c.tabs.filter(t => t.id !== tabId), active: c.active === tabId ? (c.tabs.filter(t => t.id !== tabId).at(-1)?.id || "") : c.active } : c);
    columns = columns.filter(c => c.tabs.length);
    const width = 100 / (columns.length + 1);
    columns = [...columns.map(c => ({ ...c, width: width })), { id, tabs: [tab], active: tabId, width }];
    return { columns, focused: id };
  });
  const startResize = (index: number, event: React.PointerEvent<HTMLDivElement>) => {
    if (!container.current) return;
    event.preventDefault();
    const bounds = container.current.getBoundingClientRect();
    const start = event.clientX;
    const snapshot = workspace.columns.map(c => c.width);
    const left = snapshot[index], right = snapshot[index+1];
    const onMove = (e: PointerEvent) => {
      const delta = (e.clientX - start) / bounds.width * 100;
      const value = Math.max(18, Math.min(left + right - 18, left + delta));
      update(w => ({ ...w, columns: w.columns.map((c,i) => i === index ? { ...c, width: value } : i === index+1 ? { ...c, width: left + right - value } : c) }));
    };
    const onUp = () => { window.removeEventListener("pointermove", onMove); window.removeEventListener("pointerup", onUp); };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp, { once: true });
  };
  const activePage = workspace.columns.find(c => c.id === workspace.focused)?.tabs.find(t => t.id === workspace.columns.find(c => c.id === workspace.focused)?.active)?.page;
  return <div className="app">
    <aside className={collapsed ? "sidebar collapsed" : "sidebar"}>
      <div className="brand"><BookOpen size={22}/>{!collapsed && <strong>Compêndio <span>5e</span></strong>}</div>
      <div className="campaign" title="Campanha demonstrativa">{!collapsed && <><small>CAMPANHA ATIVA</small><strong>Festival da Lua</strong></>}</div>
      <nav aria-label="Menu principal">{sections.map(({page,title,icon:Icon}) =>
        <button key={page} className={activePage === page ? "nav-item selected" : "nav-item"} onClick={() => open(page)} title={title}>
          <Icon size={19}/>{!collapsed && <span>{title}</span>}
        </button>)}</nav>
      <button className="collapse" onClick={() => setCollapsed(v => !v)} aria-label={collapsed ? "Expandir menu" : "Recolher menu"}>
        {collapsed ? <ChevronRight size={18}/> : <><ChevronLeft size={18}/> Recolher menu</>}
      </button>
    </aside>
    <main className="workspace" ref={container}>
      {workspace.columns.map((column,index) => {
        const selected = column.tabs.find(t => t.id === column.active);
        return <div className={workspace.focused === column.id ? "pane focused" : "pane"} style={{ flexBasis: `${column.width}%` }} key={column.id} onMouseDown={() => update(w => w.focused === column.id ? w : { ...w, focused: column.id })}>
          <div className="tabbar" role="tablist" aria-label={`Abas da coluna ${index+1}`}
            onDragOver={e => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; }}
            onDrop={e => { e.preventDefault(); const id = e.dataTransfer.getData("text/plain"); if (id) move(id,column.id); setDragging(false); }}>
            {column.tabs.map(tab => <div className={column.active === tab.id ? "tab active" : "tab"} key={tab.id} draggable onDragStart={e => { e.dataTransfer.setData("text/plain",tab.id); setDragging(true); }} onDragEnd={() => setDragging(false)}>
              <button role="tab" aria-selected={column.active === tab.id} onClick={() => focusTab(column.id,tab.id)}>{tab.title}</button>
              <button className="close" aria-label={`Fechar ${tab.title}`} onClick={() => close(column.id,tab.id)}><X size={14}/></button>
            </div>)}
            {workspace.columns.length < 3 && selected && <button className="split" title="Mover aba atual para nova coluna" aria-label="Mover aba atual para nova coluna" onClick={() => split(selected.id)}><PanelRight size={16}/></button>}
          </div>
          <section className="content">{selected ? <>
            <div className="eyebrow">COMPÊNDIO 5e / DEMONSTRAÇÃO</div>
            <h1>{selected.title}</h1>
            <p>Estrutura inicial. Os dados reais serão integrados nas próximas etapas.</p>
            <div className="placeholder"><BookOpen size={30}/><strong>{selected.title}</strong><span>Área reservada para a funcionalidade.</span></div>
          </> : <div className="empty"><h1>Área de trabalho</h1><p>Escolha uma seção no menu lateral.</p></div>}</section>
          {dragging && <div className="drop-hint">Solte a aba aqui</div>}
          {index < workspace.columns.length-1 && <div className="resizer" role="separator" aria-label={`Redimensionar colunas ${index+1} e ${index+2}`} onPointerDown={e => startResize(index,e)}><GripVertical size={13}/></div>}
        </div>;
      })}
    </main>
  </div>;
}

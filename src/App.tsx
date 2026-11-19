import { useEffect, useRef, useState } from "react";
import { BookOpen, ChevronLeft, ChevronRight, GripVertical, PanelRight, X } from "lucide-react";
import { key, makeId, restore, sections, type Page, type Workspace } from "./workspace";

export default function App() {
  const [workspace, setWorkspace] = useState<Workspace>(restore);
  const [collapsed, setCollapsed] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [dropEdge, setDropEdge] = useState(false);
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
  const dropIntoNewColumn = (event: import("react").DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    const tabId = event.dataTransfer.getData("text/plain");
    if (tabId) split(tabId);
    setDropEdge(false);
    setDragging(false);
  };
  const startResize = (index: number, event: import("react").PointerEvent<HTMLDivElement>) => {
    if (!container.current) return;
    event.preventDefault();
    const bounds = container.current.getBoundingClientRect();
    const start = event.clientX;
    const snapshot = workspace.columns.map(c => c.width);
    const left = snapshot[index], right = snapshot[index+1];
    const onMove = (e: PointerEvent) => {
      const delta = (e.clientX - start) / bounds.width * 100;
      const min = Math.min(22, (left + right) / 2 - 1);
      const value = Math.max(min, Math.min(left + right - min, left + delta));
      update(w => ({ ...w, columns: w.columns.map((c,i) => i === index ? { ...c, width: value } : i === index+1 ? { ...c, width: left + right - value } : c) }));
    };
    const onUp = () => { window.removeEventListener("pointermove", onMove); window.removeEventListener("pointerup", onUp); window.removeEventListener("pointercancel", onUp); document.body.style.cursor = ""; document.body.style.userSelect = ""; };
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp, { once: true });
    window.addEventListener("pointercancel", onUp, { once: true });
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
            onDrop={e => { e.preventDefault(); const id = e.dataTransfer.getData("text/plain"); if (id) move(id,column.id); setDragging(false); setDropEdge(false); }}>
            {column.tabs.map(tab => <div className={column.active === tab.id ? "tab active" : "tab"} key={tab.id} draggable onDragStart={e => { e.dataTransfer.setData("text/plain",tab.id); e.dataTransfer.effectAllowed = "move"; setDragging(true); }} onDragEnd={() => { setDragging(false); setDropEdge(false); }}>
              <button role="tab" aria-selected={column.active === tab.id} onClick={() => focusTab(column.id,tab.id)}>{tab.title}</button>
              <button className="close" aria-label={`Fechar ${tab.title}`} onClick={() => close(column.id,tab.id)}><X size={14}/></button>
            </div>)}
            {workspace.columns.length < 3 && selected && <button className="split" title="Abrir esta aba em uma nova coluna" aria-label="Abrir esta aba em uma nova coluna" onClick={() => split(selected.id)}><PanelRight size={16}/><span className="split-label">Nova coluna</span></button>}
          </div>
          <section className="content">{selected ? <>
            <div className="eyebrow">COMPÊNDIO 5e / DEMONSTRAÇÃO</div>
            <h1>{selected.title}</h1>
            <p>Estrutura inicial. Os dados reais serão integrados nas próximas etapas.</p>
            <div className="placeholder"><BookOpen size={30}/><strong>{selected.title}</strong><span>Área reservada para a funcionalidade.</span></div>
          </> : <div className="empty"><h1>Área de trabalho</h1><p>Escolha uma seção no menu lateral.</p></div>}</section>
          {dragging && <div className="drop-hint">Solte a aba aqui</div>}
          {index < workspace.columns.length-1 && <div className="resizer" role="separator" aria-label={`Redimensionar colunas ${index+1} e ${index+2}`} onPointerDown={e => startResize(index,e)} title="Arraste para ajustar a largura das colunas"><GripVertical size={16}/></div>}
        </div>;
      })}
      {dragging && workspace.columns.length < 3 && <div
        className={dropEdge ? "new-column-drop active" : "new-column-drop"}
        role="region"
        aria-label="Soltar aba para criar nova coluna"
        onDragEnter={e => { e.preventDefault(); setDropEdge(true); }}
        onDragOver={e => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; setDropEdge(true); }}
        onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setDropEdge(false); }}
        onDrop={dropIntoNewColumn}
      ><PanelRight size={22}/><span>Solte aqui para criar uma coluna</span></div>}
    </main>
  </div>;
}

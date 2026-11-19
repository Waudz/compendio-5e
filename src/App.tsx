import { useEffect, useState } from "react";
import { BookOpen, ChevronLeft, ChevronRight, FileText, ScrollText, Shield, Swords, Users, X } from "lucide-react";

type Page = "personagens" | "iniciativa" | "encontros" | "enciclopedia" | "compendio" | "documentos";
type Tab = { id: string; page: Page; title: string };
const sections: { page: Page; title: string; icon: typeof Users }[] = [
  { page: "personagens", title: "Personagens", icon: Users },
  { page: "iniciativa", title: "Iniciativa", icon: Swords },
  { page: "encontros", title: "Encontros", icon: Shield },
  { page: "enciclopedia", title: "Enciclopédia", icon: BookOpen },
  { page: "compendio", title: "Compêndio", icon: ScrollText },
  { page: "documentos", title: "Documentos", icon: FileText },
];
const initial: Tab[] = [{ id: "personagens", page: "personagens", title: "Personagens" }];
const storageKey = "compendio5e:workspace:v1";
function readTabs(): Tab[] {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(storageKey) || "null");
    if (Array.isArray(parsed) && parsed.length && parsed.every(t => t && typeof t.id === "string" && sections.some(s => s.page === t.page))) {
      return parsed.map(t => ({ id: t.id, page: t.page as Page, title: sections.find(s => s.page === t.page)!.title }));
    }
  } catch { /* corrupted state */ }
  return initial;
}
export default function App() {
  const [tabs, setTabs] = useState<Tab[]>(readTabs);
  const [active, setActive] = useState(() => {
    const saved = localStorage.getItem(storageKey + ":active");
    return readTabs().some(t => t.id === saved) ? saved! : readTabs()[0].id;
  });
  const [collapsed, setCollapsed] = useState(false);
  useEffect(() => { localStorage.setItem(storageKey, JSON.stringify(tabs)); }, [tabs]);
  useEffect(() => { localStorage.setItem(storageKey + ":active", active); }, [active]);
  const open = (page: Page) => {
    const id = page;
    if (!tabs.some(t => t.id === id)) setTabs(prev => [...prev, { id, page, title: sections.find(s => s.page === page)!.title }]);
    setActive(id);
  };
  const close = (id: string) => {
    const next = tabs.filter(t => t.id !== id);
    setTabs(next);
    if (active === id) setActive(next.at(-1)?.id || "");
  };
  const selected = tabs.find(t => t.id === active);
  return <div className="app">
    <aside className={collapsed ? "sidebar collapsed" : "sidebar"}>
      <div className="brand"><BookOpen size={22}/>{!collapsed && <strong>Compêndio <span>5e</span></strong>}</div>
      <div className="campaign" title="Campanha demonstrativa">{!collapsed && <><small>CAMPANHA ATIVA</small><strong>Festival da Lua</strong></>}</div>
      <nav aria-label="Menu principal">{sections.map(({page,title,icon:Icon}) =>
        <button key={page} className={selected?.page === page ? "nav-item selected" : "nav-item"} onClick={() => open(page)} title={title}>
          <Icon size={19}/>{!collapsed && <span>{title}</span>}
        </button>)}</nav>
      <button className="collapse" onClick={() => setCollapsed(v => !v)} aria-label={collapsed ? "Expandir menu" : "Recolher menu"}>
        {collapsed ? <ChevronRight size={18}/> : <><ChevronLeft size={18}/> Recolher menu</>}
      </button>
    </aside>
    <main className="workspace">
      <div className="tabbar" role="tablist" aria-label="Abas abertas">
        {tabs.map(tab => <div className={active === tab.id ? "tab active" : "tab"} key={tab.id}>
          <button role="tab" aria-selected={active === tab.id} onClick={() => setActive(tab.id)}>{tab.title}</button>
          <button className="close" aria-label={`Fechar ${tab.title}`} onClick={() => close(tab.id)}><X size={14}/></button>
        </div>)}
      </div>
      <section className="content">{selected ? <>
        <div className="eyebrow">COMPÊNDIO 5e / DEMONSTRAÇÃO</div>
        <h1>{selected.title}</h1>
        <p>Estrutura inicial do novo aplicativo. Os dados reais serão integrados em etapas futuras.</p>
        <div className="placeholder"><BookOpen size={34}/><strong>{selected.title}</strong><span>Área reservada para a funcionalidade.</span></div>
      </> : <div className="empty"><h1>Área de trabalho</h1><p>Escolha uma seção no menu lateral para abrir uma aba.</p></div>}</section>
    </main>
  </div>;
}

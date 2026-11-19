import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { Action, Actions, Layout, type Model, TabNode, TabSetNode } from "flexlayout-react";
import { BookOpen, ChevronLeft, ChevronRight, X } from "lucide-react";
import "flexlayout-react/style/dark.css";
import { ContextMenu, type MenuItem, type MenuState } from "./ContextMenu";
import { useChromeHidden } from "./chromeHide";
import { Mobile } from "./Mobile";
import { Panel } from "./Panel";
import { loadLayout, saveLayout } from "./persistence";
import { MAX_GROUPS, closeGroup, closeOthers, closeTab, createModel, groupCount, groups, isColumnsOnly, moveToGroup, moveToNewColumn, openTab, sections, type Kind, type TabSpec } from "./workspace";

// Só estas ações do FlexLayout são aceitas: sem popout, janela flutuante, maximizar, bordas ou subgrupos.
const allowedActions = new Set([Actions.ADD_TAB, Actions.DELETE_TAB, Actions.SELECT_TAB, Actions.MOVE_NODE, Actions.DELETE_TABSET, Actions.SET_ACTIVE_TABSET, Actions.ADJUST_WEIGHTS]);
const mobileQuery = "(max-width:700px)";

function useMobile() {
  const [mobile, setMobile] = useState(() => window.matchMedia(mobileQuery).matches);
  useEffect(() => {
    const q = window.matchMedia(mobileQuery), on = () => setMobile(q.matches);
    q.addEventListener("change", on); return () => q.removeEventListener("change", on);
  }, []);
  return mobile;
}

export default function App() {
  const [model, setModel] = useState<Model>(() => createModel(loadLayout()));
  const [, redraw] = useState(0);
  const [collapsed, setCollapsed] = useState(false);
  const [menu, setMenu] = useState<MenuState | null>(null);
  const mobile = useMobile();
  const chromeHidden = useChromeHidden(mobile);
  const good = useRef(model.toJson());
  const handled = useRef<Event | null>(null);
  const refresh = useCallback(() => redraw(n => n + 1), []);

  // Toda mudança passa por aqui: valida a restrição de colunas (reverte se violada) e persiste.
  const onModelChange = useCallback((m: Model) => {
    const json = m.toJson();
    if (!isColumnsOnly(json)) { setModel(createModel(good.current)); return; }
    good.current = json; saveLayout(json); refresh();
  }, [refresh]);
  const onAction = useCallback((a: Action) => allowedActions.has(a.type) ? a : undefined, []);
  const open = useCallback((s: TabSpec) => { openTab(model, s); onModelChange(model); }, [model, onModelChange]);
  const run = (fn: () => void) => () => { fn(); onModelChange(model); };
  const closeMenu = useCallback(() => setMenu(null), []);

  const contextMenu = useCallback((node: TabNode | TabSetNode | { getType(): string }, e: React.MouseEvent) => {
    e.preventDefault();
    // O FlexLayout chama o callback para a aba e depois para o grupo (borbulhamento): vale o primeiro, o da aba.
    if (handled.current === e.nativeEvent) return;
    handled.current = e.nativeEvent;
    const gs = groups(model);
    let items: MenuItem[] = [];
    if (node instanceof TabNode) {
      const id = node.getId(), g = node.getParent() as TabSetNode, i = gs.indexOf(g);
      const left = gs[i - 1], right = gs[i + 1];
      const full = groupCount(model) >= MAX_GROUPS && g.getChildren().length > 1;
      items = [
        { label: "Mover para a coluna à esquerda", disabled: !left, onSelect: run(() => moveToGroup(model, id, left.getId())) },
        { label: "Mover para a coluna à direita", disabled: !right, onSelect: run(() => moveToGroup(model, id, right.getId())) },
        { label: "Abrir em nova coluna à esquerda", disabled: full || (i === 0 && g.getChildren().length === 1), onSelect: run(() => moveToNewColumn(model, id, "left")) },
        { label: "Abrir em nova coluna à direita", disabled: full || (i === gs.length - 1 && g.getChildren().length === 1), onSelect: run(() => moveToNewColumn(model, id, "right")) },
        "-",
        { label: "Fechar aba", onSelect: run(() => closeTab(model, id)) },
        { label: "Fechar outras abas", disabled: g.getChildren().length < 2, onSelect: run(() => closeOthers(model, id)) },
        { label: "Fechar coluna", onSelect: run(() => closeGroup(model, g.getId())) },
      ];
    } else if (node instanceof TabSetNode) {
      items = [{ label: "Fechar coluna", onSelect: run(() => closeGroup(model, node.getId())) }];
    } else return;
    setMenu({ x: e.clientX, y: e.clientY, items });
  }, [model]); // eslint-disable-line react-hooks/exhaustive-deps

  const factory = useCallback((node: TabNode) => {
    const c = node.getConfig() as { kind: Kind; ref: string };
    return <Panel kind={c.kind} entity={c.ref} onOpen={open}/>;
  }, [open]);

  const activeTab = model.getActiveTabset()?.getSelectedNode();
  const activeId = activeTab instanceof TabNode ? activeTab.getId() : "";
  const placeholder = useCallback(() => <div className="empty"><h1>Área de trabalho</h1><p>Escolha uma seção no menu lateral.</p></div>, []);
  const renderSet = useCallback((node: TabSetNode | { getType(): string }, v: { buttons: ReactNode[] }) => {
    if (node instanceof TabSetNode && groupCount(model) > 1)
      v.buttons.push(<button key="fg" className="grp-close" title="Fechar coluna" aria-label="Fechar coluna" onClick={() => { closeGroup(model, node.getId()); onModelChange(model); }}><X size={14}/></button>);
  }, [model, onModelChange]);

  return <div className={chromeHidden ? "app chrome-hidden" : "app"}>
    <aside className={collapsed ? "sidebar collapsed" : "sidebar"}>
      <div className="brand"><BookOpen size={22}/>{!collapsed && <strong>Compêndio <span>5e</span></strong>}</div>
      <div className="campaign" title="Campanha demonstrativa">{!collapsed && <><small>CAMPANHA ATIVA</small><strong>Festival da Lua</strong></>}</div>
      <nav aria-label="Menu principal">{sections.map(({ page, title, icon: Icon }) =>
        <button key={page} className={activeId === `secao:${page}` ? "nav-item selected" : "nav-item"} onClick={() => open({ kind: "secao", ref: page })} title={title}>
          <Icon size={19}/>{!collapsed && <span>{title}</span>}
        </button>)}</nav>
      <button className="collapse" onClick={() => setCollapsed(v => !v)} aria-label={collapsed ? "Expandir menu" : "Recolher menu"}>
        {collapsed ? <ChevronRight size={18}/> : <><ChevronLeft size={18}/> Recolher menu</>}
      </button>
    </aside>
    <main className="workspace">
      {mobile
        ? <Mobile model={model} onOpen={open} onChange={() => onModelChange(model)}/>
        : <Layout model={model} factory={factory} onAction={onAction} onModelChange={onModelChange} onContextMenu={contextMenu}
            onRenderTabSet={renderSet} onTabSetPlaceHolder={placeholder} supportsPopout={false} realtimeResize/>}
    </main>
    {menu && <ContextMenu menu={menu} onClose={closeMenu}/>}
  </div>;
}

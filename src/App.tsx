import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Action, Actions, Layout, type Model, TabNode, TabSetNode } from "flexlayout-react";
import { BookOpen, Castle, House as HomeIcon, ChevronLeft, ChevronRight, ChevronsUpDown, Pin, UserRound, X } from "lucide-react";
import "flexlayout-react/style/dark.css";
import { useAuth } from "./AuthContext";
import { useCampaigns } from "./CampaignsContext";
import { ContextMenu, type MenuItem, type MenuState } from "./ContextMenu";
import { useChromeHidden } from "./chromeHide";
import { Mobile } from "./Mobile";
import { NavItem } from "./NavItem";
import { closeTabs, isPinned, navigate, openContentLink as openContent, otherNormalTabs, setPinned, type NavMode } from "./navigation";
import { UnsavedContext, useUnsavedRegistry } from "./unsaved";
import { findTab } from "./workspace";
import { tituloDe, useVersaoRegistros } from "./registrosStore";
import { Panel } from "./Panel";
import { AbrirEmAbaContext, OrigemAbaContext } from "./abrirEmAba";
import { hasSavedLayout, loadLayout, saveLayout, type Scope } from "./persistence";
import { closeGroup, campaignsHub, desktopSections, firstVisitModel, tabId, canMoveToNewColumn, closeTab, createModel, groupCount, groups, isColumnsOnly, moveToGroup, moveToNewColumn, normalizeEmptyPanels, prepareMove, visibleSections, type Kind, type TabSpec } from "./workspace";

// Só estas ações do FlexLayout são aceitas: sem popout, janela flutuante, maximizar, bordas ou subgrupos.
const allowedActions = new Set([Actions.GROUP, Actions.ADD_TAB, Actions.DELETE_TAB, Actions.SELECT_TAB, Actions.MOVE_NODE, Actions.DELETE_TABSET, Actions.SET_ACTIVE_TABSET, Actions.ADJUST_WEIGHTS]);
const mobileQuery = "(max-width:700px)";

function useMobile() {
  const [mobile, setMobile] = useState(() => window.matchMedia(mobileQuery).matches);
  useEffect(() => {
    const q = window.matchMedia(mobileQuery), on = () => setMobile(q.matches);
    q.addEventListener("change", on); return () => q.removeEventListener("change", on);
  }, []);
  return mobile;
}

/** Só existe com sessão. `key` por usuário: trocar de conta descarta TODO o estado do espaço de trabalho (nada vaza entre contas). */
export default function App() {
  const { status, user } = useAuth();
  if (status !== "authenticated" || !user) return null;
  return <Workspace key={user.id} userId={user.id}/>;
}

function Workspace({ userId }: { userId: string }) {
  // Espaço de trabalho por usuário + campanha ativa + dispositivo: ao trocar, carrega o layout daquele escopo.
  const { status } = useAuth();
  const { active, activeId: campaignId, memberships, setActive } = useCampaigns();
  const scope: Scope = { user: userId, campaign: campaignId ?? "nenhuma", device: "navegador" };
  const scopeKey = `${scope.user}|${scope.campaign}|${scope.device}`;
  const scopeRef = useRef(scope); scopeRef.current = scope;
  const [model, setModel] = useState<Model>(() => {
    // Primeira vez nesta campanha (também no primeiro carregamento): só o Início. Layout salvo nunca é alterado.
    if (!hasSavedLayout(scope) && scope.campaign !== "nenhuma") return firstVisitModel(scope.campaign, memberships.find(x => x.campaign.id === scope.campaign)?.campaign.name);
    return createModel(loadLayout(scope));
  });
  const [modelKey, setModelKey] = useState(scopeKey);
  const [, redraw] = useState(0);
  const [collapsed, setCollapsed] = useState(false);
  const [menu, setMenu] = useState<MenuState | null>(null);
  const registrosV = useVersaoRegistros();   // títulos de registros abertos mudam o rótulo das abas
  const mobile = useMobile();
  const chromeHidden = useChromeHidden(mobile);
  const good = useRef(model.toJson());
  const handled = useRef<Event | null>(null);
  const refresh = useCallback(() => redraw(n => n + 1), []);
  const labelRef = useRef<(id: string) => string>(id => id);
  const unsaved = useUnsavedRegistry(id => labelRef.current(id));   // alterações não salvas por aba (editores registram)
  if (modelKey !== scopeKey) {
    // Primeira vez nesta campanha: abre o Início (ex.: logo após entrar por convite).
    const m = !hasSavedLayout(scope) && scope.campaign !== "nenhuma" ? firstVisitModel(scope.campaign, memberships.find(x => x.campaign.id === scope.campaign)?.campaign.name) : createModel(loadLayout(scope));
    good.current = m.toJson(); setModelKey(scopeKey); setModel(m); } // troca de escopo: outro espaço de trabalho

  // Toda mudança passa por aqui: valida a restrição de colunas (reverte se violada) e persiste.
  const onModelChange = useCallback((m: Model) => {
    if (normalizeEmptyPanels(m)) return;   // painel que recebeu aba deixa de ser "vazio intencional"; a ação de correção volta aqui
    const json = m.toJson();
    if (!isColumnsOnly(json)) { setModel(createModel(good.current)); return; }
    good.current = json; saveLayout(json, scopeRef.current); refresh();
  }, [refresh]);
  // Fechar aba/coluna pelos botões do FlexLayout também respeita alterações não salvas.
  const onAction = useCallback((a: Action) => {
    if (!allowedActions.has(a.type)) return undefined;
    if (a.type === Actions.DELETE_TAB && unsaved.api.isDirty(a.data.node as string)) { unsaved.api.guard([a.data.node as string], () => { model.doAction(a); }); return undefined; }
    if (a.type === Actions.DELETE_TABSET) {
      const g = model.getNodeById(a.data.node as string), ids = g instanceof TabSetNode ? g.getChildren().map(c => c.getId()) : [];
      if (ids.some(unsaved.api.isDirty)) { unsaved.api.guard(ids, () => { model.doAction(a); }); return undefined; }
    }
    return prepareMove(model, a);   // recusa/ajusta movimentos (divisão com aba única)
  }, [model, unsaved.api]);
  // Navegação: clique normal reutiliza a aba atual (se não fixada e sem alterações); "nova aba" preserva as existentes.
  // Duas portas, nunca confundidas: openMenu (menu lateral, ações administrativas: reutiliza) e openContentLink (links de conteúdo: aba permanente).
  const openMenu = useCallback((s: TabSpec, mode: NavMode = "reuse") => { navigate(model, s, mode, unsaved.api.isDirty); onModelChange(model); }, [model, onModelChange, unsaved.api]);
  const openContentLink = useCallback((s: TabSpec, originTabId?: string) => { openContent(model, s, originTabId); onModelChange(model); }, [model, onModelChange]);
  const inviteOpenedScope = useRef<string | null>(null);
  useEffect(() => {
    if (!new URLSearchParams(window.location.search).has("convite") || status === "loading") return;
    if (inviteOpenedScope.current === scopeKey) return;
    inviteOpenedScope.current = scopeKey;
    openMenu({ kind: "secao", ref: "campanhas" }, "new");   // abertura automática pelo convite nunca substitui a aba em uso
  }, [openMenu, status, scopeKey]);
  const run = (fn: () => void) => () => { fn(); onModelChange(model); };
  const closeMenu = useCallback(() => setMenu(null), []);
  const guarded = (ids: string[], fn: () => void) => () => unsaved.api.guard(ids, () => { fn(); onModelChange(model); });
  /** Menu dos itens de navegação (botão direito, tecla de menu ou toque prolongado). */
  const showNavMenu = useCallback((s: TabSpec, x: number, y: number) => setMenu({ x, y, items: [
    { label: "Abrir nesta aba", onSelect: () => openMenu(s, "reuse") },
    { label: "Abrir em nova aba", onSelect: () => openMenu(s, "new") },
    { label: "Abrir em nova aba fixada", onSelect: () => openMenu(s, "newPinned") },
  ] }), [openMenu]);

  const homeSpec: TabSpec = active ? { kind: "campanha", ref: active.campaign.id, title: active.campaign.name } : { kind: "secao", ref: campaignsHub.page };
  /** Seletor discreto junto à campanha ativa: trocar (protegendo alterações não salvas) e acesso à gestão de campanhas. Cada campanha tem o seu layout. */
  const showCampaignMenu = (x: number, y: number) => setMenu({ x, y, items: [
    ...memberships.map(m => ({ label: m.campaign.id === active?.campaign.id ? `${m.campaign.name} (ativa)` : m.campaign.name, disabled: m.campaign.id === active?.campaign.id,
      onSelect: () => { void unsaved.api.confirmAll().then(ok => { if (ok) setActive(m.campaign.id); }); } })),
    ...(memberships.length ? ["-" as const] : []),
    { label: "Gerenciar campanhas…", onSelect: () => openMenu({ kind: "secao", ref: campaignsHub.page }) },
  ] });

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
      items = [
        { label: "Mover para a coluna à esquerda", disabled: !left, onSelect: run(() => moveToGroup(model, id, left.getId())) },
        { label: "Mover para a coluna à direita", disabled: !right, onSelect: run(() => moveToGroup(model, id, right.getId())) },
        { label: "Abrir em nova coluna à esquerda", disabled: !canMoveToNewColumn(model, id, "left"), onSelect: run(() => moveToNewColumn(model, id, "left")) },
        { label: "Abrir em nova coluna à direita", disabled: !canMoveToNewColumn(model, id, "right"), onSelect: run(() => moveToNewColumn(model, id, "right")) },
        "-",
        { label: "Fechar aba", onSelect: guarded([id], () => closeTab(model, id)) },
        { label: "Fechar outras abas normais", disabled: otherNormalTabs(model, id).length === 0, onSelect: guarded(otherNormalTabs(model, id), () => closeTabs(model, otherNormalTabs(model, id))) },
        { label: "Fechar coluna", onSelect: guarded(g.getChildren().map(c => c.getId()), () => closeGroup(model, g.getId())) },
      ];
      items.unshift({ label: isPinned(node) ? "Desafixar aba" : "Fixar aba", onSelect: run(() => setPinned(model, id, !isPinned(node))) }, "-");
    } else if (node instanceof TabSetNode) {
      items = [{ label: "Fechar coluna", onSelect: guarded(node.getChildren().map(c => c.getId()), () => closeGroup(model, node.getId())) }];
    } else return;
    setMenu({ x: e.clientX, y: e.clientY, items });
  }, [model, unsaved.api]); // eslint-disable-line react-hooks/exhaustive-deps

  /** Celular: opções da aba (fixar, fechar), sem itens de colunas. */
  const showTabMenu = (t: TabNode, x: number, y: number) => {
    const id = t.getId();
    setMenu({ x, y, items: [
      { label: isPinned(t) ? "Desafixar aba" : "Fixar aba", onSelect: run(() => setPinned(model, id, !isPinned(t))) },
      "-",
      { label: "Fechar aba", onSelect: guarded([id], () => closeTab(model, id)) },
      { label: "Fechar outras abas normais", disabled: otherNormalTabs(model, id).length === 0, onSelect: guarded(otherNormalTabs(model, id), () => closeTabs(model, otherNormalTabs(model, id))) },
    ] });
  };

  const factory = useCallback((node: TabNode) => {
    const c = node.getConfig() as { kind: Kind; ref: string };
    return <OrigemAbaContext.Provider value={node.getId()}><Panel kind={c.kind} entity={c.ref} onOpen={openMenu} onOpenContent={s => openContentLink(s, node.getId())}/></OrigemAbaContext.Provider>;
  }, [openMenu, openContentLink]);

  // Títulos nunca são persistidos: o nome da campanha vem da lista carregada (ou do rótulo genérico).
  const titleOf = useCallback((n: TabNode) => {
    const c = n.getConfig() as { kind?: Kind; ref?: string } | undefined;
    if ((c?.kind === "documento" || c?.kind === "ficha") && c.ref) return tituloDe(c.ref) ?? n.getName();
    return c?.kind === "campanha" ? memberships.find(m => m.campaign.id === c.ref)?.campaign.name ?? n.getName() : n.getName();
  }, [memberships, registrosV]);
  // FlexLayout usa o nome do modelo para ARIA e o conteúdo renderizado para a tela.
  // Manter ambos iguais em memória; minimalLayout continua removendo nomes ao persistir.
  useLayoutEffect(() => {
    let changed = false;
    model.visitNodes(node => {
      if (!(node instanceof TabNode)) return;
      const title = titleOf(node);
      if (node.getName() !== title) { model.doAction(Actions.renameTab(node.getId(), title)); changed = true; }
    });
    if (changed) refresh();
  });
  labelRef.current = id => { const t = findTab(model, id); return t ? titleOf(t) : id; };
  const renderTab = useCallback((n: TabNode, v: { content: ReactNode; leading?: ReactNode }) => {
    v.content = <>{titleOf(n)}{isPinned(n) && <span className="sr-only"> (fixada)</span>}</>;   // marca visual + texto acessível
    if (isPinned(n)) v.leading = <Pin size={12} className="pin-icon" aria-hidden="true"/>;
  }, [titleOf]);
  const activeTab = model.getActiveTabset()?.getSelectedNode();
  const activeId = activeTab instanceof TabNode ? activeTab.getId() : "";
  // Painel vazio (criado por divisão): clicar nele o torna o painel ativo, para onde vai a próxima seção aberta pelo menu.
  const placeholder = useCallback((g: TabSetNode) => <div className="empty" onPointerDown={() => { model.doAction(Actions.setActiveTabset(g.getId())); refresh(); }}>
    <h1>Painel vazio</h1><p>Escolha uma seção no menu lateral ou arraste uma aba para cá.</p></div>, [model, refresh]);
  const renderSet = useCallback((node: TabSetNode | { getType(): string }, v: { buttons: ReactNode[] }) => {
    if (node instanceof TabSetNode && groupCount(model) > 1)
      v.buttons.push(<button key="fg" className="grp-close" title="Fechar coluna" aria-label="Fechar coluna" onClick={guarded(node.getChildren().map(c => c.getId()), () => closeGroup(model, node.getId()))}><X size={14}/></button>);
  }, [model, onModelChange, unsaved.api]);

  const abrirEmAba = useMemo(() => ({
    abrir: (s: TabSpec, origem?: string) => openContentLink(s, origem),
    mostrar: (x: number, y: number, s: TabSpec, origem?: string) => setMenu({ x, y, items: [{ label: "Abrir em nova aba", onSelect: () => openContentLink(s, origem) }] }),
  }), [openContentLink]);

  return <AbrirEmAbaContext.Provider value={abrirEmAba}><UnsavedContext.Provider value={unsaved.api}><div className={chromeHidden ? "app chrome-hidden" : "app"}>
    <aside className={collapsed ? "sidebar collapsed" : "sidebar"}>
      <div className="brand"><BookOpen size={22}/>{!collapsed && <strong>Compêndio <span>5e</span></strong>}</div>
      <div className="campaign">
        <NavItem spec={homeSpec}
          className={activeId === (active ? `campanha:${active.campaign.id}` : `secao:${campaignsHub.page}`) ? "campaign-main selected" : "campaign-main"}
          title={active ? `Campanha ativa: ${active.campaign.name} (abrir o Início)` : "Nenhuma campanha ativa: escolher ou criar"}
          ariaLabel={collapsed ? (active ? `Campanha ativa: ${active.campaign.name}` : "Nenhuma campanha ativa: escolher ou criar") : undefined} onNavigate={openMenu} onMenu={showNavMenu}>
          {collapsed ? <Castle size={19} aria-hidden="true"/> : <><small>CAMPANHA ATIVA</small>{" "}<strong>{active ? active.campaign.name : "Nenhuma"}</strong></>}
        </NavItem>
        {!collapsed && <button className="campaign-switch" aria-label="Trocar ou gerenciar campanhas" aria-haspopup="menu" title="Trocar ou gerenciar campanhas"
          onClick={e => { const r = e.currentTarget.getBoundingClientRect(); showCampaignMenu(r.left, r.bottom); }}><ChevronsUpDown size={16} aria-hidden="true"/></button>}
      </div>
      <nav aria-label="Menu principal">
        {(active || !mobile) && <NavItem spec={homeSpec} className={activeId === tabId(homeSpec) ? "nav-item selected" : "nav-item"} title="Início" onNavigate={openMenu} onMenu={showNavMenu}>
          <HomeIcon size={19}/>{!collapsed && <span>Início</span>}
        </NavItem>}
        {(mobile ? [campaignsHub, ...visibleSections(active?.role === "mestre")] : desktopSections(active?.role ?? null)).map(({ page, title, icon: Icon }) =>
        <NavItem key={page} spec={{ kind: "secao", ref: page }} className={activeId === `secao:${page}` ? "nav-item selected" : "nav-item"} title={title} onNavigate={openMenu} onMenu={showNavMenu}>
          <Icon size={19}/>{!collapsed && <span>{title}</span>}
        </NavItem>)}
        <NavItem spec={{ kind: "conta", ref: "perfil" }} className={activeId === "conta:perfil" ? "nav-item account selected" : "nav-item account"} title="Conta" onNavigate={openMenu} onMenu={showNavMenu}>
          <UserRound size={19}/>{!collapsed && <span>Conta</span>}
        </NavItem></nav>
      <button className="collapse" onClick={() => setCollapsed(v => !v)} aria-label={collapsed ? "Expandir menu" : "Recolher menu"}>
        {collapsed ? <ChevronRight size={18}/> : <><ChevronLeft size={18}/> Recolher menu</>}
      </button>
    </aside>
    <main className="workspace">
      {mobile
        ? <Mobile model={model} onOpen={openMenu} onOpenContent={openContentLink} onChange={() => onModelChange(model)} titleOf={titleOf}
            onClose={id => guarded([id], () => closeTab(model, id))()} onTabMenu={(t, x, y) => showTabMenu(t, x, y)}
            onNewTab={(x, y) => setMenu({ x, y, items: [...(active ? [{ label: "Início", onSelect: () => openMenu(homeSpec, "new") }] : []), ...[campaignsHub, ...visibleSections(active?.role === "mestre")].map(({ page, title }) => ({ label: title, onSelect: () => openMenu({ kind: "secao", ref: page }, "new") }))] })}/>
        : <Layout model={model} factory={factory} onAction={onAction} onModelChange={onModelChange} onContextMenu={contextMenu}
            onRenderTab={renderTab} onRenderTabSet={renderSet} onTabSetPlaceHolder={placeholder} supportsPopout={false} realtimeResize/>}
    </main>
    {menu && <ContextMenu menu={menu} onClose={closeMenu}/>}
    {unsaved.dialog}
  </div></UnsavedContext.Provider></AbrirEmAbaContext.Provider>;
}

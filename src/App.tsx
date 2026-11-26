import { PageViewport } from "./PageViewport";
import logo from "../compendio-logo.svg";
import { VoltarPaginaContext } from "./voltarPagina";
import { currentPage, historyOf, visitPage, stepHistory } from "./tabHistory";
import { NotificacoesProvider, SinoNotificacoes } from "./compendio/Notificacoes";
import { useConhecimento, itemConhecido } from "./compendio/conhecimento";
import { jogadorPodeAdicionar } from "./catalogue/disponibilidade";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Action, Actions, Layout, DockLocation, type Model, TabNode, TabSetNode } from "flexlayout-react";
import { Plus, RotateCcw, Maximize, ArrowLeft, ArrowRight, Castle, House as HomeIcon, ChevronLeft, ChevronRight, ChevronsUpDown, Pin, UserRound, X } from "lucide-react";
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
import { consumirVoltar, EVENTO_FECHAR_TELA, pedirFicha, registrarAliasPersonagem } from "./voltarInterno";
import { lerMapaAba } from "./criador/recuperacao";
import { tituloDe, useVersaoRegistros } from "./registrosStore";
import { Panel } from "./Panel";
import { AbrirEmAbaContext, OrigemAbaContext } from "./abrirEmAba";
import { hasSavedLayout, loadLayout, saveLayout, type Scope } from "./persistence";
import { srdItem } from "./catalogue/srd-2014-items";
import { defaultTitle, closeGroup, campaignsHub, desktopSections, firstVisitModel, tabId, canMoveToNewColumn, closeTab, createModel, groupCount, groups, isColumnsOnly, moveToGroup, moveToNewColumn, normalizeEmptyPanels, prepareMove, visibleSections, type TabSpec } from "./workspace";

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
/** Botão de abas ocultas: sem texto no DOM (a quantidade e o símbolo vêm do CSS), para o nome acessível do botão ("Hidden tabs") não divergir do texto visível (WCAG 2.5.3). */
const ICONES = { more: (_n: unknown, ocultas: readonly unknown[]) => <span className="aba-mais" aria-hidden="true" data-n={ocultas.length || ""}/> };

export default function App() {
  const { status, user } = useAuth();
  const { loading, active, error } = useCampaigns();
  const readyFor = useRef<string | null>(null);
  if (status !== "authenticated" || !user) { readyFor.current = null; return null; }
  // Não monte o workspace provisório antes de resolver a primeira campanha.
  if (!loading && !error) readyFor.current = user.id;
  if (readyFor.current !== user.id && !active) {
    if (error) return <CampaignLoadError/>;
    return <div role="status">Carregando suas campanhas…</div>;
  }
  return <Workspace key={user.id} userId={user.id}/>;
}

function CampaignLoadError() {
  const { refresh } = useCampaigns();
  return <div role="alert">Não foi possível carregar suas campanhas. <button onClick={() => void refresh()}>Tentar novamente</button></div>;
}

function Workspace({ userId }: { userId: string }) {
  // Espaço de trabalho por usuário + campanha ativa + dispositivo: ao trocar, carrega o layout daquele escopo.
  const { status } = useAuth();
  const { active, activeId: campaignId, memberships, setActive } = useCampaigns();
  const {items: conhecidosCatalogo}=useConhecimento();
  const scope: Scope = { user: userId, campaign: campaignId ?? "nenhuma", device: "navegador" };
  const scopeKey = `${scope.user}|${scope.campaign}|${scope.device}`;
  const scopeRef = useRef(scope); scopeRef.current = scope;
  const [model, setModel] = useState<Model>(() => {
    // Primeira vez nesta campanha (também no primeiro carregamento): só o Início. Layout salvo nunca é alterado.
    if (!hasSavedLayout(scope) && scope.campaign !== "nenhuma") return firstVisitModel(scope.campaign, memberships.find(x => x.campaign.id === scope.campaign)?.campaign.name);
    return createModel(loadLayout(scope));
  });
  const modelRef = useRef(model); modelRef.current = model;
  const [modelKey, setModelKey] = useState(scopeKey);
  const [, redraw] = useState(0);
  const [collapsed, setCollapsed] = useState(true);
  const [menu, setMenu] = useState<MenuState | null>(null);
  const registrosV = useVersaoRegistros();   // títulos de registros abertos mudam o rótulo das abas
  const mobile = useMobile();
  const chromeHidden = useChromeHidden(mobile);
  const good = useRef(model.toJson());
  const positions = useRef(new Map<string,number>());
  const closed = useRef<ReturnType<TabNode["toJson"]>[]>([]);
  const handled = useRef<Event | null>(null);
  const historySelection = useRef<string | null>(null);
  const restoringHistory = useRef(false);
  const refresh = useCallback(() => redraw(n => n + 1), []);
  const labelRef = useRef<(id: string) => string>(id => id);
  const unsaved = useUnsavedRegistry(id => labelRef.current(id));   // alterações não salvas por aba (editores registram)
  if (modelKey !== scopeKey) {
    // Primeira vez nesta campanha: abre o Início (ex.: logo após entrar por convite).
    const m = !hasSavedLayout(scope) && scope.campaign !== "nenhuma" ? firstVisitModel(scope.campaign, memberships.find(x => x.campaign.id === scope.campaign)?.campaign.name) : createModel(loadLayout(scope));
    modelRef.current = m; good.current = m.toJson(); closed.current=[]; positions.current.clear(); setMenu(null); setModelKey(scopeKey); setModel(m); } // troca de escopo: outro espaço de trabalho

  // Toda mudança passa por aqui: valida a restrição de colunas (reverte se violada) e persiste.
  const onModelChange = useCallback((m: Model) => {
    // Um callback atrasado do layout anterior não pode gravar no escopo atual.
    if (m !== modelRef.current) return;
    if (normalizeEmptyPanels(m)) return;   // painel que recebeu aba deixa de ser "vazio intencional"; a ação de correção volta aqui
    const json = m.toJson();
    if (!isColumnsOnly(json)) { const restored = createModel(good.current); modelRef.current = restored; setModel(restored); return; }
    const existing = new Set((json.layout.children??[]).flatMap(g=>(g.children??[]).map(t=>t.id)));
    const removed=(good.current.layout.children??[]).flatMap(g=>g.children??[]).filter(t=>t.type==="tab"&&!existing.has(t.id));
    closed.current=[...closed.current,...removed as ReturnType<TabNode["toJson"]>[]].slice(-20);
    good.current = json; saveLayout(json, scopeRef.current);
    const selected = m.getActiveTabset()?.getSelectedNode();
    const selectedId = selected instanceof TabNode ? `${selected.getId()}@${historyOf(selected).index}` : null;
    if (selectedId && selectedId !== historySelection.current) {
      historySelection.current = selectedId;
      if (!restoringHistory.current) window.history.pushState({ ...window.history.state, compendioTab: selected instanceof TabNode ? selected.getId() : null, compendioIndex: selected instanceof TabNode ? historyOf(selected).index : 0, compendioScope: scopeKey }, "");
    }
    refresh();
  }, [refresh, scopeKey]);
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
  // Navegação: o menu seleciona uma aba existente ou cria outra, sem substituir conteúdo aberto.
  // O menu preserva abas; visit navega localmente; openContentLink só abre consultas explicitamente.
  // Depois de recarregar, a aba de um personagem criado nela (`criador:novo-…`) continua sendo a aba dele.
  const lembrarCriados = useCallback(() => model.visitNodes(n => {
    const c = n instanceof TabNode ? currentPage(n) : null;
    if (c?.kind !== "criador" || !c.ref || !campaignId) return;
    const real = lerMapaAba(userId, campaignId, c.ref); if (real) registrarAliasPersonagem(real, c.ref);
  }), [model, userId, campaignId]);
  const abrindo = useCallback((s: TabSpec) => { if (s.kind === "ficha" || s.kind === "criador") { lembrarCriados(); pedirFicha(s.ref); } }, [lembrarCriados]);
  const openMenu = useCallback((s: TabSpec, mode: NavMode = "reuse") => { const go=()=>{abrindo(s); navigate(model, s, mode, unsaved.api.isDirty); onModelChange(model);};
    go(); }, [model, onModelChange, unsaved.api, abrindo]);
  const openContentLink = useCallback((s: TabSpec, originTabId?: string, noGrupoDaOrigem?: boolean) => { abrindo(s); openContent(model, s, originTabId, mobile, noGrupoDaOrigem); onModelChange(model); }, [model, onModelChange, mobile, abrindo]);
  useEffect(() => {
    const fechar = (e: Event) => { const id = (e as CustomEvent<string>).detail; if (!findTab(modelRef.current, id)) return; closeTab(modelRef.current, id); onModelChange(modelRef.current); };
    window.addEventListener(EVENTO_FECHAR_TELA, fechar); return () => window.removeEventListener(EVENTO_FECHAR_TELA, fechar);
  }, [onModelChange]);
  // O histórico do navegador acompanha a seleção, não recria nem apaga abas.
  useEffect(() => {
    const selected = modelRef.current.getActiveTabset()?.getSelectedNode();
    const initial = selected instanceof TabNode ? selected.getId() : null;
    historySelection.current = initial;
    if (initial) window.history.replaceState({ ...window.history.state, compendioTab: initial, compendioScope: scopeKey }, "");
    if(mobile)return;
    const onPop = (event: PopStateEvent) => {
      if (consumirVoltar(event)) return;   // ex.: sair da edição da ficha antes de trocar de aba
      const state = event.state as { compendioTab?: string; compendioScope?: string; compendioIndex?: number } | null;
      if (state?.compendioScope !== scopeKey || !state.compendioTab) return;
      const target = findTab(modelRef.current, state.compendioTab);
      if (!target) return;
      unsaved.api.guard("all",()=>{
      restoringHistory.current = true;
      modelRef.current.doAction(Actions.selectTab(target.getId()));
      const group = target.getParent();
      if (group instanceof TabSetNode) modelRef.current.doAction(Actions.setActiveTabset(group.getId()));
      if(state.compendioIndex!==undefined)stepHistory(modelRef.current,target.getId(),state.compendioIndex);
      historySelection.current = `${target.getId()}@${historyOf(target).index}`;
      onModelChange(modelRef.current);
      restoringHistory.current = false;
      });
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, [scopeKey, modelKey, mobile]);
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

  const visit = useCallback((s: TabSpec, origin?: string) => {
    const id=origin??model.getActiveTabset()?.getSelectedNode()?.getId();
    if(!id)return;
    unsaved.api.guard("all",()=>{
      let existing:TabNode|undefined;
      model.visitNodes(n=>{if(n instanceof TabNode&&n.getId()!==id&&tabId(currentPage(n))===tabId(s))existing=n;});
      abrindo(s);
      if(existing){model.doAction(Actions.selectTab(existing.getId()));const g=existing.getParent();if(g)model.doAction(Actions.setActiveTabset(g.getId()));}
      else visitPage(model,id,s);
      onModelChange(model);
    });
  },[model,unsaved.api,abrindo,onModelChange]);
  const reopen = useCallback(()=>{const tab=closed.current.pop();if(!tab)return;
    const g=model.getActiveTabset()??groups(model)[0];if(!g)return;
    if(tab.id&&findTab(model,tab.id)){model.doAction(Actions.selectTab(tab.id));}else model.doAction(Actions.addTab(tab,g.getId(),DockLocation.CENTER,-1,true));
    onModelChange(model);
  },[model,onModelChange]);
  const step = useCallback((id:string,index:number)=>unsaved.api.guard("all",()=>{stepHistory(model,id,index);onModelChange(model);}),[model,unsaved.api,onModelChange]);
  useEffect(()=>{
    if(mobile)return;
    const key=(e:KeyboardEvent)=>{if((e.ctrlKey||e.metaKey)&&e.shiftKey&&e.key.toLowerCase()==="t"){e.preventDefault();reopen();return;}if(!e.altKey||e.ctrlKey||e.metaKey||!["ArrowLeft","ArrowRight"].includes(e.key))return;
      const node=model.getActiveTabset()?.getSelectedNode();if(!(node instanceof TabNode))return;
      const h=historyOf(node),next=h.index+(e.key==="ArrowLeft"?-1:1);
      if(next>=0&&next<h.pages.length){e.preventDefault();step(node.getId(),next);}
    };
    window.addEventListener("keydown",key);return()=>window.removeEventListener("keydown",key);
  },[model,mobile,step,reopen]);
  const factory = useCallback((node: TabNode) => {
    const c = currentPage(node), h=historyOf(node);
    return <OrigemAbaContext.Provider value={node.getId()}><VoltarPaginaContext.Provider value={h.index>0?()=>step(node.getId(),h.index-1):undefined}><PageViewport key={tabId(c)} pageKey={`${scopeKey}:${node.getId()}:${tabId(c)}`} positions={positions.current}><Panel kind={c.kind} entity={c.ref} onOpen={openMenu} onOpenContent={s => visit(s, node.getId())}/></PageViewport></VoltarPaginaContext.Provider></OrigemAbaContext.Provider>;
  }, [openMenu, visit, step, scopeKey]);

  // Títulos nunca são persistidos: o nome da campanha vem da lista carregada (ou do rótulo genérico).
  const titleOf = useCallback((n: TabNode) => {
    const c = currentPage(n);
    const fallback = (n.getConfig() as {history?:unknown}).history ? defaultTitle(c) : n.getName();
    if ((c?.kind === "documento" || c?.kind === "ficha" || c?.kind === "magia") && c.ref) return tituloDe(c.ref) ?? fallback;
    if (c?.kind === "criador" && c.ref) return tituloDe(c.ref) ?? "Personagem guiado";   // o título não é persistido no layout
    if (c?.kind === "registro" && c.ref) return conhecidosCatalogo.find(x=>x.id===c.ref)?.title??"Registro";
    if (c?.kind === "monstro" && c.ref) return active?.role === "mestre" ? tituloDe(c.ref)??"Criatura" : conhecidosCatalogo.find(x=>x.category==="monster"&&x.definitionId===c.ref&&x.knowledge===4)?.title??"Criatura";
    if (c?.kind === "regra" && c.ref) return tituloDe(c.ref)??"Regra";
    if (c?.kind === "item" && c.ref) return active?.role === "mestre" || jogadorPodeAdicionar(c.ref) || itemConhecido(conhecidosCatalogo,c.ref) ? srdItem(c.ref)?.nome ?? fallback : "Item";
    return c?.kind === "campanha" ? memberships.find(m => m.campaign.id === c.ref)?.campaign.name ?? fallback : fallback;
  }, [memberships, registrosV, active?.role, conhecidosCatalogo]);
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
    v.content = <><span className="workspace-tab-title" title={titleOf(n)}>{titleOf(n)}</span>{isPinned(n) && <span className="sr-only"> (fixada)</span>}</>;   // marca visual + texto acessível
    if (isPinned(n)) v.leading = <Pin size={12} className="pin-icon" aria-hidden="true"/>;
  }, [titleOf]);
  const activeTab = model.getActiveTabset()?.getSelectedNode();
  const activeId = activeTab instanceof TabNode ? activeTab.getId() : "";
  // Painel vazio (criado por divisão): clicar nele o torna o painel ativo, para onde vai a próxima seção aberta pelo menu.
  const placeholder = useCallback((g: TabSetNode) => <div className="empty" onPointerDown={() => { model.doAction(Actions.setActiveTabset(g.getId())); refresh(); }}>
    <h1>Painel vazio</h1><p>Escolha uma seção no menu lateral ou arraste uma aba para cá.</p></div>, [model, refresh]);
  const renderSet = useCallback((node: TabSetNode | { getType(): string }, v: { buttons: ReactNode[] }) => {
    if(node instanceof TabSetNode){
      v.buttons.push(<button key="new" className="grp-close" title="Nova aba" aria-label="Nova aba" onClick={()=>{model.doAction(Actions.setActiveTabset(node.getId()));openMenu({kind:"nova",ref:crypto.randomUUID(),title:"Nova aba"});}}><Plus size={14}/></button>);
      v.buttons.push(<button key="reopen" className="grp-close" title="Reabrir aba fechada" aria-label="Reabrir aba fechada" disabled={!closed.current.length} onClick={reopen}><RotateCcw size={14}/></button>);
      v.buttons.push(<button key="full" className="grp-close" title="Alternar tela cheia" aria-label="Alternar tela cheia" onClick={()=>{const app=document.querySelector<HTMLElement>(".app");void (document.fullscreenElement?document.exitFullscreen?.():app?.requestFullscreen?.())?.catch(()=>{});}}><Maximize size={14}/></button>);
    }
    if(node instanceof TabSetNode){const tab=node.getSelectedNode();if(tab instanceof TabNode){const h=historyOf(tab);
      v.buttons.unshift(<span className="workspace-history" key="history"><button title="Voltar na aba" aria-label="Voltar na aba" disabled={h.index===0} onClick={()=>step(tab.getId(),h.index-1)}><ArrowLeft size={14}/></button><button title="Avançar na aba" aria-label="Avançar na aba" disabled={h.index===h.pages.length-1} onClick={()=>step(tab.getId(),h.index+1)}><ArrowRight size={14}/></button></span>);
    }}
    if (node instanceof TabSetNode && groupCount(model) > 1)
      v.buttons.push(<button key="fg" className="grp-close" title="Fechar coluna" aria-label="Fechar coluna" onClick={guarded(node.getChildren().map(c => c.getId()), () => closeGroup(model, node.getId()))}><X size={14}/></button>);
  }, [model, onModelChange, unsaved.api, step, reopen, openMenu]);

  const abrirEmAba = useMemo(() => ({
    navegar: (s:TabSpec,origem?:string)=>visit(s,origem),
    abrir: (s: TabSpec, origem?: string) => openContentLink(s, origem, true),
    mostrar: (x: number, y: number, s: TabSpec, origem?: string) => setMenu({ x, y, items: [{ label: "Abrir em nova aba", onSelect: () => openContentLink(s, origem, true) },
      ...(!mobile ? [{ label: "Abrir em novo grupo", onSelect: () => openContentLink(s, origem, false) }] : []), { label: "Abrir", onSelect: () => { if (mobile) openContentLink(s, origem, true); else visit(s, origem); } }] }),
  }), [openContentLink, mobile, model, visit]);

  return <NotificacoesProvider><AbrirEmAbaContext.Provider value={abrirEmAba}><UnsavedContext.Provider value={unsaved.api}><div className={chromeHidden ? "app chrome-hidden" : "app"}>
    <aside className={collapsed ? "sidebar collapsed" : "sidebar"}>
      <div className="brand"><img src={logo} width={24} height={24} alt=""/>{!collapsed && <strong>Compêndio <span>5e</span></strong>}<SinoNotificacoes onOpenContent={s => { const origem = model.getActiveTabset()?.getSelectedNode()?.getId(); if (!mobile && origem) visit(s,origem); else openContentLink(s, origem, true); }}/></div>
      <div className="campaign">
        <NavItem spec={homeSpec}
          className={activeId === (active ? `campanha:${active.campaign.id}` : `secao:${campaignsHub.page}`) ? "campaign-main selected" : "campaign-main"}
          title={active ? `Campanha ativa: ${active.campaign.name} (abrir o Início)` : "Nenhuma campanha ativa: escolher ou criar"}
          ariaLabel={collapsed ? (active ? `Campanha ativa: ${active.campaign.name}` : "Nenhuma campanha ativa: escolher ou criar") : undefined} onNavigate={openMenu} onMenu={showNavMenu}>
          {collapsed && <Castle size={19} aria-hidden="true"/>}<span className={collapsed?"sr-only":undefined}><small>CAMPANHA ATIVA</small>{" "}<strong>{active ? active.campaign.name : "Nenhuma"}</strong></span>
        </NavItem>
        {<button className="campaign-switch" title="Trocar ou gerenciar campanhas" aria-label="Trocar ou gerenciar campanhas" aria-haspopup="menu" title="Trocar ou gerenciar campanhas"
          onClick={e => { const r = e.currentTarget.getBoundingClientRect(); showCampaignMenu(r.left, r.bottom); }}><ChevronsUpDown size={16} aria-hidden="true"/></button>}
      </div>
      <nav aria-label="Menu principal">
        {(active || !mobile) && <NavItem spec={homeSpec} className={activeId === tabId(homeSpec) ? "nav-item selected" : "nav-item"} title="Início" onNavigate={openMenu} onMenu={showNavMenu}>
          <HomeIcon size={19}/>{<span className={collapsed?"sr-only":undefined}>Início</span>}
        </NavItem>}
        {(mobile ? [campaignsHub, ...visibleSections(active?.role === "mestre")] : desktopSections(active?.role ?? null)).map(({ page, title, icon: Icon }) =>
        <NavItem key={page} spec={{ kind: "secao", ref: page }} className={activeId === `secao:${page}` ? "nav-item selected" : "nav-item"} title={title} onNavigate={openMenu} onMenu={showNavMenu}>
          <Icon size={19}/>{<span className={collapsed?"sr-only":undefined}>{title}</span>}
        </NavItem>)}
        <NavItem spec={{ kind: "conta", ref: "perfil" }} className={activeId === "conta:perfil" ? "nav-item account selected" : "nav-item account"} title="Conta" onNavigate={openMenu} onMenu={showNavMenu}>
          <UserRound size={19}/>{<span className={collapsed?"sr-only":undefined}>Conta</span>}
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
            onRenderTab={renderTab} onRenderTabSet={renderSet} onTabSetPlaceHolder={placeholder} supportsPopout={false} realtimeResize
            icons={ICONES}/>}
    </main>
    {menu && <ContextMenu menu={menu} onClose={closeMenu}/>}
    {unsaved.dialog}
  </div></UnsavedContext.Provider></AbrirEmAbaContext.Provider></NotificacoesProvider>;
}

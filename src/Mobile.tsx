import { useEffect, useRef, useState } from "react";
import { Actions, type Model, TabNode } from "flexlayout-react";
import { ArrowLeft, BookOpen, Castle, ChevronDown, House, Menu, NotebookPen, Swords, UserRound, ScrollText, X } from "lucide-react";
import { type NavMode } from "./navigation";
import { Panel } from "./Panel";
import { OrigemAbaContext } from "./abrirEmAba";
import { activeGroup, groups, visibleSections, type Kind, type TabSpec } from "./workspace";
import { useCampaigns } from "./CampaignsContext";

type Props = {
  model: Model; onChange: () => void; titleOf: (t: TabNode) => string;
  onOpen: (s: TabSpec, mode?: NavMode) => void;
  onOpenContent: (s: TabSpec, originTabId?: string) => void;
  onClose: (tabId: string) => void;
  onTabMenu: (t: TabNode, x: number, y: number) => void;
  onNewTab: (x: number, y: number) => void;
};

/** Mobile usa navegação de tela cheia. O modelo de abas continua preservado, mas sem barra visível. */
export function Mobile({ model, onOpen, onOpenContent, onChange, titleOf }: Props) {
  const { active } = useCampaigns();
  const [menuOpen, setMenuOpen] = useState(false);
  const history = useRef<string[]>([]);
  const [canBack, setCanBack] = useState(false);
  const group = activeGroup(model);
  const selected = group?.getSelectedNode();
  const selectedId = selected instanceof TabNode ? selected.getId() : "";
  const all = groups(model);
  const home: TabSpec = active ? { kind: "campanha", ref: active.campaign.id, title: active.campaign.name } : { kind: "secao", ref: "campanhas" };
  const sections = visibleSections(active?.role === "mestre");
  const navigate = (spec: TabSpec) => { setMenuOpen(false); onOpen(spec); };
  useEffect(() => {
    if (!selectedId) return;
    const h = history.current;
    if (h[h.length - 1] !== selectedId) {
      h.push(selectedId);
      if (h.length > 40) h.shift();
    }
    setCanBack(h.length > 1);
  }, [selectedId]);
  const goBack = () => {
    const h = history.current;
    if (h.length < 2) { navigate(home); return; }
    h.pop();
    while (h.length) {
      const id = h[h.length - 1];
      const node = model.getNodeById(id);
      if (node instanceof TabNode) {
        model.doAction(Actions.selectTab(id));
        onChange();
        setCanBack(h.length > 1);
        return;
      }
      h.pop();
    }
    navigate(home);
  };
  const isPage = (ref: string) => selectedId === `secao:${ref}`;
  const isMaster = active?.role === "mestre";
  const navItems = [
    { label: "Início", icon: House, spec: home, selected: selectedId === (active ? `campanha:${active.campaign.id}` : "secao:campanhas") },
    { label: "Anotações", icon: NotebookPen, spec: { kind: "secao", ref: "planejamento" } as TabSpec, selected: isPage("planejamento") },
    isMaster
      ? { label: "Iniciativa", icon: Swords, spec: { kind: "secao", ref: "iniciativa" } as TabSpec, selected: isPage("iniciativa") }
      : { label: "Ficha", icon: UserRound, spec: { kind: "secao", ref: "personagens" } as TabSpec, selected: isPage("personagens") || selectedId.startsWith("ficha:") },
    { label: "Compêndio", icon: ScrollText, spec: { kind: "secao", ref: "compendio" } as TabSpec, selected: isPage("compendio") },
  ];
  return <div className="mobile mobile-simple">
    <header className="mobile-topbar">
      <button className="mobile-icon-btn" aria-label="Voltar" onClick={goBack} disabled={!canBack && !selectedId}><ArrowLeft size={20}/></button>
      <div className="mobile-page-title"><BookOpen size={18} aria-hidden="true"/><span>{selected instanceof TabNode ? titleOf(selected) : "Compêndio 5e"}</span></div>
      <button className="mobile-icon-btn" aria-label="Abrir menu" aria-expanded={menuOpen} onClick={() => setMenuOpen(v => !v)}><Menu size={22}/></button>
    </header>
    <div className="mobile-screen">
      {selected instanceof TabNode
        ? <OrigemAbaContext.Provider value={selected.getId()}><Panel key={selected.getId()} kind={selected.getConfig().kind as Kind} entity={selected.getConfig().ref} onOpen={onOpen} onOpenContent={s => onOpenContent(s, selected.getId())}/></OrigemAbaContext.Provider>
        : <div className="mobile-start">
            <h1>Compêndio 5e</h1>
            <p>{active ? active.campaign.name : "Escolha uma campanha para começar."}</p>
            <div className="mobile-shortcuts">
              <button onClick={() => navigate(home)}><Castle size={20}/> {active ? "Abrir campanha" : "Campanhas"}</button>
              {sections.filter(s => s.page === "planejamento" || s.page === "iniciativa" || s.page === "personagens").map(s => <button key={s.page} onClick={() => navigate({ kind: "secao", ref: s.page })}><s.icon size={20}/>{s.title}</button>)}
            </div>
          </div>}
    </div>
    <nav className="mobile-bottom-nav" aria-label="Navegação mobile">
      {navItems.map(item => <button key={item.label} disabled={item.disabled} className={item.selected ? "active" : ""} aria-current={item.selected ? "page" : undefined} onClick={() => navigate(item.spec)}><item.icon size={22}/><span>{item.label}</span></button>)}
      <button className={menuOpen ? "active" : ""} aria-expanded={menuOpen} onClick={() => setMenuOpen(v => !v)}><Menu size={22}/><span>Menu</span></button>
    </nav>
    {menuOpen && <div className="mobile-menu-overlay" onClick={() => setMenuOpen(false)}>
      <div className="mobile-menu-sheet" role="dialog" aria-label="Menu de navegação" onClick={e => e.stopPropagation()}>
        <div className="mobile-menu-heading"><strong>Menu</strong><button aria-label="Fechar menu" onClick={() => setMenuOpen(false)}><X size={22}/></button></div>
        <button onClick={() => navigate(home)}><House size={20}/> Início</button>
        <button onClick={() => navigate({ kind: "secao", ref: "campanhas" })}><Castle size={20}/> Gerenciar campanhas</button>
        {sections.map(s => <button key={s.page} onClick={() => navigate({ kind: "secao", ref: s.page })}><s.icon size={20}/>{s.title}</button>)}
        <button onClick={() => navigate({ kind: "conta", ref: "perfil" })}><UserRound size={20}/> Conta</button>
        {all.length > 1 && <div className="mobile-menu-groups"><ChevronDown size={16}/> Grupos de trabalho
          {all.map((g, i) => <button key={g.getId()} onClick={() => { model.doAction(Actions.setActiveTabset(g.getId())); onChange(); setMenuOpen(false); }}>Grupo {i + 1}</button>)}
        </div>}
      </div>
    </div>}
  </div>;
}

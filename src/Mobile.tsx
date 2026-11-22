import { useEffect, useRef, useState } from "react";
import { type Model, TabNode } from "flexlayout-react";
import { ArrowLeft, BookOpen, Castle, House, Menu, NotebookPen, Swords, UserRound, ScrollText, X } from "lucide-react";
import { type NavMode } from "./navigation";
import { Panel } from "./Panel";
import { OrigemAbaContext } from "./abrirEmAba";
import { tabId, visibleSections, defaultTitle, type TabSpec } from "./workspace";
import { useAuth } from "./AuthContext";
import { useCampaigns } from "./CampaignsContext";
import { useRegistros } from "./RegistrosContext";
import { useUnsaved } from "./unsaved";

/** Ficha usada por último neste aparelho (só o id; fica sob a chave do usuário, então o logout a apaga). */
const chaveFicha = (uid: string, cid: string) => `compendio5e:ficha-recente:${uid}:${cid}`;
const lerFicha = (k: string) => { try { return localStorage.getItem(k); } catch { return null; } };
const gravarFicha = (k: string, id: string) => { try { localStorage.setItem(k, id); } catch { /* sem armazenamento */ } };

/** Restaura a rolagem mesmo quando o conteúdo carrega depois: tenta de novo enquanto a tela cresce (até ~1,5 s) e para se a pessoa rolar. */
function restaurarRolagem(el: HTMLElement | null, alvo: number): () => void {
  if (!el) return () => {};
  if (alvo <= 0) { el.scrollTop = 0; return () => {}; }
  let ativo = true, tentativas = 0, ultimo = -1;
  const tentar = () => {
    if (!ativo) return;
    if (ultimo >= 0 && Math.abs(el.scrollTop - ultimo) > 2) return;   // a pessoa rolou: não brigar com ela
    el.scrollTop = alvo; ultimo = el.scrollTop;
    if (el.scrollTop >= alvo - 1 || ++tentativas > 30) return;
    setTimeout(tentar, 50);
  };
  tentar();
  return () => { ativo = false; };
}

type Props = {
  model: Model; onChange: () => void; titleOf: (t: TabNode) => string;
  onOpen: (s: TabSpec, mode?: NavMode) => void;
  onOpenContent: (s: TabSpec, originTabId?: string) => void;
  onClose: (tabId: string) => void;
  onTabMenu: (t: TabNode, x: number, y: number) => void;
  onNewTab: (x: number, y: number) => void;
};

/** Navegação mobile independente das abas e colunas do FlexLayout do desktop. */
export function Mobile(_props: Props) {
  const { active } = useCampaigns(), { user } = useAuth(), registros = useRegistros(), unsaved = useUnsaved();
  const home: TabSpec = active ? { kind: "campanha", ref: active.campaign.id, title: active.campaign.name } : { kind: "secao", ref: "campanhas" };
  const [screen, setScreen] = useState<TabSpec>(home);
  const [history, setHistory] = useState<TabSpec[]>([]);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuDialog = useRef<HTMLDivElement>(null);
  const voltarPeloNavegador = useRef<() => void>(() => {});
  const navegacaoBrowser = useRef(false);
  const iniciadoBrowser = useRef(false);
  useEffect(() => {
    if (!menuOpen || !menuDialog.current) return;
    const root = menuDialog.current;
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const buttons = () => [...root.querySelectorAll<HTMLButtonElement>('button:not(:disabled)')];
    buttons()[0]?.focus();
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); setMenuOpen(false); return; }
      if (e.key !== 'Tab' || e.ctrlKey || e.metaKey) return;
      const items = buttons(), first = items[0], last = items[items.length - 1];
      if (!root.contains(document.activeElement) || document.activeElement === (e.shiftKey ? first : last)) {
        e.preventDefault(); (e.shiftKey ? last : first)?.focus();
      }
    };
    document.addEventListener('keydown', key, true);
    return () => { document.removeEventListener('keydown', key, true); if (previous?.isConnected) previous.focus({ preventScroll: true }); };
  }, [menuOpen]);
  const scroll = useRef<HTMLDivElement>(null);
  const positions = useRef(new Map<string, number>());
  const current = tabId(screen);
  const scope = active?.campaign.id ?? "sem-campanha";
  useEffect(() => {
    setScreen(active ? { kind: "campanha", ref: active.campaign.id, title: active.campaign.name } : { kind: "secao", ref: "campanhas" });
    setHistory([]);
    positions.current.clear();
    setMenuOpen(false);
  }, [scope]);
  /** Troca de tela: NUNCA descarta alterações não salvas em silêncio (pergunta antes, como fechar uma aba no desktop). */
  const irPara = (spec: TabSpec) => {
    setMenuOpen(false);
    if (tabId(spec) === current) return;
    unsaved.guard("all", () => {
      positions.current.set(current, scroll.current?.scrollTop ?? 0);
      setHistory(h => [...h.slice(-39), screen]);
      if (!navegacaoBrowser.current) window.history.pushState({ compendioMobile: true }, "", window.location.href);
      setScreen(spec);
      if (spec.kind === "ficha" && user && active) gravarFicha(chaveFicha(user.id, active.campaign.id), spec.ref);
    });
  };
  const navigate = irPara;
  const goBack = () => {
    if (!history.length) { irPara(home); return; }
    unsaved.guard("all", () => {
      positions.current.set(current, scroll.current?.scrollTop ?? 0);
      const previous = history[history.length - 1];
      setHistory(h => h.slice(0, -1));
      setScreen(previous);
    });
  };
  // O gesto Voltar do Android aciona popstate. Consumir o histórico interno
  // evita que um atalho da campanha feche o navegador/PWA.
  voltarPeloNavegador.current = () => {
    if (menuOpen) { setMenuOpen(false); window.history.pushState({ compendioMobile: true }, "", window.location.href); return; }
    if (!history.length) return;
    unsaved.guard("all", () => {
      positions.current.set(current, scroll.current?.scrollTop ?? 0);
      const previous = history[history.length - 1];
      setHistory(h => h.slice(0, -1));
      setScreen(previous);
    });
  };
  useEffect(() => {
    if (!iniciadoBrowser.current) {
      iniciadoBrowser.current = true;
      window.history.replaceState({ ...window.history.state, compendioMobile: true }, "", window.location.href);
    }
    const aoVoltar = () => {
      navegacaoBrowser.current = true;
      voltarPeloNavegador.current();
      navegacaoBrowser.current = false;
    };
    window.addEventListener("popstate", aoVoltar);
    return () => window.removeEventListener("popstate", aoVoltar);
  }, []);
  useEffect(() => restaurarRolagem(scroll.current, positions.current.get(current) ?? 0), [current]);
  /** Botão "Ficha" do jogador: abre A ficha (a usada por último, ou a mais recente dele), não só a lista; sem ficha ainda, abre a lista para criar. */
  const abrirMinhaFicha = async () => {
    setMenuOpen(false);
    const lista: TabSpec = { kind: "secao", ref: "personagens" };
    if (!registros || !active || !user) { irPara(lista); return; }
    const r = await registros.list(active.campaign.id, "character");
    const minhas = r.ok ? r.data.filter(x => x.ownerId === user.id).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)) : [];
    const lembrada = lerFicha(chaveFicha(user.id, active.campaign.id));
    const alvo = minhas.find(x => x.id === lembrada) ?? minhas[0];
    irPara(alvo ? { kind: "ficha", ref: alvo.id, title: alvo.title } : lista);
  };
  const isPage = (ref: string) => screen.kind === "secao" && screen.ref === ref;
  const isMaster = active?.role === "mestre";
  const sections = visibleSections(isMaster);
  const navItems = [
    { label: "Início", icon: House, spec: home, selected: current === tabId(home) },
    { label: "Anotações", icon: NotebookPen, spec: { kind: "secao", ref: "planejamento" } as TabSpec, selected: isPage("planejamento") },
    isMaster
      ? { label: "Iniciativa", icon: Swords, spec: { kind: "secao", ref: "iniciativa" } as TabSpec, selected: isPage("iniciativa") }
      : { label: "Ficha", icon: UserRound, spec: { kind: "secao", ref: "personagens" } as TabSpec, selected: isPage("personagens") || screen.kind === "ficha", onClick: abrirMinhaFicha },
    { label: "Compêndio", icon: ScrollText, spec: { kind: "secao", ref: "compendio" } as TabSpec, selected: isPage("compendio") },
  ];
  return <div className="mobile mobile-simple">
    <header className="mobile-topbar">
      <button className="mobile-icon-btn" aria-label="Voltar" onClick={goBack} disabled={!history.length && current === tabId(home)}><ArrowLeft size={20}/></button>
      <div className="mobile-page-title"><BookOpen size={18} aria-hidden="true"/><span>{defaultTitle(screen)}</span></div>
      <button className="mobile-icon-btn" aria-label="Abrir menu" aria-expanded={menuOpen} onClick={() => setMenuOpen(v => !v)}><Menu size={22}/></button>
    </header>
    <div className="mobile-screen" ref={scroll}>
      <OrigemAbaContext.Provider value={current}>
        <Panel key={current} kind={screen.kind} entity={screen.ref} onOpen={navigate} onOpenContent={navigate}/>
      </OrigemAbaContext.Provider>
    </div>
    <nav className="mobile-bottom-nav" aria-label="Navegação mobile">
      {navItems.map(item => <button key={item.label} className={item.selected ? "active" : ""} aria-current={item.selected ? "page" : undefined} onClick={() => (item as { onClick?: () => void }).onClick ? (item as { onClick: () => void }).onClick() : navigate(item.spec)}><item.icon size={22}/><span>{item.label}</span></button>)}
      <button className={menuOpen ? "active" : ""} aria-expanded={menuOpen} onClick={() => setMenuOpen(v => !v)}><Menu size={22}/><span>Menu</span></button>
    </nav>
    {menuOpen && <div className="mobile-menu-overlay" onClick={() => setMenuOpen(false)}>
      <div className="mobile-menu-sheet" role="dialog" aria-modal="true" ref={menuDialog} aria-label="Menu de navegação" onClick={e => e.stopPropagation()}>
        <div className="mobile-menu-heading"><strong>Menu</strong><button aria-label="Fechar menu" onClick={() => setMenuOpen(false)}><X size={22}/></button></div>
        <button onClick={() => navigate(home)}><House size={20}/> Início</button>
        <button onClick={() => navigate({ kind: "secao", ref: "campanhas" })}><Castle size={20}/> Gerenciar campanhas</button>
        {sections.map(s => <button key={s.page} onClick={() => navigate({ kind: "secao", ref: s.page })}><s.icon size={20}/>{s.title}</button>)}
        <button onClick={() => navigate({ kind: "conta", ref: "perfil" })}><UserRound size={20}/> Conta</button>
      </div>
    </div>}
  </div>;
}

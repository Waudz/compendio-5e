import { CICLO_ACESSO, type DetalheAcesso } from "./CicloPersonagens";
import { lerMapaAba } from "./criador/recuperacao";
import { GlobalMenu } from "./GlobalMenu";
import {tituloDe,useVersaoRegistros} from "./registrosStore";
import { useConhecimento } from "./compendio/conhecimento";
import { VoltarPaginaContext } from "./voltarPagina";
import { SinoNotificacoes } from "./compendio/Notificacoes";
import { EVENTO_TELA } from "./chromeHide";
import { useEffect, useRef, useState } from "react";
import { type Model, TabNode } from "flexlayout-react";
import { ArrowLeft, BookOpen, House, Menu, NotebookPen, Swords, UserRound, ScrollText } from "lucide-react";
import { type NavMode } from "./navigation";
import { consumirVoltar, EVENTO_FECHAR_TELA, pedirFicha } from "./voltarInterno";
import { Panel } from "./Panel";
import { PersonagensPanel } from "./Personagens";
import { AbrirEmAbaContext, OrigemAbaContext } from "./abrirEmAba";
import { tabId, defaultTitle, type TabSpec } from "./workspace";
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
  const snapshots = useRef(new Map<string,{screen:TabSpec;history:TabSpec[]}>());
  const entry = useRef<string>('');
  const scroll = useRef<HTMLDivElement>(null);
  const positions = useRef(new Map<string, number>());
  useVersaoRegistros();
  const conhecidos=useConhecimento().items;
  // Título de registro vem somente da projeção autorizada, nunca de um nome guardado em memória.
  const pageTitle=screen.kind==="registro"?conhecidos.find(x=>x.id===screen.ref)?.title??"Registro":screen.kind==="npc"?conhecidos.find(x=>x.id===screen.ref)?.title??"NPC":["documento","ficha","criador","monstro"].includes(screen.kind)?tituloDe(screen.ref)??defaultTitle(screen):defaultTitle(screen);
  const current = tabId(screen);
  const currentRef=useRef(current);currentRef.current=current;
  const menuRef=useRef(menuOpen);menuRef.current=menuOpen;
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
      if (spec.kind === "ficha" || spec.kind === "criador") pedirFicha(spec.ref);
      positions.current.set(current, scroll.current?.scrollTop ?? 0);
      setHistory(h => [...h.slice(-39), screen]);
      const id=crypto.randomUUID();entry.current=id;
      snapshots.current.set(id,{screen:spec,history:[...history.slice(-39),screen]});
      window.history.pushState({ compendioMobile: true, compendioMobileEntry:id, compendioMobileScope:scope }, "", window.location.href);
      setScreen(spec);
      if (spec.kind === "ficha" && user && active) gravarFicha(chaveFicha(user.id, active.campaign.id), spec.ref);
    });
  };
  // o ciclo de vida tirou o acesso: sai da tela daquele personagem e a remove do histórico de voltar
  useEffect(() => {
    const perder = (event: Event) => {
      const d = (event as CustomEvent<DetalheAcesso>).detail;
      if (d.campaignId !== active?.campaign.id || !user) return;
      const alvo = (s: TabSpec) => d.kinds.includes(s.kind) && (d.ids.includes(s.ref) || d.ids.includes(lerMapaAba(user.id, d.campaignId, s.ref) ?? ""));
      if (alvo(screen)) { unsaved.register(current, null); setScreen({ kind: "secao", ref: "personagens" }); }
      setHistory(h => (h.some(alvo) ? h.filter(s => !alvo(s)) : h));
      snapshots.current.forEach((s, k) => { if (alvo(s.screen)) snapshots.current.delete(k); else s.history = s.history.filter(p => !alvo(p)); });
    };
    window.addEventListener(CICLO_ACESSO, perder); return () => window.removeEventListener(CICLO_ACESSO, perder);
  }, [active?.campaign.id, user?.id, current, screen, unsaved]);
  const navigate = irPara;
  const goBack = () => {
    if (consumirVoltar()) return;
    if (!history.length) { irPara(home); return; }
    unsaved.guard("all", () => {
      positions.current.set(current, scroll.current?.scrollTop ?? 0);
      const previous = history[history.length - 1];
      setHistory(h => h.slice(0, -1));
      setScreen(previous);
      window.history.back();
    });
  };
  // O gesto Voltar do Android aciona popstate. Consumir o histórico interno
  // evita que um atalho da campanha feche o navegador/PWA.
  useEffect(() => {
    let live=true;
    const id=crypto.randomUUID();entry.current=id;
    snapshots.current.clear();snapshots.current.set(id,{screen:home,history:[]});
    window.history.replaceState({...window.history.state,compendioMobile:true,compendioMobileEntry:id,compendioMobileScope:scope},"",window.location.href);
    const aoVoltar = (event: PopStateEvent) => {
      if(consumirVoltar(event))return;
      const state=event.state as {compendioMobileEntry?:string;compendioMobileScope?:string}|null;
      if(state?.compendioMobileScope!==scope||!state.compendioMobileEntry)return;
      const target=snapshots.current.get(state.compendioMobileEntry);if(!target)return;
      if(menuRef.current){setMenuOpen(false);window.history.pushState({compendioMobile:true,compendioMobileEntry:entry.current,compendioMobileScope:scope},"",window.location.href);return;}
      const nextId=state.compendioMobileEntry;
      positions.current.set(currentRef.current,scroll.current?.scrollTop??0);
      void unsaved.confirmAll().then(allowed=>{
        if(!live)return;
        if(!allowed){window.history.pushState({compendioMobile:true,compendioMobileEntry:entry.current,compendioMobileScope:scope},"",window.location.href);return;}
        entry.current=nextId;
        setScreen(target.screen);setHistory(target.history);
      });
    };
    window.addEventListener("popstate",aoVoltar);return()=>{live=false;window.removeEventListener("popstate",aoVoltar);};
  },[scope]);
  const fecharTela = useRef<(id: string) => void>(() => {});
  fecharTela.current = id => { if (id.endsWith(`:${screen.ref}`)) goBack(); };
  useEffect(() => {
    const fechar = (e: Event) => fecharTela.current((e as CustomEvent<string>).detail);
    window.addEventListener(EVENTO_FECHAR_TELA, fechar); return () => window.removeEventListener(EVENTO_FECHAR_TELA, fechar);
  }, []);
  useEffect(() => { window.dispatchEvent(new Event(EVENTO_TELA)); return restaurarRolagem(scroll.current, positions.current.get(current) ?? 0); }, [current]);
  /** Botão "Ficha" do jogador: abre A ficha (a usada por último, ou a mais recente dele), não só a lista; sem ficha ainda, abre a lista para criar. */
  const atual = useRef(""); atual.current = `${user?.id}:${scope}`;
  const abrirMinhaFicha = async () => {
    const pedido = atual.current;
    setMenuOpen(false);
    const lista: TabSpec = { kind: "secao", ref: "meus-personagens" };
    if (!registros || !active || !user) { irPara(lista); return; }
    const r = await registros.list(active.campaign.id, "character");
    if (pedido !== atual.current) return;
    const minhas = r.ok ? r.data.filter(x => x.ownerId === user.id).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)) : [];
    const lembrada = lerFicha(chaveFicha(user.id, active.campaign.id));
    const alvo = minhas.find(x => x.id === lembrada) ?? minhas[0];
    irPara(alvo ? { kind: "ficha", ref: alvo.id, title: alvo.title } : lista);
  };
  const isPage = (ref: string) => screen.kind === "secao" && screen.ref === ref;
  const isMaster = active?.role === "mestre";
  const navItems = [
    { label: "Início", icon: House, spec: home, selected: current === tabId(home) },
    { label: "Anotações", icon: NotebookPen, spec: { kind: "secao", ref: "planejamento" } as TabSpec, selected: isPage("planejamento") },
    isMaster
      ? { label: "Iniciativa", icon: Swords, spec: { kind: "secao", ref: "iniciativa" } as TabSpec, selected: isPage("iniciativa") }
      : { label: "Ficha", icon: UserRound, spec: { kind: "secao", ref: "personagens" } as TabSpec, selected: (isPage("personagens") || isPage("meus-personagens")) || screen.kind === "ficha", onClick: abrirMinhaFicha },
    { label: "Compêndio", icon: ScrollText, spec: { kind: "secao", ref: "compendio" } as TabSpec, selected: isPage("compendio") },
  ];
  const [propriedade, setPropriedade] = useState<string | null>(null);
  const escopoFicha = `${user?.id}:${active?.campaign.id}:${screen.kind}:${screen.ref}`;
  useEffect(() => {
    let vivo = true;
    if (screen.kind !== "ficha" || !registros || !active || !user) return;
    void registros.get(screen.ref).then(r => {
      if (vivo) setPropriedade(r.ok && r.data && r.data.kind === "character" && r.data.ownerId === user.id && r.data.campaignId === active.campaign.id ? escopoFicha : null);
    }, () => { if (vivo) setPropriedade(null); });
    return () => { vivo = false; };
  }, [registros, escopoFicha]);
  const fichaPropria = !isMaster && screen.kind === "ficha" && !!user && !!active && propriedade === escopoFicha;
  const meus = !isMaster && isPage("meus-personagens");
  return <AbrirEmAbaContext.Provider value={{navegar:s=>navigate(s),abrir:s=>navigate(s),mostrar:(_x,_y,s)=>navigate(s)}}><div className="mobile mobile-simple">
    {!fichaPropria && !meus && <header className="mobile-topbar">
      <button className="mobile-icon-btn" aria-label="Voltar" onClick={goBack} disabled={!history.length && current === tabId(home)}><ArrowLeft size={20}/></button>
      <div className="mobile-page-title"><BookOpen size={18} aria-hidden="true"/><span>{pageTitle}</span></div>
      <SinoNotificacoes onOpenContent={navigate}/>
    </header>}
    <div className="mobile-screen" ref={scroll}>
      <VoltarPaginaContext.Provider value={goBack}><OrigemAbaContext.Provider value={current}>
        {(fichaPropria||meus)&&<div className="cd-own-header">{fichaPropria && <button type="button" className="btn-link mobile-meus-personagens" onClick={() => navigate({ kind: "secao", ref: "meus-personagens" })}><ArrowLeft size={16}/> Meus personagens</button>}<SinoNotificacoes onOpenContent={navigate}/></div>}
        {meus ? <PersonagensPanel key={current} somenteMeus onOpenContent={navigate}/> : <Panel key={current} kind={screen.kind} entity={screen.ref} onOpen={navigate} onOpenContent={navigate}/>}
      </OrigemAbaContext.Provider></VoltarPaginaContext.Provider>
    </div>
    <nav className="mobile-bottom-nav" aria-label="Navegação mobile">
      {navItems.map(item => <button key={item.label} className={!menuOpen && item.selected ? "active" : ""} aria-current={!menuOpen && item.selected ? "page" : undefined} onClick={() => (item as { onClick?: () => void }).onClick ? (item as { onClick: () => void }).onClick() : navigate(item.spec)}><item.icon size={22}/><span>{item.label}</span></button>)}
      <button className={menuOpen ? "active" : ""} aria-expanded={menuOpen} onClick={() => setMenuOpen(v => !v)}><Menu size={22}/><span>Menu</span></button>
    </nav>
    {menuOpen && <GlobalMenu onNavigate={navigate} onClose={() => setMenuOpen(false)}/>}
  </div></AbrirEmAbaContext.Provider>;
}

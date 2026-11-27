import {useEffect, useRef, useState} from "react";
import {Castle, Info, LogOut, Settings, Shield, UserRound, Users, BookMarked, X} from "lucide-react";
import {useAuth} from "./AuthContext";
import {useCampaigns} from "./CampaignsContext";
import {useUnsaved} from "./unsaved";
import {APP_PHASE, APP_VERSION} from "./version";
import type {TabSpec} from "./workspace";

/** Mesmas ações e permissões em ambos os tamanhos de tela. */
export function GlobalMenu({onNavigate, onClose}: {onNavigate: (s: TabSpec) => void; onClose: () => void}) {
  const {active} = useCampaigns(), {api} = useAuth(), unsaved = useUnsaved();
  const master = active?.role === "mestre";
  const dialog = useRef<HTMLDivElement>(null);
  const [busy, setBusy] = useState(false), [error, setError] = useState<string | null>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const buttons = () => [...(dialog.current?.querySelectorAll<HTMLButtonElement>("button:not(:disabled)") ?? [])];
    buttons()[0]?.focus();
    const key = (event: KeyboardEvent) => {
      if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); onClose(); }
      if (event.key !== "Tab") return;
      const items = buttons(), first = items[0], last = items[items.length - 1];
      if (!dialog.current?.contains(document.activeElement) || document.activeElement === (event.shiftKey ? first : last)) {
        event.preventDefault(); (event.shiftKey ? last : first)?.focus();
      }
    };
    document.addEventListener("keydown", key, true);
    return () => {document.removeEventListener("keydown", key, true); if (previous?.isConnected) previous.focus({preventScroll:true});};
  }, [onClose]);
  const go = (s: TabSpec) => {onClose(); onNavigate(s);};
  return <div className="global-menu-overlay mobile-menu-overlay" onClick={onClose}>
    <div className="global-menu-sheet mobile-menu-sheet" role="dialog" aria-modal="true" aria-label="Menu de navegação" ref={dialog} onClick={e => e.stopPropagation()}>
      <div className="mobile-menu-heading"><strong>Menu</strong><button aria-label="Fechar menu" onClick={onClose}><X size={20}/></button></div>
      <section className="global-menu-group" aria-label="Campanha"><h2>Campanha</h2>
        <button onClick={() => go({kind:"secao", ref:"campanhas"})}><Castle size={18}/>{master ? "Gerenciar campanhas" : "Minhas campanhas"}</button>
        {active && <><button onClick={() => go({kind:"secao", ref:"personagens", ...(!master ? {title:"Meus personagens"} : {})})}><Users size={18}/>{master ? "Personagens" : "Meus personagens"}</button>
          <button onClick={() => go({kind:"secao", ref:"diario"})}><BookMarked size={18}/>Diário</button>
          {master && <button onClick={() => go({kind:"secao", ref:"encontros"})}><Shield size={18}/>Encontros</button>}</>}
      </section>
      <section className="global-menu-group" aria-label="Conta e preferências"><h2>Conta e preferências</h2>
        <button onClick={() => go({kind:"conta", ref:"perfil"})}><UserRound size={18}/>Minha conta</button>
        <button onClick={() => go({kind:"conta", ref:"configuracoes"})}><Settings size={18}/>Configurações</button>
        <button onClick={() => go({kind:"conta", ref:"sobre"})}><Info size={18}/>Sobre o Compêndio</button>
      </section>
      <footer className="global-menu-group"><button disabled={busy || !api} onClick={async () => {
        if (!(await unsaved.confirmAll()) || !api) return;
        setBusy(true); setError(null); const r = await api.signOut(); setBusy(false);
        if (!r.ok) setError(r.error);
      }}><LogOut size={18}/>{busy ? "Saindo…" : "Sair"}</button>
        {error && <p role="alert">{error}</p>}<small>Compêndio {APP_VERSION} · {APP_PHASE}</small>
      </footer>
    </div>
  </div>;
}

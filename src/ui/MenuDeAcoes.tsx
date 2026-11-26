// Menu de reticências compartilhado: as ações de um item num só lugar, sempre na mesma posição.
import { MoreVertical, type LucideIcon } from "lucide-react";
import { useRef, useState } from "react";
import { useFecharMenu } from "../useFecharMenu";
import "./ui.css";

export type AcaoDeMenu = { rotulo: string; icone: LucideIcon; acao: () => void; perigo?: boolean; desabilitada?: boolean; motivo?: string };

export function MenuDeAcoes({ rotulo, acoes }: { rotulo: string; acoes: AcaoDeMenu[] }) {
  const [aberto, setAberto] = useState(false);
  const menu = useRef<HTMLDivElement | null>(null), gatilho = useRef<HTMLButtonElement>(null);
  useFecharMenu(aberto, menu, gatilho, () => setAberto(false));
  return <span className="menu-acoes">
    <button ref={gatilho} type="button" className="menu-acoes-gatilho" aria-label={rotulo} title={rotulo} aria-haspopup="menu" aria-expanded={aberto} onClick={() => setAberto(a => !a)}><MoreVertical size={16} aria-hidden="true"/></button>
    {aberto && <div ref={el => {
      menu.current = el;
      if (!el) return;
      // abre para o lado em que cabe: nunca fica cortado pela borda do painel
      const caixa = el.getBoundingClientRect(), painel = (el.closest(".content") ?? document.documentElement).getBoundingClientRect();
      if (caixa.width && caixa.left < painel.left) { el.style.right = "auto"; el.style.left = "0"; }
    }} className="menu-acoes-lista" role="menu" aria-label={rotulo}>
      {acoes.map(a => <button key={a.rotulo} type="button" role="menuitem" className={a.perigo ? "perigo" : ""} disabled={a.desabilitada} title={a.desabilitada ? a.motivo : undefined}
        onClick={() => { setAberto(false); a.acao(); }}><a.icone size={14} aria-hidden="true"/> {a.rotulo}</button>)}
    </div>}
  </span>;
}

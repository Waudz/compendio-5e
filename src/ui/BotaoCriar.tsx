// "+ Criar": o mesmo botão de criação em Personagens e no Compêndio. Quem chama só informa o que o usuário pode criar.
import { Plus, type LucideIcon } from "lucide-react";
import { useRef, useState } from "react";
import { useFecharMenu } from "../useFecharMenu";
import "./ui.css";

export type OpcaoDeCriacao = { rotulo: string; icone: LucideIcon; acao: () => void; desabilitada?: boolean; motivo?: string };

export function BotaoCriar({ opcoes }: { opcoes: OpcaoDeCriacao[] }) {
  const [aberto, setAberto] = useState(false);
  const menu = useRef<HTMLDivElement>(null), gatilho = useRef<HTMLButtonElement>(null);
  useFecharMenu(aberto, menu, gatilho, () => setAberto(false));
  return <span className="menu-acoes botao-criar">
    <button ref={gatilho} type="button" className="btn-primary" aria-haspopup="menu" aria-expanded={aberto} onClick={() => setAberto(a => !a)}><Plus size={15} aria-hidden="true"/> Criar</button>
    {aberto && <div ref={menu} className="menu-acoes-lista" role="menu" aria-label="Criar">
      {opcoes.map(o => <button key={o.rotulo} type="button" role="menuitem" disabled={o.desabilitada} title={o.desabilitada ? o.motivo : undefined} onClick={() => { setAberto(false); o.acao(); }}><o.icone size={14} aria-hidden="true"/> {o.rotulo}</button>)}
    </div>}
  </span>;
}

// Elementos visuais do D&D 5e (2014): escudo de CA, D20 de nível, moldura de atributo, dados de vida e indicadores do cabeçalho.
// Só SVG e CSS. São do SISTEMA D&D (classe `.sistema-dnd`): outros sistemas terão os seus. Não calculam regras; recebem valores prontos.
import { Award, Eye, Footprints, Heart, Zap, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import "./dnd.css";

export const sinalDnd = (n: number) => (n >= 0 ? `+${n}` : String(n));

/** Escudo com a classe de armadura no centro. */
export function EscudoCA({ valor, extra }: { valor: ReactNode; extra?: ReactNode }) {
  return <div className="ficha-numero dnd-indicador dnd-ca"><span>CA</span>
    <span className="dnd-escudo">
      <svg viewBox="0 0 64 72" aria-hidden="true" focusable="false"><path className="dnd-forma" d="M32 3 59 12v22c0 17-11 28-27 35C16 62 5 51 5 34V12z"/><path className="dnd-filete" d="M32 9 53 16v18c0 13-8 22-21 28C19 56 11 47 11 34V16z"/></svg>
      <strong>{valor}</strong>
    </span>{extra}</div>;
}

/** Nível dentro de um D20. */
export function D20Nivel({ nivel, tamanho = 52 }: { nivel: number; tamanho?: number }) {
  return <span className="dnd-d20" style={{ width: tamanho, height: tamanho }} role="img" aria-label={`Nível ${nivel}`}>
    <svg viewBox="0 0 64 64" aria-hidden="true" focusable="false">
      <path className="dnd-forma" d="M32 2 59 17v30L32 62 5 47V17z"/>
      <path className="dnd-filete" d="M32 13 51 45H13zM32 2v11M5 17l27-4 27 4M5 17l8 28-8 2M59 17l-8 28 8 2M13 45l19 17 19-17"/>
    </svg>
    <strong aria-hidden="true">{nivel}</strong>
  </span>;
}

const ICONES: Record<"iniciativa" | "percepcao" | "deslocamento" | "proficiencia", LucideIcon> = { iniciativa: Zap, percepcao: Eye, deslocamento: Footprints, proficiencia: Award };
export function Indicador({ rotulo, valor, tipo, extra }: { rotulo: string; valor: ReactNode; tipo: keyof typeof ICONES; extra?: ReactNode }) {
  const Icone = ICONES[tipo];
  return <div className="ficha-numero dnd-indicador"><span>{rotulo}</span><span className="dnd-indicador-valor"><Icone size={18} aria-hidden="true"/><strong>{valor}</strong></span>{extra}</div>;
}

export function IndicadorPV({ atual, maximo, temporarios }: { atual: number; maximo: number; temporarios: number }) {
  return <div className={"dnd-indicador dnd-pv" + (atual === 0 ? " caido" : atual <= maximo / 4 ? " baixo" : "")}><span>PV</span>
    <span className="dnd-indicador-valor"><Heart size={20} aria-hidden="true"/><strong data-testid="ficha-pv">{atual} / {maximo}</strong></span>
    {temporarios > 0 && <small className="ficha-pv-temp" data-testid="ficha-pv-temp">+{temporarios} temporários</small>}
    {atual === 0 && <small className="ficha-caido">caído</small>}
  </div>;
}

/** Atributo na moldura da ficha clássica: nome, modificador em destaque e o valor numa plaqueta inferior. Usado na ficha, na criação,
 *  na edição e na subida de nível (`controles` acrescenta o que cada contexto precisa). */
export function MolduraAtributo({ nome, valor, modificador, controles, nota, destaque }: { nome: string; valor: ReactNode; modificador: number; controles?: ReactNode; nota?: ReactNode; destaque?: boolean }) {
  return <div className={"ficha-atributo dnd-atributo" + (destaque ? " destaque" : "")}>
    <div className="dnd-atributo-quadro">
      <span className="dnd-atributo-nome"><span className="dnd-nome-longo">{nome}</span><abbr className="dnd-nome-curto" title={nome}>{nome.slice(0, 3)}</abbr></span>
      <strong>{sinalDnd(modificador)}</strong>
    </div>
    <small className="dnd-atributo-valor">{valor}</small>
    {nota && <span className="dnd-atributo-nota">{nota}</span>}
    {controles}
  </div>;
}

const DADOS: Record<number, string> = {
  6: "M5 5h14v14H5z",
  8: "M12 2 21 12 12 22 3 12z",
  10: "M12 2 21 10 12 22 3 10z",
  12: "M12 2 21.5 9 18 20.5H6L2.5 9z",
};
/** Silhueta do dado de vida da classe (d6, d8, d10 ou d12). */
export function SilhuetaDado({ lados, cheio = true, tamanho = 22 }: { lados: number; cheio?: boolean; tamanho?: number }) {
  return <svg className={"dnd-dado" + (cheio ? " cheio" : "")} width={tamanho} height={tamanho} viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d={DADOS[lados] ?? DADOS[8]}/></svg>;
}

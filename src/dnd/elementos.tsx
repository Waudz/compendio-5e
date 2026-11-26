// Elementos da ficha D&D 5e (2014): nível, cartão de atributo, dados de vida e os indicadores do cabeçalho. Visual simples, com as cores
// e a tipografia do Compêndio (sem molduras nem ornamentos). Não calculam regras; recebem valores prontos.
import { Award, Eye, Footprints, Heart, Shield, Zap, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import "./dnd.css";

export const sinalDnd = (n: number) => (n >= 0 ? `+${n}` : String(n));

/** Nível do personagem em texto simples. */
export function SeloNivel({ nivel }: { nivel: number }) {
  return <span className="selo-nivel">Nível {nivel}</span>;
}

const ICONES: Record<"ca" | "pv" | "iniciativa" | "percepcao" | "deslocamento" | "proficiencia", LucideIcon> = { ca: Shield, pv: Heart, iniciativa: Zap, percepcao: Eye, deslocamento: Footprints, proficiencia: Award };
/** Um dos seis indicadores do cabeçalho: ícone e rótulo em cima, valor embaixo. Todos com o mesmo tamanho. */
export function Indicador({ rotulo, valor, tipo, extra, classe = "" }: { rotulo: string; valor: ReactNode; tipo: keyof typeof ICONES; extra?: ReactNode; classe?: string }) {
  const Icone = ICONES[tipo];
  return <div className={("ficha-numero dnd-indicador " + classe).trim()}><span className="dnd-indicador-rotulo"><Icone size={13} aria-hidden="true"/><span>{rotulo}</span></span><strong>{valor}</strong>{extra}</div>;
}

export function IndicadorPV({ atual, maximo, temporarios }: { atual: number; maximo: number; temporarios: number }) {
  return <Indicador tipo="pv" rotulo="PV" classe={"dnd-pv" + (atual === 0 ? " caido" : atual <= maximo / 4 ? " baixo" : "")} valor={<span data-testid="ficha-pv">{atual} / {maximo}</span>}
    extra={<>{temporarios > 0 && <small className="ficha-pv-temp" data-testid="ficha-pv-temp">+{temporarios} temporários</small>}{atual === 0 && <small className="ficha-caido">caído</small>}</>}/>;
}

/** Cartão de atributo: nome, valor em destaque e modificador. Usado na ficha, na criação, na edição e na subida de nível (`controles`
 *  acrescenta o que cada contexto precisa). */
export function MolduraAtributo({ nome, valor, modificador, controles, nota, destaque }: { nome: string; valor: ReactNode; modificador: number; controles?: ReactNode; nota?: ReactNode; destaque?: boolean }) {
  return <div className={"ficha-atributo dnd-atributo" + (destaque ? " destaque" : "")}>
    <span className="dnd-atributo-nome"><span className="dnd-nome-longo">{nome}</span><abbr className="dnd-nome-curto" title={nome}>{nome.slice(0, 3)}</abbr></span>
    <strong className="dnd-atributo-valor">{valor}</strong>
    <span className="dnd-atributo-mod">{sinalDnd(modificador)}</span>
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

// Indicador de usos de um recurso (características, espaços de magia, dados de vida). Poucos usos: um marcador por uso, clicável.
// Muitos usos: contador compacto com − e +. O estado não depende de cor: disponível é preenchido, gasto é um contorno vazado.
import { Minus, Plus } from "lucide-react";
import { SilhuetaDado } from "../dnd/elementos";

export const MAX_MARCADORES = 10;
type Props = {
  rotulo: string; maximo: number | null; disponiveis: number | null;
  /** +1 gasta um uso; -1 recupera um uso. */ onUsar: (delta: 1 | -1) => void;
  /** Quando volta (ex.: "descanso curto"). */ recarga?: string;
  /** Dados de vida: cada marcador tem a forma do dado (d6, d8, d10, d12). */ lados?: number;
};

export function Marcadores({ rotulo, maximo, disponiveis, onUsar, recarga, lados }: Props) {
  if (maximo === null || disponiveis === null) return <span className="marcadores"><span className="ficha-usos">ilimitado</span></span>;
  const detalhe = <span className="marcadores-texto"><span className="ficha-usos">{disponiveis}/{maximo}</span>{recarga && <small className="muted">volta no {recarga}</small>}</span>;
  if (maximo > MAX_MARCADORES) return <span className="marcadores" role="group" aria-label={`Usos de ${rotulo}: ${disponiveis} de ${maximo}`}>
    <button type="button" className="ficha-remover" disabled={disponiveis === 0} aria-label={`Usar ${rotulo}`} onClick={() => onUsar(1)}><Minus size={14} aria-hidden="true"/></button>
    {detalhe}
    <button type="button" className="ficha-remover" disabled={disponiveis === maximo} aria-label={`Recuperar ${rotulo}`} onClick={() => onUsar(-1)}><Plus size={14} aria-hidden="true"/></button>
  </span>;
  return <span className="marcadores" role="group" aria-label={`Usos de ${rotulo}: ${disponiveis} de ${maximo}`}>
    <span className="marcadores-pontos">{Array.from({ length: maximo }, (_, i) => {
      const cheio = i < disponiveis;
      return <button key={i} type="button" className={"marcador" + (cheio ? " cheio" : "") + (lados ? " dado" : "")} aria-label={`${cheio ? "Usar" : "Recuperar"} ${rotulo} (uso ${i + 1} de ${maximo}, ${cheio ? "disponível" : "gasto"})`} onClick={() => onUsar(cheio ? 1 : -1)}><span aria-hidden="true">{lados ? <SilhuetaDado lados={lados} cheio={cheio}/> : null}</span></button>;
    })}</span>
    {detalhe}
  </span>;
}

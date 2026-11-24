import { Minus, Plus } from "lucide-react";
import type { InputHTMLAttributes } from "react";

export function ControleNumerico({ campo, menos, mais }: { campo: InputHTMLAttributes<HTMLInputElement>; menos: { rotulo: string; titulo: string; acao: () => void }; mais: { rotulo: string; titulo: string; acao: () => void } }) {
  return <div className="ini-pv-controles controle-numerico">
    <button type="button" className="btn-secondary ini-icone" onClick={menos.acao} aria-label={menos.rotulo} title={menos.titulo}><Minus size={14} aria-hidden="true"/></button>
    <input inputMode="numeric" {...campo}/>
    <button type="button" className="btn-secondary ini-icone" onClick={mais.acao} aria-label={mais.rotulo} title={mais.titulo}><Plus size={14} aria-hidden="true"/></button>
  </div>;
}

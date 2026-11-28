import {useId,type ReactNode} from 'react';
/** Grupo de campos com título, comum à identidade narrativa de aventureiros e NPCs (nada é recolhido). */
export function SecaoNarrativa({titulo,children}:{titulo:string;children:ReactNode}){
 const id=useId();
 return <div className="secao-narrativa"><h3 id={id}>{titulo}</h3><section aria-labelledby={id}>{children}</section></div>;
}

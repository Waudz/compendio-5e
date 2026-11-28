import {useId,type ReactNode} from 'react';
/** Seções recolhíveis comuns à identidade narrativa de aventureiros e NPCs. */
export function SecaoNarrativa({titulo,children,aberta=true}:{titulo:string;children:ReactNode;aberta?:boolean}){
 const id=useId();
 return <details className="secao-narrativa" open={aberta}><summary id={id}>{titulo}</summary><section aria-labelledby={id}>{children}</section></details>;
}

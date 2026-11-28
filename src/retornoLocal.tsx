import {useContext,useEffect,useRef,useSyncExternalStore,type RefObject} from 'react';
import {OrigemAbaContext} from './abrirEmAba';
import {estaVisivel,registrarVoltar} from './voltarInterno';
const retornos=new Map<string,()=>void>(),ouvintes=new Set<()=>void>();let versao=0;
const avisar=()=>{versao++;ouvintes.forEach(f=>f());};
export const retornoLocal=(id:string)=>retornos.get(id);
export const useVersaoRetornoLocal=()=>useSyncExternalStore(f=>{ouvintes.add(f);return()=>{ouvintes.delete(f);};},()=>versao);
/** Detalhe interno mantém os dados montados; o único botão fica no cabeçalho do shell. */
export function useRetornoLocal(fechar:()=>void,raiz:RefObject<HTMLElement>){
 const origem=useContext(OrigemAbaContext),acao=useRef(fechar);acao.current=fechar;
 useEffect(()=>{
  if(!origem)return;
  const marcador=crypto.randomUUID();
  window.history.pushState({...window.history.state,compendioDetalhe:marcador},'');
  const ui=()=>{acao.current();if(window.history.state?.compendioDetalhe===marcador)window.history.back();};
  retornos.set(origem,ui);avisar();
  const remover=registrarVoltar(()=>{if(!estaVisivel(raiz.current))return false;acao.current();return true;});
  return()=>{remover();if(retornos.get(origem)===ui){retornos.delete(origem);avisar();}};
 },[origem,raiz]);
 return !!origem;
}

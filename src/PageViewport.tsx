import {estaVisivel} from "./voltarInterno";
import {useLayoutEffect,useRef,type ReactNode} from 'react';
/** Um histórico guarda posições, nunca componentes ocultos com efeitos ativos. */
export function PageViewport({pageKey,positions,children}:{pageKey:string;positions:Map<string,number>;children:ReactNode}){
 const root=useRef<HTMLDivElement>(null);
 useLayoutEffect(()=>{
  let scroll=root.current?.querySelector<HTMLElement>(".content")??root.current?.parentElement;
  while(scroll&&!/auto|scroll/.test(getComputedStyle(scroll).overflowY))scroll=scroll.parentElement;
  if(!scroll)return;
  const el=scroll,target=positions.get(pageKey)??0;
  let cancelled=false,timer:ReturnType<typeof setTimeout>,attempt=0;
  const restore=()=>{if(cancelled)return;el.scrollTop=target;if(el.scrollTop<target&&attempt++<30)timer=setTimeout(restore,50);};
  restore();
  const focusTimer=setTimeout(()=>{
    if(document.activeElement!==document.body||!estaVisivel(root.current))return;
    const heading=root.current?.querySelector<HTMLElement>('h1');
    if(heading){
      // foco só para leitores de tela: o título não entra na ordem do Tab, então não desenha contorno (os controles seguem com focus-visible)
      heading.tabIndex=-1;heading.dataset.focoAutomatico='';
      heading.addEventListener('blur',()=>{delete heading.dataset.focoAutomatico;heading.removeAttribute('tabindex');},{once:true});
      heading.focus({preventScroll:true});
    }
  },0);
  const stop=()=>{cancelled=true;};el.addEventListener('wheel',stop,{passive:true});el.addEventListener('touchstart',stop,{passive:true});
  return()=>{positions.set(pageKey,el.scrollTop);cancelled=true;clearTimeout(timer);clearTimeout(focusTimer);el.removeEventListener('wheel',stop);el.removeEventListener('touchstart',stop);};
 },[pageKey,positions]);
 return <div ref={root} className="workspace-page">{children}</div>;
}

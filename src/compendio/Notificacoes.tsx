import {createContext,useContext,useEffect,useRef,useState,type ReactNode} from 'react';
import {Bell,CheckCheck} from 'lucide-react';
import {useAuth} from '../AuthContext';
import {useCampaigns} from '../CampaignsContext';
import {useModoJogador} from '../modoJogador';
import {Modal} from '../ui/Modal';
import {CicloProvider,useCiclo} from '../CicloPersonagens';
import type {AvisoPersonagem} from '../cicloPersonagem';
import {identidadeSpec} from './navegacao';
import {useCodexApi,EVENTO_CODEX,type NotificationFeed} from './conhecimento';
import {registroSpec} from './navegacao';
import type {TabSpec} from '../workspace';
const EMPTY:NotificationFeed={items:[],unread:0,discoveries:0};
const Ctx=createContext<{feed:NotificationFeed;error?:string;refresh:()=>void;scope:string;busy:boolean;seenAll:()=>Promise<void>;seen:(id:number)=>Promise<void>}>({scope:"",busy:false,feed:EMPTY,refresh(){},async seenAll(){},async seen(){}});
export const useNotificacoes=()=>useContext(Ctx);
export function NotificacoesProvider({children}:{children:ReactNode}){
 const api=useCodexApi(),{active}=useCampaigns(),{user}=useAuth();const scope=`${user?.id}:${active?.campaign.id}:${active?.role}`;
 const [version,setVersion]=useState(0),[state,setState]=useState<{scope:string;feed:NotificationFeed;error?:string}>();
 const current=useRef(scope);current.current=scope;
 const operation=useRef<AbortController>();const [pending,setPending]=useState<string>();
 useEffect(()=>()=>{operation.current?.abort();},[scope,api]);
 const refresh=()=>setVersion(v=>v+1);
 const seenAll=async()=>{
   if(!api||!active||operation.current&&!operation.current.signal.aborted)return;
   const snapshot=state?.scope===scope?state.feed:EMPTY,through=Math.max(0,...snapshot.items.map(n=>n.id));
   if(!snapshot.unread||!through)return;
   const controller=new AbortController();operation.current=controller;setPending(scope);
   try{
     await api.seenAll(active.campaign.id,through,controller.signal);
     controller.signal.throwIfAborted();
     const feed=await api.feed(active.campaign.id);
     if(current.current===scope&&!controller.signal.aborted)setState({scope,feed});
   }finally{
     if(current.current===scope){setPending(undefined);refresh();}
     if(operation.current===controller)operation.current=undefined;
   }
 };

 useEffect(()=>{const handler=()=>{if(document.visibilityState!=='hidden')refresh();};window.addEventListener(EVENTO_CODEX,handler);window.addEventListener('focus',handler);const timer=setInterval(handler,30000);return()=>{clearInterval(timer);window.removeEventListener(EVENTO_CODEX,handler);window.removeEventListener('focus',handler);};},[]);
 useEffect(()=>{let alive=true;if(pending===scope)return;if(api&&active)void api.feed(active.campaign.id).then(feed=>{if(alive)setState({scope,feed});},()=>{if(alive)setState({scope,feed:EMPTY,error:'Não foi possível carregar as notificações. Tente novamente.'});});return()=>{alive=false;};},[api,scope,version,pending]);
 return <Ctx.Provider value={{scope,busy:pending===scope,seenAll,feed:state?.scope===scope?state.feed:EMPTY,error:state?.scope===scope?state.error:undefined,refresh,seen:async id=>{if(!api)return;await api.seen(id);refresh();}}}><CicloProvider>{children}</CicloProvider></Ctx.Provider>;
}
const TEXTO_AVISO:Record<AvisoPersonagem['kind'],string>={'renuncia':'O jogador deixou o personagem. Decida o destino','oferta':'Transferência para você aguardando resposta','oferta-aceita':'Transferência aceita','oferta-recusada':'Transferência recusada'};
export function SinoNotificacoes({onOpenContent}:{onOpenContent:(s:TabSpec)=>void}){
 const previa=useModoJogador().ativa;
 const data=useNotificacoes(),ciclo=useCiclo(),{active}=useCampaigns(),[open,setOpen]=useState(false),[error,setError]=useState('');
 const current=useRef(data.scope);current.current=data.scope;useEffect(()=>{setOpen(false);setError('');},[data.scope]);
 const pendentes=ciclo.avisos.filter(a=>!a.readAt),naoLidas=data.feed.unread+pendentes.length;
 const markAll=async()=>{const scope=data.scope;setError('');const ids=pendentes.map(a=>a.id);try{await data.seenAll();if(!(await ciclo.lerAvisos(ids)))throw Error('avisos');}catch{if(current.current===scope)setError('Não foi possível marcar todas como lidas. Confira sua conexão e tente novamente.');}};
 const ler=(id:number)=>void ciclo.lerAvisos([id]).then(ok=>{if(!ok)setError('Não foi possível marcar como lida.');});
 const abrirAviso=(a:AvisoPersonagem)=>{
  setOpen(false);if(!a.readAt)ler(a.id);
  const oferta=ciclo.ofertas.find(o=>o.characterId===a.characterId);
  if(a.kind==='oferta'&&oferta)ciclo.abrirOferta(oferta);
  else if(active?.role==='mestre')ciclo.gerenciar(a.characterId);
  else onOpenContent(identidadeSpec(a.characterId,a.title));
 };
 // uma só lista, da mais recente para a mais antiga
 const itens=[...data.feed.items.map(n=>({quando:n.created_at,no:<article key={'c'+n.id}><button className="cd-notice-link" onClick={()=>{setOpen(false);onOpenContent(registroSpec(n.entry_id,n.title));void data.seen(n.id).catch(()=>setError('Não foi possível marcar como lida.'));}}><strong>{n.title}</strong><small>{n.read_at?'Lida':n.is_new?'Nova descoberta':'Novas informações'} · {new Date(n.created_at).toLocaleDateString('pt-BR')}</small></button>{!n.read_at&&<button className="btn-link" onClick={()=>void data.seen(n.id).catch(()=>setError('Não foi possível marcar como lida.'))}>Marcar como lida</button>}</article>})),
  ...ciclo.avisos.map(a=>({quando:a.createdAt,no:<article key={'p'+a.id}><button className="cd-notice-link" onClick={()=>abrirAviso(a)}><strong>{a.title}</strong><small>{a.readAt?'Lida · ':''}{TEXTO_AVISO[a.kind]} · {new Date(a.createdAt).toLocaleDateString('pt-BR')}</small></button>{!a.readAt&&<button className="btn-link" onClick={()=>ler(a.id)}>Marcar como lida</button>}</article>}))].sort((x,y)=>y.quando.localeCompare(x.quando));
 if(previa)return null;
 return <><button className="cd-bell" aria-label={`Notificações${naoLidas?', '+naoLidas+' não lidas':''}`} aria-expanded={open} onClick={()=>{setOpen(true);data.refresh();}}><Bell size={18}/>{naoLidas>0&&<span className="cd-badge">{naoLidas>99?'99+':naoLidas}</span>}</button>
 {open&&<Modal titulo="Notificações" onFechar={()=>setOpen(false)} largura={480}><div className="cd-notifications">{naoLidas>0&&<div className="row"><button className="btn-link" disabled={data.busy} onClick={()=>void markAll()}><CheckCheck size={16} aria-hidden="true"/> {data.busy?"Marcando…":"Marcar todas como lidas"}</button></div>}{(data.error||error)&&<p role="alert">{error||data.error}</p>}{!data.error&&!itens.length&&<p>Nenhuma notificação.</p>}{itens.map(i=>i.no)}</div></Modal>}</>;
}

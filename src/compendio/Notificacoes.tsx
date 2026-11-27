import {createContext,useContext,useEffect,useRef,useState,type ReactNode} from 'react';
import {Bell,CheckCheck} from 'lucide-react';
import {useAuth} from '../AuthContext';
import {useCampaigns} from '../CampaignsContext';
import {Modal} from '../ui/Modal';
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
 return <Ctx.Provider value={{scope,busy:pending===scope,seenAll,feed:state?.scope===scope?state.feed:EMPTY,error:state?.scope===scope?state.error:undefined,refresh,seen:async id=>{if(!api)return;await api.seen(id);refresh();}}}>{children}</Ctx.Provider>;
}
export function SinoNotificacoes({onOpenContent}:{onOpenContent:(s:TabSpec)=>void}){
 const data=useNotificacoes(),[open,setOpen]=useState(false),[error,setError]=useState('');
 const current=useRef(data.scope);current.current=data.scope;useEffect(()=>{setOpen(false);setError('');},[data.scope]);
 const markAll=async()=>{const scope=data.scope;setError('');try{await data.seenAll();}catch{if(current.current===scope)setError('Não foi possível marcar todas como lidas. Confira sua conexão e tente novamente.');}};
 return <><button className="cd-bell" aria-label={`Notificações${data.feed.unread?', '+data.feed.unread+' não lidas':''}`} aria-expanded={open} onClick={()=>{setOpen(true);data.refresh();}}><Bell size={18}/>{data.feed.unread>0&&<span className="cd-badge">{data.feed.unread>99?'99+':data.feed.unread}</span>}</button>
 {open&&<Modal titulo="Notificações" onFechar={()=>setOpen(false)} largura={480}><div className="cd-notifications">{data.feed.unread>0&&<div className="row"><button className="btn-link" disabled={data.busy} onClick={()=>void markAll()}><CheckCheck size={16} aria-hidden="true"/> {data.busy?"Marcando…":"Marcar todas como lidas"}</button></div>}{(data.error||error)&&<p role="alert">{error||data.error}</p>}{!data.error&&!data.feed.items.length&&<p>Nenhuma notificação.</p>}{data.feed.items.map(n=><article key={n.id}><button className="cd-notice-link" onClick={()=>{setOpen(false);onOpenContent(registroSpec(n.entry_id,n.title));void data.seen(n.id).catch(()=>setError('Não foi possível marcar como lida.'));}}><strong>{n.title}</strong><small>{n.read_at?'Lida':n.is_new?'Nova descoberta':'Novas informações'} · {new Date(n.created_at).toLocaleDateString('pt-BR')}</small></button>{!n.read_at&&<button className="btn-link" onClick={()=>void data.seen(n.id).catch(()=>setError('Não foi possível marcar como lida.'))}>Marcar como lida</button>}</article>)}</div></Modal>}</>;
}

import { registroSpec } from "./navegacao";
import {useEffect,useMemo,useState} from 'react';
import {Plus} from 'lucide-react';
import {useAuth} from '../AuthContext';
import {useCampaigns} from '../CampaignsContext';
import {Aviso} from '../Diario';
import {EditorConhecimento} from './RegistrosCampanha';
import {CabecalhoCategoria,FerramentasCategoria,CartoesCategoria} from './ComponentesCategoria';
import {pesquisarLinhas,useLinhasCampanha} from './consulta';
import type {TabSpec} from '../workspace';
import type {CodexCategoria} from './conhecimento';
const categories:Record<string,CodexCategoria>={personagens:'npc',monstros:'monster',locais:'location',organizacoes:'organization',descobertas:'discovery'};
const labels:Record<string,string>={personagens:'Personagens',monstros:'Bestiário',locais:'Locais',organizacoes:'Organizações',descobertas:'Descobertas'};
type Preferences={query:string;view:'lista'|'grade';order:string;filter:string;limit?:number};const sessions=new WeakMap<object,Map<string,Preferences>>();
export function ListaCampanha({category,onBack,onOpenContent}:{category:string;onBack:()=>void;onOpenContent:(s:TabSpec)=>void}){
 const {active}=useCampaigns(),{client,user}=useAuth(),data=useLinhasCampanha();
 const cache=useMemo(()=>{if(!client)return new Map<string,Preferences>();let c=sessions.get(client);if(!c){c=new Map();sessions.set(client,c);}return c;},[client]);const key=`${user?.id}:${active?.campaign.id}:${category}`,pref=cache.get(key);
 const [limit,setLimit]=useState(pref?.limit??60);
 const [query,setQuery]=useState(pref?.query??''),[view,setView]=useState<'lista'|'grade'>(pref?.view??'grade'),[order,setOrder]=useState(pref?.order??'nome'),[filter,setFilter]=useState(pref?.filter??'Todos'),[create,setCreate]=useState(false);
 useEffect(()=>{cache.set(key,{query,view,order,filter,limit});},[key,query,view,order,filter,limit]);
 const available=data.rows.filter(r=>category==='personagens'?['npc','character'].includes(r.category):category==='descobertas'?['discovery','item'].includes(r.category):r.category===categories[category]);
 const filters=category==='personagens'?['Todos','Aventureiros','NPCs']:['Todos',...new Set(available.map(r=>r.filter).filter((x):x is string=>!!x))];
 const shown=pesquisarLinhas(available,query).filter(r=>filter==='Todos'||r.filter===filter).sort((a,b)=>a.title.localeCompare(b.title,'pt-BR')*(order==='inverso'?-1:1));
 return <div className="content cd-page"><CabecalhoCategoria title={labels[category]} onBack={onBack} actions={<>{category==='personagens'&&<button className="btn-secondary" onClick={()=>onOpenContent({kind:'criador',ref:'novo-'+crypto.randomUUID(),title:'Novo personagem'})}>Criar personagem</button>}{active?.role==='mestre'&&category!=='monstros'&&<button className="btn-primary" disabled={!!data.error||data.loading} onClick={()=>setCreate(true)}><Plus size={15}/> {category==='personagens'?'Criar NPC':'Novo registro'}</button>}</>}/>
 <FerramentasCategoria query={query} onQuery={setQuery} view={view} onView={setView} order={order} onOrder={setOrder} filters={<div className="cd-filters" role="group" aria-label="Filtros da categoria">{filters.map(f=><button key={f} aria-pressed={filter===f} onClick={()=>setFilter(f)}>{f}</button>)}</div>}/>
 {data.loading&&<p role="status">Carregando registros…</p>}{data.error&&<Aviso erro t={data.error} onRetry={data.refresh}/>}{category==='personagens'&&data.pcError&&<Aviso erro t={data.pcError}/>}
 {!data.loading&&!shown.length&&<p className="muted">{query?'Nenhum resultado para esta pesquisa.':'Nenhum registro disponível nesta categoria.'}</p>}
 <p role="status" className="muted">{shown.length} {shown.length===1?'resultado':'resultados'}{shown.length>limit?` (mostrando ${limit})`:""}</p>
 <CartoesCategoria rows={shown.slice(0,limit)} view={view} onOpen={onOpenContent} listLabel="Resultados do Compêndio"/>{shown.length>limit&&<button className="btn-secondary" onClick={()=>setLimit(v=>v+60)}>Mostrar mais</button>}
 {create&&<EditorConhecimento category={categories[category]} entry={null} onDone={id=>{setCreate(false);data.refresh();if(id)onOpenContent(registroSpec(id));}}/>}
 </div>;
}

import {useEffect,useMemo,useState} from 'react';
import {useCampaigns} from '../CampaignsContext';
import {useAuth} from '../AuthContext';
import {useAventureiros} from '../AventureirosContext';
import type {Aventureiro} from '../inicio';
import {deBlocos} from '../registros';
import {useVersaoRegistros} from '../registrosStore';
import type {TabSpec} from '../workspace';
import {imagemDoMonstro} from '../ficha/imagensCatalogo';
import {useConhecimento,type Conhecimento} from './conhecimento';
import {identidadeSpec,monstroSpec,registroSpec} from './navegacao';
import {normalizar} from '../catalogue/nucleo/busca';
export const nomesCategoria:Record<string,string>={npc:'Personagens',character:'Personagens',monster:'Bestiário',location:'Locais',organization:'Organizações',discovery:'Descobertas',item:'Descobertas'};
export type LinhaCompendio={id:string;title:string;subtitle:string;category:string;body:string;image?:string|null;spec:TabSpec;entry?:Conhecimento;pc?:Aventureiro;filter?:string};
export function useIdentidades(){const source=useAventureiros(),{active}=useCampaigns(),{user}=useAuth(),version=useVersaoRegistros();
 const scope=`${user?.id}:${active?.campaign.id}`;
 const [state,setState]=useState<{scope:string;items:Aventureiro[];error?:string}>();
 useEffect(()=>{let alive=true;if(source&&active)void source.listar(active.campaign.id).then(r=>{if(alive)setState({scope,items:r.ok?r.data:[],error:r.ok?undefined:r.error});},()=>{if(alive)setState({scope,items:[],error:'Não foi possível carregar os personagens.'});});return()=>{alive=false;};},[source,scope,version]);
 return {items:state?.scope===scope?state.items:[],loading:!!source&&state?.scope!==scope,error:state?.scope===scope?state.error:undefined};
}
export function useLinhasCampanha(includeMonsters=false){
 const known=useConhecimento(),pcs=useIdentidades(),{active}=useCampaigns();
 const [monsters,setMonsters]=useState<Awaited<ReturnType<typeof import('../catalogue/contratos').todosOsMonstros>>>([]);
 useEffect(()=>{let alive=true;if(!includeMonsters)return;void import('../catalogue/contratos').then(c=>c.todosOsMonstros()).then(ms=>{if(alive)setMonsters(ms);},()=>{});return()=>{alive=false;};},[includeMonsters]);
 const rows=useMemo<LinhaCompendio[]>(()=>{
  const entries=known.items.map(e=>{
   const m=(active?.role==='mestre'||e.knowledge===4)&&e.systemId==='dnd5e-2014'?monsters.find(x=>x.id===e.definitionId):undefined;
   return {id:e.id,title:e.title,category:e.category,subtitle:e.category==='npc'?['NPC',e.fields?.identity,e.fields?.region].filter(Boolean).join(' · '):e.category==='monster'&&m?`ND ${m.nd} · CA ${m.ca} · PV ${m.pv}`:nomesCategoria[e.category],body:[deBlocos(e.description??[]),...Object.values(e.fields??{}),...(e.relatedTerms??[]),...(m?[m.en,...m.tracos.map(t=>t.n+' '+t.t),...m.acoes.map(a=>a.n+' '+a.t)]:[])].join(' '),spec:registroSpec(e.id,e.title),entry:e,filter:e.category==='npc'?'NPCs':e.category==='monster'?m?.tipo:e.fields?.type};
  });
  const chars=pcs.items.map(p=>({id:p.id,title:p.nome,subtitle:[p.classe,p.alcunha].filter(Boolean).join(' · '),category:'character',body:[p.nome,p.classe,p.alcunha,p.descricao].filter(Boolean).join(' '),image:p.retratoUrl,pc:p,spec:identidadeSpec(p.id,p.nome),filter:'Aventureiros'}));
  const full=active?.role==='mestre'?monsters.filter(m=>!known.items.some(e=>e.category==='monster'&&e.definitionId===m.id&&e.systemId==='dnd5e-2014')).map(m=>({id:'monster-'+m.id,title:m.nome,subtitle:`${m.tipo} · ND ${m.nd}`,category:'monster',body:[m.en,...m.tracos.map(t=>t.n+' '+t.t),...m.acoes.map(a=>a.n+' '+a.t)].join(' '),image:imagemDoMonstro(m.id),spec:monstroSpec(m.id,m.nome),filter:m.tipo})):[];
  return [...chars,...entries,...full];
 },[known.items,pcs.items,monsters,active?.role]);
 return {...known,rows,pcLoading:pcs.loading,pcError:pcs.error};
}
export function pesquisarLinhas(rows:readonly LinhaCompendio[],query:string){const terms=normalizar(query).split(/\s+/).filter(Boolean);return rows.filter(r=>terms.every(t=>normalizar(r.title+' '+r.subtitle+' '+r.body).includes(t)));}

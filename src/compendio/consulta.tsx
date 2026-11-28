import {useEffect,useMemo,useState} from 'react';
import {useCampaigns} from '../CampaignsContext';
import {useModoJogador} from '../modoJogador';
import {useAuth} from '../AuthContext';
import {useAventureiros} from '../AventureirosContext';
import type {Aventureiro} from '../inicio';
import {deBlocos} from '../registros';
import {useVersaoRegistros} from '../registrosStore';
import type {TabSpec} from '../workspace';
import {imagemDoMonstro} from '../ficha/imagensCatalogo';
import {useConhecimento,type Conhecimento} from './conhecimento';
import {filtroDaDescoberta} from './campos';
import {aplicarDaCampanha,useDefinicoes} from './definicoes';
import {identidadeSpec,monstroSpec,npcSpec,regraSpec,registroSpec} from './navegacao';
import {normalizar} from '../catalogue/nucleo/busca';
import {semReferencias} from './referencias';
import {rotuloTamanho,rotuloTipoCriatura} from '../catalogue/sistemas/dnd5e-2014/rotulos';
import {formatarND} from '../catalogue/sistemas/dnd5e-2014/formatar';
export const nomesCategoria:Record<string,string>={npc:'Personagens',character:'Personagens',monster:'Bestiário',location:'Locais',organization:'Organizações',discovery:'Descobertas',item:'Descobertas','catalog-item':'Itens'};
export const nomesRegistro:Record<string,string>={npc:'NPC',character:'Aventureiro',monster:'Criatura',location:'Local',organization:'Organização',discovery:'Descoberta',item:'Item descoberto','catalog-item':'Item do catálogo'};
export type LinhaCompendio={/** Identificação curta mostrada sobre o retrato, na grade. */legenda?:string;/** Linha extra mostrada só na grade. */resumo?:string;/** Mostrada em linha própria sob o nome; nunca entra no subtítulo. */alcunha?:string|null;/** Substitui o rótulo do rodapé do cartão. */rodape?:string;/** Estado do personagem (PV, condições): espaço reservado para as próximas etapas. */estado?:import('react').ReactNode;id:string;title:string;subtitle:string;category:string;body:string;image?:string|null;spec:TabSpec;entry?:Conhecimento;pc?:Aventureiro;filter?:string;/** Ficha técnica acessível direto da lista (só o mestre). */ficha?:TabSpec};
/** O que o clique abre: a ficha de criatura, quando quem olha a recebe (só o mestre); senão, o registro. */
export const alvoDaLinha=(r:Pick<LinhaCompendio,'spec'|'ficha'>):TabSpec=>r.ficha&&r.ficha.kind!=='ficha'?r.ficha:r.spec;
export function useIdentidades(){const source=useAventureiros(),{active}=useCampaigns(),{user}=useAuth(),version=useVersaoRegistros(),previa=useModoJogador().ativa;
 const scope=`${user?.id}:${active?.campaign.id}:${previa}`;
 const [state,setState]=useState<{scope:string;items:Aventureiro[];error?:string}>();
 useEffect(()=>{let alive=true;if(source&&active)void (previa?source.listar:(source.listarTodos??source.listar))(active.campaign.id).then(r=>{if(alive)setState({scope,items:r.ok?r.data:[],error:r.ok?undefined:r.error});},()=>{if(alive)setState({scope,items:[],error:'Não foi possível carregar os personagens.'});});return()=>{alive=false;};},[source,scope,version]);
 return {items:state?.scope===scope?state.items:[],loading:!!source&&state?.scope!==scope,error:state?.scope===scope?state.error:undefined};
}
export function useLinhasCampanha(includeMonsters=false){
 const known=useConhecimento(),pcs=useIdentidades(),{active}=useCampaigns(),definicoes=useDefinicoes(),previa=useModoJogador().ativa;
 // fichas e números só para o mestre fora da prévia: a prévia é a visão do jogador, mesmo com a sessão do mestre
 const mestre=active?.role==='mestre'&&!previa;
 const [padrao,setMonsters]=useState<Awaited<ReturnType<typeof import('../catalogue/contratos').todosOsMonstros>>>([]);
 useEffect(()=>{let alive=true;if(!includeMonsters)return;void import('../catalogue/contratos').then(c=>c.todosOsMonstros()).then(ms=>{if(alive)setMonsters(ms);},()=>{});return()=>{alive=false;};},[includeMonsters]);
 const monsters=useMemo(()=>padrao.length?aplicarDaCampanha('monster',padrao,definicoes.lista):padrao,[padrao,definicoes.lista]);
 const rows=useMemo<LinhaCompendio[]>(()=>{
  const entries=known.items.map(e=>{
   const m=mestre&&e.systemId==='dnd5e-2014'&&e.category==='monster'?monsters.find(x=>x.id===e.definitionId):undefined;
   return {id:e.id,title:e.title,alcunha:e.category==='npc'?e.fields?.nickname:undefined,category:e.category,legenda:e.category==='npc'?[e.fields?.occupation,e.fields?.residence].filter(Boolean).join(' · '):e.category==='monster'?(m?`${rotuloTipoCriatura(m.tipo)} · ${rotuloTamanho(m.tamanho)} · ND ${formatarND(m.nd)}`:''):e.fields?.type,subtitle:e.category==='npc'?['NPC',e.fields?.occupation,e.fields?.residence].filter(Boolean).join(' · '):e.category==='monster'&&m?`ND ${m.nd} · CA ${m.ca} · PV ${m.pv}`:nomesRegistro[e.category],body:[deBlocos(e.description??[]),...Object.values(e.fields??{}),...(e.sheet??[]).map(s=>s.v),...(e.relatedTerms??[]),...(m?[m.en,...m.tracos.map(t=>t.n+' '+t.t),...m.acoes.map(a=>a.n+' '+a.t)]:[])].map(semReferencias).join(' '),spec:registroSpec(e.id,e.title),entry:e,ficha:!mestre?undefined:e.category==='monster'&&e.definitionId?monstroSpec(e.definitionId,e.title):e.characterSheet?{kind:'ficha' as const,ref:e.id,title:e.title}:e.combatDefinitionId?npcSpec(e.id,e.title):undefined,filter:e.category==='npc'?'NPCs':e.category==='monster'?m?.tipo:e.category==='item'||e.category==='discovery'?filtroDaDescoberta(e.category,e.fields?.type):e.fields?.type};
  });
  const chars=pcs.items.map(p=>({id:p.id,title:p.nome,alcunha:p.alcunha,subtitle:[p.situacao==='npc'?'NPC':null,p.classe].filter(Boolean).join(' · '),category:'character',legenda:[p.classe,p.nivel!=null?`nível ${p.nivel}`:null].filter(Boolean).join(' · '),body:[p.nome,p.classe,p.alcunha,p.descricao].filter(Boolean).join(' '),image:p.retratoUrl,pc:p,spec:identidadeSpec(p.id,p.nome),filter:p.situacao==='npc'?'NPCs':p.situacao?'Outros personagens':'Aventureiros'}));
  const full=mestre?monsters.filter(m=>!known.items.some(e=>e.category==='monster'&&e.definitionId===m.id&&e.systemId==='dnd5e-2014')).map(m=>({id:'monster-'+m.id,title:m.nome,subtitle:`${m.tipo} · ND ${m.nd}`,category:'monster',legenda:`${rotuloTipoCriatura(m.tipo)} · ${rotuloTamanho(m.tamanho)} · ND ${formatarND(m.nd)}`,body:[m.en,...m.tracos.map(t=>t.n+' '+t.t),...m.acoes.map(a=>a.n+' '+a.t)].join(' '),image:imagemDoMonstro(m.id),spec:regraSpec('bestiario',m.id,m.nome),ficha:monstroSpec(m.id,m.nome),filter:m.tipo})):[];
  return [...chars,...entries,...full];
 },[known.items,pcs.items,monsters,mestre]);
 return {...known,rows,pcLoading:pcs.loading,pcError:pcs.error};
}
export function pesquisarLinhas(rows:readonly LinhaCompendio[],query:string){const terms=normalizar(query).split(/\s+/).filter(Boolean);return rows.filter(r=>terms.every(t=>normalizar(r.title+' '+r.subtitle+' '+r.body).includes(t)));}

import {useEffect,useMemo,useState} from 'react';
import {useCampaigns} from '../CampaignsContext';
import {sistemaDnd5e2014} from '../catalogue/sistemas/dnd5e-2014';
import {carregarIndice} from '../catalogue/nucleo/registro';
import type {CategoriaDef} from '../catalogue/nucleo/tipos';
import {jogadorPodeAdicionar} from '../catalogue/disponibilidade';
import {itemConhecido} from './conhecimento';
import {pesquisarLinhas,useLinhasCampanha,type LinhaCompendio,nomesCategoria} from './consulta';
import {regraSpec} from './navegacao';
import type {TabSpec} from '../workspace';
import {useAbrirEmAba} from '../abrirEmAba';
type Loaded={cat:CategoriaDef<unknown>;items:readonly unknown[]}[];
export function PesquisaGlobal({query,onQuery,onOpenContent}:{query:string;onQuery:(v:string)=>void;onOpenContent:(s:TabSpec)=>void}){
 const campaign=useLinhasCampanha(!!query.trim()),{active}=useCampaigns(),context=useAbrirEmAba();const [loaded,setLoaded]=useState<Loaded>([]),[error,setError]=useState(false);
 useEffect(()=>{let alive=true;if(!query.trim()||loaded.length)return;setError(false);void Promise.all((sistemaDnd5e2014.categorias as unknown as CategoriaDef<unknown>[]).filter(c=>c.id!=='monstros').map(async cat=>({cat,items:(await carregarIndice(cat)).itens}))).then(v=>{if(alive)setLoaded(v);},()=>{if(alive)setError(true);});return()=>{alive=false;};},[query]);
 const rules=useMemo(()=>loaded.flatMap(({cat,items})=>items.filter(x=>cat.id!=='itens'||active?.role==='mestre'||jogadorPodeAdicionar(cat.idDe(x))||itemConhecido(campaign.items,cat.idDe(x))).map(x=>({id:cat.id+'-'+cat.idDe(x),title:cat.nomeDe(x),subtitle:cat.subtituloDe(x),category:cat.rotulo,body:[cat.corpoDe?.(x),...(cat.nomesAlternativos?.(x)??[])].filter(Boolean).join(' '),spec:cat.id==='magias'?{kind:'magia' as const,ref:cat.idDe(x),title:cat.nomeDe(x)}:cat.id==='itens'?{kind:'item' as const,ref:cat.idDe(x),title:cat.nomeDe(x)}:regraSpec(cat.id,cat.idDe(x),cat.nomeDe(x))}))),[loaded,campaign.items,active?.role]);
 const results=query.trim()?[
  ...pesquisarLinhas(campaign.rows,query).map(row=>({row,area:'Campanha',category:nomesCategoria[row.category]})),
  ...pesquisarLinhas(rules as LinhaCompendio[],query).map(row=>({row,area:'Regras',category:row.category})),
 ]:[];
 const grouped=new Map<string,typeof results>();for(const r of results){const key=r.area+' · '+r.category;grouped.set(key,[...(grouped.get(key)??[]),r]);}
 const [limit,setLimit]=useState(60);useEffect(()=>setLimit(60),[query]);let count=0;
 return <section className="cd-global-search" aria-label="Pesquisa global"><label className="cd-search"><span className="sr-only">Pesquisar em todo o Compêndio</span><input type="search" value={query} placeholder="Pesquisar em todo o Compêndio…" onChange={e=>onQuery(e.target.value)}/></label>{query.trim()&&<div className="cd-global-results"><p role="status">{results.length} resultados{!loaded.length?' · Carregando regras…':''}</p>{(campaign.error||error)&&<p role="alert">A pesquisa está incompleta. Não foi possível carregar parte do conteúdo autorizado.</p>}{[...grouped].map(([group,rs])=>{const shown=rs.slice(0,Math.max(0,limit-count));count+=shown.length;return shown.length?<section key={group}><h2>{group}</h2>{shown.map(({row})=><button className="cd-result" key={row.id} onClick={()=>onOpenContent(row.spec)} onContextMenu={e=>context.aoClicarDireito(e,row.spec)}><strong>{row.title}</strong><small>{row.subtitle}</small></button>)}</section>:null;})}{results.length>limit&&<button className="btn-secondary" onClick={()=>setLimit(v=>v+60)}>Mostrar mais resultados</button>}</div>}</section>;
}

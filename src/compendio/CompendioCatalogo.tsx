import { deBlocos } from '../registros';
/** Catálogo de regras: lista/grade compartilhada; detalhes são páginas do workspace. */
import {useEffect,useMemo,useState} from 'react';
import {useAuth} from '../AuthContext';
import {useCampaigns} from '../CampaignsContext';
import {Aviso} from '../Diario';
import {consultar,type Consulta,type Indice} from '../catalogue/nucleo/busca';
import {carregarIndice,indiceDisponivel} from '../catalogue/nucleo/registro';
import type {CategoriaDef} from '../catalogue/nucleo/tipos';
import {garantirSistemaDnd5e2014,sistemaDnd5e2014} from '../catalogue/sistemas/dnd5e-2014';
import dadosPersonagem from '../criador/data/character-2014.json';
import type {ConsultaRegra} from '../catalogue/sistemas/dnd5e-2014/categorias-consulta';
import {raridadeRotulo} from '../catalogue/srd-2014-items';
import {jogadorPodeAdicionar} from '../catalogue/disponibilidade';
import {imagemDoItem,imagemDoMonstro} from '../ficha/imagensCatalogo';
import type {TabSpec} from '../workspace';
import {itemSpec} from './DetalheItem';
import {EsqueletoLista} from './Esqueleto';
import {useConhecimento,itemConhecido} from './conhecimento';
import {regraSpec,monstroSpec,registroSpec} from './navegacao';
import {CabecalhoCategoria,FerramentasCategoria,CartoesCategoria} from './ComponentesCategoria';
import './compendio-categorias.css';
type Qualquer=CategoriaDef<unknown>;
const PAGINA=60;garantirSistemaDnd5e2014();const categorias=sistemaDnd5e2014.categorias as unknown as Qualquer[];
type Preference={cat:string;query:string;filters:Record<string,string|boolean>;order:string;view:'lista'|'grade';limit:number};
const sessions=new WeakMap<object,Map<string,Preference>>();
export function CompendioCatalogo({onOpenContent,categoriaInicial='itens',onVoltar}:{onOpenContent:(s:TabSpec)=>void;categoriaInicial?:string;onVoltar?:()=>void}){
 const {user,client}=useAuth(),{active}=useCampaigns(),knowledge=useConhecimento();
 const cache=useMemo(()=>{if(!client)return new Map<string,Preference>();let c=sessions.get(client);if(!c){c=new Map();sessions.set(client,c);}return c;},[client]);const key=`${user?.id}:${active?.campaign.id}:${categoriaInicial}`,pref=cache.get(key);
 const [catId,setCatId]=useState(pref?.cat??categoriaInicial),[query,setQuery]=useState(pref?.query??''),[filters,setFilters]=useState<Record<string,string|boolean>>(pref?.filters??{}),[order,setOrder]=useState(pref?.order??''),[view,setView]=useState<'lista'|'grade'>(pref?.view??'lista'),[limit,setLimit]=useState(pref?.limit??PAGINA),[retry,setRetry]=useState(0);
 const cat=categorias.find(c=>c.id===catId)??categorias[0];
 const [loaded,setLoaded]=useState<{cat:Qualquer;index?:Indice<unknown>;error?:string}>(()=>({cat,index:indiceDisponivel(cat)}));
 useEffect(()=>{let alive=true;void carregarIndice(cat).then(index=>{if(alive)setLoaded({cat,index});},()=>{if(alive)setLoaded({cat,error:'Não foi possível carregar '+cat.rotulo.toLocaleLowerCase()+'. Tente novamente.'});});return()=>{alive=false;};},[cat,retry]);
 useEffect(()=>{cache.set(key,{cat:catId,query,filters,order,view,limit});},[key,catId,query,filters,order,view,limit]);
 const index=loaded.cat===cat?loaded.index:indiceDisponivel(cat),error=loaded.cat===cat?loaded.error:undefined;
 const results=useMemo(()=>index?consultar(index,{texto:query,filtros:filters,ordenar:order||undefined} as Consulta).filter(x=>cat.id==='monstros'?active?.role==='mestre':cat.id!=='itens'||active?.role==='mestre'||jogadorPodeAdicionar(cat.idDe(x))||itemConhecido(knowledge.items,cat.idDe(x))):[],[index,query,filters,order,cat,knowledge.items,active?.role]);
 const rowsBase=results.map(item=>{const id=cat.idDe(item),title=cat.nomeDe(item);const entry=cat.id==='monstros'?knowledge.items.find(e=>e.category==='monster'&&e.systemId==='dnd5e-2014'&&e.definitionId===id):undefined;return {id,title:entry?.title??title,entry,subtitle:cat.subtituloDe(item),resumo:cat.resumoDe?.(item),category:cat.id,body:cat.corpoDe?.(item)??'',image:cat.id==='itens'?imagemDoItem(id):cat.id==='monstros'?imagemDoMonstro(id):null,spec:entry?registroSpec(entry.id,entry.title):cat.id==='itens'?itemSpec(id,title):cat.id==='magias'?{kind:'magia' as const,ref:id,title}:cat.id==='monstros'?monstroSpec(id,title):regraSpec(cat.id,id,title)};});
 const customs=cat.id==='monstros'&&active?.role==='mestre'&&index&&!Object.values(filters).some(Boolean)?knowledge.items.filter(e=>e.category==='monster'&&e.systemId==='dnd5e-2014'&&!index.itens.some(x=>cat.idDe(x)===e.definitionId)&&[e.title,deBlocos(e.description??[])].join(' ').toLocaleLowerCase().includes(query.toLocaleLowerCase())).map(e=>({id:e.id,title:e.title,subtitle:'Registro personalizado',category:'monster',body:deBlocos(e.description??[]),entry:e,spec:registroSpec(e.id,e.title)})):[];
 const allRows=[...rowsBase,...customs];const rows=allRows.slice(0,limit);const total=allRows.length;
 const pesquisar=(q:string)=>{setQuery(q);setLimit(PAGINA);};
 const ativos=Object.values(filters).filter(v=>v!==''&&v!==false).length;
 return <div className="content cd-page compendio cat"><CabecalhoCategoria title={cat.id==='monstros'?'Bestiário':cat.rotulo} onBack={onVoltar??(()=>onOpenContent({kind:'secao',ref:'compendio'}))}/>
 {categoriaInicial==='classes'&&<div className="cd-filters" role="group" aria-label="Categorias de classe">{['classes','subclasses'].map(id=><button key={id} aria-pressed={catId===id} onClick={()=>{setCatId(id);setQuery('');setFilters({});setOrder('');setLimit(PAGINA);}}>{id==='classes'?'Classes':'Subclasses'}</button>)}</div>}
 {cat.id==='talentos'&&<p className="muted">Características do SRD utilizadas pelo motor. Esta consulta não é um catálogo completo de talentos de suplementos.</p>}
 <FerramentasCategoria searchLabel="Pesquisar no Compêndio" query={query} onQuery={pesquisar} view={view} onView={setView} order={order} onOrder={setOrder} sortOptions={[{value:'',label:query?'Relevância':'Padrão'},...cat.ordenacoes.map(x=>({value:x.id,label:x.rotulo}))]}/>
 <details className="cat-filtros"><summary>Filtros{ativos>0?` (${ativos} ativo${ativos>1?'s':''})`:''}</summary><div className="cat-filtros-grade">{cat.filtros.map(f=>f.tipo==='selecao'?<label key={f.id}>{f.rotulo}<select aria-label={'Filtrar por '+f.rotulo.toLocaleLowerCase('pt-BR')} value={String(filters[f.id]??'')} onChange={e=>{setFilters(v=>({...v,[f.id]:e.target.value}));setLimit(PAGINA);}}><option value="">Todos</option>{f.opcoes.map(o=><option key={o.valor} value={o.valor}>{o.rotulo}</option>)}</select></label>:<label key={f.id}><input type="checkbox" checked={!!filters[f.id]} onChange={e=>{setFilters(v=>({...v,[f.id]:e.target.checked}));setLimit(PAGINA);}}/>{f.rotulo}</label>)}</div>{ativos>0&&<button type="button" className="btn-secondary" onClick={()=>{setFilters({});setLimit(PAGINA);}}>Limpar filtros</button>}</details>
 {!index&&!error&&<EsqueletoLista rotulo={cat.rotulo} visao={view}/>} {error&&<Aviso erro t={error} onRetry={()=>setRetry(v=>v+1)}/>}
 {index&&<><p role="status" className="muted">{total} {total===1?'resultado':'resultados'}{total>limit?` (mostrando ${limit})`:''}</p>{!total&&<p data-testid="compendio-vazio" className="muted">Nada encontrado. Tente outro termo ou limpe os filtros.</p>}<CartoesCategoria rows={rows} view={view} onOpen={onOpenContent} listLabel="Resultados do Compêndio"/>{total>limit&&<button className="btn-secondary" onClick={()=>setLimit(v=>v+PAGINA)}>Mostrar mais</button>}</>}
 <p className="muted fonte">SRD 5.1 (2014) · CC BY 4.0</p></div>;
}
export function Detalhe({ cat, item }: { cat: Qualquer; item: unknown }) {
  const nome = cat.nomeDe(item);
  return (
    <article
      className="cat-detalhe-conteudo"
      aria-label={`Detalhes de ${nome}`}
    >
      {["origens", "talentos", "regras"].includes(cat.id) && (
        <>
          <p className="muted">{cat.subtituloDe(item)}</p>
          <p style={{ whiteSpace: "pre-line" }}>
            {(item as ConsultaRegra).texto}
          </p>
        </>
      )}
      {["racas", "classes", "subclasses"].includes(cat.id) && (
        <div className="cat-regras-detalhe">
          <p className="muted">{cat.subtituloDe(item)}</p>
          {cat.id === "racas" && (
            <>
              <h2>Características</h2>
              <ul>
                {(item as { traits: { name: string }[] }).traits.map((t, i) => (
                  <li key={i}>
                    {dadosPersonagem.traits.find(
                      (r) =>
                        r.index === t.name.toLowerCase().replaceAll(" ", "-"),
                    )?.name ?? t.name}
                  </li>
                ))}
              </ul>
            </>
          )}
          {cat.id === "classes" && (
            <>
              <h2>Progressão de classe</h2>
              <p>
                Dado de Vida: d
                {(item as { data: { hitDie: number } }).data.hitDie}
              </p>
              <ol>
                {(
                  item as {
                    data: { levels: { level: number; features: string[] }[] };
                  }
                ).data.levels.map((l) => (
                  <li key={l.level}>
                    Nível {l.level}:{" "}
                    {l.features
                      .map(
                        (x) =>
                          dadosPersonagem.features.find((f) => f.id === x)
                            ?.nome ?? x.split("/").pop(),
                      )
                      .join(", ") || "—"}
                  </li>
                ))}
              </ol>
            </>
          )}
          {cat.id === "subclasses" && (
            <p>{(item as { descricao: string }).descricao}</p>
          )}
          <p className="muted">
            Dados do SRD 5.1 (2014). Alguns nomes técnicos ainda estão no idioma
            original.
          </p>
        </div>
      )}
    </article>
  );
}

export { raridadeRotulo };

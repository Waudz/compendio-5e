import {useEffect,useState} from 'react';
import {normalizar} from '../catalogue/nucleo/busca';
import {nomesCategoria,nomesRegistro,type LinhaCompendio} from './consulta';
import {ImagemLinha} from './ComponentesCategoria';
export function pesquisarRegistros(rows:readonly LinhaCompendio[],query:string){
 const terms=normalizar(query).split(/\s+/).filter(Boolean);
 return rows.filter(row=>{const text=normalizar(`${row.title} ${nomesCategoria[row.category]??row.category} ${nomesRegistro[row.category]??''}`);return terms.every(term=>text.includes(term));});
}
/** Só recebe a projeção já autorizada. Não consulta catálogo nem concede conhecimento. */
export function SeletorRegistro({rows,selected,onSelect,query,onQuery,loading=false,error}:{rows:LinhaCompendio[];selected:string;onSelect:(id:string)=>void;query:string;onQuery:(query:string)=>void;loading?:boolean;error?:string}){
 const [limit,setLimit]=useState(40);useEffect(()=>setLimit(40),[query]);
 const results=pesquisarRegistros(rows,query),chosen=rows.find(row=>row.id===selected);
 return <div className="cd-link-picker"><label>Pesquisar registro<input type="search" value={query} placeholder="Nome ou categoria…" onChange={e=>onQuery(e.target.value)}/></label>
 {error?<p role="alert">{error}</p>:loading?<p role="status">Carregando registros…</p>:<><p role="status">{results.length} {results.length===1?'registro disponível':'registros disponíveis'}</p><ul className="cd-link-results" aria-label="Resultados de registros">{results.slice(0,limit).map(row=><li key={row.id}><button type="button" aria-pressed={row.id===selected} onClick={()=>onSelect(row.id)}><ImagemLinha row={row} size={40}/><span><strong>{row.title}</strong>{" "}<small>{nomesRegistro[row.category]??row.category}</small></span></button></li>)}</ul>{!results.length&&<p>Nenhum registro encontrado. Tente outro nome ou categoria.</p>}{results.length>limit&&<button type="button" className="btn-link" onClick={()=>setLimit(n=>n+40)}>Mostrar mais registros</button>}</>}
 {chosen&&<p className="cd-link-selected">Selecionado: <strong>{chosen.title}</strong> <button type="button" className="btn-link" onClick={()=>onSelect('')}>Limpar seleção</button></p>}
 </div>;
}

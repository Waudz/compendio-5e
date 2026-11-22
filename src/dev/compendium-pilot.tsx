/** Development-only catalogue browser; no production rules are claimed. */
import {useMemo,useState} from 'react';
import {searchCompendium,type CompendiumView} from '../rules/compendium-query';
import type {ContentKind} from '../rules/content-registry';
import {criadorRules} from '../criador/catalogo-criador';
const types:{value:ContentKind;label:string}[]=[
 {value:'race',label:'Raças'},{value:'background',label:'Antecedentes'},{value:'class',label:'Classes'},{value:'item',label:'Itens'}];
export default function CompendiumPilot(){
 const [text,setText]=useState(''),[kind,setKind]=useState<ContentKind|''>(''),[view,setView]=useState<CompendiumView>('list');
 const [selected,setSelected]=useState<string|null>(null);
 const rows=useMemo(()=>searchCompendium(criadorRules,{text,kind:kind||undefined}),[text,kind]);
 const active=rows.find(row=>row.key===selected);
 return <main style={{maxWidth:960,margin:'2rem auto',padding:20,fontFamily:'system-ui'}}>
  <h1>Compêndio — piloto de consulta</h1>
  <p>Somente desenvolvimento. Amostra ilustrativa, não catálogo completo nem dados certificados do SRD.</p>
  <div style={{display:'flex',gap:12,flexWrap:'wrap',alignItems:'center'}}>
   <label>Pesquisar <input aria-label="Pesquisar no compêndio" value={text} onChange={e=>setText(e.target.value)}/></label>
   <label>Tipo <select aria-label="Filtrar por tipo" value={kind} onChange={e=>setKind(e.target.value as ContentKind|'')}>
    <option value="">Todos</option>{types.map(t=><option key={t.value} value={t.value}>{t.label}</option>)}
   </select></label>
   <fieldset><legend>Visualização</legend>
    <label><input type="radio" name="view" checked={view==='list'} onChange={()=>setView('list')}/> Lista</label>{' '}
    <label><input type="radio" name="view" checked={view==='grid'} onChange={()=>setView('grid')}/> Grade</label>
   </fieldset>
  </div>
  <p role="status">{rows.length} resultado(s)</p>
  <ul aria-label="Resultados do compêndio" data-view={view}
   style={{listStyle:'none',padding:0,display:'grid',gridTemplateColumns:view==='grid'?'repeat(auto-fit,minmax(200px,1fr))':'1fr',gap:12}}>
   {rows.map(row=><li key={row.key} style={{border:'1px solid #888',borderRadius:8,padding:12}}>
    <button onClick={()=>setSelected(row.key)} aria-label={'Abrir '+row.name}>{row.name}</button>
    <p>{row.description}</p><small>{row.source} · {row.ref.kind} · revisão {row.ref.revision}</small>
   </li>)}
  </ul>
  {active && <section aria-label="Detalhes do conteúdo">
   <h2>{active.name}</h2><p>{active.description}</p><p>Identificador: <code>{active.key}</code></p>
  </section>}
 </main>;
}

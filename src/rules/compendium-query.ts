/** Indexed search of the single canonical rules catalogue.
 * Index is built once per catalogue object, never on every keystroke.
 * Treat catalogue objects as immutable; create a new object when entries change.
 */
import {contentKey,type ContentKind,type ContentRef} from './content-registry';
import {validateRulesCatalogue,type RulesCatalogue} from './rules-catalogue';
export type CompendiumView='list'|'grid';
export type CompendiumRow={key:string;ref:ContentRef;name:string;kind:ContentKind;source:string;description:string};
export type CompendiumQuery={text?:string;kind?:ContentKind;sourceId?:string};
type IndexedRow={row:CompendiumRow;searchText:string};
const cache=new WeakMap<RulesCatalogue,readonly IndexedRow[]>();
const normalize=(value:string)=>value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('pt-BR').trim();
function indexedRows(catalogue:RulesCatalogue):readonly IndexedRow[]{
 const cached=cache.get(catalogue);
 if(cached) return cached;
 validateRulesCatalogue(catalogue);
 const sources=new Map(catalogue.registry.sources.map(s=>[s.id,s.title]));
 const definitions=new Map(catalogue.definitions.map(d=>[contentKey(d.ref),d]));
 const indexed=catalogue.registry.entries.map(entry=>{
  const key=contentKey(entry.ref);
  const source=sources.get(entry.ref.sourceId);
  const definition=definitions.get(key);
  if(!source||!definition) throw new Error('Unresolved catalogue entry: '+key);
  const row:CompendiumRow={key,ref:entry.ref,name:entry.name,kind:entry.ref.kind,
   source,description:definition.description};
  const english=typeof definition.data.en==='string'?definition.data.en:'';   // nome original: pesquisável em inglês sem duplicar a definição
  return {row,searchText:normalize([row.name,english,row.description,row.kind,row.source].join(' '))};
 }).sort((a,b)=>a.row.name.localeCompare(b.row.name,'pt-BR')||a.row.key.localeCompare(b.row.key));
 cache.set(catalogue,indexed);
 return indexed;
}
export function searchCompendium(catalogue:RulesCatalogue,query:CompendiumQuery={}):CompendiumRow[]{
 const term=normalize(query.text??'');
 return indexedRows(catalogue).filter(({row,searchText})=>
  (!query.kind||row.kind===query.kind)&&(!query.sourceId||row.ref.sourceId===query.sourceId)&&
  (!term||searchText.includes(term))).map(({row})=>({...row}));
}

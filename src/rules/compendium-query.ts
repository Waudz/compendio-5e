/** Search and presentation of the single canonical rules catalogue.
 * Presentation never duplicates definitions or relies on translated names as IDs.
 */
import {contentKey, type ContentKind, type ContentRef} from './content-registry';
import {resolveRule, validateRulesCatalogue, type RulesCatalogue} from './rules-catalogue';
export type CompendiumView = 'list'|'grid';
export type CompendiumRow = {key:string;ref:ContentRef;name:string;kind:ContentKind;source:string;description:string};
export type CompendiumQuery = {text?:string;kind?:ContentKind;sourceId?:string};
const normalize=(value:string)=>value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('pt-BR').trim();
export function searchCompendium(catalogue:RulesCatalogue,query:CompendiumQuery={}):CompendiumRow[]{
 validateRulesCatalogue(catalogue);
 const term=normalize(query.text??'');
 return catalogue.registry.entries.filter(e=>(!query.kind||e.ref.kind===query.kind)&&
  (!query.sourceId||e.ref.sourceId===query.sourceId)).map(e=>{
  const resolved=resolveRule(catalogue,e.ref);
  return {key:contentKey(e.ref),ref:e.ref,name:e.name,kind:e.ref.kind,
   source:catalogue.registry.sources.find(s=>s.id===e.ref.sourceId)!.title,
   description:resolved.definition.description};
 }).filter(e=>!term||normalize([e.name,e.description,e.kind,e.source].join(' ')).includes(term))
 .sort((a,b)=>a.name.localeCompare(b.name,'pt-BR')||a.key.localeCompare(b.key));
}

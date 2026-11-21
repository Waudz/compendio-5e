/** Import-time integrity audit for canonical content references.
 * Does not guess which arbitrary data fields contain references: only explicit ContentRef
 * objects inside the optional typed links field are inspected.
 */
import {contentKey,type ContentRef} from './content-registry';
import {validateRulesCatalogue,type RulesCatalogue} from './rules-catalogue';
export type LinkedRule = {owner:ContentRef;targets:ContentRef[]};
export type CatalogueIssue = {code:'missing-target'|'duplicate-link'|'unregistered-owner'|'unlicensed-supplement';key:string};
export function auditCatalogueLinks(catalogue:RulesCatalogue,links:LinkedRule[]):CatalogueIssue[]{
 validateRulesCatalogue(catalogue);
 const known=new Set(catalogue.registry.entries.map(e=>contentKey(e.ref)));
 const issues:CatalogueIssue[]=[];
 for(const source of catalogue.registry.sources)
  if(source.origin==='supplement'&&!source.license?.trim())
   issues.push({code:'unlicensed-supplement',key:source.id});
 for(const link of links){
  const owner=contentKey(link.owner);
  if(!known.has(owner)) issues.push({code:'unregistered-owner',key:owner});
  const seen=new Set<string>();
  for(const target of link.targets){
   const key=contentKey(target);
   if(!known.has(key)) issues.push({code:'missing-target',key:owner+' -> '+key});
   if(seen.has(key)) issues.push({code:'duplicate-link',key:owner+' -> '+key});
   seen.add(key);
  }
 }
 return issues.sort((a,b)=>a.code.localeCompare(b.code)||a.key.localeCompare(b.key));
}

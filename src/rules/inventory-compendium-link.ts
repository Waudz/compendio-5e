import {contentKey,type ContentRef} from './content-registry';
import {searchCompendium,type CompendiumRow} from './compendium-query';
import type {RulesCatalogue} from './rules-catalogue';

/** Resolve inventory item IDs against the same versioned catalogue used by the creator.
 * No name-based lookup: renames must not break existing inventory links.
 */
export function inventoryCompendiumEntry(catalogue:RulesCatalogue,itemId:string):CompendiumRow|null {
 const matches=searchCompendium(catalogue,{kind:'item'});
 const entries=matches.filter(row=>row.ref.id===itemId);
 // An unversioned inventory ID cannot choose between two editions or revisions.
 return entries.length===1?entries[0]:null;
}
export function inventoryCompendiumEntryByRef(catalogue:RulesCatalogue,ref:ContentRef):CompendiumRow|null {
 if(ref.kind!=='item')return null;
 const key=contentKey(ref);
 return searchCompendium(catalogue,{kind:'item'}).find(row=>row.key===key)??null;
}

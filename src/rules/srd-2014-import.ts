/** Offline-first, explicit SRD 2014 import boundary.
 * Only reviewed API records may enter the canonical catalogue.
 * Do not call the API from character sheets; fetch data during a controlled import.
 */
import {contentKey,type ContentKind,type ContentRef,type ContentSource} from './content-registry';
import {validateRulesCatalogue,type RulesCatalogue} from './rules-catalogue';
export const SRD_2014_API_BASE='https://www.dnd5eapi.co/api/2014';
export type Srd2014Collection='races'|'subraces'|'classes'|'subclasses'|'spells'|'equipment'|'features'|'traits';
const kinds:Record<Srd2014Collection,ContentKind>={
 races:'race',subraces:'subrace',classes:'class',subclasses:'subclass',
 spells:'spell',equipment:'item',features:'feature',traits:'trait'
};
export type ReviewedSrdRecord={
 collection:Srd2014Collection;index:string;name:string;description:string;
 data:Record<string,unknown>;reviewed:boolean;
};
const identifier=/^[a-z0-9]+(?:[.-][a-z0-9]+)*$/;
export function srd2014ResourcePath(collection:Srd2014Collection,index:string):string{
 if(!Object.prototype.hasOwnProperty.call(kinds,collection)||!identifier.test(index))
  throw new Error('Invalid SRD 2014 resource identifier');
 return SRD_2014_API_BASE+'/'+collection+'/'+index;
}
export function importReviewedSrd2014(records:ReviewedSrdRecord[],revision:string):RulesCatalogue{
 if(!identifier.test(revision)) throw new Error('Invalid catalogue revision');
 const source:ContentSource={id:'srd-2014',origin:'srd-2014',title:'SRD 5.1 (2014)',ruleset:'5e-2014',
  license:'Source license and attribution must be verified before distribution'};
 const seen=new Set<string>();
 const entries:RulesCatalogue['registry']['entries']=[];
 const definitions:RulesCatalogue['definitions']=[];
 for(const record of records){
  if(!Object.prototype.hasOwnProperty.call(kinds,record.collection)||!identifier.test(record.index)||
    !record.name.trim()||!record.description.trim()||!record.reviewed||
    !record.data||typeof record.data!=='object'||Array.isArray(record.data))
   throw new Error('Unreviewed or malformed SRD 2014 record');
  const ref:ContentRef={sourceId:source.id,kind:kinds[record.collection],id:record.index,revision};
  const key=contentKey(ref);
  if(seen.has(key)) throw new Error('Duplicate imported content: '+key);
  seen.add(key);
  entries.push({ref,name:record.name,ruleset:'5e-2014'});
  definitions.push({ref,description:record.description,data:structuredClone(record.data)});
 }
 const catalogue:RulesCatalogue={registry:{sources:[source],entries},definitions};
 validateRulesCatalogue(catalogue);
 return catalogue;
}

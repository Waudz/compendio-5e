/** Narrative encyclopedia records refer to existing mechanical definitions.
 * Linking a creature or character never copies HP, statistics or inventory into the wiki.
 * The target's own authorization must still be checked by the service/API.
 */
export type EncyclopediaMechanicsLink=
 |{kind:'creature';sourceId:string;creatureId:string;revision:string}
 |{kind:'character';characterId:string};
export type EncyclopediaNarrativeRecord={
 id:string;campaignId:string;kind:'character'|'creature';
 name:string;mechanicsLink:EncyclopediaMechanicsLink|null;
};
export function linkEncyclopediaMechanics(
 record:EncyclopediaNarrativeRecord,
 link:EncyclopediaMechanicsLink|null
):EncyclopediaNarrativeRecord{
 if(!record.id.trim()||!record.campaignId.trim())throw Error('Invalid encyclopedia record');
 if(link){
  if(link.kind==='character'){
   if(record.kind!=='character'||!link.characterId.trim())throw Error('Invalid character reference');
  }else if(link.kind==='creature'){
   if(!link.sourceId.trim()||!link.creatureId.trim()||!link.revision.trim())throw Error('Invalid creature reference');
  }else throw Error('Invalid mechanics reference kind');
 }
 return {...record,mechanicsLink:link?(link.kind==='character'?{kind:'character',characterId:link.characterId}:{kind:'creature',sourceId:link.sourceId,creatureId:link.creatureId,revision:link.revision}):null};
}
/** Remove a link without deleting the narrative entry or the canonical target. */
export function unlinkEncyclopediaMechanics(record:EncyclopediaNarrativeRecord):EncyclopediaNarrativeRecord{
 return {...record,mechanicsLink:null};
}

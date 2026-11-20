import type {EncyclopediaIndexedEntry} from './encyclopedia-query';
import type {EncyclopediaActor,EncyclopediaEntry} from './encyclopedia-visibility';
import {createEncyclopediaNarrativeEntry,changeEncyclopediaNarrativeDiscovery,trashEncyclopediaNarrativeEntry,restoreEncyclopediaNarrativeEntry,queryEncyclopediaNarratives} from './encyclopedia-narrative-service';

/** Local aggregate state machine. No network calls or implicit persistence. */
export type EncyclopediaAction=
 |{type:'create';entry:Omit<EncyclopediaIndexedEntry,'visibility'|'deletedAt'|'deletedBy'>}
 |{type:'discover';entryId:string;next:EncyclopediaEntry['visibility']}
 |{type:'trash';entryId:string;actorUserId:string;at:string}
 |{type:'restore';entryId:string};
export function reduceEncyclopedia(
 records:readonly EncyclopediaIndexedEntry[],actor:EncyclopediaActor,action:EncyclopediaAction
):readonly EncyclopediaIndexedEntry[]{
 if(!actor.isActiveMember||actor.role!=='master')throw Error('Only campaign master may mutate encyclopedia');
 if(action.type==='create'){
  if(action.entry.campaignId!==actor.campaignId||records.some(x=>x.id===action.entry.id))
   throw Error('Invalid encyclopedia entry creation');
  return [...records,createEncyclopediaNarrativeEntry(action.entry)];
 }
 const index=records.findIndex(x=>x.id===action.entryId);
 if(index<0)throw Error('Encyclopedia entry unavailable');
 const current=records[index];
 if(current.campaignId!==actor.campaignId)throw Error('Encyclopedia entry unavailable');
 const updated=action.type==='discover'
  ?changeEncyclopediaNarrativeDiscovery(current,actor,action.next)
  :action.type==='trash'
   ?trashEncyclopediaNarrativeEntry(current,actor,action.actorUserId,action.at)
   :restoreEncyclopediaNarrativeEntry(current,actor);
 return records.map((entry,i)=>i===index?updated:entry);
}
export function readEncyclopediaState(records:readonly EncyclopediaIndexedEntry[],actor:EncyclopediaActor){
 return queryEncyclopediaNarratives(records,actor,{offset:0,limit:100});
}

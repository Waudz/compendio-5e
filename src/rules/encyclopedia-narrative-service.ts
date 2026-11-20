import {encyclopediaPage,type EncyclopediaIndexedEntry} from './encyclopedia-query';
import type {EncyclopediaActor,EncyclopediaEntry} from './encyclopedia-visibility';
import {initialEncyclopediaDiscovery,setEncyclopediaDiscovery} from './encyclopedia-discovery';
import {moveNarrativeToTrash,restoreNarrativeFromTrash} from './encyclopedia-trash';

/** Pure aggregate for narrative records. Caller must enforce auth and transactional persistence. */
export function createEncyclopediaNarrativeEntry(
 entry:Omit<EncyclopediaIndexedEntry,'visibility'|'deletedAt'|'deletedBy'>
):EncyclopediaIndexedEntry{
 const discovery=initialEncyclopediaDiscovery(entry.campaignId,entry.id);
 return {...entry,visibility:discovery.visibility,deletedAt:null,deletedBy:null};
}
export function changeEncyclopediaNarrativeDiscovery(
 entry:EncyclopediaIndexedEntry,actor:EncyclopediaActor,next:EncyclopediaEntry['visibility']
):EncyclopediaIndexedEntry{
 if(entry.deletedAt!==null)throw Error('Cannot reveal trashed encyclopedia entry');
 const changed=setEncyclopediaDiscovery(
  {campaignId:entry.campaignId,entryId:entry.id,visibility:entry.visibility},
  {campaignId:entry.campaignId,entryId:entry.id,next,
   actorCampaignId:actor.campaignId,actorIsMaster:actor.role==='master'&&actor.isActiveMember}
 );
 return {...entry,visibility:changed.visibility};
}
export function trashEncyclopediaNarrativeEntry(
 entry:EncyclopediaIndexedEntry,actor:EncyclopediaActor,actorUserId:string,at:string
):EncyclopediaIndexedEntry{
 assertMaster(actor,entry);
 return moveNarrativeToTrash(entry,actorUserId,at);
}
export function restoreEncyclopediaNarrativeEntry(
 entry:EncyclopediaIndexedEntry,actor:EncyclopediaActor
):EncyclopediaIndexedEntry{
 assertMaster(actor,entry);
 return restoreNarrativeFromTrash(entry);
}
function assertMaster(actor:EncyclopediaActor,entry:EncyclopediaIndexedEntry):void{
 if(!actor.isActiveMember||actor.role!=='master'||actor.campaignId!==entry.campaignId)
  throw Error('Not authorized to manage encyclopedia entry');
}
/** Centralized projection: never return the aggregate directly to players. */
export function queryEncyclopediaNarratives(
 entries:readonly EncyclopediaIndexedEntry[],actor:EncyclopediaActor,
 options:{offset:number;limit:number;query?:string;kind?:EncyclopediaEntry['kind'];includeTrash?:boolean}
){
 return encyclopediaPage(actor,entries,options);
}

/** Campaign encyclopedia discovery contract.
 * Presentation/domain defense in depth: server must derive membership and role from auth/RLS.
 * Never return an undiscovered entry (including its title, ID or count) to players.
 */
export type EncyclopediaKind='creature'|'character'|'place'|'organization'|'knowledge';
export type EncyclopediaVisibility='hidden'|'summary'|'full';
export type EncyclopediaActor={campaignId:string;role:'master'|'player';isActiveMember:boolean};
export type EncyclopediaEntry={
 id:string;campaignId:string;kind:EncyclopediaKind;visibility:EncyclopediaVisibility;
 name:string;summary:string;publicDescription:string;
 /** DM-only fields must never be spread into the player projection. */
 masterNotes:string;mechanics:Readonly<Record<string,unknown>>|null;
 /** Optional for legacy fixtures; trashed entries must never be exposed to players. */
 deletedAt?:string|null;
};
export type EncyclopediaPlayerEntry={
 id:string;kind:EncyclopediaKind;name:string;summary:string;
 publicDescription?:string;
};
export type EncyclopediaMasterEntry=EncyclopediaEntry;
export type EncyclopediaReadResult=
 |{access:'denied'}
 |{access:'master';entry:EncyclopediaMasterEntry}
 |{access:'player';entry:EncyclopediaPlayerEntry};

export function readEncyclopediaEntry(actor:EncyclopediaActor,entry:EncyclopediaEntry):EncyclopediaReadResult{
 if(!actor.isActiveMember||!actor.campaignId||actor.campaignId!==entry.campaignId)return {access:'denied'};
 if(actor.role==='master')return {access:'master',entry};
 // Direct reads must enforce trash visibility too, not only paginated lists.
 if(entry.deletedAt!=null)return {access:'denied'};
 if(actor.role!=='player'||(entry.visibility!=='summary'&&entry.visibility!=='full'))return {access:'denied'};
 const safe:EncyclopediaPlayerEntry={id:entry.id,kind:entry.kind,name:entry.name,summary:entry.summary};
 if(entry.visibility==='full')safe.publicDescription=entry.publicDescription;
 return {access:'player',entry:safe};
}
/** Filter before counting or paginating; hidden entries cannot affect player-facing metadata. */
export function listEncyclopediaEntries(actor:EncyclopediaActor,entries:readonly EncyclopediaEntry[]):readonly (EncyclopediaPlayerEntry|EncyclopediaMasterEntry)[]{
 return entries.flatMap(entry=>{
  const result=readEncyclopediaEntry(actor,entry);
  return result.access==='denied'?[]:[result.entry];
 });
}

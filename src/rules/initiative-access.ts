/** Domain-level initiative access contract.
 * This is defense in depth, NOT a replacement for server-side RLS.
 * Players cannot see initiative, even their own turn or position.
 */
export type InitiativeActor={userId:string;campaignId:string;role:'master'|'player'};
export type InitiativeEncounter={id:string;campaignId:string;round:number;turnIndex:number;combatants:readonly {
 id:string;characterId:string|null;initiative:number;currentHp:number;
}[]};
export type InitiativeReadResult={kind:'allowed';encounter:InitiativeEncounter}|{kind:'forbidden'};
export function readInitiativeForActor(actor:InitiativeActor,encounter:InitiativeEncounter):InitiativeReadResult {
 if(actor.role!=='master'||actor.campaignId!==encounter.campaignId)return {kind:'forbidden'};
 return {kind:'allowed',encounter};
}
export function canManageInitiative(actor:InitiativeActor,campaignId:string):boolean {
 return actor.role==='master'&&actor.campaignId===campaignId;
}
/** No metadata, counts, round number or combatant identities are leaked on denial. */
export function serializeInitiativeForActor(actor:InitiativeActor,encounter:InitiativeEncounter):string|null {
 const access=readInitiativeForActor(actor,encounter);
 return access.kind==='allowed'?JSON.stringify(access.encounter):null;
}

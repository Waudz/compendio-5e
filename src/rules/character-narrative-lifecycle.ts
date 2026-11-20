/** Narrative lifecycle is independent from playable sheet state and discovery. */
export type CharacterNarrativeStatus='active'|'dead'|'retired'|'inactive';
export type CharacterNarrativeRecord={
 characterId:string;campaignId:string;status:CharacterNarrativeStatus;
 /** A campaign record survives changes to its current controller. */
 controllerUserId:string|null;
 history:readonly CharacterNarrativeEvent[];
};
export type CharacterNarrativeEvent={
 id:string;kind:'status-changed'|'controller-changed';
 previous:string|null;next:string|null;
};
export function setCharacterNarrativeStatus(
 record:CharacterNarrativeRecord,next:CharacterNarrativeStatus,eventId:string
):CharacterNarrativeRecord{
 if(!record.characterId.trim()||!record.campaignId.trim()||!eventId.trim())
  throw Error('Invalid character narrative identity');
 if(!(['active','dead','retired','inactive'] as readonly string[]).includes(next))
  throw Error('Invalid narrative status');
 if(record.status===next)return record;
 if(record.history.some(event=>event.id===eventId))throw Error('Duplicate narrative event');
 return {...record,status:next,history:[...record.history,{
  id:eventId,kind:'status-changed' as const,previous:record.status,next
 }]};
}
/** Unassigning a character preserves its campaign history and canonical identity. */
export function setCharacterController(
 record:CharacterNarrativeRecord,nextControllerUserId:string|null,eventId:string
):CharacterNarrativeRecord{
 if(!record.characterId.trim()||!record.campaignId.trim()||!eventId.trim()||
  (nextControllerUserId!==null&&!nextControllerUserId.trim()))
  throw Error('Invalid character controller change');
 if(record.controllerUserId===nextControllerUserId)return record;
 if(record.history.some(event=>event.id===eventId))throw Error('Duplicate narrative event');
 return {...record,controllerUserId:nextControllerUserId,history:[...record.history,{
  id:eventId,kind:'controller-changed' as const,previous:record.controllerUserId,next:nextControllerUserId
 }]};
}

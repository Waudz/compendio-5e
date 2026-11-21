/** Reversible narrative trash. This does not delete canonical character sheets. */
export type NarrativeTrashRecord={
 id:string;campaignId:string;deletedAt:string|null;deletedBy:string|null;
};
export function moveNarrativeToTrash(
 record:NarrativeTrashRecord,actorUserId:string,deletedAt:string
):NarrativeTrashRecord{
 if(!record.id.trim()||!record.campaignId.trim()||!actorUserId.trim()||!Number.isFinite(Date.parse(deletedAt)))
  throw Error('Invalid trash operation');
 if(record.deletedAt!==null)return record;
 return {...record,deletedAt,deletedBy:actorUserId};
}
export function restoreNarrativeFromTrash(record:NarrativeTrashRecord):NarrativeTrashRecord{
 if(record.deletedAt===null)return record;
 return {...record,deletedAt:null,deletedBy:null};
}
/** Permanent deletion is a separate explicit request, never part of routine cleanup. */
export type PermanentDeleteRequest={recordId:string;campaignId:string;confirmedRecordId:string};
export function validatePermanentNarrativeDeletion(record:NarrativeTrashRecord,request:PermanentDeleteRequest):void{
 if(record.deletedAt===null||!record.id.trim()||record.id!==request.recordId||
  record.campaignId!==request.campaignId||request.confirmedRecordId!==record.id)
  throw Error('Permanent deletion requires explicit matching confirmation of a trashed record');
}
export function visibleNarrativeRecords<T extends NarrativeTrashRecord>(records:readonly T[],includeTrash=false):T[]{
 return records.filter(record=>includeTrash?record.deletedAt!==null:record.deletedAt===null);
}

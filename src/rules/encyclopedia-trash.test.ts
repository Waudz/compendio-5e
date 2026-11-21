import {describe,expect,it} from 'vitest';
import {moveNarrativeToTrash,restoreNarrativeFromTrash,validatePermanentNarrativeDeletion,visibleNarrativeRecords,type NarrativeTrashRecord} from './encyclopedia-trash';
const record:NarrativeTrashRecord={id:'npc-1',campaignId:'camp-1',deletedAt:null,deletedBy:null};
describe('encyclopedia narrative trash',()=>{
 it('moves to trash without losing identity or deleting the record',()=>{
  const trashed=moveNarrativeToTrash(record,'dm-1','2026-11-20T20:00:00Z');
  expect(trashed).toMatchObject({id:'npc-1',campaignId:'camp-1',deletedBy:'dm-1'});
  expect(trashed.deletedAt).toBe('2026-11-20T20:00:00Z');
  expect(record.deletedAt).toBeNull();
 });
 it('restores a trashed record without changing its identity',()=>{
  const trashed=moveNarrativeToTrash(record,'dm-1','2026-11-20T20:00:00Z');
  expect(restoreNarrativeFromTrash(trashed)).toEqual(record);
 });
 it('keeps trash separate from active listing',()=>{
  const trashed=moveNarrativeToTrash(record,'dm-1','2026-11-20T20:00:00Z');
  expect(visibleNarrativeRecords([record,trashed])).toEqual([record]);
  expect(visibleNarrativeRecords([record,trashed],true)).toEqual([trashed]);
 });
 it('requires explicit matching confirmation before permanent deletion',()=>{
  const trashed=moveNarrativeToTrash(record,'dm-1','2026-11-20T20:00:00Z');
  expect(()=>validatePermanentNarrativeDeletion(record,{recordId:'npc-1',campaignId:'camp-1',confirmedRecordId:'npc-1'})).toThrow();
  expect(()=>validatePermanentNarrativeDeletion(trashed,{recordId:'npc-1',campaignId:'camp-1',confirmedRecordId:'wrong'})).toThrow();
  expect(()=>validatePermanentNarrativeDeletion(trashed,{recordId:'npc-1',campaignId:'other',confirmedRecordId:'npc-1'})).toThrow();
  expect(()=>validatePermanentNarrativeDeletion(trashed,{recordId:'npc-1',campaignId:'camp-1',confirmedRecordId:'npc-1'})).not.toThrow();
 });
 it('does not automatically purge records or impose an expiry',()=>{
  const trashed=moveNarrativeToTrash(record,'dm-1','2020-01-01T00:00:00Z');
  expect(visibleNarrativeRecords([trashed],true)).toHaveLength(1);
 });
});

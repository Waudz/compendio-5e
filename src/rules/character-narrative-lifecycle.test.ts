import {describe,expect,it} from 'vitest';
import {setCharacterController,setCharacterNarrativeStatus,type CharacterNarrativeRecord} from './character-narrative-lifecycle';
const record:CharacterNarrativeRecord={characterId:'char-1',campaignId:'camp-1',status:'active',controllerUserId:'player-1',history:[]};
describe('campaign character narrative lifecycle',()=>{
 it('tracks death without deleting the character or assigning another controller',()=>{
  const next=setCharacterNarrativeStatus(record,'dead','event-1');
  expect(next.status).toBe('dead');
  expect(next.characterId).toBe('char-1');
  expect(next.controllerUserId).toBe('player-1');
  expect(next.history).toEqual([{id:'event-1',kind:'status-changed',previous:'active',next:'dead'}]);
  expect(record.status).toBe('active');
 });
 it('tracks retirement and inactivity as separate narrative states',()=>{
  const retired=setCharacterNarrativeStatus(record,'retired','event-1');
  expect(setCharacterNarrativeStatus(retired,'inactive','event-2').history).toHaveLength(2);
 });
 it('unassigns a player while retaining the historical campaign identity',()=>{
  const unassigned=setCharacterController(record,null,'event-1');
  expect(unassigned.controllerUserId).toBeNull();
  expect(unassigned.characterId).toBe(record.characterId);
  expect(unassigned.history[0]).toMatchObject({previous:'player-1',next:null});
  expect(setCharacterController(unassigned,'player-2','event-2').controllerUserId).toBe('player-2');
 });
 it('rejects malformed statuses and duplicate event identifiers',()=>{
  expect(()=>setCharacterNarrativeStatus(record,'missing' as never,'event-1')).toThrow();
  const dead=setCharacterNarrativeStatus(record,'dead','event-1');
  expect(()=>setCharacterController(dead,null,'event-1')).toThrow();
 });
 it('does not generate duplicate history for no-op transitions',()=>{
  expect(setCharacterNarrativeStatus(record,'active','event-1')).toBe(record);
  expect(setCharacterController(record,'player-1','event-2')).toBe(record);
 });
});

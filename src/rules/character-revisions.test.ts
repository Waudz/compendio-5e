import {describe,it,expect} from 'vitest';
import {saveCharacterRevision} from './character-revisions';
import type {CharacterDraft} from './character-domain';
const draft:CharacterDraft={
 id:'hero-1',name:'Dorna',ruleset:'5e-2014',catalogueVersion:'catalogue-1',
 baseAbilities:{str:15,dex:12,con:14,int:10,wis:12,cha:8},
 raceId:'race-1',backgroundId:'background-1',classId:'class-1',level:1,
 decisions:[],inventory:[],currentHp:12,temporaryHp:0,spentResources:{}
};
describe('optimistic character revisions',()=>{
 it('creates revision one and increments only with a matching revision',()=>{
  const first=saveCharacterRevision(null,null,draft);
  expect(first.ok).toBe(true);
  if(!first.ok) return;
  const second=saveCharacterRevision(first.record,1,{...draft,name:'Dorna II'});
  expect(second.ok).toBe(true);
  if(!second.ok) return;
  expect(second.record.revision).toBe(2);
  expect(second.record.draft.name).toBe('Dorna II');
  expect(first.record.draft.name).toBe('Dorna');
 });
 it('prevents a stale editor from silently overwriting newer data',()=>{
  const current={revision:3,draft};
  const result=saveCharacterRevision(current,2,{...draft,name:'Stale'});
  expect(result).toEqual({ok:false,reason:'conflict',current});
  expect(current.draft.name).toBe('Dorna');
 });
 it('does not silently recreate missing records or replace another identity',()=>{
  expect(saveCharacterRevision(null,2,draft)).toEqual({ok:false,reason:'missing'});
  expect(saveCharacterRevision({revision:1,draft},1,{...draft,id:'another'}).ok).toBe(false);
 });
});

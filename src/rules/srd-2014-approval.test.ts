import {describe,expect,it} from 'vitest';
import {approveStagedSrd2014,reviewedRecordsForImport} from './srd-2014-approval';
import {stageSrd2014Record} from './srd-2014-staging';
import {importReviewedSrd2014} from './srd-2014-import';
const staged=stageSrd2014Record('classes','fighter',{
 index:'fighter',name:'Fighter',desc:['A martial class'],hit_die:10,
 url:'/api/2014/classes/fighter'},'2026-11-20T15:00:00Z');
const review={reviewer:'editor',reviewedAt:'2026-11-20T16:00:00Z',
 sourceLicense:'license independently checked',confirmsRuleset2014:true,confirmsRedistributionRights:true};
describe('SRD 2014 editorial gate',()=>{
 it('requires explicit approval and produces a versioned catalogue',()=>{
  expect(()=>importReviewedSrd2014([staged],'1')).toThrow('Unreviewed');
  const approval=approveStagedSrd2014(staged,review);
  expect(approval.provenance.provider).toBe('dnd5eapi-2014');
  expect(importReviewedSrd2014(reviewedRecordsForImport([approval]),'1').registry.entries[0].ref.id).toBe('fighter');
 });
 it('rejects unresolved warnings and missing rights confirmation',()=>{
  expect(()=>approveStagedSrd2014({...staged,issues:['Missing feature']},review)).toThrow('unresolved');
  expect(()=>approveStagedSrd2014(staged,{...review,confirmsRedistributionRights:false})).toThrow('redistribution');
  expect(()=>approveStagedSrd2014(staged,{...review,confirmsRuleset2014:false})).toThrow('2014');
  expect(()=>approveStagedSrd2014(staged,{...review,reviewer:' '})).toThrow('approval');
 });
 it('keeps staged data isolated from approved imports',()=>{
  const approval=approveStagedSrd2014(staged,review);
  const records=reviewedRecordsForImport([approval]);
  records[0].data.hit_die=8;
  expect(approval.record.data.hit_die).toBe(10);
  expect(staged.data.hit_die).toBe(10);
 });
});

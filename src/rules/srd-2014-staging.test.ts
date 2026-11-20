import {describe,expect,it} from 'vitest';
import {stageSrd2014Batch,stageSrd2014Record} from './srd-2014-staging';
import {importReviewedSrd2014} from './srd-2014-import';
const fetchedAt='2026-11-20T15:00:00Z';
const fighter={index:'fighter',name:'Fighter',hit_die:10,desc:['A martial class.'],
 url:'/api/2014/classes/fighter'};
describe('2014 API staging',()=>{
 it('stages data with provenance but does not auto-approve publication',()=>{
  const staged=stageSrd2014Record('classes','fighter',fighter,fetchedAt);
  expect(staged.reviewed).toBe(false);
  expect(staged.provenance.url).toBe('https://www.dnd5eapi.co/api/2014/classes/fighter');
  expect(staged.issues).toEqual([]);
  expect(()=>importReviewedSrd2014([staged],'1')).toThrow('Unreviewed');
 });
 it('flags incomplete payloads for review',()=>{
  const staged=stageSrd2014Record('classes','fighter',{index:'fighter',name:'Fighter'},fetchedAt);
  expect(staged.issues).toContain('Description requires editorial review');
  expect(staged.issues).toContain('Class hit die missing or invalid');
 });
 it('rejects mismatched identity, invalid dates and duplicates',()=>{
  expect(()=>stageSrd2014Record('classes','barbarian',fighter,fetchedAt)).toThrow('identity');
  expect(()=>stageSrd2014Record('classes','fighter',fighter,'not-a-date')).toThrow('timestamp');
  expect(()=>stageSrd2014Batch('classes',[fighter,fighter],fetchedAt)).toThrow('Duplicate');
 });
 it('keeps a private snapshot of the raw API payload',()=>{
  const source={...fighter,desc:['Original']};
  const staged=stageSrd2014Record('classes','fighter',source,fetchedAt);
  source.desc[0]='Modified';
  expect(staged.data.desc).toEqual(['Original']);
 });
});

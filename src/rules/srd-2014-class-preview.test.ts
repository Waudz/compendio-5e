import {describe,expect,it} from 'vitest';
import {stageSrd2014Record} from './srd-2014-staging';
import {srd2014ClassPreview} from './srd-2014-class-preview';
const at='2026-11-20T18:00:00Z';
const fighter=stageSrd2014Record('classes','fighter',
 {index:'fighter',name:'Fighter',hit_die:10},at);
describe('SRD 2014 class preview',()=>{
 it('shows class hit die but explicitly prevents character creation',()=>{
  expect(srd2014ClassPreview(fighter)).toEqual({
   id:'fighter',name:'Fighter',hitDie:10,
   sourceUrl:'https://www.dnd5eapi.co/api/2014/classes/fighter',
   canCreateCharacter:false,
   missing:['20-level advancement data','reviewed class feature grants','editorial approval']});
 });
 it('rejects invalid class data and wrong resource types',()=>{
  expect(()=>srd2014ClassPreview({...fighter,data:{...fighter.data,hit_die:0}})).toThrow('Invalid');
  expect(()=>srd2014ClassPreview({...fighter,collection:'races'})).toThrow('Expected');
  expect(()=>srd2014ClassPreview({...fighter,provenance:{...fighter.provenance,url:'https://example.com'}})).toThrow('provenance');
 });
});

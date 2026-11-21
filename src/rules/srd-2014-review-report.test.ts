import {describe,expect,it} from 'vitest';
import {summarizeSrd2014Collection} from './srd-2014-review-report';
import {stageSrd2014Record} from './srd-2014-staging';
const at='2026-11-20T18:00:00Z';
const fighter=stageSrd2014Record('classes','fighter',{index:'fighter',name:'Fighter',hit_die:10},at);
const barbarian=stageSrd2014Record('classes','barbarian',{index:'barbarian',name:'Barbarian',hit_die:12,desc:['Rage']},at);
describe('SRD review report',()=>{
 it('counts unreviewed records and editorial issues',()=>{
  expect(summarizeSrd2014Collection({collection:'classes',expectedCount:2,records:[fighter,barbarian]}))
   .toEqual({collection:'classes',total:2,unreviewed:2,withIssues:1,
    issuesByType:{'Description requires editorial review':1},identifiers:['barbarian','fighter']});
 });
 it('rejects incomplete or mixed collections',()=>{
  expect(()=>summarizeSrd2014Collection({collection:'classes',expectedCount:3,records:[fighter]})).toThrow('Incomplete');
  expect(()=>summarizeSrd2014Collection({collection:'spells',expectedCount:1,records:[fighter]})).toThrow('Mixed');
 });
});

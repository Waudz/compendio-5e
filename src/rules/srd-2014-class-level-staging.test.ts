import {describe,expect,it} from 'vitest';
import {stageSrd2014ClassLevels} from './srd-2014-class-level-staging';
const at='2026-11-20T18:00:00Z';
const levels=Array.from({length:20},(_,i)=>({
 level:i+1,prof_bonus:2+Math.floor(i/4),
 ability_score_bonuses:[4,8,12,16,19].filter(n=>n<=i+1).length*2,
 features:i===0?[{index:'second-wind',name:'Second Wind'}]:[]
}));
describe('2014 class-level staging',()=>{
 it('validates complete progression and keeps it non-playable until reviewed',()=>{
  const staged=stageSrd2014ClassLevels('fighter',levels,at);
  expect(staged.levels).toHaveLength(20);
  expect(staged.levels[0].featureIds).toEqual(['second-wind']);
  expect(staged.levels[19].proficiencyBonus).toBe(6);
  expect(staged.reviewed).toBe(false);
  expect(staged.missing).toContain('reviewed feature effects');
  expect(staged.sourceUrl).toBe('https://www.dnd5eapi.co/api/2014/classes/fighter/levels');
 });
 it('rejects partial and inconsistent progression',()=>{
  expect(()=>stageSrd2014ClassLevels('fighter',levels.slice(0,19),at)).toThrow();
  expect(()=>stageSrd2014ClassLevels('fighter',levels.map((v,i)=>i===4?{...v,prof_bonus:99}:v),at)).toThrow();
  expect(()=>stageSrd2014ClassLevels('fighter',levels,'invalid')).toThrow('provenance');
 });
});

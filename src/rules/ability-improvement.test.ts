import { describe, expect, it } from 'vitest';
import { abilityImprovementGrants, abilityImprovementOptions } from './ability-improvement';
describe('D&D 5e 2014 ability score improvements',()=>{
 it('offers all six +2 and fifteen distinct +1/+1 combinations',()=>{
  const options=abilityImprovementOptions('barbarian-4');
  expect(options).toHaveLength(21);
  expect(new Set(options.map(o=>o.id)).size).toBe(21);
  expect(options.find(o=>o.id==='str-con-plus-one')?.grants).toEqual([
    {type:'ability',ability:'str',amount:1,source:'barbarian-4',max:20},
    {type:'ability',ability:'con',amount:1,source:'barbarian-4',max:20}
  ]);
 });
 it('enforces 2014 ability cap and rejects same ability twice in split',()=>{
  expect(abilityImprovementGrants({kind:'single',ability:'wis'},'asi')).toEqual([
    {type:'ability',ability:'wis',amount:2,source:'asi',max:20}
  ]);
  expect(()=>abilityImprovementGrants({kind:'split',first:'str',second:'str'},'asi')).toThrow();
  expect(()=>abilityImprovementGrants({kind:'single',ability:'bad' as 'str'},'asi')).toThrow();
 });
});

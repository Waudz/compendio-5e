import { describe, expect, it } from 'vitest';
import { coreClassAsiAdvancements, coreClassAsiLevels, type CoreClass } from './class-asi-2014';
import { evaluateAdvancements } from './character-advancement';
const classes: CoreClass[]=['barbarian','bard','cleric','druid','fighter','monk','paladin','ranger','rogue','sorcerer','warlock','wizard'];
describe('2014 core class ASI advancement schedule',()=>{
 it('covers twelve classes and the fighter/rogue exceptions',()=>{
  for(const id of classes){
   const levels=coreClassAsiLevels(id);
   expect(levels).toEqual([...levels].sort((a,b)=>a-b));
   expect(new Set(levels).size).toBe(levels.length);
   expect(levels.every(l=>l>=1&&l<=20)).toBe(true);
  }
  expect(coreClassAsiLevels('fighter')).toEqual([4,6,8,12,14,16,19]);
  expect(coreClassAsiLevels('rogue')).toEqual([4,8,10,12,16,19]);
  expect(coreClassAsiLevels('barbarian')).toEqual([4,8,12,16,19]);
 });
 it('offers 21 options at each ASI and only prompts for levels already reached',()=>{
  for(const id of classes){
   const advancements=coreClassAsiAdvancements(id);
   expect(advancements.every(a=>a.choices?.[0].options.length===21)).toBe(true);
   for(let level=1;level<=20;level++){
    const result=evaluateAdvancements(advancements,level,[]);
    expect(result.pending.length).toBe(coreClassAsiLevels(id).filter(l=>l<=level).length);
   }
  }
 });
 it('applies selected ASI only after level and keeps choice IDs stable',()=>{
  const entries=coreClassAsiAdvancements('fighter');
  const decision=[{choiceId:'fighter-asi-6',optionIds:['str-con-plus-one']}];
  expect(evaluateAdvancements(entries,5,decision).grants).toHaveLength(0);
  expect(evaluateAdvancements(entries,6,decision).grants).toEqual([
   {type:'ability',ability:'str',amount:1,source:'fighter-asi-6',max:20},
   {type:'ability',ability:'con',amount:1,source:'fighter-asi-6',max:20}
  ]);
 });
});

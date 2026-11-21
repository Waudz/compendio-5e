import {describe,expect,it} from 'vitest';
import {pointBuySpent,validatePointBuy,isStandardArray} from './ability-generation-2014';
const scores={str:15,dex:12,con:14,int:10,wis:12,cha:8};
describe('2014 ability generation',()=>{
 it('calculates point-buy cost and respects the 27-point budget',()=>{
  expect(pointBuySpent(scores)).toBe(26);
  expect(()=>validatePointBuy(scores)).not.toThrow();
  expect(()=>validatePointBuy({...scores,cha:10})).toThrow('Point-buy budget exceeded');
 });
 it('rejects invalid scores instead of accepting out-of-range or fractional values',()=>{
  for(const invalid of [7,16,10.5,NaN,Infinity])
   expect(()=>pointBuySpent({...scores,str:invalid})).toThrow();
 });
 it('recognizes any permutation of the six standard-array scores',()=>{
  expect(isStandardArray({str:8,dex:10,con:12,int:13,wis:14,cha:15})).toBe(true);
  expect(isStandardArray(scores)).toBe(false);
 });
});

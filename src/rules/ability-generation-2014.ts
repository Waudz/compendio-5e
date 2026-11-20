/** D&D 5e 2014 point buy: 27 points, scores 8–15 before racial bonuses. */
import type {Abilities,Ability} from './character-build-pilot';
export const POINT_BUY_BUDGET=27;
export const POINT_BUY_COSTS:Readonly<Record<number,number>>={8:0,9:1,10:2,11:3,12:4,13:5,14:7,15:9};
export const STANDARD_ARRAY=[15,14,13,12,10,8] as const;
export const ABILITY_ORDER:Ability[]=['str','dex','con','int','wis','cha'];
export function pointBuySpent(scores:Abilities):number {
 let spent=0;
 for(const key of ABILITY_ORDER){
  const score=scores[key];
  if(!Number.isSafeInteger(score)||!Object.prototype.hasOwnProperty.call(POINT_BUY_COSTS,score))
   throw new Error('Point-buy scores must be integers between 8 and 15');
  spent+=POINT_BUY_COSTS[score];
 }
 return spent;
}
export function validatePointBuy(scores:Abilities):void {
 if(pointBuySpent(scores)>POINT_BUY_BUDGET)throw new Error('Point-buy budget exceeded');
}
export function isStandardArray(scores:Abilities):boolean {
 return ABILITY_ORDER.map(key=>scores[key]).sort((a,b)=>a-b).join(',')===
  [...STANDARD_ARRAY].sort((a,b)=>a-b).join(',');
}

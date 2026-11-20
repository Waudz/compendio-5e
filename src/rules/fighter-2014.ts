/** Fighter 2014 SRD 5.1, reviewed level features; development pilot only.
 * Source: https://media.wizards.com/2023/downloads/dnd/SRD_CC_v5.1.pdf
 * SRD 5.1 CC BY 4.0. Mechanical effects requiring combat context are exposed as features,
 * not silently applied as numerical bonuses.
 */
import type {ClassDefinition,Grant} from './character-build-pilot';
import type {Advancement} from './character-advancement';
import {coreClassAsiAdvancements} from './class-asi-2014';

export const fighter2014:ClassDefinition={
 id:'fighter',
 levels:Array.from({length:20},(_,index)=>{
  const level=index+1;
  const grants:Grant[]=[];
  const feature=(id:string)=>grants.push({type:'feature',feature:id,source:'fighter-'+level});
  if(level===1){feature('fighting-style');feature('second-wind');grants.push({type:'resource',resource:'second-wind',uses:1,source:'fighter-1'});}
  if(level===2){feature('action-surge');grants.push({type:'resource',resource:'action-surge',uses:1,source:'fighter-2'});}
  if(level===5||level===11||level===20)feature('extra-attack-'+(level===5?2:level===11?3:4));
  if(level===9){feature('indomitable');grants.push({type:'resource',resource:'indomitable',uses:1,source:'fighter-9'});}
  if(level===13)grants.push({type:'resource',resource:'indomitable',uses:2,source:'fighter-13'});
  if(level===17){grants.push({type:'resource',resource:'action-surge',uses:2,source:'fighter-17'});grants.push({type:'resource',resource:'indomitable',uses:3,source:'fighter-17'});}
  return {level,hitDie:10,grants};
 })
};
export const fighter2014Advancements:Advancement[]=[
 {id:'fighter-style-1',level:1,grants:[],choices:[{id:'fighter-style-1',level:1,count:1,
  options:['archery','defense','dueling','great-weapon-fighting','protection','two-weapon-fighting']
   .map(id=>({id,grants:[{type:'feature' as const,feature:'fighting-style-'+id,source:'fighter-style-1'}]}))}]},
 {id:'fighter-archetype-3',level:3,grants:[],choices:[{id:'fighter-archetype-3',level:3,count:1,
  options:[{id:'champion',grants:[{type:'feature',feature:'champion-improved-critical',source:'fighter-archetype-3'}]}]}]},
 ...coreClassAsiAdvancements('fighter')
];

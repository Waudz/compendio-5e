import {describe,it,expect} from 'vitest';
import {buildCharacter,type Abilities,type ClassDefinition,type Option} from './character-build-pilot';

const stats:Abilities={str:15,dex:13,con:14,int:10,wis:12,cha:8};
const dwarf:Option={id:'hill-dwarf-2014',grants:[
  {type:'ability',ability:'con',amount:2,source:'hill-dwarf'},
  {type:'ability',ability:'wis',amount:1,source:'hill-dwarf'},
  {type:'feature',feature:'dwarven-toughness',source:'hill-dwarf'}
]};
const acolyte:Option={id:'acolyte-2014',grants:[
  {type:'skill',skill:'insight',source:'acolyte'},{type:'skill',skill:'religion',source:'acolyte'},
  {type:'item',item:'incense',quantity:5,source:'acolyte'},
],choices:[{id:'acolyte-languages',count:2,options:[
  {type:'language',language:'elvish',source:'acolyte'},
  {type:'language',language:'draconic',source:'acolyte'},
  {type:'language',language:'gnomish',source:'acolyte'}
]}]};
const barbarian:ClassDefinition={id:'barbarian-2014',levels:Array.from({length:20},(_,i)=>{
  const level=i+1;
  const rage=level===20?null:level>=17?6:level>=12?5:level>=6?4:level>=3?3:2;
  const grants:ClassDefinition['levels'][number]['grants']=[
    {type:'resource',resource:'rage',uses:rage,source:'barbarian-level-'+level}];
  if(level===1)grants.push({type:'feature',feature:'rage',source:'barbarian-1'},
    {type:'feature',feature:'unarmored-defense',source:'barbarian-1'});
  if(level===2)grants.push({type:'feature',feature:'reckless-attack',source:'barbarian-2'});
  if(level===20)grants.push({type:'ability',ability:'str',amount:4,max:24,source:'primal-champion'},
    {type:'ability',ability:'con',amount:4,max:24,source:'primal-champion'});
  return {level,hitDie:12,grants};
})};
function build(level:number,selected:Record<string,number[]>={'acolyte-languages':[0,1]}){
  return buildCharacter({baseAbilities:stats,race:dwarf,background:acolyte,classDef:barbarian,level,selected});
}
describe('2014 character creation pilot: actual instances and level transitions',()=>{
  it('creates hill dwarf barbarian acolyte at level 1 with grants and provenance',()=>{
    const c=build(1);
    expect(c.abilities.con).toBe(16);
    expect(c.skills).toEqual(['insight','religion']);
    expect(c.languages).toEqual(['elvish','draconic']);
    expect(c.items).toEqual([{item:'incense',quantity:5}]);
    expect(c.resources.rage).toBe(2);
    expect(c.maxHp).toBe(15);
    expect(c.provenance.some(g=>g.source==='hill-dwarf')).toBe(true);
    expect(c.pending).toEqual([]);
  });
  it('rebuilds every level 1–20 deterministically, without duplicating grants',()=>{
    for(let level=1;level<=20;level++){
      const a=build(level),b=build(level);
      expect(a).toEqual(b);
      expect(a.maxHp).toBeGreaterThanOrEqual(level);
      expect(a.resources.rage).toBe(level===20?null:level>=17?6:level>=12?5:level>=6?4:level>=3?3:2);
      expect(a.skills).toHaveLength(2);
      expect(a.items[0].quantity).toBe(5);
    }
  });
  it('reports missing choices and rejects duplicate or invalid selections',()=>{
    expect(build(1,{}).pending).toEqual(['acolyte-languages']);
    expect(build(1,{'acolyte-languages':[0,0]}).pending).toEqual(['acolyte-languages']);
    expect(build(1,{'acolyte-languages':[0,99]}).pending).toEqual(['acolyte-languages']);
  });
  it('never mutates input abilities or selected options',()=>{
    const before=JSON.stringify(stats);
    build(20);build(1);
    expect(JSON.stringify(stats)).toBe(before);
    expect(build(1).abilities.str).toBe(15);
    expect(build(20).abilities.str).toBe(19);
    expect(build(20).abilities.con).toBe(20);
  });
  it('rejects incomplete progressions, invalid levels and impossible hit dice',()=>{
    expect(()=>build(21)).toThrow('Invalid level');
    expect(()=>buildCharacter({baseAbilities:stats,race:dwarf,background:acolyte,classDef:{...barbarian,levels:barbarian.levels.slice(0,19)},level:1,selected:{}})).toThrow('Incomplete class progression');
    expect(()=>buildCharacter({baseAbilities:stats,race:dwarf,background:acolyte,classDef:barbarian,level:2,selected:{'acolyte-languages':[0,1]},hpRolls:[13]})).toThrow('Invalid HP roll');
  });
});

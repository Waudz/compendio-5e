import {describe,expect,it} from 'vitest';
import {coreClassAsiAdvancements} from './class-asi-2014';
import {addInventoryInstance,changeInventoryInstanceQuantity} from './character-domain';
import {buildPilotCharacterCatalog} from './character-catalogue-adapter';
import {createCharacterSheet,type CharacterDraft} from './character-domain';
import type {RulesCatalogue} from './rules-catalogue';
const sourceId='srd-2014';
const race={sourceId,kind:'race' as const,id:'dwarf',revision:'1'};
const background={sourceId,kind:'background' as const,id:'acolyte',revision:'1'};
const klass={sourceId,kind:'class' as const,id:'fighter',revision:'1'};
const definitions=[
 {ref:race,description:'Dwarf',data:{id:'dwarf',grants:[{type:'ability',ability:'con',amount:2,source:'dwarf'}]}},
 {ref:background,description:'Acolyte',data:{id:'acolyte',grants:[]}},
 {ref:klass,description:'Fighter',data:{id:'fighter',levels:Array.from({length:20},(_,i)=>({level:i+1,hitDie:10,grants:[]}))}}
];
const catalogue:RulesCatalogue={registry:{
 sources:[{id:sourceId,origin:'srd-2014',title:'SRD 2014',ruleset:'5e-2014'}],
 entries:definitions.map(d=>({ref:d.ref,name:d.description,ruleset:'5e-2014' as const}))
},definitions};
describe('canonical Compendium to character kernel integration',()=>{
 it('builds a level-one dwarf fighter from the same versioned definitions',()=>{
  const {catalog,ids}=buildPilotCharacterCatalog(catalogue,{race,background,class:klass});
  const draft:CharacterDraft={id:'hero-1',name:'Dorna',ruleset:'5e-2014',catalogueVersion:catalog.version,
   baseAbilities:{str:15,dex:12,con:14,int:10,wis:12,cha:8},
   raceId:ids.raceId,backgroundId:ids.backgroundId,classId:ids.classId,
   level:1,decisions:[],inventory:[],currentHp:12,temporaryHp:0,spentResources:{}};
  const sheet=createCharacterSheet(draft,catalog);
  expect(sheet.abilities.con).toBe(16);
  expect(sheet.maxHp).toBe(13);
  expect(sheet.pending).toEqual([]);
  expect(ids.classId).toContain('srd-2014:class:fighter:1');
  expect(createCharacterSheet({...draft,name:'Renamed'},catalog).maxHp).toBe(13);
 });
 it('refuses incorrect revisions and incomplete definitions',()=>{
  expect(()=>buildPilotCharacterCatalog(catalogue,{race:{...race,revision:'2'},background,class:klass}))
   .toThrow('Unknown rule revision');
  const invalid={...catalogue,definitions:definitions.map(d=>d.ref.kind==='class'?{...d,data:{id:'fighter',levels:[]}}:d)};
  expect(()=>buildPilotCharacterCatalog(invalid,{race,background,class:klass}))
   .toThrow('Incomplete or invalid character rules definition');
 });
 it('advances the same fighter from level 1 to 4 and tracks independent item copies',()=>{
  const {catalog,ids}=buildPilotCharacterCatalog(catalogue,{race,background,class:klass},
    coreClassAsiAdvancements('fighter'));
  const base:CharacterDraft={id:'hero-2',name:'Dorna',ruleset:'5e-2014',catalogueVersion:catalog.version,
   baseAbilities:{str:15,dex:12,con:14,int:10,wis:12,cha:8},
   raceId:ids.raceId,backgroundId:ids.backgroundId,classId:ids.classId,
   level:1,decisions:[],inventory:[],currentHp:12,temporaryHp:0,spentResources:{}};
  expect(createCharacterSheet(base,catalog).pending).toEqual([]);
  const atFour=createCharacterSheet({...base,level:4},catalog);
  expect(atFour.pending).toEqual(['fighter-asi-4']);
  const selected={...base,level:4,decisions:[{id:'fighter-asi-4',optionIds:['str-plus-two']}]};
  const sheet=createCharacterSheet(selected,catalog);
  expect(sheet.abilities.str).toBe(17);
  expect(sheet.pending).toEqual([]);
  const first=addInventoryInstance(selected,{id:'sword-1',itemId:'longsword',quantity:1,equipped:true,origin:'acquired'});
  const second=addInventoryInstance(first,{id:'sword-2',itemId:'longsword',quantity:1,equipped:false,origin:'acquired'});
  const changed=changeInventoryInstanceQuantity(second,'sword-2',2);
  expect(createCharacterSheet(changed,catalog).inventory.map(x=>x.quantity)).toEqual([1,3]);
  expect(createCharacterSheet(changed,catalog).abilities.str).toBe(17);
 });

});

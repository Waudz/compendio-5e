import {describe,expect,it} from 'vitest';
import {fighter2014,fighter2014Advancements} from './fighter-2014';
import {buildPilotCharacterCatalog} from './character-catalogue-adapter';
import {createCharacterSheet,type CharacterDraft} from './character-domain';
import {criadorRefs,criadorRules} from '../criador/catalogo-criador';
const {catalog,ids}=buildPilotCharacterCatalog(criadorRules,criadorRefs,fighter2014Advancements);
const base:CharacterDraft={
 id:'fighter-hero',name:'Guerreira',ruleset:'5e-2014',catalogueVersion:catalog.version,
 baseAbilities:{str:15,dex:12,con:14,int:10,wis:12,cha:8},
 raceId:ids.raceId,backgroundId:ids.backgroundId,classId:ids.classId,
 level:1,decisions:[{id:'fighter-style-1',optionIds:['defense']},{id:'fighter-skills-1',optionIds:['athletics','perception']}],
 inventory:[],currentHp:13,temporaryHp:0,spentResources:{}
};
describe('SRD 5.1 Fighter vertical integration',()=>{
 it('has a 20-level d10 table, matching SRD 2014 breakpoints',()=>{
  expect(fighter2014.levels).toHaveLength(20);
  expect(fighter2014.levels.every(level=>level.hitDie===10)).toBe(true);
  const features=(level:number)=>createCharacterSheet({...base,level},catalog).features;
  expect(features(1)).toContain('second-wind');
  expect(features(2)).toContain('action-surge');
  expect(features(5)).toContain('extra-attack-2');
  expect(features(11)).toContain('extra-attack-3');
  expect(features(20)).toContain('extra-attack-4');
  expect(createCharacterSheet({...base,level:17},catalog).resources['action-surge'].maximum).toBe(2);
  expect(createCharacterSheet({...base,level:13},catalog).resources.indomitable.maximum).toBe(2);
 });
 it('requires fighting style, archetype and fighter ASIs when unlocked',()=>{
  expect(createCharacterSheet({...base,decisions:[]},catalog).pending).toContain('fighter-style-1');
  expect(createCharacterSheet({...base,decisions:[]},catalog).pending).toContain('fighter-skills-1');
  expect(createCharacterSheet(base,catalog).skills).toContain('athletics');
  expect(createCharacterSheet({...base,level:3},catalog).pending).toContain('fighter-archetype-3');
  expect(createCharacterSheet({...base,level:4},catalog).pending).toContain('fighter-asi-4');
  const chosen={...base,level:4,decisions:[...base.decisions,
   {id:'fighter-archetype-3',optionIds:['champion']},
   {id:'fighter-asi-4',optionIds:['str-plus-two']}]};
  const sheet=createCharacterSheet(chosen,catalog);
  expect(sheet.pending).toEqual([]);
  expect(sheet.abilities.str).toBe(17);
  expect(sheet.features).toContain('champion-improved-critical');
 });
});

import {describe,expect,it} from 'vitest';
import {pilotRefs,pilotRules} from './pilot-rules';
import {searchCompendium} from '../rules/compendium-query';
import {buildPilotCharacterCatalog} from '../rules/character-catalogue-adapter';
import {coreClassAsiAdvancements} from '../rules/class-asi-2014';
import {createCharacterSheet,type CharacterDraft} from '../rules/character-domain';
describe('one canonical rules source for creator and Compendium',()=>{
 it('uses identical versioned references and rules for display and character calculation',()=>{
  const {catalog,ids}=buildPilotCharacterCatalog(pilotRules,pilotRefs,coreClassAsiAdvancements('fighter'));
  const raceRow=searchCompendium(pilotRules,{kind:'race'})[0];
  expect(raceRow.key).toBe(ids.raceId);
  const draft:CharacterDraft={id:'hero-1',name:'Dorna',ruleset:'5e-2014',catalogueVersion:catalog.version,
   raceId:ids.raceId,backgroundId:ids.backgroundId,classId:ids.classId,
   baseAbilities:{str:15,dex:12,con:14,int:10,wis:12,cha:8},
   level:1,decisions:[],inventory:[],currentHp:12,temporaryHp:0,spentResources:{}};
  expect(createCharacterSheet(draft,catalog).abilities.con).toBe(16);
  const renamed={...pilotRules,registry:{...pilotRules.registry,entries:pilotRules.registry.entries.map(e=>
   e.ref.id==='dwarf'?{...e,name:'Anão renomeado'}:e)}};
  expect(searchCompendium(renamed,{text:'renomeado'})[0].key).toBe(ids.raceId);
  expect(createCharacterSheet(draft,catalog).abilities.con).toBe(16);
 });
});

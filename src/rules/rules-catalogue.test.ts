import {describe,expect,it} from 'vitest';
import {resolveCharacterRules,resolveRule,validateRulesCatalogue,type RulesCatalogue} from './rules-catalogue';
const ref={id:'fighter',kind:'class' as const,sourceId:'srd-2014',revision:'1'};
const catalogue: RulesCatalogue={
 registry:{sources:[{id:'srd-2014',origin:'srd-2014',title:'SRD 2014',ruleset:'5e-2014'}],
 entries:[{ref,name:'Fighter',ruleset:'5e-2014'}]},
 definitions:[{ref,description:'Fighter class',data:{hitDie:10,asiLevels:[4,6,8,12,14,16,19]}}]
};
describe('single-source versioned rules catalogue',()=>{
 it('resolves the same rule revision for Compendium and creator',()=>{
  validateRulesCatalogue(catalogue);
  const compendium=resolveRule(catalogue,ref);
  const creator=resolveCharacterRules(catalogue,{characterId:'hero',selected:[ref]})[0];
  expect(creator.definition).toBe(compendium.definition);
  expect(creator.entry).toBe(compendium.entry);
 });
 it('refuses missing and duplicate definitions',()=>{
  expect(()=>validateRulesCatalogue({...catalogue,definitions:[]})).toThrow('Missing rule definition');
  expect(()=>validateRulesCatalogue({...catalogue,definitions:[...catalogue.definitions,...catalogue.definitions]})).toThrow('Duplicate rule definition');
 });
 it('does not silently substitute a newer catalogue revision',()=>{
  expect(()=>resolveRule(catalogue,{...ref,revision:'2'})).toThrow('Unknown rule revision');
  expect(()=>resolveCharacterRules(catalogue,{characterId:'hero',selected:[ref,ref]})).toThrow('Duplicate character rule reference');
 });
});

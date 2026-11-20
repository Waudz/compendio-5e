import {describe,expect,it} from 'vitest';
import {localizeCatalogue} from './catalogue-localization';
import {searchCompendium} from './compendium-query';
import {resolveRule,type RulesCatalogue} from './rules-catalogue';
const ref={sourceId:'srd-2014',kind:'class' as const,id:'fighter',revision:'1'};
const original:RulesCatalogue={registry:{sources:[{id:'srd-2014',origin:'srd-2014',title:'SRD 2014',ruleset:'5e-2014'}],
 entries:[{ref,name:'Fighter',ruleset:'5e-2014'}]},definitions:[{ref,description:'Martial class',data:{hitDie:10}}]};
describe('catalogue localization',()=>{
 it('translates search labels but preserves immutable references and rules',()=>{
  const localized=localizeCatalogue(original,[{ref,locale:'pt-BR',name:'Guerreiro',description:'Classe marcial'}],'pt-BR');
  expect(searchCompendium(localized,{text:'guerreiro'})[0].key).toBe('srd-2014:class:fighter:1');
  expect(resolveRule(localized,ref).definition.data.hitDie).toBe(10);
  expect(searchCompendium(original,{text:'fighter'})).toHaveLength(1);
  expect(searchCompendium(localized,{text:'fighter'})).toHaveLength(0);
 });
 it('falls back to source language when translation is absent',()=>{
  expect(searchCompendium(localizeCatalogue(original,[],'pt-BR'))[0].name).toBe('Fighter');
 });
 it('rejects duplicate, unknown and empty translations',()=>{
  const translation={ref,locale:'pt-BR' as const,name:'Guerreiro'};
  expect(()=>localizeCatalogue(original,[translation,translation],'pt-BR')).toThrow('Duplicate');
  expect(()=>localizeCatalogue(original,[{...translation,ref:{...ref,id:'unknown'}}],'pt-BR')).toThrow('unknown');
  expect(()=>localizeCatalogue(original,[{...translation,name:' '}],'pt-BR')).toThrow('Invalid');
 });
});

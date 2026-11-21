import {describe,expect,it} from 'vitest';
import {searchCompendium} from './compendium-query';
import {resolveRule,type RulesCatalogue} from './rules-catalogue';
const source={id:'srd-2014',origin:'srd-2014' as const,title:'SRD 2014',ruleset:'5e-2014' as const};
const ref=(kind:'race'|'item',id:string,revision:string)=>({sourceId:'srd-2014',kind,id,revision});
const dwarf=ref('race','dwarf','1'),sword=ref('item','longsword','1');
const catalogue:RulesCatalogue={registry:{sources:[source],entries:[
 {ref:dwarf,name:'Anão',ruleset:'5e-2014'},
 {ref:sword,name:'Espada longa',ruleset:'5e-2014'}]},
 definitions:[{ref:dwarf,description:'Resistência anã',data:{speed:25}},
 {ref:sword,description:'Arma marcial',data:{damage:'1d8'}}]};
describe('canonical Compendium query',()=>{
 it('searches accent-insensitively, filters by kind, and keeps immutable keys',()=>{
  expect(searchCompendium(catalogue,{text:'anao'}).map(x=>x.key)).toEqual(['srd-2014:race:dwarf:1']);
  expect(searchCompendium(catalogue,{kind:'item'}).map(x=>x.name)).toEqual(['Espada longa']);
  expect(searchCompendium(catalogue,{text:'arma marcial'})).toHaveLength(1);
 });
 it('renaming a display label does not break rule resolution',()=>{
  const renamed:RulesCatalogue={...catalogue,registry:{...catalogue.registry,entries:catalogue.registry.entries.map(e=>
   e.ref.id==='dwarf'?{...e,name:'Anão da montanha'}:e)}};
  expect(searchCompendium(renamed,{text:'montanha'})[0].key).toBe('srd-2014:race:dwarf:1');
  expect(resolveRule(renamed,dwarf).definition.data.speed).toBe(25);
 });
 it('supports source filters and reuses a catalogue index without leaking display edits',()=>{
  expect(searchCompendium(catalogue,{sourceId:'srd-2014'})).toHaveLength(2);
  expect(searchCompendium(catalogue,{sourceId:'other'})).toHaveLength(0);
  const first=searchCompendium(catalogue,{text:'anao'});
  first[0].name='Edited outside';
  expect(searchCompendium(catalogue,{text:'anao'})[0].name).toBe('Anão');
  const renamed:RulesCatalogue={...catalogue,registry:{...catalogue.registry,
   entries:catalogue.registry.entries.map(e=>e.ref.id==='dwarf'?{...e,name:'Anão novo'}:e)}};
  expect(searchCompendium(renamed,{text:'novo'})).toHaveLength(1);
  expect(searchCompendium(catalogue,{text:'novo'})).toHaveLength(0);
 });
 it('rejects missing definitions rather than silently showing partial content',()=>{
  expect(()=>searchCompendium({...catalogue,definitions:[]})).toThrow('Missing rule definition');
 });
});

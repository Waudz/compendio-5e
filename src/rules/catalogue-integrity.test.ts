import {describe,it,expect} from 'vitest';
import {auditCatalogueLinks} from './catalogue-integrity';
import type {RulesCatalogue} from './rules-catalogue';
const owner={sourceId:'srd-2014',kind:'class' as const,id:'fighter',revision:'1'};
const item={sourceId:'srd-2014',kind:'item' as const,id:'longsword',revision:'1'};
const catalogue:RulesCatalogue={registry:{sources:[
 {id:'srd-2014',origin:'srd-2014',title:'SRD',ruleset:'5e-2014'},
 {id:'book',origin:'supplement',title:'Example book',publisher:'Example',ruleset:'5e-2014'}
 ],entries:[{ref:owner,name:'Guerreiro',ruleset:'5e-2014'},
 {ref:item,name:'Espada longa',ruleset:'5e-2014'}]},
 definitions:[{ref:owner,description:'Classe',data:{}},{ref:item,description:'Item',data:{}}]};
describe('catalogue import integrity',()=>{
 it('accepts valid versioned references',()=>{
  const licensed={...catalogue,registry:{...catalogue.registry,sources:catalogue.registry.sources.map(s=>
   s.id==='book'?{...s,license:'permission-recorded'}:s)}};
  expect(auditCatalogueLinks(licensed,[{owner,targets:[item]}])).toEqual([]);
 });
 it('reports missing revisions, duplicate links and missing owner',()=>{
  const issues=auditCatalogueLinks(catalogue,[{owner,targets:[item,item,{...item,revision:'2'}]},
   {owner:{...owner,id:'missing'},targets:[]}]);
  expect(issues.map(i=>i.code)).toEqual(expect.arrayContaining([
   'missing-target','duplicate-link','unregistered-owner','unlicensed-supplement']));
 });
 it('rejects broken core catalogue before import audit',()=>{
  expect(()=>auditCatalogueLinks({...catalogue,definitions:[]},[])).toThrow('Missing rule definition');
 });
});

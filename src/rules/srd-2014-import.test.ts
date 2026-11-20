import {describe,expect,it} from 'vitest';
import {importReviewedSrd2014,srd2014ResourcePath,type ReviewedSrdRecord} from './srd-2014-import';
import {searchCompendium} from './compendium-query';
const fighter:ReviewedSrdRecord={collection:'classes',index:'fighter',name:'Guerreiro',
 description:'Classe SRD 2014 revisada',reviewed:true,data:{hit_die:10}};
describe('SRD 2014 reviewed import boundary',()=>{
 it('maps reviewed classes into the same catalogue used by Compendium',()=>{
  const imported=importReviewedSrd2014([fighter],'1');
  expect(searchCompendium(imported,{kind:'class'})[0].key).toBe('srd-2014:class:fighter:1');
  expect(imported.definitions[0].data.hit_die).toBe(10);
  expect(srd2014ResourcePath('classes','fighter')).toBe('https://www.dnd5eapi.co/api/2014/classes/fighter');
 });
 it('rejects unreviewed data, invalid IDs and duplicate records',()=>{
  expect(()=>importReviewedSrd2014([{...fighter,reviewed:false}],'1')).toThrow('Unreviewed');
  expect(()=>importReviewedSrd2014([fighter,fighter],'1')).toThrow('Duplicate');
  expect(()=>importReviewedSrd2014([fighter],'bad revision')).toThrow('revision');
  expect(()=>srd2014ResourcePath('classes','../2024')).toThrow('Invalid');
 });
 it('does not share mutable payload objects with the source',()=>{
  const source={...fighter,data:{hit_die:10}};
  const imported=importReviewedSrd2014([source],'1');
  source.data.hit_die=8;
  expect(imported.definitions[0].data.hit_die).toBe(10);
 });
});

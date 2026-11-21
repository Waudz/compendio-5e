import {describe,expect,it} from 'vitest';
import {stageSrd2014Record} from './srd-2014-staging';
import {approveStagedSrd2014} from './srd-2014-approval';
import {buildApprovedSrd2014Snapshot} from './srd-2014-publication';
import {readOfflineCatalogueSnapshot} from './offline-catalogue-snapshot';
import {searchCompendium} from './compendium-query';
const at='2026-11-20T18:00:00Z';
const review={reviewer:'editor',reviewedAt:at,sourceLicense:'verified-test-license',
 confirmsRuleset2014:true,confirmsRedistributionRights:true};
const fighter=approveStagedSrd2014(stageSrd2014Record('classes','fighter',
 {index:'fighter',name:'Fighter',desc:['Martial hero'],hit_die:10},at),review);
describe('approved SRD publication pipeline',()=>{
 it('publishes approved 2014 data that can be searched offline',()=>{
  const snapshot=buildApprovedSrd2014Snapshot([fighter],{revision:'v1',createdAt:at});
  const catalogue=readOfflineCatalogueSnapshot(JSON.parse(JSON.stringify(snapshot)));
  expect(searchCompendium(catalogue,{text:'fighter'}).map(row=>row.ref.id)).toEqual(['fighter']);
  expect(snapshot.provenance.reviewedBy).toBe('editor');
  expect(snapshot.catalogue.definitions[0].data.hit_die).toBe(10);
 });
 it('rejects empty catalogues and invalid approvals',()=>{
  expect(()=>buildApprovedSrd2014Snapshot([],{revision:'v1',createdAt:at})).toThrow('empty');
  expect(()=>buildApprovedSrd2014Snapshot([{...fighter,record:{...fighter.record,reviewed:false}}],
   {revision:'v1',createdAt:at})).toThrow('approval');
  expect(()=>buildApprovedSrd2014Snapshot([{...fighter,provenance:{...fighter.provenance,url:'https://example.org'}}],
   {revision:'v1',createdAt:at})).toThrow('provenance');
 });
 it('rejects duplicates and mixed licenses',()=>{
  expect(()=>buildApprovedSrd2014Snapshot([fighter,fighter],{revision:'v1',createdAt:at})).toThrow('Duplicate');
  expect(()=>buildApprovedSrd2014Snapshot([fighter,{
   ...fighter,record:{...fighter.record,index:'barbarian'},
   provenance:{...fighter.provenance,url:'https://www.dnd5eapi.co/api/2014/classes/barbarian'},
   review:{...review,sourceLicense:'other-license'}
  }],{revision:'v1',createdAt:at})).toThrow('Mixed');
 });
});

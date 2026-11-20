import {describe,expect,it} from 'vitest';
import {createOfflineCatalogueSnapshot,readOfflineCatalogueSnapshot} from './offline-catalogue-snapshot';
import {searchCompendium} from './compendium-query';
import {criadorRules} from '../criador/catalogo-criador';
const meta={catalogueRevision:'1',createdAt:'2026-11-20T18:00:00Z',
 source:'SRD 2014 fixture',license:'Test-only fixture',reviewedBy:'Automated test'};
describe('offline catalogue snapshot',()=>{
 it('round-trips a local snapshot into the shared Compendium search',()=>{
  const snapshot=createOfflineCatalogueSnapshot(criadorRules,meta);
  const restored=readOfflineCatalogueSnapshot(JSON.parse(JSON.stringify(snapshot)));
  expect(searchCompendium(restored,{kind:'class'}).map(x=>x.name)).toEqual(['Guerreiro']);
  expect(snapshot.entryKeys).toHaveLength(criadorRules.registry.entries.length);
 });
 it('rejects tampered indices, revisions and missing provenance',()=>{
  const snapshot=createOfflineCatalogueSnapshot(criadorRules,meta);
  expect(()=>readOfflineCatalogueSnapshot({...snapshot,entryKeys:[]})).toThrow('index');
  expect(()=>readOfflineCatalogueSnapshot({...snapshot,catalogueRevision:'2'})).toThrow('index mismatch');
  expect(()=>readOfflineCatalogueSnapshot({...snapshot,provenance:{...snapshot.provenance,license:''}})).toThrow('metadata');
 });
 it('does not allow caller mutations to change snapshot source',()=>{
  const snapshot=createOfflineCatalogueSnapshot(criadorRules,meta);
  const restored=readOfflineCatalogueSnapshot(snapshot);
  restored.registry.entries[0].name='Changed';
  expect(snapshot.catalogue.registry.entries[0].name).toBe('Anão');
 });
});

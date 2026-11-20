import {describe,expect,it} from 'vitest';
import {inventoryCompendiumEntry,inventoryCompendiumEntryByRef} from './inventory-compendium-link';
import {pilotRules,pilotRefs} from '../dev/pilot-rules';
describe('inventory to compendium link',()=>{
 it('resolves an item by stable ID and exact versioned reference',()=>{
  expect(inventoryCompendiumEntry(pilotRules,'longsword')?.name).toBe('Espada longa');
  expect(inventoryCompendiumEntryByRef(pilotRules,pilotRefs.item)?.key).toBe('srd-2014:item:longsword:1');
 });
 it('does not resolve missing items or non-item refs',()=>{
  expect(inventoryCompendiumEntry(pilotRules,'unknown')).toBeNull();
  expect(inventoryCompendiumEntryByRef(pilotRules,pilotRefs.class)).toBeNull();
 });
 it('rejects ambiguous IDs instead of silently selecting an edition',()=>{
  const extra={sourceId:'other-edition',kind:'item' as const,id:'longsword',revision:'1'};
  const catalogue={...pilotRules,
   registry:{...pilotRules.registry,sources:[...pilotRules.registry.sources,{id:'other-edition',origin:'srd-2014' as const,title:'Outra edição',ruleset:'5e-2014' as const}],
    entries:[...pilotRules.registry.entries,{ref:extra,name:'Espada longa alternativa',ruleset:'5e-2014' as const}]},
   definitions:[...pilotRules.definitions,{ref:extra,description:'Outra versão',data:{id:'longsword'}}]
  };
  expect(inventoryCompendiumEntry(catalogue,'longsword')).toBeNull();
  expect(inventoryCompendiumEntryByRef(catalogue,pilotRefs.item)?.name).toBe('Espada longa');
 });
});

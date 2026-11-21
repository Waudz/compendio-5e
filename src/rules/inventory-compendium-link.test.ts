import {describe,expect,it} from 'vitest';
import {inventoryCompendiumEntry,inventoryCompendiumEntryByRef} from './inventory-compendium-link';
import {criadorRules,criadorRefs} from '../criador/catalogo-criador';
describe('inventory to compendium link',()=>{
 it('resolves an item by stable ID and exact versioned reference',()=>{
  expect(inventoryCompendiumEntry(criadorRules,'longsword')?.name).toBe('Espada longa');
  expect(inventoryCompendiumEntryByRef(criadorRules,criadorRefs.item)?.key).toBe('srd-2014:item:longsword:1');
 });
 it('does not resolve missing items or non-item refs',()=>{
  expect(inventoryCompendiumEntry(criadorRules,'unknown')).toBeNull();
  expect(inventoryCompendiumEntryByRef(criadorRules,criadorRefs.class)).toBeNull();
 });
 it('rejects ambiguous IDs instead of silently selecting an edition',()=>{
  const extra={sourceId:'other-edition',kind:'item' as const,id:'longsword',revision:'1'};
  const catalogue={...criadorRules,
   registry:{...criadorRules.registry,sources:[...criadorRules.registry.sources,{id:'other-edition',origin:'srd-2014' as const,title:'Outra edição',ruleset:'5e-2014' as const}],
    entries:[...criadorRules.registry.entries,{ref:extra,name:'Espada longa alternativa',ruleset:'5e-2014' as const}]},
   definitions:[...criadorRules.definitions,{ref:extra,description:'Outra versão',data:{id:'longsword'}}]
  };
  expect(inventoryCompendiumEntry(catalogue,'longsword')).toBeNull();
  expect(inventoryCompendiumEntryByRef(catalogue,criadorRefs.item)?.name).toBe('Espada longa');
 });
});

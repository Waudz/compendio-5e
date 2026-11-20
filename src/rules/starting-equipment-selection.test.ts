import {describe,it,expect} from 'vitest';
import {applyStartingEquipmentSelection,replaceStartingEquipmentSelection} from './starting-equipment-selection';
import type {CharacterDraft} from './character-domain';
const base={inventory:[]} as unknown as CharacterDraft;
const known=new Set(['backpack','torch','longsword']);
const choice={sourceId:'fighter-pack',optionId:'explorer',components:[{itemId:'backpack',quantity:1},{itemId:'torch',quantity:10}]};
describe('unified starting equipment choices',()=>{
 it('grants separate inventory instances and is idempotent',()=>{
  const first=applyStartingEquipmentSelection(base,choice,known);
  expect(first.inventory).toHaveLength(2);
  expect(first.inventory[1]).toMatchObject({itemId:'torch',quantity:10,origin:'starting'});
  expect(applyStartingEquipmentSelection(first,choice,known)).toBe(first);
 });
 it('does not overwrite previously modified starting equipment or acquired items',()=>{
  const first=applyStartingEquipmentSelection(base,choice,known);
  const edited={...first,inventory:[...first.inventory.map(x=>x.itemId==='torch'?{...x,quantity:8}:x),
   {id:'acquired:longsword',itemId:'longsword',quantity:1,equipped:false,origin:'acquired' as const}]};
  expect(()=>applyStartingEquipmentSelection(edited,choice,known)).toThrow('confirm replacement');
  expect(edited.inventory[2].itemId).toBe('longsword');
 });
 it('replaces untouched starting equipment only with confirmation, preserving acquisitions',()=>{
  const original=applyStartingEquipmentSelection(base,choice,known);
  const acquired={...original,inventory:[...original.inventory,{id:'acquired:longsword',itemId:'longsword',quantity:1,equipped:false,origin:'acquired' as const}]};
  const next={...choice,optionId:'alternate',components:[{itemId:'torch',quantity:2}]};
  expect(()=>replaceStartingEquipmentSelection(acquired,choice,next,known,false)).toThrow('confirmation');
  const replaced=replaceStartingEquipmentSelection(acquired,choice,next,known,true);
  expect(replaced.inventory).toHaveLength(2);
  expect(replaced.inventory.find(item=>item.origin==='acquired')?.itemId).toBe('longsword');
  expect(replaced.inventory.find(item=>item.origin==='starting')?.quantity).toBe(2);
  const edited={...original,inventory:original.inventory.map(item=>item.itemId==='torch'?{...item,quantity:9}:item)};
  expect(()=>replaceStartingEquipmentSelection(edited,choice,next,known,true)).toThrow('edited');
 });
 it('rejects unknown catalogue items and duplicate components',()=>{
  expect(()=>applyStartingEquipmentSelection(base,{...choice,components:[{itemId:'fake',quantity:1}]},known)).toThrow('Unknown catalogue item');
  expect(()=>applyStartingEquipmentSelection(base,{...choice,components:[{itemId:'torch',quantity:1},{itemId:'torch',quantity:2}]},known)).toThrow('Invalid equipment selection components');
 });
});

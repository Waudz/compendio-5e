import {describe,expect,it} from 'vitest';
import {adventuringPacks2014,expandEquipmentBundle,fighterStartingEquipment2014} from './starting-equipment-2014';
describe('2014 adventuring pack recipes',()=>{
 it('expands explorer pack to eight separate item references with correct quantities',()=>{
  const components=expandEquipmentBundle(adventuringPacks2014.explorer);
  expect(components).toHaveLength(8);
  expect(components.find(x=>x.itemId==='torch')?.quantity).toBe(10);
  expect(components.find(x=>x.itemId==='rations')?.quantity).toBe(10);
  expect(components.find(x=>x.itemId==='hempen-rope-50-feet')?.quantity).toBe(1);
 });
 it('expands dungeoneer pack with pitons and crowbar but no bedroll',()=>{
  const components=expandEquipmentBundle(adventuringPacks2014.dungeoneer);
  expect(components.find(x=>x.itemId==='piton')?.quantity).toBe(10);
  expect(components.some(x=>x.itemId==='crowbar')).toBe(true);
  expect(components.some(x=>x.itemId==='bedroll')).toBe(false);
 });
 it('does not mutate shared recipe when the inventory changes',()=>{
  const components=expandEquipmentBundle(adventuringPacks2014.explorer);
  components[0].quantity=99;
  expect(adventuringPacks2014.explorer.components[0].quantity).toBe(1);
 });
 it('provides all four Fighter equipment choice groups',()=>{
  expect(Object.values(fighterStartingEquipment2014).every(x=>x.length===2)).toBe(true);
 });
});

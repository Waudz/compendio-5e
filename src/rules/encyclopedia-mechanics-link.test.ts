import {describe,expect,it} from 'vitest';
import {linkEncyclopediaMechanics,unlinkEncyclopediaMechanics,type EncyclopediaNarrativeRecord} from './encyclopedia-mechanics-link';
const npc:EncyclopediaNarrativeRecord={id:'npc-1',campaignId:'camp-1',kind:'character',name:'Guarda da vila',mechanicsLink:null};
describe('encyclopedia mechanical references',()=>{
 it('links a narrative NPC to a versioned generic creature without duplicating statistics',()=>{
  const linked=linkEncyclopediaMechanics(npc,{kind:'creature',sourceId:'srd-2014',creatureId:'guard',revision:'1'});
  expect(linked.mechanicsLink).toEqual({kind:'creature',sourceId:'srd-2014',creatureId:'guard',revision:'1'});
  expect(JSON.stringify(linked)).not.toMatch(/currentHp|armorClass|inventory|challengeRating/);
  expect(npc.mechanicsLink).toBeNull();
 });
 it('links an existing character by stable identity without copying their sheet',()=>{
  const linked=linkEncyclopediaMechanics(npc,{kind:'character',characterId:'char-7'});
  expect(linked.mechanicsLink).toEqual({kind:'character',characterId:'char-7'});
 });
 it('rejects malformed links and incompatible character targets',()=>{
  expect(()=>linkEncyclopediaMechanics(npc,{kind:'creature',sourceId:'',creatureId:'guard',revision:'1'})).toThrow();
  expect(()=>linkEncyclopediaMechanics({...npc,kind:'creature'},{kind:'character',characterId:'char-7'})).toThrow();
  expect(()=>linkEncyclopediaMechanics(npc,{kind:'character',characterId:' '})).toThrow();
 });
 it('unlinks mechanics while preserving narrative and target data',()=>{
  const linked=linkEncyclopediaMechanics(npc,{kind:'creature',sourceId:'srd-2014',creatureId:'commoner',revision:'1'});
  expect(unlinkEncyclopediaMechanics(linked)).toEqual(npc);
 });
});

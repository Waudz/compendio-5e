import { describe, expect, it } from 'vitest';
import { applyCustodyAction, canViewEncyclopediaEntry, type CharacterCustody } from './character-custody';
const initial: CharacterCustody = { characterId:'hero',creatorUserId:'a',personalLibraryUserId:'a',campaignId:null,controllerUserId:null,role:'pc',life:'alive',campaignStatus:null,version:0,history:[] };
const ctx=(actorUserId:string,expectedVersion:number,isCampaignMaster=false)=>({actorUserId,expectedVersion,isCampaignMaster,at:'2026-11-20T12:00:00Z'});
describe('character custody and campaign encyclopedia',()=>{
 it('keeps one identity through joining, death, personal removal, NPC conversion',()=>{
  const joined=applyCustodyAction(initial,{type:'join',campaignId:'festival'},ctx('a',0));
  const dead=applyCustodyAction(joined,{type:'die'},ctx('a',1));
  const released=applyCustodyAction(dead,{type:'release-personal'},ctx('a',2));
  expect(released).toMatchObject({characterId:'hero',campaignId:'festival',life:'dead',controllerUserId:null,personalLibraryUserId:null});
  const npc=applyCustodyAction(released,{type:'convert-to-npc'},ctx('gm',3,true));
  expect(npc).toMatchObject({characterId:'hero',role:'npc',life:'dead',version:4});
  expect(npc.history.map(e=>e.type)).toEqual(['joined','died','released','converted-to-npc']);
  expect(initial.history).toEqual([]);
 });
 it('prevents a character from joining a second campaign',()=>{
  const joined=applyCustodyAction(initial,{type:'join',campaignId:'festival'},ctx('a',0));
  expect(()=>applyCustodyAction(joined,{type:'join',campaignId:'another'},ctx('a',1))).toThrow();
 });
 it('requires GM authorization and explicit recipient acceptance for reassignment',()=>{
  const joined=applyCustodyAction(initial,{type:'join',campaignId:'festival'},ctx('a',0));
  const released=applyCustodyAction(joined,{type:'release-personal'},ctx('a',1));
  const action={type:'assign' as const,newControllerUserId:'b',acceptedByUserId:'b'};
  expect(()=>applyCustodyAction(released,action,ctx('a',2))).toThrow();
  expect(()=>applyCustodyAction(released,{...action,acceptedByUserId:'c'},ctx('gm',2,true))).toThrow('Recipient acceptance');
  expect(applyCustodyAction(released,action,ctx('gm',2,true))).toMatchObject({controllerUserId:'b',personalLibraryUserId:'b',creatorUserId:'a'});
 });
 it('rejects stale updates, unauthorized release, and assignment of occupied characters',()=>{
  expect(()=>applyCustodyAction(initial,{type:'release-personal'},ctx('b',0))).toThrow();
  expect(()=>applyCustodyAction(initial,{type:'join',campaignId:'festival'},ctx('a',1))).toThrow('Stale');
  const joined=applyCustodyAction(initial,{type:'join',campaignId:'festival'},ctx('a',0));
  expect(()=>applyCustodyAction(joined,{type:'assign',newControllerUserId:'b',acceptedByUserId:'b'},ctx('gm',1,true))).toThrow();
 });
 it('separates secret GM encyclopedia entries from campaign-member entries',()=>{
  const entry={characterId:'hero',campaignId:'festival',title:'Hero',biography:'',historical:true,visibility:'gm-only' as const};
  expect(canViewEncyclopediaEntry(entry,true,false)).toBe(false);
  expect(canViewEncyclopediaEntry({...entry,visibility:'campaign-members'},true,false)).toBe(true);
  expect(canViewEncyclopediaEntry(entry,false,true)).toBe(true);
  expect(canViewEncyclopediaEntry({...entry,visibility:'campaign-members'},false,false)).toBe(false);
 });
});

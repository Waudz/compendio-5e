import {describe,expect,it} from 'vitest';
import {reduceEncyclopedia,readEncyclopediaState} from './encyclopedia-state';
const master={campaignId:'camp-a',role:'master' as const,isActiveMember:true};
const player={campaignId:'camp-a',role:'player' as const,isActiveMember:true};
const entry={id:'npc-a',campaignId:'camp-a',kind:'character' as const,name:'Viajante',summary:'Visto no porto',publicDescription:'Tem um manto',masterNotes:'Cultista',mechanics:{hp:44}};
describe('encyclopedia state machine',()=>{
 it('runs create, reveal, trash, restore while preserving private boundaries',()=>{
  const created=reduceEncyclopedia([],master,{type:'create',entry});
  expect(readEncyclopediaState(created,player).total).toBe(0);
  const revealed=reduceEncyclopedia(created,master,{type:'discover',entryId:'npc-a',next:'full'});
  expect(readEncyclopediaState(revealed,player).total).toBe(1);
  expect(JSON.stringify(readEncyclopediaState(revealed,player))).not.toMatch(/Cultista|mechanics|hp/);
  const trashed=reduceEncyclopedia(revealed,master,{type:'trash',entryId:'npc-a',actorUserId:'dm',at:'2026-11-20T00:00:00Z'});
  expect(readEncyclopediaState(trashed,player).total).toBe(0);
  const restored=reduceEncyclopedia(trashed,master,{type:'restore',entryId:'npc-a'});
  expect(readEncyclopediaState(restored,player).total).toBe(1);
  expect(created[0].visibility).toBe('hidden');
 });
 it('rejects player mutations, duplicate identities and cross-campaign writes',()=>{
  const created=reduceEncyclopedia([],master,{type:'create',entry});
  expect(()=>reduceEncyclopedia(created,player,{type:'discover',entryId:'npc-a',next:'full'})).toThrow();
  expect(()=>reduceEncyclopedia(created,master,{type:'create',entry})).toThrow();
  expect(()=>reduceEncyclopedia(created,{...master,campaignId:'camp-b'},{type:'restore',entryId:'npc-a'})).toThrow();
 });
 it('does not mutate existing records on failed actions',()=>{
  const created=reduceEncyclopedia([],master,{type:'create',entry});
  expect(()=>reduceEncyclopedia(created,master,{type:'discover',entryId:'missing',next:'full'})).toThrow();
  expect(created[0].visibility).toBe('hidden');
 });
});

it('rejects an unknown action instead of restoring a trashed entry',()=>{
 const created=reduceEncyclopedia([],master,{type:'create',entry});
 const trashed=reduceEncyclopedia(created,master,{type:'trash',entryId:'npc-a',actorUserId:'dm',at:'2026-11-20T00:00:00Z'});
 expect(()=>reduceEncyclopedia(trashed,master,{type:'unknown',entryId:'npc-a'} as unknown as {type:'restore';entryId:string})).toThrow();
 expect(trashed[0].deletedAt).not.toBeNull();
});

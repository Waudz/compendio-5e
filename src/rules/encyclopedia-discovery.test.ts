import {describe,expect,it} from 'vitest';
import {initialEncyclopediaDiscovery,setEncyclopediaDiscovery} from './encyclopedia-discovery';
describe('encyclopedia discovery editing',()=>{
 const initial=initialEncyclopediaDiscovery('camp-a','npc-a');
 it('creates entries hidden by default',()=>{expect(initial.visibility).toBe('hidden')});
 it('allows the campaign master to reveal and hide entries explicitly',()=>{
  const command={campaignId:'camp-a',entryId:'npc-a',actorCampaignId:'camp-a',actorIsMaster:true};
  const summary=setEncyclopediaDiscovery(initial,{...command,next:'summary'});
  expect(summary.visibility).toBe('summary');
  const full=setEncyclopediaDiscovery(summary,{...command,next:'full'});
  expect(full.visibility).toBe('full');
  expect(setEncyclopediaDiscovery(full,{...command,next:'hidden'}).visibility).toBe('hidden');
  expect(initial.visibility).toBe('hidden');
 });
 it('rejects players and masters from other campaigns',()=>{
  const command={campaignId:'camp-a',entryId:'npc-a',actorCampaignId:'camp-a',actorIsMaster:true,next:'full' as const};
  expect(()=>setEncyclopediaDiscovery(initial,{...command,actorIsMaster:false})).toThrow();
  expect(()=>setEncyclopediaDiscovery(initial,{...command,actorCampaignId:'camp-b'})).toThrow();
 });
 it('rejects cross-entry changes and malformed imported discovery',()=>{
  const command={campaignId:'camp-a',entryId:'npc-a',actorCampaignId:'camp-a',actorIsMaster:true,next:'full' as const};
  expect(()=>setEncyclopediaDiscovery(initial,{...command,entryId:'npc-b'})).toThrow();
  expect(()=>setEncyclopediaDiscovery(initial,{...command,next:'public' as never})).toThrow();
 });
});

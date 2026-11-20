import {describe,expect,it} from 'vitest';
import {listEncyclopediaEntries,readEncyclopediaEntry,type EncyclopediaEntry} from './encyclopedia-visibility';
const base:EncyclopediaEntry={
 id:'npc-1',campaignId:'campaign-a',kind:'character',visibility:'hidden',
 name:'A Viajante',summary:'Uma figura misteriosa',publicDescription:'Visitou a taverna',
 masterNotes:'É a líder do culto',mechanics:{challengeRating:8,secretHp:75}
};
const player={campaignId:'campaign-a',role:'player' as const,isActiveMember:true};
const master={campaignId:'campaign-a',role:'master' as const,isActiveMember:true};
describe('encyclopedia visibility boundaries',()=>{
 it('denies hidden entries to players without leaking identifiers',()=>{
  expect(readEncyclopediaEntry(player,base)).toEqual({access:'denied'});
  expect(listEncyclopediaEntries(player,[base])).toEqual([]);
 });
 it('returns an explicit allowlist for discovered summaries',()=>{
  const result=readEncyclopediaEntry(player,{...base,visibility:'summary'});
  expect(result).toEqual({access:'player',entry:{
   id:'npc-1',kind:'character',name:'A Viajante',summary:'Uma figura misteriosa'
  }});
  expect(JSON.stringify(result)).not.toMatch(/líder|challengeRating|secretHp|Visitou/);
 });
 it('full discovery reveals only public descriptions, never mechanics or master notes',()=>{
  const result=readEncyclopediaEntry(player,{...base,visibility:'full'});
  expect(result.access).toBe('player');
  expect(JSON.stringify(result)).toContain('Visitou a taverna');
  expect(JSON.stringify(result)).not.toMatch(/líder|challengeRating|secretHp|masterNotes|mechanics/);
 });
 it('master sees private fields for their own campaign',()=>{
  expect(readEncyclopediaEntry(master,base)).toEqual({access:'master',entry:base});
 });
 it('denies former members and cross-campaign masters',()=>{
  expect(readEncyclopediaEntry({...player,isActiveMember:false},{...base,visibility:'full'})).toEqual({access:'denied'});
  expect(readEncyclopediaEntry({...master,campaignId:'campaign-b'},base)).toEqual({access:'denied'});
 });
 it('filters before counts, retaining only discovered entries',()=>{
  const entries=[base,{...base,id:'npc-2',visibility:'summary' as const},{...base,id:'npc-3',visibility:'full' as const}];
  const result=listEncyclopediaEntries(player,entries);
  expect(result).toHaveLength(2);
  expect(result.map(entry=>entry.id)).toEqual(['npc-2','npc-3']);
  expect(JSON.stringify(result)).not.toContain('npc-1');
 });
});

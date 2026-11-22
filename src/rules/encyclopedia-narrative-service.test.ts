import {describe,expect,it} from 'vitest';
import {createEncyclopediaNarrativeEntry,changeEncyclopediaNarrativeDiscovery,trashEncyclopediaNarrativeEntry,restoreEncyclopediaNarrativeEntry,queryEncyclopediaNarratives} from './encyclopedia-narrative-service';
const master={campaignId:'camp-1',role:'master' as const,isActiveMember:true};
const player={campaignId:'camp-1',role:'player' as const,isActiveMember:true};
const original=createEncyclopediaNarrativeEntry({
 id:'npc-1',campaignId:'camp-1',kind:'character',name:'Élena',
 summary:'Viajante',publicDescription:'Usa capa azul',
 masterNotes:'Agente secreto',mechanics:{hp:25}
});
describe('encyclopedia narrative aggregate',()=>{
 it('starts hidden and reveals only public data through the shared query',()=>{
  expect(queryEncyclopediaNarratives([original],player,{offset:0,limit:10}).total).toBe(0);
  const revealed=changeEncyclopediaNarrativeDiscovery(original,master,'full');
  const result=queryEncyclopediaNarratives([revealed],player,{offset:0,limit:10,query:'elena'});
  expect(result.total).toBe(1);
  expect(JSON.stringify(result)).toContain('Usa capa azul');
  expect(JSON.stringify(result)).not.toMatch(/Agente secreto|mechanics|hp/);
 });
 it('prevents players from revealing entries or changing their trash state',()=>{
  expect(()=>changeEncyclopediaNarrativeDiscovery(original,player,'full')).toThrow();
  expect(()=>trashEncyclopediaNarrativeEntry(original,player,'player-1','2026-11-20T00:00:00Z')).toThrow();
 });
 it('trash hides a discovered entry and restoration preserves its visibility',()=>{
  const revealed=changeEncyclopediaNarrativeDiscovery(original,master,'summary');
  const trashed=trashEncyclopediaNarrativeEntry(revealed,master,'dm-1','2026-11-20T00:00:00Z');
  expect(queryEncyclopediaNarratives([trashed],player,{offset:0,limit:10}).total).toBe(0);
  expect(queryEncyclopediaNarratives([trashed],master,{offset:0,limit:10,includeTrash:true}).total).toBe(1);
  expect(()=>changeEncyclopediaNarrativeDiscovery(trashed,master,'full')).toThrow();
  const restored=restoreEncyclopediaNarrativeEntry(trashed,master);
  expect(restored.visibility).toBe('summary');
  expect(queryEncyclopediaNarratives([restored],player,{offset:0,limit:10}).total).toBe(1);
 });
 it('rejects cross-campaign masters for trash and restore',()=>{
  const outsider={...master,campaignId:'camp-2'};
  expect(()=>trashEncyclopediaNarrativeEntry(original,outsider,'dm-2','2026-11-20T00:00:00Z')).toThrow();
  expect(()=>restoreEncyclopediaNarrativeEntry(original,outsider)).toThrow();
 });
});

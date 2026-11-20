import {describe,expect,it} from 'vitest';
import {assertCharacterOptionsAllowed,campaignContentAvailability,campaignContentStatusLabel,setCampaignContentBlocked,updateCampaignRestriction,validateCampaignContentPolicy,type CampaignContentPolicy} from './campaign-content-policy';
import type {RulesCatalogue} from './rules-catalogue';
const goblin={sourceId:'srd-2014',kind:'race' as const,id:'goblin',revision:'1'};
const fighter={sourceId:'srd-2014',kind:'class' as const,id:'fighter',revision:'1'};
const catalogue:RulesCatalogue={registry:{sources:[{id:'srd-2014',origin:'srd-2014',title:'Amostra',ruleset:'5e-2014'}],
 entries:[{ref:goblin,name:'Goblin',ruleset:'5e-2014'},{ref:fighter,name:'Guerreiro',ruleset:'5e-2014'}]},
 definitions:[{ref:goblin,description:'Raça',data:{}},{ref:fighter,description:'Classe',data:{}}]};
const empty:CampaignContentPolicy={campaignId:'camp-a',blocked:[]};
describe('campaign content restrictions',()=>{
 it('blocks Goblin in one campaign without hiding catalogue or affecting another',()=>{
  const a=setCampaignContentBlocked(empty,goblin,true);
  expect(campaignContentStatusLabel(campaignContentAvailability(a,goblin))).toBe('Indisponível nesta campanha');
  expect(campaignContentAvailability(empty,goblin).available).toBe(true);
  expect(campaignContentAvailability({campaignId:'camp-b',blocked:[]},goblin).available).toBe(true);
  expect(catalogue.registry.entries.map(e=>e.name)).toContain('Goblin');
  expect(()=>assertCharacterOptionsAllowed(a,[goblin,fighter])).toThrow('Content unavailable');
  expect(()=>assertCharacterOptionsAllowed(a,[fighter])).not.toThrow();
  expect(setCampaignContentBlocked(a,goblin,false).blocked).toEqual([]);
  expect(empty.blocked).toEqual([]);
 });
 it('preserves restrictions after display-name changes and requires exact revision',()=>{
  const policy=setCampaignContentBlocked(empty,goblin,true);
  const renamed={...catalogue,registry:{...catalogue.registry,entries:catalogue.registry.entries.map(e=>
   e.ref.id==='goblin'?{...e,name:'Goblin renomeado'}:e)}};
  expect(()=>validateCampaignContentPolicy(renamed,policy)).not.toThrow();
  expect(campaignContentAvailability(policy,goblin).available).toBe(false);
  expect(()=>validateCampaignContentPolicy(catalogue,{...policy,blocked:[{...goblin,revision:'2'}]}))
   .toThrow('Unknown blocked content revision');
 });
 it('records a reason for Artificer and blocks unauthorized edits',()=>{
  const artificer={sourceId:'supplement',kind:'class' as const,id:'artificer',revision:'1'};
  const withSource:RulesCatalogue={registry:{sources:[...catalogue.registry.sources,
   {id:'supplement',origin:'supplement',title:'Example supplement',publisher:'Example publisher',ruleset:'5e-2014'}],
   entries:[...catalogue.registry.entries,{ref:artificer,name:'Artífice',ruleset:'5e-2014'}]},
   definitions:[...catalogue.definitions,{ref:artificer,description:'Classe de exemplo',data:{}}]};
  const context={campaignId:'camp-a',isCampaignMaster:true};
  const policy=updateCampaignRestriction(empty,artificer,true,context,'Não faz parte do cenário');
  expect(campaignContentAvailability(policy,artificer)).toEqual({
   available:false,reason:'blocked-in-campaign',detail:'Não faz parte do cenário'});
  expect(()=>validateCampaignContentPolicy(withSource,policy)).not.toThrow();
  expect(()=>updateCampaignRestriction(policy,artificer,false,{...context,isCampaignMaster:false})).toThrow('Not authorized');
  expect(()=>updateCampaignRestriction(policy,artificer,false,{...context,campaignId:'camp-b'})).toThrow('Not authorized');
  expect(updateCampaignRestriction(policy,artificer,false,context).reasons).toEqual({});
 });
 it('rejects duplicate entries and unsupported kinds',()=>{
  const policy=setCampaignContentBlocked(empty,goblin,true);
  expect(()=>validateCampaignContentPolicy(catalogue,{...policy,blocked:[goblin,goblin]})).toThrow('Duplicate');
  expect(()=>setCampaignContentBlocked(empty,{...goblin,kind:'feature'},true)).toThrow('cannot be restricted');
 });
});

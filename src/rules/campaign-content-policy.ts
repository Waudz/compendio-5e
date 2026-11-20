/** Campaign-specific content restrictions. Never delete or mutate catalogue entries.
 * Persist and authorize these policies server-side before production use.
 */
import {contentKey,type ContentKind,type ContentRef} from './content-registry';
import {validateRulesCatalogue,type RulesCatalogue} from './rules-catalogue';
export type RestrictableKind='race'|'subrace'|'class'|'subclass'|'background'|'feat'|'spell'|'item';
export type CampaignContentPolicy={campaignId:string;blocked:ContentRef[]};
export type ContentAvailability={available:boolean;reason?:'blocked-in-campaign'};
export const RESTRICTABLE_KINDS:readonly RestrictableKind[]=['race','subrace','class','subclass','background','feat','spell','item'];
export function setCampaignContentBlocked(policy:CampaignContentPolicy,ref:ContentRef,blocked:boolean):CampaignContentPolicy{
 if(!policy.campaignId.trim()) throw new Error('Campaign ID required');
 if(!RESTRICTABLE_KINDS.includes(ref.kind as RestrictableKind)) throw new Error('Content kind cannot be restricted');
 const key=contentKey(ref);
 const next=policy.blocked.filter(x=>contentKey(x)!==key);
 return {...policy,blocked:blocked?[...next,structuredClone(ref)]:next};
}
export function validateCampaignContentPolicy(catalogue:RulesCatalogue,policy:CampaignContentPolicy):void{
 validateRulesCatalogue(catalogue);
 if(!policy.campaignId.trim()) throw new Error('Campaign ID required');
 const known=new Set(catalogue.registry.entries.map(e=>contentKey(e.ref)));
 const seen=new Set<string>();
 for(const ref of policy.blocked){
  const key=contentKey(ref);
  if(!RESTRICTABLE_KINDS.includes(ref.kind as RestrictableKind)) throw new Error('Content kind cannot be restricted');
  if(!known.has(key)) throw new Error('Unknown blocked content revision: '+key);
  if(seen.has(key)) throw new Error('Duplicate campaign content restriction: '+key);
  seen.add(key);
 }
}
export function campaignContentAvailability(policy:CampaignContentPolicy|null,ref:ContentRef):ContentAvailability{
 if(!policy) return {available:true};
 if(!policy.campaignId.trim()) throw new Error('Campaign ID required');
 return policy.blocked.some(x=>contentKey(x)===contentKey(ref))?
  {available:false,reason:'blocked-in-campaign'}:{available:true};
}
export function assertCharacterOptionsAllowed(policy:CampaignContentPolicy|null,refs:ContentRef[]):void{
 for(const ref of refs) if(!campaignContentAvailability(policy,ref).available)
  throw new Error('Content unavailable in this campaign: '+contentKey(ref));
}
/** A new selection is rejected; existing character records are not rewritten by policy changes. */
export function campaignContentStatusLabel(availability:ContentAvailability):string{
 return availability.available?'Disponível':'Indisponível nesta campanha';
}

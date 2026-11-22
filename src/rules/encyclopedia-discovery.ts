import type {EncyclopediaVisibility} from './encyclopedia-visibility';

/** Discovery state is campaign-scoped. A reveal never exposes mechanical statistics. */
export type EncyclopediaDiscovery={
 campaignId:string;entryId:string;visibility:EncyclopediaVisibility;
};
export type DiscoveryCommand={
 campaignId:string;entryId:string;next:EncyclopediaVisibility;
 actorCampaignId:string;actorIsMaster:boolean;
};
export function setEncyclopediaDiscovery(
 previous:EncyclopediaDiscovery,
 command:DiscoveryCommand
):EncyclopediaDiscovery{
 if(!previous.campaignId.trim()||!previous.entryId.trim()||
  command.campaignId!==previous.campaignId||command.entryId!==previous.entryId||
  command.actorCampaignId!==previous.campaignId||command.actorIsMaster!==true)
  throw Error('Not authorized to change encyclopedia discovery');
 if(command.next!=='hidden'&&command.next!=='summary'&&command.next!=='full')
  throw Error('Invalid encyclopedia discovery');
 return {...previous,visibility:command.next};
}
/** A new campaign entry starts hidden, including NPCs and creatures. */
export function initialEncyclopediaDiscovery(campaignId:string,entryId:string):EncyclopediaDiscovery{
 if(!campaignId.trim()||!entryId.trim())throw Error('Invalid encyclopedia identity');
 return {campaignId,entryId,visibility:'hidden'};
}

import {publicIdentityCard,type PrivateIdentitySource,type PublicIdentitySettings,type PublicIdentityCard} from './public-identity';

/** Public campaign encyclopedia payload. Never spread a private sheet into this shape. */
export type PublicCharacterEncyclopediaEntry={
 characterId:string;
 campaignId:string;
 identity:PublicIdentityCard;
 publicDescription:string;
 campaignHistory:string;
};
export type PublicCharacterEntryInput={
 characterId:string;
 campaignId:string;
 settings:PublicIdentitySettings;
 source:PrivateIdentitySource;
 /** Campaign events are managed by the DM, not overwritten by player edits. */
 campaignHistory?:string;
};
export function createPublicCharacterEntry(input:PublicCharacterEntryInput):PublicCharacterEncyclopediaEntry {
 if(!input.characterId.trim()||!input.campaignId.trim())throw Error('Character and campaign IDs required');
 const identity=publicIdentityCard(input.settings,input.source);
 return {
  characterId:input.characterId,
  campaignId:input.campaignId,
  identity,
  publicDescription:identity.description,
  campaignHistory:input.campaignHistory??''
 };
}
/** The player's public-card edits must never replace campaign history. */
export function updatePublicCharacterIdentity(
 existing:PublicCharacterEncyclopediaEntry,
 settings:PublicIdentitySettings,
 source:PrivateIdentitySource
):PublicCharacterEncyclopediaEntry {
 const identity=publicIdentityCard(settings,source);
 return {...existing,identity,publicDescription:identity.description};
}

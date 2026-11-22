import type {EncyclopediaActor} from './encyclopedia-visibility';

/** Database roles are Portuguese; domain roles are intentionally English.
 * The caller must obtain this row from an authenticated, RLS-protected query.
 * This mapper does NOT grant access on its own.
 */
export type DatabaseCampaignMembership={
 campaign_id:string;
 user_id:string;
 role:string;
};

export function encyclopediaActorFromMembership(
 campaignId:string,
 authenticatedUserId:string|null,
 membership:DatabaseCampaignMembership|null
):EncyclopediaActor{
 const valid=Boolean(
  campaignId.trim()&&authenticatedUserId?.trim()&&membership&&
  membership.campaign_id===campaignId&&
  membership.user_id===authenticatedUserId&&
  (membership.role==='mestre'||membership.role==='jogador')
 );
 return {
  campaignId,
  role:valid&&membership?.role==='mestre'?'master':'player',
  isActiveMember:valid
 };
}

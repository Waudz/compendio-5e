/** Pure character custody rules. No database writes; server must enforce these atomically. */
export type LifeStatus = 'alive' | 'dead';
export type CharacterRole = 'pc' | 'npc';
export type CampaignStatus = 'active' | 'archived';
export type CustodyEventType = 'created' | 'joined' | 'released' | 'assigned' | 'converted-to-npc' | 'revived' | 'died' | 'archived';
export type CustodyEvent = { type: CustodyEventType; at: string; actorUserId: string; previousControllerId: string | null; nextControllerId: string | null };
export type CharacterCustody = {
  characterId: string; creatorUserId: string; personalLibraryUserId: string | null;
  campaignId: string | null; controllerUserId: string | null;
  role: CharacterRole; life: LifeStatus; campaignStatus: CampaignStatus | null;
  version: number; history: CustodyEvent[];
};
export type CustodyAction =
  | { type: 'join'; campaignId: string }
  | { type: 'release-personal' }
  | { type: 'assign'; newControllerUserId: string; acceptedByUserId: string }
  | { type: 'convert-to-npc' }
  | { type: 'die' } | { type: 'revive' } | { type: 'archive' };
export type CustodyContext = { actorUserId: string; isCampaignMaster: boolean; at: string; expectedVersion: number };
function required(value: string | null | undefined): string {
  if (!value?.trim()) throw new Error('Missing identifier');
  return value;
}
export function applyCustodyAction(state: CharacterCustody, action: CustodyAction, ctx: CustodyContext): CharacterCustody {
  required(state.characterId); required(state.creatorUserId); required(ctx.actorUserId);
  if (!Number.isSafeInteger(state.version) || state.version < 0 || ctx.expectedVersion !== state.version)
    throw new Error('Stale character version');
  if (!Number.isFinite(Date.parse(ctx.at))) throw new Error('Invalid event date');
  let next: CharacterCustody = { ...state, history: [...state.history] };
  const master = ctx.isCampaignMaster;
  const controller = state.controllerUserId === ctx.actorUserId;
  const personal = state.personalLibraryUserId === ctx.actorUserId;
  let eventType: CustodyEventType;
  switch (action.type) {
    case 'join':
      if (!personal || state.campaignId !== null || state.campaignStatus !== null) throw new Error('Cannot join campaign');
      next.campaignId = required(action.campaignId);
      next.campaignStatus = 'active';
      next.controllerUserId = ctx.actorUserId;
      next.role = 'pc';
      eventType = 'joined';
      break;
    case 'release-personal':
      if (!personal) throw new Error('Only library holder may release');
      next.personalLibraryUserId = null;
      if (state.campaignId !== null) next.controllerUserId = null;
      eventType = 'released';
      break;
    case 'assign':
      if (!master || !state.campaignId || state.campaignStatus !== 'active' || state.controllerUserId !== null)
        throw new Error('Assignment not allowed');
      if (required(action.newControllerUserId) !== action.acceptedByUserId) throw new Error('Recipient acceptance required');
      next.controllerUserId = action.newControllerUserId;
      next.personalLibraryUserId = action.newControllerUserId;
      next.role = 'pc';
      eventType = 'assigned';
      break;
    case 'convert-to-npc':
      if (!master || !state.campaignId || state.campaignStatus !== 'active' || state.controllerUserId !== null)
        throw new Error('NPC conversion not allowed');
      next.role = 'npc';
      next.personalLibraryUserId = null;
      eventType = 'converted-to-npc';
      break;
    case 'die':
      if ((!controller && !master) || !state.campaignId || state.life === 'dead') throw new Error('Death not allowed');
      next.life = 'dead'; eventType = 'died'; break;
    case 'revive':
      if ((!controller && !master) || !state.campaignId || state.life === 'alive') throw new Error('Revival not allowed');
      next.life = 'alive'; eventType = 'revived'; break;
    case 'archive':
      if (!master || !state.campaignId || state.campaignStatus !== 'active') throw new Error('Archive not allowed');
      next.campaignStatus = 'archived'; next.controllerUserId = null; eventType = 'archived'; break;
  }
  next.version++;
  next.history.push({ type: eventType, at: ctx.at, actorUserId: ctx.actorUserId,
    previousControllerId: state.controllerUserId, nextControllerId: next.controllerUserId });
  return next;
}
/** Encyclopedia entries are narrative projections, never separate playable sheets. */
export type CharacterEncyclopediaEntry = {
  characterId: string; campaignId: string; title: string;
  visibility: 'gm-only' | 'campaign-members';
  biography: string; historical: boolean;
};
export function canViewEncyclopediaEntry(entry: CharacterEncyclopediaEntry, userIsMember: boolean, userIsMaster: boolean): boolean {
  return userIsMaster || (userIsMember && entry.visibility === 'campaign-members');
}

import {describe,expect,it} from 'vitest';
import {canManageInitiative,readInitiativeForActor,serializeInitiativeForActor,type InitiativeEncounter} from './initiative-access';
const encounter:InitiativeEncounter={id:'enc-1',campaignId:'camp-1',round:3,turnIndex:1,
 combatants:[{id:'combatant-1',characterId:'char-1',initiative:18,currentHp:12}]};
describe('initiative is master-only',()=>{
 it('allows campaign master to read and manage the encounter',()=>{
  const actor={userId:'dm',campaignId:'camp-1',role:'master' as const};
  expect(readInitiativeForActor(actor,encounter)).toEqual({kind:'allowed',encounter});
  expect(canManageInitiative(actor,'camp-1')).toBe(true);
  expect(serializeInitiativeForActor(actor,encounter)).toContain('combatant-1');
 });
 it('denies player even when the combatant is their own character',()=>{
  const actor={userId:'player',campaignId:'camp-1',role:'player' as const};
  expect(readInitiativeForActor(actor,encounter)).toEqual({kind:'forbidden'});
  expect(canManageInitiative(actor,'camp-1')).toBe(false);
  expect(serializeInitiativeForActor(actor,encounter)).toBeNull();
 });
 it('does not let a master access a different campaign',()=>{
  const actor={userId:'other-dm',campaignId:'camp-2',role:'master' as const};
  expect(readInitiativeForActor(actor,encounter)).toEqual({kind:'forbidden'});
  expect(canManageInitiative(actor,'camp-1')).toBe(false);
  expect(serializeInitiativeForActor(actor,encounter)).toBeNull();
 });
});

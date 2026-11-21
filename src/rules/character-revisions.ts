/** Pure optimistic concurrency contract for character draft persistence.
 * Storage adapters must atomically compare and swap on the server.
 */
import type { CharacterDraft } from './character-domain';
export type VersionedCharacter = { revision:number; draft:CharacterDraft };
export type SaveResult =
 | {ok:true;record:VersionedCharacter}
 | {ok:false;reason:'conflict';current:VersionedCharacter}
 | {ok:false;reason:'missing'};
export function saveCharacterRevision(current:VersionedCharacter|null, expectedRevision:number|null,
 draft:CharacterDraft):SaveResult {
 if(!current){
  if(expectedRevision!==null) return {ok:false,reason:'missing'};
  return {ok:true,record:{revision:1,draft:structuredClone(draft)}};
 }
 if(expectedRevision!==current.revision || current.draft.id!==draft.id)
  return {ok:false,reason:'conflict',current:structuredClone(current)};
 if(!Number.isSafeInteger(current.revision) || current.revision<1 || current.revision===Number.MAX_SAFE_INTEGER)
  throw new Error('Invalid stored revision');
 return {ok:true,record:{revision:current.revision+1,draft:structuredClone(draft)}};
}

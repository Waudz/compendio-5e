/** Future-proof catalogue identity; pure metadata, no storage or user-content writes. */
export type ContentKind = 'race' | 'subrace' | 'class' | 'subclass' | 'feat' | 'background';
export type ContentOrigin = 'srd-2014' | 'supplement' | 'homebrew';
export type ContentRef = {
  id: string;
  kind: ContentKind;
  sourceId: string;
  revision: string;
};
export type ContentSource = {
  id: string;
  origin: ContentOrigin;
  title: string;
  ruleset: '5e-2014';
  license?: string;
  publisher?: string;
};
export type ContentEntry = {
  ref: ContentRef;
  name: string;
  ruleset: '5e-2014';
  prerequisites?: ContentRef[];
};
export type ContentRegistry = { sources: ContentSource[]; entries: ContentEntry[] };
const IDENTIFIER = /^[a-z0-9]+(?:[.-][a-z0-9]+)*$/;
export function contentKey(ref: ContentRef): string {
  return [ref.sourceId, ref.kind, ref.id, ref.revision].join(':');
}
export function validateContentRegistry(registry: ContentRegistry): void {
  const sourceIds = new Set<string>();
  for (const source of registry.sources) {
    if (!IDENTIFIER.test(source.id) || sourceIds.has(source.id) || !source.title.trim() ||
      source.ruleset !== '5e-2014' ||
      (source.origin === 'supplement' && !source.publisher?.trim()))
      throw new Error('Invalid content source');
    sourceIds.add(source.id);
  }
  const keys = new Set<string>();
  for (const entry of registry.entries) {
    if (!IDENTIFIER.test(entry.ref.id) || !IDENTIFIER.test(entry.ref.revision) ||
      !sourceIds.has(entry.ref.sourceId) || !entry.name.trim() || entry.ruleset !== '5e-2014')
      throw new Error('Invalid content entry');
    const key = contentKey(entry.ref);
    if (keys.has(key)) throw new Error('Duplicate content entry');
    keys.add(key);
  }
  for (const entry of registry.entries) for (const prerequisite of entry.prerequisites ?? [])
    if (!keys.has(contentKey(prerequisite))) throw new Error('Unresolved content prerequisite');
}
/** One canonical live character identity and sheet, independent of library/campaign views.
 * Historical campaign snapshots have separate immutable keys and are never live sheets.
 */
export type CharacterPointer = { characterId: string };
export function characterPointerKey(pointer: CharacterPointer): string {
  if (!pointer.characterId.trim()) throw new Error('Invalid character pointer');
  return 'character:' + pointer.characterId;
}
export type CampaignCharacterSnapshotPointer = {
  characterId: string; campaignId: string; snapshotId: string;
};
export function campaignCharacterSnapshotKey(pointer: CampaignCharacterSnapshotPointer): string {
  if (!pointer.characterId.trim() || !pointer.campaignId.trim() || !pointer.snapshotId.trim())
    throw new Error('Invalid historical snapshot pointer');
  return 'character:' + pointer.characterId + ':campaign:' + pointer.campaignId +
    ':snapshot:' + pointer.snapshotId;
}

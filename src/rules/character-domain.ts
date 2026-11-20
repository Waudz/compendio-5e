/** Experimental domain contract for 5e 2014. No persistence or Supabase writes. */
import { buildCharacter, type Abilities, type ClassDefinition, type Grant, type Option } from './character-build-pilot';
import { evaluateAdvancements, type Advancement } from './character-advancement';

export type StableChoice = { id: string; optionIds: string[] };
export type ChoiceDefinition = { id: string; count: number; options: { id: string; grants: Grant[] }[] };
export type CatalogOption = Omit<Option, 'choices'> & { choices?: ChoiceDefinition[] };
export type InventoryEntry = { id: string; itemId: string; quantity: number; equipped: boolean; origin: 'starting' | 'acquired' };
export type CharacterDraft = {
  id: string; name: string; ruleset: '5e-2014'; catalogueVersion: string;
  baseAbilities: Abilities; raceId: string; backgroundId: string; classId: string;
  level: number; decisions: StableChoice[]; hpRolls?: number[];
  inventory: InventoryEntry[]; currentHp: number; temporaryHp: number;
  spentResources: Record<string, number>;
};
export type CharacterCatalog = {
  version: string; races: Record<string, CatalogOption>;
  backgrounds: Record<string, CatalogOption>; classes: Record<string, ClassDefinition>;
  advancements?: Record<string, Advancement[]>;
};
export type CharacterSheet = {
  draft: CharacterDraft;
  abilities: Abilities; maxHp: number; currentHp: number; temporaryHp: number;
  skills: string[]; languages: string[]; features: string[];
  resources: Record<string, { maximum: number | null; spent: number; remaining: number | null }>;
  inventory: InventoryEntry[]; pending: string[]; provenance: Grant[];
};
function validateInventory(entries: InventoryEntry[]): void {
  const ids = new Set<string>();
  for (const entry of entries) {
    if (!entry.id || !entry.itemId || ids.has(entry.id) || !Number.isSafeInteger(entry.quantity) || entry.quantity <= 0)
      throw new Error('Invalid inventory entry');
    ids.add(entry.id);
  }
}
export function createCharacterSheet(draft: CharacterDraft, catalog: CharacterCatalog): CharacterSheet {
  if (draft.ruleset !== '5e-2014') throw new Error('Unsupported ruleset');
  if (draft.catalogueVersion !== catalog.version) throw new Error('Catalogue version mismatch');
  if (!draft.id.trim() || !draft.name.trim()) throw new Error('Character identity required');
  const race = catalog.races[draft.raceId], background = catalog.backgrounds[draft.backgroundId], classDef = catalog.classes[draft.classId];
  if (!race || !background || !classDef) throw new Error('Unknown character option');
  validateInventory(draft.inventory);
  if (!Number.isSafeInteger(draft.currentHp) || draft.currentHp < 0 || !Number.isSafeInteger(draft.temporaryHp) || draft.temporaryHp < 0)
    throw new Error('Invalid hit points');
  const pending: string[] = [];
  const decisionIds = new Set<string>();
  for (const decision of draft.decisions) {
    if (decisionIds.has(decision.id)) throw new Error('Duplicate decision ID');
    decisionIds.add(decision.id);
  }
  const seen = new Set<string>();
  for (const option of [race, background]) for (const choice of option.choices ?? []) {
    if (seen.has(choice.id)) throw new Error('Duplicate choice ID');
    seen.add(choice.id);
  }
  const classAdvancements = catalog.advancements?.[draft.classId] ?? [];
  const classChoices = new Set(classAdvancements.flatMap(a => (a.choices ?? []).map(choice => choice.id)));
  for (const decision of draft.decisions) if (!seen.has(decision.id) && !classChoices.has(decision.id)) pending.push('unknown-choice:' + decision.id);
  const grantedChoices: Grant[] = [];
  for (const option of [race, background]) for (const choice of option.choices ?? []) {
    const decision = draft.decisions.find(d => d.id === choice.id);
    if (!decision || decision.optionIds.length !== choice.count || new Set(decision.optionIds).size !== decision.optionIds.length ||
      decision.optionIds.some(id => !choice.options.some(o => o.id === id))) {
      pending.push(choice.id); continue;
    }
    for (const id of decision.optionIds) grantedChoices.push(...choice.options.find(o => o.id === id)!.grants);
  }
  // Class advancement is evaluated separately from level grants; never include the same grant in both catalogues.
  const advancement = evaluateAdvancements(classAdvancements, draft.level,
    draft.decisions.filter(d => classChoices.has(d.id)).map(d => ({ choiceId: d.id, optionIds: d.optionIds })));
  pending.push(...advancement.pending);
  // Choices are evaluated as grant packages; never depend on array positions.
  const evaluated = buildCharacter({
    baseAbilities: draft.baseAbilities,
    race: { id: race.id, grants: [...race.grants, ...grantedChoices, ...advancement.grants] },
    background: { id: background.id, grants: background.grants },
    classDef, level: draft.level, selected: {}, hpRolls: draft.hpRolls
  });
  if (draft.currentHp > evaluated.maxHp) throw new Error('Current HP exceeds maximum');
  const resources: CharacterSheet['resources'] = {};
  for (const [name, maximum] of Object.entries(evaluated.resources)) {
    const spent = draft.spentResources[name] ?? 0;
    if (!Number.isSafeInteger(spent) || spent < 0 || (maximum !== null && spent > maximum))
      throw new Error('Invalid resource spending');
    resources[name] = { maximum, spent, remaining: maximum === null ? null : maximum - spent };
  }
  for (const [name, spent] of Object.entries(draft.spentResources))
    if (!(name in resources) || !Number.isSafeInteger(spent) || spent < 0) throw new Error('Unknown spent resource');
  const inventory = draft.inventory.map(entry => ({ ...entry }));
  // Starting equipment is only a proposal; once accepted, inventory is the source of truth.
  return {
    draft: { ...draft, baseAbilities: { ...draft.baseAbilities }, inventory, decisions: draft.decisions.map(d => ({ id: d.id, optionIds: [...d.optionIds] })),
      spentResources: { ...draft.spentResources }, hpRolls: draft.hpRolls ? [...draft.hpRolls] : undefined },
    abilities: evaluated.abilities, maxHp: evaluated.maxHp, currentHp: draft.currentHp, temporaryHp: draft.temporaryHp,
    skills: evaluated.skills, languages: evaluated.languages, features: evaluated.features,
    resources, inventory, pending, provenance: evaluated.provenance
  };
}
export function applyInventoryChange(draft: CharacterDraft, itemId: string, delta: number): CharacterDraft {
  if (!itemId.trim() || !Number.isSafeInteger(delta) || delta === 0) throw new Error('Invalid quantity change');
  const entries = draft.inventory.map(entry => ({ ...entry }));
  const existing = entries.find(entry => entry.itemId === itemId && entry.origin === 'acquired' && !entry.equipped);
  if (!existing && delta < 0) throw new Error('Not enough acquired items');
  if (existing) {
    const next = existing.quantity + delta;
    if (!Number.isSafeInteger(next) || next < 0) throw new Error('Not enough acquired items');
    if (next === 0) entries.splice(entries.indexOf(existing), 1);
    else existing.quantity = next;
  } else entries.push({ id: 'acquired:' + itemId, itemId, quantity: delta, equipped: false, origin: 'acquired' });
  validateInventory(entries);
  return { ...draft, inventory: entries };
}

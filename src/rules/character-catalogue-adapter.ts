/** Strict bridge from the canonical rules catalogue to the existing character kernel.
 * Definitions are referenced by immutable ContentRef, never by display name.
 * This pilot deliberately supports only the typed race/background/class payloads.
 */
import { contentKey, type ContentRef } from './content-registry';
import { resolveRule, type RulesCatalogue } from './rules-catalogue';
import type { CharacterCatalog, CatalogOption } from './character-domain';
import type { ClassDefinition } from './character-build-pilot';
import type { Advancement } from './character-advancement';
export type PilotCharacterReferences = {
  race: ContentRef; background: ContentRef; class: ContentRef;
};
function object(value: unknown): value is Record<string,unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}
const ABILITIES = new Set(['str','dex','con','int','wis','cha']);
const IDENTIFIER = /^[a-z0-9]+(?:[.-][a-z0-9]+)*$/;
function identifier(value: unknown): value is string {
  return typeof value === 'string' && IDENTIFIER.test(value);
}
function label(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}
/** A discriminated runtime check, not just the presence of a type tag.
 * External source payloads must never be allowed to inject NaN or malformed grants.
 */
function grant(value: unknown): boolean {
  if (!object(value) || !label(value.source)) return false;
  switch (value.type) {
    case 'ability':
      return ABILITIES.has(value.ability as string) &&
        Number.isSafeInteger(value.amount) && (value.amount as number) >= 0 &&
        (value.max === undefined || (Number.isSafeInteger(value.max) && (value.max as number) >= 1));
    case 'skill': return identifier(value.skill);
    case 'language': return label(value.language);
    case 'item':
      return identifier(value.item) && Number.isSafeInteger(value.quantity) && (value.quantity as number) > 0;
    case 'feature': return identifier(value.feature);
    case 'resource':
      return identifier(value.resource) &&
        (value.uses === null || (Number.isSafeInteger(value.uses) && (value.uses as number) >= 0));
    case 'hp-per-level':
      return Number.isSafeInteger(value.amount) && (value.amount as number) >= 0;
    default: return false;
  }
}
function grants(value: unknown): boolean {
  return Array.isArray(value) && value.every(grant);
}
function option(value: unknown): value is CatalogOption {
  if (!object(value) || !identifier(value.id) || !grants(value.grants)) return false;
  if (value.choices === undefined) return true;
  if (!Array.isArray(value.choices)) return false;
  const ids = new Set<string>();
  for (const choice of value.choices) {
    if (!object(choice) || !identifier(choice.id) || ids.has(choice.id) ||
        !Number.isSafeInteger(choice.count) || (choice.count as number) < 1 ||
        !Array.isArray(choice.options) || (choice.count as number) > choice.options.length) return false;
    ids.add(choice.id);
    const optionIds = new Set<string>();
    for (const entry of choice.options) {
      if (!object(entry) || !identifier(entry.id) || optionIds.has(entry.id) || !grants(entry.grants)) return false;
      optionIds.add(entry.id);
    }
  }
  return true;
}
function classDefinition(value: unknown): value is ClassDefinition {
  return object(value) && identifier(value.id) && Array.isArray(value.levels) &&
    value.levels.length === 20 && value.levels.every((level,i) => object(level) &&
      level.level === i+1 && Number.isSafeInteger(level.hitDie) &&
      (level.hitDie as number) > 0 && level.hitDie === (value.levels as Record<string, unknown>[])[0]?.hitDie && grants(level.grants));
}
/** Validate advancements at the catalogue boundary, before any character calculation. */
function validAdvancements(value: unknown): value is Advancement[] {
  if (!Array.isArray(value)) return false;
  const advancementIds = new Set<string>();
  const choiceIds = new Set<string>();
  for (const entry of value) {
    if (!object(entry) || !identifier(entry.id) || advancementIds.has(entry.id) ||
        !Number.isSafeInteger(entry.level) || (entry.level as number) < 1 || (entry.level as number) > 20 ||
        !grants(entry.grants) || (entry.choices !== undefined && !Array.isArray(entry.choices))) return false;
    advancementIds.add(entry.id);
    for (const choice of (entry.choices ?? []) as unknown[]) {
      if (!object(choice) || !identifier(choice.id) || choiceIds.has(choice.id) ||
          choice.level !== entry.level || !Number.isSafeInteger(choice.count) ||
          (choice.count as number) < 1 || !Array.isArray(choice.options) ||
          (choice.count as number) > choice.options.length) return false;
      choiceIds.add(choice.id);
      const optionIds = new Set<string>();
      for (const option of choice.options) {
        if (!object(option) || !identifier(option.id) || optionIds.has(option.id) || !grants(option.grants)) return false;
        optionIds.add(option.id);
      }
    }
  }
  return true;
}
export function buildPilotCharacterCatalog(
  catalogue: RulesCatalogue, refs: PilotCharacterReferences, advancements: Advancement[] = []
): {catalog: CharacterCatalog; ids: {raceId:string;backgroundId:string;classId:string}} {
  const selected = [refs.race,refs.background,refs.class];
  if (refs.race.kind !== 'race' || refs.background.kind !== 'background' || refs.class.kind !== 'class')
    throw new Error('Invalid character content kinds');
  const definitions=selected.map(ref=>resolveRule(catalogue,ref).definition);
  const [race,background,klass]=definitions.map(d=>d.data);
  if (!option(race) || !option(background) || !classDefinition(klass))
    throw new Error('Incomplete or invalid character rules definition');
  if (race.id !== refs.race.id || background.id !== refs.background.id || klass.id !== refs.class.id)
    throw new Error('Character rule ID mismatch');
  if (!validAdvancements(advancements)) throw new Error('Invalid character advancements');
  const choiceIds = new Set<string>();
  for (const choice of [...(race.choices ?? []), ...(background.choices ?? []),
    ...advancements.flatMap(entry => entry.choices ?? [])]) {
    if (choiceIds.has(choice.id)) throw new Error('Duplicate character choice ID');
    choiceIds.add(choice.id);
  }
  const raceId=contentKey(refs.race),backgroundId=contentKey(refs.background),classId=contentKey(refs.class);
  const version=selected.map(contentKey).join('|');
  return {ids:{raceId,backgroundId,classId},catalog:{
    version,races:{[raceId]:race},backgrounds:{[backgroundId]:background},
    classes:{[classId]:klass},advancements:{[classId]:advancements}
  }};
}

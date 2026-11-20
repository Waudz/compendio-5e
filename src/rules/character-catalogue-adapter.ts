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
function grants(value: unknown): boolean {
  return Array.isArray(value) && value.every(g => object(g) && typeof g.type === 'string' &&
    typeof g.source === 'string');
}
function option(value: unknown): value is CatalogOption {
  return object(value) && typeof value.id === 'string' && grants(value.grants) &&
    (value.choices === undefined || (Array.isArray(value.choices) && value.choices.every(c =>
      object(c) && typeof c.id === 'string' && Number.isInteger(c.count) &&
      Array.isArray(c.options) && c.options.every(o => object(o) && typeof o.id === 'string' && grants(o.grants)))));
}
function classDefinition(value: unknown): value is ClassDefinition {
  return object(value) && typeof value.id === 'string' && Array.isArray(value.levels) &&
    value.levels.length === 20 && value.levels.every((level,i) => object(level) &&
      level.level === i+1 && Number.isInteger(level.hitDie) && (level.hitDie as number)>0 && grants(level.grants));
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
  const raceId=contentKey(refs.race),backgroundId=contentKey(refs.background),classId=contentKey(refs.class);
  const version=selected.map(contentKey).join('|');
  return {ids:{raceId,backgroundId,classId},catalog:{
    version,races:{[raceId]:race},backgrounds:{[backgroundId]:background},
    classes:{[classId]:klass},advancements:{[classId]:advancements}
  }};
}

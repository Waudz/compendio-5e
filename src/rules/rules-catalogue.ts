/** Shared read model for Compendium, character creator and sheet.
 * No duplicated rules: references resolve to one immutable catalogue revision.
 */
import { contentKey, validateContentRegistry, type ContentRef, type ContentRegistry, type ContentEntry } from './content-registry';
export type RuleDefinition = { ref: ContentRef; description: string; data: Readonly<Record<string, unknown>> };
export type RulesCatalogue = { registry: ContentRegistry; definitions: RuleDefinition[] };
export type ResolvedRule = { entry: ContentEntry; definition: RuleDefinition };
export function validateRulesCatalogue(catalogue: RulesCatalogue): void {
  validateContentRegistry(catalogue.registry);
  const entries = new Set(catalogue.registry.entries.map(e=>contentKey(e.ref)));
  const defined = new Set<string>();
  for (const definition of catalogue.definitions) {
    const key = contentKey(definition.ref);
    if (!entries.has(key)) throw new Error('Definition has no registered entry');
    if (defined.has(key)) throw new Error('Duplicate rule definition');
    if (!definition.description.trim() || !definition.data || Array.isArray(definition.data) ||
        typeof definition.data !== 'object') throw new Error('Invalid rule definition');
    defined.add(key);
  }
  for (const key of entries) if (!defined.has(key)) throw new Error('Missing rule definition: '+key);
}
export function resolveRule(catalogue: RulesCatalogue, ref: ContentRef): ResolvedRule {
  const key=contentKey(ref);
  const entry=catalogue.registry.entries.find(e=>contentKey(e.ref)===key);
  const definition=catalogue.definitions.find(d=>contentKey(d.ref)===key);
  if (!entry || !definition) throw new Error('Unknown rule revision: '+key);
  return {entry,definition};
}
/** A character stores a revision reference, not a copy of the class/race rules. */
export type CharacterRuleSelection = { characterId: string; selected: ContentRef[] };
export function resolveCharacterRules(catalogue: RulesCatalogue, selection: CharacterRuleSelection): ResolvedRule[] {
  if (!selection.characterId.trim()) throw new Error('Character ID required');
  const seen=new Set<string>();
  return selection.selected.map(ref=>{
    const key=contentKey(ref);
    if (seen.has(key)) throw new Error('Duplicate character rule reference');
    seen.add(key);
    return resolveRule(catalogue,ref);
  });
}

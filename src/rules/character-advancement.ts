/** Experimental advancement decisions for D&D 5e 2014; not connected to persistence. */
import type { Grant } from './character-build-pilot';

export type AdvancementChoice = {
  id: string;
  level: number;
  count: number;
  options: { id: string; grants: Grant[] }[];
};
export type Advancement = {
  id: string;
  level: number;
  grants: Grant[];
  choices?: AdvancementChoice[];
};
export type AdvancementDecision = { choiceId: string; optionIds: string[] };
export type AdvancementEvaluation = { grants: Grant[]; pending: string[] };

export function evaluateAdvancements(
  advancements: Advancement[],
  level: number,
  decisions: AdvancementDecision[]
): AdvancementEvaluation {
  if (!Number.isInteger(level) || level < 1 || level > 20) throw new Error('Invalid level');
  const advancementIds = new Set<string>();
  const choiceIds = new Set<string>();
  const decisionsById = new Map<string, AdvancementDecision>();
  for (const decision of decisions) {
    if (decisionsById.has(decision.choiceId)) throw new Error('Duplicate advancement decision');
    decisionsById.set(decision.choiceId, decision);
  }
  const grants: Grant[] = [];
  const pending: string[] = [];
  for (const advancement of advancements) {
    if (!advancement.id || advancementIds.has(advancement.id) || !Number.isInteger(advancement.level) ||
      advancement.level < 1 || advancement.level > 20) throw new Error('Invalid advancement');
    advancementIds.add(advancement.id);
    for (const choice of advancement.choices ?? []) {
      if (!choice.id || choiceIds.has(choice.id) || choice.level !== advancement.level ||
        !Number.isInteger(choice.count) || choice.count < 1 || choice.count > choice.options.length ||
        new Set(choice.options.map(o => o.id)).size !== choice.options.length ||
        choice.options.some(o => !o.id)) throw new Error('Invalid advancement choice');
      choiceIds.add(choice.id);
    }
    if (advancement.level > level) continue;
    grants.push(...advancement.grants);
    for (const choice of advancement.choices ?? []) {
      const decision = decisionsById.get(choice.id);
      if (!decision || decision.optionIds.length !== choice.count ||
        new Set(decision.optionIds).size !== decision.optionIds.length ||
        decision.optionIds.some(id => !choice.options.some(o => o.id === id))) {
        pending.push(choice.id);
        continue;
      }
      for (const optionId of decision.optionIds)
        grants.push(...choice.options.find(o => o.id === optionId)!.grants);
    }
  }
  for (const decision of decisions) {
    if (!choiceIds.has(decision.choiceId)) pending.push('unknown-choice:' + decision.choiceId);
  }
  return { grants, pending };
}

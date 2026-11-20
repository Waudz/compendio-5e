/** 2014 ability-score improvements: +2 to one score or +1/+1 to distinct scores.
 * The caller decides when an ASI is available and whether a feat replaces it.
 */
import type { Ability, Grant } from './character-build-pilot';
export type AbilityImprovement = { kind: 'single'; ability: Ability } |
  { kind: 'split'; first: Ability; second: Ability };
const abilities: Ability[] = ['str','dex','con','int','wis','cha'];
export function abilityImprovementGrants(choice: AbilityImprovement, source: string): Grant[] {
  if (!source.trim()) throw new Error('ASI source required');
  if (choice.kind === 'single') {
    if (!abilities.includes(choice.ability)) throw new Error('Invalid ASI ability');
    return [{ type: 'ability', ability: choice.ability, amount: 2, source, max: 20 }];
  }
  if (choice.kind !== 'split' || !abilities.includes(choice.first) || !abilities.includes(choice.second) ||
      choice.first === choice.second) throw new Error('Invalid split ASI');
  return [{ type: 'ability', ability: choice.first, amount: 1, source, max: 20 },
    { type: 'ability', ability: choice.second, amount: 1, source, max: 20 }];
}
export function abilityImprovementOptions(source: string): { id: string; grants: Grant[] }[] {
  const options: { id: string; grants: Grant[] }[] = [];
  for (const ability of abilities)
    options.push({ id: ability + '-plus-two', grants: abilityImprovementGrants({kind:'single',ability},source) });
  for (let i = 0; i < abilities.length; i++) for (let j = i + 1; j < abilities.length; j++) {
    const first = abilities[i], second = abilities[j];
    options.push({ id: first + '-' + second + '-plus-one', grants: abilityImprovementGrants({kind:'split',first,second},source) });
  }
  return options;
}

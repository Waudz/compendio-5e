/** Standard class ASI levels for D&D 5e (2014), excluding optional feats. */
import { abilityImprovementOptions } from './ability-improvement';
import type { Advancement } from './character-advancement';
export type CoreClass = 'barbarian'|'bard'|'cleric'|'druid'|'fighter'|'monk'|'paladin'|'ranger'|'rogue'|'sorcerer'|'warlock'|'wizard';
const common = [4,8,12,16,19] as const;
const byClass: Record<CoreClass, readonly number[]> = {
 barbarian:common,bard:common,cleric:common,druid:common,
 fighter:[4,6,8,12,14,16,19],monk:common,paladin:common,
 ranger:common,rogue:[4,8,10,12,16,19],sorcerer:common,
 warlock:common,wizard:common
};
export function coreClassAsiLevels(classId: CoreClass): number[] {
 if (!Object.prototype.hasOwnProperty.call(byClass,classId)) throw new Error('Unknown 2014 class');
 return [...byClass[classId]];
}
export function coreClassAsiAdvancements(classId: CoreClass): Advancement[] {
 return coreClassAsiLevels(classId).map(level => {
  const id = classId + '-asi-' + level;
  return {id,level,grants:[],choices:[{id,level,count:1,options:abilityImprovementOptions(id)}]};
 });
}

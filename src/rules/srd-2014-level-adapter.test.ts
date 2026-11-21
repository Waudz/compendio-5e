import { describe, expect, it } from 'vitest';
import { indexSrd2014ClassLevels, type SrdClassLevel } from './srd-2014-level-adapter';

const levels: SrdClassLevel[] = Array.from({ length: 20 }, (_, i) => ({
  level: i + 1, prof_bonus: 2 + Math.floor(i / 4),
  ability_score_bonuses: [4, 8, 12, 16, 19].filter(n => n <= i + 1).length * 2,
  features: i === 0 ? [{ index: 'rage', name: 'Rage' }] : [],
  class_specific: { rage_count: i + 1 }
}));
describe('SRD 2014 class level adapter', () => {
  it('indexes 20 levels and preserves external source fields without inventing mechanics', () => {
    const result = indexSrd2014ClassLevels('barbarian', levels);
    expect(result).toHaveLength(20);
    expect(result[0]).toMatchObject({ level: 1, proficiencyBonus: 2, featureIds: ['rage'] });
    expect(result[19].proficiencyBonus).toBe(6);
    expect(result[19].classSpecific).toEqual({ rage_count: 20 });
    expect(result[0]).not.toHaveProperty('grants');
  });
  it('rejects incomplete, out-of-order and inconsistent records', () => {
    expect(() => indexSrd2014ClassLevels('barbarian', levels.slice(0, 19))).toThrow();
    expect(() => indexSrd2014ClassLevels('barbarian', levels.map((v, i) => i === 3 ? { ...v, level: 5 } : v))).toThrow();
    expect(() => indexSrd2014ClassLevels('barbarian', levels.map((v, i) => i === 5 ? { ...v, prof_bonus: 99 } : v))).toThrow();
    expect(() => indexSrd2014ClassLevels('barbarian', levels.map((v, i) => i === 10 ? { ...v, features: [{ index: 'rage', name: 'Rage' }] } : v))).toThrow();
  });
  it('does not mutate API input', () => {
    const before = JSON.stringify(levels);
    indexSrd2014ClassLevels('barbarian', levels);
    expect(JSON.stringify(levels)).toBe(before);
  });
});

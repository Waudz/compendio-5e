import { describe, expect, it } from 'vitest';
import { evaluateAdvancements, type Advancement } from './character-advancement';

const advancements: Advancement[] = [
  { id: 'barbarian-1', level: 1, grants: [{ type: 'feature', feature: 'rage', source: 'barbarian-1' }] },
  { id: 'barbarian-3', level: 3, grants: [], choices: [{
    id: 'primal-path', level: 3, count: 1, options: [
      { id: 'berserker', grants: [{ type: 'feature', feature: 'frenzy', source: 'berserker-3' }] },
      { id: 'other', grants: [{ type: 'feature', feature: 'other-path', source: 'other-3' }] }
    ]
  }] },
  { id: 'barbarian-4', level: 4, grants: [], choices: [{
    id: 'asi-4', level: 4, count: 1, options: [
      { id: 'str-plus-two', grants: [{ type: 'ability', ability: 'str', amount: 2, source: 'asi-4' }] },
      { id: 'con-plus-two', grants: [{ type: 'ability', ability: 'con', amount: 2, source: 'asi-4' }] }
    ]
  }] }
];
describe('2014 level advancements (experimental contract)', () => {
  it('only applies benefits earned by the current level', () => {
    expect(evaluateAdvancements(advancements, 1, []).grants.map(g => g.source)).toEqual(['barbarian-1']);
    expect(evaluateAdvancements(advancements, 1, []).pending).toEqual([]);
    expect(evaluateAdvancements(advancements, 3, []).pending).toEqual(['primal-path']);
  });
  it('resolves subclass and ability improvement using stable option IDs', () => {
    const decisions = [{ choiceId: 'primal-path', optionIds: ['berserker'] }, { choiceId: 'asi-4', optionIds: ['str-plus-two'] }];
    const result = evaluateAdvancements(advancements, 4, decisions);
    expect(result.pending).toEqual([]);
    expect(result.grants.map(g => g.source)).toEqual(['barbarian-1', 'berserker-3', 'asi-4']);
    expect(evaluateAdvancements(advancements, 3, decisions).grants.map(g => g.source)).toEqual(['barbarian-1', 'berserker-3']);
  });
  it('rejects duplicated decisions and invalid option combinations', () => {
    expect(() => evaluateAdvancements(advancements, 4, [
      { choiceId: 'asi-4', optionIds: ['str-plus-two'] }, { choiceId: 'asi-4', optionIds: ['con-plus-two'] }
    ])).toThrow('Duplicate advancement decision');
    expect(evaluateAdvancements(advancements, 4, [{ choiceId: 'primal-path', optionIds: ['deleted'] }]).pending)
      .toEqual(['primal-path', 'asi-4']);
  });
  it('rejects inconsistent catalogue choice identifiers', () => {
    expect(() => evaluateAdvancements([...advancements, { ...advancements[0] }], 4, [])).toThrow('Invalid advancement');
    expect(() => evaluateAdvancements([{ id: 'invalid', level: 2, grants: [], choices: [
      { id: 'wrong-level', level: 3, count: 1, options: [{ id: 'a', grants: [] }] }
    ] }], 2, [])).toThrow('Invalid advancement choice');
  });
  it('is deterministic for every level 1–20', () => {
    const decisions = [{ choiceId: 'primal-path', optionIds: ['berserker'] }, { choiceId: 'asi-4', optionIds: ['str-plus-two'] }];
    for (let level = 1; level <= 20; level++) {
      const first = evaluateAdvancements(advancements, level, decisions);
      expect(first).toEqual(evaluateAdvancements(advancements, level, decisions));
      expect(first.grants.some(g => g.source === 'asi-4')).toBe(level >= 4);
    }
  });
});

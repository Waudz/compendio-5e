import { describe, expect, it } from 'vitest';
import { applyInventoryChange, createCharacterSheet, type CharacterCatalog, type CharacterDraft } from './character-domain';

const catalog: CharacterCatalog = {
  version: 'srd51-audited-pilot-v1',
  races: { dwarf: { id: 'dwarf', grants: [
    { type: 'ability', ability: 'con', amount: 2, source: 'dwarf' },
    { type: 'hp-per-level', amount: 1, source: 'dwarf' }
  ] } },
  backgrounds: { acolyte: { id: 'acolyte', grants: [
    { type: 'skill', skill: 'insight', source: 'acolyte' }
  ], choices: [{ id: 'languages', count: 2, options: [
    { id: 'elvish', grants: [{ type: 'language', language: 'elvish', source: 'acolyte' }] },
    { id: 'dwarvish', grants: [{ type: 'language', language: 'dwarvish', source: 'acolyte' }] },
    { id: 'draconic', grants: [{ type: 'language', language: 'draconic', source: 'acolyte' }] }
  ] }] } },
  classes: { barbarian: { id: 'barbarian', levels: Array.from({ length: 20 }, (_, i) => ({
    level: i + 1, hitDie: 12, grants: i === 0 ? [{ type: 'feature' as const, feature: 'rage', source: 'barbarian' }] : []
  })) } }
};
const draft: CharacterDraft = {
  id: 'hero-1', name: 'Dorna', ruleset: '5e-2014', catalogueVersion: catalog.version,
  baseAbilities: { str: 15, dex: 12, con: 14, int: 10, wis: 12, cha: 8 },
  raceId: 'dwarf', backgroundId: 'acolyte', classId: 'barbarian', level: 1,
  decisions: [{ id: 'languages', optionIds: ['elvish', 'draconic'] }],
  inventory: [{ id: 'start-rope', itemId: 'rope', quantity: 1, equipped: false, origin: 'starting' }],
  currentHp: 16, temporaryHp: 0, spentResources: {}
};
describe('character domain: sheet, decisions and inventory', () => {
  it('creates a sheet from stable IDs with traceable grants', () => {
    const sheet = createCharacterSheet(draft, catalog);
    expect(sheet.maxHp).toBe(16);
    expect(sheet.languages).toEqual(['elvish', 'draconic']);
    expect(sheet.features).toContain('rage');
    expect(sheet.pending).toEqual([]);
    expect(sheet.inventory).toEqual(draft.inventory);
    expect(sheet.provenance.some(g => g.source === 'dwarf')).toBe(true);
  });
  it('flags missing, duplicated, stale and unknown decisions', () => {
    expect(createCharacterSheet({ ...draft, decisions: [] }, catalog).pending).toEqual(['languages']);
    expect(createCharacterSheet({ ...draft, decisions: [{ id: 'languages', optionIds: ['elvish', 'elvish'] }] }, catalog).pending).toEqual(['languages']);
    expect(createCharacterSheet({ ...draft, decisions: [{ id: 'languages', optionIds: ['elvish', 'deleted'] }] }, catalog).pending).toEqual(['languages']);
    expect(createCharacterSheet({ ...draft, decisions: [{ id: 'unknown', optionIds: [] }] }, catalog).pending).toEqual(['unknown-choice:unknown', 'languages']);
  });
  it('rejects duplicate decision records even when each selection is valid', () => {
    const decisions = [draft.decisions[0], { ...draft.decisions[0], optionIds: ['dwarvish', 'draconic'] }];
    expect(() => createCharacterSheet({ ...draft, decisions }, catalog)).toThrow('Duplicate decision ID');
  });
  it('keeps the character inventory independent from starting grants', () => {
    const next = applyInventoryChange(draft, 'torch', 3);
    expect(next.inventory).toHaveLength(2);
    expect(next.inventory[1]).toMatchObject({ itemId: 'torch', quantity: 3 });
    expect(draft.inventory).toHaveLength(1);
    expect(applyInventoryChange(next, 'torch', -2).inventory[1].quantity).toBe(1);
    expect(applyInventoryChange(next, 'torch', -3).inventory).toHaveLength(1);
    expect(() => applyInventoryChange(draft, 'torch', -1)).toThrow();
  });
  it('blocks wrong rulesets, catalogue drift, invalid resources and hit points', () => {
    expect(() => createCharacterSheet({ ...draft, catalogueVersion: 'different' }, catalog)).toThrow('Catalogue version mismatch');
    expect(() => createCharacterSheet({ ...draft, currentHp: 17 }, catalog)).toThrow('Current HP exceeds maximum');
    expect(() => createCharacterSheet({ ...draft, spentResources: { rage: 1 } }, catalog)).toThrow('Unknown spent resource');
    expect(() => createCharacterSheet({ ...draft, inventory: [...draft.inventory, { ...draft.inventory[0] }] }, catalog)).toThrow('Invalid inventory entry');
  });
  it('rebuilds every level from 1 to 20 without mutating decisions or inventory', () => {
    const original = JSON.stringify(draft);
    for (let level = 1; level <= 20; level++) {
      const sheet = createCharacterSheet({ ...draft, level }, catalog);
      expect(sheet.maxHp).toBeGreaterThanOrEqual(16);
      expect(sheet.inventory).toHaveLength(1);
      expect(sheet.languages).toHaveLength(2);
    }
    expect(JSON.stringify(draft)).toBe(original);
  });
});

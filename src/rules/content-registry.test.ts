import { describe, expect, it } from 'vitest';
import { characterPointerKey, contentKey, validateContentRegistry, type ContentRegistry } from './content-registry';

const registry: ContentRegistry = {
  sources: [
    { id: 'srd-2014', origin: 'srd-2014', title: 'SRD 2014', ruleset: '5e-2014', license: 'review-before-publishing' },
    { id: 'my-campaign', origin: 'homebrew', title: 'My campaign', ruleset: '5e-2014' },
    { id: 'licensed-book', origin: 'supplement', title: 'Licensed supplement', publisher: 'Example', ruleset: '5e-2014' }
  ],
  entries: [
    { ref: { sourceId: 'srd-2014', kind: 'class', id: 'barbarian', revision: '1' }, name: 'Barbarian', ruleset: '5e-2014' },
    { ref: { sourceId: 'my-campaign', kind: 'class', id: 'barbarian', revision: '1' }, name: 'Custom Barbarian', ruleset: '5e-2014' },
    { ref: { sourceId: 'my-campaign', kind: 'feat', id: 'iron-will', revision: '1' }, name: 'Iron Will', ruleset: '5e-2014',
      prerequisites: [{ sourceId: 'srd-2014', kind: 'class', id: 'barbarian', revision: '1' }] },
    { ref: { sourceId: 'licensed-book', kind: 'race', id: 'new-race', revision: '1' }, name: 'New Race', ruleset: '5e-2014' }
  ]
};
describe('extensible character content registry', () => {
  it('allows official, homebrew and supplement content without identifier collisions', () => {
    expect(() => validateContentRegistry(registry)).not.toThrow();
    expect(contentKey(registry.entries[0].ref)).not.toBe(contentKey(registry.entries[1].ref));
  });
  it('rejects unknown prerequisites and duplicate versioned entries', () => {
    expect(() => validateContentRegistry({ ...registry, entries: [...registry.entries, registry.entries[0]] }))
      .toThrow('Duplicate content entry');
    expect(() => validateContentRegistry({ ...registry, entries: [
      ...registry.entries.slice(0, 2), { ...registry.entries[2], prerequisites: [
        { sourceId: 'my-campaign', kind: 'feat', id: 'missing', revision: '1' }
      ] }, registry.entries[3]
    ] })).toThrow('Unresolved content prerequisite');
  });
  it('uses one character identity while separating personal and campaign state', () => {
    const personal = characterPointerKey({ characterId: 'hero-1', scope: { type: 'personal' } });
    const campaign = characterPointerKey({ characterId: 'hero-1',
      scope: { type: 'campaign', campaignId: 'camp-1', participationId: 'member-1' } });
    expect(personal).not.toBe(campaign);
    expect(campaign).toContain('hero-1');
    expect(() => characterPointerKey({ characterId: 'hero-1',
      scope: { type: 'campaign', campaignId: '', participationId: 'member-1' } })).toThrow();
  });
});

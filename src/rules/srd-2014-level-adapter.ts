/** Read-only adapter for the public D&D 5e SRD API /api/2014 class level records.
 * Transforms external data into an auditable local index; it does not infer rule effects.
 * https://docs.dnd5eapi.co/api/get-all-level-resources-for-a-class
 */
export type SrdClassLevel = {
  level: number;
  prof_bonus?: number;
  ability_score_bonuses?: number;
  features?: { index: string; name: string; url?: string }[];
  class_specific?: Record<string, unknown>;
  spellcasting?: Record<string, unknown>;
};
export type SrdLevelIndex = {
  level: number;
  proficiencyBonus: number;
  abilityScoreBonusTotal: number;
  featureIds: string[];
  classSpecific: Record<string, unknown>;
  spellcasting: Record<string, unknown>;
};
const ID = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
export function indexSrd2014ClassLevels(classId: string, records: SrdClassLevel[]): SrdLevelIndex[] {
  if (!ID.test(classId) || records.length !== 20) throw new Error('Invalid SRD class levels');
  const seen = new Set<string>();
  return records.map((record, i) => {
    if (record.level !== i + 1 || record.prof_bonus !== 2 + Math.floor(i / 4) ||
      !Number.isSafeInteger(record.ability_score_bonuses) || record.ability_score_bonuses! < 0 ||
      !Array.isArray(record.features)) throw new Error('Invalid SRD level record');
    const featureIds = record.features.map(feature => {
      if (!ID.test(feature.index) || !feature.name?.trim()) throw new Error('Invalid SRD feature');
      if (seen.has(feature.index)) throw new Error('Repeated SRD feature identifier');
      seen.add(feature.index);
      return feature.index;
    });
    if (i > 0 && record.ability_score_bonuses! < records[i - 1].ability_score_bonuses!)
      throw new Error('Decreasing SRD ability score bonus');
    return {
      level: record.level,
      proficiencyBonus: record.prof_bonus,
      abilityScoreBonusTotal: record.ability_score_bonuses!,
      featureIds,
      classSpecific: { ...(record.class_specific ?? {}) },
      spellcasting: { ...(record.spellcasting ?? {}) }
    };
  });
}

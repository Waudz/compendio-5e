/** Regras de personagem versionadas; não publica nem altera o catálogo geral. */
import snapshot from './data/character-2014.json';
import type {
  CharacterCatalog,
  CharacterDraft,
  CharacterSheet,
  StableChoice,
} from '../rules/character-domain';
import { createCharacterSheet } from '../rules/character-domain';
import type { Ability, Grant } from '../rules/character-build-pilot';
import { rotuloAtributo } from './rotulos';
import { srdItem } from '../catalogue/srd-2014-items';
import { modifier } from '../rules/character-build-pilot';
import {
  coreClassAsiAdvancements,
  type CoreClass,
} from '../rules/class-asi-2014';

export const VERSION_2014 = 'character-srd-2014-v2';
type Effect = {
  type: string;
  category?: string;
  target?: string;
  id?: string;
  choose?: number;
  grants?: string;
  from?: string[];
  ability?: Ability;
  value?: number;
  max?: number;
  term?: number;
  spell?: string;
  minLevel?: number;
  spellLevel?: number;
  spellUpTo?: number;
  spellClass?: string;
  ritual?: boolean;
};
type Feature = {
  id: string;
  nome?: string;
  en?: string;
  descricao?: string;
  desc?: string;
  effects: Effect[];
  data: {
    level?: number;
    prerequisites?: {
      type: string;
      level?: number;
      feature?: string;
      spell?: string;
    }[];
  };
};
type Level = {
  level: number;
  features: string[];
  cantripsKnown?: number;
  spellsKnown?: number;
  spellSlots?: number[];
  classSpecific?: Record<string, unknown>;
};
export type Component = {
  item?: string;
  quantity?: number;
  category?: string;
  count?: number;
};
export type Class2014 = {
  id: string;
  effects: Effect[];
  data: {
    hitDie: number;
    levels: Level[];
    spellcasting?: {
      ability: Ability;
      startsAtLevel: number;
      preparation: { type: string };
    };
    startingEquipment: Component[];
    startingChoices: { options: { items: Component[]; requires?: string }[] }[];
  };
};
type Race = {
  index: string;
  name: string;
  speed: number;
  size: string;
  ability_bonuses: { ability_score: { index: Ability }; bonus: number }[];
  languages: { index: string }[];
  language_options?: { choose: number };
  traits: { index: string }[];
};
type Subrace = {
  index: string;
  race: { index: string };
  ability_bonuses: Race['ability_bonuses'];
  racial_traits: { index: string }[];
};
export type Spell2014 = {
  id: string;
  name: string;
  en: string;
  level: number;
  classes: string[];
  description: string;
  details: string;
  ritual: boolean;
};
const data = snapshot as unknown as {
  classes: Class2014[];
  subclasses: {
    id: string;
    parent: string;
    data: {
      levels: { level: number; features: string[] }[];
      spells?: { spell: string; classLevel: number }[];
      expanded?: string[];
    };
    descricao?: string;
  }[];
  features: Feature[];
  races: Race[];
  subraces: Subrace[];
  traits: { index: string; name: string; desc: string[] }[];
  spells: Spell2014[];
  weaponProficiencies: Record<string, string[]>;
  itemIds: Record<string, string>;
  itemCategories: Record<
    string,
    {
      category: string;
      weapon?: { category: string; kind: string };
      gear?: { category: string };
      tool?: { category: string };
      type?: string;
    }
  >;
};
export const classes2014 = data.classes;
export const spells2014 = [...data.spells].sort(
  (a, b) => a.level - b.level || a.name.localeCompare(b.name, 'pt-BR'),
);
export const nomes2014: Record<string, string> = {
  barbarian: 'Bárbaro',
  bard: 'Bardo',
  cleric: 'Clérigo',
  druid: 'Druida',
  fighter: 'Guerreiro',
  monk: 'Monge',
  paladin: 'Paladino',
  ranger: 'Patrulheiro',
  rogue: 'Ladino',
  sorcerer: 'Feiticeiro',
  warlock: 'Bruxo',
  wizard: 'Mago',
  dwarf: 'Anão',
  'hill-dwarf': 'Anão da Colina',
  elf: 'Elfo',
  'high-elf': 'Elfo Alto',
  halfling: 'Halfling',
  'lightfoot-halfling': 'Halfling Pés Leves',
  human: 'Humano',
  dragonborn: 'Draconato',
  gnome: 'Gnomo',
  'rock-gnome': 'Gnomo da Rocha',
  'half-elf': 'Meio-elfo',
  'half-orc': 'Meio-orc',
  tiefling: 'Tiefling',
  acolyte: 'Acólito',
  custom: 'Origem personalizada',
  berserker: 'Berserker',
  lore: 'Conhecimento',
  life: 'Vida',
  land: 'Terra',
  champion: 'Campeão',
  'open-hand': 'Mão Espalmada',
  devotion: 'Devoção',
  hunter: 'Caçador',
  thief: 'Ladrão',
  draconic: 'Linhagem Dracônica',
  fiend: 'Corruptor',
  evocation: 'Evocação',
};
export const shortId = (id: string) => id.split('/').at(-1)!;
const idioma2014: Record<string, string> = {
  common: 'Comum',
  dwarvish: 'Anão',
  elvish: 'Élfico',
  giant: 'Gigante',
  gnomish: 'Gnômico',
  goblin: 'Goblin',
  halfling: 'Halfling',
  orc: 'Orc',
  abyssal: 'Abissal',
  celestial: 'Celestial',
  draconic: 'Dracônico',
  'deep-speech': 'Dialeto Subterrâneo',
  infernal: 'Infernal',
  primordial: 'Primordial',
  sylvan: 'Silvestre',
  undercommon: 'Subcomum',
};
export const label2014 = (id: string): string =>
  id.startsWith('language:')
    ? (idioma2014[id.slice(9)] ?? id)
    : id.startsWith('tool:')
      ? (srdItem(data.itemIds['srd51:item/' + id.slice(5)])?.nome ?? id)
      : (idioma2014[id] ??
        nomes2014[shortId(id)] ??
        data.features.find((f) => f.id === id)?.nome ??
        data.features.find((f) => f.id === id)?.en ??
        id.replaceAll('-', ' '));
export const modern2014 = (d: CharacterDraft) =>
  d.catalogueVersion === VERSION_2014;
export const selected2014 = (d: CharacterDraft, id: string) =>
  d.decisions.find((c) => c.id === id)?.optionIds ?? [];
export const decide2014 = (
  d: CharacterDraft,
  id: string,
  optionIds: string[],
): CharacterDraft => ({
  ...d,
  decisions: [...d.decisions.filter((c) => c.id !== id), { id, optionIds }],
});
export const class2014 = (d: CharacterDraft) => {
  const c = data.classes.find((c) => shortId(c.id) === d.classId);
  if (!c) throw Error('Classe SRD 2014 desconhecida.');
  return c;
};
export const races2014 = data.races.flatMap((r) => {
  const sub = data.subraces.filter((s) => s.race.index === r.index);
  return sub.length
    ? sub.map((s) => ({ id: s.index, name: label2014(s.index) }))
    : [{ id: r.index, name: label2014(r.index) }];
});
function race2014(d: CharacterDraft) {
  const sub = data.subraces.find((s) => s.index === d.raceId);
  const race = data.races.find(
    (r) => r.index === (sub?.race.index ?? d.raceId),
  );
  if (!race) throw Error('Raça SRD 2014 desconhecida.');
  return { race, sub };
}
export type Choice2014 = {
  id: string;
  name: string;
  count: number;
  kind:
    | 'skill'
    | 'expertise'
    | 'feature'
    | 'spell'
    | 'ability'
    | 'language'
    | 'proficiency';
  options: { id: string; name: string }[];
};
export function features2014(d: CharacterDraft): Feature[] {
  const c = class2014(d),
    sub = data.subclasses.find(
      (s) =>
        shortId(s.id) === selected2014(d, 'subclass')[0] && s.parent === c.id,
    );
  const ids = [
    ...c.data.levels
      .filter((l) => l.level <= d.level)
      .flatMap((l) => l.features),
    ...(sub?.data.levels
      .filter((l) => l.level <= d.level)
      .flatMap((l) => l.features) ?? []),
  ];
  const seen = new Set<string>();
  const out: Feature[] = [];
  for (let i = 0; i < ids.length; i++) {
    const id = ids[i];
    if (seen.has(id)) continue;
    seen.add(id);
    const f = data.features.find((f) => f.id === id);
    if (!f) continue;
    out.push(f);
    for (const e of f.effects.filter(
      (e) => e.type === 'choice' && e.grants === 'trait',
    ))
      ids.push(
        ...selected2014(d, f.id + ':' + e.id).filter(
          (id) => (e.from ?? []).includes(id) && prerequisite2014(d, id),
        ),
      );
  }
  return out;
}
const allSkills = [
  'acrobatics',
  'animal-handling',
  'arcana',
  'athletics',
  'deception',
  'history',
  'insight',
  'intimidation',
  'investigation',
  'medicine',
  'nature',
  'perception',
  'performance',
  'persuasion',
  'religion',
  'sleight-of-hand',
  'stealth',
  'survival',
];
const languages = [
  'common',
  'dwarvish',
  'elvish',
  'giant',
  'gnomish',
  'goblin',
  'halfling',
  'orc',
  'abyssal',
  'celestial',
  'draconic',
  'deep-speech',
  'infernal',
  'primordial',
  'sylvan',
  'undercommon',
];
export function choices2014(d: CharacterDraft): Choice2014[] {
  const c = class2014(d),
    level = c.data.levels[d.level - 1];
  const { race } = race2014(d);
  const out: Choice2014[] = [];
  const add = (
    id: string,
    name: string,
    count: number,
    kind: Choice2014['kind'],
    ids: string[],
  ) => {
    if (count > 0)
      out.push({
        id,
        name,
        count,
        kind,
        options: ids
          .filter((id) => kind !== 'feature' || prerequisite2014(d, id))
          .map((id) => ({
            id,
            name:
              kind === 'spell'
                ? (data.spells.find((s) => s.id === id)?.name ?? id)
                : label2014(id),
          })),
      });
  };
  for (const e of c.effects.filter((e) => e.type === 'choice'))
    add(
      e.id!,
      'Proficiências de ' + label2014(c.id),
      e.choose!,
      e.from?.[0]?.startsWith('skill:') ? 'skill' : 'proficiency',
      (e.from ?? []).map((x) => x.replace(/^skill:/, '')),
    );
  const sub = data.subclasses.find((s) => s.parent === c.id);
  if (sub && d.level >= sub.data.levels[0].level)
    add('subclass', 'Subclasse', 1, 'feature', [shortId(sub.id)]);
  for (const a of coreClassAsiAdvancements(shortId(c.id) as CoreClass))
    if (a.level <= d.level)
      for (const ch of a.choices ?? [])
        add(
          ch.id,
          'Melhoria de atributo — nível ' + a.level,
          ch.count,
          'feature',
          ch.options.map((o) => o.id),
        );
  for (const f of features2014(d))
    for (const e of f.effects.filter((e) => e.type === 'choice')) {
      let kind: Choice2014['kind'] =
        e.grants === 'spell'
          ? 'spell'
          : e.grants === 'expertise'
            ? 'expertise'
            : e.grants === 'proficiency'
              ? 'skill'
              : 'feature';
      let ids = e.from ?? [];
      if (kind === 'expertise' && d.classId === 'rogue')
        ids = [...new Set([...ids, 'thieves-tools'])];
      if (kind === 'skill') ids = ids.map((x) => x.replace(/^skill:/, ''));
      if (kind === 'spell')
        ids = spells2014
          .filter(
            (s) =>
              (e.spellLevel === undefined || s.level === e.spellLevel) &&
              (e.spellUpTo === undefined || s.level <= e.spellUpTo) &&
              (!e.spellClass || s.classes.includes(shortId(e.spellClass))) &&
              (!e.ritual || s.ritual) &&
              (!['spell-mastery', 'signature-spell'].includes(shortId(f.id)) ||
                knownSpellIds2014(d).includes(s.id)),
          )
          .map((s) => s.id);
      const n =
        shortId(f.id) === 'eldritch-invocations'
          ? Number(level.classSpecific?.invocationsKnown ?? e.choose)
          : shortId(f.id) === 'metamagic-1'
            ? Number(level.classSpecific?.metamagicKnown ?? e.choose)
            : e.choose!;
      add(f.id + ':' + e.id, label2014(f.id), n, kind, ids);
    }
  if (race.index === 'half-elf') {
    add(
      'racial-abilities',
      'Versatilidade de atributos (exceto Carisma)',
      2,
      'ability',
      ['str', 'dex', 'con', 'int', 'wis'],
    );
    add('racial-skills', 'Versatilidade em perícias', 2, 'skill', allSkills);
  }
  const extra =
    race.index === 'human' ? 1 : (race.language_options?.choose ?? 0);
  if (extra)
    add(
      'racial-languages',
      'Idiomas da raça',
      extra,
      'language',
      languages.filter((x) => !race.languages.some((l) => l.index === x)),
    );
  if (d.raceId === 'high-elf') {
    add(
      'racial-cantrip',
      'Truque de Mago (Inteligência)',
      1,
      'spell',
      spells2014
        .filter((s) => s.level === 0 && s.classes.includes('wizard'))
        .map((s) => s.id),
    );
    add(
      'elf-language',
      'Idioma adicional',
      1,
      'language',
      languages.filter((x) => !race.languages.some((l) => l.index === x)),
    );
  }
  if (d.classId === 'ranger') {
    add(
      'favored-enemy',
      'Inimigos favoritos',
      Number(level.classSpecific?.favoredEnemies ?? 1),
      'feature',
      [
        'aberrations',
        'beasts',
        'celestials',
        'constructs',
        'dragons',
        'elementals',
        'fey',
        'fiends',
        'giants',
        'monstrosities',
        'oozes',
        'plants',
        'undead',
        'two-humanoids',
      ],
    );
    add(
      'favored-terrain',
      'Terrenos favoritos',
      Number(level.classSpecific?.favoredTerrain ?? 1),
      'feature',
      [
        'arctic',
        'coast',
        'desert',
        'forest',
        'grassland',
        'mountain',
        'swamp',
        'underdark',
      ],
    );
  }
  if (
    d.classId === 'ranger' &&
    selected2014(d, 'favored-enemy').includes('two-humanoids')
  )
    add(
      'humanoid-types',
      'Duas raças humanoides como inimigas favoritas',
      2,
      'feature',
      [
        'gnolls',
        'goblinoids',
        'orcs',
        'elves',
        'dwarves',
        'gnomes',
        'humans',
        'halflings',
        'kobolds',
        'lizardfolk',
        'sahuagin',
        'troglodytes',
      ],
    );
  if (race.index === 'dwarf')
    add('dwarf-tool', 'Ferramenta dos anões', 1, 'proficiency', [
      'tool:smiths-tools',
      'tool:brewers-supplies',
      'tool:masons-tools',
    ]);
  if (race.index === 'dragonborn')
    add('dragon-ancestry', 'Ancestral dracônico', 1, 'feature', [
      'black',
      'blue',
      'brass',
      'bronze',
      'copper',
      'gold',
      'green',
      'red',
      'silver',
      'white',
    ]);
  if (d.backgroundId === 'acolyte')
    add(
      'background-languages',
      'Idiomas da origem',
      2,
      'language',
      languages.filter((x) => !race.languages.some((l) => l.index === x)),
    );
  if (d.backgroundId === 'custom') {
    add('background-skills', 'Perícias da origem', 2, 'skill', allSkills);
    add(
      'background-training',
      'Idiomas e ferramentas da origem personalizada',
      2,
      'proficiency',
      [
        ...languages.map((id) => 'language:' + id),
        ...Object.entries(data.itemCategories)
          .filter(([, v]) => v.category === 'tools')
          .map(([id]) => 'tool:' + shortId(id)),
      ],
    );
  }
  const slots = level.spellSlots ?? [],
    max = slots.reduce((n, count, i) => (count > 0 ? i + 1 : n), 0);
  if (level.cantripsKnown)
    add(
      'cantrips',
      'Truques da classe',
      level.cantripsKnown,
      'spell',
      spells2014
        .filter((s) => s.level === 0 && s.classes.includes(d.classId))
        .map((s) => s.id),
    );
  if (c.data.spellcasting && d.level >= c.data.spellcasting.startsAtLevel) {
    const mode = c.data.spellcasting.preparation.type;
    const secrets = features2014(d)
      .filter((f) => /^magical-secrets-[123]$/.test(shortId(f.id)))
      .reduce(
        (n, f) =>
          n +
          f.effects
            .filter((e) => e.type === 'choice')
            .reduce((a, e) => a + (e.choose ?? 0), 0),
        0,
      );
    const known =
      level.spellsKnown !== undefined
        ? level.spellsKnown - secrets
        : mode === 'spellbook'
          ? 6
          : 0;
    const sub = data.subclasses.find(
      (s) =>
        s.parent === c.id && shortId(s.id) === selected2014(d, 'subclass')[0],
    );
    const expanded = sub?.data.expanded?.map(shortId) ?? [];
    const pool = spells2014
      .filter(
        (s) =>
          s.level > 0 &&
          s.level <= max &&
          (s.classes.includes(d.classId) || expanded.includes(s.id)) &&
          !automaticSpells2014(d, false).some((a) => a.id === s.id),
      )
      .map((s) => s.id);
    if (known)
      add(
        'spells-known',
        mode === 'spellbook'
          ? 'Grimório — seis magias iniciais (nível 1)'
          : 'Magias conhecidas',
        known,
        'spell',
        mode === 'spellbook'
          ? pool.filter(
              (id) => spells2014.find((s) => s.id === id)?.level === 1,
            )
          : pool,
      );
    if (mode === 'spellbook')
      for (let n = 2; n <= d.level; n++) {
        const maxAtLevel = (c.data.levels[n - 1].spellSlots ?? []).reduce(
          (v, count, i) => (count ? i + 1 : v),
          0,
        );
        add(
          'spellbook-level-' + n,
          'Grimório — duas magias do nível ' + n,
          2,
          'spell',
          pool.filter(
            (id) => spells2014.find((s) => s.id === id)!.level <= maxAtLevel,
          ),
        );
      }
    if (['prepared', 'spellbook'].includes(mode)) {
      const score = effectiveAbilities2014(d)[c.data.spellcasting.ability];
      const mod = modifier(score);
      const prep = Math.max(
        1,
        mod +
          (['paladin'].includes(d.classId) ? Math.floor(d.level / 2) : d.level),
      );
      add(
        'spells-prepared',
        'Magias preparadas',
        prep,
        'spell',
        mode === 'spellbook'
          ? pool.filter((id) => knownSpellIds2014(d).includes(id))
          : pool,
      );
    }
  }
  return out;
}
function grantsForChoice(ch: Choice2014, id: string): Grant[] {
  const source = ch.id;
  if (id === 'none') return [];
  return ch.kind === 'proficiency' && id.startsWith('language:')
    ? [{ type: 'language', language: id.slice(9), source }]
    : ch.kind === 'skill'
      ? [{ type: 'skill', skill: id, source }]
      : ch.kind === 'language'
        ? [{ type: 'language', language: id, source }]
        : ch.kind === 'ability'
          ? [{ type: 'ability', ability: id as Ability, amount: 1, source }]
          : ch.kind === 'spell' || ch.kind === 'expertise'
            ? []
            : [{ type: 'feature', feature: id, source }];
}
export function catalog2014(d: CharacterDraft): CharacterCatalog {
  const c = class2014(d),
    { race, sub } = race2014(d),
    features = features2014(d),
    choices = choices2014(d);
  const raceGrants: Grant[] = [
    ...race.ability_bonuses,
    ...(sub?.ability_bonuses ?? []),
  ].map((b) => ({
    type: 'ability',
    ability: b.ability_score.index,
    amount: b.bonus,
    source: d.raceId,
  }));
  raceGrants.push(
    ...race.languages.map((l) => ({
      type: 'language' as const,
      language: l.index,
      source: d.raceId,
    })),
  );
  if (d.raceId === 'hill-dwarf')
    raceGrants.push({ type: 'hp-per-level', amount: 1, source: d.raceId });
  if (race.index === 'half-orc')
    raceGrants.push({ type: 'skill', skill: 'intimidation', source: d.raceId });
  if (race.index === 'elf')
    raceGrants.push({ type: 'skill', skill: 'perception', source: d.raceId });

  if (race.index === 'dragonborn')
    raceGrants.push({
      type: 'resource',
      resource: 'breath-weapon',
      uses: 1,
      source: d.raceId,
    });
  if (race.index === 'tiefling' && d.level >= 3)
    raceGrants.push({
      type: 'resource',
      resource: 'infernal-rebuke',
      uses: 1,
      source: d.raceId,
    });
  if (race.index === 'tiefling' && d.level >= 5)
    raceGrants.push({
      type: 'resource',
      resource: 'infernal-darkness',
      uses: 1,
      source: d.raceId,
    });
  const subclass = selected2014(d, 'subclass')[0];
  if (d.classId === 'sorcerer' && subclass === 'draconic')
    raceGrants.push({
      type: 'hp-per-level',
      amount: 1,
      source: 'draconic-resilience',
    });
  const asi = coreClassAsiAdvancements(d.classId as CoreClass);
  const sourceChoices = choices.map((ch) => ({
    id: ch.id,
    count: ch.count,
    options: ch.options.map((o) => ({
      id: o.id,
      grants:
        asi
          .flatMap((a) => a.choices ?? [])
          .find((c) => c.id === ch.id)
          ?.options.find((x) => x.id === o.id)?.grants ??
        grantsForChoice(ch, o.id),
    })),
  }));
  raceGrants.push(
    ...features.map((f) => ({
      type: 'feature' as const,
      feature: f.id,
      source: f.id,
    })),
  );
  raceGrants.push({
    type: 'resource',
    resource: 'hit-dice',
    uses: d.level,
    source: 'character-level',
  });
  for (const [index, uses] of (
    c.data.levels[d.level - 1].spellSlots ?? []
  ).entries())
    if (uses > 0)
      raceGrants.push({
        type: 'resource',
        resource: 'spell-slot-' + (index + 1),
        uses,
        source: c.id,
      });
  if (d.classId === 'fighter')
    raceGrants.push({
      type: 'resource',
      resource: 'second-wind',
      uses: 1,
      source: c.id,
    });
  if (d.classId === 'druid' && d.level >= 2)
    raceGrants.push({
      type: 'resource',
      resource: 'wild-shape',
      uses: 2,
      source: c.id,
    });
  if (d.classId === 'paladin')
    raceGrants.push({
      type: 'resource',
      resource: 'divine-sense',
      uses: Math.max(0, 1 + modifier(effectiveAbilities2014(d).cha)),
      source: c.id,
    });
  if (d.classId === 'paladin' && d.level >= 3)
    raceGrants.push({
      type: 'resource',
      resource: 'channel-divinity',
      uses: 1,
      source: c.id,
    });
  if (d.classId === 'paladin')
    raceGrants.push({
      type: 'resource',
      resource: 'lay-on-hands',
      uses: 5 * d.level,
      source: c.id,
    });
  if (d.classId === 'bard')
    raceGrants.push({
      type: 'resource',
      resource: 'bardic-inspiration',
      uses: Math.max(1, modifier(effectiveAbilities2014(d).cha)),
      source: c.id,
    });
  for (const id of [
    'arcane-recovery',
    'natural-recovery',
    'divine-intervention',
    'wholeness-of-body',
    'cleansing-touch',
    'stroke-of-luck',
    'dark-ones-own-luck',
    'hurl-through-hell',
  ])
    if (features.some((f) => shortId(f.id) === id))
      raceGrants.push({
        type: 'resource',
        resource: id,
        uses:
          id === 'cleansing-touch'
            ? Math.max(1, modifier(effectiveAbilities2014(d).cha))
            : 1,
        source: c.id,
      });
  const specific = c.data.levels[d.level - 1].classSpecific ?? {};
  for (const key of [
    'rageCount',
    'channelDivinityCharges',
    'actionSurges',
    'indomitableUses',
    'kiPoints',
    'sorceryPoints',
  ])
    if (typeof specific[key] === 'number' && (specific[key] as number) > 0)
      raceGrants.push({
        type: 'resource',
        resource: key,
        uses:
          key === 'rageCount' && d.level === 20
            ? null
            : (specific[key] as number),
        source: c.id,
      });
  return {
    version: VERSION_2014,
    races: {
      [d.raceId]: { id: d.raceId, grants: raceGrants, choices: sourceChoices },
    },
    backgrounds: {
      [d.backgroundId]: {
        id: d.backgroundId,
        grants:
          d.backgroundId === 'acolyte'
            ? [
                { type: 'skill', skill: 'insight', source: 'acolyte' },
                { type: 'skill', skill: 'religion', source: 'acolyte' },
              ]
            : [],
      },
    },
    classes: {
      [d.classId]: {
        id: d.classId,
        levels: c.data.levels.map((l) => ({
          level: l.level,
          hitDie: c.data.hitDie,
          grants: l.features.flatMap((id) => [
            {
              type: 'feature' as const,
              feature: id,
              source: c.id + '-' + l.level,
            },
            ...(data.features.find((f) => f.id === id)?.effects ?? [])
              .filter((e) => e.type === 'abilityBonus')
              .map((e) => ({
                type: 'ability' as const,
                ability: e.ability!,
                amount: e.value!,
                max: e.max,
                source: id,
              })),
          ]),
        })),
      },
    },
  };
}
export function sheet2014(d: CharacterDraft): CharacterSheet {
  if (!Number.isInteger(d.level) || d.level < 1 || d.level > 20)
    throw Error('Nível inválido.');
  const choices = choices2014(d);
  const valid = new Set(choices.map((c) => c.id));
  const prepared = {
    ...d,
    name: d.name.trim() || 'Sem nome',
    decisions: d.decisions.filter((x) => valid.has(x.id)),
  };
  if (!['acolyte', 'custom'].includes(d.backgroundId))
    throw Error('Origem desconhecida.');
  const sheet = createCharacterSheet(prepared, catalog2014(d));
  sheet.draft = d;
  if (d.hpRolls)
    for (let level = 2; level <= d.level; level++)
      if (
        selected2014(d, 'hp-roll-confirmed-' + level)[0] !==
        String(d.hpRolls[level - 2])
      )
        sheet.pending.push('hp-roll-confirmed-' + level);
  if (
    d.backgroundId === 'custom' &&
    (!selected2014(d, 'background-feature')[0]?.trim() ||
      selected2014(d, 'background-feature')[0].length > 500)
  )
    sheet.pending.push('background-feature');
  const trained = new Set<string>(
    d.backgroundId === 'acolyte' ? ['insight', 'religion'] : [],
  );
  if (d.raceId === 'half-orc') trained.add('intimidation');
  if (['elf', 'high-elf'].includes(d.raceId)) trained.add('perception');
  const acquiredProficiencies = new Set(
    class2014(d)
      .effects.filter((e) => e.type === 'proficiency')
      .map((e) => e.category + ':' + e.target),
  );
  if (d.raceId === 'rock-gnome')
    acquiredProficiencies.add('tool:tinkers-tools');
  const expertise = new Set<string>();
  const selectedFeatures = new Set<string>();
  const knownLanguages = new Set(
    race2014(d).race.languages.map((l) => l.index),
  );
  for (const ch of choices) {
    for (const id of selected2014(d, ch.id)) {
      if (ch.kind === 'feature' && id.startsWith('srd51:feature/')) {
        if (selectedFeatures.has(id))
          sheet.pending.push('duplicate-feature:' + ch.id);
        selectedFeatures.add(id);
      }
      if (
        ch.kind === 'language' ||
        (ch.kind === 'proficiency' && id.startsWith('language:'))
      ) {
        const language = id.replace(/^language:/, '');
        if (knownLanguages.has(language))
          sheet.pending.push('duplicate-language:' + ch.id);
        knownLanguages.add(language);
      } else if (ch.kind === 'proficiency') {
        if (acquiredProficiencies.has(id))
          sheet.pending.push('duplicate-proficiency:' + ch.id);
        acquiredProficiencies.add(id);
      }
      if (ch.kind === 'skill') {
        if (trained.has(id)) sheet.pending.push('duplicate-skill:' + ch.id);
        trained.add(id);
      }
      if (ch.kind === 'expertise') {
        if (
          (!sheet.skills.includes(id) &&
            !(id.includes('thieves-tools') && d.classId === 'rogue')) ||
          expertise.has(id)
        )
          sheet.pending.push('invalid-expertise:' + ch.id);
        expertise.add(id);
      }
    }
  }
  for (const ch of choices.filter(
    (c) => c.kind === 'spell' && c.id !== 'spells-prepared',
  ))
    for (const id of selected2014(d, ch.id)) {
      if (
        choices.some(
          (other) =>
            other.id !== ch.id &&
            other.kind === 'spell' &&
            other.id !== 'spells-prepared' &&
            !other.id.includes('spell-mastery') &&
            !other.id.includes('signature-spell') &&
            selected2014(d, other.id).includes(id),
        )
      )
        sheet.pending.push('duplicate-spell:' + ch.id);
    }
  // ASI choices are evaluated above as packages; keep their requirements visible here.
  for (const ch of choices) {
    const ids = selected2014(d, ch.id);
    if (
      ids.length !== ch.count ||
      new Set(ids).size !== ids.length ||
      ids.some((id) => !ch.options.some((o) => o.id === id))
    )
      if (!sheet.pending.includes(ch.id)) sheet.pending.push(ch.id);
  }
  return sheet;
}
export function change2014(
  d: CharacterDraft,
  patch: Partial<CharacterDraft>,
): CharacterDraft {
  const next = { ...d, ...patch };
  const max = sheet2014({ ...next, currentHp: 0 }).maxHp;
  return { ...next, currentHp: Math.min(d.currentHp, max) };
}
export function activate2014(d: CharacterDraft): CharacterDraft {
  if (modern2014(d)) return d;
  const { previousRulesDraft: _previous, ...original } = d;
  return change2014(d, {
    previousRulesDraft: structuredClone(original),
    catalogueVersion: VERSION_2014,
    classId: 'fighter',
    raceId: 'hill-dwarf',
    backgroundId: 'acolyte',
    decisions: (d.hpRolls ?? []).map((value, i) => ({
      id: 'hp-roll-confirmed-' + (i + 2),
      optionIds: [String(value)],
    })),
    spentResources: {},
  });
}
export function raceTraits2014(d: CharacterDraft) {
  const { race, sub } = race2014(d);
  return [...race.traits, ...(sub?.racial_traits ?? [])]
    .map((t) => data.traits.find((x) => x.index === t.index))
    .filter((t): t is (typeof data.traits)[number] => !!t)
    .map((t) => ({
      ...t,
      name: traitPt[t.index]?.[0] ?? t.name,
      desc: traitPt[t.index] ? [traitPt[t.index][1]] : t.desc,
    }));
}
export function proficiency2014(d: CharacterDraft) {
  const chosen = choices2014(d)
    .filter((c) => c.kind === 'proficiency')
    .flatMap((c) => selected2014(d, c.id));
  if (['hill-dwarf', 'dwarf'].includes(d.raceId))
    chosen.push(
      'weapon: battleaxes',
      'weapon: handaxes',
      'weapon: light-hammers',
      'weapon: warhammers',
    );
  if (d.raceId === 'high-elf')
    chosen.push(
      'weapon: longswords',
      'weapon: shortswords',
      'weapon: shortbows',
      'weapon: longbows',
    );
  if (d.raceId === 'rock-gnome') chosen.push('tool:tinkers-tools');
  const effects = [
    ...class2014(d).effects,
    ...features2014(d).flatMap((f) => f.effects),
  ];
  return [
    ...new Set([
      ...chosen,
      ...effects
        .filter((e) => e.type === 'proficiency')
        .map((e) => e.category + ': ' + e.target),
    ]),
  ];
}
export function spellSlots2014(d: CharacterDraft) {
  return class2014(d).data.levels[d.level - 1].spellSlots ?? [];
}
export function equipment2014(d: CharacterDraft) {
  return class2014(d).data;
}
export function canonicalItem2014(id: string) {
  return data.itemIds[id];
}
export function equipmentCategory2014(category: string) {
  return Object.entries(data.itemCategories)
    .filter(([, v]) =>
      category === 'martial-weapons'
        ? v.weapon?.category === 'martial'
        : category === 'simple-weapons'
          ? v.weapon?.category === 'simple'
          : category === 'martial-melee-weapons'
            ? v.weapon?.category === 'martial' && v.weapon.kind === 'melee'
            : category === 'simple-melee-weapons'
              ? v.weapon?.category === 'simple' && v.weapon.kind === 'melee'
              : category === 'musical-instruments'
                ? v.tool?.category === 'musical-instrument'
                : v.gear?.category === category || v.category === category,
    )
    .map(([id]) => data.itemIds[id]);
}
export const featureDescription2014 = (id: string) =>
  (
    data.features.find((f) => f.id === id)?.descricao ??
    data.features.find((f) => f.id === id)?.desc ??
    ''
  )
    .replaceAll('\\n', '\n')
    .replace(/^#{1,6}\s*/gm, '')
    .replaceAll('**', '');
export function decisionsWithout2014(
  d: CharacterDraft,
  ids: string[],
): StableChoice[] {
  return d.decisions.filter((c) => !ids.includes(c.id));
}

export function effectiveAbilities2014(d: CharacterDraft) {
  const scores = { ...d.baseAbilities };
  const { race, sub } = race2014(d);
  for (const b of [...race.ability_bonuses, ...(sub?.ability_bonuses ?? [])])
    scores[b.ability_score.index] = Math.min(
      20,
      scores[b.ability_score.index] + b.bonus,
    );
  for (const id of selected2014(d, 'racial-abilities'))
    if (id in scores)
      scores[id as Ability] = Math.min(20, scores[id as Ability] + 1);
  for (const a of coreClassAsiAdvancements(d.classId as CoreClass).filter(
    (a) => a.level <= d.level,
  ))
    for (const ch of a.choices ?? [])
      for (const id of selected2014(d, ch.id))
        for (const g of ch.options.find((o) => o.id === id)?.grants ?? [])
          if (g.type === 'ability')
            scores[g.ability] = Math.min(
              g.max ?? 20,
              scores[g.ability] + g.amount,
            );
  for (const f of features2014(d))
    for (const e of f.effects)
      if (e.type === 'abilityBonus')
        scores[e.ability!] = Math.min(
          e.max ?? 20,
          scores[e.ability!] + e.value!,
        );
  return scores;
}
export function statistics2014(d: CharacterDraft) {
  const sheet = sheet2014(d),
    prof = 2 + Math.floor((d.level - 1) / 4),
    dex = modifier(sheet.abilities.dex);
  const equipped = d.inventory
    .filter((i) => i.equipped)
    .map((i) => srdItem(i.itemId))
    .filter((i): i is NonNullable<typeof i> => !!i);
  const armors = equipped.filter(
      (i) => i.armadura && i.armadura.categoria !== 'shield',
    ),
    shield = equipped.some((i) => i.armadura?.categoria === 'shield');
  let ac = 10 + dex;
  if (!armors.length) {
    if (d.classId === 'barbarian')
      ac = Math.max(ac, 10 + dex + modifier(sheet.abilities.con));
    if (d.classId === 'monk' && !shield)
      ac = Math.max(ac, 10 + dex + modifier(sheet.abilities.wis));
    if (
      d.classId === 'sorcerer' &&
      selected2014(d, 'subclass')[0] === 'draconic'
    )
      ac = Math.max(ac, 13 + dex);
  } else {
    const a = armors[0].armadura!;
    ac = a.ca + (a.somaDes ? Math.min(dex, a.maxDes ?? dex) : 0);
  }
  if (shield) ac += 2;
  if (
    armors.length &&
    features2014(d).some((f) => f.id.includes('fighting-style-defense'))
  )
    ac += 1;
  const abilities: Record<string, Ability> = {
    acrobatics: 'dex',
    'animal-handling': 'wis',
    arcana: 'int',
    athletics: 'str',
    deception: 'cha',
    history: 'int',
    insight: 'wis',
    intimidation: 'cha',
    investigation: 'int',
    medicine: 'wis',
    nature: 'int',
    perception: 'wis',
    performance: 'cha',
    persuasion: 'cha',
    religion: 'int',
    'sleight-of-hand': 'dex',
    stealth: 'dex',
    survival: 'wis',
  };
  const expertise = new Set(
    choices2014(d)
      .filter((c) => c.kind === 'expertise')
      .flatMap((c) => selected2014(d, c.id)),
  );
  const skills = Object.fromEntries(
    allSkills.map((id) => [
      id,
      modifier(sheet.abilities[abilities[id]]) +
        (sheet.skills.includes(id)
          ? prof * (expertise.has(id) ? 2 : 1)
          : d.classId === 'bard' && d.level >= 2
            ? Math.floor(prof / 2)
            : 0),
    ]),
  );
  const proficiency = new Set(proficiency2014(d));
  const saves = Object.fromEntries(
    (['str', 'dex', 'con', 'int', 'wis', 'cha'] as Ability[]).map((a) => [
      a,
      modifier(sheet.abilities[a]) + (proficiency.has('save: ' + a) ? prof : 0),
    ]),
  );
  const physical = features2014(d).some(
    (f) => shortId(f.id) === 'remarkable-athlete',
  );
  for (const id of allSkills)
    if (
      !sheet.skills.includes(id) &&
      physical &&
      ['str', 'dex', 'con'].includes(abilities[id])
    )
      skills[id] =
        modifier(sheet.abilities[abilities[id]]) + Math.ceil(prof / 2);
  const attacks = equipped
    .filter((i) => i.arma)
    .map((i) => {
      const w = i.arma!,
        ranged = w.alcance === 'ranged',
        ability = w.propriedades.includes('finesse')
          ? Math.max(modifier(sheet.abilities.str), dex)
          : ranged
            ? dex
            : modifier(sheet.abilities.str);
      const proficient =
        (data.weaponProficiencies[i.id] ?? []).some((p) =>
          proficiency.has(p.replace(':', ': ')),
        ) || proficiency.has('weapon: ' + w.categoria + '-weapons');
      const archery =
        ranged &&
        features2014(d).some((f) => f.id.endsWith('fighting-style-archery'));
      return {
        id: i.id,
        name: i.nome,
        bonus: ability + (proficient ? prof : 0) + (archery ? 2 : 0),
        damage: w.dano?.dado ?? '—',
        damageBonus: ability,
        proficient,
        heavyDisadvantage:
          race2014(d).race.size === 'Small' && w.propriedades.includes('heavy'),
      };
    });
  let feet = race2014(d).race.speed;
  if (
    d.classId === 'barbarian' &&
    d.level >= 5 &&
    !armors.some((i) => i.armadura?.categoria === 'heavy')
  )
    feet += 10;
  if (d.classId === 'monk' && !armors.length && !shield)
    feet += Number(
      class2014(d).data.levels[d.level - 1].classSpecific?.unarmoredMovement ??
        0,
    );
  if (
    armors.some((i) => (i.armadura?.forMin ?? 0) > sheet.abilities.str) &&
    race2014(d).race.index !== 'dwarf'
  )
    feet = Math.max(0, feet - 10);
  const casting = class2014(d).data.spellcasting,
    cast = casting && d.level >= casting.startsAtLevel ? casting : null;
  const armorWithoutProficiency = equipped.some(
    (i) =>
      i.armadura &&
      !proficiency.has(
        'armor: ' +
          (i.armadura.categoria === 'shield'
            ? 'shields'
            : i.armadura.categoria + '-armor'),
      ),
  );
  return {
    prof,
    ac,
    skills,
    saves,
    attacks,
    passivePerception: 10 + skills.perception,
    initiative:
      dex +
      (d.classId === 'bard' && d.level >= 2
        ? Math.floor(prof / 2)
        : physical
          ? Math.ceil(prof / 2)
          : 0),
    spellDc: cast ? 8 + prof + modifier(sheet.abilities[cast.ability]) : null,
    spellAttack: cast ? prof + modifier(sheet.abilities[cast.ability]) : null,
    speed: feet * 0.3,
    ambiguousArmor: armors.length > 1,
    armorWithoutProficiency,
  };
}

export function prerequisite2014(d: CharacterDraft, id: string) {
  const f = data.features.find((f) => f.id === id);
  return (f?.data.prerequisites ?? []).every((r) =>
    r.type === 'level'
      ? d.level >= (r.level ?? 99)
      : r.type === 'spell'
        ? d.decisions.some((c) => c.optionIds.includes(shortId(r.spell ?? '')))
        : r.type === 'feature'
          ? d.decisions.some((c) => c.optionIds.includes(r.feature ?? ''))
          : false,
  );
}
export function automaticSpells2014(d: CharacterDraft, includeRacial = true) {
  const c = class2014(d),
    sub = data.subclasses.find(
      (s) =>
        s.parent === c.id && shortId(s.id) === selected2014(d, 'subclass')[0],
    );
  const ids = (sub?.data.spells ?? [])
    .filter((s) => s.classLevel <= d.level)
    .map((s) => shortId(s.spell));
  for (const f of features2014(d))
    for (const e of f.effects)
      if (e.type === 'grantSpell' && (e.minLevel ?? 1) <= d.level && e.spell)
        ids.push(shortId(e.spell));
  if (includeRacial && d.raceId === 'tiefling') {
    ids.push('thaumaturgy');
    if (d.level >= 3) ids.push('hellish-rebuke');
    if (d.level >= 5) ids.push('darkness');
  }
  return [...new Set(ids)]
    .map((id) => spells2014.find((s) => s.id === id))
    .filter((s): s is Spell2014 => !!s);
}

export function equipmentRequirement2014(
  d: CharacterDraft,
  requirement?: string,
) {
  if (!requirement) return true;
  const prof = proficiency2014(d);
  if (requirement === 'chain-mail') return prof.includes('armor: heavy-armor');
  if (requirement === 'warhammers')
    return (
      prof.includes('weapon: martial-weapons') ||
      ['hill-dwarf', 'dwarf'].includes(d.raceId)
    );
  return false;
}

export function knownSpellIds2014(d: CharacterDraft) {
  return d.decisions
    .filter(
      (c) => c.id === 'spells-known' || c.id.startsWith('spellbook-level-'),
    )
    .flatMap((c) => c.optionIds);
}

/** Origem é uma transação idempotente, independente do equipamento da classe. */
export function grantBackground2014(
  d: CharacterDraft,
  holySymbol = 'amulet',
): CharacterDraft {
  if (!['acolyte', 'custom'].includes(d.backgroundId))
    throw Error('Origem não suportada.');
  if (selected2014(d, 'background-equipment').includes('accepted')) return d;
  if (!['amulet', 'emblem', 'reliquary'].includes(holySymbol))
    throw Error('Escolha um símbolo sagrado do catálogo.');
  const inventory = [...d.inventory];
  const add = (
    key: string,
    itemId: string,
    quantity: number,
    customName?: string,
  ) => {
    inventory.push({
      id: 'background-acolyte:' + key,
      itemId,
      quantity,
      equipped: false,
      origin: 'starting',
      ...(customName ? { customName } : {}),
    });
  };
  add('symbol', canonicalItem2014('srd51:item/' + holySymbol), 1);
  add('clothes', canonicalItem2014('srd51:item/clothes-common'), 1);
  add('book', 'background-prayer-book', 1, 'Livro de orações');
  add('incense', 'background-incense', 5, 'Vareta de incenso');
  add('vestments', 'background-vestments', 1, 'Vestes sacerdotais');
  return decide2014(
    {
      ...d,
      inventory,
      currency: {
        cp: d.currency?.cp ?? 0,
        sp: d.currency?.sp ?? 0,
        gp: (d.currency?.gp ?? 0) + 15,
      },
    },
    'background-equipment',
    ['accepted'],
  );
}

const traitPt: Record<string, [string, string]> = {
  darkvision: [
    'Visão no Escuro',
    'Até 18 m, penumbra é tratada como luz plena e escuridão como penumbra. Na escuridão, você distingue tons de cinza, não cores.',
  ],
  'dwarven-resilience': [
    'Resiliência Anã',
    'Vantagem nos testes de resistência contra veneno e resistência a dano de veneno. Não é um bônus permanente a todos os testes.',
  ],
  stonecunning: [
    'Especialista em Rochas',
    'Em testes de História sobre a origem de trabalhos em pedra, você é considerado proficiente e soma o dobro do bônus de proficiência.',
  ],
  'dwarven-combat-training': [
    'Treinamento de Combate Anão',
    'Proficiência com machado de batalha, machadinha, martelo leve e martelo de guerra.',
  ],
  'tool-proficiency': [
    'Proficiência com Ferramentas',
    'Escolha ferramentas de ferreiro, suprimentos de cervejeiro ou ferramentas de pedreiro.',
  ],
  'dwarven-toughness': [
    'Robustez Anã',
    'Seu máximo de PV aumenta em 1 no primeiro nível e em mais 1 a cada nível. Esse aumento já está incluído na ficha calculada.',
  ],
  'keen-senses': [
    'Sentidos Aguçados',
    'Proficiência em Percepção, já incluída nas perícias calculadas.',
  ],
  'fey-ancestry': [
    'Ancestralidade Feérica',
    'Vantagem em testes de resistência contra ser enfeitiçado. Magia não pode colocar você para dormir.',
  ],
  trance: [
    'Transe',
    'Elfos meditam profundamente por quatro horas em vez de dormir. A meditação concede os benefícios de sono descritos no SRD.',
  ],
  'elf-weapon-training': [
    'Treinamento Élfico com Armas',
    'Proficiência com espada longa, espada curta, arco curto e arco longo.',
  ],
  cantrip: [
    'Truque Élfico',
    'Escolha um truque da lista de Mago. Inteligência é o atributo de conjuração desse truque.',
  ],
  'extra-language': ['Idioma Adicional', 'Escolha mais um idioma.'],
  lucky: [
    'Sortudo',
    'Quando obtiver 1 no d20 de um ataque, teste de atributo ou teste de resistência, role novamente e use o novo resultado.',
  ],
  brave: [
    'Bravura',
    'Vantagem em testes de resistência contra ficar amedrontado.',
  ],
  'halfling-nimbleness': [
    'Agilidade Halfling',
    'Você pode atravessar o espaço de criaturas de tamanho maior que o seu.',
  ],
  'naturally-stealthy': [
    'Furtividade Natural',
    'Você pode tentar se esconder mesmo quando estiver obscurecido apenas por uma criatura de tamanho maior que o seu.',
  ],
  'gnome-cunning': [
    'Esperteza Gnômica',
    'Vantagem em testes de resistência de Inteligência, Sabedoria e Carisma contra magia.',
  ],
  'artificers-lore': [
    'Conhecimento de Artífice',
    'Use o dobro da proficiência em testes de História ligados a itens mágicos, objetos alquímicos e dispositivos tecnológicos, conforme o SRD.',
  ],
  tinker: [
    'Engenhoqueiro',
    'Proficiência com ferramentas de funileiro. Com 1 hora e 10 po em materiais, crie um dispositivo minúsculo de relojoaria conforme as três opções do SRD; no máximo três dispositivos ativos. Combine o efeito descritivo com o mestre.',
  ],
  'skill-versatility': ['Versatilidade em Perícias', 'Escolha duas perícias.'],
  menacing: [
    'Ameaçador',
    'Proficiência em Intimidação, já incluída na ficha calculada.',
  ],
  'relentless-endurance': [
    'Resistência Implacável',
    'Quando cair a 0 PV sem morrer instantaneamente, você pode ficar com 1 PV. Só pode usar novamente após um descanso longo.',
  ],
  'savage-attacks': [
    'Ataques Selvagens',
    'Num crítico com arma corpo a corpo, role mais um dado de dano da arma e some ao dano extra do crítico.',
  ],
  'hellish-resistance': ['Resistência Infernal', 'Resistência a dano de fogo.'],
  'infernal-legacy': [
    'Legado Infernal',
    'Conhece Taumaturgia. No nível 3, pode conjurar Repreensão Infernal como magia de 2º círculo uma vez por descanso longo; no nível 5, também Escuridão uma vez por descanso longo. Carisma é o atributo dessas magias raciais.',
  ],
};
export function resourceLabel2014(id: string) {
  const labels: Record<string, string> = {
    'hit-dice': 'Dados de Vida',
    rageCount: 'Fúria',
    channelDivinityCharges: 'Canalizar Divindade',
    actionSurges: 'Surto de Ação',
    indomitableUses: 'Indomável',
    kiPoints: 'Pontos de Ki',
    sorceryPoints: 'Pontos de Feitiçaria',
    'second-wind': 'Retomar o Fôlego',
    'lay-on-hands': 'Cura pelas Mãos',
    'divine-sense': 'Sentido Divino',
    'channel-divinity': 'Canalizar Divindade',
    'bardic-inspiration': 'Inspiração de Bardo',
    'wild-shape': 'Forma Selvagem',
    'breath-weapon': 'Arma de Sopro',
    'infernal-rebuke': 'Repreensão Infernal racial',
    'infernal-darkness': 'Escuridão racial',
  };
  return (
    labels[id] ??
    (id.startsWith('spell-slot-')
      ? 'Espaços de ' + id.slice(11) + 'º círculo'
      : label2014(id))
  );
}

export function proficiencyLabel2014(value: string) {
  const [kind, raw = ''] = value.split(':');
  const target = raw.trim();
  if (kind === 'save') return 'Resistência: ' + rotuloAtributo(target);
  if (kind === 'language') return 'Idioma: ' + (idioma2014[target] ?? target);
  const categories: Record<string, string> = {
    'light-armor': 'Armaduras leves',
    'medium-armor': 'Armaduras médias',
    'heavy-armor': 'Armaduras pesadas',
    shields: 'Escudos',
    'simple-weapons': 'Armas simples',
    'martial-weapons': 'Armas marciais',
  };
  if (categories[target]) return categories[target];
  const item =
    data.itemIds['srd51:item/' + target] ??
    Object.keys(data.weaponProficiencies).find((id) =>
      data.weaponProficiencies[id].includes('weapon:' + target),
    );
  return (
    (kind === 'tool' ? 'Ferramenta: ' : '') +
    (item ? (srdItem(item)?.nome ?? target) : target.replaceAll('-', ' '))
  );
}

function storedHpRoll2014(d: CharacterDraft, level: number) {
  const n = Number(selected2014(d, 'hp-roll-confirmed-' + level)[0]);
  const die = class2014(d).data.hitDie;
  return Number.isSafeInteger(n) && n >= 1 && n <= die
    ? n
    : Math.floor(die / 2) + 1;
}
export function progressLevel2014(d: CharacterDraft, level: number) {
  if (!Number.isSafeInteger(level) || level < 1 || level > 20)
    throw Error('Nível inválido.');
  return change2014(d, {
    level,
    hpRolls: d.hpRolls
      ? Array.from(
          { length: level - 1 },
          (_, i) => d.hpRolls?.[i] ?? storedHpRoll2014(d, i + 2),
        )
      : undefined,
  });
}
export function hpMode2014(d: CharacterDraft, rolled: boolean) {
  return change2014(d, {
    hpRolls: rolled
      ? Array.from(
          { length: d.level - 1 },
          (_, i) => d.hpRolls?.[i] ?? storedHpRoll2014(d, i + 2),
        )
      : undefined,
  });
}
export function hpRoll2014(d: CharacterDraft, level: number, value: number) {
  if (
    !d.hpRolls ||
    level < 2 ||
    level > d.level ||
    !Number.isSafeInteger(value) ||
    value < 1 ||
    value > class2014(d).data.hitDie
  )
    throw Error('Rolagem de PV inválida.');
  const rolls = [...d.hpRolls];
  rolls[level - 2] = value;
  return change2014(d, { hpRolls: rolls });
}

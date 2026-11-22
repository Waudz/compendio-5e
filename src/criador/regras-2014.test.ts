import { describe, it, expect } from 'vitest';
import {
  progressLevel2014,
  hpMode2014,
  hpRoll2014,
  classes2014,
  races2014,
  VERSION_2014,
  sheet2014,
  spellSlots2014,
  shortId,
  decide2014,
  choices2014,
  activate2014,
  equipment2014,
  equipmentCategory2014,
  canonicalItem2014,
  statistics2014,
  grantBackground2014,
  automaticSpells2014,
  prerequisite2014,
  raceTraits2014,
} from './regras-2014';
import type { CharacterDraft } from '../rules/character-domain';
import { srdItem } from '../catalogue/srd-2014-items';
export const draft2014 = (
  patch: Partial<CharacterDraft> = {},
): CharacterDraft => ({
  id: 'novo-test',
  name: 'Heroína',
  catalogueVersion: VERSION_2014,
  ruleset: '5e-2014',
  classId: 'fighter',
  raceId: 'human',
  backgroundId: 'acolyte',
  level: 1,
  baseAbilities: { str: 15, dex: 12, con: 14, int: 10, wis: 12, cha: 8 },
  decisions: [],
  inventory: [],
  currentHp: 0,
  temporaryHp: 0,
  spentResources: {},
  ...patch,
});
describe('personagens SRD 2014 versionados', () => {
  for (const c of classes2014)
    for (let level = 1; level <= 20; level++)
      it(`${shortId(c.id)} nível ${level}: progressão íntegra e PV finitos`, () => {
        const d = draft2014({ classId: shortId(c.id), level });
        const s = sheet2014(d);
        expect(Number.isSafeInteger(s.maxHp)).toBe(true);
        expect(s.maxHp).toBeGreaterThanOrEqual(level);
        expect(s.pending.length).toBeGreaterThan(0);
        expect(s.draft).toBe(d);
      });
  it('mantém nome, atributos e inventário na ativação explícita; não muta o original', () => {
    const d = draft2014({
      inventory: [
        {
          id: 'potion',
          itemId: 'dagger',
          quantity: 2,
          equipped: false,
          origin: 'acquired',
        },
      ],
    });
    const before = structuredClone(d);
    const upgraded = activate2014(d);
    expect(upgraded.name).toBe(d.name);
    expect(upgraded.inventory).toEqual(d.inventory);
    expect(d).toEqual(before);
  });
  it('combina bônus de subraça e robustez por nível sem duplicar', () => {
    const s = sheet2014(draft2014({ raceId: 'hill-dwarf', level: 3 }));
    expect(s.abilities.con).toBe(16);
    expect(s.abilities.wis).toBe(13);
    expect(s.maxHp).toBe(34);
  });
  it('Acólito concede Intuição e Religião automaticamente', () => {
    expect(sheet2014(draft2014()).skills).toEqual(['insight', 'religion']);
  });
  it('cada raça disponível é construível e possui ID estável', () => {
    for (const r of races2014)
      expect(sheet2014(draft2014({ raceId: r.id })).maxHp).toBeGreaterThan(0);
    expect(new Set(races2014.map((r) => r.id)).size).toBe(races2014.length);
  });
  it('aplica melhoria de atributo usando os pacotes existentes', () => {
    let d = draft2014({ level: 4 });
    d = decide2014(d, 'fighter-asi-4', ['str-plus-two']);
    expect(sheet2014(d).abilities.str).toBe(18);
  });
  it('cada receita de equipamento aponta ao catálogo canônico e categorias não vazias', () => {
    for (const c of classes2014) {
      const e = equipment2014(draft2014({ classId: shortId(c.id) }));
      for (const comp of [
        ...e.startingEquipment,
        ...e.startingChoices.flatMap((g) => g.options.flatMap((o) => o.items)),
      ]) {
        if (comp.item)
          expect(srdItem(canonicalItem2014(comp.item))).toBeTruthy();
        if (comp.category)
          expect(
            equipmentCategory2014(comp.category).length,
            comp.category,
          ).toBeGreaterThan(0);
      }
    }
  });
  it('não oferece magias de classe a Guerreiro sem conjuração', () => {
    expect(
      choices2014(draft2014()).filter((c) =>
        ['cantrips', 'spells-known', 'spells-prepared'].includes(c.id),
      ),
    ).toEqual([]);
  });
  it('Mago começa com seis magias no grimório, três truques e preparo por Inteligência', () => {
    const choices = choices2014(draft2014({ classId: 'wizard' }));
    expect(choices.find((c) => c.id === 'spells-known')?.count).toBe(6);
    expect(choices.find((c) => c.id === 'cantrips')?.count).toBe(3);
    expect(choices.find((c) => c.id === 'spells-prepared')?.count).toBe(1);
  });
  it('Campeão bárbaro aplica ASIs antes do aumento de teto do nível 20', () => {
    let d = draft2014({ classId: 'barbarian', level: 20 });
    for (const n of [4, 8])
      d = decide2014(d, 'barbarian-asi-' + n, ['str-plus-two']);
    expect(sheet2014(d).abilities.str).toBe(24);
  });
  it('perícia automática da origem não acumula proficiência e exige substituição', () => {
    const d = decide2014(
      draft2014({ classId: 'cleric' }),
      'cleric-proficiency-1',
      ['insight', 'medicine'],
    );
    expect(sheet2014(d).pending).toContain(
      'duplicate-skill:cleric-proficiency-1',
    );
    expect(sheet2014(d).skills.filter((s) => s === 'insight')).toHaveLength(1);
  });
  it('origem dá equipamento e moedas uma única vez e preserva itens adquiridos', () => {
    const d = draft2014({
      currency: { cp: 2, sp: 3, gp: 4 },
      inventory: [
        {
          id: 'owned',
          itemId: 'dagger',
          quantity: 1,
          origin: 'acquired',
          equipped: false,
        },
      ],
    });
    const next = grantBackground2014(d);
    expect(next.currency).toEqual({ cp: 2, sp: 3, gp: 19 });
    expect(next.inventory).toContainEqual(d.inventory[0]);
    expect(
      next.inventory.filter((i) => i.customName === 'Vareta de incenso')[0]
        .quantity,
    ).toBe(5);
    expect(grantBackground2014(next)).toBe(next);
    for (const i of next.inventory.filter((i) => !i.customName))
      expect(srdItem(i.itemId)).toBeTruthy();
  });
  it('grimório valida duas magias em cada nível, sem permitir aprender magia alta retroativamente', () => {
    const list = choices2014(draft2014({ classId: 'wizard', level: 5 }));
    expect(list.find((c) => c.id === 'spells-known')?.count).toBe(6);
    expect(
      list.filter((c) => c.id.startsWith('spellbook-level-')),
    ).toHaveLength(4);
    expect(
      list
        .find((c) => c.id === 'spellbook-level-2')
        ?.options.some((s) => s.id === 'fireball'),
    ).toBe(false);
    expect(
      list
        .find((c) => c.id === 'spellbook-level-5')
        ?.options.some((s) => s.id === 'fireball'),
    ).toBe(true);
  });
  it('magias de domínio são concedidas sem consumir preparo', () => {
    const d = decide2014(draft2014({ classId: 'cleric' }), 'subclass', [
      'life',
    ]);
    expect(automaticSpells2014(d).map((s) => s.id)).toEqual([
      'bless',
      'cure-wounds',
    ]);
    expect(
      choices2014(d)
        .find((c) => c.id === 'spells-prepared')
        ?.options.some((s) => s.id === 'bless'),
    ).toBe(false);
  });
  it('invocações exigem nível, magia e pacto de sua fonte', () => {
    const d = draft2014({ classId: 'warlock', level: 2 });
    expect(
      prerequisite2014(d, 'srd51:feature/eldritch-invocation-agonizing-blast'),
    ).toBe(false);
    const known = decide2014(d, 'cantrips', ['eldritch-blast', 'mage-hand']);
    expect(
      prerequisite2014(
        known,
        'srd51:feature/eldritch-invocation-agonizing-blast',
      ),
    ).toBe(true);
  });
  it('armadura equipada usa a definição canônica; Percepção passiva usa a proficiência correta', () => {
    const d = draft2014({
      inventory: [
        {
          id: 'armor',
          itemId: 'chain-mail',
          quantity: 1,
          equipped: true,
          origin: 'acquired',
        },
        {
          id: 'shield',
          itemId: 'shield',
          quantity: 1,
          equipped: true,
          origin: 'acquired',
        },
      ],
    });
    expect(statistics2014(d).ac).toBe(18);
    expect(statistics2014(d).passivePerception).toBe(11);
  });
  it('não aceita moeda negativa ou origem desconhecida', () => {
    expect(() =>
      sheet2014(draft2014({ currency: { cp: 0, sp: 0, gp: -1 } })),
    ).toThrow();
    expect(() => sheet2014(draft2014({ backgroundId: 'invented' }))).toThrow();
  });

  it('Fúria ilimitada no nível 20 não vira o sentinela 9999 do legado', () => {
    expect(
      sheet2014(draft2014({ classId: 'barbarian', level: 20 })).resources
        .rageCount.maximum,
    ).toBeNull();
  });
  it('traços raciais exibem nome e efeito em vez de repetir somente o identificador', () => {
    const trait = raceTraits2014(draft2014({ raceId: 'hill-dwarf' })).find(
      (t) => t.index === 'dwarven-resilience',
    );
    expect(trait?.name).toBe('Resiliência Anã');
    expect(trait?.desc.join(' ')).toContain('veneno');
  });

  it('conjuração racial não impede aprender a mesma magia na classe', () => {
    const d = draft2014({ raceId: 'tiefling', classId: 'warlock', level: 3 });
    expect(automaticSpells2014(d).some((s) => s.id === 'hellish-rebuke')).toBe(
      true,
    );
    expect(
      choices2014(d)
        .find((c) => c.id === 'spells-known')
        ?.options.some((s) => s.id === 'hellish-rebuke'),
    ).toBe(true);
  });
  it('estilos de luta não podem ser escolhidos novamente no Campeão', () => {
    let d = draft2014({ level: 10 });
    d = decide2014(d, 'subclass', ['champion']);
    const list = choices2014(d).filter((c) =>
      c.options.some(
        (o) => o.id === 'srd51:feature/fighter-fighting-style-archery',
      ),
    );
    expect(list.length).toBe(2);
    for (const choice of list)
      d = decide2014(d, choice.id, [
        'srd51:feature/fighter-fighting-style-archery',
      ]);
    expect(
      sheet2014(d).pending.some((s) => s.startsWith('duplicate-feature:')),
    ).toBe(true);
  });

  it('permite escolher regras antes de informar o nome, sem inventar um nome salvo', () => {
    const d = draft2014({ name: '' });
    expect(sheet2014(d).maxHp).toBeGreaterThan(0);
    expect(sheet2014(d).draft.name).toBe('');
    expect(activate2014(d).name).toBe('');
  });
  const dice: Record<string, number> = {
    barbarian: 12,
    bard: 8,
    cleric: 8,
    druid: 8,
    fighter: 10,
    monk: 8,
    paladin: 10,
    ranger: 10,
    rogue: 8,
    sorcerer: 6,
    warlock: 8,
    wizard: 6,
  };
  for (const [classId, die] of Object.entries(dice))
    it(`${classId}: dado de vida e PV conferidos contra a regra de média fixa`, () => {
      expect(sheet2014(draft2014({ classId, level: 1 })).maxHp).toBe(die + 2);
      expect(sheet2014(draft2014({ classId, level: 5 })).maxHp).toBe(
        die + 2 + 4 * (Math.floor(die / 2) + 1 + 2),
      );
    });
  it('tabelas de espaços de conjuradores completos e de meio conjuradores no nível 20', () => {
    for (const classId of ['bard', 'cleric', 'druid', 'sorcerer', 'wizard'])
      expect(spellSlots2014(draft2014({ classId, level: 20 }))).toEqual([
        4, 3, 3, 3, 3, 2, 2, 1, 1,
      ]);
    for (const classId of ['paladin', 'ranger'])
      expect(spellSlots2014(draft2014({ classId, level: 20 }))).toEqual([
        4, 3, 3, 3, 2, 0, 0, 0, 0,
      ]);
  });
  it('Magia de Pacto tem espaços separados limitados ao 5º círculo', () => {
    expect(
      spellSlots2014(draft2014({ classId: 'warlock', level: 11 })),
    ).toEqual([0, 0, 0, 0, 3, 0, 0, 0, 0]);
    expect(
      spellSlots2014(draft2014({ classId: 'warlock', level: 20 })),
    ).toEqual([0, 0, 0, 0, 4, 0, 0, 0, 0]);
  });
  it('recursos escalam pela classe e nível sem contar bônus descritivos como usos', () => {
    expect(
      sheet2014(draft2014({ classId: 'monk', level: 8 })).resources.kiPoints
        .maximum,
    ).toBe(8);
    expect(
      sheet2014(draft2014({ classId: 'sorcerer', level: 12 })).resources
        .sorceryPoints.maximum,
    ).toBe(12);
    expect(
      sheet2014(draft2014({ classId: 'fighter', level: 17 })).resources
        .actionSurges.maximum,
    ).toBe(2);
    expect(
      sheet2014(draft2014({ classId: 'fighter', level: 17 })).resources
        .indomitableUses.maximum,
    ).toBe(3);
    expect(
      sheet2014(draft2014({ classId: 'paladin', level: 20 })).resources[
        'lay-on-hands'
      ].maximum,
    ).toBe(100);
  });
  it('salvaguardas e ataque de arco usam atributo e proficiência, com Arquearia só em arma à distância', () => {
    let d = draft2014({
      inventory: [
        {
          id: 'bow',
          itemId: 'longbow',
          quantity: 1,
          equipped: true,
          origin: 'acquired',
        },
      ],
    });
    const style = choices2014(d).find((c) =>
      c.options.some(
        (o) => o.id === 'srd51:feature/fighter-fighting-style-archery',
      ),
    )!;
    d = decide2014(d, style.id, [
      'srd51:feature/fighter-fighting-style-archery',
    ]);
    const stats = statistics2014(d);
    expect(stats.saves.str).toBe(5);
    expect(stats.saves.dex).toBe(1);
    expect(stats.saves.con).toBe(4);
    expect(stats.attacks[0].bonus).toBe(5);
  });
  it('equipamento impede movimento desarmado de Monge e Anão ignora o requisito de Força da armadura', () => {
    expect(statistics2014(draft2014({ classId: 'monk', level: 2 })).speed).toBe(
      12,
    );
    const armor = {
      id: 'armor',
      itemId: 'chain-mail',
      quantity: 1,
      equipped: true,
      origin: 'acquired' as const,
    };
    expect(
      statistics2014(
        draft2014({ classId: 'monk', level: 2, inventory: [armor] }),
      ).speed,
    ).toBe(9);
    expect(
      statistics2014(
        draft2014({
          baseAbilities: { str: 8, dex: 12, con: 14, int: 10, wis: 12, cha: 8 },
          inventory: [armor],
        }),
      ).speed,
    ).toBe(6);
    expect(
      statistics2014(
        draft2014({
          raceId: 'hill-dwarf',
          baseAbilities: { str: 8, dex: 12, con: 14, int: 10, wis: 12, cha: 8 },
          inventory: [armor],
        }),
      ).speed,
    ).toBe(7.5);
  });
});

describe('PV rolados por nível sem inventar resultados confirmados', () => {
  it('mantém os resultados, pede confirmação e calcula CON em cada nível', () => {
    let d = draft2014({ level: 3, hpRolls: [2, 8] });
    expect(sheet2014(d).maxHp).toBe(26);
    expect(sheet2014(d).pending).toContain('hp-roll-confirmed-2');
    for (const n of [2, 3])
      d = decide2014(d, 'hp-roll-confirmed-' + n, [String(d.hpRolls![n - 2])]);
    expect(sheet2014(d).pending).not.toContain('hp-roll-confirmed-2');
    d = progressLevel2014(d, 4);
    expect(d.hpRolls).toEqual([2, 8, 6]);
    expect(sheet2014(d).pending).toContain('hp-roll-confirmed-4');
    d = decide2014(hpRoll2014(d, 4, 9), 'hp-roll-confirmed-4', ['9']);
    expect(sheet2014(d).maxHp).toBe(37);
    expect(progressLevel2014(progressLevel2014(d, 2), 4).hpRolls).toEqual([
      2, 8, 9,
    ]);
    expect(hpMode2014(hpMode2014(d, false), true).hpRolls).toEqual([2, 8, 9]);
  });
  it('usa máximo no primeiro nível, não aceita dados acima da classe', () => {
    const d = hpMode2014(draft2014({ classId: 'wizard', level: 2 }), true);
    expect(d.hpRolls).toEqual([4]);
    expect(sheet2014(d).maxHp).toBe(14);
    expect(sheet2014(d).pending).toContain('hp-roll-confirmed-2');
    expect(() => hpRoll2014(d, 2, 7)).toThrow();
    expect(() => hpRoll2014(d, 1, 4)).toThrow();
    expect(() => progressLevel2014(d, 21)).toThrow();
  });
  it('ativação explícita preserva uma cópia privada exata e confirma rolagens existentes', () => {
    const old = draft2014({
      catalogueVersion: 'old-version',
      level: 3,
      hpRolls: [2, 8],
      spentResources: { 'second-wind': 1 },
      decisions: [{ id: 'old-choice', optionIds: ['old-option'] }],
    });
    const before = structuredClone(old),
      next = activate2014(old);
    expect(old).toEqual(before);
    expect(next.previousRulesDraft).toEqual(before);
    expect(next.previousRulesDraft).not.toBe(old);
    expect(next.hpRolls).toEqual([2, 8]);
    expect(sheet2014(next).pending).not.toContain('hp-roll-confirmed-2');
    expect(activate2014(next)).toBe(next);
  });
  it('Sentido Divino respeita 1 + Carisma, sem mínimo artificial de um', () => {
    expect(
      sheet2014(draft2014({ classId: 'paladin' })).resources['divine-sense']
        ?.maximum,
    ).toBe(0);
  });
});

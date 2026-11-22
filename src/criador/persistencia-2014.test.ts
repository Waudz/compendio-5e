import { it, expect } from 'vitest';
import { repositorioServidor, ErroConflito } from './repositorio';
import { fichasEmMemoria, novoBancoFichas } from '../fichasMemoria';
import { defaultPublicIdentity } from '../rules/public-identity';
import { VERSION_2014, grantBackground2014 } from './regras-2014';
import type { CharacterDraft } from '../rules/character-domain';
const draft: CharacterDraft = {
  id: 'novo-test',
  name: 'Maga',
  catalogueVersion: VERSION_2014,
  ruleset: '5e-2014',
  classId: 'wizard',
  raceId: 'human',
  backgroundId: 'acolyte',
  level: 3,
  baseAbilities: { str: 8, dex: 12, con: 14, int: 15, wis: 12, cha: 10 },
  decisions: [{ id: 'spells-known', optionIds: ['magic-missile'] }],
  inventory: [],
  currentHp: 12,
  temporaryHp: 0,
  spentResources: {},
};
it('grava e reabre a versão 2014 na campanha pelo mesmo repositório do servidor, preservando inventário e escolhas', async () => {
  const bank = novoBancoFichas(),
    repo = repositorioServidor(fichasEmMemoria('u1', bank), 'ca', 'u1');
  const d = grantBackground2014(draft);
  const state = {
    draft: d,
    identity: defaultPublicIdentity(),
    publicar: false,
  };
  const r = await repo.salvar({
    id: d.id,
    existe: false,
    revisao: null,
    estado: state,
    somenteFicha: false,
    source: {
      name: d.name,
      surname: '',
      race: 'Humano',
      characterClass: 'Mago',
    },
  });
  const p = await repo.carregar(r.id);
  expect(p?.draft).toEqual({ ...d, id: r.id });
  expect(bank.fichas[0].campaignId).toBe('ca');
  expect(
    await repositorioServidor(
      fichasEmMemoria('u1', bank),
      'outra',
      'u1',
    ).carregar(r.id),
  ).toBeNull();
  const r2 = await repo.salvar({
    id: r.id,
    existe: true,
    revisao: r.revision,
    estado: { ...state, draft: { ...d, id: r.id, level: 4 } },
    somenteFicha: false,
    source: {
      name: d.name,
      surname: '',
      race: 'Humano',
      characterClass: 'Mago',
    },
  });
  expect(r2.revision).toBe(2);
  await expect(
    repo.salvar({
      id: r.id,
      existe: true,
      revisao: 1,
      estado: state,
      somenteFicha: false,
      source: {
        name: d.name,
        surname: '',
        race: 'Humano',
        characterClass: 'Mago',
      },
    }),
  ).rejects.toBeInstanceOf(ErroConflito);
  expect(bank.fichas[0].draft.level).toBe(4);
});
it('não cria personagem sem participação em uma campanha', async () => {
  const bank = novoBancoFichas(),
    repo = repositorioServidor(fichasEmMemoria('u1', bank), '', 'u1');
  await expect(
    repo.salvar({
      id: draft.id,
      existe: false,
      revisao: null,
      estado: { draft, identity: defaultPublicIdentity(), publicar: false },
      somenteFicha: false,
      source: {
        name: 'Maga',
        surname: '',
        race: 'Humano',
        characterClass: 'Mago',
      },
    }),
  ).rejects.toThrow();
  expect(bank.fichas).toEqual([]);
});

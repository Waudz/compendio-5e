import { describe, expect, it } from 'vitest';
import { armazenamentoLocalExperimental, lerPersonagemGuiado, SCHEMA_PERSONAGEM_GUIADO, type PersonagemGuiado } from './armazenamento';
import { defaultPublicIdentity } from '../rules/public-identity';
import { clearUserLocalData } from '../localData';
import { memoryStorage } from '../testUtils';
import type { CharacterDraft } from '../rules/character-domain';

const rascunho = (id: string, name = 'Thorin'): CharacterDraft => ({ id, name, ruleset: '5e-2014', catalogueVersion: 'v', baseAbilities: { str: 15, dex: 12, con: 14, int: 10, wis: 12, cha: 8 },
  raceId: 'r', backgroundId: 'b', classId: 'c', level: 1, decisions: [], inventory: [{ id: 'i1', itemId: 'longsword', quantity: 1, equipped: false, origin: 'acquired' }], currentHp: 13, temporaryHp: 0, spentResources: {} });
const registro = (id: string, name?: string, savedAt = '2026-11-20T10:00:00Z'): PersonagemGuiado => ({ schemaVersion: SCHEMA_PERSONAGEM_GUIADO, draft: rascunho(id, name), identity: defaultPublicIdentity(), savedAt });

describe('armazenamento experimental do criador', () => {
  it('é declarado experimental e faz ida e volta sem perder inventário nem identidade', () => {
    const s = memoryStorage(); const a = armazenamentoLocalExperimental('u1', 'ca', s);
    expect(a.experimental).toBe(true);
    const r = { ...registro('p1'), identity: { ...defaultPublicIdentity(), title: 'O Escudo' } };
    a.salvar(r);
    expect(a.carregar('p1')).toEqual(r);
    expect(a.carregar('inexistente')).toBeNull();
  });
  it('separa por usuário e por campanha: outro usuário ou outra campanha não enxergam o personagem', () => {
    const s = memoryStorage();
    armazenamentoLocalExperimental('u1', 'ca', s).salvar(registro('p1'));
    expect(armazenamentoLocalExperimental('u2', 'ca', s).listar()).toEqual([]);
    expect(armazenamentoLocalExperimental('u1', 'cb', s).listar()).toEqual([]);
    expect(armazenamentoLocalExperimental('u2', 'ca', s).carregar('p1')).toBeNull();
    expect(armazenamentoLocalExperimental('u1', 'ca', s).listar().map(x => x.nome)).toEqual(['Thorin']);
  });
  it('lista mais recente primeiro e ignora registros corrompidos sem quebrar', () => {
    const s = memoryStorage(); const a = armazenamentoLocalExperimental('u1', 'ca', s);
    a.salvar(registro('p1', 'Antigo', '2026-11-01T00:00:00Z')); a.salvar(registro('p2', 'Novo', '2026-11-20T00:00:00Z'));
    s.setItem('compendio5e:experimental:criador:v1:u1:ca:lixo', '{nao-json');
    expect(a.listar().map(x => x.nome)).toEqual(['Novo', 'Antigo']);
    expect(() => a.carregar('lixo')).toThrow();
  });
  it('recusa dado malformado em vez de consertar: versão desconhecida, atributo fora da faixa, item sem quantidade', () => {
    const base = JSON.parse(JSON.stringify(registro('p1')));
    expect(() => lerPersonagemGuiado(JSON.stringify({ ...base, schemaVersion: 99 }))).toThrow(/inválido/);
    const forte = structuredClone(base); forte.draft.baseAbilities.str = 99;
    expect(() => lerPersonagemGuiado(JSON.stringify(forte))).toThrow(/inválido/);
    const semQtd = structuredClone(base); semQtd.draft.inventory[0].quantity = 0;
    expect(() => lerPersonagemGuiado(JSON.stringify(semQtd))).toThrow(/inválido/);
    const semId = structuredClone(base); semId.draft.id = '../x';
    expect(() => lerPersonagemGuiado(JSON.stringify(semId))).toThrow(/inválido/);
  });
  it('identidade pública inválida volta ao padrão (nunca expõe campo desconhecido)', () => {
    const base = JSON.parse(JSON.stringify(registro('p1'))); base.identity = { title: 1 };
    expect(lerPersonagemGuiado(JSON.stringify(base)).identity).toEqual(defaultPublicIdentity());
  });
  it('não salva personagem inválido e rejeita identificadores com caracteres perigosos', () => {
    const s = memoryStorage(); const a = armazenamentoLocalExperimental('u1', 'ca', s);
    const ruim = registro('p1'); ruim.draft.baseAbilities.dex = 0;
    expect(() => a.salvar(ruim)).toThrow(/nada foi salvo/);
    expect(s.length).toBe(0);
    expect(() => armazenamentoLocalExperimental('u1:x', 'ca', s)).toThrow();
    expect(() => a.carregar('../outro')).toThrow();
  });
  it('excluir remove só o personagem pedido; o logout apaga tudo do usuário (higiene, não segurança)', () => {
    const s = memoryStorage(); const a = armazenamentoLocalExperimental('u1', 'ca', s); const b = armazenamentoLocalExperimental('u2', 'ca', s);
    a.salvar(registro('p1')); a.salvar(registro('p2')); b.salvar(registro('p3'));
    a.excluir('p1');
    expect(a.listar().map(x => x.nome)).toEqual(['Thorin']);
    expect(clearUserLocalData('u1', s)).toBe(1);
    expect(a.listar()).toEqual([]);
    expect(b.listar()).toHaveLength(1);
  });
});

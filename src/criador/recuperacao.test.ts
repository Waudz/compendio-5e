import { describe, expect, it } from 'vitest';
import { clearUserLocalData } from '../localData';
import { memoryStorage } from '../testUtils';
import { defaultPublicIdentity } from '../rules/public-identity';
import type { CharacterDraft } from '../rules/character-domain';
import { ehPersonagemNovo, gravarMapaAba, gravarRecuperacao, lerMapaAba, lerRecuperacao, limparRecuperacao } from './recuperacao';

const draft = { id: 'p1', name: 'Thorin', ruleset: '5e-2014', catalogueVersion: 'v', baseAbilities: { str: 15, dex: 12, con: 14, int: 10, wis: 12, cha: 8 }, raceId: 'r', backgroundId: 'b', classId: 'c', level: 1, decisions: [], inventory: [], currentHp: 13, temporaryHp: 0, spentResources: {} } as CharacterDraft;
const rec = { estado: { draft, identity: defaultPublicIdentity(), publicar: true }, baseRevisao: 3, motivo: 'Sem conexão', em: '2026-11-21T10:00:00Z' };

describe('cópia de recuperação local', () => {
  it('faz ida e volta (inclui a revisão-base e a escolha de publicar) e some ao limpar', () => {
    const s = memoryStorage();
    expect(gravarRecuperacao('u1', 'ca', 'p1', rec, s)).toBe(true);
    expect(lerRecuperacao('u1', 'ca', 'p1', s)).toEqual(rec);
    limparRecuperacao('u1', 'ca', 'p1', s);
    expect(lerRecuperacao('u1', 'ca', 'p1', s)).toBeNull();
  });
  it('é separada por usuário, campanha e personagem, e o logout (clearUserLocalData) a apaga', () => {
    const s = memoryStorage();
    gravarRecuperacao('u1', 'ca', 'p1', rec, s); gravarRecuperacao('u2', 'ca', 'p1', rec, s);
    expect(lerRecuperacao('u2', 'cb', 'p1', s)).toBeNull(); expect(lerRecuperacao('u1', 'ca', 'p2', s)).toBeNull();
    expect(clearUserLocalData('u1', s)).toBe(1);
    expect(lerRecuperacao('u1', 'ca', 'p1', s)).toBeNull(); expect(lerRecuperacao('u2', 'ca', 'p1', s)).toEqual(rec);
  });
  it('cópia ilegível ou inválida não é restaurada e não quebra a leitura; armazenamento indisponível devolve false', () => {
    const s = memoryStorage();
    s.setItem('compendio5e:experimental:criador-recuperacao:v1:u1:ca:p1', '{lixo');
    expect(lerRecuperacao('u1', 'ca', 'p1', s)).toBeNull();
    s.setItem('compendio5e:experimental:criador-recuperacao:v1:u1:ca:p2', JSON.stringify({ personagem: { schemaVersion: 1, draft: { id: 'p2' }, identity: {}, savedAt: 'x' } }));
    expect(lerRecuperacao('u1', 'ca', 'p2', s)).toBeNull();
    expect(gravarRecuperacao('u1', 'ca', 'p1', rec, { getItem: () => null, setItem: () => { throw new Error('cota'); }, removeItem: () => {} })).toBe(false);
    expect(() => gravarRecuperacao('u1:x', 'ca', 'p1', rec, s)).not.toThrow();    // id inválido: falha segura (false), nunca grava em chave estranha
    expect(gravarRecuperacao('u1:x', 'ca', 'p1', rec, s)).toBe(false);
  });
});

describe('vínculo da aba de personagem novo', () => {
  it('guarda o id do servidor por usuário e campanha, ignora valores inválidos e é apagado no logout', () => {
    const s = memoryStorage();
    expect(ehPersonagemNovo('novo-abc')).toBe(true); expect(ehPersonagemNovo('abc')).toBe(false);
    gravarMapaAba('u1', 'ca', 'novo-abc', 'srv-1', s);
    expect(lerMapaAba('u1', 'ca', 'novo-abc', s)).toBe('srv-1');
    expect(lerMapaAba('u2', 'ca', 'novo-abc', s)).toBeNull();
    s.setItem('compendio5e:experimental:criador-aba:v1:u1:ca:novo-x', '../fora');
    expect(lerMapaAba('u1', 'ca', 'novo-x', s)).toBeNull();
    clearUserLocalData('u1', s);
    expect(lerMapaAba('u1', 'ca', 'novo-abc', s)).toBeNull();
  });
});

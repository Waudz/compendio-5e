// Contratos de dados do catálogo para o criador de personagens (docs/CATALOGO-DND-2014.md).
import { describe, expect, it } from 'vitest';
import { DND5E_2014, itemPorId, magiaPorId, magiasDaClasse, magiasInexistentes, monstroPorId, refItem, refMagia, refMonstro, REVISAO_CATALOGO_2014, todasAsMagias, todosOsMonstros } from './contratos';
import { validateContentRegistry, type ContentRef } from '../rules/content-registry';

describe('contratos para o criador', () => {
  it('referências versionadas no formato do registro de conteúdo (sourceId, kind, id, revision)', () => {
    expect(refMagia('fireball')).toEqual({ sourceId: 'srd-2014', kind: 'spell', id: 'fireball', revision: REVISAO_CATALOGO_2014 });
    expect(refItem('longsword')).toMatchObject({ sourceId: 'srd-2014', kind: 'item', id: 'longsword' });
    expect(refMonstro('goblin')).toEqual({ sourceId: 'srd-2014', categoria: 'monstros', id: 'goblin', revision: '1' });
    const ref: ContentRef = refMagia('fireball');                                              // atribuível a ContentRef (checado pelo TypeScript)
    expect(() => validateContentRegistry({ sources: [{ id: 'srd-2014', origin: 'srd-2014', title: 'SRD', ruleset: '5e-2014' }], entries: [{ ref, name: 'Bola de Fogo', ruleset: '5e-2014' }] })).not.toThrow();
    expect(DND5E_2014).toBe('dnd5e-2014');
  });
  it('carrega magias e monstros sob demanda, uma vez', async () => {
    const [a, b] = await Promise.all([todasAsMagias(), todasAsMagias()]);
    expect(a).toBe(b); expect(a).toHaveLength(319); expect(await todosOsMonstros()).toHaveLength(323);
  });
  it('busca por id estável; inexistente devolve undefined (nunca por nome)', async () => {
    expect((await magiaPorId('fireball'))?.nome).toBe('Bola de Fogo'); expect(await magiaPorId('Bola de Fogo')).toBeUndefined();
    expect((await monstroPorId('goblin'))?.nd).toBe(0.25); expect(await monstroPorId('nao-existe')).toBeUndefined(); expect(itemPorId('longsword')?.nome).toBe('Espada longa');
  });
  it('lista de magias de uma classe, por círculo, até um círculo e só rituais; ordenada e sem alterar o catálogo', async () => {
    const truquesMago = await magiasDaClasse('wizard', { circulo: 0 });
    expect(truquesMago.length).toBeGreaterThan(10); expect(truquesMago.every(m => m.nivel === 0 && m.classes.includes('wizard'))).toBe(true);
    const ate2 = await magiasDaClasse('cleric', { ate: 2 }); expect(ate2.every(m => m.nivel <= 2)).toBe(true);
    expect(ate2.map(m => m.nivel)).toEqual([...ate2.map(m => m.nivel)].sort((a, b) => a - b));
    expect((await magiasDaClasse('wizard', { ritual: true })).map(m => m.id)).toEqual(expect.arrayContaining(['detect-magic', 'identify']));
    expect((await magiasDaClasse('wizard')).length).toBe(204); expect((await magiasDaClasse('paladin', { circulo: 0 }))).toEqual([]);
    expect(Object.keys((await magiasDaClasse('wizard'))[0]).sort()).toEqual(['classes', 'concentracao', 'en', 'escola', 'id', 'nivel', 'nome', 'ritual']);   // só o resumo
    await expect(magiasDaClasse('artificer' as never)).rejects.toThrow(/desconhecida/);
  });
  it('valida ids de magias salvos numa ficha: devolve os que não existem nesta revisão', async () => {
    expect(await magiasInexistentes(['fireball', 'shield', 'magia-inventada', 'outra'])).toEqual(['magia-inventada', 'outra']);
    expect(await magiasInexistentes([])).toEqual([]);
  });
});

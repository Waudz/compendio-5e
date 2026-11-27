import { describe, expect, it } from 'vitest';
import { itemSchema, categoriasDeItem } from '../catalogue/item-schema';
import { monstroSchema } from '../catalogue/sistemas/dnd5e-2014/esquemas';
import { srdItem, srdItemFile, srdItemPadrao } from '../catalogue/srd-2014-items';
import { definirCatalogoDaCampanha, nomeIndisponivel } from '../catalogue/campanha';
import { jogadorPodeAdicionar } from '../catalogue/disponibilidade';
import { monstrosPadrao, todosOsMonstros } from '../catalogue/contratos';
import { aplicarDaCampanha, carregarDefinicao, daCampanha, secoesDaDefinicao, type LinhaDefinicao } from './definicoes';
import { comCategoria, comValor, definicaoEmBranco } from './EditorDefinicao';

describe('definições da campanha', () => {
  it('modelos em branco nomeados são válidos, inclusive ao trocar a categoria do item', () => {
    const monstro = definicaoEmBranco('monster'), item = definicaoEmBranco('item');
    if (monstro.kind !== 'monster' || item.kind !== 'item') throw Error('tipo');
    expect(monstroSchema.safeParse({ ...monstro.monstro, nome: 'Sombra' }).success).toBe(true);
    for (const c of categoriasDeItem.filter(c => c !== 'pacote'))
      expect(itemSchema.safeParse(comCategoria({ ...item.item, nome: 'X' }, c)).success, c).toBe(true);
  });
  it('substituição e criação valem só para a lista da campanha; o catálogo permanece intacto', async () => {
    const original = srdItem('longsword')!;
    const linha: LinhaDefinicao = { kind: 'item', definitionId: 'longsword', version: 1, data: { definition: { ...original, nome: 'Lâmina do Corvo' }, descricao: 'Fria' } };
    const nova: LinhaDefinicao = { kind: 'item', definitionId: 'custom-1', version: 1, data: { definition: { id: 'custom-1', en: 'Custom', nome: 'Chave', categoria: 'equipamento', raridade: 'mundano' } } };
    const lista = aplicarDaCampanha('item', srdItemFile().items, [linha, nova]);
    expect(lista).toHaveLength(srdItemFile().items.length + 1);
    expect(lista.find(i => i.id === 'longsword')!.nome).toBe('Lâmina do Corvo');
    expect(srdItem('longsword')!.nome).toBe(original.nome);
    const efetiva = (await carregarDefinicao('item', 'longsword', [linha]))!;
    expect(secoesDaDefinicao(efetiva).at(-1)).toMatchObject({ k: 'effects', v: 'Fria' });
    expect((await carregarDefinicao('item', 'longsword', []))!.nome).toBe(original.nome);
  });
  it('dados inválidos são ignorados e o padrão volta a valer', async () => {
    const ruim: LinhaDefinicao = { kind: 'item', definitionId: 'longsword', version: 1, data: { definition: { id: 'longsword', nome: 'quebrado' } } };
    expect(daCampanha(ruim)).toBeUndefined();
    expect((await carregarDefinicao('item', 'longsword', [ruim]))!.campanha).toBeUndefined();
  });
});

describe('catálogo da campanha no inventário e no editor', () => {
  it('a sobreposição vale para o catálogo consultado pela ficha, sem alterar o global, e é esvaziada', async () => {
    definirCatalogoDaCampanha([
      { item: { id: 'custom-a', en: 'Custom', nome: 'Lâmina da mesa', categoria: 'arma', raridade: 'mundano', arma: { categoria: 'simple', alcance: 'melee', propriedades: [], dano: { dado: '1d6', tipo: 'slashing' } } } },
      { item: { id: 'unid-0', en: 'Unidentified', nome: 'Chave estranha', categoria: 'equipamento', raridade: 'mundano' }, mascara: true },
    ], []);
    expect(srdItem('custom-a')!.nome).toBe('Lâmina da mesa');
    expect(srdItemPadrao('custom-a')).toBeUndefined();
    expect(jogadorPodeAdicionar('custom-a')).toBe(false);
    expect(jogadorPodeAdicionar('unid-0')).toBe(false);
    definirCatalogoDaCampanha([], []);
    expect(srdItem('custom-a')).toBeUndefined();
    expect(nomeIndisponivel('unid-0')).toBe('Item não identificado');
    const goblin = (await todosOsMonstros()).find(m => m.id === 'goblin')!;
    definirCatalogoDaCampanha([], [{ ...goblin, nome: 'Goblin da mesa' }]);
    expect((await todosOsMonstros()).find(m => m.id === 'goblin')!.nome).toBe('Goblin da mesa');
    expect((await monstrosPadrao()).find(m => m.id === 'goblin')!.nome).toBe(goblin.nome);
    definirCatalogoDaCampanha([], []);
  });
  it('máscaras nunca entram nas listas do catálogo', () => {
    const mascara: LinhaDefinicao = { kind: 'item', definitionId: 'unid-1', version: 1, mask: true, data: { definition: { id: 'unid-1', en: 'Unidentified', nome: 'X', categoria: 'equipamento', raridade: 'mundano' } } };
    expect(aplicarDaCampanha('item', srdItemFile().items, [mascara])).toHaveLength(srdItemFile().items.length);
  });
  it('perícias, salvaguardas e sentidos editados continuam válidos e aparecem na ficha revelável', () => {
    const d = definicaoEmBranco('monster');
    if (d.kind !== 'monster') throw Error('tipo');
    const monstro = { ...d.monstro, nome: 'Vigia', salvaguardas: comValor(undefined, 'dex', '4'), pericias: comValor(undefined, 'sleight_of_hand', '6'), sentidos: comValor({}, 'visaoNoEscuro', '60')! };
    expect(monstroSchema.safeParse(monstro).success).toBe(true);
    const secoes = secoesDaDefinicao({ ...d, monstro });
    expect(secoes.find(s => s.k === 'saves')!.v).toContain('+4');
    expect(secoes.find(s => s.k === 'skills')!.v).toContain('+6');
    expect(secoes.find(s => s.k === 'senses')!.v).toContain('18 m');
    expect(comValor(monstro.salvaguardas, 'dex', '')).toBeUndefined();
  });
});

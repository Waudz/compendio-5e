import { describe, expect, it } from 'vitest';
import { itemSchema, categoriasDeItem } from '../catalogue/item-schema';
import { monstroSchema } from '../catalogue/sistemas/dnd5e-2014/esquemas';
import { srdItem, srdItemFile } from '../catalogue/srd-2014-items';
import { aplicarDaCampanha, carregarDefinicao, daCampanha, secoesDaDefinicao, type LinhaDefinicao } from './definicoes';
import { comCategoria, definicaoEmBranco } from './EditorDefinicao';

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

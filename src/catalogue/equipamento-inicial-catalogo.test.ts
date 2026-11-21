import { describe, expect, it } from 'vitest';
import { adventuringPacks2014, fighterEquipmentOptions2014, resolvePackItems } from '../rules/starting-equipment-2014';
import { srdItem, srdItemIds } from './srd-2014-items';

describe('equipamento inicial × catálogo canônico de itens', () => {
  it('todo item de toda opção do Guerreiro e de todo pacote existe no catálogo (IDs reais, não candidatos)', () => {
    const ids = srdItemIds();
    const usados = Object.values(fighterEquipmentOptions2014).flatMap(grupo => grupo.flatMap(o => o.components.map(c => c.itemId)));
    for (const id of usados) expect(ids.has(id), `item inexistente no catálogo: ${id}`).toBe(true);
  });
  it('as receitas de pacote coincidem, item a item e em quantidade, com os pacotes oficiais do catálogo', () => {
    const oficiais: Record<string, string> = { explorer: 'explorers-pack', dungeoneer: 'dungeoneers-pack' };
    for (const [chave, receita] of Object.entries(adventuringPacks2014)) {
      const oficial = srdItem(oficiais[chave])!.pacote!.map(p => ({ itemId: p.id, quantity: p.qtd }));
      expect(receita.components, chave).toEqual(oficial);
    }
  });
  it('resolvePackItems aceita as receitas com o conjunto real de IDs e recusa um ID inventado', () => {
    for (const receita of Object.values(adventuringPacks2014)) expect(resolvePackItems(receita, srdItemIds())).toHaveLength(receita.components.length);
    expect(() => resolvePackItems({ id: 'x', name: 'x', components: [{ itemId: 'rations', quantity: 1 }] }, srdItemIds())).toThrow(/Unknown catalogue item/);
  });
  it('armas e armaduras do Guerreiro têm o tipo certo no catálogo', () => {
    expect(srdItem('chain-mail')?.categoria).toBe('armadura');
    expect(srdItem('shield')?.categoria).toBe('escudo');
    expect(srdItem('longbow')?.arma?.categoria).toBe('martial');
    expect(srdItem('handaxe')?.arma?.categoria).toBe('simple');
    expect(srdItem('arrow')).toMatchObject({ categoria: 'municao', lote: 20 });
  });
});

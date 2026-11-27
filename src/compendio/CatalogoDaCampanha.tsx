import { useEffect } from 'react';
import { definirCatalogoDaCampanha, type ItemDaCampanha } from '../catalogue/campanha';
import type { Monstro } from '../catalogue/sistemas/dnd5e-2014/esquemas';
import { daCampanha, useDefinicoes } from './definicoes';

/** Mantém a sobreposição do catálogo igual ao que o servidor autoriza para o usuário na campanha ativa. */
export function CatalogoDaCampanha() {
  const { lista } = useDefinicoes();
  useEffect(() => {
    const itens: ItemDaCampanha[] = [], monstros: Monstro[] = [];
    for (const linha of lista) {
      const d = daCampanha(linha);
      if (d?.kind === 'item') itens.push({ item: d.item, descricao: d.descricao, mascara: linha.mask, identificaComo: linha.identifiesAs });
      else if (d?.kind === 'monster') monstros.push(d.monstro);
    }
    definirCatalogoDaCampanha(itens, monstros);
  }, [lista]);
  useEffect(() => () => definirCatalogoDaCampanha([], []), []);
  return null;
}

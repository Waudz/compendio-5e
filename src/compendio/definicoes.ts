/** Definição que um registro ou página do Compêndio referencia. A fonte é sempre a definição: o registro guarda só o ID. */
import { useEffect, useState } from 'react';
import type { Monstro } from '../catalogue/sistemas/dnd5e-2014/esquemas';
import type { SrdItem } from '../catalogue/item-schema';
import { srdItem } from '../catalogue/srd-2014-items';
import { secoesDoItem, secoesDoMonstro, type Secao } from './ficha';

export type Definicao =
  | { kind: 'monster'; nome: string; monstro: Monstro }
  | { kind: 'item'; nome: string; item: SrdItem; descricao?: string };

export const secoesDaDefinicao = (d: Definicao): Secao[] => (d.kind === 'monster' ? secoesDoMonstro(d.monstro) : secoesDoItem(d.item, d.descricao));

export async function carregarDefinicao(category: 'monster' | 'item', id: string): Promise<Definicao | undefined> {
  if (category === 'item') {
    const item = srdItem(id);
    return item && { kind: 'item', nome: item.nome, item };
  }
  const monstro = (await (await import('../catalogue/contratos')).todosOsMonstros()).find(m => m.id === id);
  return monstro && { kind: 'monster', nome: monstro.nome, monstro };
}

export function useDefinicao(category: string, id: string | undefined, systemId = 'dnd5e-2014'): Definicao | undefined {
  const chave = (category === 'monster' || category === 'item') && id && systemId === 'dnd5e-2014' ? `${category}:${id}` : '';
  const [carregada, setCarregada] = useState<{ chave: string; definicao?: Definicao }>();
  useEffect(() => {
    let vivo = true;
    if (chave) void carregarDefinicao(category as 'monster' | 'item', id!).then(definicao => { if (vivo) setCarregada({ chave, definicao }); }, () => {});
    return () => { vivo = false; };
  }, [chave]);
  return chave && carregada?.chave === chave ? carregada.definicao : undefined;
}

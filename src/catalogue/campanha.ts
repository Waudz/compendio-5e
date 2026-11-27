/** Sobreposição do catálogo para a campanha ativa: substituições, criações e a aparência de itens não identificados.
 *  Contém somente o que o servidor autorizou ao usuário atual e é esvaziada ao trocar de campanha ou de conta.
 *  O catálogo global (arquivos versionados) nunca é alterado. */
import { useSyncExternalStore } from 'react';
import type { SrdItem } from './item-schema';
import type { Monstro } from './sistemas/dnd5e-2014/esquemas';

export type ItemDaCampanha = {
  item: SrdItem; descricao?: string;
  /** Item não identificado: o ID é um código opaco, sem relação com a definição verdadeira. */
  mascara?: boolean;
  /** Somente o mestre recebe: a definição por trás do item não identificado. */
  identificaComo?: string;
};

let itens: ReadonlyMap<string, ItemDaCampanha> = new Map();
let monstros: readonly Monstro[] = [];
let versao = 0, assinatura = '';
const ouvintes = new Set<() => void>();

export function definirCatalogoDaCampanha(novosItens: readonly ItemDaCampanha[], novosMonstros: readonly Monstro[]): void {
  const nova = novosItens.length || novosMonstros.length ? JSON.stringify([novosItens, novosMonstros]) : '';
  if (nova === assinatura) return;
  assinatura = nova;
  itens = new Map(novosItens.map(i => [i.item.id, i]));
  monstros = novosMonstros;
  versao++;
  ouvintes.forEach(f => f());
}
export const itemDaCampanha = (id: string): ItemDaCampanha | undefined => itens.get(id);
export const itensDaCampanha = (): ItemDaCampanha[] => [...itens.values()];
/** Aplica as substituições e criações de monstros à lista padrão. */
export function monstrosComCampanha(padrao: readonly Monstro[]): readonly Monstro[] {
  if (!monstros.length) return padrao;
  const meus = new Map(monstros.map(m => [m.id, m]));
  return [...padrao.map(m => meus.get(m.id) ?? m), ...monstros.filter(m => !padrao.some(p => p.id === m.id))];
}
const assinar = (f: () => void) => { ouvintes.add(f); return () => { ouvintes.delete(f); }; };
/** Quem mostra nomes ou regras do catálogo usa este número para recalcular quando a sobreposição mudar. */
export const useVersaoCatalogo = () => useSyncExternalStore(assinar, () => versao);
export const ehCodigoOculto = (id: string) => id.startsWith('unid-');
/** Nome de reserva quando a definição não está disponível: nunca mostra o código interno. */
export const nomeIndisponivel = (id: string) => (ehCodigoOculto(id) ? 'Item não identificado' : id.startsWith('custom-') ? 'Item da campanha' : id);

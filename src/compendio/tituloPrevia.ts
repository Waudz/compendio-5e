/** Durante "Ver como jogador", o título da aba também usa a projeção do jogador: o nome secreto não fica à mostra. */
import { useSyncExternalStore } from 'react';

const titulos = new Map<string, string>(), ouvintes = new Set<() => void>();
let versao = 0;
const avisar = () => { versao++; ouvintes.forEach(f => f()); };
export function definirTituloPrevia(id: string, titulo: string | null) {
  if ((titulos.get(id) ?? null) === titulo) return;
  if (titulo === null) titulos.delete(id); else titulos.set(id, titulo);
  avisar();
}
export const tituloPrevia = (id: string) => titulos.get(id);
export const useVersaoTituloPrevia = () => useSyncExternalStore(f => { ouvintes.add(f); return () => { ouvintes.delete(f); }; }, () => versao);

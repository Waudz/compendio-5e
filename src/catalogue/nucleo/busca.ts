/** Pesquisa e filtros do catálogo: índice criado UMA vez por categoria (textos já normalizados), consultas lineares baratas (centenas de entradas).
 * Sem acentos, sem maiúsculas, todos os termos precisam aparecer (nos nomes ou no corpo); nomes pesam mais que o corpo.
 */
import type { CategoriaDef } from './tipos';

export const normalizar = (v: string) => v.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR').trim();

export type Entrada<T> = { item: T; nomes: string; corpo: string; ordem: number };
export type Indice<T> = { categoria: CategoriaDef<T>; entradas: readonly Entrada<T>[]; itens: readonly T[] };
export type Consulta = {
  texto?: string;
  /** id do filtro → valor escolhido (selecao: o valor; booleano: true). Valores vazios são ignorados. */
  filtros?: Readonly<Record<string, string | boolean | undefined>>;
  /** id da ordenação; 'relevancia' (padrão com texto) ordena pela pontuação da pesquisa. */
  ordenar?: string;
};

export function indexar<T>(categoria: CategoriaDef<T>, itens: readonly T[]): Indice<T> {
  const entradas = itens.map((item, ordem): Entrada<T> => ({
    item, ordem,
    nomes: normalizar([categoria.nomeDe(item), ...(categoria.nomesAlternativos?.(item) ?? [])].join(' | ')),
    corpo: normalizar(categoria.corpoDe?.(item) ?? ''),
  }));
  return { categoria, entradas, itens };
}

const inicioDePalavra = (texto: string, termo: string) => texto.startsWith(termo) || texto.includes(' ' + termo) || texto.includes('| ' + termo);

function pontuar(e: Entrada<unknown>, termos: readonly string[]): number {
  let total = 0;
  for (const t of termos) {
    if (inicioDePalavra(e.nomes, t)) total += 4;
    else if (e.nomes.includes(t)) total += 2;
    else if (e.corpo.includes(t)) total += 1;
    else return 0;                                   // todos os termos são obrigatórios
  }
  return total + (e.nomes.startsWith(termos[0]) ? 2 : 0);
}

export function passaFiltros<T>(categoria: CategoriaDef<T>, item: T, filtros: Consulta['filtros']): boolean {
  if (!filtros) return true;
  for (const f of categoria.filtros) {
    const escolhido = filtros[f.id];
    if (escolhido === undefined || escolhido === '' || escolhido === false) continue;
    if (f.tipo === 'booleano') { if (!f.extrair(item)) return false; continue; }
    const v = f.extrair(item);
    const lista = v == null ? [] : typeof v === 'string' ? [v] : v;
    if (!lista.includes(String(escolhido))) return false;
  }
  return true;
}

/** Itens que passam nos filtros e na pesquisa, ordenados. Não altera o índice. */
export function consultar<T>(indice: Indice<T>, q: Consulta = {}): T[] {
  const termos = normalizar(q.texto ?? '').split(/\s+/).filter(Boolean);
  const achados: { e: Entrada<T>; pontos: number }[] = [];
  for (const e of indice.entradas) {
    if (!passaFiltros(indice.categoria, e.item, q.filtros)) continue;
    const pontos = termos.length ? pontuar(e, termos) : 1;
    if (pontos > 0) achados.push({ e, pontos });
  }
  const ordenacao = q.ordenar && q.ordenar !== 'relevancia' ? indice.categoria.ordenacoes.find(o => o.id === q.ordenar) : undefined;
  if (ordenacao) achados.sort((a, b) => ordenacao.comparar(a.e.item, b.e.item) || a.e.ordem - b.e.ordem);
  else if (termos.length) achados.sort((a, b) => b.pontos - a.pontos || a.e.ordem - b.e.ordem);
  else { const padrao = indice.categoria.ordenacoes[0]; if (padrao) achados.sort((a, b) => padrao.comparar(a.e.item, b.e.item) || a.e.ordem - b.e.ordem); }
  return achados.map(a => a.e.item);
}

/** Registro de sistemas e carregamento (com cache) das categorias. */
import { indexar, type Indice } from './busca';
import type { CategoriaDef, SistemaDef } from './tipos';

const sistemas = new Map<string, SistemaDef>();
const indices = new Map<CategoriaDef<never>, Promise<Indice<never>>>();
const prontos = new Map<CategoriaDef<never>, Indice<never>>();

export function registrarSistema(s: SistemaDef): void {
  if (sistemas.has(s.id)) throw new Error('Sistema já registrado: ' + s.id);
  const ids = new Set<string>();
  for (const c of s.categorias) { if (ids.has(c.id)) throw new Error(`Categoria duplicada em ${s.id}: ${c.id}`); ids.add(c.id); }
  sistemas.set(s.id, s);
}
export const sistemasRegistrados = (): readonly SistemaDef[] => [...sistemas.values()];
export const sistema = (id: string): SistemaDef | undefined => sistemas.get(id);
export const categoria = (sistemaId: string, categoriaId: string): CategoriaDef<never> | undefined => sistemas.get(sistemaId)?.categorias.find(c => c.id === categoriaId);

/** Índice já disponível, sem esperar: dados em memória (indexados na hora) ou categoria já carregada antes. `undefined` se ainda precisa carregar. */
export function indiceDisponivel<T>(cat: CategoriaDef<T>): Indice<T> | undefined {
  const chave = cat as unknown as CategoriaDef<never>;
  const pronto = prontos.get(chave);
  if (pronto) return pronto as unknown as Indice<T>;
  if (cat.dadosEmMemoria) { const i = indexar(cat, cat.dadosEmMemoria()); prontos.set(chave, i as unknown as Indice<never>); return i; }
  return undefined;
}

/** Carrega e indexa uma categoria UMA vez (promessa em cache). Falha não fica em cache: a próxima chamada tenta de novo. */
export function carregarIndice<T>(cat: CategoriaDef<T>): Promise<Indice<T>> {
  const chave = cat as unknown as CategoriaDef<never>;
  const sincrono = indiceDisponivel(cat);
  if (sincrono) return Promise.resolve(sincrono);
  const existente = indices.get(chave);
  if (existente) return existente as unknown as Promise<Indice<T>>;
  const p = cat.carregar().then(itens => { const i = indexar(cat, itens); prontos.set(chave, i as unknown as Indice<never>); return i; });
  indices.set(chave, p as unknown as Promise<Indice<never>>);
  p.catch(() => indices.delete(chave));
  return p;
}

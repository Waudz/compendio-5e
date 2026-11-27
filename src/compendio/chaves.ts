/** Chaves de divulgação de um registro. Tudo nasce oculto; o servidor é quem aplica a lista na projeção do jogador. */
import { deBlocos } from '../registros';
import { CAMPOS } from './campos';
import type { Conhecimento } from './conhecimento';

export type Chave = { k: string; l: string };
export type GrupoChaves = { id: 'identidade' | 'descricao' | 'detalhes' | 'ficha' | 'posse'; titulo: string; chaves: Chave[] };

/** Só entra o que tem conteúdo: "Revelar tudo" nunca deixa um campo vazio pré-liberado para o que for escrito depois. */
export function gruposDeChaves(e: Conhecimento): GrupoChaves[] {
  const campos = CAMPOS[e.category] ?? [];
  const preenchidos = (long: boolean) => campos.filter(c => !!c.long === long && c.id !== 'nickname' && e.fields?.[c.id]?.trim()).map(c => ({ k: c.id, l: c.label }));
  const apelido = campos.find(c => c.id === 'nickname' && e.fields?.nickname?.trim());
  const grupos: GrupoChaves[] = [
    { id: 'identidade', titulo: 'Identidade', chaves: [{ k: 'name', l: 'Nome' }, ...(apelido ? [{ k: 'nickname', l: apelido.label }] : []), ...(e.imagePath || e.imageDefinitionId ? [{ k: 'image', l: 'Imagem' }] : []), ...(e.category === 'npc' && e.vitalStatus ? [{ k: 'vitalStatus', l: 'Estado vital' }] : [])] },
    { id: 'descricao', titulo: 'Descrição', chaves: [...(deBlocos(e.description ?? []).trim() ? [{ k: 'description', l: 'Descrição' }] : []), ...preenchidos(false)] },
    { id: 'detalhes', titulo: 'Detalhes', chaves: preenchidos(true) },
    { id: 'ficha', titulo: 'Propriedades', chaves: e.category === 'monster' ? [] : (e.sheet ?? []).map(s => ({ k: 'sheet:' + s.k, l: s.l })) },
    { id: 'posse', titulo: 'Posse', chaves: e.category === 'item' ? [{ k: 'holders', l: 'Quem está com o item' }] : [] },
  ];
  return grupos.filter(g => g.chaves.length > 0);
}
export const estaRevelada = (reveladas: readonly string[], k: string) => reveladas.includes(k) || (k.startsWith('sheet:') && reveladas.includes('sheet'));

/** Liga ou desliga um conjunto de chaves. O curinga `sheet` é expandido antes de ocultar uma seção só. */
export function alternarChaves(reveladas: readonly string[], chaves: readonly string[], revelar: boolean, entrada: Conhecimento): string[] {
  const atual = new Set(reveladas);
  if (!revelar && atual.has('sheet') && chaves.some(k => k.startsWith('sheet:'))) {
    atual.delete('sheet');
    for (const s of entrada.sheet ?? []) atual.add('sheet:' + s.k);
  }
  for (const k of chaves) if (revelar) atual.add(k); else atual.delete(k);
  return [...atual].sort();
}
export function todasAsChaves(e: Conhecimento): string[] {
  const chaves = gruposDeChaves(e).flatMap(g => g.chaves.map(c => c.k));
  // A ficha inteira usa o curinga: seções novas da mesma definição continuam reveladas.
  return [...chaves.filter(k => !k.startsWith('sheet:')), ...(e.definitionId && e.category !== 'monster' ? ['sheet'] : [])];
}
export const PRESETS_BESTIARIO = ['Identificado', 'Conhecido', 'Estudado', 'Compreendido'] as const;
const NIVEIS: readonly string[][] = [
  ['name'],
  ['image', 'description', 'appearance', 'nickname', 'classification'],
  ['habitat', 'behavior', 'diet', 'capabilities', 'sightings', 'history'],
  ['weaknesses', 'defenses', 'strategies'],
];
/** Os quatro níveis são atalhos cumulativos sobre campos narrativos: substituem a seleção e continuam ajustáveis. */
export function presetBestiario(nivel: 1 | 2 | 3 | 4, e: Conhecimento): string[] {
  const disponiveis = new Set(todasAsChaves(e));
  return NIVEIS.slice(0, nivel).flat().filter(k => k === 'name' || disponiveis.has(k));
}

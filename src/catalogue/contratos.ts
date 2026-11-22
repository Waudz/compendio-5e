/** CONTRATOS DE DADOS do catálogo para o criador de personagens, a ficha e outras áreas (documentados em docs/CATALOGO-DND-2014.md).
 *  Somente leitura; sem estado compartilhado além do cache de carregamento. Não importa nada do criador nem da navegação.
 *  - Identificadores estáveis: o `id` é o `index` da D&D 5e SRD API (ex.: `fireball`, `adult-red-dragon`, `longsword`); nunca o nome.
 *  - Referência versionada: `{ sourceId: 'srd-2014', kind, id, revision }` (mesmo formato de `src/rules/content-registry.ts`; `kind: 'spell'` e `'item'` já existem).
 *  - Magias e monstros são carregados sob demanda (pedaço separado do pacote): as funções são assíncronas.
 */
import type { ContentRef } from '../rules/content-registry';
import { carregarIndice } from './nucleo/registro';
import { categoriaMagias, categoriaMonstros, DND5E_2014 } from './sistemas/dnd5e-2014';
import type { Magia, Monstro } from './sistemas/dnd5e-2014/esquemas';
import { classesConjuradoras } from './sistemas/dnd5e-2014/esquemas';

export type ClasseConjuradora = (typeof classesConjuradoras)[number];
export { DND5E_2014 };
export const REVISAO_CATALOGO_2014 = '1';
export const FONTE_SRD_2014 = 'srd-2014';

/** Referência versionada de uma magia (compatível com `ContentRef`). */
export const refMagia = (id: string): ContentRef => ({ sourceId: FONTE_SRD_2014, kind: 'spell', id, revision: REVISAO_CATALOGO_2014 });
/** Monstros ainda não têm `ContentKind`; a referência usa o mesmo formato com `categoria` explícita até o registro de conteúdo suportá-los. */
export const refMonstro = (id: string) => ({ sourceId: FONTE_SRD_2014, categoria: 'monstros' as const, id, revision: REVISAO_CATALOGO_2014 });

/** Resumo mínimo de magia para listas do criador (escolha de magias conhecidas/preparadas). */
export type ResumoMagia = Pick<Magia, 'id' | 'nome' | 'en' | 'nivel' | 'escola' | 'classes' | 'ritual' | 'concentracao'>;
const resumo = (m: Magia): ResumoMagia => ({ id: m.id, nome: m.nome, en: m.en, nivel: m.nivel, escola: m.escola, classes: m.classes, ritual: m.ritual, concentracao: m.concentracao });

export async function todasAsMagias(): Promise<readonly Magia[]> { return (await carregarIndice(categoriaMagias)).itens; }
export async function magiaPorId(id: string): Promise<Magia | undefined> { return (await todasAsMagias()).find(m => m.id === id); }

/** Magias da lista de uma classe. `circulo` = só esse círculo (0 = truques); `ate` = até esse círculo; `ritual` = só rituais. Ordenadas por círculo e nome. */
export async function magiasDaClasse(classe: ClasseConjuradora, f: { circulo?: number; ate?: number; ritual?: boolean } = {}): Promise<ResumoMagia[]> {
  if (!classesConjuradoras.includes(classe)) throw new Error('Classe conjuradora desconhecida: ' + classe);
  return (await todasAsMagias())
    .filter(m => m.classes.includes(classe) && (f.circulo === undefined || m.nivel === f.circulo) && (f.ate === undefined || m.nivel <= f.ate) && (f.ritual === undefined || m.ritual === f.ritual))
    .map(resumo).sort((a, b) => a.nivel - b.nivel || a.nome.localeCompare(b.nome, 'pt-BR'));
}
/** Valida uma lista de ids de magia (ex.: escolhas salvas numa ficha): devolve os ids que NÃO existem nesta revisão do catálogo. */
export async function magiasInexistentes(ids: readonly string[]): Promise<string[]> {
  const conhecidas = new Set((await todasAsMagias()).map(m => m.id));
  return ids.filter(id => !conhecidas.has(id));
}

export async function todosOsMonstros(): Promise<readonly Monstro[]> { return (await carregarIndice(categoriaMonstros)).itens; }
export async function monstroPorId(id: string): Promise<Monstro | undefined> { return (await todosOsMonstros()).find(m => m.id === id); }

/** Itens: já em memória (catálogo de 578 itens, `src/catalogue/srd-2014-items.ts`). Reexportado aqui para o criador ter um único ponto de entrada. */
export { srdItem as itemPorId, srdItemRef as refItem } from './srd-2014-items';

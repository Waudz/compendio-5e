/** Esquemas (Zod) das categorias de D&D 5e 2014 geradas por `scripts/catalogo/*`. Usados nos TESTES para validar os arquivos de dados por inteiro
 * (o carregamento em produção só confere versão e contagem, para não gastar CPU no celular com ~1 MB de JSON).
 */
import { z } from 'zod';

const id = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
export const escolas = ['abjuration', 'conjuration', 'divination', 'enchantment', 'evocation', 'illusion', 'necromancy', 'transmutation'] as const;
export const classesConjuradoras = ['bard', 'cleric', 'druid', 'paladin', 'ranger', 'sorcerer', 'warlock', 'wizard'] as const;
export const atributos = ['str', 'dex', 'con', 'int', 'wis', 'cha'] as const;
const atributoApi = z.enum(['str', 'dex', 'con', 'int', 'wis', 'cha']);

// ---------------------------------------------------------------- magias
export const magiaSchema = z.object({
  id, en: z.string().min(1), nome: z.string().min(1),
  nivel: z.number().int().min(0).max(9), escola: z.enum(escolas),
  classes: z.array(z.enum(classesConjuradoras)).min(0).max(8),
  ritual: z.boolean(), concentracao: z.boolean(),
  tempo: z.object({ tipo: z.enum(['action', 'bonus-action', 'reaction', 'minute', 'hour']), qtd: z.number().int().positive() }).strict(),
  alcance: z.object({ tipo: z.enum(['self', 'touch', 'sight', 'unlimited', 'special', 'distance']), pes: z.number().int().positive().optional(), milhas: z.number().int().positive().optional() }).strict(),
  duracao: z.object({ tipo: z.enum(['instant', 'until-dispelled', 'special', 'timed']), qtd: z.number().int().positive().optional(), unidade: z.enum(['round', 'minute', 'hour', 'day']).optional(), ate: z.literal(true).optional() }).strict(),
  componentes: z.object({ v: z.boolean(), s: z.boolean(), m: z.boolean() }).strict(),
  material: z.string().min(1).optional(),
  area: z.object({ tipo: z.enum(['cube', 'sphere', 'line', 'cone', 'cylinder']), pes: z.number().int().positive() }).strict().optional(),
  ataque: z.enum(['melee', 'ranged']).optional(),
  salvaguarda: z.object({ atributo: atributoApi, efeito: z.enum(['none', 'half', 'other']) }).strict().optional(),
  dano: z.array(z.string().min(1)).optional(),
  subclasses: z.array(z.string().min(1)).optional(),
  descricao: z.array(z.string().min(1)).min(1),
  superiores: z.string().min(1).optional(),
}).strict().superRefine((m, ctx) => {
  const falha = (message: string) => ctx.addIssue({ code: 'custom', message });
  if ((m.alcance.tipo === 'distance') !== (m.alcance.pes !== undefined || m.alcance.milhas !== undefined)) falha('alcance: distância só com pés ou milhas');
  if (m.alcance.pes !== undefined && m.alcance.milhas !== undefined) falha('alcance: pés e milhas juntos');
  if ((m.duracao.tipo === 'timed') !== (m.duracao.qtd !== undefined && m.duracao.unidade !== undefined)) falha('duração: tempo só com quantidade e unidade');
  if (m.concentracao && m.duracao.tipo !== 'timed') falha('concentração exige duração com tempo');
  if (m.componentes.m !== (m.material !== undefined)) falha('material deve existir exatamente quando há componente M');
});
export type Magia = z.infer<typeof magiaSchema>;

// ---------------------------------------------------------------- monstros
const textoMonstro = z.object({
  n: z.string().min(1), en: z.string().min(1), t: z.string().min(1), tr: z.boolean(), orig: z.string().min(1).optional(),
  grupo: z.enum(['ACTION', 'BONUS_ACTION', 'REACTION', 'LEGENDARY_ACTION', 'LAIR_ACTION']).optional(),
  custo: z.number().int().min(2).optional(),
  uso: z.object({ tipo: z.string().min(1), valor: z.number().optional() }).strict().optional(),
}).strict();
export const tiposDeCriatura = ['aberration', 'beast', 'celestial', 'construct', 'dragon', 'elemental', 'fey', 'fiend', 'giant', 'humanoid', 'monstrosity', 'ooze', 'plant', 'undead'] as const;
export const tamanhos = ['tiny', 'small', 'medium', 'large', 'huge', 'gargantuan'] as const;
const pesPositivos = z.number().int().positive();
export const monstroSchema = z.object({
  id, en: z.string().min(1), nome: z.string().min(1), traduzido: z.boolean(),
  tipo: z.enum(tiposDeCriatura), tamanho: z.enum(tamanhos),
  nd: z.number().min(0).max(30), xp: z.number().int().min(0),
  tendencia: z.string(), tendenciaEn: z.string(),
  ca: z.number().int().min(1), caDetalhe: z.string().min(1).optional(), pv: z.number().int().min(1), dadosVida: z.string().regex(/^\d+d\d+(\s*[+-]\s*\d+)?$/),
  deslocamento: z.object({ walk: pesPositivos.optional(), fly: pesPositivos.optional(), swim: pesPositivos.optional(), climb: pesPositivos.optional(), burrow: pesPositivos.optional() }).strict(),
  planar: z.literal(true).optional(),
  atributos: z.object({ str: z.number().int().min(1).max(30), dex: z.number().int().min(1).max(30), con: z.number().int().min(1).max(30), int: z.number().int().min(1).max(30), wis: z.number().int().min(1).max(30), cha: z.number().int().min(1).max(30) }).strict(),
  salvaguardas: z.partialRecord(atributoApi, z.number().int()).optional(),
  pericias: z.record(z.string(), z.number().int()).optional(),
  percepcaoPassiva: z.number().int().min(1),
  sentidos: z.object({ visaoNoEscuro: pesPositivos.optional(), percepcaoAsCegas: pesPositivos.optional(), sentidoSismico: pesPositivos.optional(), visaoVerdadeira: pesPositivos.optional() }).strict(),
  idiomas: z.string(),
  defesas: z.object({
    resistencias: z.array(z.string()), imunidades: z.array(z.string()), vulnerabilidades: z.array(z.string()), condicoes: z.array(z.string()),
    resistenciasTexto: z.string(), imunidadesTexto: z.string(), vulnerabilidadesTexto: z.string(), condicoesTexto: z.string(),
  }).strict(),
  ambientes: z.array(z.string().min(1)),
  tracos: z.array(textoMonstro), acoes: z.array(textoMonstro),
}).strict();
export type Monstro = z.infer<typeof monstroSchema>;

// ---------------------------------------------------------------- arquivo de categoria
const fonte = z.object({ id: z.string().min(1), titulo: z.string().min(1), licenca: z.string().min(1) }).strict();
const cabecalho = { schemaVersion: z.literal(1), sistema: z.literal('dnd5e-2014'), revision: id.or(z.string().regex(/^\d+$/)), fonte, proveniencia: z.string().min(1), count: z.number().int().nonnegative(), sha256: z.string().regex(/^[0-9a-f]{64}$/) };
export const arquivoMagiasSchema = z.object({ ...cabecalho, categoria: z.literal('magias'), itens: z.array(magiaSchema) }).strict();
export const arquivoMonstrosSchema = z.object({ ...cabecalho, categoria: z.literal('monstros'), itens: z.array(monstroSchema) }).strict();
export type ArquivoMagias = z.infer<typeof arquivoMagiasSchema>;
export type ArquivoMonstros = z.infer<typeof arquivoMonstrosSchema>;

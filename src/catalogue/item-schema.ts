/** Esquema (Zod) do catálogo de itens SRD 2014. Toda entrada de dados passa por aqui antes de virar definição
 * do catálogo canônico; dado malformado falha no carregamento, nunca é "consertado" em silêncio.
 */
import { z } from 'zod';

const identificador = z.string().regex(/^[a-z0-9]+(?:[.-][a-z0-9]+)*$/, 'identificador inválido');
const moeda = z.enum(['cp', 'sp', 'gp']);
const dano = z.object({ dado: z.string().regex(/^\d+(d\d+)?$/), tipo: z.enum(['bludgeoning', 'piercing', 'slashing']).optional() }).strict();
const alcance = z.object({ normal: z.number().positive(), longo: z.number().positive().optional() }).strict();

export const propriedadesDeArma = ['light', 'monk', 'finesse', 'thrown', 'two-handed', 'versatile', 'ammunition', 'loading', 'heavy', 'reach', 'special'] as const;

const arma = z.object({
  categoria: z.enum(['simple', 'martial']),
  alcance: z.enum(['melee', 'ranged']),
  propriedades: z.array(z.enum(propriedadesDeArma)),
  dano: dano.optional(),
  danoDuasMaos: dano.optional(),
  alcanceM: alcance.optional(),
  arremessoM: alcance.optional(),
}).strict();

const armadura = z.object({
  categoria: z.enum(['light', 'medium', 'heavy', 'shield']),
  ca: z.number().int().min(0),
  somaDes: z.boolean(),
  maxDes: z.number().int().nullable(),
  forMin: z.number().int().min(0),
  furtividade: z.boolean(),
}).strict();

export const categoriasDeItem = ['arma', 'armadura', 'escudo', 'equipamento', 'municao', 'foco', 'kit', 'pacote', 'ferramenta', 'montaria-veiculo', 'magico', 'pocao', 'pergaminho'] as const;
export const raridades = ['mundano', 'common', 'uncommon', 'rare', 'very-rare', 'legendary', 'artifact'] as const;

export const itemSchema = z.object({
  id: identificador,
  en: z.string().trim().min(1),
  nome: z.string().trim().min(1),
  categoria: z.enum(categoriasDeItem),
  subtipo: z.string().min(1).optional(),
  custo: z.object({ v: z.number().nonnegative(), u: moeda }).strict().optional(),
  peso: z.number().nonnegative().optional(),
  lote: z.number().int().positive().optional(),
  velocidade: z.object({ v: z.number().nonnegative(), u: z.string().min(1) }).strict().optional(),
  arma: arma.optional(),
  armadura: armadura.optional(),
  pacote: z.array(z.object({ id: identificador, qtd: z.number().int().positive() }).strict()).optional(),
  raridade: z.enum(raridades),
  sintonia: z.boolean().optional(),
  espaco: z.string().min(1).optional(),
  cura: z.string().regex(/^\d+d\d+(\+\d+)?$/).optional(),
  alias: z.array(identificador).optional(),
}).strict().superRefine((item, ctx) => {
  const falha = (message: string) => ctx.addIssue({ code: 'custom', message });
  if (item.categoria === 'arma' && !item.arma) falha('arma sem bloco de arma');
  if ((item.categoria === 'armadura' || item.categoria === 'escudo') && !item.armadura) falha('armadura sem bloco de armadura');
  if (item.categoria === 'pacote' && !item.pacote?.length) falha('pacote sem componentes');
  if (item.categoria !== 'pacote' && item.pacote) falha('componentes só são válidos em pacotes');
  if (item.categoria !== 'arma' && item.arma) falha('bloco de arma em item que não é arma');
  if (item.categoria === 'armadura' && item.armadura && item.armadura.categoria === 'shield') falha('armadura com categoria de escudo');
  if (item.categoria === 'escudo' && item.armadura && item.armadura.categoria !== 'shield') falha('escudo com categoria de armadura');
  if (['magico', 'pocao', 'pergaminho'].includes(item.categoria) === (item.raridade === 'mundano')) falha('raridade incompatível com a categoria');
});
export type SrdItem = z.infer<typeof itemSchema>;

export const itemCatalogueFileSchema = z.object({
  schemaVersion: z.literal(1),
  revision: identificador,
  source: z.object({ id: identificador, title: z.string().min(1), license: z.string().min(1), attribution: z.string().min(1) }).strict(),
  provenance: z.object({ legacyFile: z.string(), legacyVersion: z.number().nullable(), legacySource: z.string().nullable() }).strict(),
  count: z.number().int().nonnegative(),
  sha256: z.string().regex(/^[0-9a-f]{64}$/),
  items: z.array(itemSchema),
}).strict();
export type ItemCatalogueFile = z.infer<typeof itemCatalogueFileSchema>;

/** Valida o arquivo e as referências ENTRE itens (IDs únicos, aliases livres, componentes de pacote existentes). */
export function parseItemCatalogueFile(input: unknown): ItemCatalogueFile {
  const file = itemCatalogueFileSchema.parse(input);
  if (file.count !== file.items.length) throw new Error(`Contagem declarada (${file.count}) difere da real (${file.items.length})`);
  const ids = new Set<string>();
  for (const item of file.items) {
    if (ids.has(item.id)) throw new Error('ID de item duplicado: ' + item.id);
    ids.add(item.id);
  }
  for (const item of file.items) {
    for (const alias of item.alias ?? []) if (ids.has(alias)) throw new Error(`Alias ${alias} de ${item.id} colide com um item real`);
    for (const parte of item.pacote ?? []) {
      if (!ids.has(parte.id)) throw new Error(`Pacote ${item.id} referencia item inexistente: ${parte.id}`);
      if (parte.id === item.id) throw new Error(`Pacote ${item.id} contém a si mesmo`);
    }
  }
  const aliases = file.items.flatMap(i => i.alias ?? []);
  if (new Set(aliases).size !== aliases.length) throw new Error('Alias duplicado entre itens');
  return file;
}

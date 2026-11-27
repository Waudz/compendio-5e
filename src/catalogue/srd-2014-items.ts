/** Catálogo canônico de itens SRD 5.1 (2014): carrega o arquivo de dados versionado, valida (Zod) e o expõe como
 * `RulesCatalogue`, o MESMO formato lido por Compêndio, criador, ficha e inventário. Sem rede e sem efeito colateral
 * além da validação única no primeiro uso.
 */
import dados from './data/srd-2014-items.json';
import { itemDaCampanha } from './campanha';
import { parseItemCatalogueFile, type ItemCatalogueFile, type SrdItem } from './item-schema';
import type { ContentRef } from '../rules/content-registry';
import { validateRulesCatalogue, type RulesCatalogue } from '../rules/rules-catalogue';

export const SRD_2014_SOURCE_ID = 'srd-2014';

const rotuloCategoria: Record<SrdItem['categoria'], string> = {
  arma: 'Arma', armadura: 'Armadura', escudo: 'Escudo', equipamento: 'Equipamento de aventura', municao: 'Munição', foco: 'Foco de conjuração',
  kit: 'Kit', pacote: 'Pacote de equipamento', ferramenta: 'Ferramenta', 'montaria-veiculo': 'Montaria ou veículo', magico: 'Item mágico', pocao: 'Poção', pergaminho: 'Pergaminho',
};
const rotuloRaridade: Record<SrdItem['raridade'], string> = {
  mundano: 'mundano', common: 'comum', uncommon: 'incomum', rare: 'raro', 'very-rare': 'muito raro', legendary: 'lendário', artifact: 'artefato',
};
const rotuloPropriedade: Record<string, string> = {
  light: 'leve', monk: 'arma de monge', finesse: 'acuidade', thrown: 'arremesso', 'two-handed': 'duas mãos', versatile: 'versátil', ammunition: 'munição', loading: 'recarga', heavy: 'pesada', reach: 'alcance', special: 'especial',
};
const rotuloDano: Record<string, string> = { bludgeoning: 'contundente', piercing: 'perfurante', slashing: 'cortante' };
const rotuloArmadura: Record<string, string> = { light: 'leve', medium: 'média', heavy: 'pesada', shield: 'escudo' };
const moeda = { cp: 'pc', sp: 'pp', gp: 'po' } as const;
const numero = (n: number) => String(n).replace('.', ',');

/** Resumo em pt-BR derivado SOMENTE dos campos estruturados; o texto integral do SRD não faz parte deste catálogo. */
export function describeItem(item: SrdItem): string {
  const partes: string[] = [rotuloCategoria[item.categoria] + (item.subtipo && item.categoria === 'arma' && item.arma ? ` ${item.arma.categoria === 'simple' ? 'simples' : 'marcial'} ${item.arma.alcance === 'melee' ? 'corpo a corpo' : 'à distância'}` : '')];
  if (item.arma?.dano) {
    const d = item.arma.dano; partes.push(`Dano ${d.dado}${d.tipo ? ' ' + rotuloDano[d.tipo] : ''}`);
    if (item.arma.danoDuasMaos) partes.push(`${item.arma.danoDuasMaos.dado} com duas mãos`);
  }
  if (item.arma?.propriedades.length) partes.push('Propriedades: ' + item.arma.propriedades.map(p => rotuloPropriedade[p]).join(', '));
  if (item.armadura) {
    const a = item.armadura;
    partes.push(a.categoria === 'shield' ? `+${a.ca} de CA` : `Armadura ${rotuloArmadura[a.categoria]}, CA ${a.ca}${a.somaDes ? ' + Des' + (a.maxDes != null ? ` (máx. ${a.maxDes})` : '') : ''}`);
    if (a.forMin) partes.push(`Força mínima ${a.forMin}`);
    if (a.furtividade) partes.push('Desvantagem em Furtividade');
  }
  if (item.cura) partes.push(`Cura ${item.cura}`);
  if (item.pacote) partes.push(`${item.pacote.length} tipos de item`);
  if (['magico', 'pocao', 'pergaminho'].includes(item.categoria)) partes.push(`Raridade ${rotuloRaridade[item.raridade]}${item.sintonia ? ', requer sintonização' : ''}`);
  if (item.custo) partes.push(`Custo ${numero(item.custo.v)} ${moeda[item.custo.u]}`);
  if (item.peso != null) partes.push(`Peso ${numero(item.peso)} kg`);
  if (item.lote) partes.push(`Vendido em lotes de ${item.lote}`);
  return partes.join('. ') + '.';
}

export const categoriaDoItemRotulo = (categoria: SrdItem['categoria']) => rotuloCategoria[categoria];
export const raridadeRotulo = (raridade: SrdItem['raridade']) => rotuloRaridade[raridade];

/** Fatos estruturados do item como pares [rótulo, valor] em pt-BR, para a página de detalhes (mesma fonte do resumo). */
export function itemFacts(item: SrdItem): [string, string][] {
  const f: [string, string][] = [['Categoria', rotuloCategoria[item.categoria]], ['Raridade', rotuloRaridade[item.raridade] + (item.sintonia ? ' (requer sintonização)' : '')]];
  if (item.custo) f.push(['Custo', `${numero(item.custo.v)} ${moeda[item.custo.u]}`]);
  if (item.peso != null) f.push(['Peso', `${numero(item.peso)} kg`]);
  if (item.lote) f.push(['Lote', `${item.lote} unidades`]);
  if (item.arma) {
    f.push(['Tipo de arma', `${item.arma.categoria === 'simple' ? 'Simples' : 'Marcial'}, ${item.arma.alcance === 'melee' ? 'corpo a corpo' : 'à distância'}`]);
    if (item.arma.dano) f.push(['Dano', `${item.arma.dano.dado}${item.arma.dano.tipo ? ' ' + rotuloDano[item.arma.dano.tipo] : ''}${item.arma.danoDuasMaos ? ` (${item.arma.danoDuasMaos.dado} com duas mãos)` : ''}`]);
    if (item.arma.propriedades.length) f.push(['Propriedades', item.arma.propriedades.map(p => rotuloPropriedade[p]).join(', ')]);
    if (item.arma.alcanceM) f.push(['Alcance', item.arma.alcanceM.longo ? `${numero(item.arma.alcanceM.normal)} m / ${numero(item.arma.alcanceM.longo)} m` : `${numero(item.arma.alcanceM.normal)} m`]);
    if (item.arma.arremessoM) f.push(['Arremesso', `${numero(item.arma.arremessoM.normal)} m / ${numero(item.arma.arremessoM.longo ?? item.arma.arremessoM.normal)} m`]);
  }
  if (item.armadura) {
    const a = item.armadura;
    f.push(['Classe de Armadura', a.categoria === 'shield' ? `+${a.ca}` : `${a.ca}${a.somaDes ? ' + Des' + (a.maxDes != null ? ` (máx. ${a.maxDes})` : '') : ''}`]);
    if (a.forMin) f.push(['Força mínima', String(a.forMin)]);
    if (a.furtividade) f.push(['Furtividade', 'Desvantagem']);
  }
  if (item.cura) f.push(['Cura', item.cura]);
  if (item.velocidade) f.push(['Velocidade', `${numero(item.velocidade.v)} ${item.velocidade.u}`]);
  return f;
}

let arquivo: ItemCatalogueFile | undefined;
let catalogo: RulesCatalogue | undefined;
let porId: ReadonlyMap<string, SrdItem> | undefined;
let aliases: ReadonlyMap<string, string> | undefined;

/** Arquivo validado (Zod + referências entre itens). Erro de dados interrompe o carregamento. */
export function srdItemFile(): ItemCatalogueFile {
  return arquivo ??= parseItemCatalogueFile(dados);
}

/** O catálogo canônico de itens: uma entrada e uma definição por item, na mesma revisão do arquivo. */
export function srdItemsCatalogue(): RulesCatalogue {
  if (catalogo) return catalogo;
  const file = srdItemFile();
  const entries = file.items.map(item => ({ ref: srdItemRef(item.id), name: item.nome, ruleset: '5e-2014' as const }));
  const definitions = file.items.map(item => ({ ref: srdItemRef(item.id), description: describeItem(item), data: Object.freeze({ ...item }) as Readonly<Record<string, unknown>> }));
  const built: RulesCatalogue = {
    registry: { sources: [{ id: file.source.id, origin: 'srd-2014', title: file.source.title, ruleset: '5e-2014', license: file.source.license }], entries },
    definitions,
  };
  validateRulesCatalogue(built);
  porId = new Map(file.items.map(i => [i.id, i]));
  aliases = new Map(file.items.flatMap(i => (i.alias ?? []).map(a => [a, i.id] as const)));
  return catalogo = built;
}

export const srdItemRef = (id: string): ContentRef => ({ sourceId: SRD_2014_SOURCE_ID, kind: 'item', id, revision: srdItemFile().revision });

/** Dados estruturados de um item pelo ID (aceita o alias legado, ex.: `potion-of-healing`). `undefined` se não existir. */
export function srdItem(id: string): SrdItem | undefined {
  return itemDaCampanha(id)?.item ?? srdItemPadrao(id);
}
/** Somente o catálogo global, sem as definições da campanha. */
export function srdItemPadrao(id: string): SrdItem | undefined {
  srdItemsCatalogue();
  return porId!.get(aliases!.get(id) ?? id);
}
/** ID canônico de um ID ou alias; `undefined` se desconhecido. */
export function canonicalItemId(id: string): string | undefined { return srdItem(id)?.id; }
export const srdItemIds = (): ReadonlySet<string> => { srdItemsCatalogue(); return new Set(porId!.keys()); };

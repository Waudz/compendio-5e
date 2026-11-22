#!/usr/bin/env node
/** Audita a fidelidade numérica das traduções dos monstros: para cada característica/ação, os números do texto em português devem corresponder aos do original em inglês
 *  (dados, médias de dano, CD, bônus, PV, quantidades, durações, porcentagens) e as distâncias devem ser as do original convertidas (pés × 0,3; polegadas; milhas).
 *  Não prova que a tradução está correta, só detecta número perdido, trocado ou inventado. Uso: node scripts/catalogo/auditar-traducoes.mjs [--json]  (código 1 se houver divergência)
 *  Exceções analisadas e aceitas estão em EXCECOES (chave `id|nome em inglês`, com `|dist` para distâncias), cada uma com o motivo. */
import { readFile } from 'node:fs/promises';

const dados = JSON.parse(await readFile(new URL('../../src/catalogue/sistemas/dnd5e-2014/data/monstros.json', import.meta.url), 'utf8')).itens;

/** Divergências analisadas e aceitas. */
export const EXCECOES = {
  // Falsos positivos da checagem de termos (o texto em português está de acordo com o original):
  'gibbering-mouther|Multiattack|cego': 'cita a ação "Cusparada Cegante" (nome da ação)',
  'deva|Healing Touch|envenenado': '"poison" do original = "envenenamento" (a cura de envenenamento)',
  'planetar|Healing Touch|envenenado': 'idem', 'solar|Healing Touch|envenenado': 'idem',
  'swarm-of-poisonous-snakes|Swarm|dano venenoso': 'só o nome "Enxame de Cobras Venenosas"',
  'hill-giant|Multiattack|Grande': '"clava grande" (greatclub), não o tamanho', 'stone-giant|Multiattack|Grande': 'idem', 'frost-giant|Multiattack|Grande': '"machado grande" (greataxe), não o tamanho',
  'werebear|Multiattack|Grande': '"machado grande" (greataxe), não o tamanho', 'solar|Flying Sword|Grande': '"espada grande" (greatsword), não o tamanho',
  'quasit|Invisibility|amedrontado': 'cita a ação "Assustar" (Scare)',
  'troll|Regeneration|dano de fogo': 'o original diz "acid or fire damage"; a tradução diz "dano de ácido ou de fogo"',
  'unicorn|Healing Touch|dano venenoso': 'o original diz "neutralizes all poisons"; a tradução diz "neutraliza todos os venenos"',
  'copper-dragon-wyrmling|Breath Weapons': 'erro de digitação da fonte (Open5e): "1 5-foot cone"; o SRD 5.1 traz cone de 15 pés (4,5 m), que é o que a tradução usa',
  'copper-dragon-wyrmling|Breath Weapons|dist': 'idem: cone de 15 pés = 4,5 m',
  'will-o-wisp|Variable Illumination': 'o original diz "5- to 20-foot radius" (o 5 fica separado do "foot"); a tradução diz 1,5 a 6 m, o que está correto',
};

const N = '(\\d+(?:[.,]\\d+)?)', S = '(?:/(\\d+(?:[.,]\\d+)?))?';
const DIST_EN = new RegExp(`${N}${S}[-\\s]*(feet|foot|ft\\.?|inches|inch|in\\.|miles?)(?![a-z])`, 'gi');
const DIST_PT = new RegExp(`${N}${S}\\s*(metros?|m|cm|km)(?![\\p{L}])`, 'giu');
const num = (x) => Number(String(x).replace(',', '.'));
const FATOR_EN = (u) => (/^(feet|foot|ft)/i.test(u) ? 0.3 : /^in/i.test(u) ? 0.0254 : 1609);
const FATOR_PT = { m: 1, metro: 1, metros: 1, cm: 0.01, km: 1000 };

const numeros = (texto, dist) => (texto.replace(dist, ' ').match(/\d+d\d+|\d+(?:,\d+)?/g) ?? []).map((n) => n.replace(',', '.')).sort();
function distancias(texto, re, fator) {
  const out = [];
  for (const m of texto.matchAll(re)) for (const v of [m[1], m[2]]) if (v !== undefined) out.push(num(v) * fator(m[3].toLowerCase()));
  return out.sort((x, y) => x - y);
}
const iguais = (x, y) => x.length === y.length && x.every((v, i) => Math.abs(v - y[i]) <= Math.max(0.12, 0.12 * Math.max(v, y[i])));

/** Termos de regra: cada um tem o radical em inglês e o em português. O conjunto de termos presentes tem de ser o mesmo no original e na tradução. */
const TERMOS = [
  ['Força', 'Strength', 'Força(?![a-zçã])'], ['Destreza', 'Dexterity', 'Destreza'], ['Constituição', 'Constitution', 'Constituição'], ['Inteligência', 'Intelligence', 'Inteligência'], ['Sabedoria', 'Wisdom', 'Sabedoria'], ['Carisma', 'Charisma', 'Carisma'],
  ['dano ácido', 'acid(?! breath)', 'ácid'], ['dano contundente', 'bludgeoning', 'contundente'], ['dano de frio', 'cold damage', 'dano de frio|gélid'], ['dano de fogo', 'fire damage', 'dano de fogo|ígneo'], ['dano de energia', 'force damage', 'dano de energia|energético'],
  ['dano elétrico', 'lightning(?: or (?:slashing|thunder))? damage', 'elétric'], ['dano necrótico', 'necrotic', 'necrótic'], ['dano perfurante', 'piercing', 'perfurante'], ['dano venenoso', 'poison(?!ed)', 'veneno|venenos|envenenamento'], ['dano psíquico', 'psychic', 'psíquic'],
  ['dano radiante', 'radiant', 'radiante'], ['dano cortante', 'slashing', 'cortante'], ['dano trovejante', 'thunder', 'trovej|trovão'],
  ['cego', 'blind(?:ed|ness)', 'ceg(?!as)'], ['enfeitiçado', 'charm(?:ed)?', 'enfeiti'], ['surdo', 'deaf(?:ened|ness)', 'surd'], ['amedrontado', 'frightened', 'amedront|assust'], ['agarrado', 'grappl[a-z]*', 'agarr'], ['incapacitado', 'incapacitated', 'incapacit'],
  ['paralisado', 'paralyz(?:ed|ing)', 'paralis'], ['petrificado', 'petrif(?:ied|ication|y)', 'petrific'], ['envenenado', 'poisoned', 'envenen'], ['caído', 'prone', 'caíd|derrub|no chão'], ['contido', 'restrain(?:ed|ing)?', 'contid|contenção|impedid'], ['atordoado', 'stunned', 'atordo'], ['inconsciente', 'unconscious', 'inconsciente'],
  ['Miúdo', 'Tiny', 'Miúd'], ['Pequeno', 'Small', 'Pequen'], ['Médio', 'Medium', 'Médi'], ['Grande', 'Large', 'Grande'], ['Enorme', 'Huge', 'Enorme'], ['Imenso', 'Gargantuan', 'Imenso|Gigantesc'],
].map(([nome, en, pt]) => ({ nome, en: new RegExp(`(?<!\\p{L})(?:${en})(?!\\p{L})`, 'iu'), pt: new RegExp(`(?<!\\p{L})(?:${pt})`, 'iu') }));
const problemas = [];
for (const m of dados) for (const t of [...m.tracos, ...m.acoes]) {
  if (!t.orig) continue;
  const en = t.orig.replace(/\*+/g, ''), chave = `${m.id}|${t.en}`;
  const a = numeros(en, DIST_EN).join(','), b = numeros(t.t, DIST_PT).join(',');
  const da = distancias(en, DIST_EN, FATOR_EN), db = distancias(t.t, DIST_PT, (u) => FATOR_PT[u.toLowerCase()]);
  if (a !== b && !EXCECOES[chave]) problemas.push({ id: m.id, texto: t.en, tipo: 'números', en: a, pt: b });
  if (!iguais(da, db) && !EXCECOES[`${chave}|dist`]) problemas.push({ id: m.id, texto: t.en, tipo: 'distâncias', en: da.map((v) => v.toFixed(2)).join(','), pt: db.map((v) => v.toFixed(2)).join(',') });

  // termos de regra (atributos, tipos de dano, condições, tamanhos): presença igual nos dois textos
  if (!/spellcasting/i.test(t.en)) for (const x of TERMOS) { const e = x.en.test(en), q = x.pt.test(t.t); if (e !== q && !EXCECOES[`${chave}|${x.nome}`]) problemas.push({ id: m.id, texto: t.en, tipo: 'termo', en: e ? x.nome : '', pt: q ? x.nome : '' }); }
}
const total = dados.reduce((s, m) => s + m.tracos.length + m.acoes.length, 0);
if (process.argv.includes('--json')) console.log(JSON.stringify({ total, divergencias: problemas }, null, 1));
else { console.log(`${total} textos; ${problemas.length} divergências`); for (const p of problemas) console.log(`${p.id} | ${p.texto} | ${p.tipo}: EN [${p.en}] × PT [${p.pt}]`); }
process.exitCode = problemas.length ? 1 : 0;

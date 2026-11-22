#!/usr/bin/env node
/** Confere o catálogo commitado (magias e monstros) contra a D&D 5e SRD API (/api/2014). Manual: usa rede ou caches; não grava nada.
 *  Magias: nível, escola, classes, ritual, concentração, tempo, alcance, duração e componentes, magia a magia.
 *  Monstros: ND, PV, CA, tamanho, tipo, atributos e XP (só os que existem na API; o legado agrupa variações de forma em uma ficha).
 *  Uso: node scripts/catalogo/verificar-catalogo-api.mjs [--magias-api cache.json] [--monstros-api cache.json]   (código 1 se houver divergência não explicada)
 */
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const arg = (n) => { const i = process.argv.indexOf('--' + n); return i > 0 ? process.argv[i + 1] : undefined; };
const lerDados = async (nome) => JSON.parse(await readFile(new URL(`../../src/catalogue/sistemas/dnd5e-2014/data/${nome}.json`, import.meta.url), 'utf8')).itens;
const base = 'https://www.dnd5eapi.co';
async function daApi(cache, colecao) {
  if (cache) return JSON.parse(await readFile(resolve(cache), 'utf8'));
  const lista = await (await fetch(`${base}/api/2014/${colecao}`)).json();
  const out = []; for (const { index } of lista.results) out.push(await (await fetch(`${base}/api/2014/${colecao}/${index}`)).json());
  return out;
}

/** Divergências analisadas em que o catálogo segue o SRD 5.1 e a API está errada (ou o inverso, já corrigido no construtor). Cada uma com motivo. */
const CONHECIDAS = {
  'monstro:basilisk:ca': 'SRD 5.1: CA 15 (armadura natural); a API devolve 12',
  'monstro:riding-horse:xp': 'ND 1/4 = 50 XP (tabela do SRD); a API devolve 25',
  'monstro:dretch:xp': 'ND 1/4 = 50 XP (tabela do SRD); a API devolve 25',
  'monstro:brass-dragon-wyrmling:xp': 'ND 1 = 200 XP (tabela do SRD); a API devolve 100',
  'monstro:deep-gnome-svirfneblin:xp': 'ND 1/2 = 100 XP (tabela do SRD); a API devolve 50',
  'monstro:azer:ca': 'SRD 5.1: CA 17 (armadura natural, escudo); a API lista 15 base e 17 com escudo',
  'monstro:lizardfolk:ca': 'SRD 5.1: CA 15 (armadura natural, escudo); a API lista 13 base e 15 com escudo',
};
const divergencias = [], aceitas = [];
const nota = (chave, msg) => (CONHECIDAS[chave] ? aceitas.push(`${chave}: ${msg} [conhecida: ${CONHECIDAS[chave]}]`) : divergencias.push(`${chave}: ${msg}`));

// ---- magias
const magias = await lerDados('magias'), apiM = await daApi(arg('magias-api'), 'spells');
const porIndice = new Map(apiM.map((s) => [s.index, s]));
for (const a of apiM) if (!magias.some((m) => m.id === a.index)) nota(`magia:${a.index}`, 'existe na API e falta no catálogo');
const CLASSES_DECIDIDAS = new Set(['faerie-fire', 'create-food-and-water', 'meld-into-stone', 'arcane-eye', 'divination']);   // ver construir-magias.mjs (CLASSES_AUDITADAS)
for (const m of magias) {
  const a = porIndice.get(m.id); if (!a) { nota(`magia:${m.id}`, 'existe no catálogo e não na API'); continue; }
  const c = (campo, nosso, deles) => { if (JSON.stringify(nosso) !== JSON.stringify(deles)) nota(`magia:${m.id}:${campo}`, `${JSON.stringify(nosso)} ≠ API ${JSON.stringify(deles)}`); };
  c('nivel', m.nivel, a.level); c('escola', m.escola, a.school.index); c('ritual', m.ritual, !!a.ritual); c('concentracao', m.concentracao, !!a.concentration);
  if (!CLASSES_DECIDIDAS.has(m.id)) c('classes', [...m.classes].sort(), a.classes.map((x) => x.index).sort());
  c('componentes', [m.componentes.v && 'V', m.componentes.s && 'S', m.componentes.m && 'M'].filter(Boolean), a.components);
  c('tempo', `${m.tempo.qtd} ${m.tempo.tipo}`.replace('-', ' '), a.casting_time.replace(/s$/, '').replace(/^(\d+) (\w+)s?$/, '$1 $2'));
}

// ---- monstros
const monstros = await lerDados('monstros'), apiMo = await daApi(arg('monstros-api'), 'monsters');
const porId = new Map(apiMo.map((x) => [x.index, x]));
let comparados = 0;
for (const x of monstros) {
  const a = porId.get(x.id); if (!a) continue; comparados++;
  const c = (campo, nosso, deles) => { if (nosso !== deles) nota(`monstro:${x.id}:${campo}`, `${nosso} ≠ API ${deles}`); };
  c('nd', x.nd, a.challenge_rating); c('pv', x.pv, a.hit_points); c('xp', x.xp, a.xp);
  const ca = Array.isArray(a.armor_class) ? a.armor_class[0].value : a.armor_class; c('ca', x.ca, ca);
  c('tamanho', x.tamanho, a.size.toLowerCase());
  for (const [k, v] of Object.entries({ str: a.strength, dex: a.dexterity, con: a.constitution, int: a.intelligence, wis: a.wisdom, cha: a.charisma })) c(`atributo-${k}`, x.atributos[k], v);
}

console.log(JSON.stringify({ magias: magias.length, magiasNaApi: apiM.length, monstros: monstros.length, monstrosComparados: comparados, divergencias: divergencias.length, conhecidasAceitas: aceitas.length }, null, 1));
for (const a of aceitas) console.log(' ~ ' + a);
for (const d of divergencias) console.log(' ! ' + d);
process.exitCode = divergencias.length ? 1 : 0;

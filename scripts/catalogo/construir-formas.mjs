#!/usr/bin/env node
/** Gera `scripts/catalogo/formas-monstros.json`: dados mecânicos POR FORMA do Vampiro e dos licantropos, tirados da SRD API (que divide a criatura em formas) e conferidos
 *  contra a ficha única do catálogo. A ficha única (legado e livro) descreve as formas em texto; este arquivo dá a estrutura que a iniciativa e o combate vão precisar
 *  (CA, PV, deslocamento, atributos, ações e características de cada forma). O `construir-monstros.mjs` anexa o resultado ao campo `formas` da ficha.
 *  Uso: node scripts/catalogo/construir-formas.mjs --monstros-api cache.json      (sem --monstros-api, baixa de https://www.dnd5eapi.co/api/2014) */
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const arg = (n) => { const i = process.argv.indexOf('--' + n); return i > 0 ? process.argv[i + 1] : undefined; };
const rec = JSON.parse(await readFile(new URL('../../src/catalogue/sistemas/dnd5e-2014/data/reconciliacao-monstros.json', import.meta.url), 'utf8'));
let api;
if (arg('monstros-api')) api = JSON.parse(await readFile(resolve(arg('monstros-api')), 'utf8'));
else { api = []; for (const ids of Object.values(rec.formasAgrupadas)) for (const id of ids) api.push(await (await fetch(`https://www.dnd5eapi.co/api/2014/monsters/${id}`)).json()); }
const porId = new Map(api.map((m) => [m.index, m]));

const ROTULOS = { human: 'Forma humanoide', hybrid: 'Forma híbrida', bat: 'Forma de morcego', mist: 'Forma de névoa', vampire: 'Forma de vampiro', wolf: 'Forma de lobo', bear: 'Forma de urso', boar: 'Forma de javali', rat: 'Forma de rato', tiger: 'Forma de tigre' };
const ft = (s) => (s == null ? undefined : Number(String(s).match(/\d+/)?.[0]));
const ABR = { strength: 'str', dexterity: 'dex', constitution: 'con', intelligence: 'int', wisdom: 'wis', charisma: 'cha' };
const saida = {};
for (const [composto, ids] of Object.entries(rec.formasAgrupadas)) {
  saida[composto] = ids.map((id) => {
    const m = porId.get(id); if (!m) throw new Error(`forma ${id} ausente na API`);
    const chave = id.slice(composto.length + 1).split('-')[0]; const rotulo = ROTULOS[chave]; if (!rotulo) throw new Error(`rótulo desconhecido para ${id}`);
    const speed = Object.fromEntries(Object.entries(m.speed).map(([k, v]) => [k, ft(v)]).filter(([, v]) => v));
    const ca = m.armor_class[0];
    return { id, en: m.name, rotulo, tamanho: m.size.toLowerCase(), ca: ca.value, caTipo: ca.type, pv: m.hit_points, dadosVida: m.hit_points_roll ?? m.hit_dice, deslocamento: speed,
      atributos: Object.fromEntries(Object.entries(ABR).map(([long, curto]) => [curto, m[long]])), percepcaoPassiva: m.senses.passive_perception,
      tracos: m.special_abilities.map((x) => x.name), acoes: m.actions.map((x) => x.name) };
  });
}
await writeFile(new URL('./formas-monstros.json', import.meta.url), JSON.stringify(saida, null, 1) + '\n');
console.log(JSON.stringify(Object.fromEntries(Object.entries(saida).map(([k, v]) => [k, v.length]))));

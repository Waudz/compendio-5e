#!/usr/bin/env node
/** Confere os itens MUNDANOS do catálogo contra a D&D 5e SRD API (/api/2014/equipment). Manual: faz rede, não grava nada.
 * Compara nome em inglês, custo, peso (lb × 0,5 = kg), dano, CA e propriedades. Código de saída 1 se houver divergência.
 * Uso: node scripts/verificar-itens-api.mjs
 */
import { readFile } from 'node:fs/promises';
const base = 'https://www.dnd5eapi.co';
const catalogo = JSON.parse(await readFile(new URL('../src/catalogue/data/srd-2014-items.json', import.meta.url), 'utf8'));
const get = async (p) => { const r = await fetch(base + p, { headers: { accept: 'application/json' } }); if (!r.ok) throw new Error(p + ' -> ' + r.status); return r.json(); };
const lista = await get('/api/2014/equipment');
const mundanos = new Map(catalogo.items.filter(i => i.raridade === 'mundano').map(i => [i.id, i]));
const divergencias = [];
/** Divergências JÁ ANALISADAS em que o catálogo segue o livro SRD 5.1 e a API está errada. Cada uma precisa de motivo. */
const conhecidas = new Map([['caltrops', 'SRD 5.1, tabela de equipamento: Caltrops (bag of 20) = 1 gp; a API devolve 5 cp']]);
const aceitas = [];
const nota = (id, msg) => { if (conhecidas.has(id)) aceitas.push(`${id}: ${msg} [conhecida: ${conhecidas.get(id)}]`); else divergencias.push(`${id}: ${msg}`); };
for (const { index } of lista.results) if (!mundanos.has(index)) nota(index, 'existe na API e falta no catálogo');
for (const id of mundanos.keys()) if (!lista.results.some(r => r.index === id)) nota(id, 'existe no catálogo e não na API');
const moeda = { cp: 'cp', sp: 'sp', gp: 'gp' };
let conferidos = 0;
for (const { index } of lista.results) {
  const item = mundanos.get(index); if (!item) continue;
  const api = await get('/api/2014/equipment/' + index); conferidos++;
  if (api.name.toLowerCase() !== item.en.toLowerCase() && !item.en.toLowerCase().startsWith(api.name.toLowerCase())) nota(index, `nome en "${item.en}" ≠ API "${api.name}"`);
  if (api.cost && item.custo && (api.cost.quantity !== item.custo.v || api.cost.unit !== moeda[item.custo.u])) nota(index, `custo ${item.custo.v}${item.custo.u} ≠ API ${api.cost.quantity}${api.cost.unit}`);
  if (typeof api.weight === 'number' && api.weight > 0 && item.peso !== undefined && Math.abs(api.weight * 0.5 - item.peso) > 0.01) nota(index, `peso ${item.peso} kg ≠ API ${api.weight} lb × 0,5`);
  if (api.damage?.damage_dice && item.arma?.dano && api.damage.damage_dice !== item.arma.dano.dado) nota(index, `dano ${item.arma.dano.dado} ≠ API ${api.damage.damage_dice}`);
  if (api.armor_class?.base !== undefined && item.armadura && api.armor_class.base !== item.armadura.ca) nota(index, `CA ${item.armadura.ca} ≠ API ${api.armor_class.base}`);
  if (item.arma && Array.isArray(api.properties)) {
    const prop = new Set(api.properties.map(p => p.index)); const nosso = new Set(item.arma.propriedades);
    for (const p of prop) if (!nosso.has(p)) nota(index, `propriedade ${p} falta no catálogo`);
    for (const p of nosso) if (!prop.has(p)) nota(index, `propriedade ${p} não existe na API`);
  }
}
console.log(JSON.stringify({ mundanosNoCatalogo: mundanos.size, conferidosNaApi: conferidos, divergencias: divergencias.length, conhecidasAceitas: aceitas.length }, null, 1));
for (const a of aceitas) console.log(' ~ ' + a);
for (const d of divergencias) console.log(' - ' + d);
process.exitCode = divergencias.length ? 1 : 0;

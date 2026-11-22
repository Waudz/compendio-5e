#!/usr/bin/env node
/** Gera `src/catalogue/sistemas/dnd5e-2014/data/monstros.json` (monstros SRD 5.1, 2014, 323 fichas (325 do legado − 2 duplicatas)).
 *  Dados mecânicos = bestiário do Compêndio 1.0 (`dados/bestiario/srd-2014.json`, formato Open5e v2); textos em português = o MESMO tradutor do Compêndio 1.0
 *  (`js/app.js`: dicionário + modelos de `dados/srd-pt.json`), executado aqui em Node — nenhuma regra de tradução foi reescrita. O texto original em inglês é
 *  mantido em cada característica/ação traduzida, e `tr: false` marca o que o tradutor não conseguiu converter com segurança (aparece no original).
 *  Remove o que não é necessário ao catálogo (metadados de documento, referências cruzadas, estrutura de ataques, ilustrações de terceiros).
 *
 *  Uso: node scripts/catalogo/construir-monstros.mjs [--legado ../rastreador-dnd] [--saida <arquivo>]
 */
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';

const arg = (n, padrao) => { const i = process.argv.indexOf('--' + n); return i > 0 ? process.argv[i + 1] : padrao; };
const legado = resolve(arg('legado', '../rastreador-dnd'));
const saida = resolve(arg('saida', 'src/catalogue/sistemas/dnd5e-2014/data/monstros.json'));

// ---- tradutor do legado, executado em Node (bloco puro de js/app.js: dicionários, tr, AL, nm, nmA, descInfo)
const fonte = (await readFile(resolve(legado, 'js/app.js'), 'utf8')).split('\n');
const ini = fonte.findIndex(l => l.trimStart().startsWith('const esc = '));
const fim = fonte.findIndex(l => l.includes('/* rolagens: valores lidos do texto da ação'));
if (ini < 0 || fim < 0 || fim <= ini) throw new Error('Bloco do tradutor não encontrado em js/app.js do legado (o arquivo mudou?)');
const D = JSON.parse(await readFile(resolve(legado, 'dados/srd-pt.json'), 'utf8'));
const nomePt = (m) => D.M[m.name.toLowerCase()] ?? '';
const T = new Function('D', 'pt', 'window', fonte.slice(ini, fim).join('\n') + '\n;return { tr, AL, nm, nmA, descInfo };')(D, nomePt, {});

const bruto = JSON.parse(await readFile(resolve(legado, 'dados/bestiario/srd-2014.json'), 'utf8')).monsters;
const ABR = { strength: 'str', dexterity: 'dex', constitution: 'con', intelligence: 'int', wisdom: 'wis', charisma: 'cha' };
const ABRS = Object.values(ABR);
const AMBIENTE_NAO_SRD = /^tob_/;                                       // chaves de livros de terceiros presentes no Open5e: fora do catálogo SRD
const positivos = (o) => Object.fromEntries(Object.entries(o ?? {}).filter(([, v]) => typeof v === 'number' && v > 0));

/** Curadoria registrada (nada é alterado em silêncio; ver docs/CATALOGO-DND-2014.md). O legado (Open5e) tem estes defeitos, conferidos contra a API SRD e o SRD 5.1:
 *  - duplicatas com ND ausente (0): `elf-drow` = `drow`; `gnome-deep-svirfneblin` = `deep-gnome-svirfneblin`;
 *  - `chain-devil`: ND 11/7.200 XP no legado, ND 8/3.900 XP no SRD e na API;
 *  - `giant-elk`: CA 15 no legado, 14 (armadura natural) no SRD e na API;
 *  - `donkey`: dados de vida ausentes (PV 11 = 2d8 + 2). */
const EXCLUIDOS = { 'elf-drow': 'duplicata de drow (ND ausente no legado)', 'gnome-deep-svirfneblin': 'duplicata de deep-gnome-svirfneblin (ND ausente no legado)' };
const CORRECOES = { 'chain-devil': { nd: 8 }, 'giant-elk': { ca: 14 }, donkey: { dadosVida: '2d8 + 2' } };   // donkey: dados de vida ausentes no legado (PV 11 = 2d8 + 2)
/** XP por ND (tabela do SRD 5.1). ND 0 vale 10 XP, exceto Rã e Cavalo-marinho (0 XP), como no SRD e na API. */
const XP_POR_ND = { 0: 10, 0.125: 25, 0.25: 50, 0.5: 100, 1: 200, 2: 450, 3: 700, 4: 1100, 5: 1800, 6: 2300, 7: 2900, 8: 3900, 9: 5000, 10: 5900, 11: 7200, 12: 8400, 13: 10000, 14: 11500, 15: 13000, 16: 15000, 17: 18000, 18: 20000, 19: 22000, 20: 25000, 21: 33000, 22: 41000, 23: 50000, 24: 62000, 25: 75000, 26: 90000, 27: 105000, 28: 120000, 29: 135000, 30: 155000 };
const XP_ZERO = new Set(['frog', 'sea-horse']);


/** Tradução dedicada de idiomas. O tradutor do legado (`tr`) deixava expressões mistas ("Comum plus até five other idiomas"); aqui os 84 padrões do SRD
 *  são tratados por frases e os nomes de idioma/criatura vêm do dicionário do legado. Qualquer resto em inglês derruba a geração (nada passa em silêncio). */
const NUMEROS = { one: 'um', two: 'dois', three: 'três', four: 'quatro', five: 'cinco', six: 'seis' };
const nomeIdioma = (n) => { const t = n.trim(); const k = t.toLowerCase(); return D.M[k] ?? (k === "thieves' cant" ? 'Gíria dos Ladrões' : k === 'all' ? 'todos' : T.tr(t)); };
const lista = (txt) => txt.split(/,\s*(?:and\s+)?|\s+and\s+/).map(nomeIdioma);
const juntar = (itens) => itens.length <= 1 ? itens.join('') : `${itens.slice(0, -1).join(', ')} e ${itens.at(-1)}`;
const pesM = (n) => (Number(n) * 0.3).toLocaleString('pt-BR', { maximumFractionDigits: 1 });
/** Defesas (resistências, imunidades, vulnerabilidades): as frases compostas que o `tr` do legado deixava pela metade são tratadas antes do dicionário. */
const falhasDefesas = new Set();
function defesa(en) {
  let s = String(en ?? '');
  if (!s) return '';
  const stoneskin = D.S['stoneskin']?.[0] ?? 'Pele de Pedra';
  s = s.replace(/damage from spells; non magical bludgeoning, piercing, and slashing \(from stoneskin\)/, `dano de magias; contundente, perfurante e cortante não mágicos (da magia ${stoneskin})`)
    .replace(/from nonmagical\/nonsilver weapons/g, 'de armas não mágicas e não prateadas')
    .replace(/from magic weapons wielded by good creatures/g, 'de armas mágicas empunhadas por criaturas boas')
    .replace(/not made with silvered weapons/g, 'que não sejam de prata')
    .replace(/not made with adamantine weapons/g, 'que não sejam de adamantina');
  s = T.tr(s);
  if (/\b(and|from|made|weapons?|magic|spells?|damage|that|aren't|non|wielded|creatures)\b/i.test(s)) falhasDefesas.add(`"${en}" → "${s}"`);
  return s;
}
const falhasCA = new Set();
function caDetalhe(en) {
  const s = T.tr(String(en));
  if (/(armor|leather|mail|shield|natural|hide|plate|studded|scale|half|chain|splint|breastplate|ring|padded|mage|barkskin|unarmored|ac)/i.test(s)) falhasCA.add(`"${en}" → "${s}"`);
  return s;
}
const falhasIdiomas = new Set();
function idiomas(en) {
  let s = en.trim();
  s = s.replace(/^one language known by its creator$/i, 'um idioma conhecido por seu criador');
  s = s.replace(/telepathy (\d+) ft\./g, (_, n) => `telepatia ${pesM(n)} m`);
  s = s.replace(/\(works only with creatures that understand (\w+)\)/, (_, l) => `(funciona apenas com criaturas que entendem ${nomeIdioma(l)})`);
  s = s.replace(/\(can't speak in (\w+) form\)/, (_, f) => `(não fala na forma de ${({ bear: 'urso', boar: 'javali', rat: 'rato', tiger: 'tigre', wolf: 'lobo' })[f] ?? f})`);
  s = s.replace(/understands commands given in any language but can't speak/, 'entende comandos dados em qualquer idioma, mas não fala');
  s = s.replace(/understands the languages of its creator but can't speak/, 'entende os idiomas de seu criador, mas não fala');
  s = s.replace(/understands (?:all )?the languages it knew in life but can't speak|understands all languages it knew in life but can't speak/, 'entende os idiomas que conhecia em vida, mas não fala');
  s = s.replace(/any languages it knew in life/, 'quaisquer idiomas que conhecia em vida').replace(/the languages it knew in life/, 'os idiomas que conhecia em vida');
  s = s.replace(/understands ([^,]*?(?:, [^,]*?)*?) but (?:can't|doesn't) speak(?: it)?/i, (_, l) => `entende ${juntar(lista(l))}, mas não fala`);
  s = s.replace(/^(.*?) plus up to (\w+) other languages$/i, (_, a, n) => `${juntar(lista(a))} e até ${NUMEROS[n] ?? n} outros idiomas`);
  s = s.replace(/^(.*?) plus any (\w+) languages$/i, (_, a, n) => `${juntar(lista(a))} e quaisquer ${NUMEROS[n] ?? n} idiomas`);
  s = s.replace(/^any (\w+) languages?(?: \(usually (\w+)\))?$/i, (_, n, usual) => `${n === 'one' ? 'qualquer um idioma' : `quaisquer ${NUMEROS[n] ?? n} idiomas`}${usual ? ` (geralmente ${nomeIdioma(usual)})` : ''}`);
  // lista simples de idiomas separados por vírgula, ainda em inglês (ex.: "Common, Goblin" ou "Abyssal, Common, Infernal, telepatia 18 m")
  s = s.replace(/^([A-Za-z' ]+)( \(não fala na forma de [^)]*\))$/, (_, l, resto) => nomeIdioma(l) + resto);
  s = s.split(/,\s*/).map((parte) => (/^(telepatia|entende|qualquer|quaisquer|os idiomas|\()/.test(parte) || /[ãçõáéíóúâêô]/.test(parte) || parte === '' ? parte : nomeIdioma(parte))).join(', ');
  s = s.replace(/\(([^()]*)\)$/, (m0, i) => (/^[A-Za-z' ]+$/.test(i) && !/[ãç]/.test(i) ? `(${nomeIdioma(i)})` : m0));
  if (/\b(any|plus|understands?|speak|telepathy|languages?|but|can't|doesn't|other|knew|life|form|usually)\b/i.test(s)) throw new Error(`Idiomas ainda com inglês: "${en}" → "${s}"`);
  return s;
}

const avisos = [];
const monstros = bruto.filter((m) => !(m.key.replace(/^srd_/, '') in EXCLUIDOS)).map((m) => {
  const id = m.key.replace(/^srd_/, '');
  const defesas = m.resistances_and_immunities ?? {};
  const chaves = (campo) => (defesas[campo] ?? []).map((x) => x.key).filter(Boolean);
  const texto = (t, ehAcao) => {
    const info = T.descInfo(t.name, t.desc, m);
    const nome = ehAcao ? T.nmA(t) : T.nm(t.name);
    return { n: nome, en: t.name, t: info.plain, tr: !!info.tr, ...(info.tr && info.orig !== info.plain ? { orig: info.orig } : {}),
      ...(ehAcao ? { grupo: t.action_type || 'ACTION' } : {}),
      ...(ehAcao && t.action_type === 'LEGENDARY_ACTION' && t.legendary_action_cost > 1 ? { custo: t.legendary_action_cost } : {}),
      ...(t.usage_limits?.type ? { uso: { tipo: t.usage_limits.type, ...(t.usage_limits.param != null ? { valor: Number(t.usage_limits.param) } : {}) } } : {}) };
  };
  const salvaguardas = Object.fromEntries(Object.entries(m.saving_throws ?? {}).filter(([a, v]) => ABR[a] && v !== m.modifiers?.[a]).map(([a, v]) => [ABR[a], v]));
  const rec = {
    id, en: m.name, nome: nomePt(m) || m.name, traduzido: !!nomePt(m),
    tipo: m.type.key, tamanho: m.size.key, nd: m.challenge_rating, xp: m.experience_points ?? null,   // nd/xp/ca corrigidos abaixo (CORRECOES e tabela de XP)
    tendencia: T.AL(m.alignment) || '', tendenciaEn: m.alignment ?? '',
    ca: m.armor_class, ...(m.armor_detail ? { caDetalhe: caDetalhe(m.armor_detail) } : {}), pv: m.hit_points, dadosVida: m.hit_dice,
    // `speed` = deslocamentos reais; `speed_all` (Open5e) INVENTA natação/escalada/rastejar derivados da caminhada, então não é usado.
    deslocamento: positivos({ walk: m.speed?.walk, fly: m.speed?.fly, swim: m.speed?.swim, climb: m.speed?.climb, burrow: m.speed?.burrow }),
    ...(m.speed?.hover ? { planar: true } : {}),
    atributos: Object.fromEntries(Object.entries(ABR).map(([long, curto]) => [curto, m.ability_scores[long]])),
    ...(Object.keys(salvaguardas).length ? { salvaguardas } : {}),
    ...(Object.keys(m.skill_bonuses ?? {}).length ? { pericias: m.skill_bonuses } : {}),
    percepcaoPassiva: m.passive_perception,
    sentidos: positivos({ visaoNoEscuro: m.darkvision_range, percepcaoAsCegas: m.blindsight_range, sentidoSismico: m.tremorsense_range, visaoVerdadeira: m.truesight_range }),
    idiomas: m.languages?.as_string ? idiomas(m.languages.as_string) : '',
    defesas: {
      resistencias: chaves('damage_resistances'), imunidades: chaves('damage_immunities'), vulnerabilidades: chaves('damage_vulnerabilities'), condicoes: chaves('condition_immunities'),
      resistenciasTexto: defesa(defesas.damage_resistances_display), imunidadesTexto: defesa(defesas.damage_immunities_display),
      vulnerabilidadesTexto: defesa(defesas.damage_vulnerabilities_display), condicoesTexto: defesa(defesas.condition_immunities_display),
    },
    ambientes: (m.environments ?? []).map((e) => e.key.replace(/^srd_/, '')).filter((k) => !AMBIENTE_NAO_SRD.test(k)),
    tracos: (m.traits ?? []).map((t) => texto(t, false)),
    acoes: (m.actions ?? []).map((a) => texto(a, true)),
  };
  if (m.environments?.some((e) => AMBIENTE_NAO_SRD.test(e.key))) avisos.push(`${id}: ambiente de livro não-SRD removido`);
  for (const k of ABRS) if (!Number.isInteger(rec.atributos[k])) throw new Error(`Atributo ${k} inválido em ${id}`);
  if (CORRECOES[id]) { for (const [campo, valor] of Object.entries(CORRECOES[id])) { avisos.push(`${id}: ${campo} ${rec[campo]} → ${valor} (curadoria)`); rec[campo] = valor; } }
  const xp = XP_ZERO.has(id) ? 0 : XP_POR_ND[rec.nd];
  if (xp === undefined) throw new Error(`ND sem XP na tabela: ${id} (${rec.nd})`);
  if (rec.xp !== xp) avisos.push(`${id}: xp ${rec.xp} → ${xp} (tabela do SRD)`);
  rec.xp = xp;
  return rec;
}).sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));

if (falhasCA.size) throw new Error('Detalhe de CA ainda com inglês:\n  ' + [...falhasCA].join('\n  '));
if (falhasDefesas.size) throw new Error('Defesas ainda com inglês:\n  ' + [...falhasDefesas].join('\n  '));
if (falhasIdiomas.size) throw new Error('Idiomas ainda com inglês:\n  ' + [...falhasIdiomas].join('\n  '));
const ids = new Set(monstros.map((m) => m.id));
if (ids.size !== monstros.length) throw new Error('IDs duplicados');
const textos = monstros.flatMap((m) => [...m.tracos, ...m.acoes]);
const conteudo = JSON.stringify(monstros);
const doc = {
  schemaVersion: 1, sistema: 'dnd5e-2014', categoria: 'monstros', revision: '1',
  fonte: { id: 'srd-2014', titulo: 'SRD 5.1 (2014)', licenca: 'CC BY 4.0' },
  proveniencia: 'Dados: bestiário do Compêndio 1.0 (Open5e v2, SRD 5.1). Tradução: tradutor do Compêndio 1.0 executado em build; o original em inglês é preservado. Sem ilustrações (licença não confirmada).',
  count: monstros.length, sha256: createHash('sha256').update(conteudo).digest('hex'), itens: monstros,
};
await writeFile(saida, JSON.stringify(doc) + '\n');
console.log(JSON.stringify({ saida, count: monstros.length, sha256: doc.sha256, textos: textos.length, traduzidos: textos.filter((t) => t.tr).length, excluidos: EXCLUIDOS, nomesEmIngles: monstros.filter((m) => !m.traduzido).map((m) => m.id), ajustes: avisos.length, avisos: avisos.filter((a) => !a.includes('xp ')).concat([`${avisos.filter((a) => a.includes('xp ')).length} ajustes de XP pela tabela`]) }, null, 1));

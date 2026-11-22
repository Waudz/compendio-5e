#!/usr/bin/env node
/** Gera `src/catalogue/sistemas/dnd5e-2014/data/magias.json` (magias SRD 5.1, 2014).
 *  Texto em português = dados do Compêndio 1.0 (`dados/magias.json`); estrutura mecânica (nível, escola, classes, ritual, concentração, tempo, alcance,
 *  duração, componentes, área, salvaguarda, dano) = D&D 5e SRD API (`/api/2014/spells`), conferida magia a magia. Execução manual; nada é publicado.
 *
 *  Uso: node scripts/catalogo/construir-magias.mjs [--legado ../rastreador-dnd] [--api cache-spells-api.json] [--saida <arquivo>]
 *  Sem --api, baixa da API (319 requisições sequenciais). Com --api, usa o cache (JSON: lista de magias completas da API).
 */
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';

const arg = (n, padrao) => { const i = process.argv.indexOf('--' + n); return i > 0 ? process.argv[i + 1] : padrao; };
const legado = resolve(arg('legado', '../rastreador-dnd'));
const saida = resolve(arg('saida', 'src/catalogue/sistemas/dnd5e-2014/data/magias.json'));

async function magiasDaApi() {
  const cache = arg('api');
  if (cache) return JSON.parse(await readFile(resolve(cache), 'utf8'));
  const base = 'https://www.dnd5eapi.co';
  const lista = await (await fetch(base + '/api/2014/spells')).json();
  const out = [];
  for (const { index } of lista.results) out.push(await (await fetch(`${base}/api/2014/spells/${index}`)).json());
  return out;
}

/** Erros de grafia do nome em português do legado. */
const NOMES_CORRIGIDOS = { identify: 'Identificar' };
/** Listas de classes em que o legado (Open5e) e a API divergem. Decisão por magia, CONFIRMADA nas listas de classes do PDF oficial do SRD 5.1 (capítulo Spells, "Spell Lists"); ver docs/CATALOGO-DND-2014.md. */
const CLASSES_AUDITADAS = {
  'faerie-fire': ['bard', 'druid'],
  'create-food-and-water': ['cleric', 'paladin'],
  'meld-into-stone': ['cleric', 'druid'],
  'arcane-eye': ['wizard'],
  divination: ['cleric'],
};

const pes = (texto) => { const m = /^(\d+)\s*(feet|foot|ft)/i.exec(texto); return m ? Number(m[1]) : null; };
function tempo(txt) {
  const m = /^(\d+)\s+(action|bonus action|reaction|minute|minutes|hour|hours)$/i.exec(txt);
  if (!m) throw new Error('tempo de conjuração inesperado: ' + txt);
  const tipo = { action: 'action', 'bonus action': 'bonus-action', reaction: 'reaction', minute: 'minute', minutes: 'minute', hour: 'hour', hours: 'hour' }[m[2].toLowerCase()];
  return { tipo, qtd: Number(m[1]) };
}
function alcance(txt) {
  const t = txt.toLowerCase();
  if (['self', 'touch', 'sight', 'unlimited', 'special'].includes(t)) return { tipo: t };
  const f = pes(txt); if (f != null) return { tipo: 'distance', pes: f };
  const mi = /^(\d+)\s*miles?$/i.exec(txt); if (mi) return { tipo: 'distance', milhas: Number(mi[1]) };
  throw new Error('alcance inesperado: ' + txt);
}
function duracao(txt, concentracao) {
  const t = txt.toLowerCase();
  if (t === 'instantaneous') return { tipo: 'instant' };
  if (t === 'until dispelled') return { tipo: 'until-dispelled' };
  if (t === 'special') return { tipo: 'special' };
  const m = /^(up to )?(\d+) (round|minute|hour|day)s?$/i.exec(txt);
  if (!m) throw new Error('duração inesperada: ' + txt);
  return { tipo: 'timed', qtd: Number(m[2]), unidade: m[3].toLowerCase(), ...(m[1] ? { ate: true } : {}) };
}

const api = await magiasDaApi();
const porNome = new Map(api.map((s) => [s.name.toLowerCase(), s]));
const leg = JSON.parse(await readFile(resolve(legado, 'dados/magias.json'), 'utf8'));
if (leg.length !== api.length) throw new Error(`Quantidade diverge: legado ${leg.length} × API ${api.length}`);

const avisos = [];
const magias = leg.map((l) => {
  const a = porNome.get(l.en.toLowerCase());
  if (!a) throw new Error('Sem correspondência na API: ' + l.en);
  if (a.level !== l.l) throw new Error(`Nível diverge em ${l.en}: API ${a.level} × legado ${l.l}`);
  if (!!a.concentration !== !!l.conc) throw new Error(`Concentração diverge em ${l.en}`);
  const classesLegado = l.c.map((c) => c.toLowerCase()).sort(), classesApi = a.classes.map((c) => c.index).sort();
  let classes = classesLegado;
  if (classesLegado.join() !== classesApi.join()) {
    classes = CLASSES_AUDITADAS[a.index];
    if (!classes) throw new Error(`Classes divergem em ${l.en} sem decisão registrada: legado ${classesLegado} × API ${classesApi}`);
    avisos.push(`${a.index}: legado [${classesLegado}] × API [${classesApi}] → [${classes}]`);
  }
  const paragrafos = l.d.replace(/C[ïi]rculos/g, 'Círculos').split('\n').map((p) => p.trim()).filter(Boolean);   // corrige 'Cïrculos' (defeito do legado)
  const iSup = paragrafos.findIndex((p) => /^Em Círculos Superiores\./.test(p));
  const area = a.area_of_effect ? { tipo: a.area_of_effect.type, pes: a.area_of_effect.size } : undefined;
  const danos = [...new Set((Array.isArray(a.damage) ? a.damage : a.damage ? [a.damage] : []).map((d) => d.damage_type?.index).filter(Boolean))];
  const m = {
    id: a.index, en: a.name, nome: NOMES_CORRIGIDOS[a.index] ?? l.n, nivel: a.level, escola: a.school.index, classes,
    ritual: !!a.ritual, concentracao: !!a.concentration,
    tempo: tempo(a.casting_time), alcance: alcance(a.range), duracao: duracao(a.duration, a.concentration),
    componentes: { v: a.components.includes('V'), s: a.components.includes('S'), m: a.components.includes('M') },
    ...(a.material ? { material: a.material.trim() } : {}),
    ...(area ? { area } : {}),
    ...(a.attack_type ? { ataque: a.attack_type } : {}),
    ...(a.dc ? { salvaguarda: { atributo: a.dc.dc_type.index, efeito: a.dc.dc_success } } : {}),
    ...(danos.length ? { dano: danos } : {}),
    ...(a.subclasses?.length ? { subclasses: a.subclasses.map((s) => s.index).sort() } : {}),
    descricao: iSup >= 0 ? paragrafos.slice(0, iSup) : paragrafos,
    ...(iSup >= 0 ? { superiores: paragrafos.slice(iSup).join('\n').replace(/^Em Círculos Superiores\.\s*/, '') } : {}),
  };
  if (a.higher_level?.length && iSup < 0) throw new Error('Magia com texto de círculos superiores na API e sem marcador no legado: ' + a.index);
  return m;
}).sort((x, y) => x.nivel - y.nivel || x.nome.localeCompare(y.nome, 'pt-BR'));

const ids = new Set(magias.map((m) => m.id));
if (ids.size !== magias.length) throw new Error('IDs duplicados');
const conteudo = JSON.stringify(magias);
const doc = {
  schemaVersion: 1, sistema: 'dnd5e-2014', categoria: 'magias', revision: '1',
  fonte: { id: 'srd-2014', titulo: 'SRD 5.1 (2014)', licenca: 'CC BY 4.0' },
  proveniencia: 'Texto em português: Compêndio 1.0 (dados/magias.json). Estrutura: D&D 5e SRD API /api/2014/spells (conferida). Classes auditadas: ver docs/CATALOGO-DND-2014.md.',
  count: magias.length, sha256: createHash('sha256').update(conteudo).digest('hex'), itens: magias,
};
await writeFile(saida, JSON.stringify(doc) + '\n');
console.log(JSON.stringify({ saida, count: magias.length, sha256: doc.sha256, classesAuditadas: avisos }, null, 1));

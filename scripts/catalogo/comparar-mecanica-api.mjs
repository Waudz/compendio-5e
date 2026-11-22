#!/usr/bin/env node
/** Compara os CAMPOS MECÂNICOS do catálogo de monstros com a SRD API (não só nomes e quantidade): características, ações, ações lendárias e reações (por nome),
 *  deslocamentos, sentidos, percepção passiva, salvaguardas e perícias com proficiência, resistências/imunidades/vulnerabilidades e imunidades a condições.
 *  Fichas compostas (Vampiro e licantropos) são comparadas com a UNIÃO das formas da API; as diferenças por forma ficam em `formas` (ver construir-formas.mjs).
 *  Uso: node scripts/catalogo/comparar-mecanica-api.mjs --monstros-api cache.json [--json]   (código 1 se houver diferença sem explicação)
 *  O que o catálogo tem A MAIS que a API (variantes e textos de apoio do legado) não é erro e aparece só na contagem "extras". */
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const arg = (n) => { const i = process.argv.indexOf('--' + n); return i > 0 ? process.argv[i + 1] : undefined; };
const lerDados = async (nome) => JSON.parse(await readFile(new URL(`../../src/catalogue/sistemas/dnd5e-2014/data/${nome}.json`, import.meta.url), 'utf8'));
const monstros = (await lerDados('monstros')).itens;
const rec = await lerDados('reconciliacao-monstros');
const api = JSON.parse(await readFile(resolve(arg('monstros-api') ?? (() => { throw new Error('informe --monstros-api'); })()), 'utf8'));
const porIdApi = new Map(api.map((m) => [m.index, m]));

/** Diferenças analisadas e aceitas (chave `id|campo|valor`), cada uma com o motivo. */
const EXCECOES = {
  'archmage|resistencia|damage from spells': 'a ficha traz "dano de magias" no texto de resistências; a lista estruturada só aceita tipos de dano',
  'giant-rat-diseased|texto|keen smell': 'variante do SRD ("Diseased Giant Rats"): troca só a mordida e mantém as características do rato gigante; a API as repete na ficha',
  'giant-rat-diseased|texto|pack tactics': 'idem',
  'giant-wasp|deslocamento|swim': 'erro da SRD API: o PDF do SRD 5.1 traz só deslocamento 10 pés e voo 50 pés',
};

const norm = (s) => s.toLowerCase().replace(/\(.*?\)/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
const ft = (s) => (s == null ? undefined : Number(String(s).match(/\d+/)?.[0]));
const divergencias = []; let comparados = 0, extras = 0;
const registrar = (id, campo, valor, msg) => { if (!EXCECOES[`${id}|${campo}|${valor}`]) divergencias.push(`${id} | ${campo}: ${msg}`); };

for (const m of monstros) {
  const formas = rec.formasAgrupadas[m.id]; const refs = formas ? formas.map((f) => porIdApi.get(f)).filter(Boolean) : [porIdApi.get(m.id)].filter(Boolean);
  if (!refs.length) continue; comparados++;
  if (formas) {   // ficha composta: o catálogo tem de trazer os dados estruturados de TODAS as formas da API, igual aos da API
    const ours = new Map((m.formas ?? []).map((f) => [f.id, f]));
    for (const r of refs) {
      const f = ours.get(r.index); if (!f) { registrar(m.id, 'forma', r.index, 'forma da API sem dados estruturados no catálogo'); continue; }
      const sp = (k) => ft(r.speed[k]);
      if (f.ca !== r.armor_class[0].value || f.pv !== r.hit_points || f.percepcaoPassiva !== r.senses.passive_perception || ['walk', 'fly', 'swim', 'climb', 'burrow'].some((k) => (f.deslocamento[k] ?? undefined) !== sp(k))
        || JSON.stringify([...f.acoes].sort()) !== JSON.stringify(r.actions.map((x) => x.name).sort()) || JSON.stringify([...f.tracos].sort()) !== JSON.stringify(r.special_abilities.map((x) => x.name).sort())) registrar(m.id, 'forma', r.index, 'dados da forma diferem da API');
    }
  }
  const nossos = new Set([...m.tracos, ...m.acoes].map((t) => norm(t.en)));
  const nomesApi = new Set(refs.flatMap((r) => [...r.special_abilities, ...r.actions, ...r.legendary_actions, ...r.reactions].map((x) => norm(x.name))));
  for (const n of nomesApi) if (!nossos.has(n)) registrar(m.id, 'texto', n, `a API tem "${n}" e o catálogo não`);
  extras += [...nossos].filter((n) => !nomesApi.has(n)).length;
  // deslocamento: cada tipo da API tem de existir com o mesmo valor (composta: o maior valor entre as formas tem de aparecer em alguma)
  for (const tipo of ['walk', 'fly', 'swim', 'climb', 'burrow']) {
    const vals = refs.map((r) => ft(r.speed[tipo])).filter((v) => v);
    if (vals.length && !vals.includes(m.deslocamento[tipo])) { if (!formas) registrar(m.id, 'deslocamento', tipo, `${tipo} API ${vals} × catálogo ${m.deslocamento[tipo]}`); }
  }
  const r0 = refs[0];
  const sentidos = { visaoNoEscuro: 'darkvision', percepcaoAsCegas: 'blindsight', sentidoSismico: 'tremorsense', visaoVerdadeira: 'truesight' };
  for (const [k, a] of Object.entries(sentidos)) { const v = ft(r0.senses[a]); if (v && !formas && m.sentidos[k] !== v) registrar(m.id, 'sentido', k, `${a} API ${v} × catálogo ${m.sentidos[k]}`); }
  if (!formas && r0.senses.passive_perception !== m.percepcaoPassiva) registrar(m.id, 'percepcao', 'passiva', `API ${r0.senses.passive_perception} × catálogo ${m.percepcaoPassiva}`);
  if (!formas) {
    const modAttr = (a) => Math.floor((m.atributos[a] - 10) / 2);
    for (const p of r0.proficiencies) {
      const [tipo, nome] = p.proficiency.name.split(': '); const chave = p.proficiency.index.split('-').pop();
      if (tipo === 'Saving Throw') { const ours = m.salvaguardas?.[chave] ?? modAttr(chave); if (ours !== p.value) registrar(m.id, 'salvaguarda', chave, `API ${p.value} × catálogo ${ours}`); }
      else if (tipo === 'Skill') { const k = nome.toLowerCase().replace(/ /g, '_'); if ((m.pericias?.[k] ?? m.pericias?.[nome.toLowerCase()]) !== p.value) registrar(m.id, 'pericia', k, `API ${p.value} × catálogo ${m.pericias?.[k]}`); }
    }
    const conj = (l) => new Set(l.map(norm));
    const ours = (campo) => new Set((m.defesas[campo] ?? []).map(norm));
    const compara = (nomeCampo, apiLista, nossa) => { const a = conj(apiLista), b = nossa; for (const x of a) if (![...b].some((y) => y.includes(x) || x.includes(y))) registrar(m.id, nomeCampo, x, `API ${x} ausente`); };
    compara('imunidade', r0.damage_immunities, ours('imunidades')); compara('resistencia', r0.damage_resistances, ours('resistencias')); compara('vulnerabilidade', r0.damage_vulnerabilities, ours('vulnerabilidades'));
    compara('condicao', r0.condition_immunities.map((c) => c.name), ours('condicoes'));
  }
}
const resumo = { monstros: monstros.length, comparadosComApi: comparados, textosExtrasDoCatalogo: extras, divergencias: divergencias.length };
if (process.argv.includes('--json')) console.log(JSON.stringify({ ...resumo, lista: divergencias }, null, 1));
else { console.log(JSON.stringify(resumo)); for (const d of divergencias) console.log(' ! ' + d); }
process.exitCode = divergencias.length ? 1 : 0;

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
import { criarTradutorConjuracao } from './conjuracao-monstros.mjs';
import { criarCompletador, criarSubstituidor } from './completar-traducao.mjs';

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
/** Correções de dados do legado, TODAS confirmadas no PDF do SRD 5.1 (e na SRD API quando ela concorda). Valor função = recebe o valor atual do campo.
 *  - chain-devil/bone-devil: percepção passiva 8/9 no legado, 11/12 no SRD; grimlock: sentido às cegas "3010" (erro de leitura), 30 no SRD;
 *  - young-blue-dragon: escavação 40 no legado, 20 no SRD; priest: Religião +5 no legado, +4 no SRD;
 *  - wight: o legado trocou resistência por imunidade a dano e perdeu imunidade a veneno e a exaustão; zombie: imunidade a veneno perdida;
 *  - mummy-lord: vulnerabilidade a fogo (no legado, contundente). */
const CORRECOES = {
  'chain-devil': { nd: 8, percepcaoPassiva: 11 }, 'bone-devil': { percepcaoPassiva: 12 }, 'giant-elk': { ca: 14 }, donkey: { dadosVida: '2d8 + 2' },   // donkey: dados de vida ausentes no legado (PV 11 = 2d8 + 2)
  grimlock: { sentidos: (v) => ({ ...v, percepcaoAsCegas: 30 }) },
  'young-blue-dragon': { deslocamento: (v) => ({ ...v, burrow: 20 }) },
  priest: { pericias: (v) => ({ ...v, religion: 4 }) },
  wight: { defesas: (v) => ({ ...v, resistencias: ['bludgeoning', 'necrotic', 'piercing', 'slashing'], imunidades: ['poison'], condicoes: ['exhaustion', 'poisoned'],
    resistenciasTexto: 'necrótico; contundente, perfurante e cortante de ataques não mágicos que não sejam de prata', imunidadesTexto: 'venenoso', condicoesTexto: 'exaustão, envenenado' }) },
  zombie: { defesas: (v) => ({ ...v, imunidades: ['poison'], imunidadesTexto: 'venenoso' }) },
  'mummy-lord': { defesas: (v) => ({ ...v, vulnerabilidades: ['fire'], vulnerabilidadesTexto: 'fogo' }) },
};
/** Origem por ficha. `donkey` vem do legado (Open5e o rotula como SRD), mas NÃO consta no PDF do SRD 5.1 nem na SRD API: não é tratado como conteúdo SRD. */
const ORIGEM_LEGADO = { donkey: 'Rotulado como SRD pelo Open5e; ausente do PDF do SRD 5.1 e da SRD API (o SRD traz o Mule). Origem e licença a esclarecer.' };
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
/** Detalhes de CA que o tradutor do 1.0 deixava em inglês (a guarda abaixo falha o build se surgir outro). */
const CA_DETALHE_PT = { '15 with _mage armor_': '15 com _armadura arcana_', '16 with _barkskin_': '16 com _pele-casca_', 'patchwork armor': 'armadura de retalhos', 'armor scraps': 'restos de armadura', splint: 'cota de talas' };
function caDetalhe(en) {
  const s = CA_DETALHE_PT[String(en)] ?? T.tr(String(en));
  if (/\b(armor|leather|mail|shield|hide|plate|studded|scale|half|splint|breastplate|padded|barkskin|unarmored|with|and)\b/i.test(s)) falhasCA.add(`"${en}" → "${s}"`);
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

const ID_DA_API = { succubusincubus: 'succubus-incubus' };   // legado sem hífen; a API usa succubus-incubus
const traduzirConjuracao = criarTradutorConjuracao(JSON.parse(await readFile(new URL('../../src/catalogue/sistemas/dnd5e-2014/data/magias.json', import.meta.url), 'utf8')).itens);
const TRADUCOES = JSON.parse(await readFile(new URL('./traducoes-monstros.json', import.meta.url), 'utf8'));
/** Assinatura numérica de um texto (dados, CD/DC, pontos de vida, porcentagens): tem de ser igual no original e na tradução. */
const assinatura = (s) => (String(s).match(/\d+d\d+(?:\s*[+-]\s*\d+)?|(?:DC|CD)\s*\d+|\d+(?=\s*(?:hit points?|pontos? de vida))|\d+(?=\s*(?:percent|por cento))/gi) || []).map((x) => x.replace(/\s+/g, '').replace(/^(dc|cd)/i, 'dc').toLowerCase()).sort().join('|');
const FRASES = JSON.parse(await readFile(new URL('./traducoes-frases.json', import.meta.url), 'utf8'));
const faltantes = process.argv.includes('--frases-faltantes') ? new Set() : undefined;
const completarFrases = criarCompletador(FRASES, faltantes);
const substituir = criarSubstituidor(JSON.parse(await readFile(new URL('./traducoes-substituicoes.json', import.meta.url), 'utf8')));
/** Só dados e CD (a auditoria numérica completa é scripts/catalogo/auditar-traducoes.mjs). */
const assinaturaBasica = (s) => (String(s).match(/\d+d\d+|(?:DC|CD)\s*\d+/gi) || []).map((x) => x.replace(/\s+/g, '').replace(/^(dc|cd)/i, 'dc').toLowerCase()).sort().join('|');
const RECONC = JSON.parse(await readFile(new URL('../../src/catalogue/sistemas/dnd5e-2014/data/reconciliacao-monstros.json', import.meta.url), 'utf8'));
const ALIASES = RECONC.aliases;   // ids antigos/duplicatas que continuam resolvendo para a ficha canônica
const FORMAS = JSON.parse(await readFile(new URL('./formas-monstros.json', import.meta.url), 'utf8'));   // dados por forma (construir-formas.mjs)
const avisos = [];
const monstros = bruto.filter((m) => !(m.key.replace(/^srd_/, '') in EXCLUIDOS)).map((m) => {
  const idLegado = m.key.replace(/^srd_/, '');
  const id = ID_DA_API[idLegado] ?? idLegado;   // alinha o id ao da SRD API (reconciliacao-monstros.json)
  const defesas = m.resistances_and_immunities ?? {};
  const chaves = (campo) => (defesas[campo] ?? []).map((x) => x.key).filter(Boolean);
  const texto = (t, ehAcao) => {
    const info = T.descInfo(t.name, t.desc, m);
    const nome = ehAcao ? T.nmA(t) : T.nm(t.name);
    // Conjuração: tradutor próprio (substitui o do legado, que deixava a frase de abertura em inglês) + magias citadas para ligar ao catálogo de magias.
    if (/spellcasting/i.test(t.name) && !/hag eye/i.test(t.name)) {
      const original = String(t.desc || '').replace(/\*+/g, '').trim(), c = traduzirConjuracao(original);
      return { n: nome === t.name && TRADUCOES.nomes[t.name] ? TRADUCOES.nomes[t.name] : nome, en: t.name, t: c.t, tr: true, orig: original, magias: c.magias,
        ...(ehAcao ? { grupo: t.action_type || 'ACTION' } : {}), ...(t.usage_limits?.type ? { uso: { tipo: t.usage_limits.type, ...(t.usage_limits.param != null ? { valor: Number(t.usage_limits.param) } : {}) } } : {}) };
    }
    // Substituição por auditoria: o legado aplicava modelos de outra criatura (números, distâncias ou efeitos diferentes do original); aqui vale o original em inglês.
    const original = info.tr ? info.orig : info.plain;
    const substituta = original ? substituir(original) : undefined;
    if (substituta) {
      if (assinaturaBasica(original) !== assinaturaBasica(substituta)) throw new Error(`Substituição com dados/CD diferentes (${t.name}): "${assinaturaBasica(original)}" ≠ "${assinaturaBasica(substituta)}"`);
      info.orig = original; info.plain = substituta; info.tr = true;
    }
    // Texto que o tradutor do legado não converte: tradução revisada (traducoes-monstros.json), validada pela assinatura numérica.
    const revisada = !info.tr && !substituta ? TRADUCOES.textos[createHash('sha1').update(info.plain).digest('hex').slice(0, 10)] : undefined;
    if (revisada) {
      if (assinatura(info.plain) !== assinatura(revisada.t)) throw new Error(`Tradução revisada com números diferentes (${t.name}): "${assinatura(info.plain)}" ≠ "${assinatura(revisada.t)}"`);
      info.orig = info.plain; info.plain = revisada.t; info.tr = true;
    }
    if (info.tr && !revisada && !substituta) info.plain = completarFrases(info.plain);   // tradução parcial do legado: traduz as frases em inglês que sobraram
    info.plain = info.plain.replace(/Minúscul([oa])/g, 'Miúd$1');   // padroniza com o rótulo de tamanho do Compêndio (Tiny = Miúdo; o legado usava "Minúsculo")
    const nomeFinal = nome === t.name && TRADUCOES.nomes[t.name] ? TRADUCOES.nomes[t.name] : nome;
    return { n: nomeFinal, en: t.name, t: info.plain, tr: !!info.tr, ...(info.tr && info.orig !== info.plain ? { orig: info.orig } : {}),
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
  if (CORRECOES[id]) { for (const [campo, valor] of Object.entries(CORRECOES[id])) { const novo = typeof valor === 'function' ? valor(rec[campo]) : valor; avisos.push(`${id}: ${campo} ${JSON.stringify(rec[campo])} → ${JSON.stringify(novo)} (curadoria, SRD 5.1)`); rec[campo] = novo; } }
  if (ALIASES[id]) rec.idsAnteriores = ALIASES[id];
  rec.origem = id in ORIGEM_LEGADO ? 'legado' : 'srd-2014';
  if (FORMAS[id]) rec.formas = FORMAS[id];
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
if (faltantes) {   // modo de apoio à tradução: lista as frases em inglês sem tradução cadastrada e não grava os dados
  await writeFile(resolve(arg('frases-faltantes', 'frases-faltantes.json')), JSON.stringify([...faltantes].sort(), null, 1));
  console.log(`${faltantes.size} frases sem tradução (lista gravada)`); process.exit(0);
}
await writeFile(saida, JSON.stringify(doc) + '\n');
console.log(JSON.stringify({ saida, count: monstros.length, sha256: doc.sha256, textos: textos.length, traduzidos: textos.filter((t) => t.tr).length, excluidos: EXCLUIDOS, nomesEmIngles: monstros.filter((m) => !m.traduzido).map((m) => m.id), ajustes: avisos.length, avisos: avisos.filter((a) => !a.includes('xp ')).concat([`${avisos.filter((a) => a.includes('xp ')).length} ajustes de XP pela tabela`]) }, null, 1));

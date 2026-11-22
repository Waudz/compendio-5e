// Integridade dos arquivos de dados de magias e monstros (D&D 5e 2014) e conferência com fatos do SRD 5.1 escritos de forma independente.
// A conferência completa contra a SRD API é feita por `scripts/catalogo/verificar-catalogo-api.mjs` (rede).
import { execFileSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';
import magiasJson from './data/magias.json';
import monstrosJson from './data/monstros.json';
import reconciliacao from './data/reconciliacao-monstros.json';
import { arquivoMagiasSchema, arquivoMonstrosSchema, classesConjuradoras, type Magia, type Monstro } from './esquemas';

const sha = async (itens: unknown) => [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(itens))))].map(b => b.toString(16).padStart(2, '0')).join('');
const magias = arquivoMagiasSchema.parse(magiasJson), monstros = arquivoMonstrosSchema.parse(monstrosJson);
const magia = (id: string) => magias.itens.find(m => m.id === id) as Magia;
const monstro = (id: string) => monstros.itens.find(m => m.id === id) as Monstro;

describe('arquivos de dados', () => {
  it('são válidos no esquema Zod, têm a contagem declarada, IDs únicos e o hash confere (detecta edição manual do JSON)', async () => {
    for (const arq of [magias, monstros]) {
      expect(arq.count).toBe(arq.itens.length);
      expect(new Set(arq.itens.map(i => i.id)).size).toBe(arq.itens.length);
      expect(arq.fonte).toMatchObject({ id: 'srd-2014', licenca: 'CC BY 4.0' });
    }
    expect(await sha((magiasJson as { itens: unknown }).itens)).toBe(magias.sha256);
    expect(await sha((monstrosJson as { itens: unknown }).itens)).toBe(monstros.sha256);
  });
  it('tamanhos esperados: 319 magias e 323 monstros (325 do legado menos 2 duplicatas)', () => { expect(magias.count).toBe(319); expect(monstros.count).toBe(323); });
});

describe('magias — fatos do SRD 5.1 (2014) conferidos de forma independente', () => {
  it('distribuição por círculo, rituais e concentração', () => {
    const porNivel = Array.from({ length: 10 }, (_, n) => magias.itens.filter(m => m.nivel === n).length);
    expect(porNivel).toEqual([24, 49, 54, 42, 31, 37, 31, 20, 16, 15]);
    expect(magias.itens.filter(m => m.ritual)).toHaveLength(29);
    expect(magias.itens.filter(m => m.concentracao)).toHaveLength(126);
  });
  it('Bola de Fogo: 3º círculo, Evocação, 45 m (150 pés), esfera de 20 pés, Destreza com metade do dano, dano de fogo, V/S/M', () => {
    expect(magia('fireball')).toMatchObject({ nome: 'Bola de Fogo', en: 'Fireball', nivel: 3, escola: 'evocation', classes: ['sorcerer', 'wizard'], tempo: { tipo: 'action', qtd: 1 }, alcance: { tipo: 'distance', pes: 150 },
      duracao: { tipo: 'instant' }, area: { tipo: 'sphere', pes: 20 }, salvaguarda: { atributo: 'dex', efeito: 'half' }, dano: ['fire'], componentes: { v: true, s: true, m: true } });
    expect(magia('fireball').superiores).toMatch(/1d6/);
  });
  it('Curar Ferimentos, Contramagia, Detectar Magia, Desejo, Prestidigitação, Mísseis Mágicos e Imobilizar Pessoa', () => {
    expect(magia('cure-wounds')).toMatchObject({ nivel: 1, classes: ['bard', 'cleric', 'druid', 'paladin', 'ranger'], alcance: { tipo: 'touch' } });
    expect(magia('counterspell')).toMatchObject({ nivel: 3, escola: 'abjuration', tempo: { tipo: 'reaction' }, classes: ['sorcerer', 'warlock', 'wizard'], componentes: { v: false, s: true, m: false } });
    expect(magia('detect-magic')).toMatchObject({ ritual: true, concentracao: true, duracao: { tipo: 'timed', qtd: 10, unidade: 'minute', ate: true } });
    expect(magia('wish')).toMatchObject({ nivel: 9, classes: ['sorcerer', 'wizard'] });
    expect(magia('prestidigitation')).toMatchObject({ nivel: 0, duracao: { tipo: 'timed', qtd: 1, unidade: 'hour' } });
    expect(magia('magic-missile')).toMatchObject({ nivel: 1, dano: ['force'] });
    expect(magia('hold-person')).toMatchObject({ concentracao: true, salvaguarda: { atributo: 'wis', efeito: 'none' }, material: 'A small, straight piece of iron.' });
  });
  it('classes divergentes entre o legado e a API foram decididas uma a uma (ver docs/CATALOGO-DND-2014.md)', () => {
    expect(magia('faerie-fire').classes).toEqual(['bard', 'druid']);
    expect(magia('create-food-and-water').classes).toEqual(['cleric', 'paladin']);
    expect(magia('meld-into-stone').classes).toEqual(['cleric', 'druid']);
    expect(magia('arcane-eye').classes).toEqual(['wizard']);
    expect(magia('divination').classes).toEqual(['cleric']);
  });
  it('listas por classe têm os tamanhos esperados e só classes conjuradoras', () => {
    const por = (c: string) => magias.itens.filter(m => m.classes.includes(c as never)).length;
    expect(Object.fromEntries(classesConjuradoras.map(c => [c, por(c)]))).toMatchObject({ wizard: 204, bard: 112, cleric: 105, druid: 105, sorcerer: 120, warlock: 64, ranger: 37, paladin: 31 });
    expect(magias.itens.every(m => m.classes.every(c => (classesConjuradoras as readonly string[]).includes(c)))).toBe(true);
  });
  it('texto em português preenchido, sem o defeito de "Cïrculos" do legado, e círculos superiores separados da descrição', () => {
    for (const m of magias.itens) { expect(m.descricao.join(' ')).not.toMatch(/Cïrculos/); expect(m.descricao.some(p => /^Em Círculos Superiores\./.test(p)), m.id).toBe(false); }
    expect(magia('fireball').descricao.length).toBeGreaterThan(1);
    expect(magias.itens.filter(m => m.superiores)).toHaveLength(92);   // 90 na API + Amizade Animal e Heroísmo (a API omite o texto, o SRD e o legado o trazem)
  });
  it('todo componente M traz o material, e só ele', () => {
    for (const m of magias.itens) expect(!!m.material, m.id).toBe(m.componentes.m);
  });
});

describe('monstros — fatos do SRD 5.1 (2014) e curadoria', () => {
  it('Goblin: ND 1/4, CA 15, PV 7 (2d6), 50 XP, Destreza 14, Pequeno humanoide, só caminha 9 m e fala Comum e Goblin', () => {
    expect(monstro('goblin')).toMatchObject({ nome: 'Goblin', nd: 0.25, ca: 15, pv: 7, dadosVida: '2d6', xp: 50, tamanho: 'small', tipo: 'humanoid', atributos: expect.objectContaining({ dex: 14, str: 8 }), deslocamento: { walk: 30 }, idiomas: 'Comum, Goblin' });
  });
  it('Dragão Vermelho Adulto: ND 17, 18.000 XP, CA 19, PV 256, voa e escala (sem natação inventada) e tem 3 ações lendárias', () => {
    const d = monstro('adult-red-dragon');
    expect(d).toMatchObject({ nd: 17, xp: 18000, ca: 19, pv: 256, tamanho: 'huge', tipo: 'dragon', deslocamento: { walk: 40, fly: 80, climb: 40 } });
    expect(d.acoes.filter(a => a.grupo === 'LEGENDARY_ACTION')).toHaveLength(3);
  });
  it('Tarrasca ND 30 (155.000 XP), Aboleth ND 10, Lich ND 21, Plebeu ND 0 (10 XP)', () => {
    expect(monstro('tarrasque')).toMatchObject({ nd: 30, xp: 155000, ca: 25, pv: 676 });
    expect(monstro('aboleth')).toMatchObject({ nd: 10, xp: 5900 }); expect(monstro('lich')).toMatchObject({ nd: 21, xp: 33000 }); expect(monstro('commoner')).toMatchObject({ nd: 0, xp: 10 });
  });
  it('XP sempre coerente com a tabela do SRD para o ND (Rã e Cavalo-marinho valem 0 XP)', () => {
    const tabela: Record<number, number> = { 0: 10, 0.125: 25, 0.25: 50, 0.5: 100, 1: 200, 2: 450, 3: 700, 4: 1100, 5: 1800, 6: 2300, 7: 2900, 8: 3900, 9: 5000, 10: 5900, 11: 7200, 12: 8400, 13: 10000, 14: 11500, 15: 13000, 16: 15000, 17: 18000, 18: 20000, 19: 22000, 20: 25000, 21: 33000, 22: 41000, 23: 50000, 24: 62000, 30: 155000 };
    for (const m of monstros.itens) expect(m.xp, `${m.id} ND ${m.nd}`).toBe(['frog', 'sea-horse'].includes(m.id) ? 0 : tabela[m.nd]);
  });
  it('correções registradas: duplicatas removidas, Diabo da Corrente ND 8, Alce Gigante CA 14, Burro com dados de vida', () => {
    expect(monstros.itens.some(m => m.id === 'elf-drow' || m.id === 'gnome-deep-svirfneblin')).toBe(false);
    expect(monstro('drow')).toBeTruthy(); expect(monstro('deep-gnome-svirfneblin')).toBeTruthy();
    expect(monstro('chain-devil')).toMatchObject({ nd: 8, xp: 3900 }); expect(monstro('giant-elk').ca).toBe(14); expect(monstro('donkey').dadosVida).toBe('2d8 + 2');
  });
  it('deslocamento vem de `speed` real: criaturas sem natação/escalada não ganham essas velocidades', () => {
    expect(monstro('goblin').deslocamento.swim).toBeUndefined(); expect(monstro('commoner').deslocamento).toEqual({ walk: 30 });
    expect(monstro('aboleth').deslocamento).toEqual({ walk: 10, swim: 40 });
    expect(monstros.itens.filter(m => m.planar).map(m => m.id).sort()).toEqual(['air-elemental', 'flying-sword', 'ghost', 'invisible-stalker', 'specter', 'will-o-wisp', 'wraith']);
  });
  it('ambientes só do SRD (sem chaves de livros de terceiros) e sem ilustrações de terceiros', () => {
    for (const m of monstros.itens) { for (const a of m.ambientes) expect(a, m.id).not.toMatch(/^tob_|^srd_/); expect(m).not.toHaveProperty('illustration'); }
  });
  it('idiomas e defesas em português: nenhum resto de inglês conhecido', () => {
    const ingles = /\b(any|plus|understands?|speak|telepathy|languages?|but|can't|doesn't|knew|usually|from|made|weapons?|nonmagical)\b/i;
    for (const m of monstros.itens) { expect(m.idiomas, m.id).not.toMatch(ingles); for (const t of Object.values(m.defesas).filter(v => typeof v === 'string')) expect(t as string, m.id).not.toMatch(ingles); }
    expect(monstro('lich').idiomas).toBe('Comum e até cinco outros idiomas');
    expect(monstro('commoner').idiomas).toBe('qualquer um idioma (geralmente Comum)');
    expect(monstro('aboleth').idiomas).toBe('Dialeto Obscuro, telepatia 36 m');
  });
  it('tradução: todos os nomes em português; textos traduzidos mantêm o original; os não traduzidos são marcados', () => {
    expect(monstros.itens.every(m => m.traduzido)).toBe(true);
    const textos = monstros.itens.flatMap(m => [...m.tracos, ...m.acoes]);
    const traduzidos = textos.filter(t => t.tr);
    expect(traduzidos.length, 'todas as características e ações estão traduzidas').toBe(textos.length); expect(textos).toHaveLength(1472);
    // nenhum resto de inglês nos textos: palavras que só existem em inglês e marcadores de modelo não resolvidos
    const ingles = /(?<![\p{L}])(the|and|its|with|can|has|must|damage|saving throws?|hit points?|target|takes?|until|each|within|creature|attack|spell)(?![\p{L}])/iu;
    for (const m of monstros.itens) for (const t of [...m.tracos, ...m.acoes]) { expect(t.t, `${m.id}: ${t.en}`).not.toMatch(ingles); expect(t.t).not.toMatch(/[{}#]|undefined|NaN/); expect(t.n, m.id).not.toBe(''); }
    for (const t of textos) { expect(t.t.trim(), t.en).not.toBe(''); if (t.tr && t.orig) expect(t.orig).not.toBe(t.t); }
    expect(textos.filter(t => !t.tr).every(t => t.orig === undefined)).toBe(true);
  });

  it('Identificar: grafia corrigida do legado ("Indentificar")', () => { expect(magia('identify').nome).toBe('Identificar'); expect(JSON.stringify(magias)).not.toContain('Indentificar'); });
});

describe('fidelidade das traduções dos monstros (auditoria numérica e de termos de regra)', () => {
  it('números, dados, CD, distâncias (pés × 0,3) e termos de regra (atributos, tipos de dano, condições, tamanhos) coincidem com o original em inglês', () => {
    // scripts/catalogo/auditar-traducoes.mjs sai com código 1 e lista a divergência; as exceções aceitas têm motivo no próprio script
    expect(() => execFileSync(process.execPath, ['scripts/catalogo/auditar-traducoes.mjs'], { encoding: 'utf8', stdio: 'pipe' })).not.toThrow();
  });
  it('texto que o legado traduziu com mecânica errada foi substituído pelo fiel ao original (exemplos auditados)', () => {
    const t = (id: string, n: string) => [...monstro(id).tracos, ...monstro(id).acoes].find(x => x.en === n)!.t;
    expect(t('erinyes', 'Parry')).toContain('adiciona 4 à sua CA'); expect(t('gladiator', 'Parry')).toContain('adiciona 3'); expect(t('marilith', 'Parry')).toContain('adiciona 5');
    expect(t('killer-whale', 'Hold Breath')).toContain('30 minutos'); expect(t('hydra', 'Hold Breath')).toContain('1 hora');
    expect(t('vrock', 'Stunning Screech')).toContain('atordoada'); expect(t('wereboar', 'Shapechanger')).toContain('híbrido de javali e humanoide');
    expect(t('adult-gold-dragon', 'Breath Weapons')).toContain('Sopro Enfraquecedor');
  });
});

describe('conjuração dos monstros: tradução e ligação com o catálogo de magias', () => {
  const comMagias = monstros.itens.flatMap(m => [...m.tracos, ...m.acoes].filter(t => t.magias).map(t => ({ m, t })));
  const idsMagias = new Set(magias.itens.map(x => x.id));
  it('toda característica de conjuração (exceto o Olho de Bruxa) está traduzida por completo e cita magias', () => {
    const conj = monstros.itens.flatMap(m => [...m.tracos, ...m.acoes].filter(t => /spellcasting/i.test(t.en)).map(t => ({ m, t })));
    expect(conj).toHaveLength(39); for (const { m, t } of conj) { expect(t.tr, m.id).toBe(true); expect(t.magias, m.id).toBeTruthy(); }
  });
  it('cada magia ligada existe no catálogo e o nome citado aparece no texto', () => {
    expect(comMagias.length).toBeGreaterThan(30);
    for (const { m, t } of comMagias) for (const l of t.magias!) { expect(idsMagias.has(l.id), `${m.id}: ${l.id}`).toBe(true); expect(t.t, `${m.id}: ${l.nome}`).toContain(l.nome); }
  });
  it('Arquimago: magias ligadas (inclusive as citadas em frase) e texto em português', () => {
    const t = monstro('archmage').tracos.find(x => x.en === 'Spellcasting')!;
    expect(t.t).toMatch(/^A criatura é um conjurador de 18º nível\./);
    expect(t.t).toContain('Truques (à vontade): raio de fogo, luz, mãos mágicas');
    expect(t.magias!.map(x => x.id)).toEqual(expect.arrayContaining(['disguise-self', 'invisibility', 'time-stop', 'mind-blank', 'fire-bolt']));
    expect(t.t).not.toMatch(/(the|slots?|at will|spells prepared)/i);
  });
  it('Mefite de Gelo: conjuração de uma magia só, sem componentes materiais', () => {
    const t = monstro('ice-mephit').tracos.find(x => /Innate Spellcasting/.test(x.en))!;
    expect(t.magias).toEqual([{ id: 'fog-cloud', nome: expect.any(String) }]); expect(t.t).toContain('sem precisar de componentes materiais');
  });
  it('"Ray of Sickness" (citada nos clãs de bruxas) não existe no catálogo do SRD: aparece em português, sem ligação', () => {
    const t = monstro('night-hag').tracos.find(x => x.en.startsWith('Shared Spellcasting'))!;
    expect(t.t).toContain('raio nauseante'); expect(t.magias!.some(x => x.nome === 'raio nauseante')).toBe(false);
  });
});

describe('conciliação do bestiário com a SRD API (334 fichas na API × 323 no catálogo)', () => {
  const ids = new Set(monstros.itens.map(m => m.id));
  it('Súcubo/Íncubo usa o id da API', () => { expect(ids.has('succubus-incubus')).toBe(true); expect(ids.has('succubusincubus')).toBe(false); });
  it('fichas compostas do legado (vampiro e licantropos) correspondem às formas separadas da API, e cada forma é de um só composto', () => {
    const formas = Object.values(reconciliacao.formasAgrupadas).flat();
    expect(new Set(formas).size).toBe(formas.length); expect(formas).toHaveLength(18);
    for (const composto of Object.keys(reconciliacao.formasAgrupadas)) expect(ids.has(composto), composto).toBe(true);
    for (const f of formas) expect(ids.has(f), `${f} não deve existir como ficha própria`).toBe(false);
  });
  it('fichas compostas guardam os dados estruturados de TODAS as formas (CA, PV, deslocamento, atributos, ações e características de cada forma)', () => {
    for (const [composto, formas] of Object.entries(reconciliacao.formasAgrupadas)) {
      const m = monstro(composto); expect(m.formas?.map(f => f.id), composto).toEqual(formas);
      const base = (n: string) => n.replace(/s*(.*)$/, ''); const nomes = new Set([...m.tracos, ...m.acoes].map(t => base(t.en)));
      for (const f of m.formas!) for (const n of [...f.acoes, ...f.tracos]) expect(nomes.has(base(n)), `${f.id}: "${n}" precisa existir na ficha`).toBe(true);
    }
    const lobo = monstro('werewolf').formas!; expect(lobo.find(f => f.id === 'werewolf-wolf')).toMatchObject({ ca: 12, deslocamento: { walk: 40 }, acoes: ['Bite'] });
    expect(lobo.find(f => f.id === 'werewolf-human')).toMatchObject({ ca: 11, deslocamento: { walk: 30 } });
    expect(monstro('vampire').formas!.find(f => f.id === 'vampire-bat')).toMatchObject({ deslocamento: { walk: 5, fly: 30 } });
  });
  it('origem: só o Burro é do legado (não SRD); os outros 322 são SRD 5.1 confirmados no PDF/API; ids antigos listados em idsAnteriores', () => {
    expect(monstros.itens.filter(m => m.origem === 'legado').map(m => m.id)).toEqual(['donkey']); expect(monstros.itens.filter(m => m.origem === 'srd-2014')).toHaveLength(322);
    expect(monstro('succubus-incubus').idsAnteriores).toEqual(['succubusincubus']); expect(monstro('drow').idsAnteriores).toEqual(['elf-drow']);
  });
  it('correções confirmadas no PDF do SRD 5.1 (percepção passiva, escavação, defesas)', () => {
    expect(monstro('chain-devil').percepcaoPassiva).toBe(11); expect(monstro('bone-devil').percepcaoPassiva).toBe(12); expect(monstro('grimlock').sentidos.percepcaoAsCegas).toBe(30);
    expect(monstro('young-blue-dragon').deslocamento.burrow).toBe(20); expect(monstro('priest').pericias?.religion).toBe(4);
    expect(monstro('wight').defesas).toMatchObject({ imunidades: ['poison'], condicoes: ['exhaustion', 'poisoned'] }); expect(monstro('zombie').defesas.imunidades).toEqual(['poison']);
    expect(monstro('mummy-lord').defesas.vulnerabilidades).toEqual(['fire']);
  });
  it('conta fecha: 323 no catálogo = 334 da API − 18 formas + 6 fichas compostas + fichas só do catálogo (Burro)', () => {
    expect(334 - 18 + 6 + Object.keys(reconciliacao.somenteNoCatalogo).length).toBe(monstros.count); expect(monstros.count).toBe(323);
  });
});


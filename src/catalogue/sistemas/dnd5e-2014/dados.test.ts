// Integridade dos arquivos de dados de magias e monstros (D&D 5e 2014) e conferência com fatos do SRD 5.1 escritos de forma independente.
// A conferência completa contra a SRD API é feita por `scripts/catalogo/verificar-catalogo-api.mjs` (rede).
import { describe, expect, it } from 'vitest';
import magiasJson from './data/magias.json';
import monstrosJson from './data/monstros.json';
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
    expect(traduzidos.length / textos.length).toBeGreaterThan(0.75);
    for (const t of textos) { expect(t.t.trim(), t.en).not.toBe(''); if (t.tr && t.orig) expect(t.orig).not.toBe(t.t); }
    expect(textos.filter(t => !t.tr).every(t => t.orig === undefined)).toBe(true);
  });
});

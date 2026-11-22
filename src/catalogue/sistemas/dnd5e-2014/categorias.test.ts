// Formatadores em português e categorias (filtros, ordenações, pesquisa) sobre os dados reais.
import { beforeAll, describe, expect, it } from 'vitest';
import { consultar, type Indice } from '../../nucleo/busca';
import { carregarIndice, categoria, sistema } from '../../nucleo/registro';
import type { SrdItem } from '../../item-schema';
import { DND5E_2014, categoriaItens, categoriaMagias, categoriaMonstros, garantirSistemaDnd5e2014, sistemaDnd5e2014 } from './index';
import type { Magia, Monstro } from './esquemas';
import { formatarAlcance, formatarArea, formatarComponentes, formatarDeslocamento, formatarDuracao, formatarND, formatarSentidos, formatarTempo, metros, formatarCirculo, modificadorDe, formatarModificador } from './formatar';
import { rotuloAmbiente, rotuloClasse, rotuloEscola, rotuloTamanho, rotuloTipoCriatura, humanizar } from './rotulos';

let magias: Indice<Magia>, monstros: Indice<Monstro>, itens: Indice<SrdItem>;
beforeAll(async () => { magias = await carregarIndice(categoriaMagias); monstros = await carregarIndice(categoriaMonstros); itens = await carregarIndice(categoriaItens); });
const nomes = <T, U>(r: T[], f: (x: T) => U) => r.map(f);

describe('formatadores (pt-BR, metros = pés × 0,3)', () => {
  it('distâncias', () => {
    expect(metros(150)).toBe('45 m'); expect(metros(5)).toBe('1,5 m'); expect(metros(30)).toBe('9 m'); expect(metros(10)).toBe('3 m');
    expect(formatarAlcance({ tipo: 'distance', pes: 60 })).toBe('18 m'); expect(formatarAlcance({ tipo: 'distance', milhas: 1 })).toBe('1,6 km'); expect(formatarAlcance({ tipo: 'distance', milhas: 500 })).toBe('800 km');
    expect(formatarAlcance({ tipo: 'self' })).toBe('Pessoal'); expect(formatarAlcance({ tipo: 'touch' })).toBe('Toque'); expect(formatarAlcance({ tipo: 'sight' })).toBe('Linha de visão');
  });
  it('tempo, duração, componentes e área', () => {
    expect(formatarTempo({ tipo: 'action', qtd: 1 })).toBe('1 ação'); expect(formatarTempo({ tipo: 'bonus-action', qtd: 1 })).toBe('1 ação bônus'); expect(formatarTempo({ tipo: 'reaction', qtd: 1 })).toBe('1 reação');
    expect(formatarTempo({ tipo: 'minute', qtd: 10 })).toBe('10 minutos'); expect(formatarTempo({ tipo: 'hour', qtd: 1 })).toBe('1 hora');
    expect(formatarDuracao({ tipo: 'instant' })).toBe('Instantânea'); expect(formatarDuracao({ tipo: 'until-dispelled' })).toBe('Até ser dissipada');
    expect(formatarDuracao({ tipo: 'timed', qtd: 1, unidade: 'hour' })).toBe('1 hora'); expect(formatarDuracao({ tipo: 'timed', qtd: 10, unidade: 'day' })).toBe('10 dias');
    expect(formatarDuracao({ tipo: 'timed', qtd: 1, unidade: 'minute', ate: true }, true)).toBe('Concentração, até 1 minuto');
    expect(formatarComponentes({ v: true, s: true, m: true }, 'A tiny ball of bat guano.')).toBe('V, S, M (A tiny ball of bat guano)'); expect(formatarComponentes({ v: true, s: false, m: false })).toBe('V');
    expect(formatarArea({ tipo: 'sphere', pes: 20 })).toBe('Esfera de 6 m de raio'); expect(formatarArea({ tipo: 'cone', pes: 15 })).toBe('Cone de 4,5 m');
    expect(formatarCirculo(0)).toBe('Truque'); expect(formatarCirculo(3)).toBe('3º círculo');
  });
  it('monstros: ND em fração, modificador com sinal de menos tipográfico, deslocamento e sentidos', () => {
    expect([0.125, 0.25, 0.5, 1, 17].map(formatarND)).toEqual(['1/8', '1/4', '1/2', '1', '17']);
    expect([modificadorDe(8), modificadorDe(10), modificadorDe(15), modificadorDe(30)]).toEqual([-1, 0, 2, 10]); expect(formatarModificador(-1)).toBe('−1'); expect(formatarModificador(2)).toBe('+2');
    expect(formatarDeslocamento({ walk: 40, fly: 80, climb: 40 })).toBe('12 m, voo 24 m, escalada 12 m'); expect(formatarDeslocamento({ fly: 20 }, true)).toBe('voo 6 m (planar)'); expect(formatarDeslocamento({})).toBe('—');
    expect(formatarSentidos({ sentidos: { visaoNoEscuro: 60 }, percepcaoPassiva: 9 })).toBe('visão no escuro 18 m, Percepção passiva 9');
  });
  it('rótulos: tradução conhecida e legibilidade do identificador desconhecido', () => {
    expect(rotuloEscola('evocation')).toBe('Evocação'); expect(rotuloClasse('wizard')).toBe('Mago'); expect(rotuloTamanho('gargantuan')).toBe('Imenso'); expect(rotuloTipoCriatura('undead')).toBe('Morto-vivo');
    expect(rotuloAmbiente('plane-of-fire')).toBe('Plano do Fogo'); expect(rotuloAmbiente('terra-estranha')).toBe('Terra estranha'); expect(humanizar('a-b_c')).toBe('A b c');
  });
});

describe('sistema registrado', () => {
  it('registra D&D 5e (2014) com itens, magias e monstros e é idempotente', () => {
    expect(garantirSistemaDnd5e2014()).toBe(sistemaDnd5e2014); expect(garantirSistemaDnd5e2014()).toBe(sistemaDnd5e2014);
    expect(sistema(DND5E_2014)?.categorias.map(c => c.id)).toEqual(['itens', 'magias', 'monstros']);
    expect(categoria(DND5E_2014, 'magias')).toBe(categoriaMagias as never);
    expect(sistemaDnd5e2014.fonte).toMatchObject({ licenca: 'CC BY 4.0' }); expect(sistemaDnd5e2014.fonte.atribuicao).toMatch(/Wizards of the Coast/);
  });
});

describe('magias: pesquisa e filtros', () => {
  const q = (c: Parameters<typeof consultar<Magia>>[1]) => consultar(magias, c);
  it('pesquisa por nome em português (sem acento), nome em inglês e texto da descrição', () => {
    expect(q({ texto: 'bola de fogo' })[0].id).toBe('fireball'); expect(q({ texto: 'FIREBALL' })[0].id).toBe('fireball'); expect(q({ texto: 'misseis magicos' })[0].id).toBe('magic-missile');
    expect(q({ texto: 'esfera de chamas' }).map(m => m.id)).toContain('fireball');
  });
  it('círculo, escola, classe e tempo', () => {
    expect(q({ filtros: { nivel: '0' } })).toHaveLength(24); expect(q({ filtros: { nivel: '9' } })).toHaveLength(15);
    expect(q({ filtros: { escola: 'necromancy', nivel: '3' } }).map(m => m.id)).toContain('animate-dead');
    expect(q({ filtros: { classe: 'ranger' } })).toHaveLength(37); expect(q({ filtros: { classe: 'wizard', nivel: '1' } }).length).toBeGreaterThan(20);
    expect(q({ filtros: { tempo: 'reaction' } }).map(m => m.id)).toEqual(expect.arrayContaining(['counterspell', 'shield']));
    expect(q({ filtros: { tempo: 'bonus-action' } }).map(m => m.id)).toContain('healing-word');
  });
  it('ritual, concentração, material, dano, alcance e duração', () => {
    expect(q({ filtros: { ritual: true } })).toHaveLength(29); expect(q({ filtros: { concentracao: true } })).toHaveLength(126);
    expect(q({ filtros: { duracao: 'concentracao' } })).toHaveLength(126); expect(q({ filtros: { material: true } }).every(m => m.componentes.m)).toBe(true);
    expect(q({ filtros: { dano: true } }).map(m => m.id)).toEqual(expect.arrayContaining(['fireball', 'magic-missile']));
    expect(q({ filtros: { alcance: 'toque' } }).map(m => m.id)).toContain('cure-wounds'); expect(q({ filtros: { alcance: 'pessoal' } }).map(m => m.id)).toContain('shield');
    expect(q({ filtros: { duracao: 'instantanea', nivel: '3' } }).map(m => m.id)).toContain('fireball');
  });
  it('filtros se combinam e a ordenação por círculo agrupa os níveis', () => {
    const r = q({ filtros: { classe: 'cleric', ritual: true }, ordenar: 'nivel' });
    expect(r.length).toBeGreaterThan(0); expect(r.every(m => m.classes.includes('cleric') && m.ritual)).toBe(true);
    expect(nomes(r, m => m.nivel)).toEqual([...nomes(r, m => m.nivel)].sort((a, b) => a - b));
  });
});

describe('monstros: pesquisa e filtros', () => {
  const q = (c: Parameters<typeof consultar<Monstro>>[1]) => consultar(monstros, c);
  it('pesquisa por nome pt/en e por texto de ações', () => {
    expect(q({ texto: 'dragao vermelho adulto' })[0].id).toBe('adult-red-dragon'); expect(q({ texto: 'goblin' })[0].id).toBe('goblin'); expect(q({ texto: 'tarrasque' })[0].id).toBe('tarrasque');
    expect(q({ texto: 'sopro de fogo' }).map(m => m.id)).toContain('adult-red-dragon');
  });
  it('faixas de ND, tipo, tamanho, ambiente, deslocamento, lendário e conjurador', () => {
    expect(q({ filtros: { nd: 'nd0' } }).every(m => m.nd === 0)).toBe(true); expect(q({ filtros: { nd: 'nd17+' } }).every(m => m.nd >= 17)).toBe(true);
    expect(q({ filtros: { nd: 'nd-fracao' } }).every(m => m.nd > 0 && m.nd <= 0.5)).toBe(true); expect(q({ filtros: { nd: 'nd5-10' } }).every(m => m.nd >= 5 && m.nd <= 10)).toBe(true);
    expect(q({ filtros: { tipo: 'dragon' } })).toHaveLength(43); expect(q({ filtros: { tamanho: 'tiny' } }).every(m => m.tamanho === 'tiny')).toBe(true);
    expect(q({ filtros: { ambiente: 'arctic' } }).map(m => m.id)).toContain('polar-bear');
    expect(q({ filtros: { deslocamento: 'fly' } }).map(m => m.id)).toEqual(expect.arrayContaining(['adult-red-dragon', 'eagle']));
    expect(q({ filtros: { lendario: true } })).toHaveLength(30); expect(q({ filtros: { conjurador: true } })).toHaveLength(37);
    expect(q({ filtros: { tipo: 'dragon', lendario: true, nd: 'nd17+' } }).length).toBeGreaterThan(5);
  });
  it('as faixas de ND particionam o catálogo (sem sobreposição nem buraco)', () => {
    const faixas = ['nd0', 'nd-fracao', 'nd1-4', 'nd5-10', 'nd11-16', 'nd17+'];
    expect(faixas.reduce((n, f) => n + q({ filtros: { nd: f } }).length, 0)).toBe(monstros.itens.length);
  });
  it('ordenação por ND (maior), PV e nome', () => {
    expect(q({ ordenar: 'nd-desc' })[0].id).toBe('tarrasque'); expect(q({ ordenar: 'nd-asc' })[0].nd).toBe(0); expect(q({ ordenar: 'pv' })[0].id).toBe('tarrasque');
    const n = nomes(q({ ordenar: 'nome' }), m => m.nome); expect(n).toEqual([...n].sort((a, b) => a.localeCompare(b, 'pt-BR')));
  });
});

describe('itens na mesma interface genérica', () => {
  const q = (c: Parameters<typeof consultar<SrdItem>>[1]) => consultar(itens, c);
  it('são indexados de forma síncrona e mantêm a pesquisa por nome pt/en', () => {
    expect(itens.itens).toHaveLength(578); expect(q({ texto: 'espada longa' })[0].id).toBe('longsword'); expect(q({ texto: 'longsword' })[0].id).toBe('longsword');
  });
  it('filtros próprios de itens: categoria, raridade, tipo de arma, propriedade, armadura e sintonia', () => {
    expect(q({ filtros: { categoria: 'armadura' } })).toHaveLength(12); expect(q({ filtros: { raridade: 'legendary' } })).toHaveLength(42);
    expect(q({ filtros: { 'arma-tipo': 'martial-melee' } }).map(i => i.id)).toContain('longsword'); expect(q({ filtros: { 'arma-propriedade': 'finesse' } }).map(i => i.id)).toContain('rapier');
    expect(q({ filtros: { 'armadura-tipo': 'heavy' } }).map(i => i.id)).toContain('plate-armor'); expect(q({ filtros: { sintonia: true } }).every(i => i.sintonia)).toBe(true);
  });
});

import { describe, expect, it } from 'vitest';
import dados from './data/srd-2014-items.json';
import { itemSchema, parseItemCatalogueFile } from './item-schema';
import { canonicalItemId, describeItem, srdItem, srdItemFile, srdItemIds, srdItemRef, srdItemsCatalogue } from './srd-2014-items';
import { searchCompendium } from '../rules/compendium-query';
import { contentKey } from '../rules/content-registry';
import { resolveRule } from '../rules/rules-catalogue';

const clone = () => structuredClone(dados) as unknown as Record<string, any>;

describe('arquivo de dados', () => {
  it('é válido, tem a contagem declarada e o hash confere (detecta edição manual do JSON)', async () => {
    const file = srdItemFile();
    expect(file.count).toBe(578);
    expect(file.items).toHaveLength(578);
    const bytes = new TextEncoder().encode(JSON.stringify((dados as { items: unknown[] }).items));
    const hash = [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))].map(b => b.toString(16).padStart(2, '0')).join('');
    expect(hash).toBe(file.sha256);
  });
  it('cobre o equipamento mundano completo do SRD: 237 itens mundanos (37 armas, 12 armaduras, 1 escudo, 7 pacotes...)', () => {
    const porCategoria: Record<string, number> = {};
    for (const i of srdItemFile().items) porCategoria[i.categoria] = (porCategoria[i.categoria] ?? 0) + 1;
    expect(srdItemFile().items.filter(i => i.raridade === 'mundano')).toHaveLength(237);
    expect(porCategoria).toMatchObject({ arma: 37, armadura: 12, escudo: 1, pacote: 7, municao: 4 });
  });
  it('traz a atribuição CC BY 4.0 do SRD 5.1', () => {
    expect(srdItemFile().source).toMatchObject({ id: 'srd-2014', license: 'CC BY 4.0' });
    expect(srdItemFile().source.attribution).toMatch(/Wizards of the Coast/);
  });
});

describe('valores conferidos contra o livro SRD 5.1 (peso em kg = libras × 0,5; alcance em m = pés × 0,3)', () => {
  it('Espada longa: 15 po, 3 lb, 1d8 cortante, versátil 1d10', () => {
    expect(srdItem('longsword')).toMatchObject({ nome: 'Espada longa', custo: { v: 15, u: 'gp' }, peso: 1.5, arma: { categoria: 'martial', alcance: 'melee', dano: { dado: '1d8', tipo: 'slashing' }, danoDuasMaos: { dado: '1d10' }, propriedades: ['versatile'] } });
  });
  it('Cota de malha: 75 po, 55 lb, CA 16, Força 13, desvantagem em Furtividade, sem Des', () => {
    expect(srdItem('chain-mail')).toMatchObject({ custo: { v: 75, u: 'gp' }, peso: 27.5, armadura: { categoria: 'heavy', ca: 16, somaDes: false, forMin: 13, furtividade: true } });
  });
  it('Armadura de placas 1500 po CA 18 Força 15; Escudo +2; Armadura de couro CA 11 + Des', () => {
    expect(srdItem('plate-armor')).toMatchObject({ custo: { v: 1500 }, armadura: { ca: 18, forMin: 15 } });
    expect(srdItem('shield')).toMatchObject({ categoria: 'escudo', armadura: { categoria: 'shield', ca: 2 } });
    expect(srdItem('leather-armor')).toMatchObject({ armadura: { ca: 11, somaDes: true } });
  });
  it('Machadinha (arremesso 20/60 pés = 6/18 m), Arco longo (150/600 = 45/180) e Besta leve (80/320 = 24/96)', () => {
    expect(srdItem('handaxe')?.arma).toMatchObject({ arremessoM: { normal: 6, longo: 18 }, propriedades: expect.arrayContaining(['light', 'thrown']) });
    expect(srdItem('longbow')?.arma).toMatchObject({ alcanceM: { normal: 45, longo: 180 }, propriedades: expect.arrayContaining(['heavy', 'two-handed', 'ammunition']) });
    expect(srdItem('crossbow-light')?.arma).toMatchObject({ alcanceM: { normal: 24, longo: 96 }, dano: { dado: '1d8', tipo: 'piercing' }, propriedades: expect.arrayContaining(['loading']) });
  });
  it('Pacote de Explorador (10 po): mochila, saco de dormir, kit de refeição, caixa de fogo, 10 tochas, 10 rações, odre e corda de cânhamo', () => {
    const pacote = srdItem('explorers-pack')!;
    expect(pacote.custo).toEqual({ v: 10, u: 'gp' });
    expect(pacote.pacote).toEqual([{ id: 'backpack', qtd: 1 }, { id: 'bedroll', qtd: 1 }, { id: 'mess-kit', qtd: 1 }, { id: 'tinderbox', qtd: 1 }, { id: 'torch', qtd: 10 }, { id: 'rations-1-day', qtd: 10 }, { id: 'waterskin', qtd: 1 }, { id: 'rope-hempen-50-feet', qtd: 1 }]);
  });
  it('Pacote de Aventureiro de Masmorras (12 po) tem 9 tipos de item', () => {
    expect(srdItem('dungeoneers-pack')).toMatchObject({ custo: { v: 12, u: 'gp' } });
    expect(srdItem('dungeoneers-pack')!.pacote).toHaveLength(9);
  });
});

describe('catálogo canônico (RulesCatalogue)', () => {
  it('uma entrada e uma definição por item, todas na mesma revisão e fonte', () => {
    const c = srdItemsCatalogue();
    expect(c.registry.entries).toHaveLength(578);
    expect(c.definitions).toHaveLength(578);
    expect(new Set(c.registry.entries.map(e => e.ref.revision))).toEqual(new Set([srdItemFile().revision]));
    expect(srdItemsCatalogue()).toBe(c);   // memoizado: o índice de busca é por objeto
  });
  it('resolve por referência versionada e devolve os dados estruturados (a ficha não copia regras)', () => {
    const r = resolveRule(srdItemsCatalogue(), srdItemRef('longsword'));
    expect(r.entry.name).toBe('Espada longa');
    expect(r.definition.data).toMatchObject({ id: 'longsword', en: 'Longsword' });
    expect(contentKey(r.entry.ref)).toBe('srd-2014:item:longsword:1');
  });
  it('definições são imutáveis', () => {
    const data = resolveRule(srdItemsCatalogue(), srdItemRef('longsword')).definition.data as Record<string, unknown>;
    expect(() => { 'use strict'; data.nome = 'x'; }).toThrow();
  });
  it('pesquisa do Compêndio: por nome em português sem acento, por nome em inglês e por categoria', () => {
    const c = srdItemsCatalogue();
    expect(searchCompendium(c, { kind: 'item', text: 'espada longa' }).map(r => r.ref.id)).toContain('longsword');
    expect(searchCompendium(c, { text: 'rapieira' }).map(r => r.ref.id)).toEqual(['rapier']);
    expect(searchCompendium(c, { text: 'Cota de malha' }).map(r => r.ref.id)).toContain('chain-mail');
    expect(searchCompendium(c, { text: 'longsword' }).map(r => r.ref.id)).toContain('longsword');   // nome original (en) também é pesquisável
  });
  it('alias legado resolve para o ID canônico; ID inexistente não resolve', () => {
    expect(canonicalItemId('potion-of-healing')).toBe('potion-of-healing-common');
    expect(srdItem('potion-of-healing')?.cura).toBe('2d4+2');
    expect(srdItem('rations')).toBeUndefined();            // o ID candidato antigo do piloto não existe no SRD
    expect(srdItemIds().has('rations-1-day')).toBe(true);
  });
});

describe('descrições derivadas (pt-BR)', () => {
  it('arma, armadura e item mágico', () => {
    expect(describeItem(srdItem('longsword')!)).toBe('Arma marcial corpo a corpo. Dano 1d8 cortante. 1d10 com duas mãos. Propriedades: versátil. Custo 15 po. Peso 1,5 kg.');
    expect(describeItem(srdItem('chain-mail')!)).toContain('Armadura pesada, CA 16');
    expect(describeItem(srdItem('chain-mail')!)).toContain('Força mínima 13');
    expect(describeItem(srdItem('vorpal-sword')!)).toMatch(/Raridade lendário/);
  });
});

describe('esquema rejeita dado malformado (nada é consertado em silêncio)', () => {
  it('campo desconhecido, categoria inválida e arma sem bloco de arma', () => {
    const base = srdItem('club')!;
    expect(() => itemSchema.parse({ ...base, extra: 1 })).toThrow();
    expect(() => itemSchema.parse({ ...base, categoria: 'inexistente' })).toThrow();
    const { arma: _a, ...semArma } = base;
    expect(() => itemSchema.parse(semArma)).toThrow(/arma sem bloco/);
    expect(() => itemSchema.parse({ ...base, custo: { v: -1, u: 'gp' } })).toThrow();
    expect(() => itemSchema.parse({ ...base, id: 'Club Maiúsculo' })).toThrow();
  });
  it('mágico marcado como mundano e mundano com raridade mágica', () => {
    expect(() => itemSchema.parse({ ...srdItem('club')!, raridade: 'rare' })).toThrow(/raridade/);
    expect(() => itemSchema.parse({ ...srdItem('vorpal-sword')!, raridade: 'mundano' })).toThrow(/raridade/);
  });
  it('ID duplicado, contagem errada, pacote com componente inexistente e alias colidindo', () => {
    const dup = clone(); dup.items.push(structuredClone(dup.items[0])); dup.count += 1;
    expect(() => parseItemCatalogueFile(dup)).toThrow(/duplicado/);
    const cont = clone(); cont.count = 1;
    expect(() => parseItemCatalogueFile(cont)).toThrow(/Contagem/);
    const pac = clone(); pac.items.find((i: any) => i.id === 'explorers-pack').pacote[0].id = 'nao-existe';
    expect(() => parseItemCatalogueFile(pac)).toThrow(/inexistente/);
    const ali = clone(); ali.items.find((i: any) => i.id === 'potion-of-healing-common').alias = ['club'];
    expect(() => parseItemCatalogueFile(ali)).toThrow(/colide/);
  });
});

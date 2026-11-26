import { beforeEach, describe, expect, it, vi } from 'vitest';
import { codexDemo } from '../dev/codexDemo';
import { memoryStorage } from '../testUtils';
import { alternarChaves, gruposDeChaves, presetBestiario, todasAsChaves } from './chaves';
import { CAMPOS, filtroDaDescoberta } from './campos';
import { montarRelacao, agruparVinculos } from './relacoes';
import { secoesDoItem, secoesDoMonstro } from './ficha';
import { srdItem } from '../catalogue/srd-2014-items';
import { todosOsMonstros } from '../catalogue/contratos';
import type { Conhecimento } from './conhecimento';

const base: Conhecimento = {
  id: 'x', category: 'monster', systemId: 'dnd5e-2014', title: 'Goblin', version: 1, visible: false, revealed: [], definitionId: 'goblin',
  imageDefinitionId: 'goblin', fields: { nickname: 'Verdinho', history: '' }, sheet: [{ k: 'ac', l: 'CA', v: '15' }, { k: 'vulnerabilities', l: 'Vulnerabilidades', v: 'fogo' }],
};

describe('chaves de divulgação', () => {
  it('"tudo" cobre apenas o que tem conteúdo e usa o curinga da ficha', () => {
    expect(todasAsChaves(base)).toEqual(['name', 'nickname', 'image', 'sheet']);
    expect(gruposDeChaves(base).map(g => g.id)).toEqual(['identidade', 'ficha']);
  });
  it('ocultar uma seção expande o curinga sem revelar nem esconder as demais', () => {
    expect(alternarChaves(['name', 'sheet'], ['sheet:ac'], false, base)).toEqual(['name', 'sheet:vulnerabilities']);
    expect(alternarChaves(['name'], ['sheet:vulnerabilities'], true, base)).toEqual(['name', 'sheet:vulnerabilities']);
  });
  it('os quatro níveis do bestiário são atalhos crescentes', () => {
    expect(presetBestiario(1, base)).toEqual(['name']);
    expect(presetBestiario(2, base)).toEqual(['name', 'description']);
    expect(presetBestiario(3, base)).toEqual(['name', 'description', 'image']);
    expect(presetBestiario(4, base)).toEqual(todasAsChaves(base));
  });
});

describe('campos, relações e ficha herdada', () => {
  it('campos aprovados por categoria', () => {
    expect(CAMPOS.npc.map(c => c.id)).toEqual(['nickname', 'race', 'age', 'occupation', 'birthplace', 'residence', 'history', 'personality', 'relationships']);
    expect(CAMPOS.organization.map(c => c.id)).toEqual(['nickname', 'type', 'memberCount', 'history', 'objectives']);
    expect(filtroDaDescoberta('discovery', 'Mapa')).toBe('Mapas');
    expect(filtroDaDescoberta('item')).toBe('Itens');
    expect(filtroDaDescoberta('discovery')).toBe('Outras');
  });
  it('a leitura inversa troca origem e destino em vez de duplicar a relação', () => {
    const custom = { ida: '', volta: '' };
    expect(montarRelacao('member:a', 'p', 'o', custom)).toEqual({ source: 'p', target: 'o', kind: 'member', label: 'Membro de', inverse: 'Possui membro' });
    expect(montarRelacao('member:b', 'o', 'p', custom)).toEqual({ source: 'p', target: 'o', kind: 'member', label: 'Membro de', inverse: 'Possui membro' });
    expect(montarRelacao('custom', 'a', 'b', custom)).toBeNull();
    expect(montarRelacao('custom', 'a', 'b', { ida: 'Mentor de', volta: 'Aprendiz de' })).toMatchObject({ label: 'Mentor de', inverse: 'Aprendiz de' });
    expect(agruparVinculos([{ relation: 'Sede', title: 'b' }, { relation: 'Possui membro', title: 'a' }]).map(g => g[0])).toEqual(['Possui membro', 'Sede']);
  });
  it('todas as definições geram seções válidas para o servidor', async () => {
    for (const m of await todosOsMonstros()) {
      const secoes = secoesDoMonstro(m);
      expect(new Set(secoes.map(s => s.k)).size).toBe(secoes.length);
      for (const s of secoes) { expect(s.k).toMatch(/^[a-z0-9-]{1,40}$/); expect(s.l.length).toBeLessThanOrEqual(80); expect(s.v.length).toBeGreaterThan(0); }
      expect(JSON.stringify(secoes).length).toBeLessThan(90000);
    }
    const espada = secoesDoItem(srdItem('longsword')!);
    expect(espada.map(s => s.k)).toContain('dano');
    expect(espada.some(s => s.k === 'effects')).toBe(false);
    expect(secoesDoItem(srdItem('longsword')!, 'Brilha no escuro').at(-1)).toEqual({ k: 'effects', l: 'Descrição e efeitos', v: 'Brilha no escuro' });
  });
});

describe('adaptador de demonstração segue a mesma fronteira', () => {
  beforeEach(() => vi.stubGlobal('localStorage', memoryStorage()));
  it('prévia, vínculo oculto nos dois sentidos e um aviso por operação', async () => {
    const mestre = codexDemo(true, 'c'), jogador = codexDemo(false, 'c');
    const dados = (title: string) => ({ category: 'npc' as const, systemId: 'dnd5e-2014', title, fields: { nickname: 'Alcunha ' + title.slice(-1) }, secret: 'S' });
    const a = await mestre.save('c', null, 0, dados('VERDADEIRO-A')), b = await mestre.save('c', null, 0, dados('VERDADEIRO-B'));
    const link = await mestre.link('c', a, b, { kind: 'member', label: 'Membro de', inverse: 'Possui membro' });
    await mestre.reveal('c', a, 1, { visible: true, revealed: ['nickname'] });
    await mestre.reveal('c', b, 1, { visible: true, revealed: [] });
    expect(await jogador.links('c', a)).toEqual([]);
    expect(await jogador.links('c', b)).toEqual([]);
    expect(JSON.stringify(await jogador.list('c'))).not.toMatch(/VERDADEIRO|"S"/);
    await mestre.reveal('c', a, 2, { visible: true, revealed: ['nickname'], links: { [link]: true } });
    expect((await jogador.links('c', b))[0]).toMatchObject({ title: 'Alcunha A', relation: 'Possui membro' });
    expect((await jogador.feed('c')).unread).toBe(3);
    await mestre.reveal('c', a, 3, { visible: true, revealed: ['nickname'] });
    expect((await jogador.feed('c')).unread).toBe(3);
    expect((await mestre.preview('c', a)).entry).toEqual((await jogador.list('c')).find(x => x.id === a));
  });
});

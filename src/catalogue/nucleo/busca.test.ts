import { describe, expect, it } from 'vitest';
import { consultar, indexar, normalizar, passaFiltros } from './busca';
import { carregarIndice, categoria, indiceDisponivel, registrarSistema, sistema, sistemasRegistrados } from './registro';
import type { CategoriaDef, SistemaDef } from './tipos';

type Coisa = { id: string; nome: string; en: string; nivel: number; tags: string[]; ativo: boolean; texto: string };
const dados: Coisa[] = [
  { id: 'a', nome: 'Bola de Fogo', en: 'Fireball', nivel: 3, tags: ['fogo', 'area'], ativo: true, texto: 'Uma explosão de chamas' },
  { id: 'b', nome: 'Armadura Mágica', en: 'Mage Armor', nivel: 1, tags: ['defesa'], ativo: false, texto: 'Protege com fogo? não' },
  { id: 'c', nome: 'Cura', en: 'Cure Wounds', nivel: 1, tags: ['cura'], ativo: true, texto: 'Restaura pontos de vida' },
  { id: 'd', nome: 'Fogo Fátuo', en: 'Will-o-wisp', nivel: 5, tags: ['fogo'], ativo: false, texto: 'Luz enganosa' },
  { id: 'e', nome: 'Ação', en: 'Action', nivel: 0, tags: [], ativo: true, texto: '' },
];
const cat: CategoriaDef<Coisa> = {
  id: 'coisas', rotulo: 'Coisas', rotuloItem: 'Coisa', carregar: async () => dados,
  idDe: c => c.id, nomeDe: c => c.nome, nomesAlternativos: c => [c.en], subtituloDe: c => `nível ${c.nivel}`, corpoDe: c => c.texto,
  filtros: [
    { id: 'nivel', rotulo: 'Nível', tipo: 'selecao', opcoes: [], extrair: c => String(c.nivel) },
    { id: 'tag', rotulo: 'Tag', tipo: 'selecao', opcoes: [], extrair: c => c.tags },
    { id: 'ativo', rotulo: 'Ativo', tipo: 'booleano', extrair: c => c.ativo },
  ],
  ordenacoes: [{ id: 'nome', rotulo: 'Nome', comparar: (a, b) => a.nome.localeCompare(b.nome, 'pt-BR') }, { id: 'nivel', rotulo: 'Nível', comparar: (a, b) => a.nivel - b.nivel }],
};
const ids = (r: Coisa[]) => r.map(c => c.id);
const ind = indexar(cat, dados);

describe('normalizar', () => {
  it('remove acentos e maiúsculas e apara espaços', () => expect(normalizar('  Ação Mágica  ')).toBe('acao magica'));
});

describe('pesquisa', () => {
  it('sem texto devolve tudo na ordenação padrão (a primeira declarada)', () => expect(ids(consultar(ind))).toEqual(['e', 'b', 'a', 'c', 'd']));   // por nome em pt-BR
  it('ignora acentos e maiúsculas; acha pelo nome em português e pelo original', () => {
    expect(ids(consultar(ind, { texto: 'ACAO' }))).toEqual(['e']);
    expect(ids(consultar(ind, { texto: 'fireball' }))).toEqual(['a']);
    expect(ids(consultar(ind, { texto: 'armadura magica' }))).toEqual(['b']);
  });
  it('todos os termos são obrigatórios, em qualquer ordem', () => {
    expect(ids(consultar(ind, { texto: 'fogo bola' }))).toEqual(['a']);
    expect(ids(consultar(ind, { texto: 'fogo inexistente' }))).toEqual([]);
  });
  it('nome pesa mais que corpo: acerto no nome vem antes de acerto só no texto', () => {
    expect(ids(consultar(ind, { texto: 'fogo' }))).toEqual(['d', 'a', 'b']);                    // d: nome COMEÇA com o termo; a: início de palavra; b: só no corpo
  });
  it('início de palavra pesa mais que trecho no meio do nome', () => {
    const r = consultar(indexar(cat, [{ ...dados[0], id: 'x', nome: 'Refogo', en: 'x' }, dados[3]]), { texto: 'fogo' });
    expect(ids(r)).toEqual(['d', 'x']);
  });
  it('texto só com espaços não filtra', () => expect(consultar(ind, { texto: '   ' })).toHaveLength(5));
});

describe('filtros e ordenação', () => {
  it('seleção por valor único, por lista e combinada', () => {
    expect(ids(consultar(ind, { filtros: { nivel: '1' } }))).toEqual(['b', 'c']);
    expect(ids(consultar(ind, { filtros: { tag: 'fogo' } }))).toEqual(['a', 'd']);
    expect(ids(consultar(ind, { filtros: { tag: 'fogo', nivel: '5' } }))).toEqual(['d']);
  });
  it('booleano só filtra quando marcado; valores vazios são ignorados', () => {
    expect(ids(consultar(ind, { filtros: { ativo: true } }))).toEqual(['e', 'a', 'c']);
    expect(consultar(ind, { filtros: { ativo: false, nivel: '', tag: undefined } })).toHaveLength(5);
  });
  it('filtro desconhecido não quebra nem restringe', () => expect(consultar(ind, { filtros: { inexistente: 'x' } })).toHaveLength(5));
  it('ordenar por id escolhido; estável nos empates; "relevancia" mantém a pontuação', () => {
    expect(ids(consultar(ind, { ordenar: 'nivel' }))).toEqual(['e', 'b', 'c', 'a', 'd']);
    expect(ids(consultar(ind, { texto: 'fogo', ordenar: 'relevancia' }))).toEqual(['d', 'a', 'b']);
  });
  it('passaFiltros usa a definição da categoria', () => {
    expect(passaFiltros(cat, dados[0], { ativo: true, tag: 'area' })).toBe(true);
    expect(passaFiltros(cat, dados[1], { ativo: true })).toBe(false);
  });
  it('não altera o índice nem os dados', () => {
    const antes = JSON.stringify(dados); consultar(ind, { texto: 'fogo', ordenar: 'nivel' }); expect(JSON.stringify(dados)).toBe(antes);
    expect(ind.itens).toBe(dados);
  });
});

describe('registro de sistemas e carregamento', () => {
  const sis = (id: string, cats: CategoriaDef<Coisa>[] = [cat]): SistemaDef => ({ id, nome: id, fonte: { titulo: 't', licenca: 'l', atribuicao: 'a' }, categorias: cats as never });
  it('registra, lista e encontra sistema e categoria; recusa sistema e categoria duplicados', () => {
    const s = sis('teste-a'); registrarSistema(s);
    expect(sistema('teste-a')).toBe(s); expect(sistemasRegistrados()).toContain(s);
    expect(categoria('teste-a', 'coisas')).toBe(cat); expect(categoria('teste-a', 'x')).toBeUndefined(); expect(categoria('nao-existe', 'coisas')).toBeUndefined();
    expect(() => registrarSistema(s)).toThrow(/já registrado/);
    expect(() => registrarSistema(sis('teste-b', [cat, cat]))).toThrow(/Categoria duplicada/);
  });
  it('carrega UMA vez (promessa em cache) e depois está disponível de forma síncrona', async () => {
    let chamadas = 0; const c: CategoriaDef<Coisa> = { ...cat, id: 'unica', carregar: async () => { chamadas++; return dados; } };
    expect(indiceDisponivel(c)).toBeUndefined();
    const [a, b] = await Promise.all([carregarIndice(c), carregarIndice(c)]);
    expect(a).toBe(b); expect(chamadas).toBe(1); expect(indiceDisponivel(c)).toBe(a); await carregarIndice(c); expect(chamadas).toBe(1);
  });
  it('falha não fica em cache: a próxima tentativa carrega de novo', async () => {
    let n = 0; const c: CategoriaDef<Coisa> = { ...cat, id: 'falha', carregar: async () => { if (++n === 1) throw new Error('rede'); return dados; } };
    await expect(carregarIndice(c)).rejects.toThrow('rede');
    expect(indiceDisponivel(c)).toBeUndefined();
    expect((await carregarIndice(c)).itens).toBe(dados); expect(n).toBe(2);
  });
  it('dados em memória indexam de forma síncrona (sem estado de carregamento)', () => {
    const c: CategoriaDef<Coisa> = { ...cat, id: 'memoria', dadosEmMemoria: () => dados, carregar: async () => { throw new Error('não deve carregar'); } };
    expect(indiceDisponivel(c)?.itens).toBe(dados);
  });
});

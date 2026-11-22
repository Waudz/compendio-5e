import { describe, expect, it } from 'vitest';
import { categoriaClasses, categoriaRacas, categoriaSubclasses } from './categorias-personagem';

describe('Categorias de personagens SRD 2014', () => {
  it('compartilha 9 raças, 12 classes e 12 subclasses com o criador', async () => {
    const racas = await categoriaRacas.carregar();
    const classes = await categoriaClasses.carregar();
    const subclasses = await categoriaSubclasses.carregar();
    expect(racas).toHaveLength(9);
    expect(classes).toHaveLength(12);
    expect(subclasses).toHaveLength(12);
    expect(new Set(classes.map(categoriaClasses.idDe)).size).toBe(12);
    expect(new Set(racas.map(categoriaRacas.idDe)).size).toBe(9);
    expect(new Set(subclasses.map(categoriaSubclasses.idDe)).size).toBe(12);
  });
  it('apresenta nomes em português e mantém nomes originais pesquisáveis', async () => {
    const classes = await categoriaClasses.carregar();
    const guerreiro = classes.find(c => categoriaClasses.nomeDe(c) === 'Guerreiro');
    expect(guerreiro).toBeDefined();
    expect(categoriaClasses.nomesAlternativos?.(guerreiro!)).toContain('fighter');
    const racas = await categoriaRacas.carregar();
    expect(racas.map(categoriaRacas.nomeDe)).toContain('Anão');
  });
  it('cada subclasse pertence a uma classe disponível e o filtro encontra o vínculo', async () => {
    const classes = await categoriaClasses.carregar();
    const subclasses = await categoriaSubclasses.carregar();
    const ids = new Set(classes.map(categoriaClasses.idDe));
    const filtro = categoriaSubclasses.filtros.find(f => f.id === 'classe');
    expect(filtro?.tipo).toBe('selecao');
    for (const sub of subclasses) {
      expect(ids.has(sub.parent)).toBe(true);
      if (filtro?.tipo === 'selecao') expect(filtro.extrair(sub)).toBe(sub.parent);
    }
  });
});

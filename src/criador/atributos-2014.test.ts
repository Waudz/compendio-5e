import { it, expect } from 'vitest';
import { metodoPreservado, manualValido } from './atributos-2014';
it('não calcula compra de pontos sobre rolagens/valores antigos e não modifica os atributos', () => {
  const a = { str: 18, dex: 16, con: 14, int: 13, wis: 12, cha: 10 };
  const before = { ...a };
  expect(metodoPreservado(a)).toBe('preserved');
  expect(metodoPreservado(a, 'manual')).toBe('manual');
  expect(a).toEqual(before);
});
it('preserva valores não padronizados em vez de truncar para 15', () => {
  const a = { str: 24, dex: 12, con: 20, int: 8, wis: 10, cha: 8 };
  expect(metodoPreservado(a)).toBe('preserved');
  expect(manualValido(a)).toBe(false);
  expect(a.str).toBe(24);
});
it('reconhece matriz e compra válida; rolagens manuais têm limites próprios', () => {
  expect(
    metodoPreservado({ str: 15, dex: 14, con: 13, int: 12, wis: 10, cha: 8 }),
  ).toBe('standard-array');
  expect(
    metodoPreservado({ str: 15, dex: 12, con: 14, int: 10, wis: 12, cha: 8 }),
  ).toBe('point-buy');
  expect(
    manualValido({ str: 3, dex: 18, con: 8, int: 10, wis: 12, cha: 14 }),
  ).toBe(true);
});

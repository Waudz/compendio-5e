import {
  isStandardArray,
  validatePointBuy,
} from '../rules/ability-generation-2014';
import type { Abilities } from '../rules/character-build-pilot';
export type MetodoAtributos =
  | 'point-buy'
  | 'standard-array'
  | 'manual'
  | 'preserved';
export const manualValido = (a: Abilities) =>
  Object.values(a).every((v) => Number.isSafeInteger(v) && v >= 3 && v <= 18);
export function metodoPreservado(
  a: Abilities,
  preferred?: string,
): MetodoAtributos {
  if (preferred === 'manual' && manualValido(a)) return 'manual';
  if (isStandardArray(a)) return 'standard-array';
  try {
    validatePointBuy(a);
    return 'point-buy';
  } catch {
    return 'preserved';
  }
}

// Dados locais (localStorage) ligados a uma conta: limpeza no logout e remoção de restos de versões antigas.
// Regra: nada que pertença a um usuário fica no aparelho depois que ele sai.
export const KEY_PREFIX = "compendio5e:";

type Store = Pick<Storage, "length" | "key" | "removeItem">;
const safeStore = (): Store | null => { try { return localStorage; } catch { return null; } };

const keysOf = (store: Store): string[] => {
  const out: string[] = [];
  for (let i = 0; i < store.length; i++) { const k = store.key(i); if (k) out.push(k); }
  return out;
};

/** Remove todas as chaves do app que pertencem ao usuário (layouts por campanha, campanha ativa, futuros caches). */
export function clearUserLocalData(userId: string, store: Store | null = safeStore()): number {
  if (!store || !userId) return 0;
  const doomed = keysOf(store).filter(k => k.startsWith(KEY_PREFIX) && (k.includes(`:${userId}:`) || k.endsWith(`:${userId}`)));
  doomed.forEach(k => { try { store.removeItem(k); } catch { /* ignora */ } });
  return doomed.length;
}

/** Remove restos do modo visitante e do layout v1, que não pertenciam a nenhuma conta. */
export function clearLegacyLocalData(store: Store | null = safeStore()): number {
  if (!store) return 0;
  const doomed = keysOf(store).filter(k => k === `${KEY_PREFIX}workspace:columns:v1` || (k.startsWith(KEY_PREFIX) && k.includes(":visitante:")));
  doomed.forEach(k => { try { store.removeItem(k); } catch { /* ignora */ } });
  return doomed.length;
}

// Chaves de cache sempre escopadas por usuário e campanha (TanStack Query, IndexedDB, buscas, etc.).
// Nenhum cache pode existir sem o par [usuário, campanha|null]: troca de campanha ou de conta nunca reaproveita dados.
export type CacheKey = readonly [userId: string, campaignId: string | null, ...parts: (string | number | null)[]];

export function cacheKey(userId: string, campaignId: string | null, ...parts: (string | number | null)[]): CacheKey {
  if (!userId) throw new Error("cacheKey exige o id do usuário");
  return [userId, campaignId, ...parts];
}

/** A chave pertence a este usuário (e, se informado, a esta campanha)? Usar para limpar caches ao trocar de escopo. */
export function keyBelongsTo(key: CacheKey, userId: string, campaignId?: string | null): boolean {
  return key[0] === userId && (campaignId === undefined || key[1] === campaignId);
}

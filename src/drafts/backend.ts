// Armazenamentos dos rascunhos: IndexedDB (camada fina, sem dependências) e memória (testes / IndexedDB indisponível).
import { DraftStorageError, type Draft, type DraftBackend } from "./types";

const DB_NAME = "compendio5e-rascunhos", STORE = "drafts", VERSION = 1;

/** Memória: segue a mesma interface. `persistent = false` avisa que nada sobrevive ao fechar a aba. */
export function memoryBackend(opts: { failPut?: () => Error | null; persistent?: boolean } = {}): DraftBackend & { dump(): Draft[] } {
  const m = new Map<string, Draft>();
  const clone = (d: Draft): Draft => structuredClone(d);
  return {
    persistent: opts.persistent ?? false,
    async get(key) { const d = m.get(key); return d ? clone(d) : undefined; },
    async put(d) { const e = opts.failPut?.(); if (e) throw e; m.set(d.key, clone(d)); },
    async delete(key) { m.delete(key); },
    async listScope(scope) { return [...m.values()].filter(d => d.scope === scope).map(clone); },
    async meta() { return [...m.values()].map(({ key, scope, bytes, status }) => ({ key, scope, bytes, status })); },
    async deleteScope(scope) { let n = 0; for (const [k, d] of m) if (d.scope === scope) { m.delete(k); n++; } return n; },
    dump: () => [...m.values()].map(clone),
  };
}

const req = <T,>(r: IDBRequest<T>): Promise<T> => new Promise((ok, fail) => { r.onsuccess = () => ok(r.result); r.onerror = () => fail(r.error); });
function mapError(e: unknown): DraftStorageError {
  const name = (e as { name?: string } | null)?.name ?? "";
  if (name === "QuotaExceededError") return new DraftStorageError("quota", "Sem espaço no armazenamento do navegador.");
  if (name === "SecurityError" || name === "InvalidStateError" || name === "NotAllowedError") return new DraftStorageError("bloqueado", "O navegador bloqueou o armazenamento local (navegação privada ou permissão).");
  return new DraftStorageError("erro", (e as Error | null)?.message || "Falha no armazenamento local.");
}

/** Abre o IndexedDB. Falha com DraftStorageError("indisponivel"|"bloqueado") em navegação privada, bloqueio ou ausência de suporte. */
export async function openIdbBackend(factory: IDBFactory | undefined = typeof indexedDB === "undefined" ? undefined : indexedDB): Promise<DraftBackend> {
  if (!factory) throw new DraftStorageError("indisponivel", "IndexedDB não está disponível neste navegador.");
  const db = await new Promise<IDBDatabase>((ok, fail) => {
    let r: IDBOpenDBRequest;
    try { r = factory.open(DB_NAME, VERSION); } catch (e) { return fail(mapError(e)); }
    r.onupgradeneeded = () => { const s = r.result.createObjectStore(STORE, { keyPath: "key" }); s.createIndex("scope", "scope", { unique: false }); };
    r.onsuccess = () => ok(r.result); r.onerror = () => fail(mapError(r.error)); r.onblocked = () => fail(new DraftStorageError("bloqueado", "Abertura do banco local bloqueada por outra aba."));
  }).catch(e => { throw e instanceof DraftStorageError ? e : mapError(e); });
  const tx = (mode: IDBTransactionMode) => db.transaction(STORE, mode).objectStore(STORE);
  const wrap = async <T,>(f: () => Promise<T>): Promise<T> => { try { return await f(); } catch (e) { throw e instanceof DraftStorageError ? e : mapError(e); } };
  return {
    persistent: true,
    get: key => wrap(async () => (await req(tx("readonly").get(key))) as Draft | undefined),
    put: d => wrap(async () => { await req(tx("readwrite").put(d)); }),
    delete: key => wrap(async () => { await req(tx("readwrite").delete(key)); }),
    listScope: scope => wrap(async () => (await req(tx("readonly").index("scope").getAll(scope))) as Draft[]),
    meta: () => wrap(async () => ((await req(tx("readonly").getAll())) as Draft[]).map(({ key, scope, bytes, status }) => ({ key, scope, bytes, status }))),
    deleteScope: scope => wrap(async () => { const s = tx("readwrite"), keys = await req(s.index("scope").getAllKeys(scope)); await Promise.all(keys.map(k => req(s.delete(k)))); return keys.length; }),
  };
}

/** IndexedDB se der; senão memória, com `persistent = false` (a interface deve avisar que os rascunhos não sobrevivem). Nunca lança. */
export async function openBackend(factory?: IDBFactory): Promise<{ backend: DraftBackend; problem?: DraftStorageError }> {
  try { return { backend: await openIdbBackend(factory) }; }
  catch (e) { return { backend: memoryBackend(), problem: e instanceof DraftStorageError ? e : mapError(e) }; }
}

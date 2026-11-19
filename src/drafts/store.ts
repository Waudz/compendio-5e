// Repositório de rascunhos de UM usuário em UMA campanha. Toda operação passa pelo escopo; nunca devolve dado de outra conta ou campanha.
// Regras: o servidor é a fonte principal; rascunho pendente ou em conflito NUNCA é descartado em silêncio; só rascunho já salvo (recuperável)
// é limpo automaticamente; conflito é detectado por versão e nunca resolvido sozinho.
import { decideVersion } from "../records";
import { DEFAULT_LIMITS, DRAFT_KINDS, DraftStorageError, type Draft, type DraftBackend, type DraftInput, type DraftKind, type Limits, type SaveResult, type Usage } from "./types";

export const PERSONAL = "_pessoal";
const ID = /^[\w-]{1,64}$/;
const bytesOf = (v: unknown) => new TextEncoder().encode(JSON.stringify(v)).length;
const DAY = 86_400_000;
const FULL_RATIO = 0.98;     // a partir daqui não cabe mais um rascunho realista: avisa como "cheio" (o limite real continua sendo 100%)

// montado por partes: o teste de segredos do repositório não deve confundir esta lista de recusa com um segredo
const SECRET_WORDS = new RegExp("sb_" + "secret_[A-Za-z0-9_-]{8,}|service" + "_role", "i");
/** Segredos nunca entram no armazenamento local: chave secreta do Supabase, JWT de serviço/sessão e senhas óbvias. */
export function containsSecret(v: unknown): boolean {
  const s = JSON.stringify(v) ?? "";
  if (SECRET_WORDS.test(s)) return true;
  for (const jwt of s.match(/eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]*/g) ?? []) {
    try { const p = JSON.parse(atob(jwt.split(".")[1].replace(/-/g, "+").replace(/_/g, "/"))); if (p && (p.role || p.sub || p.session_id || p.exp)) return true; } catch { /* não é JWT legível */ }
  }
  return /"(access_token|refresh_token|password|senha|apikey|api_key)"\s*:/i.test(s);
}

export type StoreOptions = { backend: DraftBackend; userId: string; campaignId?: string | null; limits?: Partial<Limits>; now?: () => number; estimate?: () => Promise<{ usage: number; quota: number } | undefined> };

export function createDraftStore(o: StoreOptions) {
  const userId = o.userId, campaignId = o.campaignId || PERSONAL, now = o.now ?? Date.now, limits: Limits = { ...DEFAULT_LIMITS, ...o.limits };
  if (!userId || !ID.test(userId.replace(/[^\w-]/g, "_"))) throw new Error("rascunhos exigem o id do usuário");
  const scope = `${userId}|${campaignId}`, b = o.backend;
  const keyOf = (kind: DraftKind, id: string) => `${scope}|${kind}|${id}`;
  const mine = (d: Draft | undefined): Draft | undefined => (d && d.userId === userId && d.campaignId === campaignId && d.scope === scope ? d : undefined);   // defesa extra: nunca devolve de outro escopo
  const valid = (kind: unknown, id: unknown) => DRAFT_KINDS.includes(kind as DraftKind) && typeof id === "string" && ID.test(id);

  async function usage(): Promise<Usage> {
    const all = await b.meta();
    const bytes = all.reduce((n, d) => n + d.bytes, 0), mineAll = all.filter(d => d.scope === scope);
    const ratio = Math.max(bytes / limits.maxTotalBytes, all.length / limits.maxDrafts);
    const u: Usage = {
      count: mineAll.length, pendingCount: mineAll.filter(d => d.status === "pending").length, conflictCount: mineAll.filter(d => d.status === "conflict").length, syncedCount: mineAll.filter(d => d.status === "synced").length,
      bytes, limitBytes: limits.maxTotalBytes, ratio, level: ratio >= FULL_RATIO ? "cheio" : ratio >= limits.warnRatio ? "aviso" : "ok", persistent: b.persistent,
    };
    const est = await o.estimate?.().catch(() => undefined) ?? await browserEstimate();
    if (est) { u.browser = est; if (est.quota > 0 && est.usage / est.quota >= 0.9) u.level = "cheio"; else if (est.quota > 0 && est.usage / est.quota >= limits.warnRatio && u.level === "ok") u.level = "aviso"; }
    return u;
  }
  async function browserEstimate() { try { const e = await navigator.storage?.estimate?.(); return e && e.quota ? { usage: e.usage ?? 0, quota: e.quota } : undefined; } catch { return undefined; } }

  /** Remove só o que é recuperável (já salvo) e mais antigo que o prazo, neste escopo. Nunca toca em pendente ou conflito. */
  async function cleanup(force = false): Promise<number> {
    const cutoff = now() - limits.syncedRetentionDays * DAY;
    const old = (await b.listScope(scope)).filter(d => d.status === "synced" && (force || (d.syncedAt ?? d.updatedAt) < cutoff));
    for (const d of old) await b.delete(d.key);
    return old.length;
  }

  async function save(input: DraftInput): Promise<SaveResult> {
    if (!valid(input.kind, input.entityId)) return { ok: false, reason: "invalido", message: "Item inválido para rascunho." };
    if (containsSecret(input.content) || containsSecret(input.title)) return { ok: false, reason: "segredo", message: "O conteúdo parece conter uma senha, token ou chave; ele não será guardado neste aparelho." };
    const bytes = bytesOf({ c: input.content, t: input.title });
    if (bytes > limits.maxBytesPerDraft) return { ok: false, reason: "rascunho_grande", message: `Rascunho acima do limite de ${Math.round(limits.maxBytesPerDraft / 1000)} kB.` };
    try {
      const key = keyOf(input.kind, input.entityId), previous = mine(await b.get(key)), t = now();
      const extra = bytes - (previous?.bytes ?? 0);
      const over = async () => { const m = await b.meta(); return m.reduce((n, d) => n + d.bytes, 0) + extra > limits.maxTotalBytes || (!previous && m.length >= limits.maxDrafts); };
      if (await over()) {
        await cleanup(true);                                                                  // primeiro: só o recuperável (já salvo) deste escopo
        if (await over()) return { ok: false, reason: "limite", message: "Armazenamento local cheio: nada foi descartado. Exporte os rascunhos pendentes e libere espaço." };
      }
      const draft: Draft = {
        key, scope, userId, campaignId, kind: input.kind, entityId: input.entityId, title: input.title, content: input.content,
        baseVersion: input.baseVersion !== undefined ? input.baseVersion : previous ? previous.baseVersion : null,
        status: previous?.status === "conflict" ? "conflict" : "pending",                  // editar durante um conflito não o resolve sozinho
        serverVersionSeen: previous?.serverVersionSeen, createdAt: previous?.createdAt ?? t, updatedAt: t, bytes,
      };
      await b.put(draft);                                                                   // se falhar, o registro anterior permanece intacto
      return { ok: true, draft, usage: await usage() };
    } catch (e) {
      const err = e instanceof DraftStorageError ? e : new DraftStorageError("erro", (e as Error).message);
      return { ok: false, reason: err.code === "quota" ? "quota" : "armazenamento", message: err.code === "quota" ? "Sem espaço no navegador: o rascunho anterior foi mantido. Exporte os pendentes." : err.message };
    }
  }

  const get = async (kind: DraftKind, id: string) => (valid(kind, id) ? mine(await b.get(keyOf(kind, id))) : undefined);
  const list = async () => (await b.listScope(scope)).filter(d => mine(d)).sort((a, c) => c.updatedAt - a.updatedAt);
  const pending = async () => (await list()).filter(d => d.status === "pending");
  const remove = async (kind: DraftKind, id: string) => { if (valid(kind, id) && (await get(kind, id))) await b.delete(keyOf(kind, id)); };

  /** O servidor confirmou o salvamento. Se o usuário continuou editando DURANTE o envio, o rascunho segue pendente (nada se perde). */
  async function markSynced(kind: DraftKind, id: string, r: { serverVersion: number; pushedUpdatedAt: number }): Promise<Draft | undefined> {
    const d = await get(kind, id); if (!d) return undefined;
    const editedMeanwhile = d.updatedAt > r.pushedUpdatedAt;
    const n: Draft = { ...d, baseVersion: r.serverVersion, status: editedMeanwhile ? "pending" : "synced", syncedAt: editedMeanwhile ? d.syncedAt : now(), serverVersionSeen: undefined };
    await b.put(n); return n;
  }
  /** Compara a base do rascunho com a versão atual do servidor. Divergiu → `conflict` (sem sobrescrever nem o rascunho nem o servidor). */
  async function reconcile(kind: DraftKind, id: string, serverVersion: number): Promise<"apply" | "conflict" | "nothing"> {
    const d = await get(kind, id); if (!d || d.status === "synced") return "nothing";
    if (d.baseVersion === null) return "apply";                                           // item novo: nada a comparar
    if (decideVersion(d.baseVersion, serverVersion) === "apply") return d.status === "conflict" ? "conflict" : "apply";
    await b.put({ ...d, status: "conflict", serverVersionSeen: serverVersion }); return "conflict";
  }
  /** Resolução explícita pelo usuário: manter o meu (rebase na versão do servidor), usar o do servidor (descarta o rascunho) ou salvar como cópia. */
  async function resolve(kind: DraftKind, id: string, choice: "meu" | "servidor" | "copia", serverVersion?: number): Promise<{ ok: boolean; draft?: Draft }> {
    const d = await get(kind, id); if (!d || d.status !== "conflict") return { ok: false };
    if (choice === "meu") { const v = serverVersion ?? d.serverVersionSeen; if (v === undefined) return { ok: false }; const n: Draft = { ...d, baseVersion: v, status: "pending", serverVersionSeen: undefined, updatedAt: now() }; await b.put(n); return { ok: true, draft: n }; }
    await b.delete(d.key); return { ok: true, draft: choice === "copia" ? d : undefined };   // "copia": devolve o conteúdo para o chamador gravar como item novo
  }
  async function exportPending(): Promise<{ json: string; count: number; bytes: number }> {
    const items = (await list()).filter(d => d.status !== "synced");
    const json = JSON.stringify({ formato: "compendio-rascunhos", versao: 1, exportadoEm: new Date(now()).toISOString(), campanha: campaignId, rascunhos: items.map(({ key: _k, scope: _s, userId: _u, ...r }) => r) }, null, 1);   // sem ids de conta nem chaves internas
    return { json, count: items.length, bytes: new TextEncoder().encode(json).length };
  }
  const hasUnsynced = async () => (await list()).some(d => d.status !== "synced");
  /** Apaga TODOS os rascunhos deste escopo (ex.: sair da conta em aparelho compartilhado). Exporte antes se houver pendentes. */
  const wipe = () => b.deleteScope(scope);

  return { scope, limits, save, get, list, pending, remove, markSynced, reconcile, resolve, exportPending, hasUnsynced, usage, cleanup, wipe, persistent: b.persistent };
}
export type DraftStore = ReturnType<typeof createDraftStore>;

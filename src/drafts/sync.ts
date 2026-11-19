// Envio dos rascunhos pendentes por um ADAPTADOR injetado. Nesta entrega NÃO há adaptador real: nada é conectado ao Supabase.
// A função existe para fixar o contrato (e é testada com adaptadores falsos): sequencial, sem sobrescrever o servidor, sem perder edições.
import type { DraftStore } from "./store";
import type { Draft } from "./types";

export type PushResult = { ok: true; serverVersion: number } | { ok: false; reason: "conflito" | "offline" | "erro"; serverVersion?: number };
export type SyncAdapter = { push(draft: Draft): Promise<PushResult> };
export type FlushSummary = { enviados: number; conflitos: number; pendentes: number; parouOffline: boolean; erros: number };

/** Envia, um a um, os rascunhos `pending`. Conflito não é enviado nem sobrescrito; offline interrompe e mantém tudo pendente. */
export async function flushPending(store: DraftStore, adapter: SyncAdapter, o: { online?: () => boolean; onState?: (d: Draft, s: "saving" | "saved" | "conflict" | "pending") => void } = {}): Promise<FlushSummary> {
  const s: FlushSummary = { enviados: 0, conflitos: 0, pendentes: 0, parouOffline: false, erros: 0 };
  for (const d of await store.pending()) {
    if (o.online && !o.online()) { s.parouOffline = true; break; }
    o.onState?.(d, "saving");
    let r: PushResult;
    try { r = await adapter.push(d); } catch { r = { ok: false, reason: "erro" }; }
    if (r.ok) { await store.markSynced(d.kind, d.entityId, { serverVersion: r.serverVersion, pushedUpdatedAt: d.updatedAt }); s.enviados++; o.onState?.(d, "saved"); }
    else if (r.reason === "conflito") { if (r.serverVersion !== undefined) await store.reconcile(d.kind, d.entityId, r.serverVersion); s.conflitos++; o.onState?.(d, "conflict"); }
    else if (r.reason === "offline") { s.parouOffline = true; o.onState?.(d, "pending"); break; }
    else { s.erros++; o.onState?.(d, "pending"); }
  }
  s.pendentes = (await store.pending()).length;
  return s;
}

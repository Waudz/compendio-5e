// Persistência do layout: chave por usuário+campanha+dispositivo, envelope versionado, recuperação de dados inválidos.
import type { IJsonModel } from "flexlayout-react";
import { defaultLayout, sanitizeLayout, tabId, sections } from "./workspace";

export const VERSION = 2;
export type Scope = { user: string; campaign: string; device: string };
export const defaultScope: Scope = { user: "visitante", campaign: "nenhuma", device: "navegador" };
export const storageKey = (s: Scope = defaultScope) => `compendio5e:workspace:v${VERSION}:${s.user}:${s.campaign}:${s.device}`;
export const legacyKey = "compendio5e:workspace:columns:v1";

type Store = Pick<Storage, "getItem" | "setItem">;
const safeStore = (): Store | null => { try { return localStorage; } catch { return null; } };

/** v1 (colunas, abas com id = página) -> layout atual. */
export function migrateV1(data: unknown): IJsonModel | null {
  const cols = (data as { columns?: unknown } | null)?.columns;
  if (!Array.isArray(cols)) return null;
  return sanitizeLayout({ layout: { type: "row", children: cols.map(c => {
    const tabs = (Array.isArray(c?.tabs) ? c.tabs : []).filter((t: { page?: string }) => sections.some(s => s.page === t?.page))
      .map((t: { page: string }) => ({ id: tabId({ kind: "secao", ref: t.page }) }));
    const sel = tabs.findIndex((t: { id: string }) => t.id === tabId({ kind: "secao", ref: c?.active }));
    return { type: "tabset", weight: Number(c?.width), selected: sel, children: tabs };
  }) } });
}

/** Lê e valida; qualquer problema devolve o layout padrão (nunca lança). */
export function loadLayout(scope: Scope = defaultScope, store: Store | null = safeStore()): IJsonModel {
  try {
    const raw = store?.getItem(storageKey(scope));
    if (raw) {
      const env = JSON.parse(raw) as { version?: number; layout?: unknown };
      if (env?.version === VERSION) { const ok = sanitizeLayout(env); if (ok) return ok; }
    } else {
      const old = store?.getItem(legacyKey);
      if (old) { const ok = migrateV1(JSON.parse(old)); if (ok) return ok; }
    }
  } catch { /* dados corrompidos: cai no padrão */ }
  return defaultLayout();
}

export function saveLayout(layout: IJsonModel, scope: Scope = defaultScope, store: Store | null = safeStore()): void {
  try { store?.setItem(storageKey(scope), JSON.stringify({ version: VERSION, layout: layout.layout })); } catch { /* cota/privacidade */ }
}

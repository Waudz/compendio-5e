// Persistência do layout: chave por usuário+campanha+dispositivo, envelope versionado, recuperação de dados inválidos.
// O layout guarda SÓ ids e geometria (nunca títulos de campanhas, notas ou fichas): títulos vêm da API quando preciso.
import type { IJsonModel } from "flexlayout-react";
import { defaultLayout, sanitizeLayout } from "./workspace";

export const VERSION = 2;
export type Scope = { user: string; campaign: string; device: string };
export const storageKey = (s: Scope) => `compendio5e:workspace:v${VERSION}:${s.user}:${s.campaign}:${s.device}`;

type Store = Pick<Storage, "getItem" | "setItem">;
const safeStore = (): Store | null => { try { return localStorage; } catch { return null; } };

/** Lê e valida; qualquer problema devolve o layout padrão (nunca lança). */
export function loadLayout(scope: Scope, store: Store | null = safeStore()): IJsonModel {
  try {
    const raw = store?.getItem(storageKey(scope));
    if (raw) {
      const env = JSON.parse(raw) as { version?: number; layout?: unknown };
      if (env?.version === VERSION) { const ok = sanitizeLayout(env); if (ok) return ok; }
    }
  } catch { /* dados corrompidos: cai no padrão */ }
  return defaultLayout();
}

/** Já existe layout salvo (v2) para este escopo? */
export function hasSavedLayout(scope: Scope, store: Store | null = safeStore()): boolean {
  try { return !!store?.getItem(storageKey(scope)); } catch { return false; }
}

/** Reduz o layout ao essencial: ids das abas, pesos, seleção e grupo ativo. Sem nomes, sem config. */
export function minimalLayout(layout: IJsonModel) {
  return { type: "row", children: (layout.layout.children ?? []).map(g => {
    const set = g as { id?: string; weight?: number; selected?: number; active?: boolean; children?: { id?: string; config?: { pinned?: boolean; history?: {pages: {kind:string;ref:string}[];index:number} } }[] };
    return { type: "tabset", id: set.id, weight: set.weight ?? 100, selected: set.selected, active: set.active === true, children: (set.children ?? []).map(t => ({ type: "tab", id: t.id, ...(t.config?.pinned === true ? { pinned: true } : {}), ...(t.config?.history ? { history: { pages: t.config.history.pages.slice(-40).map(p=>({kind:p.kind,ref:p.ref})), index:t.config.history.index } } : {}) })) };
  }) };
}

export function saveLayout(layout: IJsonModel, scope: Scope, store: Store | null = safeStore()): void {
  try { store?.setItem(storageKey(scope), JSON.stringify({ version: VERSION, layout: minimalLayout(layout) })); } catch { /* cota/privacidade */ }
}

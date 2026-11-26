import {OrigemAbaContext} from "./abrirEmAba";
// Proteção contra perda de trabalho: editores registram "alterações não salvas" por aba; fechar, fechar coluna, sair da conta,
// trocar de campanha ou recarregar pedem confirmação. Fixar uma aba NÃO substitui esta proteção. O registro vive em memória
// (por usuário: o espaço de trabalho é remontado a cada troca de conta) e nada dele é persistido.
import { createContext, useCallback, useContext, useEffect, useId, useMemo, useRef, useState, type ReactNode } from "react";

export type UnsavedEntry = { dirty: boolean; save?: () => Promise<boolean> | boolean };
export type UnsavedApi = {
  register(id: string, entry: UnsavedEntry | null): void;
  isDirty(id: string): boolean;
  /** Executa `proceed` já, ou depois da confirmação se alguma das abas tiver alterações não salvas. */
  guard(ids: string[] | "all", proceed: () => void): void;
  /** Versão com promessa (ex.: sair da conta, trocar de campanha): resolve true se pode seguir. */
  confirmAll(): Promise<boolean>;
};

const none: UnsavedApi = { register() {}, isDirty: () => false, guard: (_ids, proceed) => proceed(), confirmAll: async () => true };
export const UnsavedContext = createContext<UnsavedApi>(none);
export const useUnsaved = () => useContext(UnsavedContext);

/** Para editores: informa se há alterações não salvas (e, opcionalmente, como salvar). */
export function useUnsavedGuard(tabId: string, dirty: boolean, save?: UnsavedEntry["save"]) {
  const api = useUnsaved(), origin=useContext(OrigemAbaContext), source=useId();
  const key=`${origin??tabId}::guard:${source}`;
  useEffect(() => { api.register(key, { dirty, save }); return () => api.register(key, null); }, [api, key, dirty, save]);
}

type Pending = { ids: string[]; proceed: () => void; cancel?: () => void; error?: string };

export function useUnsavedRegistry(labelOf: (id: string) => string) {
  const entries = useRef(new Map<string, UnsavedEntry>());
  const [pending, setPending] = useState<Pending | null>(null);
  const base=(id:string)=>id.split("::guard:")[0];
  const dirtyIds = (ids: string[] | "all") => [...entries.current.keys()].filter(i => entries.current.get(i)?.dirty&&(ids==="all"||ids.includes(i)||ids.includes(base(i))));

  const api = useMemo<UnsavedApi>(() => ({
    register(id, entry) { if (entry) entries.current.set(id, entry); else entries.current.delete(id); },
    isDirty: id => dirtyIds([id]).length>0,
    guard(ids, proceed) { const d = dirtyIds(ids); if (!d.length) proceed(); else setPending({ ids: d, proceed }); },
    confirmAll: () => new Promise<boolean>(resolve => {
      const d = dirtyIds("all");
      if (!d.length) resolve(true); else setPending({ ids: d, proceed: () => resolve(true), cancel: () => resolve(false) });
    }),
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), []);

  // Recarregar/fechar o navegador com alterações pendentes: aviso nativo.
  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => { if (dirtyIds("all").length) { e.preventDefault(); e.returnValue = ""; } };
    window.addEventListener("beforeunload", warn); return () => window.removeEventListener("beforeunload", warn);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const cancel = useCallback(() => { pending?.cancel?.(); setPending(null); }, [pending]);
  const discard = useCallback(() => { const p = pending!; p.ids.forEach(i => { const e = entries.current.get(i); if (e) entries.current.set(i, { ...e, dirty: false }); }); setPending(null); p.proceed(); }, [pending]);
  const saveAll = useCallback(async () => {
    const p = pending!; let ok = true;
    for (const i of p.ids) { try { if ((await entries.current.get(i)?.save?.()) === false) ok = false; } catch { ok = false; } }
    if (ok) { setPending(null); p.proceed(); } else setPending({ ...p, error: "Não foi possível salvar. Nada foi descartado." });
  }, [pending]);

  const canSave = !!pending && pending.ids.every(i => entries.current.get(i)?.save);
  const dialog: ReactNode = pending && <div className="dlg-backdrop"><div className="dlg" role="alertdialog" aria-modal="true" aria-labelledby="dlg-t" aria-describedby="dlg-d">
    <h2 id="dlg-t">Alterações não salvas</h2>
    <p id="dlg-d">{pending.ids.length === 1 ? "Esta aba tem alterações que serão perdidas:" : "Estas abas têm alterações que serão perdidas:"}</p>
    <ul>{[...new Set(pending.ids.map(base))].map(i => <li key={i}>{labelOf(i)}</li>)}</ul>
    {pending.error && <div className="notice err" role="alert">{pending.error}</div>}
    <div className="row">
      <button className="btn-primary" autoFocus onClick={cancel}>Cancelar</button>
      {canSave && <button className="btn-secondary" onClick={() => void saveAll()}>Salvar</button>}
      <button className="btn-secondary danger" onClick={discard}>Descartar alterações</button>
    </div></div></div>;
  return { api, dialog };
}

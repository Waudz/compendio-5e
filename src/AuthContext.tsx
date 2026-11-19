import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import { createAuthApi, traduzirErro, type AuthApi } from "./auth";
import { clearLegacyLocalData, clearUserLocalData } from "./localData";
import { supabase } from "./supabase";

/** unconfigured: sem Supabase (o app não abre); loading: lendo a sessão salva; signedOut: sem sessão (tela de login); authenticated: logado. */
export type AuthStatus = "unconfigured" | "loading" | "signedOut" | "authenticated";
export type AuthValue = { status: AuthStatus; user: User | null; recovery: boolean; endRecovery: () => void; loadError: string | null; api: AuthApi | null; client: SupabaseClient | null };

const Ctx = createContext<AuthValue>({ status: "unconfigured", user: null, recovery: false, endRecovery() {}, loadError: null, api: null, client: null });
export const useAuth = () => useContext(Ctx);

export function AuthProvider({ client = supabase, children }: { client?: SupabaseClient | null; children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>(client ? "loading" : "unconfigured");
  const [user, setUser] = useState<User | null>(null);
  const [recovery, setRecovery] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const lastUserId = useRef<string | null>(null);

  useEffect(() => { clearLegacyLocalData(); }, []);   // restos de versões antigas (layout v1 e chaves sem dono)

  useEffect(() => {
    if (!client) return;
    let alive = true;
    const apply = (u: User | null) => {
      // Saída (ou troca direta de conta): tudo que era local da conta anterior é apagado do aparelho.
      if (lastUserId.current && lastUserId.current !== (u?.id ?? null)) clearUserLocalData(lastUserId.current);
      lastUserId.current = u?.id ?? null;
      setUser(u); setStatus(u ? "authenticated" : "signedOut");
    };
    client.auth.getSession().then(({ data, error }) => {
      if (!alive) return;
      if (error) setLoadError(traduzirErro(error));
      apply(data?.session?.user ?? null);
    }).catch(e => { if (alive) { setLoadError(traduzirErro(e)); apply(null); } });
    const { data } = client.auth.onAuthStateChange((event, session) => {
      if (!alive) return;
      if (event === "PASSWORD_RECOVERY") setRecovery(true);
      if (event === "SIGNED_OUT") setRecovery(false);
      apply(session?.user ?? null);
    });
    return () => { alive = false; data.subscription.unsubscribe(); };
  }, [client]);

  const api = useMemo(() => client ? createAuthApi(client) : null, [client]);
  const endRecovery = useCallback(() => setRecovery(false), []);
  const value = useMemo(() => ({ status, user, recovery, endRecovery, loadError, api, client: client ?? null }), [status, user, recovery, endRecovery, loadError, api, client]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

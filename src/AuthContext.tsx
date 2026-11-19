import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import { createAuthApi, traduzirErro, type AuthApi } from "./auth";
import { supabase } from "./supabase";

/** unconfigured: sem Supabase (só visitante); loading: lendo sessão salva; guest: sem conta; authenticated: logado. */
export type AuthStatus = "unconfigured" | "loading" | "guest" | "authenticated";
export type AuthValue = { status: AuthStatus; user: User | null; recovery: boolean; loadError: string | null; api: AuthApi | null; client: SupabaseClient | null };

const Ctx = createContext<AuthValue>({ status: "unconfigured", user: null, recovery: false, loadError: null, api: null, client: null });
export const useAuth = () => useContext(Ctx);

export function AuthProvider({ client = supabase, children }: { client?: SupabaseClient | null; children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>(client ? "loading" : "unconfigured");
  const [user, setUser] = useState<User | null>(null);
  const [recovery, setRecovery] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (!client) return;
    let alive = true;
    const apply = (u: User | null) => { setUser(u); setStatus(u ? "authenticated" : "guest"); };
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
  const value = useMemo(() => ({ status, user, recovery, loadError, api, client: client ?? null }), [status, user, recovery, loadError, api, client]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

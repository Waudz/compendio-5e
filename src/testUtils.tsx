// Apoio aos testes (não é importado pelo app).
import { render, screen } from "@testing-library/react";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import { act } from "react";
import App from "./App";
import { AuthGate } from "./AuthGate";
import { AuthProvider } from "./AuthContext";
import { CampaignsProvider } from "./CampaignsContext";
import type { CampaignApi } from "./campaigns";
import type { CapaApi } from "./capa";
import type { FichasApi } from "./fichas";
import type { RegistrosApi } from "./registros";
import { RegistrosProvider } from "./RegistrosContext";

/** localStorage em memória, com length/key como o real (necessário para a limpeza por prefixo). */
export function memoryStorage() {
  const m = new Map<string, string>();
  return {
    get length() { return m.size; },
    key: (i: number) => [...m.keys()][i] ?? null,
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => { m.set(k, v); },
    removeItem: (k: string) => { m.delete(k); },
    clear: () => m.clear(),
  };
}

export const me = { id: "u1", email: "eu@exemplo.com" } as User;
export const other = { id: "u2", email: "outra@exemplo.com" } as User;
type Listener = (event: string, session: { user: User } | null) => void;

/** Cliente de autenticação falso: sessão inicial opcional e `emit` para simular eventos do Supabase. */
export function fakeAuth(user: User | null) {
  const listeners: Listener[] = [];
  const client = { auth: {
    getSession: async () => ({ data: { session: user ? { user } : null }, error: null }),
    onAuthStateChange: (l: Listener) => { listeners.push(l); return { data: { subscription: { unsubscribe() {} } } }; },
  } } as unknown as SupabaseClient;
  return { client, emit: (event: string, session: { user: User } | null) => act(() => { listeners.forEach(l => l(event, session)); }) };
}

export const emptyCampaignApi = () => ({ list: async () => ({ ok: true, data: [] }) }) as unknown as CampaignApi;

/** Monta o aplicativo completo (porta de entrada + espaço de trabalho). Com usuário, espera o menu aparecer. */
export async function renderApp(opts: { user?: User | null; api?: CampaignApi; auth?: ReturnType<typeof fakeAuth>; registros?: RegistrosApi; capa?: CapaApi; fichas?: FichasApi; waitForMenu?: boolean } = {}) {
  const auth = opts.auth ?? fakeAuth(opts.user === undefined ? me : opts.user);
  const api = opts.api ?? emptyCampaignApi();
  const view = render(<AuthProvider client={auth.client}><CampaignsProvider apiFactory={() => api}><AuthGate>{opts.registros || opts.capa || opts.fichas ? <RegistrosProvider api={opts.registros ?? null} capa={opts.capa ?? null} fichas={opts.fichas}><App/></RegistrosProvider> : <App/>}</AuthGate></CampaignsProvider></AuthProvider>);
  if (opts.user !== null && opts.waitForMenu !== false) await screen.findByRole("navigation", { name: "Menu principal" });
  return { ...view, auth, api };
}

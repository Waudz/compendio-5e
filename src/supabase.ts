// Cliente Supabase único. Configuração por variáveis de ambiente do Vite (ver .env.example).
// Sem variáveis, `supabase` é null e o app funciona em modo visitante (nada é simulado).
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

/** Recusa valores vazios, de exemplo, e qualquer chave service_role (decodifica o payload do JWT). */
export function isUsableConfig(u?: string, k?: string): boolean {
  if (!u || !k || /SEU-PROJETO|sua-chave/i.test(u + k)) return false;
  if (!/^https:\/\/[\w-]+\.supabase\.(co|in)\/?$/.test(u) && !/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?\/?$/.test(u)) return false;
  try {
    const payload = JSON.parse(atob(k.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")));
    if (payload?.role === "service_role") return false;
  } catch { /* chaves "sb_publishable_..." não são JWT: ok */ }
  return !k.startsWith("sb_secret_");
}

export const supabase: SupabaseClient | null = isUsableConfig(url, key)
  ? createClient(url!, key!, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: "pkce" } })
  : null;
export const isConfigured = supabase !== null;

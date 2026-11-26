// Modo "nuvem" do combate e dos encontros: contexto injetável (testes, demonstração) e ligação por configuração explícita (VITE_COMBATE_REMOTO=1 + Supabase).
import { createContext, useContext, useMemo } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { useAuth } from "./AuthContext";
import type { Encontro, EstadoCombate } from "./combate";
import { criarApiEncontros } from "./encontrosRemoto";
import { criarApiLinhaCombate, type ApiLinha } from "./linhaRemota";

export type ApisNuvem = { combate: ApiLinha<EstadoCombate>; encontros: ApiLinha<Encontro[]> };
/** Permite injetar as APIs (testes e demonstração). Sem provedor, a nuvem só liga com VITE_COMBATE_REMOTO=1 e cliente Supabase configurado. */
export const NuvemContext = createContext<ApisNuvem | null>(null);
export const nuvemHabilitada = () => import.meta.env.VITE_COMBATE_REMOTO === "1";
export function useNuvem(): ApisNuvem | null {
  const injetada = useContext(NuvemContext), { client } = useAuth() as { client?: SupabaseClient | null };
  return useMemo(() => injetada ?? (nuvemHabilitada() && client ? { combate: criarApiLinhaCombate(client), encontros: criarApiEncontros(client) } : null), [injetada, client]);
}

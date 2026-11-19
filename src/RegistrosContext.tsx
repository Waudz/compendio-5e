import { createContext, useContext, type ReactNode } from "react";
import { useMemo } from "react";
import { useAuth } from "./AuthContext";
import { createCapaApi, type CapaApi } from "./capa";
import { createRegistrosApi, type RegistrosApi } from "./registros";

const Ctx = createContext<RegistrosApi | null>(null);
const CapaCtx = createContext<CapaApi | null>(null);
/** API da capa da campanha. null: sem sessão ou sem Supabase. */
export const useCapa = () => useContext(CapaCtx);
/** API de registros (Diário, Planejamento). null: sem sessão ou sem Supabase. */
export const useRegistros = () => useContext(Ctx);

/** `api` existe para testes e para o modo de demonstração local (dev). Em produção usa o cliente da sessão. */
export function RegistrosProvider({ children, api, capa }: { children: ReactNode; api?: RegistrosApi | null; capa?: CapaApi | null }) {
  const { client, status } = useAuth();
  const real = useMemo(() => status === "authenticated" && client ? createRegistrosApi(client) : null, [client, status]);
  const realCapa = useMemo(() => status === "authenticated" && client ? createCapaApi(client) : null, [client, status]);
  return <Ctx.Provider value={api === undefined ? real : api}><CapaCtx.Provider value={capa === undefined ? realCapa : capa}>{children}</CapaCtx.Provider></Ctx.Provider>;
}

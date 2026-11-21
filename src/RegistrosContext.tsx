import { createContext, useContext, type ReactNode } from "react";
import { useMemo } from "react";
import { useAuth } from "./AuthContext";
import { createCapaApi, type CapaApi } from "./capa";
import { createFichasApi, type FichasApi } from "./fichas";
import { createRegistrosApi, type RegistrosApi } from "./registros";

const Ctx = createContext<RegistrosApi | null>(null);
const CapaCtx = createContext<CapaApi | null>(null);
const FichasCtx = createContext<FichasApi | null>(null);
/** Fichas privadas dos personagens guiados no Supabase. null: sem sessão/Supabase (ou demonstração): o criador usa o armazenamento local EXPERIMENTAL. */
export const useFichas = () => useContext(FichasCtx);
/** API da capa da campanha. null: sem sessão ou sem Supabase. */
export const useCapa = () => useContext(CapaCtx);
/** API de registros (Diário, Planejamento). null: sem sessão ou sem Supabase. */
export const useRegistros = () => useContext(Ctx);

/** `api` existe para testes e para o modo de demonstração local (dev). Em produção usa o cliente da sessão. */
export function RegistrosProvider({ children, api, capa, fichas }: { children: ReactNode; api?: RegistrosApi | null; capa?: CapaApi | null; fichas?: FichasApi | null }) {
  const { client, status } = useAuth();
  const real = useMemo(() => status === "authenticated" && client ? createRegistrosApi(client) : null, [client, status]);
  const realCapa = useMemo(() => status === "authenticated" && client ? createCapaApi(client) : null, [client, status]);
  const realFichas = useMemo(() => status === "authenticated" && client ? createFichasApi(client) : null, [client, status]);
  // `api` explícita (testes/demonstração) sem `fichas` explícitas: não cria cliente real; o criador cai no armazenamento local experimental.
  const valorFichas = fichas !== undefined ? fichas : api !== undefined ? null : realFichas;
  return <Ctx.Provider value={api === undefined ? real : api}><CapaCtx.Provider value={capa === undefined ? realCapa : capa}><FichasCtx.Provider value={valorFichas}>{children}</FichasCtx.Provider></CapaCtx.Provider></Ctx.Provider>;
}

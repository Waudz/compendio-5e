import { createContext, useContext, type ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import { createConfigCampanhaApi, type ConfigCampanhaApi } from "./configCampanha";
import { lerMoedasAtivas, type ChaveMoeda } from "./moedas/moedas";
import { useAuth } from "./AuthContext";
import { createCapaApi, type CapaApi } from "./capa";
import { createFichasApi, type FichasApi } from "./fichas";
import { createRegistrosApi, type RegistrosApi } from "./registros";

const Ctx = createContext<RegistrosApi | null>(null);
const CapaCtx = createContext<CapaApi | null>(null);
const FichasCtx = createContext<FichasApi | null>(null);
const ConfigCtx = createContext<ConfigCampanhaApi | null>(null);
/** Configurações da campanha (moedas). null: sem sessão ou sem Supabase. */
export const useConfigCampanha = () => useContext(ConfigCtx);
/** Avisa as telas abertas de que as moedas da campanha mudaram. */
export const EVENTO_MOEDAS = "compendio:moedas";
/** Moedas em uso na campanha (as cinco enquanto não houver configuração, suporte no banco ou resposta). */
export function useMoedasDaCampanha(campaignId: string | null | undefined): { ativas: ChaveMoeda[]; suportado: boolean; pronto: boolean } {
  const api = useConfigCampanha();
  const [estado, setEstado] = useState<{ ativas: ChaveMoeda[]; suportado: boolean; pronto: boolean }>({ ativas: lerMoedasAtivas(null), suportado: false, pronto: false });
  const [versao, setVersao] = useState(0);
  useEffect(() => { const mudou = () => setVersao(v => v + 1); window.addEventListener(EVENTO_MOEDAS, mudou); return () => window.removeEventListener(EVENTO_MOEDAS, mudou); }, []);
  useEffect(() => {
    if (!api || !campaignId) { setEstado({ ativas: lerMoedasAtivas(null), suportado: false, pronto: true }); return; }
    let vivo = true;
    void api.moedas(campaignId).then(r => { if (vivo) setEstado(r.ok ? { ...r.data, pronto: true } : { ativas: lerMoedasAtivas(null), suportado: false, pronto: true }); });
    return () => { vivo = false; };
  }, [api, campaignId, versao]);
  return estado;
}
/** Fichas privadas dos personagens guiados no Supabase. null: sem sessão/Supabase (ou demonstração): o criador usa o armazenamento local EXPERIMENTAL. */
export const useFichas = () => useContext(FichasCtx);
/** API da capa da campanha. null: sem sessão ou sem Supabase. */
export const useCapa = () => useContext(CapaCtx);
/** API de registros (Diário, Planejamento). null: sem sessão ou sem Supabase. */
export const useRegistros = () => useContext(Ctx);

/** `api` existe para testes e para o modo de demonstração local (dev). Em produção usa o cliente da sessão. */
export function RegistrosProvider({ children, api, capa, fichas, config }: { children: ReactNode; api?: RegistrosApi | null; capa?: CapaApi | null; fichas?: FichasApi | null; config?: ConfigCampanhaApi | null }) {
  const { client, status } = useAuth();
  const real = useMemo(() => status === "authenticated" && client ? createRegistrosApi(client) : null, [client, status]);
  const realCapa = useMemo(() => status === "authenticated" && client ? createCapaApi(client) : null, [client, status]);
  const realFichas = useMemo(() => status === "authenticated" && client ? createFichasApi(client) : null, [client, status]);
  // `api` explícita (testes/demonstração) sem `fichas` explícitas: não cria cliente real; o criador cai no armazenamento local experimental.
  const valorFichas = fichas !== undefined ? fichas : api !== undefined ? null : realFichas;
  const realConfig = useMemo(() => status === "authenticated" && client ? createConfigCampanhaApi(client) : null, [client, status]);
  const valorConfig = config !== undefined ? config : api !== undefined ? null : realConfig;
  return <Ctx.Provider value={api === undefined ? real : api}><CapaCtx.Provider value={capa === undefined ? realCapa : capa}><FichasCtx.Provider value={valorFichas}><ConfigCtx.Provider value={valorConfig}>{children}</ConfigCtx.Provider></FichasCtx.Provider></CapaCtx.Provider></Ctx.Provider>;
}

// Configurações da campanha que não fazem parte da lista de campanhas. Hoje: moedas em uso (`campaigns.enabled_coins`, migração 0013).
// Quem participa lê; só o mestre grava (RLS de `campaigns`). Sem a migração, valem as cinco moedas e a escolha fica indisponível.
import type { SupabaseClient } from "@supabase/supabase-js";
import { erroCampanha, type Res } from "./campaigns";
import { lerMoedasAtivas, type ChaveMoeda } from "./moedas/moedas";

export type ConfigCampanhaApi = {
  moedas: (campaignId: string) => Promise<Res<{ suportado: boolean; ativas: ChaveMoeda[] }>>;
  salvarMoedas: (campaignId: string, ativas: readonly ChaveMoeda[]) => Promise<Res<ChaveMoeda[]>>;
};

export const ERRO_SEM_MOEDA = "A campanha precisa de pelo menos uma moeda.";
const semColuna = (e: unknown) => { const x = e as { code?: string; message?: string } | null; return !!x && (x.code === "42703" || x.code === "PGRST204" || /enabled_coins/.test(x.message ?? "")); };

export function createConfigCampanhaApi(client: SupabaseClient): ConfigCampanhaApi {
  return {
    moedas: async campaignId => {
      try {
        const r = await client.from("campaigns").select("enabled_coins").eq("id", campaignId).maybeSingle();
        if (r.error) return semColuna(r.error) ? { ok: true, data: { suportado: false, ativas: lerMoedasAtivas(null) } } : { ok: false, error: erroCampanha(r.error) };
        return { ok: true, data: { suportado: true, ativas: lerMoedasAtivas((r.data as { enabled_coins?: unknown } | null)?.enabled_coins) } };
      } catch (e) { return { ok: false, error: erroCampanha(e) }; }
    },
    salvarMoedas: async (campaignId, ativas) => {
      if (!ativas.length) return { ok: false, error: ERRO_SEM_MOEDA };
      try {
        const lista = lerMoedasAtivas([...ativas]);
        const r = await client.from("campaigns").update({ enabled_coins: lista }).eq("id", campaignId).select("id");
        if (r.error) return { ok: false, error: erroCampanha(r.error) };
        return r.data?.length ? { ok: true, data: lista } : { ok: false, error: "Apenas o mestre pode fazer isso." };
      } catch (e) { return { ok: false, error: erroCampanha(e) }; }
    },
  };
}

/** Versão em memória (testes e demonstração local). `podeGravar` imita a regra do banco: só o mestre grava. */
export function configCampanhaEmMemoria(banco: Map<string, ChaveMoeda[]> = new Map(), podeGravar: (campaignId: string) => boolean = () => true): ConfigCampanhaApi {
  return {
    moedas: async id => ({ ok: true, data: { suportado: true, ativas: lerMoedasAtivas(banco.get(id)) } }),
    salvarMoedas: async (id, ativas) => {
      if (!ativas.length) return { ok: false, error: ERRO_SEM_MOEDA };
      if (!podeGravar(id)) return { ok: false, error: "Apenas o mestre pode fazer isso." };
      const lista = lerMoedasAtivas([...ativas]); banco.set(id, lista); return { ok: true, data: lista };
    },
  };
}

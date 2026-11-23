// Contrato comum das linhas remotas versionadas (combate ativo e encontros preparados) e adaptação do adaptador de combate já existente.
import type { SupabaseClient } from "@supabase/supabase-js";
import type { EstadoCombate } from "./combate";
import { criarApiCombate } from "./combateRemoto";

export type LinhaRemota<T> = { valor: T; versao: number };
export type ResultadoLinha<T> = { ok: true; data: LinhaRemota<T> } | { ok: false; tipo: "conflito" | "permissao" | "indisponivel" | "invalido"; mensagem: string };
export type ApiLinha<T> = {
  carregar(campaignId: string): Promise<ResultadoLinha<T>>;
  /** Versão 0 cria; maior atualiza só se ninguém gravou depois. Resposta sem linha nunca é sucesso. */
  salvar(campaignId: string, valor: T, versaoEsperada: number): Promise<ResultadoLinha<T>>;
  /** Só o combate ativo tem finalização (DELETE condicionado à versão). */
  finalizar?(campaignId: string, versaoEsperada: number): Promise<{ ok: true } | { ok: false; tipo: "conflito" | "permissao" | "indisponivel" | "invalido"; mensagem: string }>;
};

/** Adapta `criarApiCombate` (estado + versão) ao contrato genérico (valor + versão). */
export function criarApiLinhaCombate(client: SupabaseClient): ApiLinha<EstadoCombate> {
  const api = criarApiCombate(client);
  const adaptar = (r: Awaited<ReturnType<typeof api.carregar>>): ResultadoLinha<EstadoCombate> => r.ok ? { ok: true, data: { valor: r.data.estado, versao: r.data.versao } } : r;
  return { carregar: async id => adaptar(await api.carregar(id)), salvar: async (id, v, ver) => adaptar(await api.salvar(id, v, ver)), finalizar: (id, ver) => api.finalizar(id, ver) };
}

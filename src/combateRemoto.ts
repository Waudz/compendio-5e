import type { SupabaseClient } from "@supabase/supabase-js";
import { combateVazio, lerCombate, type EstadoCombate } from "./combate";

/** API preparada para a tabela futura campaign_combats. Não substitui o armazenamento local
 * antes de a migração, a RLS e os testes de isolamento estarem aprovados. */
export type CombateRemoto = { estado: EstadoCombate; versao: number };
export type ResultadoCombate =
  | { ok: true; data: CombateRemoto }
  | { ok: false; tipo: "conflito" | "permissao" | "indisponivel" | "invalido"; mensagem: string };

const falha = (tipo: "conflito" | "permissao" | "indisponivel" | "invalido", mensagem: string): ResultadoCombate =>
  ({ ok: false, tipo, mensagem });
const erro = (e: { code?: string; message?: string } | null): ResultadoCombate => {
  if (e?.code === "42501" || /permission denied|row-level security/i.test(e?.message ?? ""))
    return falha("permissao", "Apenas o mestre desta campanha pode acessar o combate.");
  return falha("indisponivel", "Não foi possível acessar o combate no servidor. Tente novamente.");
};

function validarResposta(data: { state: unknown; version: unknown }, esperada?: number): CombateRemoto {
  if (typeof data.version !== "number" || !Number.isSafeInteger(data.version) || data.version < 1 || (esperada !== undefined && data.version !== esperada))
    throw new Error("Versão de confirmação inválida");
  return { estado: validarEstado(data.state), versao: data.version };
}

function validarEstado(valor: unknown): EstadoCombate {
  return lerCombate(JSON.stringify(valor));
}

/** A linha é identificada pela campanha. A RLS do servidor é obrigatória; o cliente não autoriza ninguém. */
export function criarApiCombate(client: SupabaseClient) {
  return {
    async carregar(campaignId: string): Promise<ResultadoCombate> {
      try {
        const { data, error: e } = await client.from("campaign_combats")
          .select("state,version").eq("campaign_id", campaignId).maybeSingle();
        if (e) return erro(e);
        if (!data) return { ok: true, data: { estado: combateVazio(), versao: 0 } };
        if (!Number.isSafeInteger(data.version) || data.version < 1)
          return falha("invalido", "Versão do combate inválida no servidor.");
        return { ok: true, data: validarResposta(data) };
      } catch {
        return falha("invalido", "O servidor retornou um estado de combate inválido.");
      }
    },
    /** Controle de concorrência: versão 0 cria, versões maiores atualizam apenas se não houve outra gravação.
     * Uma resposta sem linha NÃO é sucesso (RLS negada ou alteração concorrente). */
    async salvar(campaignId: string, estado: EstadoCombate, versaoEsperada: number): Promise<ResultadoCombate> {
      if (!Number.isSafeInteger(versaoEsperada) || versaoEsperada < 0 || versaoEsperada >= Number.MAX_SAFE_INTEGER)
        return falha("invalido", "Versão esperada inválida.");
      let seguro: EstadoCombate;
      try { seguro = validarEstado(estado); }
      catch { return falha("invalido", "O estado de combate não passou na validação."); }
      try {
        if (versaoEsperada === 0) {
          const { data, error: e } = await client.from("campaign_combats")
            .insert({ campaign_id: campaignId, state: seguro, version: 1 })
            .select("state,version").maybeSingle();
          if (e?.code === "23505") return falha("conflito", "O combate foi criado em outra sessão. Recarregue.");
          if (e) return erro(e);
          if (!data) return falha("permissao", "O servidor não confirmou a gravação.");
          return { ok: true, data: validarResposta(data, 1) };
        }
        const { data, error: e } = await client.from("campaign_combats")
          .update({ state: seguro, version: versaoEsperada + 1 })
          .eq("campaign_id", campaignId).eq("version", versaoEsperada)
          .select("state,version").maybeSingle();
        if (e) return erro(e);
        if (!data) return falha("conflito", "O combate mudou em outra sessão ou você perdeu o acesso. Recarregue antes de salvar.");
        return { ok: true, data: validarResposta(data, versaoEsperada + 1) };
      } catch {
        return falha("indisponivel", "Não foi possível confirmar a gravação no servidor.");
      }
    },
  };
}

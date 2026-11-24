import type { SupabaseClient } from "@supabase/supabase-js";
import { lerEncontros, type Encontro } from "./combate";
import type { ApiLinha, ResultadoLinha } from "./linhaRemota";

/** Adaptador da tabela `campaign_encounters` (migração 0010, ainda não aplicada ao banco hospedado). Uma linha por campanha; a RLS do servidor (somente o mestre)
 * é a autoridade — o cliente não autoriza ninguém. Mesmo contrato de versão otimista do combate: zero linhas alteradas NÃO é sucesso. */
const falha = (tipo: "conflito" | "permissao" | "indisponivel" | "invalido", mensagem: string): ResultadoLinha<Encontro[]> => ({ ok: false, tipo, mensagem });
const erro = (e: { code?: string; message?: string }): ResultadoLinha<Encontro[]> =>
  e.code === "42501" || /permission denied|row-level security/i.test(e.message ?? "")
    ? falha("permissao", "Apenas o mestre desta campanha pode acessar os encontros.") : falha("indisponivel", "Não foi possível acessar os encontros no servidor. Tente novamente.");
function validar(linha: { state: unknown; version: unknown }, esperada?: number): { valor: Encontro[]; versao: number } {
  if (typeof linha.version !== "number" || !Number.isSafeInteger(linha.version) || linha.version < 1 || (esperada !== undefined && linha.version !== esperada)) throw new Error("versão inválida");
  const s = linha.state as { encontros?: unknown } | null;
  return { valor: lerEncontros(JSON.stringify(s?.encontros)), versao: linha.version };
}

export function criarApiEncontros(client: SupabaseClient): ApiLinha<Encontro[]> {
  return {
    async carregar(campaignId) {
      try {
        const { data, error: e } = await client.from("campaign_encounters").select("state,version").eq("campaign_id", campaignId).maybeSingle();
        if (e) return erro(e);
        if (!data) return { ok: true, data: { valor: [], versao: 0 } };
        try { return { ok: true, data: validar(data) }; } catch { return falha("invalido", "O servidor retornou encontros inválidos."); }
      } catch { return falha("indisponivel", "Não foi possível carregar os encontros no servidor. Tente novamente."); }
    },
    async salvar(campaignId, valor, versaoEsperada) {
      if (!Number.isSafeInteger(versaoEsperada) || versaoEsperada < 0 || versaoEsperada >= Number.MAX_SAFE_INTEGER) return falha("invalido", "Versão esperada inválida.");
      let seguro: Encontro[];
      try { seguro = lerEncontros(JSON.stringify(valor)); } catch { return falha("invalido", "Os encontros não passaram na validação."); }
      const state = { encontros: seguro };
      try {
        if (versaoEsperada === 0) {
          const { data, error: e } = await client.from("campaign_encounters").insert({ campaign_id: campaignId, state, version: 1 }).select("state,version").maybeSingle();
          if (e?.code === "23505") return falha("conflito", "Os encontros foram criados em outra sessão. Recarregue.");
          if (e) return erro(e);
          if (!data) return falha("permissao", "O servidor não confirmou a gravação.");
          return { ok: true, data: validar(data, 1) };
        }
        const { data, error: e } = await client.from("campaign_encounters").update({ state, version: versaoEsperada + 1 }).eq("campaign_id", campaignId).eq("version", versaoEsperada).select("state,version").maybeSingle();
        if (e) return erro(e);
        if (!data) return falha("conflito", "Os encontros mudaram em outra sessão ou você perdeu o acesso. Recarregue antes de salvar.");
        return { ok: true, data: validar(data, versaoEsperada + 1) };
      } catch { return falha("indisponivel", "Não foi possível confirmar a gravação no servidor."); }
    },
  };
}

// Sincronização AUTORIZADA de PV e condições do combate com a ficha (migração 0011, ainda não aplicada ao banco hospedado).
// O mestre grava só pelas funções `set_combat_status`/`clear_combat_status` (a autorização é conferida no banco); o dono lê apenas o status da própria ficha.
// Nada do combate (ordem, turno, rodada, outros combatentes) trafega por aqui.
import type { SupabaseClient } from "@supabase/supabase-js";
import type { EstadoCombate } from "./combate";

export type StatusFicha = { characterId: string; hp: number | null; max: number | null; condicoes: string[]; versao: number; atualizadoEm?: string };
export type ResultadoStatus = { ok: true } | { ok: false; mensagem: string };
export type ApiStatus = {
  /** Mestre: grava PV e condições da ficha. */
  definir(characterId: string, hp: number | null, max: number | null, condicoes: readonly string[]): Promise<ResultadoStatus>;
  /** Mestre: limpa os status da campanha (ao finalizar o combate). */
  limpar(campaignId: string): Promise<ResultadoStatus>;
  /** Dono (ou mestre): lê o status da ficha; `null` se não houver. */
  ler(characterId: string): Promise<{ ok: true; status: StatusFicha | null } | { ok: false; mensagem: string }>;
  /** Tempo real: chama `aoMudar` quando o status da ficha muda. Devolve a função que cancela. */
  assinar(characterId: string, aoMudar: () => void): () => void;
};

const msg = (e: { code?: string; message?: string }) => e.code === "42501" || /apenas_mestre|permission denied/i.test(e.message ?? "") ? "Apenas o mestre da campanha pode atualizar a ficha." : "Não foi possível sincronizar com a ficha. Tente novamente.";

export function criarApiStatus(client: SupabaseClient): ApiStatus {
  return {
    async definir(characterId, hp, max, condicoes) {
      try { const { error } = await client.rpc("set_combat_status", { p_character_id: characterId, p_current_hp: hp, p_max_hp: max, p_conditions: condicoes }); return error ? { ok: false, mensagem: msg(error) } : { ok: true }; }
      catch { return { ok: false, mensagem: "Sem conexão para sincronizar com a ficha." }; }
    },
    async limpar(campaignId) {
      try { const { error } = await client.rpc("clear_combat_status", { p_campaign_id: campaignId }); return error ? { ok: false, mensagem: msg(error) } : { ok: true }; }
      catch { return { ok: false, mensagem: "Sem conexão para limpar o estado das fichas." }; }
    },
    async ler(characterId) {
      try {
        const { data, error } = await client.from("character_combat_status").select("character_id,current_hp,max_hp,conditions,version,updated_at").eq("character_id", characterId).maybeSingle();
        if (error) return { ok: false, mensagem: "Não foi possível ler o estado em combate." };
        if (!data) return { ok: true, status: null };
        const cond = Array.isArray(data.conditions) ? data.conditions.filter((c: unknown): c is string => typeof c === "string") : [];
        return { ok: true, status: { characterId, hp: data.current_hp ?? null, max: data.max_hp ?? null, condicoes: cond, versao: Number(data.version), atualizadoEm: data.updated_at } };
      } catch { return { ok: false, mensagem: "Sem conexão para ler o estado em combate." }; }
    },
    assinar(characterId, aoMudar) {
      try {
        const canal = client.channel(`status-${characterId}`).on("postgres_changes", { event: "*", schema: "public", table: "character_combat_status", filter: `character_id=eq.${characterId}` }, aoMudar).subscribe();
        return () => { void client.removeChannel(canal); };
      } catch { return () => {}; }
    },
  };
}

/** O que a ficha de um personagem deve mostrar a partir do combate: só PV e condições dele (ou `null` se ele não está no combate). */
export function statusDoCombatente(e: EstadoCombate, characterId: string): { hp: number | null; max: number | null; condicoes: string[] } | null {
  const c = e.combatentes.find(x => x.ref?.tipo === "personagem" && x.ref.id === characterId);
  return c ? { hp: c.pvMax ? (c.pv ?? c.pvMax) : null, max: c.pvMax ?? null, condicoes: c.condicoes ?? [] } : null;
}
export const idsDePersonagens = (e: EstadoCombate) => [...new Set(e.combatentes.flatMap(c => (c.ref?.tipo === "personagem" ? [c.ref.id] : [])))];

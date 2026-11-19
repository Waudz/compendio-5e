import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createCampaignApi, erroCampanha, normalizeCode, validateCampaign, validateCode } from "./campaigns";

/** Cliente falso com encadeamento no estilo PostgREST. Registra as chamadas. */
function fake(result: { data?: unknown; error?: unknown } = { data: [], error: null }) {
  const calls: [string, ...unknown[]][] = [];
  const chain: Record<string, unknown> = {};
  for (const m of ["select", "eq", "gt", "order", "update", "delete"]) chain[m] = (...a: unknown[]) => { calls.push([m, ...a]); return chain; };
  chain.then = (res: (v: unknown) => unknown) => res({ data: result.data ?? null, error: result.error ?? null });
  const client = { from: vi.fn((t: string) => { calls.push(["from", t]); return chain; }), rpc: vi.fn(async (fn: string, args: unknown) => { calls.push(["rpc", fn, args]); return { data: result.data ?? null, error: result.error ?? null }; }) };
  return { client: client as unknown as SupabaseClient, calls };
}

describe("validações e mensagens", () => {
  it("valida nome, descrição e código", () => {
    expect(validateCampaign("", "")).toMatch(/nome/); expect(validateCampaign("x".repeat(81), "")).toMatch(/80/);
    expect(validateCampaign("ok", "d".repeat(1001))).toMatch(/1000/); expect(validateCampaign(" ok ", "")).toBeNull();
    expect(validateCode("abc")).not.toBeNull(); expect(validateCode("abcd-efgh ijkl")).toBeNull();
    expect(normalizeCode(" abcd-efgh ijkl ")).toBe("ABCDEFGHIJKL");
  });
  it.each([["convite_invalido", /Convite inválido/], ["sem_permissao", /mestre/], ["ultimo_mestre", /não pode sair/], ["mestre_unico", /único mestre/], ["limite_campanhas", /limite/], ["TypeError: Failed to fetch", /Sem conexão/], ["algo interno: relation x", /Não foi possível/]])(
    "traduz %s", (m, re) => { const t = erroCampanha({ message: m }); expect(t).toMatch(re); expect(t).not.toMatch(/relation/); });
});

describe("createCampaignApi", () => {
  it("lista só as campanhas do usuário, ordenadas, ignorando linhas sem campanha", async () => {
    const f = fake({ data: [
      { role: "jogador", campaigns: { id: "2", name: "Zeta", description: "", created_at: "" } },
      { role: "mestre", campaigns: { id: "1", name: "Alfa", description: "", created_at: "" } },
      { role: "jogador", campaigns: null }] });
    const r = await createCampaignApi(f.client, "u1").list();
    expect(r.ok && r.data.map(m => [m.campaign.name, m.role])).toEqual([["Alfa", "mestre"], ["Zeta", "jogador"]]);
    expect(f.calls).toContainEqual(["eq", "user_id", "u1"]);
  });
  it("criar, entrar e criar convite usam as funções do servidor", async () => {
    const f = fake({ data: "abc" }); const api = createCampaignApi(f.client, "u1");
    expect(await api.create("Nome", "Desc")).toEqual({ ok: true, data: "abc" });
    await api.join("abcd-efgh-ijkl"); await api.createInvite("c1", 3, 2);
    expect(f.calls).toContainEqual(["rpc", "create_campaign", { p_name: "Nome", p_description: "Desc" }]);
    expect(f.calls).toContainEqual(["rpc", "join_campaign", { p_code: "ABCDEFGHIJKL" }]);
    expect(f.calls).toContainEqual(["rpc", "create_invite", { p_campaign_id: "c1", p_max_uses: 3, p_days: 2 }]);
  });
  it("erro do servidor vira mensagem amigável", async () => {
    const f = fake({ error: { message: "convite_invalido" } });
    expect(await createCampaignApi(f.client, "u1").join("AAAAAAAAAAAA")).toEqual({ ok: false, error: expect.stringMatching(/Convite inválido/) });
  });
  it("sem permissão (RLS devolve 0 linhas) é tratado como erro, não como sucesso", async () => {
    const f = fake({ data: [] }); const api = createCampaignApi(f.client, "u1");
    for (const r of [await api.update("c1", "x", ""), await api.remove("c1"), await api.removeMember("c1", "u2"), await api.revokeInvite("i1")])
      expect(r).toEqual({ ok: false, error: expect.stringMatching(/mestre/) });
  });
  it("rede caindo não lança", async () => {
    const client = { from: () => { throw new TypeError("Failed to fetch"); }, rpc: async () => { throw new TypeError("Failed to fetch"); } } as unknown as SupabaseClient;
    const api = createCampaignApi(client, "u1");
    expect(await api.list()).toEqual({ ok: false, error: expect.stringMatching(/Sem conexão/) });
    expect(await api.createInvite("c")).toEqual({ ok: false, error: expect.stringMatching(/Sem conexão/) });
  });
  it("lista participantes com mestres primeiro e nome padrão", async () => {
    const f = fake({ data: [
      { user_id: "b", role: "jogador", joined_at: "", profiles: { display_name: "Bia" } },
      { user_id: "a", role: "mestre", joined_at: "", profiles: null }] });
    const r = await createCampaignApi(f.client, "u1").members("c1");
    expect(r.ok && r.data.map(m => [m.user_id, m.display_name])).toEqual([["a", "Participante"], ["b", "Bia"]]);
  });
});

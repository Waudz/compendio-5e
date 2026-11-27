import {describe, expect, it, vi} from "vitest";
import type {SupabaseClient} from "@supabase/supabase-js";
import {createProfileApi} from "./profiles";
function fixture(data: unknown = {display_name: "Ana"}, error: unknown = null) {
  const query = {select: vi.fn(() => query), eq: vi.fn(() => query), update: vi.fn(() => query), single: vi.fn(async () => ({data, error}))};
  const from = vi.fn(() => query);
  return {query, from, api: createProfileApi({from} as unknown as SupabaseClient, "own-id")};
}
describe("perfil da conta", () => {
  it("lê e altera apenas display_name do usuário autenticado", async () => {
    const f = fixture(); expect(await f.api.load()).toEqual({ok:true, data:"Ana"});
    expect(await f.api.save(" Ana ")).toEqual({ok:true, data:"Ana"});
    expect(f.from).toHaveBeenCalledWith("profiles");
    expect(f.query.eq).toHaveBeenLastCalledWith("id", "own-id");
    expect(f.query.update).toHaveBeenCalledWith({display_name:"Ana"});
  });
  it.each(["  ", "a".repeat(61)])("recusa nome inválido antes da rede", async name => {
    const f = fixture(); expect((await f.api.save(name)).ok).toBe(false); expect(f.from).not.toHaveBeenCalled();
  });
  it("não simula sucesso quando a RLS não devolve linha atualizada", async () => {
    const f = fixture(null); expect((await f.api.save("Ana")).ok).toBe(false);
  });
  it("traduz recusa de permissão e rede", async () => {
    const f = fixture(null, {code:"42501"}); expect(await f.api.save("Ana")).toMatchObject({ok:false, error:expect.stringMatching(/permissão/)});
    f.query.single.mockRejectedValueOnce(new TypeError("Failed to fetch"));
    expect(await f.api.load()).toMatchObject({ok:false, error:expect.stringMatching(/Sem conexão/)});
  });
});

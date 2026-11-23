import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { criarApiCombate } from "./combateRemoto";
import { combateVazio } from "./combate";

function servidor(resposta: unknown, rejeitar = false) {
  const query = { select: vi.fn(), eq: vi.fn(), insert: vi.fn(), update: vi.fn(), maybeSingle: vi.fn() };
  for (const metodo of [query.select, query.eq, query.insert, query.update]) metodo.mockReturnValue(query);
  if (rejeitar) query.maybeSingle.mockRejectedValue(new Error("rede"));
  else query.maybeSingle.mockResolvedValue(resposta);
  const from = vi.fn(() => query);
  return { api: criarApiCombate({ from } as unknown as SupabaseClient), from, query };
}
const linha = (version: unknown = 1) => ({ data: { state: combateVazio(), version }, error: null });

describe("adaptador remoto de combate (sem conexão com produção)", () => {
  it("carrega pela campanha e diferencia ausência de falha", async () => {
    const s = servidor({ data: null, error: null });
    expect(await s.api.carregar("campanha-a")).toEqual({ ok: true, data: { estado: combateVazio(), versao: 0 } });
    expect(s.from).toHaveBeenCalledWith("campaign_combats");
    expect(s.query.eq).toHaveBeenCalledWith("campaign_id", "campanha-a");
    const negado = servidor({ data: null, error: { code: "42501" } });
    expect(await negado.api.carregar("a")).toMatchObject({ ok: false, tipo: "permissao" });
  });
  it("cria na versão 1 e trata corrida entre criações como conflito", async () => {
    const s = servidor(linha());
    expect(await s.api.salvar("a", combateVazio(), 0)).toMatchObject({ ok: true, data: { versao: 1 } });
    expect(s.query.insert).toHaveBeenCalledWith({ campaign_id: "a", state: combateVazio(), version: 1 });
    expect(await servidor({ data: null, error: { code: "23505" } }).api.salvar("a", combateVazio(), 0)).toMatchObject({ ok: false, tipo: "conflito" });
  });
  it("atualiza somente a campanha e versão esperadas", async () => {
    const s = servidor(linha(8));
    expect(await s.api.salvar("a", combateVazio(), 7)).toMatchObject({ ok: true, data: { versao: 8 } });
    expect(s.query.update).toHaveBeenCalledWith({ state: combateVazio(), version: 8 });
    expect(s.query.eq.mock.calls).toEqual([["campaign_id", "a"], ["version", 7]]);
  });
  it("nenhuma linha confirmada nunca é sucesso", async () => {
    const s = servidor({ data: null, error: null });
    expect(await s.api.salvar("a", combateVazio(), 0)).toMatchObject({ ok: false, tipo: "permissao" });
    expect(await s.api.salvar("a", combateVazio(), 1)).toMatchObject({ ok: false, tipo: "conflito" });
  });
  it.each([0, -1, 1.5, "1", null, Number.MAX_SAFE_INTEGER + 1])("rejeita versão inválida recebida: %s", async version => {
    const s = servidor(linha(version));
    expect(await s.api.carregar("a")).toMatchObject({ ok: false, tipo: "invalido" });
    expect(await s.api.salvar("a", combateVazio(), 0)).toMatchObject({ ok: false });
  });
  it("não confirma versão diferente da gravação", async () => {
    expect(await servidor(linha(1)).api.salvar("a", combateVazio(), 7)).toMatchObject({ ok: false });
  });
  it.each([-1, 1.5, NaN, Infinity, Number.MAX_SAFE_INTEGER])("rejeita versão de escrita inválida antes de chamar servidor: %s", async versao => {
    const s = servidor(linha());
    expect(await s.api.salvar("a", combateVazio(), versao)).toMatchObject({ ok: false, tipo: "invalido" });
    expect(s.from).not.toHaveBeenCalled();
  });
  it("rejeita estado corrompido e falha de rede sem confirmar escrita", async () => {
    const s = servidor(linha());
    expect(await s.api.salvar("a", { ...combateVazio(), rodada: NaN }, 0)).toMatchObject({ ok: false, tipo: "invalido" });
    expect(s.from).not.toHaveBeenCalled();
    expect(await servidor(null, true).api.salvar("a", combateVazio(), 0)).toMatchObject({ ok: false, tipo: "indisponivel" });
  });
});

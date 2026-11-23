// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import type { ApiLinha, ResultadoLinha } from "./linhaRemota";
import { useLinhaRemota } from "./useLinhaRemota";

type Est = { itens: string[] };
/** Servidor falso em memória: versão otimista, falhas injetáveis e "outro aparelho" que grava por fora. */
function servidor(inicial?: Est) {
  const s = { linha: inicial ? { valor: inicial, versao: 1 } : null as { valor: Est; versao: number } | null, chamadas: [] as { versaoEsperada: number; valor: Est }[], falhas: 0, negar: false, finalizados: 0 };
  const api: ApiLinha<Est> = {
    async carregar() { return { ok: true, data: s.linha ?? { valor: { itens: [] }, versao: 0 } }; },
    async salvar(_id, valor, versaoEsperada): Promise<ResultadoLinha<Est>> {
      s.chamadas.push({ versaoEsperada, valor });
      if (s.negar) return { ok: false, tipo: "permissao", mensagem: "Apenas o mestre." };
      if (s.falhas > 0) { s.falhas--; return { ok: false, tipo: "indisponivel", mensagem: "Sem conexão." }; }
      if ((s.linha?.versao ?? 0) !== versaoEsperada) return { ok: false, tipo: "conflito", mensagem: "Mudou em outra sessão." };
      s.linha = { valor, versao: versaoEsperada + 1 };
      return { ok: true, data: s.linha };
    },
    async finalizar(_id, versaoEsperada) {
      if (s.linha?.versao !== versaoEsperada) return { ok: false, tipo: "conflito", mensagem: "Mudou." };
      s.linha = null; s.finalizados++; return { ok: true };
    },
  };
  return { s, api };
}
const montar = (api: ApiLinha<Est>, campanha = "c1", atrasoBase = 5) => renderHook(({ c }) => useLinhaRemota<Est>({ api, campaignId: c, vazio: () => ({ itens: [] }), chaveBackup: `teste:${c}`, atrasoBase }), { initialProps: { c: campanha } });
const valorDe = (r: ReturnType<typeof montar>) => (r.result.current.carga.status === "pronto" ? r.result.current.carga.valor.itens : null);

beforeEach(() => localStorage.clear());
afterEach(cleanup);

describe("useLinhaRemota", () => {
  it("carrega o que está no servidor e começa 'salvo'; sem linha, começa vazio na versão 0", async () => {
    const { api } = servidor({ itens: ["a"] }); const r = montar(api);
    expect(r.result.current.carga.status).toBe("carregando");
    await waitFor(() => expect(valorDe(r)).toEqual(["a"])); expect(r.result.current.sync).toBe("salvo");
    const vazio = montar(servidor().api); await waitFor(() => expect(valorDe(vazio)).toEqual([]));
  });
  it("salva automaticamente, uma gravação por vez e em ordem, sem pular versões", async () => {
    const { s, api } = servidor(); const r = montar(api); await waitFor(() => expect(valorDe(r)).toEqual([]));
    act(() => { r.result.current.alterar(e => ({ itens: [...e.itens, "1"] })); r.result.current.alterar(e => ({ itens: [...e.itens, "2"] })); r.result.current.alterar(e => ({ itens: [...e.itens, "3"] })); });
    expect(valorDe(r)).toEqual(["1", "2", "3"]);   // a tela já mostra tudo
    await waitFor(() => expect(r.result.current.sync).toBe("salvo"));
    expect(s.linha?.valor.itens).toEqual(["1", "2", "3"]);
    expect(s.chamadas.map(c => c.versaoEsperada)).toEqual(s.chamadas.map((_, i) => i));   // 0,1,2…: nunca duas gravações com a mesma base
  });
  it("falha de rede mantém a alteração, mostra 'falha' e tenta de novo sozinho até gravar", async () => {
    const { s, api } = servidor(); const r = montar(api, "c1", 200); await waitFor(() => expect(valorDe(r)).toEqual([]));
    s.falhas = 2;
    act(() => { r.result.current.alterar(() => ({ itens: ["x"] })); });
    await waitFor(() => expect(r.result.current.sync).toBe("falha")); expect(valorDe(r)).toEqual(["x"]); expect(r.result.current.mensagem).toBe("Sem conexão.");
    await waitFor(() => expect(r.result.current.sync).toBe("salvo")); expect(s.linha?.valor.itens).toEqual(["x"]);
  });
  it("conflito: outro aparelho gravou antes. Nada é sobrescrito, a alteração local vai para backup, edições novas são recusadas e 'recarregar' traz o servidor", async () => {
    const { s, api } = servidor({ itens: ["a"] }); const r = montar(api); await waitFor(() => expect(valorDe(r)).toEqual(["a"]));
    s.linha = { valor: { itens: ["a", "do-outro-aparelho"] }, versao: 2 };
    act(() => { r.result.current.alterar(e => ({ itens: [...e.itens, "meu"] })); });
    await waitFor(() => expect(r.result.current.sync).toBe("conflito"));
    expect(s.linha.valor.itens).toEqual(["a", "do-outro-aparelho"]);   // servidor intacto
    expect(JSON.parse(localStorage.getItem("teste:c1:nao-sincronizado")!).valor.itens).toEqual(["a", "meu"]);
    let aceita = true; act(() => { aceita = r.result.current.alterar(() => ({ itens: ["z"] })); }); expect(aceita).toBe(false);
    await act(async () => { await r.result.current.recarregar(); });
    await waitFor(() => expect(valorDe(r)).toEqual(["a", "do-outro-aparelho"])); expect(r.result.current.sync).toBe("salvo");
  });
  it("sem permissão para de gravar e avisa; o conteúdo digitado fica guardado em backup local", async () => {
    const { s, api } = servidor(); const r = montar(api); await waitFor(() => expect(valorDe(r)).toEqual([]));
    s.negar = true; act(() => { r.result.current.alterar(() => ({ itens: ["x"] })); });
    await waitFor(() => expect(r.result.current.sync).toBe("permissao")); expect(localStorage.getItem("teste:c1:nao-sincronizado")).toContain("\"x\"");
  });
  it("finalizar espera as gravações, apaga a linha no servidor e volta ao estado vazio; sem confirmação não finaliza", async () => {
    const { s, api } = servidor({ itens: ["a"] }); const r = montar(api); await waitFor(() => expect(valorDe(r)).toEqual(["a"]));
    act(() => { r.result.current.alterar(e => ({ itens: [...e.itens, "b"] })); });
    let res: Awaited<ReturnType<typeof r.result.current.finalizar>> | undefined;
    await act(async () => { res = await r.result.current.finalizar(); });
    expect(res).toEqual({ ok: true }); expect(s.finalizados).toBe(1); expect(s.linha).toBeNull(); expect(valorDe(r)).toEqual([]);
    // depois de finalizar, um novo combate começa na versão 0 (cria outra linha)
    act(() => { r.result.current.alterar(() => ({ itens: ["novo"] })); }); await waitFor(() => expect(s.linha?.valor.itens).toEqual(["novo"])); expect(s.linha?.versao).toBe(1);
  });
  it("finalizar com a rede fora não descarta nada", async () => {
    const { s, api } = servidor({ itens: ["a"] }); const r = montar(api); await waitFor(() => expect(valorDe(r)).toEqual(["a"]));
    s.falhas = 99; act(() => { r.result.current.alterar(() => ({ itens: ["b"] })); });
    let res: Awaited<ReturnType<typeof r.result.current.finalizar>> | undefined;
    await act(async () => { res = await r.result.current.finalizar(); });
    expect(res?.ok).toBe(false); expect(s.finalizados).toBe(0); expect(valorDe(r)).toEqual(["b"]);
  });
  it("trocar de campanha recarrega do servidor e não mistura o estado", async () => {
    const a = servidor({ itens: ["da-A"] }), b = servidor({ itens: ["da-B"] });
    let atual = a.api; const r = renderHook(({ c }) => useLinhaRemota<Est>({ api: c === "A" ? atual : b.api, campaignId: c, vazio: () => ({ itens: [] }), chaveBackup: null }), { initialProps: { c: "A" } });
    await waitFor(() => expect(r.result.current.carga.status === "pronto" && r.result.current.carga.valor.itens).toEqual(["da-A"]));
    r.rerender({ c: "B" }); void atual;
    await waitFor(() => expect(r.result.current.carga.status === "pronto" && r.result.current.carga.valor.itens).toEqual(["da-B"]));
  });
  it("erro ao carregar mostra a mensagem do servidor", async () => {
    const api: ApiLinha<Est> = { carregar: async () => ({ ok: false, tipo: "permissao", mensagem: "Apenas o mestre." }), salvar: async () => ({ ok: false, tipo: "invalido", mensagem: "x" }) };
    const r = montar(api); await waitFor(() => expect(r.result.current.carga).toEqual({ status: "erro", mensagem: "Apenas o mestre." }));
  });
});

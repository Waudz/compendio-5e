// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
vi.mock("./AuthContext", () => ({ useAuth: () => ({ user: { id: "u1" } }) }));
import { EstadoCombateFicha } from "./EstadoCombateFicha";
import { NuvemContext, type ApisNuvem } from "./nuvem";
import type { ApiStatus, StatusFicha } from "./statusCombate";

afterEach(cleanup);
function nuvem(inicial: StatusFicha | null) {
  const s = { atual: inicial, aoMudar: () => {}, lidas: 0 };
  const status: ApiStatus = { definir: async () => ({ ok: true }), limpar: async () => ({ ok: true }), ler: async () => { s.lidas++; return { ok: true, status: s.atual }; }, assinar: (_id, cb) => { s.aoMudar = cb; return () => {}; } };
  const apis = { combate: { carregar: async () => ({ ok: true, data: { valor: { combatentes: [], turno: null, rodada: 1 }, versao: 0 } }), salvar: async () => ({ ok: false, tipo: "invalido", mensagem: "x" }) },
    encontros: { carregar: async () => ({ ok: true, data: { valor: [], versao: 0 } }), salvar: async () => ({ ok: false, tipo: "invalido", mensagem: "x" }) }, status } as unknown as ApisNuvem;
  return { s, ui: (id = "pj1") => <NuvemContext.Provider value={apis}><EstadoCombateFicha characterId={id}/></NuvemContext.Provider> };
}
describe("Estado em combate na ficha do jogador", () => {
  it("mostra PV e condições informados pelo mestre, e só isso", async () => {
    const { ui } = nuvem({ characterId: "pj1", hp: 7, max: 12, condicoes: ["Envenenado", "Caído"], versao: 3, atualizadoEm: "2026-11-23T12:00:00Z" }); render(ui());
    expect((await screen.findByTestId("pv-combate")).textContent).toBe("7/12"); expect(screen.getByText("Envenenado")).toBeTruthy(); expect(screen.getByText("Caído")).toBeTruthy();
    const texto = screen.getByRole("region", { name: "Estado em combate" }).textContent ?? "";
    for (const proibido of [/rodada/i, /turno/i, /iniciativa/i, /inimigo/i]) expect(texto).not.toMatch(proibido);
  });
  it("não aparece sem status, com status vazio, ou fora do modo nuvem", async () => {
    const a = nuvem(null); render(a.ui()); await waitFor(() => expect(a.s.lidas).toBe(1)); expect(screen.queryByRole("region", { name: "Estado em combate" })).toBeNull(); cleanup();
    const b = nuvem({ characterId: "pj1", hp: null, max: null, condicoes: [], versao: 1 }); render(b.ui()); await waitFor(() => expect(b.s.lidas).toBe(1)); expect(screen.queryByRole("region", { name: "Estado em combate" })).toBeNull(); cleanup();
    render(<EstadoCombateFicha characterId="pj1"/>); expect(screen.queryByRole("region", { name: "Estado em combate" })).toBeNull();
  });
  it("ignora uma leitura antiga que termina depois da atualização", async () => {
    const { s, ui } = nuvem({ characterId: "pj1", hp: 12, max: 12, condicoes: [], versao: 1 });
    render(ui());
    await screen.findByTestId("pv-combate");
    await act(async () => {
      s.atual = { characterId: "pj1", hp: 9, max: 12, condicoes: [], versao: 2 };
      s.aoMudar();
      s.atual = { characterId: "pj1", hp: 3, max: 12, condicoes: [], versao: 3 };
      s.aoMudar();
    });
    await waitFor(() => expect(screen.getByTestId("pv-combate").textContent).toBe("3/12"));
  });
  it("atualiza em tempo real quando o servidor avisa que o status mudou", async () => {
    const { s, ui } = nuvem({ characterId: "pj1", hp: 12, max: 12, condicoes: [], versao: 1 }); render(ui());
    expect((await screen.findByTestId("pv-combate")).textContent).toBe("12/12");
    s.atual = { characterId: "pj1", hp: 3, max: 12, condicoes: ["Atordoado"], versao: 2 }; await act(async () => { s.aoMudar(); });
    await waitFor(() => expect(screen.getByTestId("pv-combate").textContent).toBe("3/12")); expect(screen.getByText("Atordoado")).toBeTruthy();
  });
});

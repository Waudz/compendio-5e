// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { AuthProvider } from "./AuthContext";
import { CampaignsProvider, activeKey, useCampaigns } from "./CampaignsContext";
import type { CampaignApi, Membership, Res } from "./campaigns";
import { fakeAuth, me, memoryStorage } from "./testUtils";

const membership = (id: string): Membership => ({ role: "mestre", campaign: { id, name: `Mesa ${id}`, description: "", created_at: "" } });
function Probe() {
  const c = useCampaigns();
  return <><output data-testid="estado">{JSON.stringify({ loading: c.loading, error: c.error, active: c.active?.campaign.id ?? null, ids: c.memberships.map(m => m.campaign.id) })}</output>
    <button onClick={() => void c.refresh()}>Atualizar</button><button onClick={() => c.setActive("nao-autorizada")}>Forçar campanha</button></>;
}
function montar(list: () => Promise<Res<Membership[]>>) {
  const api = { list } as CampaignApi;
  const factory = () => api;
  render(<AuthProvider client={fakeAuth(me).client}><CampaignsProvider apiFactory={factory}><Probe/></CampaignsProvider></AuthProvider>);
}
const estado = () => JSON.parse(screen.getByTestId("estado").textContent!);
function deferred<T>() { let resolve!: (v: T) => void; const promise = new Promise<T>(r => { resolve = r; }); return { promise, resolve }; }
beforeEach(() => { vi.stubGlobal("localStorage", memoryStorage()); });
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe("campanha ativa: falha e recuperação sem perda de contexto", () => {
  it("exceção inicial encerra loading, preserva preferência e permite repetir", async () => {
    localStorage.setItem(activeKey(me.id), "b");
    const list = vi.fn().mockRejectedValueOnce(new Error("segredo interno de rede")).mockResolvedValue({ ok: true, data: [membership("a"), membership("b")] });
    montar(list);
    await waitFor(() => expect(estado().error).toBeTruthy());
    expect(estado().loading).toBe(false);
    expect(estado().active).toBeNull();
    expect(estado().error).not.toContain("segredo");
    expect(localStorage.getItem(activeKey(me.id))).toBe("b");
    fireEvent.click(screen.getByRole("button", { name: "Atualizar" }));
    await waitFor(() => expect(estado().active).toBe("b"));
    expect(estado().error).toBeNull();
  });
  it("exceção no refresh mantém dados conhecidos e preferência sem tratá-los como lista vazia", async () => {
    localStorage.setItem(activeKey(me.id), "b");
    const list = vi.fn().mockResolvedValueOnce({ ok: true, data: [membership("a"), membership("b")] }).mockRejectedValue(new Error("offline"));
    montar(list); await waitFor(() => expect(estado().active).toBe("b"));
    fireEvent.click(screen.getByRole("button", { name: "Atualizar" }));
    await waitFor(() => expect(estado().error).toBeTruthy());
    expect(estado()).toMatchObject({ loading: false, active: "b", ids: ["a", "b"] });
    expect(localStorage.getItem(activeKey(me.id))).toBe("b");
  });
  it("somente a resposta da requisição mais recente pode atualizar campanhas", async () => {
    const primeira = deferred<Res<Membership[]>>(), segunda = deferred<Res<Membership[]>>();
    const list = vi.fn().mockReturnValueOnce(primeira.promise).mockReturnValueOnce(segunda.promise);
    montar(list); await waitFor(() => expect(list).toHaveBeenCalledTimes(1));
    fireEvent.click(screen.getByRole("button", { name: "Atualizar" }));
    await act(async () => { segunda.resolve({ ok: true, data: [membership("b")] }); });
    await waitFor(() => expect(estado().active).toBe("b"));
    await act(async () => { primeira.resolve({ ok: true, data: [membership("a")] }); });
    expect(estado().ids).toEqual(["b"]);
    expect(localStorage.getItem(activeKey(me.id))).toBe("b");
  });
  it("vínculo removido com resposta válida usa fallback determinístico, nunca ID arbitrário", async () => {
    localStorage.setItem(activeKey(me.id), "revogada");
    montar(async () => ({ ok: true, data: [membership("z"), membership("a")] }));
    await waitFor(() => expect(estado().active).toBe("a"));
    fireEvent.click(screen.getByRole("button", { name: "Forçar campanha" }));
    expect(estado().active).toBe("a");
    expect(localStorage.getItem(activeKey(me.id))).toBe("a");
  });
});

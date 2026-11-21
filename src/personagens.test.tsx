// @vitest-environment jsdom
// Personagens (perfil), Aventureiros no Início com dados reais e distinção entre vazio, erro de banco e falta de conexão.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { ERRO_SCHEMA, erroCampanha, type CampaignApi, type Membership } from "./campaigns";
import { activeKey } from "./CampaignsContext";
import type { CapaApi } from "./capa";
import { lerPerfil, validarPerfil } from "./perfilPersonagem";
import type { Registro, RegistrosApi } from "./registros";
import { registrosEmMemoria } from "./registrosMemoria";
import { me, memoryStorage, other, renderApp } from "./testUtils";

const camp = { id: "ca", name: "Mesa dos Dragões", description: "Desc.", created_at: "" };
const mestre: Membership = { role: "mestre", campaign: camp }, jogador: Membership = { role: "jogador", campaign: camp };
const apiC = (m: Membership) => ({ list: async () => ({ ok: true, data: [m] }) }) as unknown as CampaignApi;
const base = { campaignId: "ca", meta: {}, version: 1, createdAt: "2026-01-01T00:00:00Z", updatedAt: "2026-01-01T00:00:00Z", content: [] };
const pc = (id: string, ownerId: string, title: string, visibility: "private" | "campaign", meta: Record<string, unknown> = { classe: "Guerreiro", nivel: 3 }): Registro => ({ ...base, id, kind: "character", ownerId, title, visibility, meta });

beforeEach(() => {
  vi.stubGlobal("localStorage", memoryStorage());
  vi.stubGlobal("matchMedia", (q: string) => ({ matches: false, media: q, addEventListener() {}, removeEventListener() {} }));
  vi.stubGlobal("ResizeObserver", class { observe() {} unobserve() {} disconnect() {} });
  vi.spyOn(Element.prototype, "getBoundingClientRect").mockImplementation(() => ({ x: 0, y: 0, left: 0, top: 0, right: 800, bottom: 600, width: 800, height: 600, toJSON() {} }) as DOMRect);
  window.history.pushState({}, "", "/"); localStorage.setItem(activeKey(me.id), "ca");
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });
const menu = () => within(screen.getByRole("navigation", { name: "Menu principal" }));
const abrir = async (n: string) => { await waitFor(() => expect(menu().getByRole("button", { name: n })).toBeTruthy()); fireEvent.click(menu().getByRole("button", { name: n })); };

describe("perfil do personagem", () => {
  it("lê e valida classe e nível; caminho de retrato fora do padrão é ignorado", () => {
    expect(lerPerfil({ classe: "Mago", nivel: 5 })).toEqual({ classe: "Mago", nivel: 5, retrato: null });
    expect(lerPerfil({ nivel: 99 }).nivel).toBe(20); expect(lerPerfil({ nivel: "x" }).nivel).toBe(1); expect(lerPerfil(undefined).classe).toBe("");
    expect(lerPerfil({ retrato: "../x" }).retrato).toBeNull();
    expect(validarPerfil("", "Mago", 1)).toMatch(/nome/i); expect(validarPerfil("A", "", 1)).toMatch(/classe/i);
    expect(validarPerfil("A", "Mago", 0)).toMatch(/nível/); expect(validarPerfil("A", "Mago", 21)).toMatch(/nível/); expect(validarPerfil("A", "Mago", 3)).toBeNull();
  });
});

describe("Personagens e Aventureiros", () => {
  it("a criação usa o criador guiado e fichas legadas continuam acessíveis", async () => {
    const store = { dados: [pc("p1", me.id, "Lydia", "private", { classe: "Clériga", nivel: 4 })] };
    await renderApp({ api: apiC(jogador), registros: registrosEmMemoria("jogador", me.id, [], store) });
    await abrir("Personagens");
    fireEvent.click(screen.getByRole("button", { name: "Criar personagem" }));
    expect(await screen.findByLabelText("Nome do personagem")).toBeTruthy();
    await abrir("Personagens");
    fireEvent.click(await screen.findByRole("button", { name: "Abrir ficha de Lydia" }));
    expect(await screen.findByLabelText("Nome")).toBeTruthy();
    expect(screen.getByLabelText("Classe")).toBeTruthy();
  });
  it("personagem privado não aparece para os outros nem na vitrine do Início; valida nível antes de gravar", async () => {
    const store = { dados: [pc("p1", "outro", "Privado alheio", "private"), pc("p2", "outro", "Público alheio", "campaign"), pc("p3", me.id, "Meu privado", "private")] };
    await renderApp({ api: apiC(jogador), registros: registrosEmMemoria("jogador", me.id, [], store) });
    expect(await screen.findByRole("button", { name: "Público alheio Guerreiro · nível 3" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Privado alheio/ })).toBeNull(); expect(screen.queryByRole("button", { name: /Meu privado/ })).toBeNull();
    await abrir("Personagens");
    await screen.findByRole("button", { name: "Abrir ficha de Meu privado" });
    expect(screen.queryByRole("button", { name: /Privado alheio/ })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Abrir ficha de Meu privado" }));
    fireEvent.change(await screen.findByLabelText("Nível"), { target: { value: "30" } });
    fireEvent.click(screen.getByRole("button", { name: "Salvar" }));
    expect((await screen.findByText(/nível deve ser/)).getAttribute("role")).toBe("alert");
    expect(store.dados.find(r => r.id === "p3")!.version).toBe(1);
  });
  it("retrato: envia, mostra e troca; o anterior é apagado só depois de salvar", async () => {
    const store = { dados: [pc("p3", me.id, "Meu", "campaign", { classe: "Mago", nivel: 1 })] };
    const u1 = "11111111-1111-4111-8111-111111111111/22222222-2222-4222-8222-222222222222", u2 = "11111111-1111-4111-8111-111111111111/33333333-3333-4333-8333-333333333333";
    const apagar = vi.fn(async () => ({ ok: true as const, data: true as const }));
    const capa: CapaApi = { obter: async () => ({ ok: true, data: null }), definir: async () => ({ ok: true, data: "" }), remover: async () => ({ ok: true, data: true }), enviar: async () => ({ ok: true, data: u1 }), urlDe: async c => ({ ok: true, data: `blob:${c}` }), apagar };
    await renderApp({ api: apiC(jogador), registros: registrosEmMemoria("jogador", me.id, [], store), capa });
    await abrir("Personagens"); fireEvent.click(await screen.findByRole("button", { name: "Abrir ficha de Meu" }));
    const input = (await screen.findByText("Adicionar retrato")).querySelector("input") as HTMLInputElement;
    fireEvent.change(input, { target: { files: [new File(["x"], "r.png", { type: "image/png" })] } });
    await screen.findByText("Remover retrato"); fireEvent.click(screen.getByRole("button", { name: "Salvar" }));
    await waitFor(() => expect(store.dados[0].meta).toMatchObject({ retrato: u1 }));
    expect(apagar).not.toHaveBeenCalled();
    capa.enviar = async () => ({ ok: true, data: u2 });
    fireEvent.change((await screen.findByText("Trocar retrato")).querySelector("input") as HTMLInputElement, { target: { files: [new File(["y"], "r2.png", { type: "image/png" })] } });
    await screen.findByText("Trocar retrato");
    fireEvent.click(screen.getByRole("button", { name: "Salvar" }));
    await waitFor(() => expect(apagar).toHaveBeenCalledWith(u1));
  });
});

describe("erros: vazio, banco desatualizado e conexão são coisas diferentes", () => {
  it("classifica erros do Postgres/PostgREST", () => {
    for (const e of [{ code: "42703", message: "column notes.kind does not exist" }, { code: "PGRST204", message: "Could not find the 'meta' column of 'notes' in the schema cache" }, { code: "42P01", message: "relation x does not exist" }]) expect(erroCampanha(e)).toBe(ERRO_SCHEMA);
    expect(erroCampanha({ code: "42501", message: "new row violates row-level security policy" })).toMatch(/permissão/);
    expect(erroCampanha({ message: "TypeError: Failed to fetch" })).toMatch(/Sem conexão/);
    expect(erroCampanha({ message: "tipo_exclusivo_do_mestre" })).toMatch(/Apenas o mestre/);
    expect(erroCampanha({ message: "algo estranho" })).toMatch(/Não foi possível concluir/);
  });
  const falha = (error: string): RegistrosApi => ({ list: async () => ({ ok: false, error }), get: async () => ({ ok: false, error }), create: async () => ({ ok: false, error }), update: async () => ({ ok: false, error }), remove: async () => ({ ok: false, error }) });
  it("Diário e Início com o banco desatualizado mostram o erro com 'tentar de novo' (nunca uma lista vazia)", async () => {
    await renderApp({ api: apiC(mestre), registros: falha(ERRO_SCHEMA) });
    const alertas = await screen.findAllByText(new RegExp(ERRO_SCHEMA.slice(0, 40)));
    expect(alertas.length).toBeGreaterThanOrEqual(2);
    expect(screen.queryByTestId("diario-vazio")).toBeNull(); expect(screen.queryByTestId("aventureiros-vazio")).toBeNull();
    await abrir("Diário");
    await waitFor(() => expect(screen.getAllByText(new RegExp(ERRO_SCHEMA.slice(0, 40))).length).toBeGreaterThan(0));
    expect(screen.queryByTestId("diario-lista-vazia")).toBeNull();
    expect(screen.getAllByRole("button", { name: "Tentar de novo" }).length).toBeGreaterThan(0);
  });
  it("falha de conexão tem mensagem própria; ao tentar de novo e funcionar, os dados aparecem", async () => {
    let ok = false;
    const registros = registrosEmMemoria("mestre", me.id, [{ ...base, id: "d1", kind: "diary", ownerId: me.id, title: "Sessão 1", visibility: "campaign" } as Registro]);
    const orig = registros.list; registros.list = async (c, k) => ok ? orig(c, k) : { ok: false, error: erroCampanha({ message: "Failed to fetch" }) };
    await renderApp({ api: apiC(mestre), registros });
    await abrir("Diário");
    expect((await screen.findAllByText(/Sem conexão com o servidor/)).length).toBeGreaterThan(0);
    ok = true; fireEvent.click(screen.getAllByRole("button", { name: "Tentar de novo" }).at(-1)!);
    expect((await screen.findAllByText("Sessão 1")).length).toBeGreaterThan(0);
  });
});

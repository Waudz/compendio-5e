// @vitest-environment jsdom
import { afterEach, beforeEach, describe, it, expect, vi } from "vitest";
import {
  act,
  cleanup,
  fireEvent,
  screen,
  within,
} from "@testing-library/react";
import { renderApp, me, memoryStorage } from "../testUtils";
import { activeKey } from "../CampaignsContext";
import type { CampaignApi, Membership } from "../campaigns";
import { storageKey } from "../persistence";
import { jogadorPodeAdicionar } from "../catalogue/disponibilidade";
import {
  avisarConhecimento,
  type CodexApi,
  type Conhecimento,
} from "./conhecimento";
const campaign = { id: "ca", name: "Mesa", description: "", created_at: "" };
const row = (patch: Partial<Conhecimento> = {}): Conhecimento => ({
  id: "g1",
  category: "monster",
  systemId: "dnd5e-2014",
  title: "Criatura revelada",
  knowledge: 1,
  version: 1,
  ...patch,
});
const api = (items: Conhecimento[] = []): CodexApi => ({
  links:vi.fn(async()=>[]),link:vi.fn(async()=>"link"),unlink:vi.fn(async()=>{}),feed:vi.fn(async()=>({items:[],unread:0,discoveries:0})),
  list: vi.fn(async () => items),
  save: vi.fn(async () => "novo"),
  remove: vi.fn(async () => {}),
  upload: vi.fn(async () => ""),
  image: vi.fn(async () => new Blob()),
  holders: vi.fn(async () => []),
  notices: vi.fn(async () => []),
  seen: vi.fn(async () => {}),
});
async function mount(role: "mestre" | "jogador", codex = api()) {
  const membership: Membership = { role, campaign };
  await renderApp({
    codex,
    api: {
      list: async () => ({ ok: true, data: [membership] }),
    } as CampaignApi,
  });
  fireEvent.click(
    within(
      screen.getByRole("navigation", { name: "Menu principal" }),
    ).getByRole("button", { name: "Compêndio" }),
  );
  await screen.findByRole("heading", { name: "Compêndio" });
  return codex;
}
const portal = (name: string) =>
  screen.getByRole("button", { name: new RegExp("^" + name + " ") });
beforeEach(() => {
  vi.stubGlobal("localStorage", memoryStorage());
  localStorage.setItem(activeKey(me.id), "ca");
  vi.stubGlobal("matchMedia", (q: string) => ({
    matches: false,
    media: q,
    addEventListener() {},
    removeEventListener() {},
  }));
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
  vi.spyOn(Element.prototype, "getBoundingClientRect").mockReturnValue({
    x: 0,
    y: 0,
    left: 0,
    top: 0,
    right: 1000,
    bottom: 800,
    width: 1000,
    height: 800,
    toJSON() {},
  } as DOMRect);
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});
describe("Compêndio unificado", () => {
  it("duas áreas, categorias ativas, sem entradas antigas; preserva busca e grade ao voltar", async () => {
    await mount("mestre");
    expect(
      within(screen.getByRole("group", { name: "Áreas do Compêndio" }))
        .getAllByRole("button")
        .map((x) => x.textContent),
    ).toEqual(["Campanha", "Regras"]);
    expect(document.querySelectorAll(".compendio-portal")).toHaveLength(5);
    fireEvent.click(screen.getByRole("button", { name: "Regras" }));
    expect(document.querySelectorAll(".compendio-portal")).toHaveLength(7);
    expect(
      document.querySelectorAll(".compendio-portal:disabled"),
    ).toHaveLength(0);
    fireEvent.click(portal("Itens"));
    fireEvent.change(screen.getByLabelText("Pesquisar no Compêndio"), {
      target: { value: "adaga" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Grade" }));
    fireEvent.click(
      screen.getByRole("button", { name: "Voltar às categorias" }),
    );
    fireEvent.click(portal("Itens"));
    expect(
      (screen.getByLabelText("Pesquisar no Compêndio") as HTMLInputElement)
        .value,
    ).toBe("adaga");
    expect(
      screen
        .getByRole("button", { name: "Grade" })
        .getAttribute("aria-pressed"),
    ).toBe("true");
  });
  it("jogador só pesquisa a projeção de criaturas reveladas; nome não abre atributos ou imagem", async () => {
    await mount("jogador", api([row()]));
    fireEvent.click(portal("Bestiário"));
    const button = await screen.findByRole("button", {
      name: "Criatura revelada",
    });
    fireEvent.click(button);
    expect(screen.queryByText("SEGREDO")).toBeNull();
    expect(screen.queryByText("Classe de Armadura")).toBeNull();
    expect(screen.queryByRole("button", { name: /Novo registro/ })).toBeNull();
    fireEvent.change(screen.getByRole("searchbox"), {
      target: { value: "goblin" },
    });
    expect(
      screen.queryByRole("button", { name: "Criatura revelada" }),
    ).toBeNull();
  });
  it("itens mágicos revelados ficam pesquisáveis sem liberar adição livre; os desconhecidos ficam fora", async () => {
    await mount(
      "jogador",
      api([
        row({
          category: "item",
          definitionId: "ring-of-invisibility",
          title: "Anel da invisibilidade",
        }),
      ]),
    );
    fireEvent.click(screen.getByRole("button", { name: "Regras" }));
    fireEvent.click(portal("Itens"));
    fireEvent.change(screen.getByLabelText("Pesquisar no Compêndio"), {
      target: { value: "ring of invisibility" },
    });
    expect(
      await screen.findByRole("button", { name: /^Anel de Invisibilidade/i }),
    ).toBeTruthy();
    expect(jogadorPodeAdicionar("ring-of-invisibility")).toBe(false);
    fireEvent.change(screen.getByLabelText("Pesquisar no Compêndio"), {
      target: { value: "holy avenger" },
    });
    expect(screen.getByTestId("compendio-vazio")).toBeTruthy();
  });
  it("link direto restaurado não revela item mágico desconhecido", async () => {
    localStorage.setItem(
      storageKey({ user: me.id, campaign: "ca", device: "navegador" }),
      JSON.stringify({
        version: 2,
        layout: {
          type: "row",
          children: [
            {
              type: "tabset",
              children: [{ type: "tab", id: "item:ring-of-invisibility" }],
            },
          ],
        },
      }),
    );
    await renderApp({
      codex: api(),
      api: {
        list: async () => ({ ok: true, data: [{ role: "jogador", campaign }] }),
      } as CampaignApi,
    });
    expect(
      await screen.findByText("Item não descoberto nesta campanha."),
    ).toBeTruthy();
    expect(screen.queryByText(/requires attunement/i)).toBeNull();
  });
  it("atualiza o portador publicado quando a projeção é recarregada após uma transferência", async () => {
    const entry = row({
      category: "item",
      definitionId: "ring-of-invisibility",
      title: "Anel revelado",
      knowledge: 4,
    });
    const codex = api([entry]);
    vi.mocked(codex.holders).mockResolvedValue([
      { id: "p1", title: "Portador A" },
    ]);
    await mount("jogador", codex);
    fireEvent.click(portal("Descobertas"));
    fireEvent.click(
      await screen.findByRole("button", { name: "Anel revelado" }),
    );
    expect(await screen.findByText("Com: Portador A")).toBeTruthy();
    vi.mocked(codex.holders).mockResolvedValue([
      { id: "p2", title: "Portador B" },
    ]);
    vi.mocked(codex.list).mockResolvedValue([{ ...entry }]);
    act(() => avisarConhecimento());
    expect(await screen.findByText("Com: Portador B")).toBeTruthy();
    expect(screen.queryByText("Com: Portador A")).toBeNull();
  });
});

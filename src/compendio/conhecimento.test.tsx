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
import { codexDemo } from "../dev/codexDemo";
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
  visible: true,
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
  reveal: vi.fn(async () => {}),
  preview: vi.fn(async () => ({ entry: null, links: [] })),
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
      document.querySelector(".cd-back")!,
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
      name: /^Criatura revelada /,
    });
    fireEvent.click(button);
    expect(screen.queryByText("SEGREDO")).toBeNull();
    expect(screen.queryByText("Classe de Armadura")).toBeNull();
    expect(screen.queryByRole("button", { name: /Novo registro/ })).toBeNull();
    fireEvent.click(screen.getByRole("button",{name:"Voltar na aba"}));
    fireEvent.change(screen.getByRole("searchbox"), {
      target: { value: "goblin" },
    });
    expect(
      screen.queryByRole("button", { name: /^Criatura revelada / }),
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
    });
    const codex = api([entry]);
    vi.mocked(codex.holders).mockResolvedValue([
      { id: "p1", title: "Portador A" },
    ]);
    await mount("jogador", codex);
    fireEvent.click(portal("Descobertas"));
    fireEvent.click(
      await screen.findByRole("button", { name: /^Anel revelado / }),
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
  it("mestre revela campo a campo, publica, usa a prévia e o jogador recebe só o marcado", async () => {
    const codex = codexDemo(true, "ca");
    const id = await codex.save("ca", null, 0, {
      category: "npc", systemId: "dnd5e-2014", title: "Edric Voss", secret: "SEGREDO",
      fields: { nickname: "O Corvo", occupation: "Contrabandista", history: "Nasceu no porto" },
    });
    await mount("mestre", codex);
    fireEvent.click(portal("Personagens"));
    fireEvent.click(await screen.findByRole("button", { name: /^Edric Voss / }));
    const barra = await screen.findByRole("region", { name: "Visibilidade para os jogadores" });
    expect(within(barra).getByText(/Registro secreto/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Revelar Alcunha" }));
    await screen.findByRole("button", { name: "Ocultar Alcunha" });
    fireEvent.click(await screen.findByRole("button", { name: "Revelar Ocupação" }));
    await screen.findByRole("button", { name: "Ocultar Ocupação" });
    fireEvent.click(within(barra).getByRole("button", { name: "Publicar registro" }));
    await within(barra).findByText(/Publicado/);
    fireEvent.click(within(barra).getByRole("button", { name: "Ver como jogador" }));
    const previa = await screen.findByRole("region", { name: "Prévia do jogador" });
    expect(within(previa).getByRole("heading", { name: "O Corvo" })).toBeTruthy();
    expect(within(previa).getByText("Contrabandista")).toBeTruthy();
    expect(previa.textContent).not.toMatch(/Edric|Nasceu|SEGREDO|História/);
    expect(within(previa).queryByRole("button", { name: /Revelar|Ocultar/ })).toBeNull();
    const [visto] = await codexDemo(false, "ca").list("ca");
    expect(visto).toMatchObject({ id, title: "O Corvo", fields: { nickname: "O Corvo", occupation: "Contrabandista" } });
    expect(JSON.stringify(visto)).not.toMatch(/Edric|Nasceu|SEGREDO/);
    fireEvent.click(within(barra).getByRole("button", { name: "Voltar à visão do mestre" }));
    fireEvent.click(await within(barra).findByRole("button", { name: "Revelar tudo" }));
    expect(await screen.findByRole("button", { name: "Ocultar História" })).toBeTruthy();
  });
  it("registrar item como descoberta cria página secreta, herdada da definição, sem duplicar", async () => {
    const codex = codexDemo(true, "ca");
    await mount("mestre", codex);
    fireEvent.click(portal("Descobertas"));
    fireEvent.click(await screen.findByRole("button", { name: "Registrar item" }));
    const janela = screen.getByRole("dialog", { name: "Registrar item como descoberta" });
    fireEvent.change(within(janela).getByRole("searchbox"), { target: { value: "espada longa" } });
    fireEvent.click((await within(janela).findAllByRole("button", { name: /^Espada longa Item do catálogo/i }))[0]);
    fireEvent.click(within(janela).getByRole("button", { name: "Registrar como descoberta" }));
    expect(await screen.findByRole("region", { name: "Propriedades" })).toBeTruthy();
    const [criado] = await codex.list("ca");
    expect(criado).toMatchObject({ category: "item", definitionId: "longsword", visible: false, revealed: [], registered: true });
    expect(criado.sheet!.length).toBeGreaterThan(2);
    expect(await codexDemo(false, "ca").list("ca")).toEqual([]);
  });
  it("criar item com 'Registrar como descoberta' gera a definição da campanha e a página secreta ligada a ela", async () => {
    const codex = codexDemo(true, "ca");
    await mount("mestre", codex);
    fireEvent.click(screen.getByRole("button", { name: "Regras" }));
    fireEvent.click(portal("Itens"));
    fireEvent.click(await screen.findByRole("button", { name: "Criar item" }));
    const janela = screen.getByRole("dialog", { name: "Novo item" });
    fireEvent.change(within(janela).getByLabelText("Nome"), { target: { value: "Chave do Corvo" } });
    fireEvent.change(within(janela).getByLabelText(/^Descrição e efeitos/), { target: { value: "Abre o entreposto" } });
    fireEvent.click(within(janela).getByLabelText("Registrar como descoberta"));
    fireEvent.click(within(janela).getByRole("button", { name: "Salvar" }));
    expect(await screen.findByRole("heading", { name: "Chave do Corvo" })).toBeTruthy();
    const [definicao] = await codex.definitions!("ca");
    const [registro] = await codex.list("ca");
    expect(registro).toMatchObject({ category: "item", definitionId: definicao.definitionId, visible: false });
    expect(registro.sheet!.at(-1)).toMatchObject({ k: "effects", v: "Abre o entreposto" });
  });
});


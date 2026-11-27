// @vitest-environment jsdom
import { afterEach, beforeEach, describe, it, expect, vi } from "vitest";
import {
  act,
  cleanup,
  fireEvent,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { renderApp, me, memoryStorage } from "../testUtils";
import { activeKey } from "../CampaignsContext";
import type { CampaignApi, Membership } from "../campaigns";
import { storageKey } from "../persistence";
import { jogadorPodeAdicionar } from "../catalogue/disponibilidade";
import { codexDemo } from "../dev/codexDemo";
import type { FonteAventureiros } from "../inicio";
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
async function mount(role: "mestre" | "jogador", codex: CodexApi = api(), aventureiros?: FonteAventureiros) {
  const membership: Membership = { role, campaign };
  await renderApp({
    codex,
    aventureiros,
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
    fireEvent.click(await screen.findByRole("button", { name: "Fechar consulta" }));
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
  const npc = (codex: CodexApi) => codex.save("ca", null, 0, {
    category: "npc", systemId: "dnd5e-2014", title: "Edric Voss", secret: "SEGREDO",
    fields: { nickname: "O Corvo", occupation: "Contrabandista", history: "Nasceu no porto" },
  });
  const carta = () => within(screen.getByRole("dialog", { name: "Consulta do Compêndio" }));
  const abrirRegistro = async (portalNome: string, nome: string) => {
    fireEvent.click(portal(portalNome));
    fireEvent.click(await screen.findByRole("button", { name: new RegExp("^" + nome + " ") }));
    await screen.findByRole("dialog", { name: "Consulta do Compêndio" });
    await carta().findByRole("heading", { name: nome, level: 1 });
  };
  it("consulta limpa; gerenciar é rascunho (cancelar não grava) e salvar é uma única operação; a prévia é a do jogador", async () => {
    const codex = codexDemo(true, "ca"), revelar = vi.spyOn(codex, "reveal");
    const id = await npc(codex);
    await mount("mestre", codex);
    await abrirRegistro("Personagens", "Edric Voss");
    expect(carta().queryAllByRole("button", { name: /^(Revelar|Ocultar) / })).toHaveLength(0);
    expect(carta().queryByRole("button", { name: "Ver ficha" })).toBeNull();   // NPC sem ficha vinculada
    fireEvent.click(carta().getByRole("button", { name: "Gerenciar conhecimento" }));
    fireEvent.click(carta().getByRole("switch", { name: "Registro conhecido" }));
    fireEvent.click(carta().getByRole("button", { name: "Revelar Alcunha" }));
    fireEvent.click(carta().getByRole("button", { name: "Cancelar" }));
    expect(revelar).not.toHaveBeenCalled();
    expect(await codexDemo(false, "ca").list("ca")).toEqual([]);
    expect((await codexDemo(false, "ca").feed("ca")).unread).toBe(0);
    fireEvent.click(carta().getByRole("button", { name: "Gerenciar conhecimento" }));
    expect(carta().getByRole("button", { name: "Revelar Alcunha" })).toBeTruthy();
    fireEvent.click(carta().getByRole("switch", { name: "Registro conhecido" }));
    fireEvent.click(carta().getByRole("button", { name: "Revelar Alcunha" }));
    fireEvent.click(carta().getByRole("button", { name: "Revelar Ocupação" }));
    expect(carta().getByRole("status").textContent).toBe("2 de 4 informações reveladas");
    fireEvent.click(carta().getByRole("button", { name: "Salvar conhecimento" }));
    await carta().findByRole("button", { name: "Gerenciar conhecimento" });
    expect(revelar).toHaveBeenCalledTimes(1);
    expect((await codexDemo(false, "ca").feed("ca")).unread).toBe(1);
    fireEvent.click(carta().getByRole("button", { name: "Ver como jogador" }));
    const previa = await screen.findByRole("region", { name: "Prévia do jogador" });
    expect(within(previa).getByRole("heading", { name: "O Corvo" })).toBeTruthy();
    expect(within(previa).getByText("Contrabandista")).toBeTruthy();
    expect(previa.textContent).not.toMatch(/Edric|Nasceu|SEGREDO|História/);
    expect(within(previa).queryByRole("button", { name: /Revelar|Ocultar|Editar|Conhecimento|Ver ficha/ })).toBeNull();
    const [visto] = await codexDemo(false, "ca").list("ca");
    expect(visto).toMatchObject({ id, title: "O Corvo", fields: { nickname: "O Corvo", occupation: "Contrabandista" } });
    expect(JSON.stringify(visto)).not.toMatch(/Edric|Nasceu|SEGREDO/);
    // o título da aba da página completa também usa a projeção durante a prévia
    fireEvent.click(within(previa).getByRole("button", { name: "Mestre" }));
    fireEvent.click(await carta().findByRole("button", { name: "Expandir para página completa" }));
    const abas = () => [...document.querySelectorAll(".flexlayout__tabset_tabbar_inner .workspace-tab-title")].map((x) => x.textContent);
    await waitFor(() => expect(abas()).toContain("Edric Voss"));
    fireEvent.click(await screen.findByRole("button", { name: "Ver como jogador" }));
    await screen.findByRole("region", { name: "Prévia do jogador" });
    await waitFor(() => expect(abas()).toContain("O Corvo"));
    expect(abas().join()).not.toContain("Edric");
    fireEvent.click(screen.getByRole("button", { name: "Mestre" }));
    await waitFor(() => expect(abas()).toContain("Edric Voss"));
  });
  it("carta abre sobre a lista; Escape e fechar preservam pesquisa e visualização sem criar aba", async () => {
    const codex = codexDemo(true, "ca");
    await npc(codex);
    await mount("mestre", codex);
    fireEvent.click(portal("Personagens"));
    await screen.findByRole("button", { name: /^Edric Voss / });
    fireEvent.change(screen.getByRole("searchbox"), { target: { value: "edric" } });
    fireEvent.click(screen.getByRole("button", { name: "Lista" }));
    const antes = document.querySelectorAll(".flexlayout__tab_button").length;
    fireEvent.click(screen.getByRole("button", { name: /^Edric Voss / }));
    fireEvent.keyDown(await screen.findByRole("dialog", { name: "Consulta do Compêndio" }), { key: "Escape" });
    expect(screen.queryByRole("dialog")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /^Edric Voss / }));
    fireEvent.click(await screen.findByRole("button", { name: "Fechar consulta" }));
    expect((screen.getByRole("searchbox") as HTMLInputElement).value).toBe("edric");
    expect(screen.getByRole("button", { name: "Lista" }).getAttribute("aria-pressed")).toBe("true");
    expect(document.querySelectorAll(".flexlayout__tab_button")).toHaveLength(antes);
  });
  it("naturalidade e residência vinculadas ocupam o próprio campo, sem repetir em registros relacionados; @ cita outro registro", async () => {
    const codex = codexDemo(true, "ca");
    const cidade = await codex.save("ca", null, 0, { category: "location", systemId: "dnd5e-2014", title: "Daggerford" });
    const id = await npc(codex);
    await codex.link("ca", id, cidade, { kind: "resident", label: "Habita", inverse: "Habitante" });
    await mount("mestre", codex);
    await abrirRegistro("Personagens", "Edric Voss");
    const residencia = await carta().findByText("Residência");
    expect(within(residencia.parentElement!).getByRole("button", { name: "Daggerford" })).toBeTruthy();
    expect(carta().queryByRole("heading", { name: "Registros relacionados" })).toBeNull();
    fireEvent.click(carta().getByRole("button", { name: "Editar registro" }));
    const editor = screen.getByRole("dialog", { name: "Editar registro" });
    const descricao = within(editor).getByLabelText("Descrição compartilhada") as HTMLTextAreaElement;
    fireEvent.change(descricao, { target: { value: "Vive em @Dagg", selectionStart: 13 } });
    fireEvent.click(await within(editor).findByRole("button", { name: /^Daggerford/ }));
    expect(descricao.value).toBe(`Vive em @[Daggerford](${cidade})`);
    fireEvent.click(within(editor).getByRole("button", { name: "Salvar" }));
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Editar registro" })).toBeNull());
    await waitFor(() => expect(carta().getAllByRole("button", { name: "Daggerford" })).toHaveLength(2));
    expect(screen.getByRole("dialog").textContent).not.toContain("@[");
    fireEvent.click(carta().getAllByRole("button", { name: "Daggerford" })[1]);
    expect(await carta().findByRole("heading", { name: "Daggerford", level: 1 })).toBeTruthy();
    fireEvent.click(carta().getByRole("button", { name: "Voltar à carta anterior" }));
    expect(await carta().findByRole("heading", { name: "Edric Voss", level: 1 })).toBeTruthy();
  });
  it("NPC ganha 'Ver ficha' só com ficha de combate vinculada; a ficha reutiliza a criatura e mostra a identidade", async () => {
    const codex = codexDemo(true, "ca");
    await npc(codex);
    await mount("mestre", codex);
    await abrirRegistro("Personagens", "Edric Voss");
    expect(carta().queryByRole("button", { name: "Ver ficha" })).toBeNull();
    fireEvent.click(carta().getByRole("button", { name: "Mais ações do registro" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Vincular ficha de combate" }));
    const janela = screen.getByRole("dialog", { name: "Ficha de combate de Edric Voss" });
    fireEvent.change(await within(janela).findByLabelText("Buscar monstro"), { target: { value: "goblin" } });
    fireEvent.click(await within(janela).findByRole("button", { name: "Vincular Goblin do Bestiário" }));
    fireEvent.click(await carta().findByRole("button", { name: "Ver ficha" }));
    expect(screen.queryByRole("dialog")).toBeNull();
    const secoes = within(await screen.findByRole("navigation", { name: "Seções da ficha" }));
    expect(secoes.getAllByRole("button").map((x) => x.textContent)).toEqual(["Ficha", "Habilidades", "Identidade"]);
    expect(screen.getByRole("heading", { name: "Edric Voss", level: 1 })).toBeTruthy();
    expect(screen.getByRole("region", { name: "Atributos" })).toBeTruthy();
    fireEvent.click(secoes.getByRole("button", { name: "Identidade" }));
    expect(await screen.findByText("Contrabandista")).toBeTruthy();
  });
  it("Bestiário do mestre: o clique abre a carta narrativa sem estatísticas; Ver ficha abre a ficha com a aba Bestiário", async () => {
    const codex = codexDemo(true, "ca");
    await codex.save("ca", null, 0, { category: "monster", systemId: "dnd5e-2014", definitionId: "troll", title: "Troll", fields: { habitat: "Pântanos" }, sheet: [{ k: "hp", l: "Pontos de vida", v: "84 (8d10)" }] });
    await mount("mestre", codex);
    fireEvent.click(portal("Bestiário"));
    fireEvent.change(await screen.findByLabelText("Pesquisar no Compêndio"), { target: { value: "troll" } });
    fireEvent.click((await screen.findAllByRole("button", { name: /^Troll / }))[0]);
    await screen.findByRole("dialog", { name: "Consulta do Compêndio" });
    expect(await carta().findByText("Pântanos")).toBeTruthy();
    expect(screen.getByRole("dialog").textContent).not.toMatch(/Pontos de vida|84|Classe de Armadura|Atributos/);
    fireEvent.click(carta().getByRole("button", { name: "Ver ficha" }));
    const secoes = within(await screen.findByRole("navigation", { name: "Seções da ficha" }));
    expect(secoes.getAllByRole("button").map((x) => x.textContent)).toEqual(["Ficha", "Habilidades", "Bestiário"]);
    const abasAntes = document.querySelectorAll(".flexlayout__tab_button").length;
    fireEvent.click(secoes.getByRole("button", { name: "Bestiário" }));
    expect(await screen.findByText("Pântanos")).toBeTruthy();
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(document.querySelectorAll(".flexlayout__tab_button")).toHaveLength(abasAntes);
  });
  it("jogador com aba restaurada de criatura não recebe ficha técnica, mesmo com a criatura revelada", async () => {
    localStorage.setItem(storageKey({ user: me.id, campaign: "ca", device: "navegador" }),
      JSON.stringify({ version: 2, layout: { type: "row", children: [{ type: "tabset", children: [{ type: "tab", id: "monstro:goblin" }] }] } }));
    await renderApp({ codex: api([row({ definitionId: "goblin" })]), api: { list: async () => ({ ok: true, data: [{ role: "jogador", campaign }] }) } as CampaignApi });
    expect(await screen.findByText(/A ficha técnica é exclusiva do mestre/)).toBeTruthy();
    expect(screen.queryByRole("navigation", { name: "Seções da ficha" })).toBeNull();
    expect(document.body.textContent).not.toMatch(/Classe de Armadura|Pontos de vida/);
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
  it("item personalizado identificado aparece ao jogador em Regras → Itens; o não revelado e o não identificado ficam fora", async () => {
    const definicao = (id: string, nome: string, mask?: boolean) => ({ kind: "item" as const, definitionId: id, version: 1, mask, data: { definition: { id, en: "Custom", nome, categoria: "equipamento", raridade: "mundano" } } });
    const codex = { ...api([row({ category: "item", definitionId: "custom-revelado", title: "Chave revelada" })]),
      definitions: vi.fn(async () => [definicao("custom-revelado", "Chave revelada"), definicao("custom-possuido", "Chave apenas possuida"), definicao("unid-abc", "Chave estranha", true)]) };
    await mount("jogador", codex);
    fireEvent.click(screen.getByRole("button", { name: "Regras" }));
    fireEvent.click(portal("Itens"));
    fireEvent.change(screen.getByLabelText("Pesquisar no Compêndio"), { target: { value: "chave" } });
    expect(await screen.findByRole("button", { name: /^Chave revelada / })).toBeTruthy();
    expect(screen.queryByRole("button", { name: /^Chave apenas possuida/ })).toBeNull();
    expect(screen.queryByRole("button", { name: /^Chave estranha/ })).toBeNull();
    expect(screen.queryByRole("button", { name: "Criar item" })).toBeNull();
  });
  it("mestre entrega um item como não identificado com a aparência escolhida", async () => {
    const codex = { ...api(), definitions: vi.fn(async () => []), grantItem: vi.fn(async () => {}) };
    const fonte = { listar: vi.fn(async () => ({ ok: true as const, data: [{ id: "pj1", nome: "Lyra", classe: "Ladina", nivel: 3, alcunha: null, descricao: null, retratoUrl: null }] })) };
    await mount("mestre", codex, fonte as unknown as FonteAventureiros);
    fireEvent.click(screen.getByRole("button", { name: "Regras" }));
    fireEvent.click(portal("Itens"));
    fireEvent.change(screen.getByLabelText("Pesquisar no Compêndio"), { target: { value: "espada longa" } });
    fireEvent.click((await screen.findAllByRole("button", { name: /^Espada longa / }))[0]);
    fireEvent.click(await screen.findByRole("button", { name: "Entregar a um personagem" }));
    const janela = screen.getByRole("dialog", { name: /^Entregar / });
    await within(janela).findByRole("option", { name: "Lyra" });
    fireEvent.change(within(janela).getByLabelText("Personagem"), { target: { value: "pj1" } });
    fireEvent.click(within(janela).getByLabelText("Entregar como não identificado"));
    fireEvent.change(within(janela).getByLabelText("Nome aparente"), { target: { value: "Lâmina antiga" } });
    fireEvent.click(within(janela).getByRole("button", { name: "Entregar" }));
    expect(await within(janela).findByText("Entregue a Lyra.")).toBeTruthy();
    expect(codex.grantItem).toHaveBeenCalledWith("ca", "pj1", "longsword", 1, { nome: "Lâmina antiga", descricao: "" }, expect.any(String));
  });
});


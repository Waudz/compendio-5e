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
  seenAll: vi.fn(async()=>{}),
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
    fireEvent.click(screen.getByRole("button", { name: "Visualizar em grade" }));
    fireEvent.click(
      screen.getByRole("button",{name:"Voltar na aba"}),
    );
    fireEvent.click(portal("Itens"));
    expect(
      (screen.getByLabelText("Pesquisar no Compêndio") as HTMLInputElement)
        .value,
    ).toBe("adaga");
    expect(
      screen
        .getByRole("button", { name: "Visualizar em lista" }),
    ).toBeTruthy();
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
  const acaoCarta = (name:string) => { fireEvent.click(carta().getByRole('button',{name:'Mais ações do registro'})); return carta().getByRole('menuitem',{name}); };
  const alternarPrevia = async () => {
    fireEvent.click(screen.getByRole('button',{name:'Abrir menu global'}));
    fireEvent.click(screen.getByRole('button',{name:/^(Ver como jogador|Voltar à visão de mestre)$/}));
    await waitFor(()=>expect(screen.queryByRole('dialog',{name:'Menu de navegação'})).toBeNull());
    fireEvent.click(within(screen.getByRole('navigation',{name:'Menu principal'})).getByRole('button',{name:'Compêndio'}));
    fireEvent.click(await screen.findByRole('button',{name:'Campanha'}));
  };
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
    fireEvent.click(acaoCarta("Gerenciar conhecimento"));
    fireEvent.click(carta().getByRole("switch", { name: "Registro conhecido" }));
    fireEvent.click(carta().getByRole("button", { name: "Revelar Alcunha" }));
    fireEvent.click(carta().getByRole("button", { name: "Cancelar" }));
    expect(revelar).not.toHaveBeenCalled();
    expect(await codexDemo(false, "ca").list("ca")).toEqual([]);
    expect((await codexDemo(false, "ca").feed("ca")).unread).toBe(0);
    fireEvent.click(acaoCarta("Gerenciar conhecimento"));
    expect(carta().getByRole("button", { name: "Revelar Alcunha" })).toBeTruthy();
    fireEvent.click(carta().getByRole("switch", { name: "Registro conhecido" }));
    fireEvent.click(carta().getByRole("button", { name: "Revelar Alcunha" }));
    fireEvent.click(carta().getByRole("button", { name: "Revelar Ocupação" }));
    expect(carta().getByRole("status").textContent).toBe("2 de 5 informações reveladas")   // 0022: "Estado vital" também é revelável;
    fireEvent.click(carta().getByRole("button", { name: "Salvar conhecimento" }));
    await carta().findByRole("button",{name:"Mais ações do registro"});
    expect(revelar).toHaveBeenCalledTimes(1);
    expect((await codexDemo(false, "ca").feed("ca")).unread).toBe(1);
    await alternarPrevia();
    await abrirRegistro("Personagens", "O Corvo");
    const previa=screen.getByRole('dialog',{name:'Consulta do Compêndio'});
    expect(within(previa).getByText("Contrabandista")).toBeTruthy();
    expect(previa.textContent).not.toMatch(/Edric|Nasceu|SEGREDO|História/);
    expect(within(previa).queryByRole("button",{name:'Mais ações do registro'})).toBeNull();
    fireEvent.click(within(previa).getByRole('button',{name:'Expandir para página completa'}));
    await waitFor(()=>expect([...document.querySelectorAll('.workspace-tab-title')].map(x=>x.textContent)).toContain('O Corvo'));
    expect(document.querySelector('.flexlayout__tabset_tabbar_inner')?.textContent).not.toContain('Edric');
    const [visto]=await codexDemo(false,"ca").list("ca");
    expect(visto).toMatchObject({id,title:'O Corvo',fields:{nickname:'O Corvo',occupation:'Contrabandista'}});
    expect(JSON.stringify(visto)).not.toMatch(/Edric|Nasceu|SEGREDO/);
    await alternarPrevia();
    await abrirRegistro('Personagens','Edric Voss');
  });
  it("carta abre sobre a lista; Escape e fechar preservam pesquisa e visualização sem criar aba", async () => {
    const codex = codexDemo(true, "ca");
    await npc(codex);
    await mount("mestre", codex);
    fireEvent.click(portal("Personagens"));
    await screen.findByRole("button", { name: /^Edric Voss / });
    fireEvent.change(screen.getByRole("searchbox"), { target: { value: "edric" } });
    fireEvent.click(screen.getByRole("button", { name: "Visualizar em lista" }));
    const antes = document.querySelectorAll(".flexlayout__tab_button").length;
    fireEvent.click(screen.getByRole("button", { name: /^Edric Voss / }));
    fireEvent.keyDown(await screen.findByRole("dialog", { name: "Consulta do Compêndio" }), { key: "Escape" });
    expect(screen.queryByRole("dialog")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /^Edric Voss / }));
    fireEvent.click(await screen.findByRole("button", { name: "Fechar consulta" }));
    expect((screen.getByRole("searchbox") as HTMLInputElement).value).toBe("edric");
    expect(screen.getByRole("button", { name: "Visualizar em grade" })).toBeTruthy();
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
    fireEvent.click(acaoCarta("Editar registro"));
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
  it("Vincular registro fica na edição, onde também se remove um vínculo comum", async () => {
    const codex = codexDemo(true, "ca");
    const cidade = await codex.save("ca", null, 0, { category: "location", systemId: "dnd5e-2014", title: "Daggerford" });
    const id = await npc(codex);
    await codex.link("ca", id, cidade, { kind: "related", label: "Relacionado", inverse: "Relacionado" });
    await mount("mestre", codex);
    await abrirRegistro("Personagens", "Edric Voss");
    expect(carta().queryByRole("button", { name: "Vincular registro" })).toBeNull();
    expect(carta().queryByRole("button", { name: /^Remover vínculo/ })).toBeNull();
    fireEvent.click(acaoCarta("Editar registro"));
    const editor = within(screen.getByRole("dialog", { name: "Editar registro" }));
    expect(editor.getByRole("button", { name: "Vincular registro" })).toBeTruthy();
    vi.spyOn(window, "confirm").mockReturnValue(true);
    fireEvent.click(await editor.findByRole("button", { name: "Remover vínculo com Daggerford" }));
    expect(await codex.links("ca",id)).toHaveLength(1);
    fireEvent.click(editor.getByRole('button',{name:'Cancelar'}));
    expect(await codex.links("ca",id)).toHaveLength(1);
  });
  it("aviso discreto quando o texto revelado cita o próprio nome oculto; o texto não muda", async () => {
    const codex = codexDemo(true, "ca");
    const descricao = [{ type: "paragraph", content: [{ type: "text", text: "Todos no porto temem edric vóss." }] }];
    const id = await codex.save("ca", null, 0, { category: "npc", systemId: "dnd5e-2014", title: "Edric Voss", description: descricao, fields: { nickname: "O Corvo", history: "Nada consta." } });
    await mount("mestre", codex);
    await abrirRegistro("Personagens", "Edric Voss");
    fireEvent.click(acaoCarta("Gerenciar conhecimento"));
    const aviso = () => carta().queryByRole("note");
    expect(aviso()).toBeNull();   // nada revelado ainda
    fireEvent.click(carta().getByRole("button", { name: "Revelar História" }));
    expect(aviso()).toBeNull();
    fireEvent.click(carta().getByRole("button", { name: "Revelar Descrição" }));
    expect(aviso()!.textContent).toMatch(/aparece no texto revelado em: Descrição\. O texto não será alterado\./);
    fireEvent.click(carta().getByRole("button", { name: "Revelar Nome" }));
    expect(aviso()).toBeNull();
    fireEvent.click(carta().getByRole("button", { name: "Ocultar Nome" }));
    fireEvent.click(carta().getByRole("switch", { name: "Registro conhecido" }));
    fireEvent.click(carta().getByRole("button", { name: "Salvar conhecimento" }));
    await carta().findByRole("button",{name:"Mais ações do registro"});
    expect((await codex.list("ca")).find((x) => x.id === id)!.description).toEqual(descricao);
  });
  it("imagem da carta amplia sem fechar a carta; criatura sem imagem revelada não oferece ampliação ao jogador", async () => {
    const codex = codexDemo(true, "ca");
    await codex.save("ca", null, 0, { category: "monster", systemId: "dnd5e-2014", definitionId: "goblin", title: "Goblin da mesa" });
    await mount("mestre", codex);
    fireEvent.click(portal("Bestiário"));
    fireEvent.change(await screen.findByLabelText("Pesquisar no Compêndio"), { target: { value: "goblin" } });
    fireEvent.click(await screen.findByRole("button", { name: /^Goblin da mesa / }));
    await screen.findByRole("dialog", { name: "Consulta do Compêndio" });
    fireEvent.click(await carta().findByRole("button", { name: "Ampliar imagem de Goblin da mesa" }));
    fireEvent.keyDown(screen.getByRole("dialog", { name: "Imagem ampliada: Goblin da mesa" }), { key: "Escape" });
    expect(screen.queryByRole("dialog", { name: /^Imagem ampliada/ })).toBeNull();
    expect(screen.getByRole("dialog", { name: "Consulta do Compêndio" })).toBeTruthy();
    // na prévia sem a imagem revelada não existe imagem para ampliar
    fireEvent.click(acaoCarta("Gerenciar conhecimento"));
    fireEvent.click(carta().getByRole("switch", { name: "Registro conhecido" }));
    fireEvent.click(carta().getByRole("button", { name: "Revelar Nome" }));
    fireEvent.click(carta().getByRole("button", { name: "Salvar conhecimento" }));
    await carta().findByRole('button',{name:'Mais ações do registro'});
    await alternarPrevia();
    await abrirRegistro('Bestiário','Goblin da mesa');
    const previa=screen.getByRole('dialog',{name:'Consulta do Compêndio'});
    expect(within(previa).queryByRole('button',{name:/^Ampliar imagem/})).toBeNull();
    expect(previa.querySelector('img')).toBeNull();
  });
  it("fichas de NPC (0022): adicionar cópia de um modelo, trocar com confirmação e remover sem perder a identidade", async () => {
    const codex = codexDemo(true, "ca"), definir = vi.spyOn(codex, "definirFichaNpc" as never) as unknown as { mock: { calls: unknown[][] } };
    await npc(codex);
    await mount("mestre", codex);
    await abrirRegistro("Personagens", "Edric Voss");
    fireEvent.click(acaoCarta("Adicionar ficha"));
    const ficha = () => within(screen.getByRole("dialog", { name: "Ficha de Edric Voss" }));
    expect(ficha().queryByRole("button", { name: "Remover ficha" })).toBeNull();
    fireEvent.click(ficha().getByRole("button", { name: "Modelo do Bestiário" }));
    fireEvent.change(await ficha().findByLabelText("Buscar monstro"), { target: { value: "goblin" } });
    fireEvent.click(await ficha().findByRole("button", { name: "Vincular Goblin do Bestiário" }));
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Ficha de Edric Voss" })).toBeNull());
    const [salvo] = await codex.list("ca"), propria = `custom-npc-${salvo.id}`;
    expect(salvo.combatDefinitionId).toBe(propria);
    expect((await codex.definitions!("ca")).map(d => [d.definitionId, d.baseId])).toEqual([[propria, "goblin"]]);
    fireEvent.click(acaoCarta("Gerenciar ficha"));
    expect(ficha().getByText("Ficha de criatura própria")).toBeTruthy();
    const remover = () => ficha().getByRole("button", { name: "Remover ficha" }) as HTMLButtonElement;
    expect(remover().disabled).toBe(true);
    expect((ficha().getByRole("button", { name: "Ficha de personagem" }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(ficha().getByRole("checkbox", { name: /cópia privada.*30 dias/ }));
    fireEvent.click(remover());
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Ficha de Edric Voss" })).toBeNull());
    const [depois] = await codex.list("ca");
    expect(depois).toMatchObject({ id: salvo.id, title: "Edric Voss", fields: salvo.fields });
    expect(depois.combatDefinitionId).toBeUndefined();
    expect(await codex.definitions!("ca")).toEqual([]);
    expect(definir.mock.calls.at(-1)![4]).toMatchObject({ confirmar: true });
    expect(acaoCarta("Adicionar ficha")).toBeTruthy();
  });

  it("estado vital: o mestre escolhe na página; o jogador só vê quando revelado, e 'Desconhecido' é um valor", async () => {
    const codex = codexDemo(true, "ca");
    await npc(codex);
    await mount("mestre", codex);
    await abrirRegistro("Personagens", "Edric Voss");
    const escolha = await carta().findByRole("combobox", { name: "Estado vital" }) as HTMLSelectElement;
    expect(escolha.value).toBe("vivo");
    fireEvent.change(escolha, { target: { value: "desconhecido" } });
    await waitFor(async () => expect((await codex.list("ca"))[0].vitalStatus).toBe("desconhecido"));
    const [e] = await codex.list("ca");
    await codex.reveal("ca", e.id, e.version, { visible: true, revealed: ["name"] });
    expect((await codexDemo(false, "ca").list("ca"))[0]).not.toHaveProperty("vitalStatus");
    const [e2] = await codex.list("ca");
    await codex.reveal("ca", e2.id, e2.version, { visible: true, revealed: ["name", "vitalStatus"] });
    expect((await codexDemo(false, "ca").list("ca"))[0].vitalStatus).toBe("desconhecido");
  });

  it("NPC ganha 'Ver ficha' só com ficha de combate vinculada; a ficha reutiliza a criatura e mostra a identidade", async () => {
    // banco ainda sem a 0022: o vínculo antigo continua como era
    const codex: CodexApi = { ...codexDemo(true, "ca"), bancoDeNpcs: undefined, vidas: undefined, gravarVida: undefined, definirFichaNpc: undefined };
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


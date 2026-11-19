// @vitest-environment jsdom
// Início da campanha: página (mestre/jogador), seções com e sem dados, navegação, ordem do menu, proteção de alterações.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { AuthProvider } from "./AuthContext";
import { CampaignHome } from "./CampaignHome";
import { CampaignsProvider, activeKey } from "./CampaignsContext";
import type { CampaignApi, Membership } from "./campaigns";
import type { Aventureiro, EntradaDiario, FonteAventureiros, FonteDiario } from "./inicio";
import { storageKey } from "./persistence";
import { fakeAuth, me, memoryStorage, renderApp } from "./testUtils";
import { UnsavedContext } from "./unsaved";
import { desktopSections, visibleSections } from "./workspace";

const mestre = (desc = "Uma campanha em Faerûn."): Membership => ({ role: "mestre", campaign: { id: "ca", name: "Mesa dos Dragões", description: desc, created_at: "" } });
const jogador = (): Membership => ({ role: "jogador", campaign: { id: "cb", name: "Mesa da Lua", description: "Para jogadores.", created_at: "" } });
const entrada: EntradaDiario = { id: "e1", titulo: "A Taverna", dataSessao: { dia: 3, mes: 12, ano: 1491 }, publicada: true, atualizadaEm: "2026-05-01",
  conteudo: [{ type: "image" }, { type: "paragraph", content: [] }, { type: "paragraph", content: [{ type: "text", text: "O grupo descansou na taverna." }] }, { type: "paragraph", content: [{ type: "text", text: "Segundo." }] }] };
const heroi: Aventureiro = { id: "p1", nome: "Lydia", classe: "Clériga", nivel: 5 };

const apiCom = (m: Membership[]) => ({
  list: async () => ({ ok: true, data: m }),
  members: vi.fn(async () => ({ ok: true, data: [] })), invites: vi.fn(async () => ({ ok: true, data: [] })),
  update: vi.fn(async (_i: string, n: string, d: string) => ({ ok: true, data: { ...m[0].campaign, name: n, description: d } })),
}) as unknown as CampaignApi & { members: ReturnType<typeof vi.fn>; invites: ReturnType<typeof vi.fn>; update: ReturnType<typeof vi.fn> };

async function montarHome(m: Membership, opts: { diario?: FonteDiario; aventureiros?: FonteAventureiros } = {}) {
  localStorage.setItem(activeKey(me.id), m.campaign.id);
  const onOpen = vi.fn(), onOpenContent = vi.fn(), api = apiCom([m]), auth = fakeAuth(me);
  render(<AuthProvider client={auth.client}><CampaignsProvider apiFactory={() => api}><CampaignHome id={m.campaign.id} onOpen={onOpen} onOpenContent={onOpenContent} diario={opts.diario} aventureiros={opts.aventureiros}/></CampaignsProvider></AuthProvider>);
  await screen.findByRole("heading", { name: m.campaign.name });
  return { onOpen, onOpenContent, api };
}
const abrirGestao = (rotulo: string) => { const d = screen.getByText(rotulo).closest("details")!; d.open = true; fireEvent(d, new Event("toggle")); };

beforeEach(() => { vi.stubGlobal("localStorage", memoryStorage()); window.history.pushState({}, "", "/"); });
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe("Início: mestre", () => {
  it("mostra capa vazia, nome em destaque e descrição; edita nome e descrição pela infraestrutura existente", async () => {
    const { api, onOpen } = await montarHome(mestre());
    await waitFor(() => expect(screen.getByTestId("inicio-capa").textContent).toMatch(/Sem capa/));
    expect(screen.getByText("Uma campanha em Faerûn.")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Editar informações" }));
    fireEvent.change(screen.getByLabelText("Nome"), { target: { value: "Mesa Renomeada" } });
    fireEvent.change(screen.getByLabelText("Descrição"), { target: { value: "Nova." } });
    fireEvent.click(screen.getByRole("button", { name: "Salvar informações" }));
    await waitFor(() => expect(api.update).toHaveBeenCalledWith("ca", "Mesa Renomeada", "Nova."));
    await waitFor(() => expect(onOpen).toHaveBeenCalledWith({ kind: "campanha", ref: "ca", title: "Mesa Renomeada" }));
  });
  it("campanha sem descrição mostra estado vazio; nome inválido é recusado sem chamar a API", async () => {
    const { api } = await montarHome(mestre(""));
    expect(screen.getByText("Sem descrição.")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Editar informações" }));
    fireEvent.change(screen.getByLabelText("Nome"), { target: { value: "  " } });
    fireEvent.click(screen.getByRole("button", { name: "Salvar informações" }));
    expect((await screen.findByRole("alert")).textContent).toMatch(/nome/i);
    expect(api.update).not.toHaveBeenCalled();
  });
  it("participantes e convites só são consultados quando a gestão é aberta", async () => {
    const { api } = await montarHome(mestre());
    expect(api.members).not.toHaveBeenCalled(); expect(api.invites).not.toHaveBeenCalled();
    abrirGestao("Gerenciar campanha");
    await waitFor(() => expect(api.members).toHaveBeenCalledTimes(1)); expect(api.invites).toHaveBeenCalledTimes(1);
    expect(await screen.findByRole("button", { name: "Criar convite" })).toBeTruthy();
  });
});

describe("Início: jogador", () => {
  it("lê nome e descrição sem editar, sem gestão do mestre e sem consultar convites", async () => {
    const { api } = await montarHome(jogador());
    expect(screen.getByText("Para jogadores.")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Editar informações" })).toBeNull();
    expect(screen.queryByText("Gerenciar campanha")).toBeNull();
    abrirGestao("Participantes");
    await waitFor(() => expect(api.members).toHaveBeenCalled());
    expect(api.invites).not.toHaveBeenCalled(); expect(screen.queryByRole("button", { name: "Criar convite" })).toBeNull();
  });
});

describe("Início: Diário", () => {
  it("sem fonte de dados: aviso discreto, nada inventado", async () => {
    await montarHome(mestre());
    expect(screen.getByTestId("diario-indisponivel")).toBeTruthy();
    expect(screen.queryByText("Ver registro completo")).toBeNull();
  });
  it("com entrada: título, data de Harptos, primeiro parágrafo textual e link para o registro original", async () => {
    const fonte: FonteDiario = { maisRecente: vi.fn(async () => ({ ok: true as const, data: entrada })) };
    const { onOpenContent } = await montarHome(mestre(), { diario: fonte });
    expect(await screen.findByText("A Taverna")).toBeTruthy();
    expect(screen.getByText("3 de Nightal, 1491 DR")).toBeTruthy();
    expect(screen.getByText("O grupo descansou na taverna.")).toBeTruthy(); expect(screen.queryByText("Segundo.")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Ver registro completo" }));
    expect(onOpenContent).toHaveBeenCalledWith({ kind: "documento", ref: "e1", title: "A Taverna" });
    expect(fonte.maisRecente).toHaveBeenCalledWith("ca", "mestre");
  });
  it("sem registros: estado vazio", async () => {
    await montarHome(mestre(), { diario: { maisRecente: async () => ({ ok: true as const, data: null }) } });
    expect(await screen.findByTestId("diario-vazio")).toBeTruthy();
  });
  it("erro da fonte: mensagem de alerta", async () => {
    await montarHome(mestre(), { diario: { maisRecente: async () => ({ ok: false as const, error: "Falhou." }) } });
    expect((await screen.findByText("Falhou.")).getAttribute("role")).toBe("alert");
  });
  it("jogador pede como jogador e nunca mostra entrada não publicada, mesmo que a fonte a devolva", async () => {
    const fonte: FonteDiario = { maisRecente: vi.fn(async () => ({ ok: true as const, data: { ...entrada, publicada: false } })) };
    await montarHome(jogador(), { diario: fonte });
    expect(await screen.findByTestId("diario-vazio")).toBeTruthy();
    expect(screen.queryByText("A Taverna")).toBeNull(); expect(fonte.maisRecente).toHaveBeenCalledWith("cb", "jogador");
  });
  it("sem data de sessão e sem texto: mostra só o título", async () => {
    await montarHome(mestre(), { diario: { maisRecente: async () => ({ ok: true as const, data: { ...entrada, dataSessao: null, conteudo: [{ type: "image" }] } }) } });
    expect(await screen.findByText("A Taverna")).toBeTruthy(); expect(document.querySelector("time")).toBeNull();
  });
});

describe("Início: Aventureiros", () => {
  it("sem módulo: aviso", async () => { await montarHome(mestre()); expect(screen.getByTestId("aventureiros-indisponivel")).toBeTruthy(); });
  it("sem personagens vinculados: estado vazio", async () => {
    await montarHome(mestre(), { aventureiros: { listar: async () => ({ ok: true as const, data: [] }) } });
    expect(await screen.findByTestId("aventureiros-vazio")).toBeTruthy();
  });
  it("com dados: nome, classe, nível, retrato e abre a ficha", async () => {
    const listar = vi.fn(async () => ({ ok: true as const, data: [heroi, { id: "p2", nome: "Toran", classe: "Guerreiro", nivel: 4, retratoUrl: "https://x/t.png" }] }));
    const { onOpenContent } = await montarHome(jogador(), { aventureiros: { listar } });
    const b = await screen.findByRole("button", { name: "Abrir ficha de Lydia" });
    expect(within(b).getByText("Clériga · nível 5")).toBeTruthy();
    expect(document.querySelector("img")?.getAttribute("src")).toBe("https://x/t.png");
    fireEvent.click(b); expect(onOpenContent).toHaveBeenCalledWith({ kind: "ficha", ref: "p1", title: "Ficha: Lydia" });
    expect(listar).toHaveBeenCalledWith("cb");
  });
});

describe("Início: edição protegida", () => {
  it("edição com alterações registra 'não salvo' na aba da campanha e libera ao cancelar", async () => {
    const register = vi.fn();
    localStorage.setItem(activeKey(me.id), "ca");
    const auth = fakeAuth(me), api = apiCom([mestre()]);
    render(<UnsavedContext.Provider value={{ register, isDirty: () => false, guard: (_i, p) => p(), confirmAll: async () => true }}>
      <AuthProvider client={auth.client}><CampaignsProvider apiFactory={() => api}><CampaignHome id="ca" onOpen={() => {}} onOpenContent={() => {}}/></CampaignsProvider></AuthProvider></UnsavedContext.Provider>);
    await screen.findByRole("heading", { name: "Mesa dos Dragões" });
    fireEvent.click(screen.getByRole("button", { name: "Editar informações" }));
    fireEvent.change(screen.getByLabelText("Nome"), { target: { value: "Outro" } });
    await waitFor(() => expect(register).toHaveBeenLastCalledWith("campanha:ca", expect.objectContaining({ dirty: true })));
    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    await waitFor(() => expect(register).toHaveBeenLastCalledWith("campanha:ca", expect.objectContaining({ dirty: false })));
  });
});

describe("ordem do menu por papel", () => {
  const nomes = (l: { title: string }[]) => l.map(s => s.title);
  it("mestre: Planejamento, Diário, Iniciativa, Encontros, Personagens, Enciclopédia, Documentos, Compêndio", () =>
    expect(nomes(desktopSections("mestre"))).toEqual(["Planejamento", "Diário", "Iniciativa", "Encontros", "Personagens", "Enciclopédia", "Documentos", "Compêndio"]));
  it("jogador: Personagens, Diário, Enciclopédia, Documentos, Compêndio", () =>
    expect(nomes(desktopSections("jogador"))).toEqual(["Personagens", "Diário", "Enciclopédia", "Documentos", "Compêndio"]));
  it("sem campanha ativa mantém as seções comuns; Planejamento nunca aparece para quem não é mestre", () => {
    expect(nomes(desktopSections(null))).toContain("Iniciativa"); expect(nomes(visibleSections(false))).not.toContain("Planejamento");
  });
});

describe("Início no aplicativo", () => {
  let mobile = false;
  beforeEach(() => {
    mobile = false;
    vi.stubGlobal("matchMedia", (q: string) => ({ matches: mobile && q.includes("max-width"), media: q, addEventListener() {}, removeEventListener() {} }));
    vi.stubGlobal("ResizeObserver", class { observe() {} unobserve() {} disconnect() {} });
    vi.spyOn(Element.prototype, "getBoundingClientRect").mockImplementation(() => ({ x: 0, y: 0, left: 0, top: 0, right: 800, bottom: 600, width: 800, height: 600, toJSON() {} }) as DOMRect);
  });
  const abrir = async (m: Membership[], ativa = m[0].campaign.id) => {
    localStorage.setItem(activeKey(me.id), ativa);
    const r = await renderApp({ api: apiCom(m) });
    await waitFor(() => expect(screen.getByRole("button", { name: /Campanha ativa:/ })).toBeTruthy());
    return r;
  };
  const menu = () => within(screen.getByRole("navigation", { name: "Menu principal" }));
  const strip = ".flexlayout__tabset_tabbar_inner .flexlayout__tab_button_content";

  it("mestre: Início é o primeiro item do menu e a primeira entrada na campanha abre o Início", async () => {
    await abrir([mestre()]);
    const nomes = menu().getAllByRole("button").map(b => b.textContent);
    expect(nomes.slice(0, 9)).toEqual(["Início", "Planejamento", "Diário", "Iniciativa", "Encontros", "Personagens", "Enciclopédia", "Documentos", "Compêndio"]);
    expect(await screen.findByTestId("campanha-inicio")).toBeTruthy();
    expect([...document.querySelectorAll(strip)].map(e => e.textContent)).toEqual(["Mesa dos Dragões"]);
  });
  it("jogador: Início primeiro, sem Planejamento, Iniciativa e Encontros", async () => {
    await abrir([jogador()]);
    const nomes = menu().getAllByRole("button").map(b => b.textContent);
    expect(nomes.slice(0, 6)).toEqual(["Início", "Personagens", "Diário", "Enciclopédia", "Documentos", "Compêndio"]);
    expect(await screen.findByTestId("campanha-inicio")).toBeTruthy();
  });
  it("Início e o nome da campanha abrem a MESMA aba campanha:<id> (sem duplicar)", async () => {
    await abrir([mestre()]);
    fireEvent.click(menu().getByRole("button", { name: "Documentos" }));
    fireEvent.click(menu().getByRole("button", { name: "Início" }));
    await screen.findByTestId("campanha-inicio");
    fireEvent.click(screen.getByRole("button", { name: /Campanha ativa:/ }));
    expect(document.querySelectorAll("[data-testid=campanha-inicio]")).toHaveLength(1);
    const salvo = localStorage.getItem(storageKey({ user: me.id, campaign: "ca", device: "navegador" }))!;
    expect(salvo.match(/campanha:ca/g)?.length ?? 0).toBeLessThanOrEqual(1);
  });
  it("layout salvo anterior é preservado (não força o Início)", async () => {
    localStorage.setItem(storageKey({ user: me.id, campaign: "ca", device: "navegador" }), JSON.stringify({ version: 2, layout: { type: "row", children: [{ type: "tabset", id: "g1", weight: 100, active: true, children: [{ type: "tab", id: "secao:documentos" }] }] } }));
    await abrir([mestre()]);
    expect([...document.querySelectorAll(strip)].map(e => e.textContent)).toEqual(["Documentos"]);
  });
  it("celular: Início disponível e Diário, Enciclopédia e Documentos acessíveis na mesma barra", async () => {
    mobile = true; await abrir([jogador()]);
    const nomes = menu().getAllByRole("button").map(b => b.textContent);
    expect(nomes).toEqual(expect.arrayContaining(["Início", "Diário", "Enciclopédia", "Documentos"]));
  });
  it("troca de campanha mostra o Início da outra campanha", async () => {
    await abrir([mestre(), jogador()]);
    fireEvent.click(screen.getByRole("button", { name: "Trocar ou gerenciar campanhas" }));
    fireEvent.click(within(screen.getByRole("menu")).getByRole("menuitem", { name: "Mesa da Lua" }));
    expect(await screen.findByRole("heading", { name: "Mesa da Lua" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Editar informações" })).toBeNull();
  });
});

describe("restauração (F5) e abas do Início", () => {
  let mobile = false;
  beforeEach(() => {
    mobile = false;
    vi.stubGlobal("matchMedia", (q: string) => ({ matches: mobile && q.includes("max-width"), media: q, addEventListener() {}, removeEventListener() {} }));
    vi.stubGlobal("ResizeObserver", class { observe() {} unobserve() {} disconnect() {} });
    vi.spyOn(Element.prototype, "getBoundingClientRect").mockImplementation(() => ({ x: 0, y: 0, left: 0, top: 0, right: 800, bottom: 600, width: 800, height: 600, toJSON() {} }) as DOMRect);
  });
  const strip = ".flexlayout__tabset_tabbar_inner .flexlayout__tab_button_content";
  const abas = () => [...document.querySelectorAll(strip)].map(e => e.textContent);
  const menu = () => within(screen.getByRole("navigation", { name: "Menu principal" }));
  const salvar = (campanha: string, ids: string[]) => localStorage.setItem(storageKey({ user: me.id, campaign: campanha, device: "navegador" }), JSON.stringify({ version: 2, layout: { type: "row", children: [{ type: "tabset", id: "g1", weight: 100, active: true, children: ids.map(id => ({ type: "tab", id })) }] } }));

  it("F5 com a listagem de campanhas ainda pendente: restaura o layout da campanha, sem passar por Campanhas", async () => {
    localStorage.setItem(activeKey(me.id), "ca");
    salvar("ca", ["secao:documentos"]); salvar("nenhuma", ["secao:campanhas"]);   // o layout "sem campanha" tem Campanhas aberto
    let solta!: () => void; const gate = new Promise<void>(r => { solta = r; });
    const api = { ...apiCom([mestre()]), list: async () => { await gate; return { ok: true, data: [mestre()] }; } } as unknown as CampaignApi;
    const vistas: string[] = [];
    const obs = new MutationObserver(() => vistas.push(...abas().map(String))); obs.observe(document.body, { childList: true, subtree: true, characterData: true });
    await renderApp({ api });
    await waitFor(() => expect(abas()).toEqual(["Documentos"]));
    solta(); await waitFor(() => expect(screen.getByRole("button", { name: /Campanha ativa:/ })).toBeTruthy());
    obs.disconnect();
    expect(abas()).toEqual(["Documentos"]); expect(vistas).not.toContain("Campanhas");
  });
  it("campanha sem layout salvo abre só o Início; fechar o Início não o reabre ao atualizar; reabrir pelo menu funciona sem duplicar", async () => {
    localStorage.setItem(activeKey(me.id), "ca");
    const a = await renderApp({ api: apiCom([mestre()]) });
    await waitFor(() => expect(abas()).toEqual(["Mesa dos Dragões"]));
    fireEvent.contextMenu(screen.getByText("Mesa dos Dragões", { selector: strip })); fireEvent.click(within(screen.getByRole("menu")).getByRole("menuitem", { name: "Fechar aba" }));
    await waitFor(() => expect(abas()).toEqual([]));
    a.unmount(); cleanup();
    await renderApp({ api: apiCom([mestre()]) });                 // "F5"
    await waitFor(() => expect(screen.getByRole("button", { name: /Campanha ativa:/ })).toBeTruthy());
    expect(abas()).toEqual([]);                                   // continua fechado, tela vazia
    fireEvent.click(menu().getByRole("button", { name: "Início" })); fireEvent.click(menu().getByRole("button", { name: "Início" }));
    await waitFor(() => expect(abas()).toEqual(["Mesa dos Dragões"]));
  });
  it("cada campanha recupera o próprio layout ao trocar", async () => {
    localStorage.setItem(activeKey(me.id), "ca"); salvar("ca", ["secao:documentos"]); salvar("cb", ["secao:personagens"]);
    await renderApp({ api: apiCom([mestre(), jogador()]) });
    await waitFor(() => expect(abas()).toEqual(["Documentos"]));
    fireEvent.click(screen.getByRole("button", { name: "Trocar ou gerenciar campanhas" }));
    fireEvent.click(within(screen.getByRole("menu")).getByRole("menuitem", { name: "Mesa da Lua" }));
    await waitFor(() => expect(abas()).toEqual(["Personagens"]));
  });
});

// @vitest-environment jsdom
// Navegação: Campanhas fora do menu principal (desktop), campanha ativa clicável, seletor de campanha e seção Planejamento (só mestre).
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, screen, waitFor, within } from "@testing-library/react";
import type { CampaignApi, Membership } from "./campaigns";
import { activeKey } from "./CampaignsContext";
import { storageKey } from "./persistence";
import { me, memoryStorage, renderApp } from "./testUtils";
import { parseTabId, sections, visibleSections } from "./workspace";

// Painel de teste: o Planejamento é o REAL; "documento" vira um editor que registra alterações não salvas.
vi.mock("./Panel", async () => {
  const { useState } = await import("react");
  const { useUnsavedGuard } = await import("./unsaved");
  const real = await vi.importActual<typeof import("./Panel")>("./Panel");
  function Doc({ id }: { id: string }) {
    const [text, setText] = useState("");
    useUnsavedGuard(`documento:${id}`, text !== "");
    return <textarea aria-label={`Texto ${id}`} value={text} onChange={e => setText(e.target.value)}/>;
  }
  type P = Parameters<typeof real.Panel>[0];
  return { Panel: (p: P) => p.kind === "documento" ? <Doc id={p.entity}/>
    : p.kind === "secao" && p.entity === "documentos" ? <button onClick={() => p.onOpenContent({ kind: "documento", ref: "d1", title: "Rascunho" })}>abrir rascunho</button>
    : <real.Panel {...p}/> };
});

let mobile = false;
const mA: Membership = { role: "mestre", campaign: { id: "ca", name: "Mesa dos Dragões", description: "", created_at: "" } };
const mB: Membership = { role: "jogador", campaign: { id: "cb", name: "Mesa da Lua", description: "", created_at: "" } };
const api = (data: Membership[]) => ({ list: async () => ({ ok: true, data }) }) as unknown as CampaignApi;
const montar = async (data: Membership[], ativa: string | null = data[0]?.campaign.id ?? null) => {
  if (ativa) localStorage.setItem(activeKey(me.id), ativa);
  const r = await renderApp({ api: api(data) });
  if (ativa) await waitFor(() => expect(screen.getByRole("button", { name: /campanha ativa/i })).toBeTruthy());
  return r;
};

beforeEach(() => {
  vi.stubGlobal("localStorage", memoryStorage()); mobile = false;
  vi.stubGlobal("matchMedia", (q: string) => ({ matches: mobile && q.includes("max-width"), media: q, addEventListener() {}, removeEventListener() {} }));
  vi.stubGlobal("ResizeObserver", class { observe() {} unobserve() {} disconnect() {} });
  vi.spyOn(Element.prototype, "getBoundingClientRect").mockImplementation(() => ({ x: 0, y: 0, left: 0, top: 0, right: 800, bottom: 600, width: 800, height: 600, toJSON() {} }) as DOMRect);
  window.history.pushState({}, "", "/");
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

const menu = () => screen.getByRole("navigation", { name: "Menu principal" });
const nomesMenu = () => within(menu()).getAllByRole("button").map(b => b.textContent);
const strip = ".flexlayout__tabset_tabbar_inner .flexlayout__tab_button_content";
const tabs = () => [...document.querySelectorAll(strip)].map(e => e.textContent?.replace(/\s*\(fixada\)$/, ""));
const rawTabs = () => [...document.querySelectorAll(strip)].map(e => e.textContent);
const tabEl = (n: string) => screen.getByText(n, { selector: strip });
const campanhaAtiva = () => screen.getByRole("button", { name: /campanha ativa|nenhuma campanha ativa/i });
const abrirSeletor = () => fireEvent.click(screen.getByRole("button", { name: "Trocar ou gerenciar campanhas" }));
const itens = () => within(screen.getByRole("menu")).getAllByRole("menuitem").map(i => i.textContent);
const escolher = (n: string | RegExp) => fireEvent.click(within(screen.getByRole("menu")).getByRole("menuitem", { name: n }));

describe("menu principal", () => {
  it("Campanhas não aparece no menu principal do desktop; as demais seções continuam", async () => {
    await montar([mA]);
    const n = nomesMenu();
    expect(n).not.toContain("Campanhas");
    for (const s of ["Personagens", "Iniciativa", "Encontros", "Enciclopédia", "Compêndio", "Documentos", "Conta"]) expect(n).toContain(s);
    expect(sections.map(s => s.page)).not.toContain("campanhas");
  });
  it("celular: o funcionamento atual é preservado (Campanhas continua acessível na barra do celular)", async () => {
    mobile = true; await montar([mA]);
    expect(nomesMenu()).toContain("Campanhas");
  });
});

describe("campanha ativa clicável", () => {
  it("o nome da campanha ativa é um botão acessível e abre o Início (aba da campanha)", async () => {
    await montar([mA, mB], "ca");
    expect(campanhaAtiva().tagName).toBe("BUTTON"); expect(campanhaAtiva().textContent).toContain("Mesa dos Dragões");
    fireEvent.click(campanhaAtiva());
    expect(tabs()).toContain("Mesa dos Dragões");
    expect(JSON.parse(localStorage.getItem(storageKey({ user: me.id, campaign: "ca", device: "navegador" }))!).layout.children[0].children.map((t: { id: string }) => t.id)).toContain("campanha:ca");
  });
  it("respeita abas fixadas: com a aba atual fixada, o clique abre outra aba e não a substitui", async () => {
    await montar([mA]); localStorage.removeItem(storageKey({ user: me.id, campaign: "ca", device: "navegador" }));
    fireEvent.click(within(menu()).getByRole("button", { name: "Personagens" }));
    fireEvent.contextMenu(tabEl("Personagens")); fireEvent.click(within(screen.getByRole("menu")).getByRole("menuitem", { name: "Fixar aba" }));
    fireEvent.click(campanhaAtiva());
    expect(rawTabs().some(t => t === "Personagens (fixada)")).toBe(true); expect(tabs()).toContain("Mesa dos Dragões");
  });
  it("sem campanha ativa: o botão oferece escolher ou criar e abre a gestão de campanhas", async () => {
    await montar([], null);
    expect(campanhaAtiva().textContent).toContain("Nenhuma"); expect(campanhaAtiva().getAttribute("title")).toMatch(/escolher ou criar/);
    fireEvent.click(campanhaAtiva());
    expect(tabs()).toContain("Campanhas");
  });
});

describe("seletor de campanha", () => {
  it("lista as campanhas, marca a ativa e dá acesso à gestão", async () => {
    await montar([mA, mB], "ca");
    abrirSeletor();
    expect(itens()).toEqual(["Mesa dos Dragões (ativa)", "Mesa da Lua", "Gerenciar campanhas…"]);
    expect((within(screen.getByRole("menu")).getByRole("menuitem", { name: "Mesa dos Dragões (ativa)" }) as HTMLButtonElement).disabled).toBe(true);
    escolher("Gerenciar campanhas…"); expect(tabs()).toContain("Campanhas");
  });
  it("trocar de campanha mantém um layout por campanha e restaura cada um ao voltar", async () => {
    await montar([mA, mB], "ca");
    fireEvent.click(within(menu()).getByRole("button", { name: "Encontros" }), { ctrlKey: true });            // aba extra só na campanha A
    expect(tabs()).toContain("Encontros");
    abrirSeletor(); escolher("Mesa da Lua");
    await waitFor(() => expect(campanhaAtiva().textContent).toContain("Mesa da Lua"));
    expect(tabs()).not.toContain("Encontros"); expect(tabs()).toContain("Mesa da Lua");                       // B: espaço próprio, abre o Início
    expect(localStorage.getItem(activeKey(me.id))).toBe("cb");
    abrirSeletor(); escolher("Mesa dos Dragões");
    await waitFor(() => expect(campanhaAtiva().textContent).toContain("Mesa dos Dragões"));
    expect(tabs()).toContain("Encontros");                                                                    // A restaurada
  });
  it("alterações não salvas protegem a troca: Cancelar mantém a campanha e o texto; Descartar troca", async () => {
    await montar([mA, mB], "ca");
    fireEvent.click(within(menu()).getByRole("button", { name: "Documentos" })); fireEvent.click(screen.getByRole("button", { name: "abrir rascunho" }));
    fireEvent.change(await screen.findByLabelText("Texto d1"), { target: { value: "importante" } });
    abrirSeletor(); escolher("Mesa da Lua");
    const dlg = await screen.findByRole("alertdialog");
    fireEvent.click(within(dlg).getByRole("button", { name: "Cancelar" }));
    expect(campanhaAtiva().textContent).toContain("Mesa dos Dragões"); expect(localStorage.getItem(activeKey(me.id))).toBe("ca");
    expect((screen.getByLabelText("Texto d1") as HTMLTextAreaElement).value).toBe("importante");
    abrirSeletor(); escolher("Mesa da Lua"); fireEvent.click(within(await screen.findByRole("alertdialog")).getByRole("button", { name: "Descartar alterações" }));
    await waitFor(() => expect(campanhaAtiva().textContent).toContain("Mesa da Lua"));
  });
});

describe("Planejamento", () => {
  it("aparece para o mestre com campanha ativa e abre a seção com estado vazio (sem recursos fictícios)", async () => {
    await montar([mA], "ca");
    expect(nomesMenu()).toContain("Anotações");
    fireEvent.click(within(menu()).getByRole("button", { name: "Anotações" }));
    expect(tabs()).toContain("Anotações");
    expect(await screen.findByRole("heading", { name: "Anotações" })).toBeTruthy();   // sem API de registros neste teste: aviso honesto, sem dados
  });
  it("jogador também tem Anotações (privadas) e as demais ferramentas do mestre seguem ocultas", async () => {
    await montar([mA, mB], "cb");
    expect(nomesMenu()).toContain("Anotações"); expect(nomesMenu()).not.toContain("Iniciativa"); expect(visibleSections(false).map(s => s.page)).toContain("planejamento");
  });
  it("sem campanha ativa Anotações abre um aviso (pertencem a uma campanha), sem dados", async () => {
    await montar([], null);
    fireEvent.click(within(menu()).getByRole("button", { name: "Anotações" }));
    expect((await screen.findAllByText(/pertencem a uma campanha/)).length).toBeGreaterThan(0);
    expect(visibleSections(true).map(s => s.page)).toContain("planejamento");
  });
  it("aba de Anotações restaurada por um jogador abre a seção dele (sem aviso de mestre e sem dados alheios)", async () => {
    localStorage.setItem(activeKey(me.id), "cb");
    localStorage.setItem(storageKey({ user: me.id, campaign: "cb", device: "navegador" }), JSON.stringify({ version: 2, layout: { type: "row", children: [{ type: "tabset", id: "grupo-1", weight: 100, active: true, selected: 0, children: [{ type: "tab", id: "secao:planejamento" }] }] } }));
    await renderApp({ api: api([mA, mB]) });
    expect(await screen.findByRole("heading", { name: "Anotações" })).toBeTruthy();
    expect(screen.queryByText(/exclusivo do mestre/)).toBeNull();
  });
});

describe("compatibilidade com layouts antigos", () => {
  it("secao:campanhas continua válido (abas antigas restauram sem erro) e não vira item do menu", async () => {
    expect(parseTabId("secao:campanhas")).toEqual({ kind: "secao", ref: "campanhas" }); expect(parseTabId("secao:planejamento")).toEqual({ kind: "secao", ref: "planejamento" });
    expect(parseTabId("secao:inexistente")).toBeNull();
    localStorage.setItem(activeKey(me.id), "ca");
    localStorage.setItem(storageKey({ user: me.id, campaign: "ca", device: "navegador" }), JSON.stringify({ version: 2, layout: { type: "row", children: [{ type: "tabset", id: "grupo-1", weight: 100, active: true, selected: 0, children: [{ type: "tab", id: "secao:campanhas", pinned: true }, { type: "tab", id: "secao:personagens" }] }] } }));
    await renderApp({ api: api([mA]) });
    await waitFor(() => expect(tabs()).toEqual(["Campanhas", "Personagens"]));
    expect(rawTabs()[0]).toBe("Campanhas (fixada)");                                                         // fixação preservada
    expect(nomesMenu()).not.toContain("Campanhas");
    expect(await screen.findByRole("heading", { name: "Campanhas" })).toBeTruthy();                           // o painel de gestão continua funcionando
  });
  it("o convite por link continua abrindo a gestão de campanhas em nova aba", async () => {
    window.history.pushState({}, "", "/?convite=ABCDEF123456");
    await renderApp({ api: api([]) });
    await waitFor(() => expect(tabs()).toContain("Campanhas"));
  });
});

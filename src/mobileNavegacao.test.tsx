// @vitest-environment jsdom
// Celular (visão simples, independente do FlexLayout): barras por papel, histórico, rolagem, proteção de alterações,
// botão "Ficha" do jogador e Inventário dentro da Ficha. O desktop (FlexLayout) é coberto nos demais arquivos.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, screen, waitFor, within } from "@testing-library/react";
import type { CampaignApi, Membership } from "./campaigns";
import { activeKey } from "./CampaignsContext";
import type { Registro } from "./registros";
import { registrosEmMemoria } from "./registrosMemoria";
import { me, memoryStorage, other, renderApp } from "./testUtils";

const camp = { id: "ca", name: "Mesa dos Dragões", description: "Desc.", created_at: "" };
const mestre: Membership = { role: "mestre", campaign: camp }, jogador: Membership = { role: "jogador", campaign: camp };
const apiC = (m: Membership) => ({ list: async () => ({ ok: true, data: [m] }) }) as unknown as CampaignApi;
const base = { campaignId: "ca", version: 1, createdAt: "2026-01-01T00:00:00Z", content: [] };
const pc = (id: string, ownerId: string, title: string, updatedAt: string, visibility: "private" | "campaign" = "private", meta: Record<string, unknown> = { classe: "Guerreiro", nivel: 3 }): Registro =>
  ({ ...base, id, kind: "character", ownerId, title, visibility, meta, updatedAt });

beforeEach(() => {
  vi.stubGlobal("localStorage", memoryStorage());
  vi.stubGlobal("matchMedia", (q: string) => ({ matches: q.includes("max-width"), media: q, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} }));
  vi.stubGlobal("ResizeObserver", class { observe() {} unobserve() {} disconnect() {} });
  window.history.pushState({}, "", "/"); localStorage.setItem(activeKey(me.id), "ca");
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

const barra = () => within(screen.getByRole("navigation", { name: "Navegação mobile" }));
const barraNomes = () => [...document.querySelectorAll(".mobile-bottom-nav button")].map(b => b.textContent);
const titulo = () => document.querySelector(".mobile-page-title")?.textContent;
const montar = async (m: Membership, dados: Registro[] = [], uid = me.id) => {
  const store = { dados };
  const user = uid === me.id ? me : other; localStorage.setItem(activeKey(user.id), "ca");
  await renderApp({ user, api: apiC(m), registros: registrosEmMemoria(m.role, uid, [], store) });
  await waitFor(() => expect(document.querySelector(".mobile-bottom-nav")).toBeTruthy());
  await waitFor(() => expect(titulo()).toBe(camp.name));                    // a campanha ativa carrega e define a tela inicial (Início)
  return store;
};
const aguardarFicha = async (nome: string) => { await waitFor(() => expect(screen.getByLabelText("Nome") as HTMLInputElement).toBeTruthy()); await waitFor(() => expect((screen.getByLabelText("Nome") as HTMLInputElement).value).toBe(nome)); };
const deslizar = (alvo: Element, dx: number, dy = 0) => { fireEvent.touchStart(alvo, { touches: [{ clientX: 200, clientY: 300 }] }); fireEvent.touchEnd(alvo, { changedTouches: [{ clientX: 200 + dx, clientY: 300 + dy }] }); };

describe("celular: estrutura independente do FlexLayout", () => {
  it("mestre: barra Início | Anotações | Iniciativa | Compêndio | Menu, sem abas, colunas nem FlexLayout", async () => {
    await montar(mestre);
    expect(barraNomes()).toEqual(["Início", "Anotações", "Iniciativa", "Compêndio", "Menu"]);
    expect(screen.queryByRole("tablist")).toBeNull();
    expect(document.querySelector(".flexlayout__layout")).toBeNull();
    expect(document.querySelector(".m-tabs")).toBeNull();
  });
  it("jogador: barra Início | Anotações | Ficha | Compêndio | Menu (sem Iniciativa)", async () => {
    await montar(jogador);
    expect(barraNomes()).toEqual(["Início", "Anotações", "Ficha", "Compêndio", "Menu"]);
    expect(barra().queryByRole("button", { name: "Iniciativa" })).toBeNull();
  });
  it("histórico: navegar empilha, Voltar desempilha e o botão fica desabilitado na tela inicial", async () => {
    await montar(mestre);
    const voltar = () => screen.getByRole("button", { name: "Voltar" }) as HTMLButtonElement;
    expect(voltar().disabled).toBe(true);
    fireEvent.click(barra().getByRole("button", { name: "Anotações" }));
    await waitFor(() => expect(titulo()).toBe("Anotações"));
    fireEvent.click(barra().getByRole("button", { name: "Compêndio" }));
    await waitFor(() => expect(titulo()).toBe("Compêndio"));
    fireEvent.click(voltar()); await waitFor(() => expect(titulo()).toBe("Anotações"));
    fireEvent.click(voltar()); await waitFor(() => expect(voltar().disabled).toBe(true));
  });
  it("gesto Voltar do Android retorna do atalho à campanha sem sair do aplicativo", async () => {
    await montar(mestre);
    fireEvent.click(barra().getByRole("button", { name: "Anotações" }));
    await waitFor(() => expect(titulo()).toBe("Anotações"));
    fireEvent.popState(window);
    await waitFor(() => expect(titulo()).toBe(camp.name));
    expect(document.querySelector(".mobile-simple")).toBeTruthy();
  });
  it("restaura a posição de rolagem ao voltar para uma tela", async () => {
    await montar(mestre);
    const area = () => document.querySelector<HTMLElement>(".mobile-screen")!;
    let topo = 0;
    Object.defineProperty(HTMLElement.prototype, "scrollTop", { configurable: true, get() { return (this as HTMLElement).classList.contains("mobile-screen") ? topo : 0; }, set(v: number) { if ((this as HTMLElement).classList.contains("mobile-screen")) topo = v; } });
    try {
      topo = 420;
      fireEvent.click(barra().getByRole("button", { name: "Anotações" })); await waitFor(() => expect(titulo()).toBe("Anotações"));
      expect(area()).toBeTruthy();
      topo = 0;                                                              // a tela nova começa no topo
      fireEvent.click(screen.getByRole("button", { name: "Voltar" }));
      await waitFor(() => expect(topo).toBe(420));
    } finally { delete (HTMLElement.prototype as unknown as { scrollTop?: number }).scrollTop; }
  });
});

describe("celular: menu e barra inferior", () => {
  it("abre e fecha o menu mantendo a barra de navegação independente", async () => {
    await montar(mestre);
    const botao = barra().getByRole("button", { name: "Menu" });
    fireEvent.click(botao);
    const dialogo = screen.getByRole("dialog", { name: "Menu de navegação" });
    expect(dialogo.closest(".mobile-menu-overlay")).toBeTruthy();
    expect(botao.getAttribute("aria-expanded")).toBe("true");
    expect(barra().getByRole("button", { name: "Início" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Fechar menu" }));
    expect(screen.queryByRole("dialog", { name: "Menu de navegação" })).toBeNull();
    expect(botao.getAttribute("aria-expanded")).toBe("false");
  });
});

describe("celular: Ficha do jogador", () => {
  const dados = () => [pc("p1", me.id, "Lydia", "2026-02-01T00:00:00Z"), pc("p2", me.id, "Torin", "2026-03-01T00:00:00Z"), pc("p3", other.id, "Alheio", "2026-04-01T00:00:00Z", "campaign")];
  it("o botão Ficha abre a ficha do próprio personagem (a mais recente), não a lista nem a ficha de outro jogador", async () => {
    await montar(jogador, dados());
    fireEvent.click(barra().getByRole("button", { name: "Ficha" }));
    await aguardarFicha("Torin");
    expect(screen.getByRole("button",{name:"Meus personagens"})).toBeTruthy();
  });
  it("um ID recente adulterado não prova propriedade da ficha alheia", async () => {
    await montar(jogador, dados());
    localStorage.setItem(`compendio5e:ficha-recente:${me.id}:ca`, "p3");
    fireEvent.click(barra().getByRole("button", {name:"Menu"}));
    fireEvent.click(within(screen.getByRole("dialog",{name:"Menu de navegação"})).getByRole("button",{name:"Personagens"}));
    fireEvent.click(await screen.findByRole("button",{name:/^Alheio/}));
    await waitFor(()=>expect(titulo()).toBe("Alheio"));
    expect(screen.queryByRole("button",{name:"Meus personagens"})).toBeNull();
    expect(screen.getByRole("button",{name:"Voltar"})).toBeTruthy();
  });
  it("lembra a última ficha aberta e volta a ela", async () => {
    await montar(jogador, dados());
    fireEvent.click(barra().getByRole("button", { name: "Ficha" })); await aguardarFicha("Torin");
    fireEvent.click(barra().getByRole("button", { name: "Início" })); await waitFor(() => expect(titulo()).toBe(camp.name));
    localStorage.setItem(`compendio5e:ficha-recente:${me.id}:ca`, "p1");
    fireEvent.click(barra().getByRole("button", { name: "Ficha" })); await aguardarFicha("Lydia");
  });
  it("sem personagem próprio, abre a lista de Personagens (e nunca a ficha alheia)", async () => {
    await montar(jogador, [pc("p3", other.id, "Alheio", "2026-04-01T00:00:00Z", "campaign")]);
    fireEvent.click(barra().getByRole("button", { name: "Ficha" }));
    await screen.findByRole("heading",{name:"Meus personagens"});
    expect(screen.queryByLabelText("Nome")).toBeNull();
  });
});

describe("celular: Inventário dentro da Ficha", () => {
  it("dono: gesto horizontal alterna Ficha/Inventário, adiciona e remove itens, e o salvamento persiste", async () => {
    const store = await montar(jogador, [pc("p1", me.id, "Lydia", "2026-02-01T00:00:00Z", "private", { classe: "Clériga", nivel: 4, inventario: ["Corda"] })]);
    fireEvent.click(barra().getByRole("button", { name: "Ficha" })); await aguardarFicha("Lydia");
    const raiz = () => document.querySelector(".ficha")!;
    deslizar(raiz(), -140);                                                  // para a esquerda: Inventário
    expect(await screen.findByRole("heading", { name: "Inventário" })).toBeTruthy();
    expect(screen.getByText("Corda")).toBeTruthy();
    fireEvent.change(screen.getByLabelText("Nome do item"), { target: { value: "Poção de cura" } });
    fireEvent.click(screen.getByRole("button", { name: "Adicionar" }));
    fireEvent.click(within(screen.getByText("Corda").closest("li")!).getByRole("button", { name: "Remover" }));
    fireEvent.click(screen.getByRole("button", { name: "Salvar" }));
    await screen.findByText("Personagem salvo.");
    expect((store.dados[0].meta as { inventario: string[] }).inventario).toEqual(["Poção de cura"]);
    deslizar(raiz(), 140);                                                   // para a direita: volta à Ficha
    await waitFor(() => expect(screen.queryByRole("heading", { name: "Inventário" })).toBeNull());
  });
  it("gesto majoritariamente vertical não troca de seção (não atrapalha a rolagem)", async () => {
    await montar(jogador, [pc("p1", me.id, "Lydia", "2026-02-01T00:00:00Z")]);
    fireEvent.click(barra().getByRole("button", { name: "Ficha" })); await aguardarFicha("Lydia");
    deslizar(document.querySelector(".ficha")!, -80, 160);
    expect(screen.queryByRole("heading", { name: "Inventário" })).toBeNull();
  });
  it("sem permissão de edição (ficha de outro jogador): só leitura, sem campos de adicionar nem remover", async () => {
    await montar(jogador, [pc("p3", other.id, "Alheio", "2026-04-01T00:00:00Z", "campaign", { classe: "Mago", nivel: 2, inventario: ["Grimório"] })]);
    fireEvent.click(barra().getByRole("button", { name: "Início" }));
    fireEvent.click(await screen.findByRole("button", { name: "Alheio Mago · nível 2" }));
    await screen.findByRole("heading", { name: "Alheio" });
    deslizar(document.querySelector(".ficha")!, -140);
    expect(await screen.findByText("Grimório")).toBeTruthy();
    expect(screen.queryByLabelText("Nome do item")).toBeNull();
    expect(screen.queryByRole("button", { name: "Remover" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Salvar" })).toBeNull();
  });
});

describe("celular: alterações não salvas", () => {
  const abrirFichaSuja = async () => {
    const store = await montar(jogador, [pc("p1", me.id, "Lydia", "2026-02-01T00:00:00Z")]);
    fireEvent.click(barra().getByRole("button", { name: "Ficha" })); await aguardarFicha("Lydia");
    fireEvent.change(screen.getByLabelText("Nome"), { target: { value: "Lydia Editada" } });
    return store;
  };
  it("navegar com alterações pendentes pede confirmação; Cancelar mantém o texto digitado", async () => {
    await abrirFichaSuja();
    fireEvent.click(barra().getByRole("button", { name: "Compêndio" }));
    expect(await screen.findByRole("alertdialog")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(screen.queryByRole("alertdialog")).toBeNull();
    expect((screen.getByLabelText("Nome") as HTMLInputElement).value).toBe("Lydia Editada");
  });
  it("o botão Voltar também respeita a proteção; Descartar alterações conclui a navegação", async () => {
    await abrirFichaSuja();
    fireEvent.click(screen.getByRole("button", { name: "Meus personagens" }));
    expect(await screen.findByRole("alertdialog")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Descartar alterações" }));
    await waitFor(() => expect(screen.queryByLabelText("Nome")).toBeNull());
  });
  it("depois de salvar, navegar não pede confirmação", async () => {
    const store = await abrirFichaSuja();
    fireEvent.click(screen.getByRole("button", { name: "Salvar" }));
    await screen.findByText("Personagem salvo.");
    expect(store.dados[0].title).toBe("Lydia Editada");
    fireEvent.click(barra().getByRole("button", { name: "Compêndio" }));
    await waitFor(() => expect(titulo()).toBe("Compêndio"));
    expect(screen.queryByRole("alertdialog")).toBeNull();
  });
});

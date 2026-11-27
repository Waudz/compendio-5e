// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { storageKey } from "./persistence";
import { memoryStorage, me, renderApp } from "./testUtils";

// Painel de teste: a navegação por abas é testada com um botão de link de conteúdo (os painéis reais têm testes próprios).
vi.mock("./Panel", () => ({ Panel: ({ kind, entity, onOpenContent }: { kind: string; entity: string; onOpenContent: (s: { kind: string; ref: string; title: string }) => void }) =>
  <div><h1>{entity.charAt(0).toUpperCase() + entity.slice(1)}</h1><span>{kind}:{entity}</span><button onClick={() => onOpenContent({ kind: "ficha", ref: "lydia", title: "Ficha: Lydia" })}>Abrir Ficha: Lydia</button></div> }));

let mobile = false;
beforeEach(() => {
  vi.stubGlobal("localStorage", memoryStorage());
  mobile = false;
  vi.stubGlobal("matchMedia", (q: string) => ({ matches: mobile && q.includes("max-width"), media: q, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} }));
  vi.stubGlobal("ResizeObserver", class { observe() {} unobserve() {} disconnect() {} });
});
afterEach(cleanup);

const nav = (name: string) => within(screen.getByRole("navigation", { name: "Menu principal" })).getByRole("button", { name });
const more = (name: string) => fireEvent.click(nav(name), { ctrlKey: true });   // Ctrl+clique: nova aba interna
const tabNames = () => [...document.querySelectorAll(".flexlayout__tabset_tabbar_inner .flexlayout__tab_button_content")].map(e => e.textContent);
const key = storageKey({ user: me.id, campaign: "nenhuma", device: "navegador" });
const saved = () => JSON.parse(localStorage.getItem(key)!);

describe("workspace (interface)", () => {
  it("Ctrl+clique abre seções em novas abas, sem substituir e sem duplicar", async () => {
    await renderApp();
    more("Iniciativa"); more("Encontros"); more("Iniciativa");
    expect(tabNames()).toEqual(["Personagens", "Iniciativa", "Encontros"]);
  });

  it("abre ficha por link de conteúdo (id ficha:ID, aba permanente, sem duplicar) e persiste o layout", async () => {
    vi.spyOn(Element.prototype, "getBoundingClientRect").mockImplementation(() => ({ x: 0, y: 0, left: 0, top: 0, right: 800, bottom: 600, width: 800, height: 600, toJSON() {} }) as DOMRect);   // o jsdom não mede; sem isso o FlexLayout não desenha o conteúdo
    await renderApp();
    fireEvent.click(await screen.findByRole("button", { name: "Abrir Ficha: Lydia" }));          // link de conteúdo: nova aba permanente, origem preservada
    expect(tabNames()).toEqual(["Ficha: Lydia"]);
    more("Personagens");
    fireEvent.click((await screen.findAllByRole("button", { name: "Abrir Ficha: Lydia" }))[0]);          // já aberta: seleciona, não duplica
    expect(tabNames()).toEqual(["Ficha: Lydia", "Personagens"]);
    const tabsSaved = saved().layout.children.flatMap((g: { children: { id: string; pinned?: boolean }[] }) => g.children);
    expect(tabsSaved.map((t: { id: string }) => t.id)).toEqual(["secao:personagens", "secao:personagens~2"]);
    expect(tabsSaved.map((t: { pinned?: boolean }) => t.pinned === true)).toEqual([false, false]);
  });

  it("restaura as abas salvas ao montar de novo", async () => {
    const first = await renderApp();
    more("Compêndio");
    first.unmount();
    await renderApp();
    expect(tabNames()).toEqual(["Personagens", "Compêndio"]);
  });

  it("recupera layout salvo corrompido sem quebrar a tela", async () => {
    localStorage.setItem(key, "{lixo");
    await renderApp();
    expect(tabNames()).toEqual(["Personagens"]);
  });

  it("menu de contexto: mover para nova coluna e fechar aba", async () => {
    await renderApp();
    more("Iniciativa");
    const tab = screen.getByText("Iniciativa", { selector: ".flexlayout__tabset_tabbar_inner .workspace-tab-title" });
    fireEvent.contextMenu(tab);
    const menu = screen.getByRole("menu");
    expect(within(menu).getAllByRole("menuitem").map(i => i.textContent)).toEqual([
      "Fixar aba", "Mover para a coluna à esquerda", "Mover para a coluna à direita", "Abrir em nova coluna à esquerda", "Abrir em nova coluna à direita", "Fechar aba", "Fechar outras abas normais", "Fechar coluna"]);
    fireEvent.click(within(menu).getByRole("menuitem", { name: "Abrir em nova coluna à direita" }));
    expect(screen.queryByRole("menu")).toBeNull();
    expect(saved().layout.children).toHaveLength(2);
    fireEvent.contextMenu(screen.getByText("Iniciativa", { selector: ".flexlayout__tabset_tabbar_inner .workspace-tab-title" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Fechar coluna" }));
    expect(saved().layout.children).toHaveLength(1);
    expect(tabNames()).toEqual(["Personagens"]);
  });

  it("aba única: \"nova coluna\" divide a tela, o painel vazio é salvo e a próxima seção o preenche", async () => {
    await renderApp();
    fireEvent.contextMenu(screen.getByText("Personagens", { selector: ".flexlayout__tabset_tabbar_inner .workspace-tab-title" }));
    const item = screen.getByRole("menuitem", { name: "Abrir em nova coluna à direita" });
    expect((item as HTMLButtonElement).disabled).toBe(false);                    // antes estava desabilitado com aba única
    fireEvent.click(item);
    const groupsSaved = () => saved().layout.children as { children: { id: string }[] }[];
    expect(groupsSaved().map(g => g.children.length).sort()).toEqual([0, 1]);   // painel vazio persistido
    fireEvent.click(nav("Iniciativa"));                                           // o painel vazio é o ativo: recebe a seção
    expect(groupsSaved().map(g => g.children.map(t => t.id))).toEqual([["secao:iniciativa"], ["secao:personagens"]]);
  });

  it("menu de contexto fecha com Escape", async () => {
    await renderApp();
    fireEvent.contextMenu(screen.getByText("Personagens", { selector: ".flexlayout__tabset_tabbar_inner .workspace-tab-title" }));
    expect(screen.getByRole("menu")).toBeTruthy();
    fireEvent.keyDown(window, { key: "Escape" });
    expect(screen.queryByRole("menu")).toBeNull();
  });

  it("recolhe e expande o menu lateral", async () => {
    await renderApp();
    expect(document.querySelector(".sidebar.collapsed")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Expandir menu" }));
    expect(document.querySelector(".sidebar.collapsed")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Recolher menu" }));
    expect(document.querySelector(".sidebar.collapsed")).toBeTruthy();
  });

  it("celular: usa a visão simples (sem FlexLayout e sem abas), abre pelo menu e volta pelo histórico", async () => {
    mobile = true;
    await renderApp();
    expect(document.querySelector(".flexlayout__layout")).toBeNull();
    expect(screen.queryByRole("tablist")).toBeNull();                                            // sem abas nem colunas no celular
    expect(document.querySelector(".mobile-simple")).toBeTruthy();
    fireEvent.click(within(screen.getByRole("navigation", { name: "Navegação mobile" })).getByRole("button", { name: "Menu" }));
    fireEvent.click(within(await screen.findByRole("dialog", { name: "Menu de navegação" })).getByRole("button", { name: "Minha conta" }));
    expect(await screen.findByRole("heading", { name: "Perfil" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Voltar" }));                             // histórico próprio (botão Voltar)
    await waitFor(() => expect(screen.queryByRole("heading", { name: "Perfil" })).toBeNull());
    expect((screen.getByRole("button", { name: "Voltar" }) as HTMLButtonElement).disabled).toBe(true);   // voltou à tela inicial
    expect(screen.queryByRole("tablist")).toBeNull();
  });
});

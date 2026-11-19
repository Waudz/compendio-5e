// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import App from "./App";
import { storageKey } from "./persistence";

let mobile = false;
beforeEach(() => {
  const mem = new Map<string, string>();
  vi.stubGlobal("localStorage", { getItem: (k: string) => mem.get(k) ?? null, setItem: (k: string, v: string) => { mem.set(k, v); }, clear: () => mem.clear() });
  mobile = false;
  vi.stubGlobal("matchMedia", (q: string) => ({ matches: mobile && q.includes("max-width"), media: q, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} }));
  vi.stubGlobal("ResizeObserver", class { observe() {} unobserve() {} disconnect() {} });
});
afterEach(cleanup);

const nav = (name: string) => within(screen.getByRole("navigation", { name: "Menu principal" })).getByRole("button", { name });
const tabNames = () => [...document.querySelectorAll(".flexlayout__tabset_tabbar_inner .flexlayout__tab_button_content")].map(e => e.textContent);
const saved = () => JSON.parse(localStorage.getItem(storageKey())!);

describe("workspace (interface)", () => {
  it("abre seções pelo menu lateral sem substituir abas e sem duplicar", () => {
    render(<App/>);
    fireEvent.click(nav("Iniciativa")); fireEvent.click(nav("Encontros")); fireEvent.click(nav("Iniciativa"));
    expect(tabNames()).toEqual(["Personagens", "Iniciativa", "Encontros"]);
  });

  it("abre ficha por botão do conteúdo (id ficha:ID, sem duplicar) e persiste o layout", () => {
    mobile = true; // o jsdom não mede tamanhos, então o conteúdo do FlexLayout não é desenhado; a visão simples usa o mesmo estado
    render(<App/>);
    fireEvent.click(screen.getByRole("button", { name: "Abrir Ficha: Lydia" }));
    fireEvent.click(nav("Personagens")); fireEvent.click(screen.getByRole("button", { name: "Abrir Ficha: Lydia" }));
    expect(within(screen.getByRole("tablist")).getAllByRole("tab").map(t => t.textContent)).toEqual(["Personagens", "Ficha: Lydia"]);
    const ids = saved().layout.children[0].children.map((t: { id: string }) => t.id);
    expect(ids).toEqual(["secao:personagens", "ficha:lydia"]);
  });

  it("restaura as abas salvas ao montar de novo", () => {
    const first = render(<App/>);
    fireEvent.click(nav("Compêndio"));
    first.unmount();
    render(<App/>);
    expect(tabNames()).toEqual(["Personagens", "Compêndio"]);
  });

  it("recupera layout salvo corrompido sem quebrar a tela", () => {
    localStorage.setItem(storageKey(), "{lixo");
    render(<App/>);
    expect(tabNames()).toEqual(["Personagens"]);
  });

  it("menu de contexto: mover para nova coluna e fechar aba", () => {
    render(<App/>);
    fireEvent.click(nav("Iniciativa"));
    const tab = screen.getByText("Iniciativa", { selector: ".flexlayout__tabset_tabbar_inner .flexlayout__tab_button_content" });
    fireEvent.contextMenu(tab);
    const menu = screen.getByRole("menu");
    expect(within(menu).getAllByRole("menuitem").map(i => i.textContent)).toEqual([
      "Mover para a coluna à esquerda", "Mover para a coluna à direita", "Abrir em nova coluna à esquerda", "Abrir em nova coluna à direita", "Fechar aba", "Fechar outras abas", "Fechar coluna"]);
    fireEvent.click(within(menu).getByRole("menuitem", { name: "Abrir em nova coluna à direita" }));
    expect(screen.queryByRole("menu")).toBeNull();
    expect(saved().layout.children).toHaveLength(2);
    fireEvent.contextMenu(screen.getByText("Iniciativa", { selector: ".flexlayout__tabset_tabbar_inner .flexlayout__tab_button_content" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Fechar coluna" }));
    expect(saved().layout.children).toHaveLength(1);
    expect(tabNames()).toEqual(["Personagens"]);
  });

  it("menu de contexto fecha com Escape", () => {
    render(<App/>);
    fireEvent.contextMenu(screen.getByText("Personagens", { selector: ".flexlayout__tabset_tabbar_inner .flexlayout__tab_button_content" }));
    expect(screen.getByRole("menu")).toBeTruthy();
    fireEvent.keyDown(window, { key: "Escape" });
    expect(screen.queryByRole("menu")).toBeNull();
  });

  it("recolhe e expande o menu lateral", () => {
    render(<App/>);
    fireEvent.click(screen.getByRole("button", { name: "Recolher menu" }));
    expect(document.querySelector(".sidebar.collapsed")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Expandir menu" }));
    expect(document.querySelector(".sidebar.collapsed")).toBeNull();
  });

  it("celular: usa a visão simples (sem FlexLayout), abre pela barra e fecha abas", () => {
    mobile = true;
    render(<App/>);
    expect(document.querySelector(".flexlayout__layout")).toBeNull();
    fireEvent.click(nav("Iniciativa"));
    const tabs = within(screen.getByRole("tablist")).getAllByRole("tab").map(t => t.textContent);
    expect(tabs).toEqual(["Personagens", "Iniciativa"]);
    expect(screen.getByRole("heading", { name: "Iniciativa" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Fechar Iniciativa" }));
    expect(within(screen.getByRole("tablist")).getAllByRole("tab")).toHaveLength(1);
  });
});

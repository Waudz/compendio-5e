// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, screen, within } from "@testing-library/react";
import { storageKey } from "./persistence";
import { memoryStorage, me, renderApp } from "./testUtils";

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

  it("abre ficha por botão do conteúdo (id ficha:ID, sem duplicar) e persiste o layout", async () => {
    mobile = true; // o jsdom não mede tamanhos, então o conteúdo do FlexLayout não é desenhado; a visão simples usa o mesmo estado
    await renderApp();
    fireEvent.click(screen.getByRole("button", { name: "Abrir Ficha: Lydia" }));                 // clique normal: reutiliza a aba atual
    expect(within(screen.getByRole("tablist")).getAllByRole("tab").map(t => t.textContent)).toEqual(["Ficha: Lydia"]);
    more("Personagens");
    fireEvent.click(screen.getByRole("button", { name: "Abrir Ficha: Lydia" }));                 // já aberta: seleciona, não duplica
    expect(within(screen.getByRole("tablist")).getAllByRole("tab").map(t => t.textContent)).toEqual(["Ficha: Lydia", "Personagens"]);
    const ids = saved().layout.children[0].children.map((t: { id: string }) => t.id);
    expect(ids).toEqual(["ficha:lydia", "secao:personagens"]);
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
    const tab = screen.getByText("Iniciativa", { selector: ".flexlayout__tabset_tabbar_inner .flexlayout__tab_button_content" });
    fireEvent.contextMenu(tab);
    const menu = screen.getByRole("menu");
    expect(within(menu).getAllByRole("menuitem").map(i => i.textContent)).toEqual([
      "Fixar aba", "Mover para a coluna à esquerda", "Mover para a coluna à direita", "Abrir em nova coluna à esquerda", "Abrir em nova coluna à direita", "Fechar aba", "Fechar outras abas normais", "Fechar coluna"]);
    fireEvent.click(within(menu).getByRole("menuitem", { name: "Abrir em nova coluna à direita" }));
    expect(screen.queryByRole("menu")).toBeNull();
    expect(saved().layout.children).toHaveLength(2);
    fireEvent.contextMenu(screen.getByText("Iniciativa", { selector: ".flexlayout__tabset_tabbar_inner .flexlayout__tab_button_content" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Fechar coluna" }));
    expect(saved().layout.children).toHaveLength(1);
    expect(tabNames()).toEqual(["Personagens"]);
  });

  it("menu de contexto fecha com Escape", async () => {
    await renderApp();
    fireEvent.contextMenu(screen.getByText("Personagens", { selector: ".flexlayout__tabset_tabbar_inner .flexlayout__tab_button_content" }));
    expect(screen.getByRole("menu")).toBeTruthy();
    fireEvent.keyDown(window, { key: "Escape" });
    expect(screen.queryByRole("menu")).toBeNull();
  });

  it("recolhe e expande o menu lateral", async () => {
    await renderApp();
    fireEvent.click(screen.getByRole("button", { name: "Recolher menu" }));
    expect(document.querySelector(".sidebar.collapsed")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Expandir menu" }));
    expect(document.querySelector(".sidebar.collapsed")).toBeNull();
  });

  it("celular: usa a visão simples (sem FlexLayout), abre pela barra e fecha abas", async () => {
    mobile = true;
    await renderApp();
    expect(document.querySelector(".flexlayout__layout")).toBeNull();
    more("Iniciativa");
    const tabs = within(screen.getByRole("tablist")).getAllByRole("tab").map(t => t.textContent);
    expect(tabs).toEqual(["Personagens", "Iniciativa"]);
    expect(screen.getByRole("heading", { name: "Iniciativa" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Fechar Iniciativa" }));
    expect(within(screen.getByRole("tablist")).getAllByRole("tab")).toHaveLength(1);
  });
});

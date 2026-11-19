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
const tabNames = () => [...document.querySelectorAll(".flexlayout__tabset_tabbar_inner .flexlayout__tab_button_content")].map(e => e.textContent);
const key = storageKey({ user: me.id, campaign: "nenhuma", device: "navegador" });
const saved = () => JSON.parse(localStorage.getItem(key)!);

describe("workspace (interface)", () => {
  it("abre seções pelo menu lateral sem substituir abas e sem duplicar", async () => {
    await renderApp();
    fireEvent.click(nav("Iniciativa")); fireEvent.click(nav("Encontros")); fireEvent.click(nav("Iniciativa"));
    expect(tabNames()).toEqual(["Personagens", "Iniciativa", "Encontros"]);
  });

  it("abre ficha por botão do conteúdo (id ficha:ID, sem duplicar) e persiste o layout", async () => {
    mobile = true; // o jsdom não mede tamanhos, então o conteúdo do FlexLayout não é desenhado; a visão simples usa o mesmo estado
    await renderApp();
    fireEvent.click(screen.getByRole("button", { name: "Abrir Ficha: Lydia" }));
    fireEvent.click(nav("Personagens")); fireEvent.click(screen.getByRole("button", { name: "Abrir Ficha: Lydia" }));
    expect(within(screen.getByRole("tablist")).getAllByRole("tab").map(t => t.textContent)).toEqual(["Personagens", "Ficha: Lydia"]);
    const ids = saved().layout.children[0].children.map((t: { id: string }) => t.id);
    expect(ids).toEqual(["secao:personagens", "ficha:lydia"]);
  });

  it("restaura as abas salvas ao montar de novo", async () => {
    const first = await renderApp();
    fireEvent.click(nav("Compêndio"));
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

  it("aba única: \"nova coluna\" divide a tela, o painel vazio é salvo e a próxima seção o preenche", async () => {
    await renderApp();
    fireEvent.contextMenu(screen.getByText("Personagens", { selector: ".flexlayout__tabset_tabbar_inner .flexlayout__tab_button_content" }));
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
    fireEvent.click(nav("Iniciativa"));
    const tabs = within(screen.getByRole("tablist")).getAllByRole("tab").map(t => t.textContent);
    expect(tabs).toEqual(["Personagens", "Iniciativa"]);
    expect(screen.getByRole("heading", { name: "Iniciativa" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Fechar Iniciativa" }));
    expect(within(screen.getByRole("tablist")).getAllByRole("tab")).toHaveLength(1);
  });
});

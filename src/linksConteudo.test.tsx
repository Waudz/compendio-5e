// @vitest-environment jsdom
// Links internos de conteúdo (decisão de 19/11/2026): abrem aba PERMANENTE ao lado da origem, sem substituir nada, sem duplicar,
// em qualquer número de painéis. O menu lateral continua reutilizando a aba atual.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, screen, within } from "@testing-library/react";
import { storageKey } from "./persistence";
import { me, memoryStorage, renderApp } from "./testUtils";

// Painel de teste: seções com botões de link de conteúdo (e de abertura administrativa) e um editor que registra alterações não salvas.
vi.mock("./Panel", async () => {
  const { useState } = await import("react");
  const { useUnsavedGuard } = await import("./unsaved");
  function Doc({ id }: { id: string }) {
    const [text, setText] = useState("");
    useUnsavedGuard(`documento:${id}`, text !== "");
    return <textarea aria-label={`Texto ${id}`} value={text} onChange={e => setText(e.target.value)}/>;
  }
  type Spec = { kind: string; ref: string; title?: string };
  type P = { kind: string; entity: string; onOpen: (s: Spec, m?: string) => void; onOpenContent: (s: Spec) => void };
  return { Panel: ({ kind, entity, onOpen, onOpenContent }: P) => kind === "documento"
    ? <Doc id={entity}/>
    : <div><span>{kind}:{entity}</span>
        <button onClick={() => onOpenContent({ kind: "documento", ref: "d1", title: "Resumo da Sessão 3" })}>link d1</button>
        <button onClick={() => onOpenContent({ kind: "documento", ref: "d2", title: "Outro doc" })}>link d2</button>
        <button onClick={() => onOpen({ kind: "documento", ref: "d1", title: "Resumo da Sessão 3" }, "new")}>abrir d1 pelo menu</button></div> };
});

let mobile = false;
beforeEach(() => {
  vi.stubGlobal("localStorage", memoryStorage());
  mobile = false;
  vi.stubGlobal("matchMedia", (q: string) => ({ matches: mobile && q.includes("max-width"), media: q, addEventListener() {}, removeEventListener() {} }));
  vi.stubGlobal("ResizeObserver", class { observe() {} unobserve() {} disconnect() {} });
  vi.spyOn(Element.prototype, "getBoundingClientRect").mockImplementation(() => ({ x: 0, y: 0, left: 0, top: 0, right: 800, bottom: 600, width: 800, height: 600, toJSON() {} }) as DOMRect);
  window.history.pushState({}, "", "/");
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

const nav = (name: string) => within(screen.getByRole("navigation", { name: "Menu principal" })).getByRole("button", { name });
const strip = ".flexlayout__tabset_tabbar_inner .flexlayout__tab_button_content";
const rawTabs = () => [...document.querySelectorAll(strip)].map(e => e.textContent);
const tabs = () => rawTabs().map(t => t?.replace(/\s*\(fixada\)$/, ""));
const tabEl = (name: string) => screen.getByText(name, { selector: strip });
const key = storageKey({ user: me.id, campaign: "nenhuma", device: "navegador" });
const saved = () => JSON.parse(localStorage.getItem(key)!);
const menuItems = () => within(screen.getByRole("menu")).getAllByRole("menuitem").map(i => i.textContent);
const pick = (name: string) => fireEvent.click(within(screen.getByRole("menu")).getByRole("menuitem", { name }));
const link = (name = "link d1", index = 0) => fireEvent.click(screen.getAllByRole("button", { name })[index]);

describe("link de conteúdo (desktop)", () => {
  it("abre uma aba permanente (fixada) ao lado da origem, que permanece intacta e normal", async () => {
    await renderApp();
    link();
    expect(tabs()).toEqual(["Personagens", "Resumo da Sessão 3"]);
    expect(rawTabs()).toEqual(["Personagens", "Resumo da Sessão 3 (fixada)"]);
  });

  it("o clique normal do menu depois do link reutiliza a aba normal e preserva a permanente", async () => {
    await renderApp();
    link();                                                                  // seleciona a nova aba (fixada)
    fireEvent.click(nav("Iniciativa"));                                      // a fixada não é substituída: troca a aba normal
    expect(tabs()).toEqual(["Iniciativa", "Resumo da Sessão 3"]);
    expect(rawTabs()[1]).toBe("Resumo da Sessão 3 (fixada)");
  });

  it("o registro já aberto é selecionado: sem duplicar e sem mudar a fixação da aba existente", async () => {
    await renderApp();
    fireEvent.click(screen.getByRole("button", { name: "abrir d1 pelo menu" }));   // aberta antes, como aba normal
    expect(rawTabs()).toEqual(["Personagens", "Resumo da Sessão 3"]);
    fireEvent.click(tabEl("Personagens"));
    link();
    expect(tabs()).toEqual(["Personagens", "Resumo da Sessão 3"]);
    expect(rawTabs()[1]).toBe("Resumo da Sessão 3");                          // continua não fixada
    expect(document.querySelector(".flexlayout__tab_button--selected")?.textContent).toContain("Resumo da Sessão 3");
  });

  it("não substitui nem fecha aba com alterações não salvas e não pede confirmação", async () => {
    await renderApp();
    link("link d1");
    fireEvent.change(await screen.findByLabelText("Texto d1"), { target: { value: "rascunho" } });
    fireEvent.click(tabEl("Personagens"));
    link("link d2");
    expect(screen.queryByRole("alertdialog")).toBeNull();
    expect(tabs()).toEqual(["Personagens", "Outro doc", "Resumo da Sessão 3"]);   // ao lado da origem
    fireEvent.click(tabEl("Resumo da Sessão 3"));
    expect((screen.getByLabelText("Texto d1") as HTMLTextAreaElement).value).toBe("rascunho");
  });

  it("com dois painéis, abre no painel da aba de origem e não mexe no outro", async () => {
    await renderApp();
    fireEvent.click(nav("Iniciativa"), { ctrlKey: true });
    fireEvent.contextMenu(tabEl("Iniciativa")); pick("Abrir em nova coluna à direita");
    expect(saved().layout.children.map((g: { children: { id: string }[] }) => g.children.map(t => t.id))).toEqual([["secao:personagens"], ["secao:iniciativa"]]);
    link("link d1", 1);                                                     // botão do painel da direita (origem: Iniciativa)
    const groups = saved().layout.children as { children: { id: string; pinned?: boolean }[] }[];
    expect(groups[0].children.map(t => t.id)).toEqual(["secao:personagens"]);
    expect(groups[1].children.map(t => t.id)).toEqual(["secao:iniciativa", "documento:d1"]);
    expect(groups[1].children[1].pinned).toBe(true);
    link("link d1", 0);                                                     // do outro painel: seleciona a existente, não cria cópia
    expect(JSON.stringify(saved().layout)).toMatch(/documento:d1/); expect((JSON.stringify(saved().layout).match(/documento:d1/g) ?? []).length).toBe(1);
  });

  it("com três painéis o registro continua único e vai para o painel de quem clicou", async () => {
    await renderApp();
    fireEvent.click(nav("Iniciativa"), { ctrlKey: true }); fireEvent.click(nav("Encontros"), { ctrlKey: true });
    fireEvent.contextMenu(tabEl("Iniciativa")); pick("Abrir em nova coluna à direita");
    fireEvent.contextMenu(tabEl("Encontros")); pick("Abrir em nova coluna à direita");
    expect(saved().layout.children).toHaveLength(3);
    link("link d2", 2);
    const groups = saved().layout.children as { children: { id: string }[] }[];
    expect(groups.map(g => g.children.map(t => t.id))).toEqual([["secao:personagens"], ["secao:iniciativa"], ["secao:encontros", "documento:d2"]]);
  });

  it("a marca de permanente é salva sem títulos e restaurada ao recarregar", async () => {
    const first = await renderApp();
    link();
    expect(saved().layout.children[0].children.find((t: { id: string }) => t.id === "documento:d1").pinned).toBe(true);
    expect(localStorage.getItem(key)).not.toMatch(/"name"|Resumo/);
    first.unmount();
    await renderApp();
    expect(rawTabs()).toEqual(["Personagens", "Documento d1 (fixada)"]);       // título vem do rótulo padrão (nada de nome gravado)
  });

  it("a aba permanente pode ser desafixada e fechada manualmente pelo menu da aba", async () => {
    await renderApp(); link();
    fireEvent.contextMenu(tabEl("Resumo da Sessão 3")); expect(menuItems()[0]).toBe("Desafixar aba"); pick("Desafixar aba");
    expect(rawTabs()).toEqual(["Personagens", "Resumo da Sessão 3"]);
    fireEvent.contextMenu(tabEl("Resumo da Sessão 3")); pick("Fechar aba");
    expect(tabs()).toEqual(["Personagens"]);
  });
});

describe("link de conteúdo (celular, 375 px)", () => {
  beforeEach(() => { mobile = true; Object.defineProperty(window, "innerWidth", { value: 375, configurable: true }); });

  it("abre o conteúdo na tela atual (sem abas), preserva a origem no histórico (uma volta basta)", async () => {
    await renderApp();
    expect(screen.queryByRole("tablist")).toBeNull();
    link();
    expect(document.querySelector(".mobile-page-title")?.textContent).toBe("Resumo da Sessão 3");
    fireEvent.click(screen.getByRole("button", { name: "Voltar" }));         // uma única volta leva à origem
    expect(document.querySelector(".mobile-page-title")?.textContent).not.toBe("Resumo da Sessão 3");
    expect(screen.queryByRole("tablist")).toBeNull();
  });
});

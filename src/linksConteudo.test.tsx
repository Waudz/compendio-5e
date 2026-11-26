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
const tabEl = (name: string) => screen.getByText(name, { selector: ".flexlayout__tabset_tabbar_inner .workspace-tab-title" });
const key = storageKey({ user: me.id, campaign: "nenhuma", device: "navegador" });
const saved = () => JSON.parse(localStorage.getItem(key)!);
const menuItems = () => within(screen.getByRole("menu")).getAllByRole("menuitem").map(i => i.textContent);
const pick = (name: string) => fireEvent.click(within(screen.getByRole("menu")).getByRole("menuitem", { name }));
const link = (name = "link d1", index = 0) => fireEvent.click(screen.getAllByRole("button", { name })[index]);

describe("link de conteúdo (desktop)", () => {
  it("substitui somente a página da aba, sem split, e permite voltar e avançar",async()=>{
    await renderApp();link();expect(tabs()).toEqual(["Resumo da Sessão 3"]);
    expect(saved().layout.children).toHaveLength(1);
    fireEvent.click(screen.getByRole("button",{name:"Voltar na aba"}));
    expect(tabs()).toEqual(["Personagens"]);
    fireEvent.click(screen.getByRole("button",{name:"Avançar na aba"}));
    expect(await screen.findByLabelText("Texto d1")).toBeTruthy();
  });
  it("menu lateral abre outra aba e preserva documento e histórico",async()=>{
    await renderApp();link();fireEvent.click(nav("Iniciativa"));
    expect(tabs()).toEqual(["Resumo da Sessão 3","Iniciativa"]);
    expect(rawTabs()).not.toContain("Resumo da Sessão 3 (fixada)");
  });
  it("registro já aberto é selecionado, sem duplicação",async()=>{
    await renderApp();fireEvent.click(screen.getByRole("button",{name:"abrir d1 pelo menu"}));
    fireEvent.click(tabEl("Personagens"));link();
    expect(tabs()).toEqual(["Personagens","Resumo da Sessão 3"]);
  });
  it("voltar protege edição; cancelar mantém texto e descartar volta",async()=>{
    await renderApp();link();fireEvent.change(await screen.findByLabelText("Texto d1"),{target:{value:"rascunho"}});
    fireEvent.click(screen.getByRole("button",{name:"Voltar na aba"}));
    expect(screen.getByRole("alertdialog")).toBeTruthy();
    fireEvent.click(screen.getByRole("button",{name:"Cancelar"}));
    expect((screen.getByLabelText("Texto d1") as HTMLTextAreaElement).value).toBe("rascunho");
    fireEvent.click(screen.getByRole("button",{name:"Voltar na aba"}));
    fireEvent.click(screen.getByRole("button",{name:"Descartar alterações"}));
    expect(tabs()).toEqual(["Personagens"]);
  });
  it("restaura histórico sem nomes privados e permite recuperar aba fechada",async()=>{
    const first=await renderApp();link();expect(localStorage.getItem(key)).not.toMatch(/Resumo/);
    first.unmount();await renderApp();expect(tabs()).toEqual(["Documento d1"]);
    fireEvent.contextMenu(tabEl("Documento d1"));expect(menuItems()[0]).toBe("Fixar aba");pick("Fechar aba");
    fireEvent.click(screen.getByRole("button",{name:"Reabrir aba fechada"}));
    expect(tabs()).toEqual(["Documento d1"]);
    fireEvent.keyDown(window,{altKey:true,key:"ArrowLeft"});expect(tabs()).toEqual(["Personagens"]);
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

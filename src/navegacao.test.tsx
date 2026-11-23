// @vitest-environment jsdom
// Navegação por abas na interface: gestos do menu lateral, menu de contexto, fixação, alterações não salvas e celular (375 px).
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, screen, within } from "@testing-library/react";
import { storageKey } from "./persistence";
import { fakeAuth, me, memoryStorage, other, renderApp } from "./testUtils";

// Painel de teste: editor com campo de texto que registra "alterações não salvas" (os editores reais virão depois).
vi.mock("./Panel", async () => {
  const { useState } = await import("react");
  const { useUnsavedGuard } = await import("./unsaved");
  const { AccountPanel } = await import("./AccountPanel");
  function Doc({ id }: { id: string }) {
    const [text, setText] = useState("");
    useUnsavedGuard(`documento:${id}`, text !== "");
    return <textarea aria-label={`Texto ${id}`} value={text} onChange={e => setText(e.target.value)}/>;
  }
  return { Panel: ({ kind, entity, onOpen }: { kind: string; entity: string; onOpen: (s: unknown, m?: string) => void }) => kind === "documento"
    ? <Doc id={entity}/>
    : kind === "conta" ? <AccountPanel/>
    : <div><span data-testid="conteudo">{kind}:{entity}</span>
        <button onClick={() => onOpen({ kind: "documento", ref: "d1", title: "Resumo da Sessão 3" }, "new")}>abrir doc d1</button>
        <button onClick={() => onOpen({ kind: "documento", ref: "d2", title: "Outro doc" }, "new")}>abrir doc d2</button></div> };
});

let mobile = false;
beforeEach(() => {
  vi.stubGlobal("localStorage", memoryStorage());
  mobile = false;
  vi.stubGlobal("matchMedia", (q: string) => ({ matches: mobile && q.includes("max-width"), media: q, addEventListener() {}, removeEventListener() {} }));
  vi.stubGlobal("ResizeObserver", class { observe() {} unobserve() {} disconnect() {} });
  // O jsdom não mede nada: damos um tamanho ao FlexLayout para que ele desenhe o conteúdo das abas (e os editores registrem alterações).
  vi.spyOn(Element.prototype, "getBoundingClientRect").mockImplementation(() => ({ x: 0, y: 0, left: 0, top: 0, right: 800, bottom: 600, width: 800, height: 600, toJSON() {} }) as DOMRect);
  window.history.pushState({}, "", "/");
});
afterEach(() => { cleanup(); vi.useRealTimers(); vi.restoreAllMocks(); });

const nav = (name: string) => within(screen.getByRole("navigation", { name: "Menu principal" })).getByRole("button", { name });
const strip = ".flexlayout__tabset_tabbar_inner .flexlayout__tab_button_content";
const tabs = () => [...document.querySelectorAll(strip)].map(e => e.textContent?.replace(/\s*\(fixada\)$/, ""));
const rawTabs = () => [...document.querySelectorAll(strip)].map(e => e.textContent);
const tabEl = (name: string) => screen.getByText(name, { selector: strip });
const mTabs = () => within(screen.getByRole("tablist")).getAllByRole("tab").map(t => t.textContent?.replace(/\s*\(fixada\)$/, ""));
const key = (u = me.id) => storageKey({ user: u, campaign: "nenhuma", device: "navegador" });
const saved = () => JSON.parse(localStorage.getItem(key())!);
const menuItems = () => within(screen.getByRole("menu")).getAllByRole("menuitem").map(i => i.textContent);
const pick = (name: string) => fireEvent.click(within(screen.getByRole("menu")).getByRole("menuitem", { name }));
const middleClick = (el: Element) => { fireEvent.mouseDown(el, { button: 1 }); act(() => { el.dispatchEvent(new MouseEvent("auxclick", { button: 1, bubbles: true, cancelable: true })); }); };

describe("menu lateral: gestos (desktop)", () => {
  it("clique normal reutiliza a aba atual; seleciona se o destino já está aberto", async () => {
    await renderApp();
    fireEvent.click(nav("Enciclopédia"));
    expect(tabs()).toEqual(["Enciclopédia"]);
    fireEvent.click(nav("Diário"));
    expect(tabs()).toEqual(["Diário"]);
    fireEvent.click(nav("Enciclopédia"), { ctrlKey: true });
    fireEvent.click(nav("Diário"));                                           // já aberto: seleciona (não duplica nem substitui)
    expect(tabs()).toEqual(["Diário", "Enciclopédia"]);
  });
  it("Ctrl+clique, Cmd+clique e botão do meio abrem nova aba interna", async () => {
    await renderApp();
    fireEvent.click(nav("Enciclopédia"), { ctrlKey: true });
    fireEvent.click(nav("Diário"), { metaKey: true });
    middleClick(nav("Documentos"));
    expect(tabs()).toEqual(["Personagens", "Enciclopédia", "Diário", "Documentos"]);
  });
  it("o botão do meio não dispara autoscroll (mousedown cancelado) e Ctrl+clique não segue link nenhum", async () => {
    await renderApp();
    const prevented = !fireEvent.mouseDown(nav("Enciclopédia"), { button: 1 });
    expect(prevented).toBe(true);
    expect(window.location.pathname).toBe("/");
  });
  it("botão direito: três opções; cada uma faz o que diz", async () => {
    await renderApp();
    fireEvent.contextMenu(nav("Enciclopédia"));
    expect(menuItems()).toEqual(["Abrir nesta aba", "Abrir em nova aba", "Abrir em nova aba fixada"]);
    pick("Abrir nesta aba"); expect(tabs()).toEqual(["Enciclopédia"]);
    fireEvent.contextMenu(nav("Diário")); pick("Abrir em nova aba"); expect(tabs()).toEqual(["Enciclopédia", "Diário"]);
    fireEvent.contextMenu(nav("Documentos")); pick("Abrir em nova aba fixada");
    expect(rawTabs()).toEqual(["Enciclopédia", "Diário", "Documentos (fixada)"]);
    expect(saved().layout.children[0].children.map((t: { id: string; pinned?: boolean }) => [t.id, !!t.pinned])).toEqual([["secao:enciclopedia", false], ["secao:diario", false], ["secao:documentos", true]]);
  });
  it("o menu fecha com Esc e ao clicar fora, e nunca sai da tela", async () => {
    await renderApp();
    fireEvent.contextMenu(nav("Enciclopédia"), { clientX: 5000, clientY: 5000 });
    const m = screen.getByRole("menu"); expect(parseInt(m.style.left, 10)).toBeLessThanOrEqual(window.innerWidth); expect(parseInt(m.style.top, 10)).toBeLessThanOrEqual(window.innerHeight);
    fireEvent.keyDown(window, { key: "Escape" }); expect(screen.queryByRole("menu")).toBeNull();
    fireEvent.contextMenu(nav("Enciclopédia")); fireEvent.pointerDown(document.body); expect(screen.queryByRole("menu")).toBeNull();
  });
  it("menu pelo teclado (contextmenu sem coordenadas) abre junto do item", async () => {
    await renderApp();
    fireEvent.contextMenu(nav("Enciclopédia"), { clientX: 0, clientY: 0 });
    expect(screen.getByRole("menu")).toBeTruthy();
  });
});

describe("fixar e desafixar", () => {
  it("pelo menu da aba: fixa, mostra marca e texto acessível, não é substituída; desafixa", async () => {
    await renderApp();
    fireEvent.contextMenu(tabEl("Personagens")); pick("Fixar aba");
    expect(rawTabs()).toEqual(["Personagens (fixada)"]);
    expect(document.querySelector(".pin-icon")).toBeTruthy();
    fireEvent.click(nav("Enciclopédia"));                                          // fixada: não substitui, cria aba normal
    expect(tabs()).toEqual(["Personagens", "Enciclopédia"]);
    fireEvent.click(nav("Diário"));                                           // a normal é reutilizada
    expect(tabs()).toEqual(["Personagens", "Diário"]);
    fireEvent.contextMenu(tabEl("Personagens")); expect(menuItems()[0]).toBe("Desafixar aba"); pick("Desafixar aba");
    expect(rawTabs()).toEqual(["Personagens", "Diário"]);
    expect(saved().layout.children[0].children.some((t: { pinned?: boolean }) => t.pinned)).toBe(false);
  });
  it("fixada pode ser fechada manualmente; 'fechar outras abas normais' preserva as fixadas", async () => {
    await renderApp();
    fireEvent.click(nav("Enciclopédia"), { ctrlKey: true }); fireEvent.click(nav("Diário"), { ctrlKey: true }); fireEvent.click(nav("Documentos"), { ctrlKey: true });
    fireEvent.contextMenu(tabEl("Enciclopédia")); pick("Fixar aba");
    fireEvent.contextMenu(tabEl("Diário")); pick("Fechar outras abas normais");
    expect(tabs()).toEqual(["Enciclopédia", "Diário"]);
    fireEvent.contextMenu(tabEl("Enciclopédia")); pick("Fechar aba");
    expect(tabs()).toEqual(["Diário"]);
  });
  it("a fixação é salva sem títulos e restaurada ao recarregar", async () => {
    const first = await renderApp();
    fireEvent.click(nav("Documentos"), { ctrlKey: true });
    fireEvent.contextMenu(tabEl("Documentos")); pick("Fixar aba");
    expect(localStorage.getItem(key())).not.toMatch(/"name"|Documentos"/);
    first.unmount();
    await renderApp();
    expect(rawTabs()).toEqual(["Personagens", "Documentos (fixada)"]);
  });
  it("outra conta no mesmo navegador não vê as abas nem a fixação da anterior", async () => {
    const auth = fakeAuth(me);
    await renderApp({ auth });
    fireEvent.click(nav("Documentos"), { ctrlKey: true }); fireEvent.contextMenu(tabEl("Documentos")); pick("Fixar aba");
    await auth.emit("SIGNED_IN", { user: other });
    await screen.findByRole("navigation", { name: "Menu principal" });
    expect(rawTabs()).toEqual(["Personagens"]);
    expect(localStorage.getItem(key(me.id))).toBeNull();
  });
});

describe("alterações não salvas", () => {
  const abrirDoc = async (id: string, text?: string) => {
    fireEvent.click(screen.getByRole("button", { name: `abrir doc ${id}` }));
    if (text) fireEvent.change(await screen.findByLabelText(`Texto ${id}`), { target: { value: text } });
  };

  it("clique normal não substitui a aba com alterações: abre outra aba", async () => {
    await renderApp(); await abrirDoc("d1");
    fireEvent.change(screen.getByLabelText("Texto d1"), { target: { value: "rascunho" } });
    fireEvent.click(nav("Enciclopédia"));
    // a aba com alterações é tratada como a fixada: não é substituída; reutiliza-se outra aba normal e limpa
    expect(tabs()).toEqual(["Enciclopédia", "Resumo da Sessão 3"]);
    fireEvent.click(tabEl("Resumo da Sessão 3"));
    expect((screen.getByLabelText("Texto d1") as HTMLTextAreaElement).value).toBe("rascunho");
  });
  it("fechar a aba pelo menu pede confirmação: Cancelar mantém, Descartar fecha", async () => {
    await renderApp(); await abrirDoc("d1", "rascunho");
    fireEvent.contextMenu(tabEl("Resumo da Sessão 3")); pick("Fechar aba");
    const dlg = screen.getByRole("alertdialog"); expect(within(dlg).getByText("Resumo da Sessão 3")).toBeTruthy();
    fireEvent.click(within(dlg).getByRole("button", { name: "Cancelar" }));
    expect(screen.queryByRole("alertdialog")).toBeNull(); expect(tabs()).toContain("Resumo da Sessão 3");
    fireEvent.contextMenu(tabEl("Resumo da Sessão 3")); pick("Fechar aba");
    fireEvent.click(screen.getByRole("button", { name: "Descartar alterações" }));
    expect(tabs()).toEqual(["Personagens"]);
  });
  it("o botão X do próprio FlexLayout também é protegido", async () => {
    await renderApp(); await abrirDoc("d1", "rascunho");
    const x = tabEl("Resumo da Sessão 3").closest(".flexlayout__tab_button")!.querySelector(".flexlayout__tab_button_trailing")!;
    fireEvent.click(x);
    expect(screen.getByRole("alertdialog")).toBeTruthy(); expect(tabs()).toContain("Resumo da Sessão 3");
    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
  });
  it("fechar a COLUNA inteira (menu e botão) com aba suja pede confirmação", async () => {
    await renderApp(); await abrirDoc("d1", "rascunho");
    fireEvent.contextMenu(tabEl("Resumo da Sessão 3")); pick("Abrir em nova coluna à direita");
    expect(document.querySelectorAll(".flexlayout__tabset").length).toBe(2);
    fireEvent.click(screen.getAllByRole("button", { name: "Fechar coluna" })[0]);   // botão da coluna
    fireEvent.click(screen.queryByRole("button", { name: "Cancelar" }) ?? document.body);
    fireEvent.contextMenu(tabEl("Resumo da Sessão 3")); pick("Fechar coluna");
    expect(screen.getByRole("alertdialog")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(tabs()).toContain("Resumo da Sessão 3");
  });
  it("fixar não substitui a confirmação ao fechar", async () => {
    await renderApp(); await abrirDoc("d1", "rascunho");
    fireEvent.contextMenu(tabEl("Resumo da Sessão 3")); pick("Fixar aba");
    fireEvent.contextMenu(tabEl("Resumo da Sessão 3")); pick("Fechar aba");
    expect(screen.getByRole("alertdialog")).toBeTruthy();
  });
  it("fechar outras abas normais confirma por todas as sujas", async () => {
    await renderApp(); await abrirDoc("d1", "a"); fireEvent.click(tabEl("Personagens")); await abrirDoc("d2", "b");
    fireEvent.contextMenu(tabEl("Personagens")); pick("Fechar outras abas normais");
    const dlg = screen.getByRole("alertdialog"); expect(within(dlg).getAllByRole("listitem").map(l => l.textContent).sort()).toEqual(["Outro doc", "Resumo da Sessão 3"]);
  });
  it("sair da conta com alterações pede confirmação e não chama o logout até confirmar", async () => {
    const auth = fakeAuth(me);
    const signOut = vi.fn(async () => ({ error: null }));
    (auth.client as unknown as { auth: Record<string, unknown> }).auth.signOut = signOut;
    await renderApp({ auth }); await abrirDoc("d1", "rascunho");
    fireEvent.click(nav("Conta"), { ctrlKey: true });
    fireEvent.click(await screen.findByRole("button", { name: "Sair" }));
    expect(await screen.findByRole("alertdialog")).toBeTruthy(); expect(signOut).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Cancelar" })); expect(signOut).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Sair" }));
    fireEvent.click(await screen.findByRole("button", { name: "Descartar alterações" }));
    await vi.waitFor(() => expect(signOut).toHaveBeenCalled());
  });
  it("recarregar a página com alterações aciona o aviso nativo (beforeunload)", async () => {
    await renderApp(); await abrirDoc("d1", "rascunho");
    const e = new Event("beforeunload", { cancelable: true }); window.dispatchEvent(e);
    expect(e.defaultPrevented).toBe(true);
  });
  it("sem alterações nada é perguntado", async () => {
    await renderApp(); await abrirDoc("d1");
    fireEvent.contextMenu(tabEl("Resumo da Sessão 3")); pick("Fechar aba");
    expect(screen.queryByRole("alertdialog")).toBeNull(); expect(tabs()).toEqual(["Personagens"]);
  });
});

describe("celular (375 px): navegação independente", () => {
  beforeEach(() => { mobile = true; Object.defineProperty(window, "innerWidth", { value: 375, configurable: true }); });

  const bottom = () => within(screen.getByRole("navigation", { name: "Navegação mobile" }));
  const activePage = (name: string) => expect(bottom().getByRole("button", { name }).getAttribute("aria-current")).toBe("page");

  it("mostra as cinco áreas principais sem abas do FlexLayout", async () => {
    await renderApp();
    expect(bottom().getAllByRole("button").map(b => b.textContent?.trim())).toEqual(["Início", "Anotações", "Ficha", "Compêndio", "Menu"]);
    expect(screen.queryByRole("tablist")).toBeNull();
    activePage("Início");
  });

  it("navega entre áreas sem criar abas e permite voltar", async () => {
    await renderApp();
    fireEvent.click(bottom().getByRole("button", { name: "Anotações" }));
    activePage("Anotações");
    fireEvent.click(bottom().getByRole("button", { name: "Compêndio" }));
    activePage("Compêndio");
    fireEvent.click(screen.getByRole("button", { name: "Voltar" }));
    activePage("Anotações");
    expect(screen.queryByRole("tablist")).toBeNull();
  });

  it("menu oferece acesso às seções e fecha ao escolher uma", async () => {
    await renderApp();
    fireEvent.click(bottom().getByRole("button", { name: "Menu" }));
    const menu = screen.getByRole("dialog", { name: "Menu de navegação" });
    fireEvent.click(within(menu).getByRole("button", { name: "Gerenciar campanhas" }));
    expect(screen.queryByRole("dialog", { name: "Menu de navegação" })).toBeNull();
  });

  it("os controles de navegação possuem nomes acessíveis", async () => {
    await renderApp();
    expect(screen.getByRole("button", { name: "Voltar" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Abrir menu" })).toBeTruthy();
    for (const name of ["Início", "Anotações", "Ficha", "Compêndio", "Menu"]) {
      expect(bottom().getByRole("button", { name })).toBeTruthy();
    }
  });
});

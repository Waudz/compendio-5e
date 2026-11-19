// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, screen } from "@testing-library/react";
import { memoryStorage, renderApp } from "./testUtils";
import { MIN_TOP, THRESHOLD, interactionActive, nextChrome } from "./chromeHide";

describe("nextChrome (regra pura)", () => {
  const s0 = { hidden: false, last: 0 };
  it("perto do topo sempre mostra", () => {
    expect(nextChrome({ hidden: true, last: 300 }, MIN_TOP).hidden).toBe(false);
  });
  it("rolar para baixo além do limiar oculta; pequenas oscilações não mudam nada", () => {
    expect(nextChrome({ hidden: false, last: 100 }, 100 + THRESHOLD - 1)).toEqual({ hidden: false, last: 100 });
    expect(nextChrome({ hidden: false, last: 100 }, 100 + THRESHOLD)).toEqual({ hidden: true, last: 100 + THRESHOLD });
  });
  it("rolar para cima além do limiar mostra", () => {
    expect(nextChrome({ hidden: true, last: 400 }, 400 - THRESHOLD).hidden).toBe(false);
    expect(nextChrome({ hidden: true, last: 400 }, 395)).toEqual({ hidden: true, last: 400 });
  });
  it("estado inicial no topo permanece visível", () => { expect(nextChrome(s0, 0).hidden).toBe(false); });
});

describe("interactionActive", () => {
  afterEach(() => { document.body.innerHTML = ""; });
  it("detecta campo de texto focado, menu e diálogo abertos", () => {
    expect(interactionActive()).toBe(false);
    const input = document.createElement("input"); document.body.append(input); input.focus();
    expect(interactionActive()).toBe(true);
    input.remove(); expect(interactionActive()).toBe(false);
    const m = document.createElement("div"); m.setAttribute("role", "menu"); document.body.append(m);
    expect(interactionActive()).toBe(true);
    m.remove(); const d = document.createElement("div"); d.setAttribute("aria-modal", "true"); document.body.append(d);
    expect(interactionActive()).toBe(true);
  });
});

describe("ocultar no celular (App)", () => {
  let mobile = true;
  beforeEach(() => {
    vi.stubGlobal("localStorage", memoryStorage());
    mobile = true;
    vi.stubGlobal("matchMedia", (q: string) => ({ matches: mobile && q.includes("max-width"), media: q, addEventListener() {}, removeEventListener() {} }));
    vi.stubGlobal("ResizeObserver", class { observe() {} unobserve() {} disconnect() {} });
  });
  afterEach(cleanup);

  /** Rola o contêiner interno (.content) como o navegador faria. */
  const scrollTo = (el: HTMLElement, top: number) => { el.scrollTop = top; fireEvent.scroll(el); };
  const scroller = () => { const el = document.querySelector<HTMLElement>(".mobile .content")!; Object.defineProperty(el, "scrollHeight", { value: 3000, configurable: true }); Object.defineProperty(el, "clientHeight", { value: 600, configurable: true }); return el; };
  const app = () => document.querySelector(".app")!;

  it("rolar para baixo no contêiner interno oculta; para cima mostra; topo mostra", async () => {
    await renderApp(); const el = scroller();
    expect(app().classList.contains("chrome-hidden")).toBe(false);
    scrollTo(el, 120); scrollTo(el, 240);
    expect(app().classList.contains("chrome-hidden")).toBe(true);
    scrollTo(el, 200);
    expect(app().classList.contains("chrome-hidden")).toBe(false);
    scrollTo(el, 400); expect(app().classList.contains("chrome-hidden")).toBe(true);
    scrollTo(el, 0); expect(app().classList.contains("chrome-hidden")).toBe(false);
  });

  it("foco em controle traz os controles de volta", async () => {
    await renderApp(); const el = scroller(); scrollTo(el, 120); scrollTo(el, 300);
    expect(app().classList.contains("chrome-hidden")).toBe(true);
    act(() => { fireEvent.focusIn(screen.getAllByRole("button", { name: "Iniciativa" })[0]); });
    expect(app().classList.contains("chrome-hidden")).toBe(false);
  });

  it("não oculta durante edição em campo de texto", async () => {
    await renderApp(); const el = scroller();
    const input = document.createElement("input"); el.append(input); input.focus();
    scrollTo(el, 120); scrollTo(el, 300);
    expect(app().classList.contains("chrome-hidden")).toBe(false);
  });

  it("ignora rolagem de faixa que não rola na vertical (abas)", async () => {
    await renderApp(); scroller(); scrollTo(el0(), 300);
    expect(app().classList.contains("chrome-hidden")).toBe(false);
    function el0() { return document.querySelector<HTMLElement>(".m-tabs")!; }
  });

  it("no desktop nunca oculta", async () => {
    mobile = false; await renderApp();
    const el = document.querySelector<HTMLElement>(".flexlayout__layout")!;
    Object.defineProperty(el, "scrollHeight", { value: 3000, configurable: true });
    scrollTo(el, 300); scrollTo(el, 600);
    expect(app().classList.contains("chrome-hidden")).toBe(false);
  });
});

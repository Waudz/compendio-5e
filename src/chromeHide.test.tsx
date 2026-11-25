// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, screen } from "@testing-library/react";
import { memoryStorage, renderApp } from "./testUtils";
import { MIN_TOP, THRESHOLD, interactionActive, nextChrome, passoDeRolagem, posicaoUtil } from "./chromeHide";

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

describe("fim da página e rolagem rápida", () => {
  it("efeito elástico não conta: a posição fica presa aos limites reais", () => {
    expect(posicaoUtil(-40, 3000, 600)).toBe(0); expect(posicaoUtil(2460, 3000, 600)).toBe(2400); expect(posicaoUtil(2400, 3000, 600)).toBe(2400);
  });
  it("quique no fim não faz as barras reaparecerem; mudança de altura da área não alterna", () => {
    let e = { hidden: false, last: 2300, altura: 600 };
    const rolar = (top: number, altura = 600) => { e = passoDeRolagem(e, posicaoUtil(top, 3000, altura), altura, 3000 - altura); return e.hidden; };
    expect(rolar(2400)).toBe(true);
    for (const t of [2440, 2400, 2465, 2400, 2430, 2400]) expect(rolar(t)).toBe(true);   // antes, cada volta do elástico mostrava as barras
    expect(rolar(2284, 716)).toBe(true);   // a área cresceu e o navegador puxou o scrollTop: não é "rolar para cima"
    expect(rolar(2250, 716)).toBe(false);  // rolagem de verdade para cima mostra
  });
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
  /** Monta o app e descarrega os efeitos pendentes (act assíncrono): o ouvinte de rolagem é registrado num useEffect e, sob carga, podia ainda
      não existir quando o teste disparava o primeiro evento — a primeira rolagem se perdia e o teste falhava de forma intermitente em CI. */
  const montar = async () => { await renderApp(); await act(async () => {}); };

  /** Rola o contêiner interno (.content) como o navegador faria. */
  const scrollTo = (el: HTMLElement, top: number) => { el.scrollTop = top; fireEvent.scroll(el); };
  const scroller = () => { const el = document.querySelector<HTMLElement>(".mobile-screen")!; Object.defineProperty(el, "scrollHeight", { value: 3000, configurable: true }); Object.defineProperty(el, "clientHeight", { value: 600, configurable: true }); return el; };
  const app = () => document.querySelector(".app")!;

  it("rolar para baixo no contêiner interno oculta; para cima mostra; topo mostra", async () => {
    await montar(); const el = scroller();
    expect(app().classList.contains("chrome-hidden")).toBe(false);
    scrollTo(el, 120); scrollTo(el, 240);
    expect(app().classList.contains("chrome-hidden")).toBe(true);
    scrollTo(el, 200);
    expect(app().classList.contains("chrome-hidden")).toBe(false);
    scrollTo(el, 400); expect(app().classList.contains("chrome-hidden")).toBe(true);
    scrollTo(el, 0); expect(app().classList.contains("chrome-hidden")).toBe(false);
  });

  it("foco em controle traz os controles de volta", async () => {
    await montar(); const el = scroller(); scrollTo(el, 120); scrollTo(el, 300);
    expect(app().classList.contains("chrome-hidden")).toBe(true);
    act(() => { fireEvent.focusIn(screen.getAllByRole("button", { name: "Iniciativa" })[0]); });
    expect(app().classList.contains("chrome-hidden")).toBe(false);
  });

  it("trocar de tela mostra as barras; se a página deixar de ter rolagem, elas também voltam", async () => {
    await montar(); const el = scroller(); scrollTo(el, 120); scrollTo(el, 400);
    expect(app().classList.contains("chrome-hidden")).toBe(true);
    act(() => { window.dispatchEvent(new Event("compendio5e:tela-mobile")); });
    expect(app().classList.contains("chrome-hidden")).toBe(false);
    scrollTo(el, 500); scrollTo(el, 700); expect(app().classList.contains("chrome-hidden")).toBe(true);
    Object.defineProperty(el, "scrollHeight", { value: 500, configurable: true }); scrollTo(el, 0);
    expect(app().classList.contains("chrome-hidden")).toBe(false);
  });

  it("não oculta durante edição em campo de texto", async () => {
    await montar(); const el = scroller();
    const input = document.createElement("input"); el.append(input); input.focus();
    scrollTo(el, 120); scrollTo(el, 300);
    expect(app().classList.contains("chrome-hidden")).toBe(false);
  });

  it("ignora rolagem de faixa que não rola na vertical (abas)", async () => {
    await montar(); scroller(); scrollTo(el0(), 300);
    expect(app().classList.contains("chrome-hidden")).toBe(false);
    function el0() { return document.querySelector<HTMLElement>(".mobile-bottom-nav")!; }
  });

  it("no desktop nunca oculta", async () => {
    mobile = false; await montar();
    const el = document.querySelector<HTMLElement>(".flexlayout__layout")!;
    Object.defineProperty(el, "scrollHeight", { value: 3000, configurable: true });
    scrollTo(el, 300); scrollTo(el, 600);
    expect(app().classList.contains("chrome-hidden")).toBe(false);
  });
});

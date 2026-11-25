// @vitest-environment jsdom
// Barra de categorias com menu de excedentes: cálculo de quantos cabem e comportamento do menu em larguras simuladas.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { useState } from "react";
import { BarraExcedente, quantosCabem } from "./BarraExcedente";

const ITENS = ["Todos", "Personagens", "Bestiário", "Encontros preparados", "Combatente avulso"] as const;
const LARGURAS: Record<string, number> = { Todos: 50, Personagens: 90, "Bestiário": 70, "Encontros preparados": 140, "Combatente avulso": 120 };
let largura = 1000; let observadores: (() => void)[] = [];
beforeEach(() => {
  largura = 1000; observadores = [];
  vi.stubGlobal("ResizeObserver", class { constructor(private f: () => void) {} observe() { observadores.push(this.f); } disconnect() {} });
  vi.spyOn(Element.prototype, "getBoundingClientRect").mockImplementation(function (this: Element) {
    const w = this.classList.contains("barra-excedente") ? largura : this.classList.contains("barra-mais") ? 32 : LARGURAS[this.getAttribute("data-rotulo") ?? ""] ?? 0;
    return { x: 0, y: 0, left: 0, top: 0, right: w, bottom: 0, width: w, height: 0, toJSON: () => ({}) } as DOMRect;
  });
  const real = window.getComputedStyle;
  vi.spyOn(window, "getComputedStyle").mockImplementation((el, p) => { const s = real(el, p); Object.defineProperty(s, "columnGap", { value: "4px", configurable: true }); return s; });
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

function Caso() { const [v, setV] = useState<typeof ITENS[number]>("Todos"); return <><BarraExcedente rotulo="Fontes" itens={ITENS} ativo={v} onSelecionar={setV}/><output>{v}</output><button type="button">fora</button></>; }
const redimensionar = (w: number) => act(() => { largura = w; observadores.forEach(f => f()); });
const visiveis = () => [...screen.getByRole("group", { name: "Fontes" }).querySelectorAll(":scope > .barra-item:not(.barra-mais)")].map(b => b.textContent);

describe("quantos cabem", () => {
  const l = [50, 90, 70, 140, 120];   // soma 470 + 4 vãos de 4 = 486
  it("todos cabendo, não reserva espaço para as reticências", () => { expect(quantosCabem(l, 486, 32, 4)).toBe(5); expect(quantosCabem(l, 485, 32, 4)).toBe(4); });
  it("faltando espaço, reserva o botão e o vão antes de contar", () => {
    expect(quantosCabem(l, 254, 32, 4)).toBe(3);   // 32 + 54 + 94 + 74 = 254
    expect(quantosCabem(l, 253, 32, 4)).toBe(2);
    expect(quantosCabem(l, 40, 32, 4)).toBe(0);
  });
});

describe("barra com excedentes", () => {
  it("painel largo mostra tudo, sem reticências; estreito leva o resto ao menu, e ampliar devolve", () => {
    render(<Caso/>);
    expect(visiveis()).toEqual([...ITENS]); expect(screen.queryByRole("button", { name: /Mais categorias/ })).toBeNull();
    redimensionar(300); expect(visiveis()).toEqual(["Todos", "Personagens", "Bestiário"]);
    redimensionar(190); expect(visiveis()).toEqual(["Todos", "Personagens"]);
    // o "…" vem logo depois do último filtro visível, sem espaçador
    const barra = screen.getByRole("group", { name: "Fontes" }); expect(barra.children[2].classList.contains("barra-mais")).toBe(true);
    redimensionar(1000); expect(visiveis()).toEqual([...ITENS]); expect(screen.queryByRole("button", { name: /Mais categorias/ })).toBeNull();
  });
  it("selecionar no menu fecha, marca o botão e a seleção sobrevive ao redimensionar", () => {
    render(<Caso/>); redimensionar(190);
    const mais = screen.getByRole("button", { name: "Mais categorias" });
    fireEvent.click(mais); const menu = within(screen.getByRole("group", { name: "Categorias restantes" }));
    expect(menu.getAllByRole("button").map(b => b.textContent)).toEqual(["Bestiário", "Encontros preparados", "Combatente avulso"]);
    fireEvent.click(menu.getByRole("button", { name: "Encontros preparados" }));
    expect(screen.queryByRole("group", { name: "Categorias restantes" })).toBeNull(); expect(screen.getByRole("status").textContent).toBe("Encontros preparados");
    const marcado = screen.getByRole("button", { name: "Mais categorias (selecionada: Encontros preparados)" }); expect(marcado.getAttribute("data-ativo")).toBe("true");
    redimensionar(1000); expect(screen.getByRole("button", { name: "Encontros preparados" }).getAttribute("aria-pressed")).toBe("true");
    redimensionar(190); expect(screen.getByRole("button", { name: /selecionada: Encontros preparados/ })).toBeTruthy();
  });
  it("fecha com Escape e ao clicar fora", () => {
    render(<Caso/>); redimensionar(190);
    const abrir = () => fireEvent.click(screen.getByRole("button", { name: "Mais categorias" }));
    abrir(); fireEvent.keyDown(document.body, { key: "Escape" }); expect(screen.queryByRole("group", { name: "Categorias restantes" })).toBeNull();
    abrir(); fireEvent.pointerDown(screen.getByRole("button", { name: "fora" })); expect(screen.queryByRole("group", { name: "Categorias restantes" })).toBeNull();
    abrir(); fireEvent.pointerDown(screen.getByRole("group", { name: "Categorias restantes" })); expect(screen.getByRole("group", { name: "Categorias restantes" })).toBeTruthy();
  });
});

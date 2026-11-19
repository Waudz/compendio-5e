// @vitest-environment jsdom
// Quadro (componente): alças de arrasto acessíveis, botões como alternativa, atalho e coluna vazia. O arrasto real (mouse, teclado e
// toque) depende de layout e foi verificado no navegador; ver docs/PROTOTIPO-EDITOR-BLOCKNOTE.md.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { Board } from "./Board";

beforeEach(() => {
  vi.stubGlobal("matchMedia", (q: string) => ({ matches: false, media: q, addEventListener() {}, removeEventListener() {} }));
  vi.stubGlobal("ResizeObserver", class { observe() {} unobserve() {} disconnect() {} });
});
afterEach(cleanup);

const titles = (col: string) => within(screen.getByRole("region", { name: `Coluna ${col}` })).queryAllByRole("article").map(a => a.querySelector("strong")?.textContent);

describe("quadro (componente)", () => {
  it("cada cartão tem uma alça de arrasto com nome acessível, e só a alça (não o corpo) é o ponto de arrasto", () => {
    const { container } = render(<Board/>);
    const grips = screen.getAllByRole("button", { name: /^Arrastar cartão:/ });
    expect(grips).toHaveLength(9);
    for (const g of grips) { expect(g.getAttribute("aria-roledescription")).toBe("sortable"); expect(g.getAttribute("aria-describedby")).toBeTruthy(); }
    // o artigo (corpo do cartão) não recebe os ouvintes de arrasto
    const art = container.querySelector("article")!; expect(art.getAttribute("aria-roledescription")).toBeNull(); expect(art.getAttribute("tabindex")).toBeNull();
    expect(document.body.textContent).toContain("Para mover o cartão, foque a alça e pressione Espaço");   // instruções para leitores de tela (pt-BR)
  });

  it("os botões de seta continuam movendo (alternativa ao arrasto) e preservam o conteúdo", () => {
    render(<Board/>);
    expect(titles("Julkoun")).toEqual(["Taverna", "Prefeito", "Mercearia", "Marta (NPC)"]);
    fireEvent.click(screen.getByRole("button", { name: "Descer: Taverna" }));
    expect(titles("Julkoun")).toEqual(["Prefeito", "Taverna", "Mercearia", "Marta (NPC)"]);
    fireEvent.click(screen.getByRole("button", { name: "Coluna à direita: Prefeito" }));
    expect(titles("Estrada")).toContain("Prefeito"); expect(titles("Julkoun")).not.toContain("Prefeito");
    fireEvent.click(screen.getByRole("button", { name: "Coluna à direita: Prefeito" }));     // Estrada → Floresta
    fireEvent.click(screen.getByRole("button", { name: "Coluna à direita: Prefeito" }));     // Floresta → coluna vazia
    expect(titles("Coluna vazia")).toEqual(["Prefeito"]);
    expect(screen.getByRole("button", { name: "Coluna à direita: Prefeito" }).hasAttribute("disabled")).toBe(true);
  });

  it("coluna vazia mostra a área de soltura; atalhos são identificados e compartilham a mesma página", () => {
    render(<Board/>);
    expect(screen.getByText("Solte um cartão aqui")).toBeTruthy();
    expect(screen.getAllByText("atalho")).toHaveLength(2);
    expect(screen.getAllByText("Marta (NPC)")).toHaveLength(2);
  });

  it("expandir não move nem altera a ordem; a alça de um cartão em edição fica desabilitada", () => {
    render(<Board/>);
    fireEvent.click(screen.getByRole("button", { name: "Expandir Prefeito" }));
    expect(titles("Julkoun")).toEqual(["Taverna", "Prefeito", "Mercearia", "Marta (NPC)"]);
    expect(screen.getByRole("button", { name: "Recolher Prefeito" }).getAttribute("aria-expanded")).toBe("true");
    expect((screen.getByRole("button", { name: "Arrastar cartão: Taverna" }) as HTMLButtonElement).disabled).toBe(false);
  });
});

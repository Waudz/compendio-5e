// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { PageViewport } from "./PageViewport";
vi.mock("./voltarInterno", () => ({ estaVisivel: () => true }));
afterEach(() => { cleanup(); vi.useRealTimers(); });

it("o título recebe o foco ao abrir, marcado para não desenhar contorno; ao sair, a marca e o tabindex saem", () => {
  vi.useFakeTimers();
  render(<div style={{ overflowY: "auto" }}><PageViewport pageKey="a" positions={new Map()}><div className="content" style={{ overflowY: "auto" }}><h1>Título</h1><button type="button">Ação</button></div></PageViewport></div>);
  vi.runAllTimers();
  const titulo = screen.getByRole("heading", { name: "Título" });
  expect(document.activeElement).toBe(titulo);
  expect(titulo.hasAttribute("data-foco-automatico")).toBe(true);
  screen.getByRole("button", { name: "Ação" }).focus();
  expect(titulo.hasAttribute("data-foco-automatico")).toBe(false);
  expect(titulo.hasAttribute("tabindex")).toBe(false);
});

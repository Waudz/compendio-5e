// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

let context: { active: { campaign: { id: string } } | null; loading: boolean; error: string | null; refresh: () => Promise<void> };
vi.mock("./CampaignsContext", () => ({ useCampaigns: () => context }));
vi.mock("./compendio/CompendioCatalogo", () => ({ CompendioCatalogo: () => <div>Catálogo disponível</div> }));
vi.mock("./catalogue/srd-2014-items", async importOriginal => ({...await importOriginal<typeof import("./catalogue/srd-2014-items")>(), srdItem: vi.fn(() => undefined) }));
import { CompendioPanel, ItemPagina } from "./Compendio";
import { srdItem } from "./catalogue/srd-2014-items";

beforeEach(() => { context = { active: null, loading: false, error: null, refresh: vi.fn(async () => {}) }; vi.clearAllMocks(); });
afterEach(cleanup);

describe("catálogo exige campanha validada", () => {
  it("sem campanha não monta catálogo e oferece abrir campanhas", () => {
    const abrir = vi.fn(); render(<CompendioPanel onOpenContent={abrir}/>);
    expect(screen.queryByText("Catálogo disponível")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Escolher campanha" }));
    expect(abrir).toHaveBeenCalledWith({ kind: "secao", ref: "campanhas" });
  });
  it("aba de item restaurada sem campanha não consulta a definição", () => {
    render(<ItemPagina id="longsword" onOpenContent={vi.fn()}/>);
    expect(srdItem).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Escolher campanha" })).toBeTruthy();
  });
  it("carregamento não é apresentado como ausência de campanha", () => {
    context.loading = true;
    render(<CompendioPanel onOpenContent={vi.fn()}/>);
    expect(screen.getByRole("status").textContent).toContain("Verificando sua campanha");
    expect(screen.queryByRole("button", { name: "Escolher campanha" })).toBeNull();
    expect(screen.queryByText("Catálogo disponível")).toBeNull();
  });
  it("erro de consulta não libera catálogo nem vira lista vazia", () => {
    context.error = "rede";
    render(<CompendioPanel onOpenContent={vi.fn()}/>);
    expect(screen.getByRole("alert").textContent).toContain("verificar sua campanha");
    fireEvent.click(screen.getByRole("button", { name: "Tentar de novo" }));
    expect(context.refresh).toHaveBeenCalledOnce();
    expect(screen.queryByText("Catálogo disponível")).toBeNull();
  });
  it("campanha validada permite consultar e sua remoção fecha o conteúdo imediatamente", () => {
    context.active = { campaign: { id: "a" } };
    const { rerender } = render(<CompendioPanel onOpenContent={vi.fn()}/>);
    fireEvent.click(screen.getByRole("button", {name:"Regras"}));
    fireEvent.click(screen.getByRole("button", {name:/^Itens /}));
    expect(screen.getByText("Catálogo disponível")).toBeTruthy();
    context.active = null;
    rerender(<CompendioPanel onOpenContent={vi.fn()}/>);
    expect(screen.queryByText("Catálogo disponível")).toBeNull();
  });
});

// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { RetratoQuadrado } from "../RetratoCombate";
import { ampliar, ZOOM_MAXIMO } from "./VisualizadorImagem";
import { juntar } from "./enquadramento";

afterEach(cleanup);
const zoom = () => screen.getByRole("status").textContent;
const original = "https://exemplo.invalid/original.png";

describe("visualizador de imagens", () => {
  it("escala limitada, ponto sob o cursor parado e retorno ao centro em 100%", () => {
    const v = ampliar({ escala: 1, x: 0, y: 0 }, 2, 100, 50);
    expect(v).toEqual({ escala: 2, x: -100, y: -50 });
    expect(ampliar(v, 100).escala).toBe(ZOOM_MAXIMO);
    expect(ampliar(v, 0.1, 40, 40)).toEqual({ escala: 1, x: 0, y: 0 });
  });
  it("abre a imagem original, sem o enquadramento do retrato; botões, teclado, restaurar e Esc", () => {
    const tecla = vi.fn(), clique = vi.fn();
    render(<div onKeyDown={tecla} onClick={clique}><RetratoQuadrado src={juntar(original, { zoom: 2.5, x: 10, y: 90 })} ampliar="Varyn"/></div>);
    fireEvent.click(screen.getByRole("button", { name: "Ampliar imagem de Varyn" }));
    const janela = screen.getByRole("dialog", { name: "Imagem ampliada: Varyn" });
    const img = screen.getByRole("img", { name: "Varyn" }) as HTMLImageElement;
    expect(img.getAttribute("src")).toBe(original);
    expect(img.style.transform).toContain("scale(1)");
    expect(img.style.transform).not.toMatch(/[1-9]\d*px/);
    expect(img.style.objectPosition).toBe("");
    clique.mockClear();
    fireEvent.click(screen.getByRole("button", { name: "Ampliar" }));
    expect(zoom()).toBe("140%");
    fireEvent.keyDown(janela, { key: "+" });
    expect(zoom()).toBe("196%");
    fireEvent.click(screen.getByRole("button", { name: "Reduzir" }));
    expect(zoom()).toBe("140%");
    fireEvent.click(screen.getByRole("button", { name: "Restaurar zoom" }));
    expect(zoom()).toBe("100%");
    fireEvent.keyDown(janela, { key: "Escape" });
    expect(screen.queryByRole("dialog")).toBeNull();
    // nada do visualizador chega à tela que o abriu (carta, ficha ou gesto)
    expect(tecla).not.toHaveBeenCalled();
    expect(clique).not.toHaveBeenCalled();
  });
  it("o botão Voltar do navegador fecha só o visualizador", async () => {
    const { consumirVoltar } = await import("../voltarInterno");
    while (consumirVoltar()) { /* no aplicativo o popstate consome o passo pendente; aqui não há ouvinte */ }
    render(<RetratoQuadrado src={original} ampliar="Varyn"/>);
    fireEvent.click(screen.getByRole("button", { name: "Ampliar imagem de Varyn" }));
    const { act } = await import("react");
    let consumido = false;
    act(() => { consumido = consumirVoltar(); });
    expect(consumido).toBe(true);
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(consumirVoltar()).toBe(false);
  });
  it("sem imagem não há ampliação; perdendo a imagem, o visualizador fecha e não reabre", () => {
    const { rerender } = render(<RetratoQuadrado src={null} ampliar="Varyn"/>);
    expect(screen.queryByRole("button")).toBeNull();
    rerender(<RetratoQuadrado src={original} ampliar="Varyn"/>);
    fireEvent.click(screen.getByRole("button", { name: "Ampliar imagem de Varyn" }));
    rerender(<RetratoQuadrado src={null} ampliar="Varyn"/>);
    expect(screen.queryByRole("dialog")).toBeNull();
    rerender(<RetratoQuadrado src={original} ampliar="Varyn"/>);
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});

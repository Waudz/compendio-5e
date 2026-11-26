// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { retratoValido } from "../fichas";
import { EditorEnquadramento } from "./EditorEnquadramento";
import { arrastar, juntar, medir, separar } from "./enquadramento";

afterEach(cleanup);

describe("geometria e referência", () => {
  it("a imagem cobre o quadro; arrastar acompanha o dedo e para nas bordas; sem sobra no eixo, não move", () => {
    const m = medir({ largura: 800, altura: 400 }, { largura: 200, altura: 200 }, { zoom: 1, x: 50, y: 50 });
    expect(m).toMatchObject({ largura: 400, altura: 200, sobraX: 200, sobraY: 0 });
    expect(arrastar({ zoom: 1, x: 50, y: 50 }, 50, 40, m)).toEqual({ zoom: 1, x: 25, y: 50 });
    expect(arrastar({ zoom: 1, x: 50, y: 50 }, 900, 0, m).x).toBe(0);
  });
  it("o enquadramento viaja no fim da referência e some quando é o padrão", () => {
    const base = "storage:11111111-1111-4111-8111-111111111111/22222222-2222-4222-8222-222222222222";
    const r = juntar(base, { zoom: 1.5, x: 33.333, y: 80 });
    expect(r).toBe(`${base}#enq=1.5,33.33,80`); expect(retratoValido(r)).toBe(true);
    expect(separar(r)).toEqual({ base, enquadramento: { zoom: 1.5, x: 33.33, y: 80 } });
    expect(juntar(r, { zoom: 1, x: 50, y: 50 })).toBe(base);
    expect(retratoValido(`${base}#enq=abc`)).toBe(false);
    expect(separar("https://x.test/a.png#secao").base).toBe("https://x.test/a.png#secao");
  });
});

describe("editor compartilhado", () => {
  it("arrasta com o ponteiro, aproxima pela roda e confirma o enquadramento final", () => {
    const confirmar = vi.fn();
    render(<EditorEnquadramento titulo="Enquadrar" src="blob:x" proporcao={1} onConfirmar={confirmar} onCancelar={() => {}}/>);
    const img = screen.getByAltText("Prévia do enquadramento"), quadro = screen.getByRole("application", { name: "Posicionar a imagem" });
    Object.defineProperties(img, { naturalWidth: { value: 800 }, naturalHeight: { value: 400 } });
    Object.defineProperties(quadro, { clientWidth: { value: 200 }, clientHeight: { value: 200 } });
    fireEvent.load(img);
    const ponteiro = (tipo: string, x: number, y: number, id = 1) => { const ev = new MouseEvent(tipo, { bubbles: true, clientX: x, clientY: y }); Object.defineProperty(ev, "pointerId", { value: id }); fireEvent(quadro, ev); };
    ponteiro("pointerdown", 100, 100); ponteiro("pointermove", 150, 100); ponteiro("pointerup", 150, 100);
    fireEvent.wheel(quadro, { deltaY: -100 });
    fireEvent.click(screen.getByRole("button", { name: "Confirmar enquadramento" }));
    expect(confirmar).toHaveBeenCalledWith({ zoom: 1.08, x: 25, y: 50 });
  });
  it("pinça com dois dedos aproxima", () => {
    const confirmar = vi.fn();
    render(<EditorEnquadramento titulo="Enquadrar" src="blob:x" proporcao={1} onConfirmar={confirmar} onCancelar={() => {}}/>);
    const quadro = screen.getByRole("application", { name: "Posicionar a imagem" });
    const ponteiro = (tipo: string, x: number, id: number) => { const ev = new MouseEvent(tipo, { bubbles: true, clientX: x, clientY: 0 }); Object.defineProperty(ev, "pointerId", { value: id }); fireEvent(quadro, ev); };
    ponteiro("pointerdown", 100, 1); ponteiro("pointerdown", 150, 2); ponteiro("pointermove", 200, 2);
    fireEvent.click(screen.getByRole("button", { name: "Confirmar enquadramento" }));
    expect(confirmar.mock.calls[0][0].zoom).toBeCloseTo(2, 5);
  });
});

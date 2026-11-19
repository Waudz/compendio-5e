// @vitest-environment jsdom
// Editor rico real (BlockNote 0.57.0): monta, mostra o conteúdo, é só leitura quando pedido e não oferece mídia.
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import PageEditor from "./PageEditor";

const par = (text: string) => ({ type: "paragraph", content: [{ type: "text", text, styles: {} }] });

beforeAll(() => {
  vi.stubGlobal("matchMedia", (q: string) => ({ matches: false, media: q, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} }));
  vi.stubGlobal("ResizeObserver", class { observe() {} unobserve() {} disconnect() {} });
  if (!document.elementFromPoint) document.elementFromPoint = () => null;
  Range.prototype.getBoundingClientRect = () => ({ x: 0, y: 0, left: 0, top: 0, right: 0, bottom: 0, width: 0, height: 0, toJSON() {} }) as DOMRect;
  Range.prototype.getClientRects = () => ({ length: 0, item: () => null, [Symbol.iterator]: function* () {} }) as unknown as DOMRectList;
});
afterEach(cleanup);

describe("PageEditor (BlockNote real)", () => {
  it("mostra o conteúdo salvo e fica com rótulo acessível", async () => {
    render(<PageEditor inicial={[par("O grupo chegou à taverna."), par("Segundo parágrafo.")] as never} rotulo="Texto do registro"/>);
    expect(await screen.findByText("O grupo chegou à taverna.")).toBeTruthy(); expect(screen.getByText("Segundo parágrafo.")).toBeTruthy();
    expect(screen.getByRole("group", { name: "Texto do registro" })).toBeTruthy();
  });
  it("somente leitura: o conteúdo não é editável", async () => {
    const { container } = render(<PageEditor inicial={[par("Só leitura.")] as never} editavel={false}/>);
    await screen.findByText("Só leitura.");
    await waitFor(() => expect(container.querySelector("[contenteditable=true]")).toBeNull());
  });
  it("com conteúdo vazio abre um documento em branco editável", async () => {
    const { container } = render(<PageEditor inicial={[]}/>);
    await waitFor(() => expect(container.querySelector("[contenteditable=true]")).toBeTruthy());
  });
});

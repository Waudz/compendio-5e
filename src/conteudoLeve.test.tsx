// @vitest-environment jsdom
// Visualizador leve de conteúdo em blocos (somente leitura).
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render } from "@testing-library/react";
import { ConteudoLeve, temConteudo } from "./ConteudoLeve";

afterEach(cleanup);
const t = (text: string, styles: Record<string, unknown> = {}) => ({ type: "text", text, styles });

describe("ConteudoLeve", () => {
  it("renderiza títulos, parágrafos, listas (numeração contínua), citação, código e filhos aninhados", () => {
    const { container } = render(<ConteudoLeve blocos={[
      { type: "heading", props: { level: 1 }, content: [t("Combate")] }, { type: "paragraph", content: [t("Texto.")] },
      { type: "numberedListItem", content: [t("um")] }, { type: "numberedListItem", content: [t("dois")], children: [{ type: "bulletListItem", content: [t("filho")] }] },
      { type: "checkListItem", props: { checked: true }, content: [t("feito")] }, { type: "quote", content: [t("citação")] }, { type: "codeBlock", content: [t("x = 1")] },
    ] as never}/>);
    const txt = container.textContent!;
    for (const s of ["Combate", "Texto.", "1.", "2.", "um", "dois", "filho", "feito", "citação", "x = 1", "☑"]) expect(txt).toContain(s);
    expect(container.querySelector(".cl-filhos")?.textContent).toContain("filho");
  });
  it("formatação e cores do texto; links só http(s)/mailto, com rel seguro", () => {
    const { container } = render(<ConteudoLeve blocos={[{ type: "paragraph", content: [t("forte", { bold: true }), t(" "), t("vermelho", { textColor: "red" }), t(" "),
      { type: "link", href: "https://exemplo.com", content: [t("ok")] }, t(" "), { type: "link", href: "javascript:alert(1)", content: [t("ruim")] }] }] as never}/>);
    expect(container.querySelector("strong")?.textContent).toBe("forte");
    expect((container.querySelector("span[style*='color']") as HTMLElement).style.color).not.toBe("");
    const links = [...container.querySelectorAll("a")]; expect(links).toHaveLength(1);
    expect(links[0].getAttribute("href")).toBe("https://exemplo.com"); expect(links[0].getAttribute("rel")).toContain("noopener");
    expect(container.innerHTML).not.toContain("javascript:");
  });
  it("não executa HTML do conteúdo (tudo vira texto)", () => {
    const { container } = render(<ConteudoLeve blocos={[{ type: "paragraph", content: [t("<img src=x onerror=alert(1)>")] }] as never}/>);
    expect(container.querySelector("img")).toBeNull(); expect(container.textContent).toContain("<img src=x");
  });
  it("temConteudo: vazio e só parágrafos em branco não mostram caixa", () => {
    expect(temConteudo([])).toBe(false); expect(temConteudo(null)).toBe(false);
    expect(temConteudo([{ type: "paragraph", content: [] }])).toBe(false);
    expect(temConteudo([{ type: "paragraph", content: [t("a")] }] as never)).toBe(true);
  });
});

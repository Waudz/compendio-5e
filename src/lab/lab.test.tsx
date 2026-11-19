// @vitest-environment jsdom
// Protótipo do editor (PR 2): modelo do quadro, prévia leve, segurança de links, serialização e o isolamento do laboratório.
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { deserialize, manyCards, moveCard, previewText, safeHref, sampleBoard, serialize, updateCard, countCards, type Board, type LabBlock } from "./model";
import { Preview } from "./Preview";

const ids = (b: Board) => b.columns.map(c => c.cards.map(k => k.title));

describe("quadro: reorganização de cartões (sem perda nem cópia)", () => {
  it("sobe, desce e troca de coluna mantendo todos os cartões", () => {
    const b = sampleBoard(), total = countCards(b);
    const prefeito = b.columns[0].cards[1].id;
    expect(ids(moveCard(b, prefeito, "up"))[0]).toEqual(["Prefeito", "Taverna", "Mercearia"]);
    expect(ids(moveCard(b, prefeito, "down"))[0]).toEqual(["Taverna", "Mercearia", "Prefeito"]);
    const r = moveCard(b, prefeito, "right");
    expect(ids(r)).toEqual([["Taverna", "Mercearia"], ["Encontro aleatório", "Prefeito", "Carroça atolada"], ["Cabana do eremita", "Preparação de poções"]]);
    expect(countCards(r)).toBe(total);
    expect(ids(moveCard(r, prefeito, "left"))[0].sort()).toEqual(["Mercearia", "Prefeito", "Taverna"]);
  });
  it("limites: não passa do topo, do fim nem das colunas das pontas; o original nunca é alterado", () => {
    const b = sampleBoard(), snapshot = JSON.stringify(b);
    expect(moveCard(b, b.columns[0].cards[0].id, "up")).toBe(b);
    expect(moveCard(b, b.columns[0].cards[2].id, "down")).toBe(b);
    expect(moveCard(b, b.columns[0].cards[0].id, "left")).toBe(b);
    expect(moveCard(b, b.columns[2].cards[0].id, "right")).toBe(b);
    expect(moveCard(b, "inexistente", "up")).toBe(b);
    moveCard(b, b.columns[0].cards[1].id, "right"); expect(JSON.stringify(b)).toBe(snapshot);
  });
  it("mover não altera o conteúdo do cartão (mesmos blocos)", () => {
    const b = sampleBoard(), id = b.columns[0].cards[0].id, before = JSON.stringify(b.columns[0].cards[0].blocks);
    const after = moveCard(b, id, "right").columns[1].cards.find(k => k.id === id)!;
    expect(JSON.stringify(after.blocks)).toBe(before);
  });
  it("modo compacto/expandido e edição de conteúdo afetam só o cartão escolhido", () => {
    const b = sampleBoard(), id = b.columns[0].cards[1].id;
    const n = updateCard(b, id, { mode: "expanded", blocks: [{ type: "paragraph", content: [{ type: "text", text: "novo", styles: {} }] }] });
    expect(n.columns[0].cards[1].mode).toBe("expanded"); expect(previewText(n.columns[0].cards[1].blocks)).toBe("novo");
    expect(JSON.stringify(n.columns[0].cards[0])).toBe(JSON.stringify(b.columns[0].cards[0]));
  });
  it("a amostra segue a sessão combinada: 3 colunas e 7 cartões", () => {
    const b = sampleBoard();
    expect(b.columns.map(c => c.title)).toEqual(["Julkoun", "Estrada", "Floresta"]); expect(countCards(b)).toBe(7);
    expect(countCards(manyCards(10, 100))).toBe(1000);
  });
});

describe("prévia compacta e serialização", () => {
  it("prévia em texto simples: junta blocos, tabelas e referências, e limita o tamanho", () => {
    const b = sampleBoard();
    expect(previewText(b.columns[0].cards[1].blocks)).toMatch(/^Prefeito Aldric quer discrição/);
    expect(previewText(b.columns[0].cards[1].blocks, 30).length).toBeLessThanOrEqual(30);
    expect(previewText([])).toBe("");
  });
  it("JSON de blocos: ida e volta idêntica; JSON inválido é recusado sem lançar", () => {
    for (const col of sampleBoard().columns) for (const c of col.cards) expect(deserialize(serialize(c.blocks))).toEqual(c.blocks);
    for (const ruim of ["", "{", "{}", "[1]", '[{"x":1}]', "null"]) expect(deserialize(ruim)).toBeNull();
  });
  it("o formato canônico é JSON, nunca HTML", () => {
    const s = serialize(sampleBoard().columns[0].cards[0].blocks);
    expect(s).not.toMatch(/<\/?(p|div|span|a|ul|li)\b/); expect(JSON.parse(s)[0].type).toBe("heading");
  });
});

describe("segurança dos links", () => {
  it("só http, https, mailto e referências internas", () => {
    for (const ok of ["https://a.com/x?y=1", "http://a.com", "mailto:a@b.com", "compendio:npc/marta"]) expect(safeHref(ok)).toBe(ok);
    for (const ruim of ["javascript:alert(1)", " JaVaScRiPt:alert(1)", "data:text/html,<b>", "vbscript:x", "//evil.com", "/relativo", "https://a.com/ x", "https://a.com/\n", 5, null, undefined]) expect(safeHref(ruim)).toBeNull();
  });
  it("a prévia nunca gera link perigoso, trata HTML como texto e não quebra com tipos desconhecidos", () => {
    const blocks: LabBlock[] = [
      { type: "paragraph", content: [{ type: "text", text: "<img src=x onerror=alert(1)><script>alert(2)</script>", styles: {} }, { type: "link", href: "javascript:alert(3)", content: [{ type: "text", text: "mau", styles: {} }] }, { type: "link", href: "https://ok.example.com", content: [{ type: "text", text: "bom", styles: {} }] }] },
      { type: "futuroBloco", content: [{ type: "text", text: "tipo novo", styles: {} }] },
    ];
    const { container } = render(<Preview blocks={blocks}/>);
    expect(container.querySelectorAll("script, img").length).toBe(0);
    const as = [...container.querySelectorAll("a")]; expect(as.map(a => a.getAttribute("href"))).toEqual(["https://ok.example.com"]);
    expect(as[0].getAttribute("rel")).toContain("noopener"); expect(container.textContent).toContain("<script>alert(2)</script>");
    expect(container.textContent).toContain("mau"); expect(container.textContent).toContain("tipo novo");
  });
  it("referência interna é um botão que informa tipo e id (sem URL)", () => {
    const onRef = vi.fn();
    render(<Preview blocks={sampleBoard().columns[0].cards[0].blocks} onRef={onRef}/>);
    fireEvent.click(screen.getByRole("button", { name: "Marta" }));
    expect(onRef).toHaveBeenCalledWith("npc", "marta");
  });
  it("renderiza listas aninhadas, tabela e títulos", () => {
    const { container } = render(<Preview blocks={sampleBoard().columns[0].cards[1].blocks.concat(sampleBoard().columns[0].cards[0].blocks)}/>);
    expect(container.querySelectorAll("table td")).toHaveLength(6); expect(container.querySelectorAll("ul ul li")).toHaveLength(2); expect(container.querySelector("h4")?.textContent).toBe("Taverna do Javali Cego");
  });
});


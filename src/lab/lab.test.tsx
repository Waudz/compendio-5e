// @vitest-environment jsdom
// Protótipo do editor (PR 2): modelo do quadro, prévia leve, segurança de links, serialização e o isolamento do laboratório.
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { countCards, deserialize, manyCards, moveCard, moveCardTo, previewText, safeHref, sampleBoard, serialize, setCardMode, updatePage, type Board, type LabBlock } from "./model";
import { Preview } from "./Preview";

const pg = (b: Board, c: { pageId: string }) => b.pages[c.pageId];
const ids = (b: Board) => b.columns.map(c => c.cards.map(k => pg(b, k).title));
const flat = (b: Board) => b.columns.flatMap(c => c.cards);

describe("quadro: reorganização por botões (sem perda nem cópia)", () => {
  it("sobe, desce e troca de coluna mantendo todos os cartões", () => {
    const b = sampleBoard(), total = countCards(b);
    const prefeito = b.columns[0].cards[1].id;
    expect(ids(moveCard(b, prefeito, "up"))[0].slice(0, 2)).toEqual(["Prefeito", "Taverna"]);
    expect(ids(moveCard(b, prefeito, "down"))[0].slice(0, 3)).toEqual(["Taverna", "Mercearia", "Prefeito"]);
    const r = moveCard(b, prefeito, "right");
    expect(ids(r)[1]).toEqual(["Encontro aleatório", "Prefeito", "Carroça atolada"]); expect(countCards(r)).toBe(total);
    expect(ids(moveCard(r, prefeito, "left"))[0]).toContain("Prefeito");
  });
  it("limites: não passa do topo, do fim nem das colunas das pontas; o original nunca é alterado", () => {
    const b = sampleBoard(), snapshot = JSON.stringify(b), last = b.columns[0].cards.length - 1;
    expect(moveCard(b, b.columns[0].cards[0].id, "up")).toBe(b);
    expect(moveCard(b, b.columns[0].cards[last].id, "down")).toBe(b);
    expect(moveCard(b, b.columns[0].cards[0].id, "left")).toBe(b);
    expect(moveCard(b, "inexistente", "up")).toBe(b);
    moveCard(b, b.columns[0].cards[1].id, "right"); expect(JSON.stringify(b)).toBe(snapshot);
  });
  it("a amostra segue a sessão combinada: colunas com cartões, uma vazia, e um atalho", () => {
    const b = sampleBoard();
    expect(b.columns.map(c => c.title)).toEqual(["Julkoun", "Estrada", "Floresta", "Coluna vazia"]); expect(b.columns[3].cards).toEqual([]);
    expect(countCards(b)).toBe(9); expect(Object.keys(b.pages)).toHaveLength(8);     // 9 cartões, 8 páginas: um atalho
    expect(countCards(manyCards(10, 100))).toBe(1000);
  });
});

describe("arrastar e soltar (moveCardTo): lógica do destino", () => {
  const cardId = (b: Board, title: string) => flat(b).find(k => pg(b, k).title === title)!.id;
  const colId = (b: Board, title: string) => b.columns.find(c => c.title === title)!.id;
  it("entre colunas, em posição específica (topo, meio, fim)", () => {
    const b = sampleBoard(), taverna = cardId(b, "Taverna"), estrada = colId(b, "Estrada");
    expect(ids(moveCardTo(b, taverna, estrada, 0))[1]).toEqual(["Taverna", "Encontro aleatório", "Carroça atolada"]);
    expect(ids(moveCardTo(b, taverna, estrada, 1))[1]).toEqual(["Encontro aleatório", "Taverna", "Carroça atolada"]);
    expect(ids(moveCardTo(b, taverna, estrada, 99))[1]).toEqual(["Encontro aleatório", "Carroça atolada", "Taverna"]);
    expect(ids(moveCardTo(b, taverna, estrada, 1))[0]).not.toContain("Taverna");
  });
  it("dentro da mesma coluna: reordena (arrayMove) e não faz nada se a posição é a mesma", () => {
    const b = sampleBoard(), col = b.columns[0].id, taverna = cardId(b, "Taverna");
    expect(ids(moveCardTo(b, taverna, col, 2))[0].slice(0, 3)).toEqual(["Prefeito", "Mercearia", "Taverna"]);
    expect(ids(moveCardTo(b, cardId(b, "Mercearia"), col, 0))[0].slice(0, 3)).toEqual(["Mercearia", "Taverna", "Prefeito"]);
    expect(moveCardTo(b, taverna, col, 0)).toBe(b);
  });
  it("coluna vazia aceita o cartão e pode ficar vazia de novo", () => {
    const b = sampleBoard(), vazia = colId(b, "Coluna vazia"), card = cardId(b, "Mercearia");
    const r = moveCardTo(b, card, vazia, 0); expect(r.columns[3].cards.map(k => k.id)).toEqual([card]);
    const volta = moveCardTo(r, card, b.columns[0].id, 0); expect(volta.columns[3].cards).toEqual([]);
  });
  it("entradas inválidas não alteram nada (cartão ou coluna inexistente, índice estranho)", () => {
    const b = sampleBoard();
    expect(moveCardTo(b, "nao-existe", b.columns[0].id, 0)).toBe(b); expect(moveCardTo(b, b.columns[0].cards[0].id, "nao-existe", 0)).toBe(b);
    expect(countCards(moveCardTo(b, b.columns[0].cards[0].id, b.columns[1].id, NaN))).toBe(countCards(b));
    expect(moveCardTo(b, b.columns[0].cards[0].id, b.columns[1].id, -5).columns[1].cards[0].id).toBe(b.columns[0].cards[0].id);
  });
  it("cancelar: o estado de antes do arrasto (imutável) segue idêntico e recuperável", () => {
    const antes = sampleBoard(), snap = JSON.stringify(antes);
    const durante = moveCardTo(antes, antes.columns[0].cards[0].id, antes.columns[2].id, 0);   // o que o arrasto mostra
    expect(JSON.stringify(durante)).not.toBe(snap); expect(JSON.stringify(antes)).toBe(snap);   // cancelar = voltar a "antes"
  });
  it("mover nunca altera, move ou duplica a página original (inclusive atalhos)", () => {
    const b = sampleBoard(), paginas = JSON.stringify(b.pages), total = Object.keys(b.pages).length;
    let r = b; flat(b).forEach((k, n) => { r = moveCardTo(r, k.id, b.columns[n % 4].id, n % 3); r = moveCard(r, k.id, "up"); });
    expect(JSON.stringify(r.pages)).toBe(paginas); expect(Object.keys(r.pages)).toHaveLength(total); expect(countCards(r)).toBe(countCards(b));
    expect(flat(r).map(k => k.id).sort()).toEqual(flat(b).map(k => k.id).sort()); expect(flat(r).every(k => !!r.pages[k.pageId])).toBe(true);
  });
  it("atalho: dois cartões, uma página; editar a página reflete nos dois e mover um não afeta o outro", () => {
    const b = sampleBoard(), atalhos = flat(b).filter(k => k.pageId === "pagina-marta");
    expect(atalhos).toHaveLength(2);
    const novoBloco = [{ type: "paragraph", content: [{ type: "text", text: "editado", styles: {} }] }];
    const e = updatePage(b, "pagina-marta", { blocks: novoBloco });
    expect(flat(e).filter(k => k.pageId === "pagina-marta").map(k => previewText(pg(e, k).blocks))).toEqual(["editado", "editado"]);
    const m = moveCardTo(b, atalhos[0].id, b.columns[1].id, 0);
    expect(flat(m).filter(k => k.pageId === "pagina-marta")).toHaveLength(2); expect(pg(m, atalhos[1])).toBe(b.pages["pagina-marta"]);
    expect(updatePage(b, "nao-existe", { title: "x" })).toBe(b);
  });
  it("modo compacto/expandido muda só o cartão escolhido, não a página", () => {
    const b = sampleBoard(), id = b.columns[0].cards[1].id, n = setCardMode(b, id, "expanded");
    expect(n.columns[0].cards[1].mode).toBe("expanded"); expect(n.pages).toBe(b.pages); expect(n.columns[0].cards[0]).toBe(b.columns[0].cards[0]);
  });
});

describe("prévia compacta e serialização", () => {
  it("prévia em texto simples: junta blocos, tabelas e referências, e limita o tamanho", () => {
    const b = sampleBoard();
    expect(previewText(pg(b, b.columns[0].cards[1]).blocks)).toMatch(/^Prefeito Aldric quer discrição/);
    expect(previewText(pg(b, b.columns[0].cards[1]).blocks, 30).length).toBeLessThanOrEqual(30);
    expect(previewText([])).toBe("");
  });
  it("JSON de blocos: ida e volta idêntica; JSON inválido é recusado sem lançar", () => {
    for (const pagina of Object.values(sampleBoard().pages)) expect(deserialize(serialize(pagina.blocks))).toEqual(pagina.blocks);
    for (const ruim of ["", "{", "{}", "[1]", '[{"x":1}]', "null"]) expect(deserialize(ruim)).toBeNull();
  });
  it("o formato canônico é JSON, nunca HTML", () => {
    const s = serialize(taverna());
    expect(s).not.toMatch(/<\/?(p|div|span|a|ul|li)\b/); expect(JSON.parse(s)[0].type).toBe("heading");
  });
});

const taverna = () => { const b = sampleBoard(); return b.pages[b.columns[0].cards[0].pageId].blocks; };
const prefeito = () => { const b = sampleBoard(); return b.pages[b.columns[0].cards[1].pageId].blocks; };

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
    render(<Preview blocks={taverna()} onRef={onRef}/>);
    fireEvent.click(screen.getByRole("button", { name: "Marta" }));
    expect(onRef).toHaveBeenCalledWith("npc", "marta");
  });
  it("renderiza listas aninhadas, tabela e títulos", () => {
    const { container } = render(<Preview blocks={prefeito().concat(taverna())}/>);
    expect(container.querySelectorAll("table td")).toHaveLength(6); expect(container.querySelectorAll("ul ul li")).toHaveLength(2); expect(container.querySelector("h4")?.textContent).toBe("Taverna do Javali Cego");
  });
});


// Funções puras do Início: data de Harptos, primeiro parágrafo, resumo e visibilidade por papel.
import { describe, expect, it } from "vitest";
import { formatarDataHarptos, maisRecenteVisivel, previaTexto, primeiroParagrafo, resumirTexto, type EntradaDiario } from "./inicio";

const txt = (text: string) => ({ type: "text", text, styles: {} });
const par = (t: string) => ({ type: "paragraph", content: [txt(t)] });

describe("formatarDataHarptos", () => {
  it("formata no calendário de Harptos", () => {
    expect(formatarDataHarptos({ dia: 3, mes: 12, ano: 1491 })).toBe("3 de Nightal, 1491 DR");
    expect(formatarDataHarptos({ dia: 30, mes: 1, ano: 1492 })).toBe("30 de Hammer, 1492 DR");
  });
  it("data ausente ou inválida não vira texto inventado", () => {
    for (const d of [null, undefined, {}, { dia: 0, mes: 1, ano: 1491 }, { dia: 31, mes: 1, ano: 1491 }, { dia: 1, mes: 13, ano: 1491 }, { dia: 1.5, mes: 1, ano: 1491 }])
      expect(formatarDataHarptos(d as never)).toBeNull();
  });
});

describe("primeiroParagrafo", () => {
  it("ignora imagens, títulos, listas, metadados e parágrafos vazios", () => {
    const blocos = [{ type: "image", props: { url: "x" } }, { type: "heading", content: [txt("Título")] }, par("   "), { type: "paragraph", content: [] },
      { type: "bulletListItem", content: [txt("item")] }, par("O grupo chegou a Neverwinter."), par("Segundo.")];
    expect(primeiroParagrafo(blocos)).toBe("O grupo chegou a Neverwinter.");
  });
  it("junta trechos formatados e normaliza espaços", () => {
    expect(primeiroParagrafo([{ type: "paragraph", content: [txt("Uma  "), { type: "link", content: [txt("noite")] }, txt("\n escura")] }])).toBe("Uma noite escura");
  });
  it("sem parágrafo textual => null", () => {
    expect(primeiroParagrafo([{ type: "image" }, par("")])).toBeNull();
    expect(primeiroParagrafo(null)).toBeNull(); expect(primeiroParagrafo([])).toBeNull();
  });
});

describe("resumirTexto", () => {
  it("não corta texto curto e corta em palavra com reticências", () => {
    expect(resumirTexto("curto", 20)).toBe("curto");
    expect(resumirTexto("um texto bem comprido aqui", 14)).toBe("um texto bem…");
  });
});

describe("maisRecenteVisivel", () => {
  const e = (id: string, publicada: boolean, atualizadaEm: string): EntradaDiario => ({ id, titulo: id, publicada, atualizadaEm, conteudo: [] });
  const lista = [e("a", true, "2026-01-01"), e("b", false, "2026-03-01"), e("c", true, "2026-02-01")];
  it("mestre vê a mais recente, mesmo não publicada", () => expect(maisRecenteVisivel(lista, "mestre")?.id).toBe("b"));
  it("jogador só vê publicadas", () => expect(maisRecenteVisivel(lista, "jogador")?.id).toBe("c"));
  it("sem entradas acessíveis => null", () => { expect(maisRecenteVisivel([e("x", false, "2026-01-01")], "jogador")).toBeNull(); expect(maisRecenteVisivel([], "mestre")).toBeNull(); });
});

describe("previaTexto (cartões e listas)", () => {
  const h = (t: string) => ({ type: "heading", content: [txt(t)] });
  it("inclui títulos e parágrafos (os dois primeiros blocos com texto), ignorando imagens e vazios", () => {
    expect(previaTexto([{ type: "image" }, par(" "), h("Titulo"), par("Ola, tudo bem?"), par("terceiro")])).toBe("Titulo · Ola, tudo bem?");
  });
  it("só título, só lista, ou nada", () => {
    expect(previaTexto([h("Só título")])).toBe("Só título");
    expect(previaTexto([{ type: "bulletListItem", content: [txt("item")] }])).toBe("item");
    expect(previaTexto([{ type: "image" }, par("")])).toBeNull(); expect(previaTexto(null)).toBeNull();
  });
});

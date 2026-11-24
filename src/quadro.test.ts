// Quadro de Planejamento: colunas -> seções -> cartões (funções puras).
import { describe, expect, it } from "vitest";
import { LARGURA_MIN, adicionarCartao, alternarTituloGrande, colunaDaSecao, excluirSecao, excluirSecoes, lerQuadro, moverCartao, novaColuna, novaSecaoDepois, proximoNomeSecao, redimensionarColuna, removerCartao, renomearSecao, soltarCartao, soltarSecao, todasSecoes, todosCartoes, type Quadro } from "./quadro";

/** Coluna c1: seções a (x,y) e b (z); coluna c2: seção c (vazia). */
const q = (): Quadro => ({ colunas: [
  { id: "c1", secoes: [{ id: "a", titulo: "Julkoun", cartoes: ["x", "y"] }, { id: "b", titulo: "Estrada", cartoes: ["z"] }] },
  { id: "c2", secoes: [{ id: "c", titulo: "Floresta", cartoes: [] }] },
] });
const ordem = (x: Quadro) => x.colunas.map(c => c.secoes.map(s => s.id));
const cartoes = (x: Quadro) => x.colunas.map(c => c.secoes.map(s => s.cartoes));

describe("lerQuadro", () => {
  it("lê o formato novo e descarta o inválido sem lançar", () => {
    expect(lerQuadro({ colunas: q().colunas }).colunas).toHaveLength(2);
    for (const m of [null, undefined, {}, { colunas: "x" }, { colunas: [{ id: 1 }] }, { colunas: [{ id: "k" }] }]) expect(lerQuadro(m).colunas).toEqual([]);
  });
  it("formato antigo (coluna com título e cartões) vira coluna com UMA seção, sem perder nada, mantendo a largura", () => {
    const r = lerQuadro({ colunas: [{ id: "k1", titulo: "Sessão 5", cartoes: ["s1", "s2"], largura: 450 }, { id: "k2", titulo: "Floresta", cartoes: [] }] });
    expect(r.colunas[0]).toEqual({ id: "k1", largura: 450, secoes: [{ id: "k1-s", titulo: "Sessão 5", cartoes: ["s1", "s2"] }] });
    expect(r.colunas[1].secoes[0]).toMatchObject({ titulo: "Floresta", cartoes: [] });
  });
  it("cartão repetido só vale na primeira ocorrência; ids repetidos e largura inválida são tratados", () => {
    const r = lerQuadro({ colunas: [{ id: "a", largura: 5000, secoes: [{ id: "s", titulo: "A", cartoes: ["x"] }, { id: "s", titulo: "dup", cartoes: [] }, { id: "t", titulo: "B", cartoes: ["x", "y"], grande: true }] }, { id: "a", secoes: [] }] });
    expect(r.colunas).toHaveLength(1); expect(r.colunas[0].largura).toBe(5000);
    expect(todosCartoes(r)).toEqual(["x", "y"]); expect(r.colunas[0].secoes.map(s => s.id)).toEqual(["s", "t"]); expect(r.colunas[0].secoes[1].grande).toBe(true);
  });
});

describe("seções e colunas", () => {
  it("nova seção entra logo abaixo da seção pedida, na mesma coluna, com nome automático único", () => {
    const r = novaSecaoDepois(q(), "a", undefined, "n");
    expect(ordem(r)).toEqual([["a", "n", "b"], ["c"]]); expect(r.colunas[0].secoes[1].titulo).toBe("Seção 4");
    expect(proximoNomeSecao({ colunas: [{ id: "1", secoes: [{ id: "s", titulo: "Seção 2", cartoes: [] }] }] })).toBe("Seção 3");
    expect(novaSecaoDepois(q(), "nao")).toEqual(q());
  });
  it("nova coluna nasce no fim com uma seção; com nome informado usa o nome", () => {
    const r = novaColuna(q(), undefined, { coluna: "k", secao: "s" });
    expect(r.colunas.at(-1)).toEqual({ id: "k", secoes: [{ id: "s", titulo: "Seção 4", cartoes: [] }] });
    expect(novaColuna(q(), "  Cena  ").colunas.at(-1)!.secoes[0].titulo).toBe("Cena");
  });
  it("renomear, título grande liga e desliga, largura com limites", () => {
    expect(renomearSecao(q(), "a", "Taverna").colunas[0].secoes[0].titulo).toBe("Taverna");
    expect(renomearSecao(q(), "a", " ").colunas[0].secoes[0].titulo).toBe("Julkoun");
    const g = alternarTituloGrande(q(), "a"); expect(g.colunas[0].secoes[0].grande).toBe(true);
    expect(alternarTituloGrande(g, "a").colunas[0].secoes[0]).not.toHaveProperty("grande");
    expect(redimensionarColuna(q(), "c1", 5).colunas[0].largura).toBe(LARGURA_MIN);
    expect(redimensionarColuna(q(), "c1", 1920).colunas[0].largura).toBe(1920);
    expect(redimensionarColuna(q(), "c1", 480).colunas[0].largura).toBe(480); expect(redimensionarColuna(q(), "nao", 480)).toEqual(q());
  });
  it("excluirSecao só exclui seção vazia; a coluna que ficar sem seções some", () => {
    expect(excluirSecao(q(), "a")).toEqual(q());
    expect(ordem(excluirSecao(q(), "c"))).toEqual([["a", "b"]]);
  });
  it("excluirSecoes remove seções inteiras e devolve os cartões para apagar as páginas", () => {
    const r = excluirSecoes(q(), ["a", "c"]);
    expect(ordem(r.quadro)).toEqual([["b"]]); expect(r.cartoes).toEqual(["x", "y"]);
    expect(excluirSecoes(q(), ["nao"])).toEqual({ quadro: q(), cartoes: [] });
    expect(excluirSecoes(q(), ["a", "b"]).cartoes.sort()).toEqual(["x", "y", "z"]);
  });
});

describe("cartões", () => {
  it("adiciona sem duplicar, remove e move com posição", () => {
    expect(cartoes(adicionarCartao(q(), "c", "w"))[1][0]).toEqual(["w"]);
    expect(adicionarCartao(q(), "c", "x")).toEqual(q());
    expect(todosCartoes(removerCartao(q(), "x"))).toEqual(["y", "z"]);
    const m = moverCartao(q(), "x", "b", 0);
    expect(cartoes(m)[0]).toEqual([["y"], ["x", "z"]]); expect(todosCartoes(m).sort()).toEqual(["x", "y", "z"]);
    expect(moverCartao(q(), "x", "nao")).toEqual(q()); expect(moverCartao(q(), "nao", "b")).toEqual(q());
  });
});

describe("soltarCartao (arrastar e soltar)", () => {
  it("sobre outro cartão: entra na posição dele (mesma seção, outra seção)", () => {
    expect(cartoes(soltarCartao(q(), "x", "y"))[0][0]).toEqual(["y", "x"]);
    expect(cartoes(soltarCartao(q(), "y", "x"))[0][0]).toEqual(["y", "x"]);
    expect(cartoes(soltarCartao(q(), "x", "z"))[0]).toEqual([["y"], ["x", "z"]]);
  });
  it("sobre a lista de uma seção ('sec:'), vai para o fim, inclusive seção vazia em outra coluna", () => {
    expect(cartoes(soltarCartao(q(), "x", "sec:c"))[1]).toEqual([["x"]]);
    expect(cartoes(soltarCartao(q(), "x", "sec:b"))[0][1]).toEqual(["z", "x"]);
    expect(cartoes(soltarCartao(q(), "x", "secao:b"))[0][1]).toEqual(["z", "x"]);
  });
  it("sobre o '+' abaixo de uma seção: cria uma seção nova logo abaixo já com o cartão", () => {
    const r = soltarCartao(q(), "x", "abaixo:a", { secao: "n" });
    expect(ordem(r)).toEqual([["a", "n", "b"], ["c"]]); expect(cartoes(r)[0]).toEqual([["y"], ["x"], ["z"]]); expect(todosCartoes(r).sort()).toEqual(["x", "y", "z"]);
  });
  it("sobre 'nova-coluna': cria coluna no fim com seção contendo o cartão, sem perder nem duplicar", () => {
    const r = soltarCartao(q(), "z", "nova-coluna", { coluna: "k", secao: "s" });
    expect(r.colunas.at(-1)).toEqual({ id: "k", secoes: [{ id: "s", titulo: "Seção 4", cartoes: ["z"] }] }); expect(todosCartoes(r).sort()).toEqual(["x", "y", "z"]);
  });
  it("alvo ausente, igual ao ativo ou inexistente não muda nada", () => {
    for (const alvo of [null, undefined, "x", "nao", "sec:nao", "abaixo:nao"]) expect(soltarCartao(q(), "x", alvo)).toEqual(q());
    expect(soltarCartao(q(), "nao", "z")).toEqual(q());
  });
});

describe("soltarSecao (arrastar seções entre colunas e empilhar)", () => {
  it("reordena na mesma coluna nos dois sentidos", () => {
    expect(ordem(soltarSecao(q(), "a", "secao:b"))).toEqual([["b", "a"], ["c"]]);
    expect(ordem(soltarSecao(q(), "b", "secao:a"))).toEqual([["b", "a"], ["c"]]);
  });
  it("passa para outra coluna (antes da seção alvo, ou abaixo dela com 'abaixo:') e a coluna que esvaziar some", () => {
    expect(ordem(soltarSecao(q(), "c", "secao:a"))).toEqual([["c", "a", "b"]]);
    expect(ordem(soltarSecao(q(), "c", "abaixo:a"))).toEqual([["a", "c", "b"]]);
    expect(ordem(soltarSecao(q(), "b", "sec:c"))).toEqual([["a"], ["b", "c"]]);
    expect(ordem(soltarSecao(q(), "a", "z"))).toEqual([["b", "a"], ["c"]]);
  });
  it("'nova-coluna' leva a seção (com seus cartões) para uma coluna nova no fim", () => {
    const r = soltarSecao(q(), "b", "nova-coluna", { coluna: "k" });
    expect(ordem(r)).toEqual([["a"], ["c"], ["b"]]); expect(todosCartoes(r).sort()).toEqual(["x", "y", "z"]);
    expect(colunaDaSecao(r, "b")?.id).toBe("k");
  });
  it("alvo inválido ou a própria seção não muda nada; nunca perde cartões", () => {
    for (const alvo of [null, undefined, "secao:a", "secao:nao", "sec:a"]) expect(soltarSecao(q(), "a", alvo)).toEqual(q());
    expect(soltarSecao(q(), "nao", "secao:a")).toEqual(q());
    expect(todasSecoes(soltarSecao(q(), "a", "secao:c"))).toHaveLength(3);
    expect(todosCartoes(soltarSecao(q(), "a", "secao:c")).sort()).toEqual(["x", "y", "z"]);
  });
});

// Quadro de Planejamento: funções puras.
import { describe, expect, it } from "vitest";
import { adicionarCartao, deslocarCartao, excluirColuna, lerQuadro, moverCartao, moverColuna, novaColuna, removerCartao, renomearColuna, todosCartoes, type Quadro } from "./quadro";

const q = (): Quadro => ({ colunas: [{ id: "a", titulo: "Sessão 5", cartoes: ["x", "y"] }, { id: "b", titulo: "Floresta", cartoes: ["z"] }, { id: "c", titulo: "Vazia", cartoes: [] }] });

describe("lerQuadro", () => {
  it("lê o formato válido e descarta o inválido sem lançar", () => {
    expect(lerQuadro({ colunas: q().colunas }).colunas).toHaveLength(3);
    for (const m of [null, undefined, {}, { colunas: "x" }, { colunas: [{ id: 1 }] }]) expect(lerQuadro(m).colunas).toEqual([]);
  });
  it("cartão repetido em duas colunas só vale na primeira", () => {
    expect(todosCartoes(lerQuadro({ colunas: [{ id: "a", titulo: "A", cartoes: ["x"] }, { id: "b", titulo: "B", cartoes: ["x", "y"] }] }))).toEqual(["x", "y"]);
  });
});

describe("colunas", () => {
  it("cria, renomeia e recusa nomes vazios", () => {
    expect(novaColuna(q(), "  Estrada ", "n").colunas.at(-1)).toEqual({ id: "n", titulo: "Estrada", cartoes: [] });
    expect(novaColuna(q(), "  ").colunas).toHaveLength(3);
    expect(renomearColuna(q(), "a", "Sessão 6").colunas[0].titulo).toBe("Sessão 6");
    expect(renomearColuna(q(), "a", " ").colunas[0].titulo).toBe("Sessão 5");
  });
  it("só exclui coluna vazia: cartões nunca somem junto", () => {
    expect(excluirColuna(q(), "a").colunas).toHaveLength(3);
    expect(excluirColuna(q(), "c").colunas.map(c => c.id)).toEqual(["a", "b"]);
  });
  it("reordena colunas e respeita as pontas", () => {
    expect(moverColuna(q(), "a", 1).colunas.map(c => c.id)).toEqual(["b", "a", "c"]);
    expect(moverColuna(q(), "a", -1)).toEqual(q()); expect(moverColuna(q(), "c", 1)).toEqual(q());
  });
});

describe("cartões", () => {
  it("adiciona sem duplicar e remove", () => {
    expect(adicionarCartao(q(), "c", "w").colunas[2].cartoes).toEqual(["w"]);
    expect(adicionarCartao(q(), "c", "x")).toEqual(q());   // já existe em outra coluna
    expect(todosCartoes(removerCartao(q(), "x"))).toEqual(["y", "z"]);
  });
  it("move para outra coluna na posição pedida, sem perder nem duplicar", () => {
    const m = moverCartao(q(), "x", "b", 0);
    expect(m.colunas[0].cartoes).toEqual(["y"]); expect(m.colunas[1].cartoes).toEqual(["x", "z"]);
    expect(todosCartoes(m).sort()).toEqual(["x", "y", "z"]);
    expect(moverCartao(q(), "x", "inexistente")).toEqual(q()); expect(moverCartao(q(), "nao", "b")).toEqual(q());
  });
  it("sobe, desce e passa para a coluna vizinha", () => {
    expect(deslocarCartao(q(), "y", "cima").colunas[0].cartoes).toEqual(["y", "x"]);
    expect(deslocarCartao(q(), "x", "baixo").colunas[0].cartoes).toEqual(["y", "x"]);
    expect(deslocarCartao(q(), "x", "cima")).toEqual(q());
    expect(deslocarCartao(q(), "y", "direita").colunas.map(c => c.cartoes)).toEqual([["x"], ["z", "y"], []]);
    expect(deslocarCartao(q(), "x", "esquerda")).toEqual(q());
  });
});

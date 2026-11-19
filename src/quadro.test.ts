// Quadro de Planejamento: funções puras.
import { describe, expect, it } from "vitest";
import { adicionarCartao, deslocarCartao, excluirColuna, lerQuadro, moverCartao, moverColuna, novaColuna, removerCartao, renomearColuna, soltarCartao, soltarColuna, proximoNomeColuna, moverParaNovaColuna, todosCartoes, redimensionarColuna, LARGURA_MAX, LARGURA_MIN, type Quadro } from "./quadro";

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

describe("soltarCartao (arrastar e soltar)", () => {
  it("solta sobre cartão de outra coluna na posição dele; sobre coluna vazia vai ao fim", () => {
    expect(soltarCartao(q(), "x", "z").colunas.map(c => c.cartoes)).toEqual([["y"], ["x", "z"], []]);
    expect(soltarCartao(q(), "x", "col:c").colunas.map(c => c.cartoes)).toEqual([["y"], ["z"], ["x"]]);
    expect(soltarCartao(q(), "x", "col:b").colunas[1].cartoes).toEqual(["z", "x"]);
  });
  it("reordena na mesma coluna nos dois sentidos", () => {
    expect(soltarCartao(q(), "x", "y").colunas[0].cartoes).toEqual(["y", "x"]);
    expect(soltarCartao(q(), "y", "x").colunas[0].cartoes).toEqual(["y", "x"]);
  });
  it("alvo ausente, igual ao ativo ou inexistente não muda nada nem perde cartões", () => {
    for (const alvo of [null, undefined, "x", "nao", "col:nao"]) expect(soltarCartao(q(), "x", alvo)).toEqual(q());
    expect(soltarCartao(q(), "nao", "z")).toEqual(q());
  });
});

describe("colunas arrastáveis e nova coluna sem nome", () => {
  it("soltarColuna reordena sobre outra coluna, sobre a lista dela ou sobre um cartão dela", () => {
    expect(soltarColuna(q(), "a", "coluna:b").colunas.map(c => c.id)).toEqual(["b", "a", "c"]);
    expect(soltarColuna(q(), "c", "col:a").colunas.map(c => c.id)).toEqual(["c", "a", "b"]);
    expect(soltarColuna(q(), "a", "z").colunas.map(c => c.id)).toEqual(["b", "a", "c"]);          // z está na coluna b
    expect(soltarColuna(q(), "a", "nova-coluna").colunas.map(c => c.id)).toEqual(["b", "c", "a"]);
  });
  it("soltarColuna ignora alvo ausente, a própria coluna ou desconhecido, sem perder cartões", () => {
    for (const alvo of [null, undefined, "coluna:a", "col:a", "x", "coluna:nao"]) expect(soltarColuna(q(), "a", alvo)).toEqual(q());
    expect(soltarColuna(q(), "nao", "coluna:b")).toEqual(q());
  });
  it("nomes automáticos nunca repetem e a nova coluna nasce com o cartão arrastado", () => {
    expect(proximoNomeColuna(q())).toBe("Coluna 4");
    expect(proximoNomeColuna({ colunas: [{ id: "1", titulo: "Coluna 2", cartoes: [] }] })).toBe("Coluna 3");
    const m = moverParaNovaColuna(q(), "x", undefined, "n");
    expect(m.colunas.at(-1)).toEqual({ id: "n", titulo: "Coluna 4", cartoes: ["x"] });
    expect(m.colunas[0].cartoes).toEqual(["y"]); expect(todosCartoes(m).sort()).toEqual(["x", "y", "z"]);
    expect(moverParaNovaColuna(q(), "nao")).toEqual(q());
  });
  it("soltar um cartão sobre a coluna arrastável manda o cartão para o fim dela", () => {
    expect(soltarCartao(q(), "x", "coluna:b").colunas[1].cartoes).toEqual(["z", "x"]);
  });
});

describe("largura das colunas", () => {
  it("redimensiona só a coluna pedida, com limites, sem tocar nos cartões", () => {
    const r = redimensionarColuna(q(), "a", 480);
    expect(r.colunas[0]).toEqual({ id: "a", titulo: "Sessão 5", cartoes: ["x", "y"], largura: 480 });
    expect(r.colunas[1].largura).toBeUndefined();
    expect(redimensionarColuna(q(), "a", 5).colunas[0].largura).toBe(LARGURA_MIN);
    expect(redimensionarColuna(q(), "a", 99999).colunas[0].largura).toBe(LARGURA_MAX);
    expect(redimensionarColuna(q(), "nao", 400)).toEqual(q()); expect(redimensionarColuna(q(), "a", NaN)).toEqual(q());
  });
  it("a largura sobrevive a ler, mover cartões e renomear; valores inválidos são descartados ou limitados", () => {
    const base = redimensionarColuna(q(), "a", 450);
    expect(lerQuadro({ colunas: base.colunas }).colunas[0].largura).toBe(450);
    expect(moverCartao(base, "x", "b").colunas[0].largura).toBe(450);
    expect(renomearColuna(base, "a", "Novo").colunas[0].largura).toBe(450);
    expect(lerQuadro({ colunas: [{ id: "1", titulo: "T", cartoes: [], largura: "larga" }] }).colunas[0].largura).toBeUndefined();
    expect(lerQuadro({ colunas: [{ id: "1", titulo: "T", cartoes: [], largura: 5000 }] }).colunas[0].largura).toBe(LARGURA_MAX);
  });
});

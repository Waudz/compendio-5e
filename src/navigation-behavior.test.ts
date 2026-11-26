import { describe, expect, it } from "vitest";
import { createModel, findTab, groupCount, groups, isColumnsOnly, moveToNewColumn } from "./workspace";
import { navigate, openContentLink } from "./navigation";

const ids = (m: ReturnType<typeof createModel>) => groups(m).map(g => g.getChildren().map(t => t.getId()));

describe("navegação que preserva o espaço de trabalho", () => {
  it("menu não substitui abas existentes, mesmo no modo legado reuse", () => {
    const m = createModel();
    navigate(m, { kind: "secao", ref: "iniciativa" }, "reuse");
    navigate(m, { kind: "secao", ref: "compendio" }, "reuse");
    expect(ids(m)[0]).toEqual(["secao:personagens", "secao:iniciativa", "secao:compendio"]);
    expect(isColumnsOnly(m.toJson())).toBe(true);
  });
  it("consultas criam grupos à direita e preservam a origem", () => {
    const m = createModel();
    openContentLink(m, { kind: "item", ref: "espada" }, "secao:personagens");
    expect(groupCount(m)).toBe(2);
    expect(ids(m)).toEqual([["secao:personagens"], ["item:espada"]]);
    openContentLink(m, { kind: "item", ref: "escudo" }, "secao:personagens");
    expect(groupCount(m)).toBe(2);
    expect(ids(m)[1]).toEqual(["item:espada", "item:escudo"]);
    // Não há terceira coluna: o limite é de dois grupos, inclusive para o usuário.
    expect(moveToNewColumn(m, "item:escudo", "right")).toBe(false);
    openContentLink(m, { kind: "item", ref: "arco" }, "secao:personagens");
    expect(groupCount(m)).toBe(2);
    expect(ids(m)[1]).toEqual(["item:espada", "item:escudo", "item:arco"]);
    expect(isColumnsOnly(m.toJson())).toBe(true);
  });
  it("consulta pode abrir como aba do próprio grupo, sem criar coluna nem duplicar", () => {
    const m = createModel();
    openContentLink(m, { kind: "registro", ref: "julkoun" }, "secao:personagens", false, true);
    expect(ids(m)).toEqual([["secao:personagens", "registro:julkoun"]]);
    openContentLink(m, { kind: "registro", ref: "julkoun" }, "secao:personagens");
    expect(ids(m).flat().filter(x => x === "registro:julkoun")).toHaveLength(1);
    expect(isColumnsOnly(m.toJson())).toBe(true);
  });
  it("não duplica consulta existente", () => {
    const m = createModel();
    openContentLink(m, { kind: "item", ref: "espada" });
    openContentLink(m, { kind: "item", ref: "espada" });
    expect(ids(m).flat().filter(x => x === "item:espada")).toHaveLength(1);
    expect(findTab(m, "item:espada")).toBeTruthy();
  });
  it("celular abre conteúdo no grupo atual sem dividir a tela", () => {
    const m = createModel();
    openContentLink(m, { kind: "item", ref: "espada" }, "secao:personagens", true);
    expect(groupCount(m)).toBe(1);
    expect(ids(m)[0]).toEqual(["secao:personagens", "item:espada"]);
  });
});

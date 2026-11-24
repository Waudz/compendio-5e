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
    // Terceira coluna é uma decisão manual do usuário.
    expect(moveToNewColumn(m, "item:escudo", "right")).toBe(true);
    expect(groupCount(m)).toBe(3);
    openContentLink(m, { kind: "item", ref: "arco" }, "secao:personagens");
    expect(groupCount(m)).toBe(3);
    expect(ids(m)[2]).toEqual(["item:escudo", "item:arco"]);
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

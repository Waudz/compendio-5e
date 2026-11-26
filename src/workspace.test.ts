import { describe, expect, it } from "vitest";
import { Actions, DockLocation, type IJsonModel, type Model, TabSetNode } from "flexlayout-react";
import { MAX_GROUPS, allowDrop, closeGroup, closeOthers, closeTab, createModel, defaultLayout, findTab, groupCount, groups, isColumnsOnly, moveToGroup, moveToNewColumn, openTab, sanitizeLayout, tabId } from "./workspace";

const sec = (ref: string) => ({ kind: "secao" as const, ref });
const ids = (m: Model) => groups(m).map(g => g.getChildren().map(c => c.getId()));
const valid = (m: Model) => isColumnsOnly(m.toJson());

/** Modelo com 3 abas no primeiro grupo. */
function base() {
  const m = createModel();
  openTab(m, sec("iniciativa")); openTab(m, sec("encontros"));
  return m;
}

describe("abrir abas", () => {
  it("abre no grupo ativo sem substituir as existentes", () => {
    const m = base();
    expect(ids(m)).toEqual([["secao:personagens", "secao:iniciativa", "secao:encontros"]]);
  });
  it("focar uma aba já aberta não duplica e ativa o grupo onde ela está", () => {
    const m = base(); moveToNewColumn(m, "secao:encontros", "right");
    openTab(m, sec("personagens"));
    expect(m.getActiveTabset()).toBe(findTab(m, "secao:personagens")!.getParent());
    openTab(m, sec("personagens"));
    expect(ids(m).flat().filter(x => x === "secao:personagens")).toHaveLength(1);
  });
  it("várias entidades coexistem com ids próprios, sem duplicar a mesma", () => {
    const m = createModel();
    openTab(m, { kind: "ficha", ref: "lydia", title: "Lydia" }); openTab(m, { kind: "ficha", ref: "sabine" });
    openTab(m, { kind: "npc", ref: "sabine" }); openTab(m, { kind: "ficha", ref: "lydia" });
    expect(ids(m).flat()).toEqual(["secao:personagens", "ficha:lydia", "ficha:sabine", "npc:sabine"]);
    expect(tabId({ kind: "documento", ref: "d1" })).toBe("documento:d1");
  });
});

describe("abas de campanha", () => {
  it("reabrir com novo título renomeia a aba existente, sem duplicar", () => {
    const m = createModel();
    openTab(m, { kind: "campanha", ref: "abc-123", title: "Festival" });
    openTab(m, { kind: "campanha", ref: "abc-123", title: "Festival II" });
    expect(ids(m).flat().filter(x => x === "campanha:abc-123")).toHaveLength(1);
    expect(findTab(m, "campanha:abc-123")!.getName()).toBe("Festival II");
  });
});

describe("grupos (colunas)", () => {
  it("cria grupos à esquerda e à direita", () => {
    const m = base();
    expect(moveToNewColumn(m, "secao:encontros", "right")).toBe(true);
    expect(moveToNewColumn(m, "secao:encontros", "left")).toBe(true);
    expect(ids(m)).toEqual([["secao:encontros"], ["secao:personagens", "secao:iniciativa"]]);
    expect(valid(m)).toBe(true);
  });
  it("respeita o limite de dois grupos", () => {
    const m = base(); openTab(m, sec("documentos"));
    moveToNewColumn(m, "secao:encontros", "right"); moveToNewColumn(m, "secao:iniciativa", "left");
    expect(groupCount(m)).toBe(MAX_GROUPS);
    expect(moveToNewColumn(m, "secao:documentos", "right")).toBe(false);
    expect(moveToNewColumn(m, "secao:documentos", "left")).toBe(false);
    expect(groupCount(m)).toBe(MAX_GROUPS);
  });
  it("com 2 grupos ainda permite reposicionar uma aba que está sozinha no seu grupo", () => {
    const m = base(); moveToNewColumn(m, "secao:encontros", "right"); moveToNewColumn(m, "secao:iniciativa", "left");
    expect(moveToNewColumn(m, "secao:encontros", "left")).toBe(true);
    expect(groupCount(m)).toBe(2);
    expect(ids(m)[0]).toEqual(["secao:encontros"]);
  });
  it("move abas entre grupos e reordena dentro do grupo", () => {
    const m = base(); moveToNewColumn(m, "secao:encontros", "right");
    moveToGroup(m, "secao:iniciativa", groups(m)[1].getId());
    expect(ids(m)).toEqual([["secao:personagens"], ["secao:encontros", "secao:iniciativa"]]);
    m.doAction(Actions.moveNode("secao:iniciativa", groups(m)[1].getId(), DockLocation.CENTER, 0));
    expect(ids(m)[1]).toEqual(["secao:iniciativa", "secao:encontros"]);
  });
});

describe("sem empilhamento vertical", () => {
  it("rejeita soltura em cima/embaixo e aceita esquerda/direita/centro", () => {
    const m = base(); const tab = findTab(m, "secao:encontros")!;
    expect(allowDrop(m, tab, { location: DockLocation.TOP })).toBe(false);
    expect(allowDrop(m, tab, { location: DockLocation.BOTTOM })).toBe(false);
    expect(allowDrop(m, tab, { location: DockLocation.LEFT })).toBe(true);
    expect(allowDrop(m, tab, { location: DockLocation.RIGHT })).toBe(true);
    expect(allowDrop(m, tab, { location: DockLocation.CENTER })).toBe(true);
  });
  it("o modelo instalado consulta o filtro durante o arraste", () => {
    const m = base(); const g = groups(m)[0];
    const cb = (m as unknown as { onAllowDrop?: (...a: unknown[]) => boolean }).onAllowDrop;
    expect(typeof cb).toBe("function");
    const tab = findTab(m, "secao:encontros")!;
    expect(cb!(tab, { node: g, location: DockLocation.BOTTOM })).toBe(false);
  });
  it("isColumnsOnly detecta linha dentro de coluna e excesso de grupos", () => {
    const j = defaultLayout();
    expect(isColumnsOnly(j)).toBe(true);
    const nested: IJsonModel = { ...j, layout: { type: "row", children: [{ type: "row", children: [{ type: "tabset", children: [] }] }] } };
    expect(isColumnsOnly(nested)).toBe(false);
    const four: IJsonModel = { ...j, layout: { type: "row", children: Array.from({ length: 4 }, () => ({ type: "tabset" as const, children: [] })) } };
    expect(isColumnsOnly(four)).toBe(false);
  });
  it("sanitizeLayout achata linhas aninhadas em colunas", () => {
    const out = sanitizeLayout({ layout: { type: "row", children: [
      { type: "tabset", weight: 50, children: [{ id: "secao:personagens" }] },
      { type: "row", children: [{ type: "tabset", weight: 25, children: [{ id: "secao:iniciativa" }] }, { type: "tabset", weight: 25, children: [{ id: "secao:encontros" }] }] },
    ] } })!;
    expect(isColumnsOnly(out)).toBe(true);
    expect(out.layout.children).toHaveLength(2);
  });
  it("sanitizeLayout funde excesso de grupos em no máximo 2", () => {
    const out = sanitizeLayout({ layout: { type: "row", children: ["personagens", "iniciativa", "encontros", "enciclopedia", "documentos"].map(p => ({ type: "tabset", weight: 20, children: [{ id: `secao:${p}` }] })) } })!;
    expect(out.layout.children).toHaveLength(2);
    expect(out.layout.children!.flatMap(g => (g as { children: unknown[] }).children)).toHaveLength(5);
  });
});

describe("redimensionar", () => {
  it("ajusta os pesos dos grupos e os preserva no JSON", () => {
    const m = base(); moveToNewColumn(m, "secao:encontros", "right");
    const [a, b] = groups(m);
    m.doAction(Actions.adjustWeights(m.getRootRow()!.getId(), [70, 30]));
    expect(a.getWeight()).toBeCloseTo(70); expect(b.getWeight()).toBeCloseTo(30);
    const w = (m.toJson().layout.children as { weight: number }[]).map(g => g.weight);
    expect(w[0] / w[1]).toBeCloseTo(70 / 30);
  });
});

describe("fechar", () => {
  it("fechar aba mantém o resto e a seleção válida", () => {
    const m = base(); closeTab(m, "secao:encontros");
    expect(ids(m)).toEqual([["secao:personagens", "secao:iniciativa"]]);
    expect(groups(m)[0].getSelectedNode()).toBeDefined();
  });
  it("fechar a última aba de um grupo remove o grupo e o layout continua válido", () => {
    const m = base(); moveToNewColumn(m, "secao:encontros", "right");
    closeTab(m, "secao:encontros");
    expect(groupCount(m)).toBe(1); expect(valid(m)).toBe(true);
  });
  it("fechar grupo inteiro, e fechar tudo deixa um grupo vazio válido", () => {
    const m = base(); moveToNewColumn(m, "secao:encontros", "right");
    closeGroup(m, groups(m)[1].getId());
    expect(ids(m)).toEqual([["secao:personagens", "secao:iniciativa"]]);
    closeTab(m, "secao:personagens"); closeTab(m, "secao:iniciativa");
    expect(groupCount(m)).toBe(1); expect(valid(m)).toBe(true);
    openTab(m, sec("compendio"));
    expect(ids(m)).toEqual([["secao:compendio"]]);
  });
  it("fechar outras abas", () => {
    const m = base(); closeOthers(m, "secao:iniciativa");
    expect(ids(m)).toEqual([["secao:iniciativa"]]);
  });
});

describe("sequência de operações aleatórias mantém o layout válido", () => {
  it("1000 ações pseudoaleatórias", () => {
    let seed = 7; const rnd = (n: number) => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed % n; };
    const m = createModel();
    const pool = [...["personagens", "iniciativa", "encontros", "enciclopedia", "compendio", "documentos"].map(r => ({ kind: "secao" as const, ref: r })), { kind: "ficha" as const, ref: "a" }, { kind: "npc" as const, ref: "b" }];
    for (let i = 0; i < 1000; i++) {
      const g = groups(m); const all = g.flatMap(x => x.getChildren().map(c => c.getId()));
      switch (rnd(7)) {
        case 0: openTab(m, pool[rnd(pool.length)]); break;
        case 1: if (all.length) closeTab(m, all[rnd(all.length)]); break;
        case 2: if (all.length) moveToNewColumn(m, all[rnd(all.length)], rnd(2) ? "left" : "right"); break;
        case 3: if (all.length) moveToGroup(m, all[rnd(all.length)], g[rnd(g.length)].getId()); break;
        case 4: if (g.length > 1) closeGroup(m, g[rnd(g.length)].getId()); break;
        case 5: { const tab = all.length ? m.getNodeById(all[rnd(all.length)]) : undefined; const t = g[rnd(g.length)];
          const loc = [DockLocation.TOP, DockLocation.BOTTOM, DockLocation.LEFT, DockLocation.RIGHT, DockLocation.CENTER][rnd(5)];
          if (tab && allowDrop(m, tab, { location: loc })) m.doAction(Actions.moveNode(tab.getId(), t.getId(), loc, -1)); break; }
        default: if (g.length > 1) m.doAction(Actions.adjustWeights(m.getRootRow()!.getId(), g.map(() => 1 + rnd(9)))); break;
      }
      expect(valid(m)).toBe(true);
      const flat = groups(m).flatMap(x => x.getChildren().map(c => c.getId()));
      expect(new Set(flat).size).toBe(flat.length);
      expect(m.getRootRow()!.getChildren().every(c => c instanceof TabSetNode)).toBe(true);
    }
  });
});


describe("múltiplas instâncias de Anotações pelo menu lateral", () => {
  it("abre novas abas distintas e restaura as instâncias ao carregar layout", async () => {
    const { navigate } = await import("./navigation");
    const m = createModel();
    const spec = sec("planejamento");
    navigate(m, spec, "new");
    navigate(m, spec, "newPinned");
    expect(ids(m)[0]).toContain("secao:planejamento~2");
    expect(ids(m)[0]).toContain("secao:planejamento~3");
    const restored = sanitizeLayout(m.toJson());
    expect(restored).not.toBeNull();
    const restoredIds = JSON.stringify(restored);
    expect(restoredIds).toContain("secao:planejamento~2");
    expect(restoredIds).toContain("secao:planejamento~3");
  });
});

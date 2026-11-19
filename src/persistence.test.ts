import { describe, expect, it } from "vitest";
import { VERSION, legacyKey, loadLayout, migrateV1, saveLayout, storageKey } from "./persistence";
import { createModel, defaultLayout, groups, isColumnsOnly, moveToNewColumn, openTab } from "./workspace";
import { Actions } from "flexlayout-react";

const mem = (init: Record<string, string> = {}) => { const d = new Map(Object.entries(init)); return { d, getItem: (k: string) => d.get(k) ?? null, setItem: (k: string, v: string) => { d.set(k, v); } }; };
const scope = { user: "u1", campaign: "c1", device: "desktop" };

describe("persistência", () => {
  it("chave separa usuário, campanha e dispositivo", () => {
    expect(storageKey(scope)).toBe(`compendio5e:workspace:v${VERSION}:u1:c1:desktop`);
    expect(storageKey({ ...scope, campaign: "c2" })).not.toBe(storageKey(scope));
  });
  it("sem dados salvos usa o layout padrão", () => {
    expect(loadLayout(scope, mem())).toEqual(defaultLayout());
  });
  it("restaura abas, grupos, dimensões, aba selecionada e grupo ativo", () => {
    const m = createModel(); openTab(m, { kind: "ficha", ref: "lydia" }); openTab(m, { kind: "secao", ref: "encontros" });
    moveToNewColumn(m, "secao:encontros", "right"); openTab(m, { kind: "npc", ref: "sabine" });
    m.doAction(Actions.adjustWeights(m.getRootRow()!.getId(), [30, 70]));
    const store = mem(); saveLayout(m.toJson(), scope, store);
    const m2 = createModel(loadLayout(scope, store));
    const g = groups(m2);
    expect(g.map(x => x.getChildren().map(c => c.getId()))).toEqual([["secao:personagens", "ficha:lydia"], ["secao:encontros", "npc:sabine"]]);
    expect(g[0].getWeight() / g[1].getWeight()).toBeCloseTo(30 / 70);
    expect(g[1].getSelectedNode()?.getId()).toBe("npc:sabine");
    expect(m2.getActiveTabset()).toBe(g[1]);
  });
  it.each([
    ["JSON quebrado", "{"],
    ["versão desconhecida", JSON.stringify({ version: 99, layout: { type: "row", children: [] } })],
    ["sem layout", JSON.stringify({ version: VERSION })],
    ["layout vazio", JSON.stringify({ version: VERSION, layout: { type: "row", children: [] } })],
    ["tipos errados", JSON.stringify({ version: VERSION, layout: { type: "row", children: [{ type: "tabset", children: [{ id: 5 }, null, { id: "xxx:yy" }] }, 7] } })],
    ["null", "null"],
  ])("recupera dado inválido (%s) com o layout padrão", (_n, raw) => {
    const out = loadLayout(scope, mem({ [storageKey(scope)]: raw }));
    expect(isColumnsOnly(out)).toBe(true);
    expect(() => createModel(out)).not.toThrow();
  });
  it("descarta abas repetidas, ids inválidos e pesos ruins", () => {
    const raw = JSON.stringify({ version: VERSION, layout: { type: "row", children: [
      { type: "tabset", weight: -5, selected: 9, children: [{ id: "secao:personagens" }, { id: "secao:personagens" }, { id: "ficha:a b" }] },
      { type: "tabset", weight: "x", children: [{ id: "secao:personagens" }, { id: "ficha:z" }] },
    ] } });
    const m = createModel(loadLayout(scope, mem({ [storageKey(scope)]: raw })));
    expect(groups(m).map(g => g.getChildren().map(c => c.getId()))).toEqual([["secao:personagens"], ["ficha:z"]]);
    expect(groups(m).every(g => g.getWeight() > 0)).toBe(true);
  });
  it("migra o esquema v1 (colunas) para o atual", () => {
    const v1 = { columns: [
      { id: "a", tabs: [{ id: "personagens", page: "personagens" }, { id: "iniciativa", page: "iniciativa" }], active: "iniciativa", width: 40 },
      { id: "b", tabs: [{ id: "compendio", page: "compendio" }], active: "compendio", width: 60 }], focused: "b" };
    expect(migrateV1(v1)).not.toBeNull();
    const m = createModel(loadLayout(scope, mem({ [legacyKey]: JSON.stringify(v1) })));
    expect(groups(m).map(g => g.getChildren().map(c => c.getId()))).toEqual([["secao:personagens", "secao:iniciativa"], ["secao:compendio"]]);
    expect(groups(m)[0].getSelectedNode()?.getId()).toBe("secao:iniciativa");
  });
  it("armazenamento indisponível não derruba", () => {
    expect(loadLayout(scope, null)).toEqual(defaultLayout());
    expect(() => saveLayout(defaultLayout(), scope, { getItem: () => null, setItem: () => { throw new Error("cota"); } })).not.toThrow();
  });
});

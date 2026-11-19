import { beforeEach, describe, expect, it, vi } from "vitest";
import { first, key, restore } from "./workspace";

const store = new Map<string, string>();
beforeEach(() => {
  store.clear();
  vi.stubGlobal("localStorage", {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => { store.set(k, v); },
  });
});

describe("restauração do workspace", () => {
  it("usa um layout inicial sem dados salvos", () => {
    expect(restore()).toEqual(first);
  });
  it("descarta dados inválidos", () => {
    store.set(key, "{");
    expect(restore()).toEqual(first);
  });
  it("recusa a mesma aba em duas colunas", () => {
    store.set(key, JSON.stringify({ columns: [
      { id: "a", tabs: [{ id: "personagens", page: "personagens" }], active: "personagens", width: 50 },
      { id: "b", tabs: [{ id: "personagens", page: "personagens" }], active: "personagens", width: 50 },
    ], focused: "a" }));
    expect(restore()).toEqual(first);
  });
  it("preserva a coluna vazia depois de fechar todas as abas", () => {
    store.set(key, JSON.stringify({ columns: [{ id: "a", tabs: [], active: "", width: 100 }], focused: "a" }));
    expect(restore().columns[0].tabs).toEqual([]);
  });
});

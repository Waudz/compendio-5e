// Divisão de painéis com aba única e painéis vazios intencionais (correção do bug "soltar a única aba na lateral não faz nada").
import { describe, expect, it } from "vitest";
import { Action, Actions, DockLocation, type Model } from "flexlayout-react";
import { loadLayout, saveLayout, storageKey, type Scope } from "./persistence";
import { MAX_GROUPS, allowDrop, classifyDrop, closeGroup, closeTab, createModel, findTab, groupCount, groups, isColumnsOnly, isIntentionalEmpty, moveToGroup, moveToNewColumn, normalizeEmptyPanels, openTab, prepareMove, sanitizeLayout } from "./workspace";

const sec = (ref: string) => ({ kind: "secao" as const, ref });
const ids = (m: Model) => groups(m).map(g => g.getChildren().map(c => c.getId()));
const valid = (m: Model) => isColumnsOnly(m.toJson());

/** Faz o que o FlexLayout faz ao soltar: consulta o filtro, passa pela interceptação (`onAction`) e aplica; depois a normalização de `onModelChange`. */
function drop(m: Model, tabOrGroupId: string, targetId: string, loc: DockLocation): boolean {
  const drag = m.getNodeById(tabOrGroupId)!, target = m.getNodeById(targetId)!;
  if (!allowDrop(m, drag, { location: loc, node: target })) return false;
  const a = prepareMove(m, Actions.moveNode(tabOrGroupId, targetId, loc, -1, true)) as Action | undefined;
  if (!a) return false;
  m.doAction(a); normalizeEmptyPanels(m);
  return true;
}
const rootId = (m: Model) => m.getRootRow()!.getId();
const memory = () => { const d = new Map<string, string>(); return { getItem: (k: string) => d.get(k) ?? null, setItem: (k: string, v: string) => { d.set(k, v); } }; };
const scope: Scope = { user: "u1", campaign: "nenhuma", device: "navegador" };
const roundTrip = (m: Model) => { const s = memory(); saveLayout(m.toJson(), scope, s); return createModel(loadLayout(scope, s)); };

describe("aba única: dividir à esquerda e à direita", () => {
  it.each([["right", DockLocation.RIGHT, 1], ["left", DockLocation.LEFT, 0]] as const)("solta na lateral %s do próprio painel: aba no lado indicado e painel vazio do outro", (_n, loc, tabIndex) => {
    const m = createModel(); const g = groups(m)[0];
    expect(drop(m, "secao:personagens", g.getId(), loc)).toBe(true);
    expect(groupCount(m)).toBe(2);
    expect(ids(m)[tabIndex]).toEqual(["secao:personagens"]);
    expect(ids(m)[1 - tabIndex]).toEqual([]);
    expect(isIntentionalEmpty(groups(m)[1 - tabIndex])).toBe(true);
    expect(valid(m)).toBe(true);
  });
  it("também pela borda da área (linha raiz)", () => {
    const m = createModel();
    expect(drop(m, "secao:personagens", rootId(m), DockLocation.LEFT)).toBe(true);
    expect(ids(m)).toEqual([["secao:personagens"], []]);
    const n = createModel();
    expect(drop(n, "secao:personagens", rootId(n), DockLocation.RIGHT)).toBe(true);
    expect(ids(n)).toEqual([[], ["secao:personagens"]]);
  });
  it("não duplica a aba nem perde seleção/identidade; o painel vazio passa a ser o ativo", () => {
    const m = createModel(); const before = findTab(m, "secao:personagens")!;
    drop(m, "secao:personagens", groups(m)[0].getId(), DockLocation.RIGHT);
    const all = ids(m).flat();
    expect(all).toEqual(["secao:personagens"]);
    expect(findTab(m, "secao:personagens")).toBe(before);                 // mesmo nó: sem remontar
    expect(m.getActiveTabset()).toBe(groups(m)[0]);                       // painel vazio, pronto para receber a próxima seção
    expect(groups(m)[1].getSelectedNode()).toBe(before);
  });
  it("o menu de contexto usa a mesma regra (nova coluna à esquerda/direita com aba única)", () => {
    const a = createModel(); expect(moveToNewColumn(a, "secao:personagens", "right")).toBe(true); expect(ids(a)).toEqual([[], ["secao:personagens"]]);
    const b = createModel(); expect(moveToNewColumn(b, "secao:personagens", "left")).toBe(true); expect(ids(b)).toEqual([["secao:personagens"], []]);
  });
});

describe("preencher o painel vazio", () => {
  const split = () => { const m = createModel(); drop(m, "secao:personagens", groups(m)[0].getId(), DockLocation.RIGHT); return m; };   // [vazio][personagens]

  it("pelo menu lateral: a seção abre no painel vazio (ativo) e ele vira painel normal", () => {
    const m = split();
    openTab(m, sec("iniciativa")); normalizeEmptyPanels(m);
    expect(ids(m)).toEqual([["secao:iniciativa"], ["secao:personagens"]]);
    expect(groups(m).some(isIntentionalEmpty)).toBe(false);
    expect(groups(m).every(g => g.isEnableDeleteWhenEmpty())).toBe(true);
  });
  it("arrastando outra aba para o painel vazio (centro)", () => {
    const m = split(); openTab(m, sec("encontros"));            // ativo = vazio → vai para lá; devolvemos ao outro para testar o arraste
    moveToGroup(m, "secao:encontros", groups(m)[1].getId()); normalizeEmptyPanels(m);
    const e = groups(m).find(g => g.getChildren().length === 0)!;
    expect(e).toBeDefined(); expect(isIntentionalEmpty(e)).toBe(true);
    expect(drop(m, "secao:encontros", e.getId(), DockLocation.CENTER)).toBe(true);
    expect(ids(m)).toEqual([["secao:encontros"], ["secao:personagens"]]);
    expect(groups(m).some(isIntentionalEmpty)).toBe(false);
  });
  it("arrastar a única aba do painel lateral para dentro do vazio reposiciona sem criar painéis extras", () => {
    const m = split();
    expect(drop(m, "secao:personagens", groups(m)[0].getId(), DockLocation.CENTER)).toBe(true);
    expect(groupCount(m)).toBe(1); expect(ids(m)).toEqual([["secao:personagens"]]);
    expect(valid(m)).toBe(true);
  });
  it("fechar a última aba de um painel PREENCHIDO o remove (nenhum vazio involuntário)", () => {
    const m = split(); openTab(m, sec("iniciativa")); normalizeEmptyPanels(m);   // [iniciativa][personagens]
    closeTab(m, "secao:iniciativa"); normalizeEmptyPanels(m);
    expect(ids(m)).toEqual([["secao:personagens"]]);
  });
  it("fechar a última aba do painel com conteúdo ao lado de um vazio intencional deixa só o vazio; ele continua válido", () => {
    const m = split();                                           // [vazio][personagens]
    closeTab(m, "secao:personagens"); normalizeEmptyPanels(m);
    expect(groupCount(m)).toBe(1); expect(ids(m)).toEqual([[]]); expect(valid(m)).toBe(true);
    openTab(m, sec("compendio")); expect(ids(m)).toEqual([["secao:compendio"]]);
  });
  it("o painel vazio intencional pode ser fechado pelo usuário", () => {
    const m = split(); closeGroup(m, groups(m).find(isIntentionalEmpty)!.getId());
    expect(ids(m)).toEqual([["secao:personagens"]]);
  });
  it("coluna normal esvaziada por fechar aba nunca vira painel vazio (diferença para o intencional)", () => {
    const m = createModel(); openTab(m, sec("iniciativa"));
    moveToNewColumn(m, "secao:iniciativa", "right");                              // [personagens][iniciativa] (personagens tem 1 aba? não: iniciativa saiu)
    closeTab(m, "secao:iniciativa"); normalizeEmptyPanels(m);
    expect(groupCount(m)).toBe(1); expect(groups(m).some(isIntentionalEmpty)).toBe(false);
  });
});

describe("limite de colunas e indicadores", () => {
  it("com 2 painéis, dividir a aba única seria o 3º: o indicador não é oferecido e nada acontece", () => {
    const m = createModel(); openTab(m, sec("iniciativa")); moveToNewColumn(m, "secao:iniciativa", "right");   // [personagens][iniciativa]
    expect(groupCount(m)).toBe(MAX_GROUPS);
    const g = groups(m)[1];
    expect(classifyDrop(m, g.getChildren()[0] as never, g, DockLocation.LEFT).allowed).toBe(false);
    expect(drop(m, g.getChildren()[0].getId(), g.getId(), DockLocation.RIGHT)).toBe(false);
    expect(moveToNewColumn(m, g.getChildren()[0].getId(), "left")).toBe(true);        // mas reposicionar ainda é permitido
    expect(groupCount(m)).toBe(2);
  });
  it("com 1 painel dividir a aba única ainda cabe (vira 2)", () => {
    const m = createModel();
    expect(drop(m, "secao:personagens", groups(m)[0].getId(), DockLocation.RIGHT)).toBe(true);
    expect(groupCount(m)).toBe(2); expect(valid(m)).toBe(true);
  });
  it("nunca oferece em cima/embaixo nem operações que não mudam nada (vizinho imediato)", () => {
    const m = createModel(); openTab(m, sec("iniciativa")); moveToNewColumn(m, "secao:iniciativa", "right");   // [personagens][iniciativa]
    const [a, b] = groups(m);
    const tab = a.getChildren()[0];
    expect(allowDrop(m, tab, { location: DockLocation.TOP, node: a })).toBe(false);
    expect(allowDrop(m, tab, { location: DockLocation.BOTTOM, node: b })).toBe(false);
    expect(allowDrop(m, tab, { location: DockLocation.LEFT, node: b })).toBe(false);      // já está à esquerda de b: nada mudaria
    expect(allowDrop(m, b.getChildren()[0], { location: DockLocation.RIGHT, node: a })).toBe(false);
    expect(allowDrop(m, a, { location: DockLocation.LEFT, node: a })).toBe(false);        // painel inteiro sobre si mesmo
    expect(allowDrop(m, tab, { location: DockLocation.RIGHT, node: b })).toBe(true);      // reposiciona
  });
  it("prepareMove recusa o que o filtro recusa (defesa em profundidade) e deixa passar ações que não são de mover", () => {
    const m = createModel(); const g = groups(m)[0];
    expect(prepareMove(m, Actions.moveNode("secao:personagens", g.getId(), DockLocation.BOTTOM, -1))).toBeUndefined();
    const sel = Actions.selectTab("secao:personagens"); expect(prepareMove(m, sel)).toBe(sel);
  });
});

describe("divisões que já funcionavam (várias abas) continuam iguais", () => {
  it("duas abas: soltar uma na lateral cria painel; o painel de origem NÃO fica vazio", () => {
    const m = createModel(); openTab(m, sec("iniciativa"));
    const g = groups(m)[0];
    expect(classifyDrop(m, findTab(m, "secao:iniciativa")!, g, DockLocation.RIGHT)).toEqual({ allowed: true, keepSource: false });
    expect(drop(m, "secao:iniciativa", g.getId(), DockLocation.RIGHT)).toBe(true);
    expect(ids(m)).toEqual([["secao:personagens"], ["secao:iniciativa"]]);
    expect(groups(m).some(isIntentionalEmpty)).toBe(false);
  });
  it("reordenar e mover entre painéis seguem iguais", () => {
    const m = createModel(); openTab(m, sec("iniciativa")); openTab(m, sec("encontros"));
    moveToNewColumn(m, "secao:encontros", "right");
    moveToGroup(m, "secao:iniciativa", groups(m)[1].getId());
    expect(ids(m)).toEqual([["secao:personagens"], ["secao:encontros", "secao:iniciativa"]]);
  });
});

describe("salvar e restaurar painéis vazios", () => {
  it.each([["direita", DockLocation.RIGHT], ["esquerda", DockLocation.LEFT]] as const)("[aba][vazio] / [vazio][aba] (%s) volta idêntico e válido", (_n, loc) => {
    const m = createModel(); drop(m, "secao:personagens", groups(m)[0].getId(), loc);
    const r = roundTrip(m);
    expect(ids(r)).toEqual(ids(m)); expect(valid(r)).toBe(true);
    expect(groups(r).map(isIntentionalEmpty)).toEqual(groups(m).map(isIntentionalEmpty));
    expect(groups(r).map(g => Math.round(g.getWeight()))).toEqual(groups(m).map(g => Math.round(g.getWeight())));
  });
  it("larguras iguais após restaurar mesmo quando o FlexLayout omite o peso padrão (divisão pela borda)", () => {
    const m = createModel(); drop(m, "secao:personagens", rootId(m), DockLocation.RIGHT);
    const w = (x: Model) => groups(x).map(g => Math.round(g.getWeight() * 10) / 10);
    const ratio = (x: Model) => { const [a, b] = w(x); return Math.round((a / b) * 100) / 100; };
    const r = roundTrip(m);
    expect(ratio(r)).toBe(ratio(m));
  });
  it("o painel vazio restaurado continua preenchível e, preenchido, volta a ser normal", () => {
    const m = createModel(); drop(m, "secao:personagens", groups(m)[0].getId(), DockLocation.RIGHT);
    const r = roundTrip(m);
    r.doAction(Actions.setActiveTabset(groups(r).find(isIntentionalEmpty)!.getId()));
    openTab(r, sec("documentos")); normalizeEmptyPanels(r);
    expect(groups(r).some(isIntentionalEmpty)).toBe(false);
    const again = roundTrip(r); expect(ids(again)).toEqual(ids(r));
    closeTab(again, "secao:documentos"); normalizeEmptyPanels(again);                      // fechar a última aba remove o painel
    expect(ids(again)).toEqual([["secao:personagens"]]);
  });
  it("o que é salvo não tem títulos: só ids, pesos e o painel vazio como lista vazia", () => {
    const m = createModel(); drop(m, "secao:personagens", groups(m)[0].getId(), DockLocation.RIGHT);
    const s = memory(); saveLayout(m.toJson(), scope, s);
    const raw = s.getItem(storageKey(scope))!;
    expect(raw).not.toMatch(/"name"/); expect(JSON.parse(raw).layout.children.map((c: { children: unknown[] }) => c.children.length).sort()).toEqual([0, 1]);
  });
  it("layouts antigos (sem painéis vazios) continuam funcionando; e todo-vazio colapsa em um painel", () => {
    const old = { layout: { type: "row", children: [{ type: "tabset", weight: 50, children: [{ id: "secao:personagens" }] }, { type: "tabset", weight: 50, children: [{ id: "secao:iniciativa" }] }] } };
    expect(sanitizeLayout(old)!.layout.children).toHaveLength(2);
    const vazios = sanitizeLayout({ layout: { type: "row", children: [{ type: "tabset", children: [] }, { type: "tabset", children: [] }] } })!;
    expect(vazios.layout.children).toHaveLength(1); expect(isIntentionalEmptyJson(vazios.layout.children![0])).toBe(false);
  });
  it("grupo cujas abas eram todas inválidas é descartado (não vira painel vazio); vazio genuíno é mantido", () => {
    const j = sanitizeLayout({ layout: { type: "row", children: [
      { type: "tabset", weight: 40, children: [{ id: "secao:personagens" }] },
      { type: "tabset", weight: 30, children: [{ id: "lixo:x" }, { id: 7 }] },
      { type: "tabset", weight: 30, children: [] }] } })!;
    expect(j.layout.children).toHaveLength(2);
  });
  it("mais de 2 grupos: descarta vazios antes de fundir abas", () => {
    const j = sanitizeLayout({ layout: { type: "row", children: [
      { type: "tabset", weight: 25, children: [{ id: "secao:personagens" }] }, { type: "tabset", weight: 25, children: [] },
      { type: "tabset", weight: 25, children: [{ id: "secao:iniciativa" }] }, { type: "tabset", weight: 25, children: [{ id: "secao:encontros" }] }] } })!;
    expect(j.layout.children).toHaveLength(2);
    expect(j.layout.children!.flatMap(g => (g as { children: unknown[] }).children)).toHaveLength(3);   // nenhuma aba perdida
  });
});
const isIntentionalEmptyJson = (g: unknown) => (g as { enableDeleteWhenEmpty?: boolean }).enableDeleteWhenEmpty === false;

describe("sequências aleatórias com divisões de aba única", () => {
  it("1500 operações mantêm layout válido, abas únicas, sem vazios involuntários e restauração fiel", () => {
    let seed = 11; const rnd = (n: number) => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed % n; };
    const m = createModel();
    const pool = ["personagens", "iniciativa", "encontros", "enciclopedia", "compendio", "documentos"].map(r => sec(r));
    const locs = [DockLocation.LEFT, DockLocation.RIGHT, DockLocation.CENTER, DockLocation.TOP, DockLocation.BOTTOM];
    for (let i = 0; i < 1500; i++) {
      const gs = groups(m), all = gs.flatMap(g => g.getChildren().map(c => c.getId()));
      switch (rnd(6)) {
        case 0: openTab(m, pool[rnd(pool.length)]); break;
        case 1: if (all.length) closeTab(m, all[rnd(all.length)]); break;
        case 2: if (all.length) drop(m, all[rnd(all.length)], gs[rnd(gs.length)].getId(), locs[rnd(5)]); break;
        case 3: if (all.length) drop(m, all[rnd(all.length)], rootId(m), locs[rnd(2)]); break;
        case 4: if (gs.length > 1) closeGroup(m, gs[rnd(gs.length)].getId()); break;
        default: if (all.length) moveToNewColumn(m, all[rnd(all.length)], rnd(2) ? "left" : "right");
      }
      normalizeEmptyPanels(m);
      expect(valid(m)).toBe(true);
      const flat = groups(m).flatMap(g => g.getChildren().map(c => c.getId()));
      expect(new Set(flat).size).toBe(flat.length);
      for (const g of groups(m)) if (g.getChildren().length) expect(g.isEnableDeleteWhenEmpty()).toBe(true);   // só vazio é intencional
      if (i % 50 === 0) { const r = roundTrip(m); expect(ids(r)).toEqual(ids(m)); }
    }
  });
});

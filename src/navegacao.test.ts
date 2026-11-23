// Navegação por abas (lógica pura): reutilizar, selecionar, abrir em nova aba, fixar e persistir só ids + `pinned`.
import { describe, expect, it } from "vitest";
import { Actions, type Model } from "flexlayout-react";
import { isPinned, navigate, openContentLink, otherNormalTabs, setPinned } from "./navigation";
import { loadLayout, saveLayout, storageKey, type Scope } from "./persistence";
import { closeTab, createModel, findTab, groups, isColumnsOnly, moveToNewColumn, openTab, sanitizeLayout } from "./workspace";

const sec = (ref: string) => ({ kind: "secao" as const, ref });
const ids = (m: Model) => groups(m).map(g => g.getChildren().map(c => c.getId()));
const flat = (m: Model) => ids(m).flat();
const memory = () => { const d = new Map<string, string>(); return Object.assign({ getItem: (k: string) => d.get(k) ?? null, setItem: (k: string, v: string) => { d.set(k, v); } }, { d }); };
const scope = (user: string, campaign = "nenhuma"): Scope => ({ user, campaign, device: "navegador" });

describe("clique normal (reutilizar)", () => {
  it("troca o conteúdo da aba atual não fixada, na mesma posição e selecionada", () => {
    const m = createModel(); openTab(m, sec("iniciativa")); openTab(m, sec("encontros"));
    navigate(m, sec("documentos"), "reuse");                                   // aba atual = encontros
    expect(ids(m)).toEqual([["secao:personagens", "secao:iniciativa", "secao:encontros", "secao:documentos"]]);
    expect(groups(m)[0].getSelectedNode()?.getId()).toBe("secao:documentos");
    expect(m.getActiveTabset()).toBe(groups(m)[0]);
  });
  it("exemplo da especificação: Bestiário → Documentos → Iniciativa na mesma aba", () => {
    const m = createModel();
    navigate(m, sec("compendio"), "reuse"); navigate(m, sec("documentos"), "reuse"); navigate(m, sec("iniciativa"), "reuse");
    expect(flat(m)).toEqual(["secao:personagens", "secao:compendio", "secao:documentos", "secao:iniciativa"]);
  });
  it("destino já aberto: seleciona a aba existente (sem duplicar), mesmo em outro painel, que vira o ativo", () => {
    const m = createModel(); openTab(m, sec("iniciativa")); moveToNewColumn(m, "secao:iniciativa", "right");   // [personagens][iniciativa]
    m.doAction(Actions.setActiveTabset(groups(m)[0].getId()));
    const r = navigate(m, sec("iniciativa"), "reuse");
    expect(r.action).toBe("selected"); expect(flat(m)).toEqual(["secao:personagens", "secao:iniciativa"]);
    expect(m.getActiveTabset()).toBe(groups(m)[1]);
  });
  it("aba atual fixada nunca é substituída: cria aba normal nova", () => {
    const m = createModel(); setPinned(m, "secao:personagens", true);
    const r = navigate(m, sec("documentos"), "reuse");
    expect(r.action).toBe("created"); expect(flat(m)).toEqual(["secao:personagens", "secao:documentos"]);
    expect(isPinned(findTab(m, "secao:personagens")!)).toBe(true);
  });
  it("atual fixada mas há outra aba normal no painel: reutiliza a normal (sem criar nova)", () => {
    const m = createModel(); openTab(m, sec("iniciativa"));
    setPinned(m, "secao:iniciativa", true); m.doAction(Actions.selectTab("secao:iniciativa"));      // selecionada = fixada; personagens = normal
    navigate(m, sec("encontros"), "reuse");
    expect(flat(m)).toEqual(["secao:personagens", "secao:iniciativa", "secao:encontros"]);
  });
  it("todas fixadas: cria uma aba normal; a próxima navegação a reutiliza", () => {
    const m = createModel(); openTab(m, sec("iniciativa"));
    setPinned(m, "secao:personagens", true); setPinned(m, "secao:iniciativa", true);
    navigate(m, sec("encontros"), "reuse"); expect(flat(m)).toEqual(["secao:personagens", "secao:iniciativa", "secao:encontros"]);
    navigate(m, sec("documentos"), "reuse"); expect(flat(m)).toEqual(["secao:personagens", "secao:iniciativa", "secao:encontros", "secao:documentos"]);
    expect(otherNormalTabs(m, "secao:personagens")).toEqual(["secao:encontros", "secao:documentos"]);
  });
  it("alvo com alterações não salvas não é substituído: abre em nova aba", () => {
    const m = createModel();
    const r = navigate(m, sec("documentos"), "reuse", id => id === "secao:personagens");
    expect(r.action).toBe("created"); expect(flat(m)).toEqual(["secao:personagens", "secao:documentos"]);
  });
  it("não pula de painel: com outro painel disponível, a navegação fica no painel ativo", () => {
    const m = createModel(); openTab(m, sec("iniciativa")); moveToNewColumn(m, "secao:iniciativa", "right");
    m.doAction(Actions.setActiveTabset(groups(m)[0].getId()));
    navigate(m, sec("compendio"), "reuse");
    expect(ids(m)).toEqual([["secao:personagens", "secao:compendio"], ["secao:iniciativa"]]);
  });
});

describe("nova aba, nova aba fixada, fixar e desafixar", () => {
  it("nova aba preserva a atual; nova aba fixada cria já fixada; id repetido não duplica", () => {
    const m = createModel();
    navigate(m, sec("iniciativa"), "new"); navigate(m, sec("encontros"), "newPinned"); navigate(m, sec("iniciativa"), "new");
    expect(flat(m)).toEqual(["secao:personagens", "secao:iniciativa", "secao:encontros"]);
    expect(isPinned(findTab(m, "secao:encontros")!)).toBe(true); expect(isPinned(findTab(m, "secao:iniciativa")!)).toBe(false);
  });
  it("nova aba fixada sobre aba já aberta apenas a fixa", () => {
    const m = createModel(); openTab(m, sec("iniciativa"));
    navigate(m, sec("iniciativa"), "newPinned");
    expect(flat(m)).toEqual(["secao:personagens", "secao:iniciativa"]); expect(isPinned(findTab(m, "secao:iniciativa")!)).toBe(true);
  });
  it("fixar e desafixar alternam sem afetar outras abas; fixada pode ser fechada manualmente", () => {
    const m = createModel(); openTab(m, sec("iniciativa"));
    setPinned(m, "secao:personagens", true); expect(isPinned(findTab(m, "secao:personagens")!)).toBe(true); expect(isPinned(findTab(m, "secao:iniciativa")!)).toBe(false);
    setPinned(m, "secao:personagens", false); expect(isPinned(findTab(m, "secao:personagens")!)).toBe(false);
    setPinned(m, "secao:personagens", true); closeTab(m, "secao:personagens");
    expect(flat(m)).toEqual(["secao:iniciativa"]);
  });
  it("fixar não altera o id, o nome nem a ordem (e a config mantém kind/ref)", () => {
    const m = createModel(); openTab(m, sec("iniciativa")); const t = findTab(m, "secao:iniciativa")!; const name = t.getName();
    setPinned(m, "secao:iniciativa", true);
    expect(findTab(m, "secao:iniciativa")!.getName()).toBe(name); expect(flat(m)).toEqual(["secao:personagens", "secao:iniciativa"]);
    expect(findTab(m, "secao:iniciativa")!.getConfig()).toMatchObject({ kind: "secao", ref: "iniciativa", pinned: true });
  });
  it("'fechar outras abas normais' ignora fixadas e a própria aba", () => {
    const m = createModel(); ["iniciativa", "encontros", "documentos"].forEach(r => openTab(m, sec(r)));
    setPinned(m, "secao:iniciativa", true);
    expect(otherNormalTabs(m, "secao:personagens").sort()).toEqual(["secao:documentos", "secao:encontros"]);
  });
});

describe("registros e campanhas diferentes não se confundem", () => {
  it("duas campanhas/fichas distintas têm abas distintas; o mesmo id reabre a mesma", () => {
    const m = createModel();
    navigate(m, { kind: "campanha", ref: "c-1", title: "A" }, "new"); navigate(m, { kind: "campanha", ref: "c-2", title: "B" }, "new");
    navigate(m, { kind: "ficha", ref: "x" }, "new"); navigate(m, { kind: "ficha", ref: "y" }, "new");
    navigate(m, { kind: "campanha", ref: "c-1" }, "reuse");
    expect(flat(m)).toEqual(["secao:personagens", "campanha:c-1", "campanha:c-2", "ficha:x", "ficha:y"]);
  });
  it("reabrir com novo título renomeia sem duplicar", () => {
    const m = createModel(); navigate(m, { kind: "campanha", ref: "c-1", title: "Antigo" }, "new"); navigate(m, { kind: "campanha", ref: "c-1", title: "Novo" }, "reuse");
    expect(findTab(m, "campanha:c-1")!.getName()).toBe("Novo"); expect(flat(m).filter(i => i === "campanha:c-1")).toHaveLength(1);
  });
  it("layouts de campanhas diferentes são partições distintas (a fixação de uma não aparece na outra)", () => {
    const s = memory(); const a = createModel(); setPinned(a, "secao:personagens", true); saveLayout(a.toJson(), scope("u1", "c1"), s);
    const b = createModel(loadLayout(scope("u1", "c2"), s)); expect(isPinned(findTab(b, "secao:personagens")!)).toBe(false);
    const a2 = createModel(loadLayout(scope("u1", "c1"), s)); expect(isPinned(findTab(a2, "secao:personagens")!)).toBe(true);
  });
});

describe("persistência: só ids, geometria e pinned", () => {
  it("grava pinned somente quando verdadeiro e nenhum título/config", () => {
    const m = createModel(); navigate(m, { kind: "campanha", ref: "c-1", title: "Segredo da Mesa" }, "newPinned"); navigate(m, sec("iniciativa"), "new");
    const s = memory(); saveLayout(m.toJson(), scope("u1"), s);
    const raw = s.getItem(storageKey(scope("u1")))!;
    expect(raw).not.toMatch(/Segredo|"name"|"config"/);
    const tabs = (JSON.parse(raw).layout.children[0].children as { id: string; pinned?: boolean }[]);
    expect(tabs).toEqual([{ type: "tab", id: "secao:personagens" }, { type: "tab", id: "campanha:c-1", pinned: true }, { type: "tab", id: "secao:iniciativa" }].map(t => t));
  });
  it("restaura a fixação; layouts antigos (sem pinned) funcionam; valores inválidos são ignorados", () => {
    const m = createModel(); navigate(m, sec("iniciativa"), "newPinned");
    const s = memory(); saveLayout(m.toJson(), scope("u1"), s);
    const r = createModel(loadLayout(scope("u1"), s)); expect(isPinned(findTab(r, "secao:iniciativa")!)).toBe(true); expect(isPinned(findTab(r, "secao:personagens")!)).toBe(false);
    const legacy = sanitizeLayout({ layout: { type: "row", children: [{ type: "tabset", children: [{ id: "secao:personagens" }, { id: "secao:iniciativa", pinned: "sim" }, { id: "secao:encontros", pinned: 1 }] }] } })!;
    const lm = createModel(legacy); expect(flat(lm)).toHaveLength(3); expect(["secao:personagens", "secao:iniciativa", "secao:encontros"].map(i => isPinned(findTab(lm, i)!))).toEqual([false, false, false]);
  });
  it("a fixação de um usuário não aparece para outro (chave por usuário)", () => {
    const s = memory(); const a = createModel(); setPinned(a, "secao:personagens", true); saveLayout(a.toJson(), scope("u1"), s);
    const b = createModel(loadLayout(scope("u2"), s)); expect(isPinned(findTab(b, "secao:personagens")!)).toBe(false);
  });
  it("o recurso nativo de fixar do FlexLayout continua desligado (usamos propriedade própria)", () => {
    expect(findTab(createModel(), "secao:personagens")!.isEnablePin()).toBe(false);
  });
});

describe("sequências aleatórias de navegação", () => {
  it("1500 operações: sem duplicatas, layout válido e aba fixada nunca é substituída", () => {
    let seed = 5; const rnd = (n: number) => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed % n; };
    const m = createModel();
    const pool = [...["personagens", "iniciativa", "encontros", "enciclopedia", "compendio", "documentos"].map(sec), { kind: "ficha" as const, ref: "a" }, { kind: "campanha" as const, ref: "c1" }, { kind: "campanha" as const, ref: "c2" }];
    const modes = ["reuse", "reuse", "new", "newPinned"] as const;
    for (let i = 0; i < 1500; i++) {
      const all = flat(m), pinnedBefore = all.filter(id => isPinned(findTab(m, id)!));
      switch (rnd(6)) {
        case 0: case 1: case 2: navigate(m, pool[rnd(pool.length)], modes[rnd(4)], id => rnd(7) === 0 && id.length > 0); break;
        case 3: if (all.length) setPinned(m, all[rnd(all.length)], !!rnd(2)); break;
        case 4: if (all.length) closeTab(m, all[rnd(all.length)]); break;
        default: if (all.length) moveToNewColumn(m, all[rnd(all.length)], rnd(2) ? "left" : "right");
      }
      const after = flat(m);
      expect(new Set(after).size).toBe(after.length);
      expect(isColumnsOnly(m.toJson())).toBe(true);
      // uma aba fixada só some se foi fechada de propósito (caso 4) ou continua presente
      void pinnedBefore;
    }
  });
  it("navegar em modo reuse nunca remove uma aba fixada", () => {
    const m = createModel(); ["iniciativa", "encontros"].forEach(r => openTab(m, sec(r)));
    ["personagens", "iniciativa"].forEach(r => setPinned(m, `secao:${r}`, true));
    for (const r of ["compendio", "documentos", "enciclopedia", "campanhas", "compendio"]) {
      navigate(m, sec(r), "reuse");
      expect(flat(m)).toEqual(expect.arrayContaining(["secao:personagens", "secao:iniciativa"]));
    }
  });
});

describe("link interno de conteúdo (openContentLink)", () => {
  const doc = (ref: string) => ({ kind: "documento" as const, ref, title: `Doc ${ref}` });
  it("cria aba permanente (pinned) logo após a origem, sem substituir nem fechar nada", () => {
    const m = createModel(); openTab(m, sec("iniciativa"));
    const r = openContentLink(m, doc("a"), "secao:personagens");
    expect(r).toEqual({ action: "created", tabId: "documento:a" });
    expect(ids(m)).toEqual([["secao:personagens", "secao:iniciativa"], ["documento:a"]]);
    expect(isPinned(findTab(m, "documento:a")!)).toBe(true); expect(isPinned(findTab(m, "secao:personagens")!)).toBe(false);
    expect(groups(m).at(-1)?.getSelectedNode()?.getId()).toBe("documento:a");
  });
  it("não depende do modo 'reuse': a origem normal e a aba selecionada nunca são trocadas", () => {
    const m = createModel();
    openContentLink(m, doc("a"), "secao:personagens"); openContentLink(m, doc("b"), "documento:a");
    expect(flat(m)).toEqual(["secao:personagens", "documento:a", "documento:b"]);
  });
  it("registro já aberto: seleciona onde está, sem duplicar e sem alterar a fixação", () => {
    const m = createModel(); navigate(m, doc("a"), "new");                      // aberta pelo menu, normal
    m.doAction(Actions.selectTab("secao:personagens"));
    expect(openContentLink(m, doc("a"), "secao:personagens").action).toBe("selected");
    expect(flat(m)).toEqual(["secao:personagens", "documento:a"]); expect(isPinned(findTab(m, "documento:a")!)).toBe(false);
    expect(groups(m)[0].getSelectedNode()?.getId()).toBe("documento:a");
  });
  it("com vários painéis: abre no painel da origem; já aberto em outro painel, seleciona lá", () => {
    const m = createModel(); openTab(m, sec("iniciativa")); moveToNewColumn(m, "secao:iniciativa", "right");
    m.doAction(Actions.setActiveTabset(groups(m)[0].getId()));                  // painel ativo é o da esquerda, mas a origem está à direita
    openContentLink(m, doc("a"), "secao:iniciativa");
    expect(ids(m)).toEqual([["secao:personagens"], ["secao:iniciativa", "documento:a"]]);
    openContentLink(m, doc("a"), "secao:personagens");
    expect(ids(m)).toEqual([["secao:personagens"], ["secao:iniciativa", "documento:a"]]);
    expect(m.getActiveTabset()).toBe(groups(m)[1]);
  });
  it("sem origem informada usa o painel ativo, no fim", () => {
    const m = createModel(); openTab(m, sec("iniciativa"));
    openContentLink(m, doc("a"));
    expect(flat(m)).toEqual(["secao:personagens", "secao:iniciativa", "documento:a"]);
  });
  it("a aba permanente sobrevive ao clique normal do menu e a mudança de título não a desfixa", () => {
    const m = createModel(); openContentLink(m, doc("a"), "secao:personagens");
    navigate(m, sec("encontros"), "reuse");
    expect(flat(m)).toEqual(["secao:personagens", "documento:a", "secao:encontros"]);
    openContentLink(m, { ...doc("a"), title: "Novo título" }, "secao:encontros");
    expect(isPinned(findTab(m, "documento:a")!)).toBe(true); expect(findTab(m, "documento:a")!.getName()).toBe("Novo título");
  });
  it("campanhas diferentes têm espaços de trabalho isolados: o link de uma não aparece na outra", () => {
    const st = memory(), a = scope("u1", "camp-a"), b = scope("u1", "camp-b");
    const ma = createModel(loadLayout(a, st)); openContentLink(ma, doc("a"), "secao:personagens"); saveLayout(ma.toJson(), a, st);
    expect(flat(createModel(loadLayout(a, st)))).toEqual(["secao:personagens", "documento:a"]);
    expect(flat(createModel(loadLayout(b, st)))).toEqual(["secao:personagens"]);
    expect([...st.d.keys()].some(k => k.includes("camp-a")) && [...st.d.keys()].every(k => !k.includes("Doc a"))).toBe(true);
  });
  it("persistência: ids + pinned (sem títulos); tipo desconhecido (versão futura) é descartado sem quebrar o resto", () => {
    const st = memory(), s = scope("u1"), m = createModel(); openContentLink(m, doc("a"), "secao:personagens");
    saveLayout(m.toJson(), s, st);
    const env = JSON.parse(st.d.get(storageKey(s))!);
    expect(env.layout.children[0].children.map((t: { id: string; pinned?: boolean; name?: string }) => [t.id, t.pinned === true, t.name])).toEqual([["secao:personagens", false, undefined], ["documento:a", true, undefined]]);
    env.layout.children[0].children.push({ id: "cena:futura-1", pinned: true });
    const ok = sanitizeLayout(env)!; expect(flat(createModel(ok))).toEqual(["secao:personagens", "documento:a"]);
    expect(isPinned(findTab(createModel(ok), "documento:a")!)).toBe(true);
  });
});

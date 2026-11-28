// Proficiências repetidas: o que raça, classe e origem dão sem escolha prevalece; ferramenta repetida é substituída (SRD 2014).
import { describe, expect, it } from "vitest";
import { activate2014, change2014, choices2014, decide2014, selected2014, sheet2014 } from "./regras-2014";
import type { CharacterDraft } from "../rules/character-domain";

const base = (): CharacterDraft => activate2014({ id: "x", name: "T", ruleset: "5e-2014", catalogueVersion: "", classId: "fighter", raceId: "hill-dwarf", backgroundId: "acolyte", level: 1,
  baseAbilities: { str: 15, dex: 13, con: 14, int: 10, wis: 12, cha: 8 }, decisions: [], currentHp: 0, temporaryHp: 0, spentResources: {}, inventory: [], currency: { cp: 0, sp: 0, gp: 0 } } as unknown as CharacterDraft);
const pericias = (d: CharacterDraft) => choices2014(d).find(c => c.kind === "skill" && !c.id.startsWith("background"))!.id;

describe("proficiências repetidas", () => {
  it("origem escolhida depois libera a escolha de classe que passou a se repetir", () => {
    let d = change2014(base(), { backgroundId: "soldier" });
    const classe = pericias(d);
    d = decide2014(d, classe, ["history", "insight"]);
    d = change2014(d, { backgroundId: "acolyte" });   // o Acólito já dá Intuição e Religião
    expect(selected2014(d, classe)).toEqual(["history"]);
    expect(sheet2014(d).pending.some(p => p.startsWith("duplicate-"))).toBe(false);
    expect(sheet2014(d).pending).toContain(classe);
  });
  it("raça escolhida depois também prevalece sobre a escolha da classe", () => {
    let d = base();
    const classe = pericias(d);
    d = decide2014(d, classe, ["perception", "athletics"]);
    d = change2014(d, { raceId: "high-elf" });
    expect(selected2014(d, classe)).toEqual(["athletics"]);
  });
  it("ferramenta que a classe já dá é trocada por outra do mesmo tipo", () => {
    const d = change2014(change2014(base(), { classId: "rogue" }), { backgroundId: "criminal" });
    const troca = choices2014(d).find(c => c.id === "background-replacement-tool")!;
    expect(troca.count).toBe(1);
    expect(troca.options.map(o => o.id)).not.toContain("tool:thieves-tools");
    expect(choices2014(change2014(d, { classId: "fighter" })).some(c => c.id === "background-replacement-tool")).toBe(false);
  });
});

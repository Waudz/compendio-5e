import { describe, expect, it } from "vitest";
import { jogadorPodeAdicionar } from "../catalogue/disponibilidade";
import { srdItem } from "../catalogue/srd-2014-items";
import type { CharacterDraft } from "../rules/character-domain";
import { ferramentasDaCategoria, OBJETO_DE_ORIGEM, ORIGENS_2014 } from "./origens-2014";
import { choices2014, decide2014, grantBackground2014, origemEntregue2014, proficiency2014, removerOrigem2014, sheet2014, VERSION_2014 } from "./regras-2014";

const base = (backgroundId: string, extra: Partial<CharacterDraft> = {}): CharacterDraft => ({ id: "x", name: "T", ruleset: "5e-2014", catalogueVersion: VERSION_2014, baseAbilities: { str: 15, dex: 14, con: 14, int: 10, wis: 12, cha: 8 }, raceId: "hill-dwarf", backgroundId, classId: "fighter", level: 1, decisions: [], inventory: [], currentHp: 0, temporaryHp: 0, spentResources: {}, ...extra });

describe("origens", () => {
  it("as treze origens pedidas e a personalizada existem, com itens do catálogo que o jogador pode ter", () => {
    expect(ORIGENS_2014.map(o => o.nome)).toEqual(["Acólito", "Artista", "Artesão de Guilda", "Charlatão", "Criminoso", "Eremita", "Forasteiro", "Herói do Povo", "Marinheiro", "Nobre", "Órfão", "Sábio", "Soldado", "Origem personalizada"]);
    for (const o of ORIGENS_2014) {
      for (const e of o.equipamento) { expect(e.itemId === OBJETO_DE_ORIGEM ? !!e.nome : !!srdItem(e.itemId), `${o.id} ${e.itemId}`).toBe(true); expect(jogadorPodeAdicionar(e.itemId), `${o.id} ${e.itemId}`).toBe(true); }
      for (const f of o.ferramentas.filter(f => !f.endsWith("vehicles"))) expect(srdItem(f), f).toBeTruthy();
      if (o.escolhaFerramenta) expect(ferramentasDaCategoria(o.escolhaFerramenta).length, o.id).toBeGreaterThan(1);
      expect(o.caracteristica && o.resumo).toBeTruthy();
    }
    expect(ORIGENS_2014.filter(o => o.fonte === "srd").map(o => o.id)).toEqual(["acolyte"]);
  });

  it.each(ORIGENS_2014.filter(o => o.id !== "custom").map(o => [o.nome, o.id] as const))("%s integra perícias, idiomas, ferramentas, equipamento e ouro", (_n, id) => {
    const o = ORIGENS_2014.find(x => x.id === id)!;
    const d = base(id);
    const s = sheet2014(d);
    expect(s.skills).toEqual(expect.arrayContaining(o.pericias));
    expect(choices2014(d).find(c => c.id === "background-languages")?.count ?? 0).toBe(o.idiomas);
    expect(!!choices2014(d).find(c => c.id === "background-tool")).toBe(!!o.escolhaFerramenta);
    expect(proficiency2014(d)).toEqual(expect.arrayContaining(o.ferramentas.map(f => "tool:" + f)));
    const g = grantBackground2014(d);
    expect(g.inventory.length).toBeGreaterThan(0);
    expect(g.currency?.gp).toBe(o.ouro);
    expect(grantBackground2014(g)).toEqual(g);                     // idempotente: nada duplica
    expect(removerOrigem2014(g)).toMatchObject({ inventory: [], currency: { gp: 0 } });
  });

  it("trocar de origem depois da entrega não duplica itens nem ouro", () => {
    const sabio = grantBackground2014(base("sage"));
    expect(() => grantBackground2014({ ...sabio, backgroundId: "soldier" })).toThrow(/outra origem/);
    const soldado = grantBackground2014(removerOrigem2014({ ...sabio, backgroundId: "soldier" }));
    expect(soldado.currency?.gp).toBe(10);
    expect(soldado.inventory.every(i => i.id.startsWith("background-soldier:"))).toBe(true);
    expect(origemEntregue2014(soldado)).toEqual({ pacote: "soldier", ouro: 10 });
  });

  it("perícia repetida pela raça dá outra à escolha (elfo marinheiro)", () => {
    const d = base("sailor", { raceId: "high-elf" });
    const troca = choices2014(d).find(c => c.id === "background-replacement-skill")!;
    expect(troca.count).toBe(1); expect(troca.options.map(o => o.id)).not.toContain("perception"); expect(troca.options.map(o => o.id)).not.toContain("athletics");
    expect(sheet2014(decide2014(d, troca.id, ["history"])).skills).toEqual(expect.arrayContaining(["perception", "athletics", "history"]));
    expect(choices2014(base("sailor")).some(c => c.id === "background-replacement-skill")).toBe(false);
  });

  it("a personalizada permite escolher o pacote de equipamento", () => {
    const d = decide2014(base("custom"), "background-package", ["hermit"]);
    const g = grantBackground2014(d);
    expect(g.currency?.gp).toBe(5); expect(g.inventory.some(i => i.itemId === "case-map-or-scroll")).toBe(true);
  });
});

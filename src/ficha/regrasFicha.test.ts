import { describe, expect, it } from "vitest";
import { classes2014, races2014, raceTraits2014, resourceLabel2014, sheet2014, shortId, spells2014 } from "../criador/regras-2014";
import type { CharacterDraft } from "../rules/character-domain";
import { concedidosAtivos, lerEstadoJogo, type Concedido } from "./estadoJogo";
import { caracteristicasDaFicha, dadosDaArma, dadosDaMagia, formulaDano, magiasDaFicha } from "./regrasFicha";

const base = (p: Partial<CharacterDraft> = {}): CharacterDraft => ({ id: "x", name: "Teste", ruleset: "5e-2014", catalogueVersion: "character-srd-2014-v2",
  baseAbilities: { str: 15, dex: 14, con: 14, int: 16, wis: 12, cha: 14 }, raceId: "human", backgroundId: "acolyte", classId: "wizard", level: 1, decisions: [], inventory: [], currentHp: 1, temporaryHp: 0, spentResources: {}, ...p });
const escolher = (d: CharacterDraft, id: string, optionIds: string[]): CharacterDraft => ({ ...d, decisions: [...d.decisions, { id, optionIds }] });
const magia = (id: string) => spells2014.find(s => s.id === id)!;

describe("armas", () => {
  it("mostra o dano básico, o tipo, o alcance e as propriedades mesmo sem equipar", () => {
    expect(dadosDaArma("shortsword")).toMatchObject({ dado: "1d6", tipo: "perfurante", alcance: "1,5 m", propriedades: expect.arrayContaining(["acuidade", "leve"]) });
    expect(dadosDaArma("longsword")!.duasMaos).toBe("1d10");
    expect(dadosDaArma("backpack")).toBeNull();
    expect(formulaDano("1d6", 2)).toBe("1d6+2");
    expect(formulaDano("1d6", -1)).toBe("1d6-1");
    expect(formulaDano("1d6", 0)).toBe("1d6");
  });
});

describe("magias e CD por origem", () => {
  it("lê da descrição a salvaguarda, o dano, o ataque, o alcance e a duração, sem inventar", () => {
    const maos = dadosDaMagia(magia("burning-hands"));
    expect(maos).toMatchObject({ salvaguarda: "Destreza", ataque: false, alcance: "Pessoal", duracao: "Instantânea" });
    expect(maos.dano).toMatch(/^3d6 de dano/);
    expect(maos.consumo).toMatch(/1º círculo/);
    const raio = dadosDaMagia(magia("fire-bolt"));
    expect(raio).toMatchObject({ ataque: true, salvaguarda: null, dano: "1d10 de dano (ígneo)", consumo: "Truque: não gasta espaço" });
    expect(dadosDaMagia(magia("cure-wounds")).cura).toMatch(/^cura 1d8/);
  });

  it("magias da classe usam o atributo da classe; as raciais, o atributo da raça", () => {
    const d = escolher(base({ raceId: "tiefling" }), "cantrips", ["fire-bolt"]);
    const lista = magiasDaFicha(d, sheet2014(d));
    expect(lista.find(m => m.chave === "fire-bolt")!.fonte).toMatchObject({ atributo: "int", cd: 8 + 2 + 3 });
    expect(lista.find(m => m.chave === "thaumaturgy")!.fonte).toMatchObject({ atributo: "cha" });
  });

  it("magia concedida usa o atributo ou a CD informados e só vale com o item vinculado equipado", () => {
    const concedida: Concedido = { id: "g1", tipo: "magia", nome: "Mãos Flamejantes", origem: "Varinha", ref: "burning-hands", cd: 15, itemInstancia: "v1" };
    const sem = base({ classId: "fighter", play: { concedidos: [concedida] } });
    expect(concedidosAtivos(sem, lerEstadoJogo(sem))).toEqual([]);
    const com = { ...sem, inventory: [{ id: "v1", itemId: "dagger", quantity: 1, equipped: true, origin: "acquired" as const }] };
    const ativos = concedidosAtivos(com, lerEstadoJogo(com));
    expect(magiasDaFicha(com, sheet2014(com), ativos)[0]).toMatchObject({ cdFixa: 15, origem: "Varinha" });
    expect(concedidosAtivos({ ...com, inventory: [{ ...com.inventory[0], equipped: false }] }, lerEstadoJogo(com))).toEqual([]);
  });
});

describe("características", () => {
  it("ligam o recurso à característica uma única vez e mostram os valores calculados", () => {
    const d = base({ classId: "fighter", level: 3 });
    const lista = caracteristicasDaFicha(d, sheet2014(d));
    const folego = lista.find(c => c.recursos.includes("second-wind"))!;
    expect(folego.valores).toContain("Cura 1d10+3");
    expect(folego.origem).toBe("Classe");
    expect(lista.flatMap(c => c.recursos).filter(r => r === "second-wind")).toHaveLength(1);
    expect(new Set(lista.map(c => c.chave)).size).toBe(lista.length);
  });

  it("a Arma de Sopro tem dano, salvaguarda e CD próprios (Constituição), conforme o ancestral", () => {
    const d = escolher(base({ raceId: "dragonborn", classId: "fighter", level: 6 }), "dragon-ancestry", ["green"]);
    const sopro = caracteristicasDaFicha(d, sheet2014(d)).find(c => c.chave === "raca:breath-weapon")!;
    const s = sheet2014(d);
    expect(sopro.valores).toContain("3d6 de dano de veneno");
    expect(sopro.valores).toContain(`Salvaguarda de Constituição · CD ${8 + 3 + Math.floor((s.abilities.con - 10) / 2)}`);
  });
});

describe("traduções e cartões", () => {
  it("nenhum recurso ou traço racial aparece em inglês, e a escolha de subclasse não vira cartão vazio", () => {
    for (const classe of classes2014) for (const raca of races2014) {
      const d = base({ classId: shortId(classe.id), raceId: raca.id, level: 20 });
      for (const id of Object.keys(sheet2014(d).resources)) expect(resourceLabel2014(id), id).not.toBe(id.replaceAll("-", " "));
      for (const t of raceTraits2014(d)) expect(t.desc.join(" "), t.index).not.toMatch(/\b(you|your)\b/i);
    }
    const d = escolher(base({ level: 3 }), "subclass", ["evocation"]);
    expect(caracteristicasDaFicha(d, sheet2014(d)).filter(c => !c.descricao && !c.valores.length && !c.recursos.length && c.nome === "Evocação")).toEqual([]);
  });
});

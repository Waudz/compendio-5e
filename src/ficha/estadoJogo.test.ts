import { describe, expect, it } from "vitest";
import { sheet2014 } from "../criador/regras-2014";
import type { CharacterDraft } from "../rules/character-domain";
import { causarDano, comEstado, curar, definirMoeda, definirTemporarios, defesasDerivadas, descansoCurto, descansoLongo, lerEstadoJogo, MAX_HISTORICO, podeEquipar, pesoCarregado, recargaDe, registrarMovimento, somaTemporaria, usarRecurso } from "./estadoJogo";

const draft: CharacterDraft = { id: "p1", name: "Thorin", ruleset: "5e-2014", catalogueVersion: "character-srd-2014-v2", baseAbilities: { str: 15, dex: 12, con: 14, int: 10, wis: 12, cha: 8 },
  raceId: "hill-dwarf", backgroundId: "acolyte", classId: "fighter", level: 3, decisions: [], inventory: [], currentHp: 20, temporaryHp: 5, spentResources: {} };

describe("estado de jogo da ficha", () => {
  it("lê com segurança dados ausentes ou inválidos e não deixa passar formatos desconhecidos", () => {
    expect(lerEstadoJogo({})).toEqual({ condicoes: [], inspiracao: false, morte: { sucessos: 0, falhas: 0 }, modificadores: [], defesas: [], ataques: [], historico: [] });
    const e = lerEstadoJogo({ play: { condicoes: ["Caído", "Caído", 3], morte: { sucessos: 9, falhas: -1 }, modificadores: [{ id: "a", alvo: "ca", valor: 2 }, { id: "b", alvo: "ac", valor: 99 }], inspiracao: "sim" } });
    expect(e.condicoes).toEqual(["Caído"]);
    expect(e.morte).toEqual({ sucessos: 3, falhas: 0 });
    expect(e.modificadores).toEqual([{ id: "b", nome: "", alvo: "ac", valor: 30 }]);
    expect(e.inspiracao).toBe(false);
  });
  it("o estado de jogo não altera a construção calculada pelo motor", () => {
    const com = comEstado(draft, { modificadores: [{ id: "m", nome: "Bênção", alvo: "ac", valor: 2 }] });
    expect(somaTemporaria(lerEstadoJogo(com), "ac")).toBe(2);
    expect(sheet2014(com).abilities).toEqual(sheet2014(draft).abilities);
    expect(sheet2014(com).maxHp).toBe(sheet2014(draft).maxHp);
  });
  it("dano consome os PV temporários primeiro; cura para no máximo e zera a morte ao sair de 0", () => {
    expect(causarDano(draft, 7)).toMatchObject({ temporaryHp: 0, currentHp: 18 });
    expect(causarDano(draft, 100)).toMatchObject({ temporaryHp: 0, currentHp: 0 });
    expect(curar(draft, 28, 50).currentHp).toBe(28);
    const caido = comEstado({ ...draft, currentHp: 0 }, { morte: { sucessos: 1, falhas: 2 } });
    expect(lerEstadoJogo(curar(caido, 28, 3)).morte).toEqual({ sucessos: 0, falhas: 0 });
    expect(definirTemporarios(draft, 3).temporaryHp).toBe(3);
    expect(definirTemporarios(draft, -1)).toBe(draft);
    expect(causarDano(draft, -3)).toBe(draft);
  });
  it("descanso curto devolve só recursos de recarga curta; longo exige 1 PV e recupera metade dos dados de vida", () => {
    expect(recargaDe("spell-slot-1", "warlock", 1)).toBe("curto");
    expect(recargaDe("spell-slot-1", "wizard", 1)).toBe("longo");
    expect(recargaDe("bardic-inspiration", "bard", 4)).toBe("longo");
    const gasto = { ...draft, spentResources: { "second-wind": 1, "spell-slot-1": 2, "hit-dice": 3 } };
    expect(descansoCurto(gasto).spentResources).toEqual({ "spell-slot-1": 2, "hit-dice": 3 });
    expect(descansoLongo({ ...gasto, currentHp: 0 }, 28)).toEqual({ ok: false, motivo: expect.stringMatching(/pelo menos 1 PV/) });
    const r = descansoLongo(gasto, 28);
    expect(r.ok && r.draft).toMatchObject({ currentHp: 28, temporaryHp: 0, spentResources: { "hit-dice": 2 } });
    expect(r.ok && lerEstadoJogo(r.draft).historico[0].texto).toBe("Descanso longo");
  });
  it("usa e recupera recursos dentro dos limites calculados", () => {
    const sheet = sheet2014(draft);
    const usado = usarRecurso(draft, sheet, "second-wind", 1);
    expect(usado.spentResources["second-wind"]).toBe(1);
    expect(usarRecurso(usado, sheet2014(usado), "second-wind", 1)).toBe(usado);
    expect(usarRecurso(draft, sheet, "second-wind", -1)).toBe(draft);
    expect(usarRecurso(draft, sheet, "inexistente", 1)).toBe(draft);
  });
  it("defesas de raça e classe são derivadas; itens, carga, moedas e histórico têm limites", () => {
    expect(defesasDerivadas(draft, [{ index: "dwarven-resilience" }])).toEqual([expect.objectContaining({ tipo: "resistencia", texto: "veneno" })]);
    expect(defesasDerivadas({ ...draft, raceId: "dragonborn" }, [], "red")[0].texto).toBe("fogo");
    expect(podeEquipar("longsword")).toBe(true);
    expect(podeEquipar("chain-mail")).toBe(true);
    expect(podeEquipar("backpack")).toBe(false);
    expect(pesoCarregado({ ...draft, inventory: [{ id: "a", itemId: "chain-mail", quantity: 1, equipped: false, origin: "acquired" }] })).toBeGreaterThan(20);
    expect(definirMoeda(draft, "pp", 3).currency).toEqual({ cp: 0, sp: 0, gp: 0, pp: 3 });
    expect(definirMoeda(draft, "ep", -1)).toBe(draft);
    let d = draft;
    for (let i = 0; i < MAX_HISTORICO + 5; i++) d = registrarMovimento(d, `m${i}`);
    expect(lerEstadoJogo(d).historico).toHaveLength(MAX_HISTORICO);
    expect(lerEstadoJogo(d).historico[0].texto).toBe(`m${MAX_HISTORICO + 4}`);
  });
});

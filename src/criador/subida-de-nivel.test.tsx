// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import type { CharacterDraft } from "../rules/character-domain";
import { SubirNivel } from "./SubirNivel";
import { comEscolhas, comparar, escolhasNovas, incompletas, prepararSubida } from "./subidaDeNivel";
import { sheet2014, VERSION_2014 } from "./regras-2014";

afterEach(cleanup);
const guerreiro: CharacterDraft = {
  id: "x", name: "Thorin", ruleset: "5e-2014", catalogueVersion: VERSION_2014, classId: "fighter", raceId: "hill-dwarf", backgroundId: "acolyte", level: 2,
  baseAbilities: { str: 15, dex: 12, con: 14, int: 10, wis: 12, cha: 8 }, decisions: [], currentHp: 9, temporaryHp: 2, spentResources: { "second-wind": 1 },
  currency: { cp: 3, sp: 4, gp: 55 }, story: { historia: "Segredo" }, inventory: [{ id: "a", itemId: "longsword", quantity: 1, equipped: true, origin: "starting" }],
};

describe("subida de nível pelo motor", () => {
  it("só muda nível, PV por nível e escolhas novas: inventário, moedas, recursos gastos, história e vida continuam", () => {
    const d = prepararSubida(guerreiro, null);
    expect(d.level).toBe(3);
    for (const chave of ["inventory", "currency", "spentResources", "story", "currentHp", "temporaryHp", "baseAbilities"] as const) expect(d[chave], chave).toEqual(guerreiro[chave]);
    expect(d.hpRolls).toBeUndefined();
    expect(escolhasNovas(guerreiro, d).map(c => c.id)).toContain("subclass");
    const c = comparar(guerreiro, d);
    expect(c.pv[1]).toBeGreaterThan(c.pv[0]); expect(c.dadosDeVida).toEqual([2, 3]);
  });
  it("rolagem informada vale só no nível novo; os PV dos níveis anteriores ficam iguais", () => {
    const fixo = sheet2014({ ...prepararSubida(guerreiro, null), currentHp: 0 }).maxHp;
    const rolado = prepararSubida(guerreiro, 10);
    expect(rolado.hpRolls).toEqual([6, 10]);
    expect(sheet2014({ ...rolado, currentHp: 0 }).maxHp).toBe(fixo + 4);
    expect(sheet2014({ ...rolado, currentHp: 0 }).pending.filter(p => p.startsWith("hp-roll"))).toEqual([]);
  });
  it("as escolhas novas precisam estar completas e são reaplicadas sem duplicar", () => {
    const d = prepararSubida(guerreiro, null), novas = escolhasNovas(guerreiro, d);
    const pronta = comEscolhas(d, { subclass: ["champion"] });
    expect(incompletas(pronta, novas.filter(c => c.id === "subclass"))).toEqual([]);
    expect(comEscolhas(pronta, { subclass: ["champion"] }).decisions.filter(x => x.id === "subclass")).toHaveLength(1);
    expect(() => prepararSubida({ ...guerreiro, level: 20 }, null)).toThrow(/20/);
  });
});

describe("tela de subida de nível", () => {
  it("mostra a comparação, exige as escolhas novas e entrega a ficha nova só na confirmação", () => {
    const confirmar = vi.fn(), cancelar = vi.fn();
    render(<SubirNivel atual={guerreiro} onConfirmar={confirmar} onCancelar={cancelar}/>);
    const passos = () => within(screen.getByRole("navigation", { name: "Etapas da subida de nível" }));
    fireEvent.click(passos().getByRole("button", { name: /^Revisão/ }));
    const botao = () => screen.getByRole("button", { name: "Confirmar nível 3" }) as HTMLButtonElement;
    expect(botao().disabled).toBe(true);
    expect(screen.getByRole("table").textContent).toMatch(/PV máximos.*Dados de vida \(d10\)23/s);
    fireEvent.click(passos().getByRole("button", { name: /^Características e escolhas/ }));
    fireEvent.change(screen.getByRole("combobox", { name: "Subclasse" }), { target: { value: "champion" } });
    fireEvent.click(passos().getByRole("button", { name: /^Pontos de vida/ }));
    fireEvent.change(screen.getByLabelText("Aumento de PV"), { target: { value: "rolado" } });
    fireEvent.click(passos().getByRole("button", { name: /^Revisão/ }));
    expect(botao().disabled).toBe(true);                                  // falta a rolagem
    fireEvent.click(passos().getByRole("button", { name: /^Pontos de vida/ }));
    fireEvent.change(screen.getByLabelText("Resultado da rolagem de PV"), { target: { value: "8" } });
    fireEvent.click(passos().getByRole("button", { name: /^Revisão/ }));
    expect(confirmar).not.toHaveBeenCalled();
    fireEvent.click(botao());
    const novo = confirmar.mock.calls[0][0] as CharacterDraft;
    expect(novo).toMatchObject({ level: 3, hpRolls: [6, 8], currency: guerreiro.currency, inventory: guerreiro.inventory, spentResources: guerreiro.spentResources, story: guerreiro.story });
    expect(novo.decisions.find(d => d.id === "subclass")?.optionIds).toEqual(["champion"]);
  });
});

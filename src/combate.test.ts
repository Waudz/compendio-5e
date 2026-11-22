import { describe, expect, it } from "vitest";
import { adicionar, alterarPv, combateVazio, definirIniciativa, enviarParaCombate, lerCombate, lerEncontros, ordenar, proximoTurno, remover } from "./combate";

const base = () => combateVazio();
const monta = () => { let e = base(); e = adicionar(e, { nome: "Goblin", iniciativa: 12, lado: "inimigo", pv: 7, pvMax: 7 }); e = adicionar(e, { nome: "Lydia", iniciativa: 18, lado: "aliado" }); e = adicionar(e, { nome: "Orc", iniciativa: 12, lado: "inimigo" }); return e; };

describe("lógica da iniciativa", () => {
  it("ordena por iniciativa (maior primeiro) e mantém a ordem de entrada nos empates", () => {
    expect(ordenar(monta().combatentes).map(c => c.nome)).toEqual(["Lydia", "Goblin", "Orc"]);
  });
  it("o primeiro da ordem começa com o turno; próximo turno avança e a rodada sobe ao voltar ao início", () => {
    let e = monta(); expect(e.turno).toBe(e.combatentes[0].id); expect(e.rodada).toBe(1);
    e = proximoTurno(e); e = proximoTurno(e); expect(e.combatentes.find(c => c.id === e.turno)?.nome).toBe("Orc"); e = proximoTurno(e);
    expect(e.combatentes.find(c => c.id === e.turno)?.nome).toBe("Lydia"); expect(e.rodada).toBe(2);
  });
  it("dano e cura ficam entre 0 e o PV máximo; sem PV cadastrado não faz nada", () => {
    let e = monta(); const gob = e.combatentes.find(c => c.nome === "Goblin")!, lyd = e.combatentes.find(c => c.nome === "Lydia")!;
    e = alterarPv(e, gob.id, -3); expect(e.combatentes.find(c => c.id === gob.id)?.pv).toBe(4); e = alterarPv(e, gob.id, -99); expect(e.combatentes.find(c => c.id === gob.id)?.pv).toBe(0);
    e = alterarPv(e, gob.id, 99); expect(e.combatentes.find(c => c.id === gob.id)?.pv).toBe(7); expect(alterarPv(e, lyd.id, -5)).toEqual(e);
  });
  it("remover quem está no turno passa o turno ao seguinte; remover o último zera o turno", () => {
    let e = monta(); const lyd = e.combatentes[0]; e = remover(e, lyd.id); expect(e.combatentes.find(c => c.id === e.turno)?.nome).toBe("Goblin");
    for (const c of [...e.combatentes]) e = remover(e, c.id); expect(e.turno).toBeNull(); expect(e.combatentes).toEqual([]);
  });
  it("mudar a iniciativa reordena; nome vazio e valor inválido são ignorados", () => {
    let e = monta(); const orc = e.combatentes.find(c => c.nome === "Orc")!; e = definirIniciativa(e, orc.id, 30); expect(e.combatentes[0].nome).toBe("Orc");
    expect(adicionar(e, { nome: "  ", iniciativa: 5, lado: "neutro" })).toBe(e); expect(definirIniciativa(e, orc.id, Number.NaN)).toBe(e);
  });
  it("encontro enviado ao combate numera quando há mais de um e leva o PV", () => {
    const e = enviarParaCombate(base(), { id: "e1", nome: "Emboscada", participantes: [{ id: "p1", nome: "Goblin", quantidade: 2, pv: 7 }, { id: "p2", nome: "Chefe", quantidade: 1 }] });
    expect(e.combatentes.map(c => c.nome).sort()).toEqual(["Chefe", "Goblin 1", "Goblin 2"]); expect(e.combatentes.find(c => c.nome === "Goblin 1")).toMatchObject({ pv: 7, pvMax: 7, lado: "inimigo" });
  });
  it("leitura segura: dado corrompido ou inválido lança erro em vez de entrar na tela", () => {
    expect(() => lerCombate("{não é json")).toThrow(); expect(() => lerCombate(JSON.stringify({ combatentes: [{ id: "a", nome: "", iniciativa: 1, lado: "inimigo" }], rodada: 1 }))).toThrow();
    expect(() => lerCombate(JSON.stringify({ combatentes: [], rodada: 0 }))).toThrow(); expect(() => lerEncontros(JSON.stringify({}))).toThrow();
    expect(lerCombate(null)).toEqual(combateVazio()); expect(lerEncontros(null)).toEqual([]);
  });
});

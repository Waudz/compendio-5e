import { describe, expect, it } from "vitest";
import { adicionar, alterarPv, combateVazio, definirIniciativa, enviarParaCombate, lerCombate, lerEncontros, ordenar, proximoTurno, remover, alternarCondicao, duplicarEncontro, renomearEncontro, rolarIniciativa, turnoAnterior , type Encontro } from "./combate";

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

describe("limites dos dados externos", () => {
  it.each([1.5, 51, 1e100, 0, -1])("rejeita quantidade de encontro inválida %s sem expansão", quantidade => {
    expect(() => lerEncontros(JSON.stringify([{ id: "e", nome: "Encontro", participantes: [{ id: "p", nome: "Goblin", quantidade }] }]))).toThrow();
  });
  it.each([{ pvMax: 1.5 }, { pvMax: 7, pv: 8 }, { pvMax: 7, pv: -1 }, { pv: 1 }, { pvMax: 7, pv: 1.5 }])("rejeita PV inválido sem corrigir silenciosamente: %o", dados => {
    expect(() => lerCombate(JSON.stringify({ ...base(), combatentes: [{ id: "a", nome: "Goblin", iniciativa: 0, lado: "inimigo", ...dados }] }))).toThrow();
  });
  it("não cria IDs duplicados ou PV infinito pela API de domínio", () => {
    const e = monta();
    expect(adicionar(e, { id: e.combatentes[0].id, nome: "Duplicado", iniciativa: 1, lado: "inimigo" })).toBe(e);
    expect(adicionar(e, { nome: "Inválido", iniciativa: 1, lado: "inimigo", pvMax: Infinity })).toBe(e);
  });
});

describe("remoção durante a ordem de iniciativa", () => {
  it.each([1, 4])("remover o último no turno avança ao primeiro e inicia rodada seguinte a %s", rodada => {
    const e = monta();
    const ultimo = e.combatentes[e.combatentes.length - 1];
    const r = remover({ ...e, turno: ultimo.id, rodada }, ultimo.id);
    expect(r.turno).toBe(e.combatentes[0].id);
    expect(r.rodada).toBe(rodada + 1);
  });
  it("remover antes ou depois de quem está no turno não avança rodada nem troca seu ID", () => {
    const e = monta(), atual = e.combatentes[1];
    for (const c of [e.combatentes[0], e.combatentes[2]]) {
      const r = remover({ ...e, turno: atual.id, rodada: 3 }, c.id);
      expect(r.turno).toBe(atual.id);
      expect(r.rodada).toBe(3);
    }
  });
});

describe("combate: condições, referências, turno anterior, rolagem e encontros", () => {
  const base = () => { let e = combateVazio(); e = adicionar(e, { nome: "Orc", iniciativa: 10, lado: "inimigo" }); e = adicionar(e, { nome: "Lydia", iniciativa: 15, lado: "aliado" }); return e; };
  it("turno anterior recua dentro da rodada e, no primeiro, volta à rodada anterior (nunca abaixo de 1)", () => {
    let e = base(); expect(turnoAnterior(e)).toEqual(e);   // rodada 1, primeiro: não há para onde voltar
    e = proximoTurno(proximoTurno(e)); expect(e.rodada).toBe(2);
    const t = turnoAnterior(e); expect(t.rodada).toBe(1); expect(t.combatentes.find(c => c.id === t.turno)?.nome).toBe("Orc");
    expect(turnoAnterior(t).combatentes.find(c => c.id === turnoAnterior(t).turno)?.nome).toBe("Lydia");
  });
  it("alterna condições sem repetir, limita a 16 e ignora texto vazio ou longo", () => {
    let e = base(); const id = e.combatentes[0].id;
    e = alternarCondicao(e, id, "Cego"); e = alternarCondicao(e, id, "Cego"); expect(e.combatentes[0].condicoes).toBeUndefined();
    e = alternarCondicao(e, id, "Caído"); expect(e.combatentes[0].condicoes).toEqual(["Caído"]);
    expect(alternarCondicao(e, id, "  ")).toBe(e); expect(alternarCondicao(e, id, "x".repeat(41))).toBe(e);
    for (let i = 0; i < 20; i++) e = alternarCondicao(e, id, `c${i}`); expect(e.combatentes[0].condicoes).toHaveLength(16);
  });
  it("rolar iniciativa usa d20 + bônus com aleatório injetável", () => {
    const e = base(), id = e.combatentes[0].id;
    expect(rolarIniciativa(e, id, 3, () => 0).combatentes.find(c => c.id === id)?.iniciativa).toBe(4);      // 1 + 3
    expect(rolarIniciativa(e, id, -1, () => 0.999).combatentes.find(c => c.id === id)?.iniciativa).toBe(19); // 20 - 1
  });
  it("referências e condições sobrevivem à leitura segura e entradas inválidas são recusadas", () => {
    let e = adicionar(combateVazio(), { nome: "Goblin", iniciativa: 1, lado: "inimigo", pv: 7, pvMax: 7, ref: { tipo: "monstro", id: "goblin" } });
    e = alternarCondicao(e, e.combatentes[0].id, "Cego");
    expect(lerCombate(JSON.stringify(e)).combatentes[0]).toMatchObject({ ref: { tipo: "monstro", id: "goblin" }, condicoes: ["Cego"] });
    const mau = (c: object) => JSON.stringify({ ...e, combatentes: [{ ...e.combatentes[0], ...c }] });
    for (const c of [{ ref: { tipo: "carro", id: "x" } }, { ref: { tipo: "monstro" } }, { condicoes: "Cego" }, { condicoes: [""] }, { condicoes: ["a", "a"] }]) expect(() => lerCombate(mau(c))).toThrow();
  });
  it("encontro duplicado é independente (novos ids), renomear valida e a referência vai para o combate", () => {
    const enc: Encontro = { id: "e1", nome: "Emboscada", participantes: [{ id: "p1", nome: "Goblin", quantidade: 2, pv: 7, ref: { tipo: "monstro", id: "goblin" } }] };
    const copia = duplicarEncontro(enc); expect(copia.nome).toBe("Emboscada (cópia)"); expect(copia.id).not.toBe(enc.id); expect(copia.participantes[0].id).not.toBe("p1"); expect(copia.participantes[0].ref).toEqual({ tipo: "monstro", id: "goblin" });
    expect(renomearEncontro(enc, "  ")).toBe(enc); expect(renomearEncontro(enc, "Ruínas").nome).toBe("Ruínas");
    expect(enviarParaCombate(combateVazio(), enc).combatentes.every(c => c.ref?.id === "goblin")).toBe(true);
    expect(lerEncontros(JSON.stringify([enc]))[0].participantes[0].ref).toEqual({ tipo: "monstro", id: "goblin" });
  });
});

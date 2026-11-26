import { describe, expect, it } from "vitest";
import { configCampanhaEmMemoria } from "../configCampanha";
import { entregarNasAtivas, lerMoedasAtivas, totalEmOuro } from "./moedas";

describe("moedas da campanha", () => {
  it("sem configuração valem as cinco; a mesa sem Electro e Platina fica com Cobre, Prata e Ouro", () => {
    expect(lerMoedasAtivas(null)).toEqual(["cp", "sp", "ep", "gp", "pp"]);
    expect(lerMoedasAtivas([])).toHaveLength(5);
    expect(lerMoedasAtivas(["gp", "cp", "sp", "xx"])).toEqual(["cp", "sp", "gp"]);
  });
  it("converte o patrimônio das moedas ativas em peças de ouro", () => {
    const carteira = { cp: 250, sp: 15, ep: 4, gp: 3, pp: 1 };
    expect(totalEmOuro(carteira, ["cp", "sp", "ep", "gp", "pp"])).toBe(2.5 + 1.5 + 2 + 3 + 10);
    expect(totalEmOuro(carteira, ["cp", "sp", "gp"])).toBe(7);
  });
  it("uma entrega em moeda desativada chega com o mesmo valor nas ativas, sem apagar o que já existia", () => {
    const ativas = ["cp", "sp", "gp"] as const;
    expect(entregarNasAtivas({ ep: 2, gp: 1 }, { ep: 5, gp: 1 }, ativas)).toEqual({ ep: 2, gp: 2, sp: 5 });
    expect(entregarNasAtivas({ gp: 0 }, { gp: 0, pp: 2 }, ativas)).toEqual({ gp: 20, pp: 0 });
    expect(entregarNasAtivas({ gp: 0 }, { gp: 15 }, ativas)).toEqual({ gp: 15 });
  });
  it("sem conversão exata, o valor fica como veio (nada é arredondado)", () => {
    expect(entregarNasAtivas({}, { cp: 3 }, ["gp"])).toEqual({ cp: 3 });
  });
  it("só quem tem permissão grava, e a campanha nunca fica sem moeda", async () => {
    const jogador = configCampanhaEmMemoria(new Map(), () => false);
    expect((await jogador.salvarMoedas("c", ["gp"])).ok).toBe(false);
    const mestre = configCampanhaEmMemoria();
    expect((await mestre.salvarMoedas("c", [])).ok).toBe(false);
    expect(await mestre.salvarMoedas("c", ["gp", "cp"])).toEqual({ ok: true, data: ["cp", "gp"] });
  });
});

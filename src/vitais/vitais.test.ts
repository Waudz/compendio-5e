import { describe, expect, it, vi } from "vitest";
import { VERSION_2014 } from "../criador/regras-2014";
import { fichasEmMemoria, novoBancoFichas } from "../fichasMemoria";
import type { CharacterDraft } from "../rules/character-domain";
import { criarLoja } from "./loja";
import { aplicarAcao, comVitais, vitaisDoDraft, type Vitais } from "./vitais";

const v = (p: Partial<Vitais> = {}): Vitais => ({ pv: 20, temp: 0, condicoes: [], morte: { sucessos: 0, falhas: 0 }, ...p });
const draft: CharacterDraft = { id: "p1", name: "N", ruleset: "5e-2014", catalogueVersion: VERSION_2014, classId: "fighter", raceId: "human", backgroundId: "acolyte", level: 3,
  baseAbilities: { str: 15, dex: 12, con: 14, int: 10, wis: 12, cha: 8 }, decisions: [], inventory: [], currentHp: 20, temporaryHp: 0, spentResources: {} };

describe("operações do estado vital (mesmas regras do banco)", () => {
  it("dano consome temporários; cura para no máximo e zera a morte ao voltar de 0", () => {
    expect(aplicarAcao(v({ temp: 5 }), { tipo: "dano", valor: 8 })).toMatchObject({ pv: 17, temp: 0 });
    expect(aplicarAcao(v(), { tipo: "cura", valor: 99, maximo: 24 }).pv).toBe(24);
    expect(aplicarAcao(v({ pv: 0, morte: { sucessos: 2, falhas: 2 } }), { tipo: "cura", valor: 1, maximo: 24 }).morte).toEqual({ sucessos: 0, falhas: 0 });
    expect(aplicarAcao(v({ temp: 9 }), { tipo: "temporarios", valor: 4 }).temp).toBe(4);
    expect(aplicarAcao(v(), { tipo: "ajustar", valor: 6, maximo: 22 }).pv).toBe(22);
    expect(aplicarAcao(v({ condicoes: ["A"] }), { tipo: "condicao", nome: "B", ativa: true }).condicoes).toEqual(["A", "B"]);
    expect(aplicarAcao(v({ condicoes: ["A", "B"] }), { tipo: "condicao", nome: "A", ativa: false }).condicoes).toEqual(["B"]);
  });
  it("sobrepor o mesmo estado não cria uma ficha 'alterada'", () => {
    expect(comVitais(draft, vitaisDoDraft(draft))).toBe(draft);
    expect(comVitais(draft, v({ pv: 3 }))).toMatchObject({ currentHp: 3 });
  });
});

describe("fila única", () => {
  const montar = () => {
    const banco = novoBancoFichas(); banco.campanhas = { c1: { mestre: "u9", jogadores: ["u1"] } };
    banco.fichas.push({ id: "p1", campaignId: "c1", ownerId: "u1", revision: 1, draft: structuredClone(draft), updatedAt: "" });
    return { banco, api: fichasEmMemoria("u1", banco) };
  };
  it("mostra a mudança na hora, envia na ordem e, sem rede, repete com o mesmo identificador sem aplicar duas vezes", async () => {
    const { banco, api } = montar(), real = api.alterarVitais, ids: string[] = [];
    let perdeResposta = true;
    // a primeira resposta se perde DEPOIS de o servidor aplicar
    api.alterarVitais = async (id, acao, op) => { ids.push(op); const r = await real(id, acao, op); if (perdeResposta) { perdeResposta = false; return { ok: false, error: "Sem conexão com o servidor." }; } return r; };
    const loja = criarLoja(api, 5);
    await loja.ler(["p1"]);
    loja.enviar("p1", { tipo: "dano", valor: 6 }); loja.enviar("p1", { tipo: "cura", valor: 2, maximo: 24 });
    expect(loja.ver("p1")!.pv).toBe(16); expect(loja.pendentes("p1")).toBe(2);
    await vi.waitFor(() => expect(loja.pendentes()).toBe(0));
    expect(banco.fichas[0].draft.currentHp).toBe(16); expect(loja.ver("p1")!.pv).toBe(16);
    expect(ids[0]).toBe(ids[1]); expect(new Set(ids).size).toBe(2);
  });
  it("uma leitura antiga não volta o estado no tempo", async () => {
    const { api } = montar(), loja = criarLoja(api);
    await loja.ler(["p1"]); const antiga = loja.ver("p1")!;
    loja.enviar("p1", { tipo: "dano", valor: 6 }); await vi.waitFor(() => expect(loja.pendentes()).toBe(0));
    loja.receber(antiga, antiga.draft);
    expect(loja.ver("p1")!.pv).toBe(14);
  });
  it("recusa do servidor descarta a operação e mostra o valor confirmado", async () => {
    const { banco, api } = montar(), loja = criarLoja(api);
    await loja.ler(["p1"]); banco.campanhas.c1.jogadores = [];
    loja.enviar("p1", { tipo: "dano", valor: 6 });
    await vi.waitFor(() => expect(loja.pendentes()).toBe(0));
    expect(loja.ver("p1")!.pv).toBe(20); expect(loja.erro()).toMatch(/Personagem não encontrado/);
  });
});

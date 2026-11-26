// PV da ficha para o combate: leitura automática. As alterações são operações na própria ficha (ver vitais/vitais.test.ts).
import { describe, expect, it } from "vitest";
import { VERSION_2014, sheet2014 } from "./criador/regras-2014";
import type { FichasApi, FichaServidor } from "./fichas";
import { lerPvFicha } from "./pvFicha";
import type { CharacterDraft } from "./rules/character-domain";

const draft = (patch: Partial<CharacterDraft> = {}): CharacterDraft => ({
  id: "p1", name: "Heroína", catalogueVersion: VERSION_2014, ruleset: "5e-2014", classId: "fighter", raceId: "human", backgroundId: "acolyte", level: 1,
  baseAbilities: { str: 15, dex: 12, con: 14, int: 10, wis: 12, cha: 8 }, decisions: [], inventory: [], currentHp: 0, temporaryHp: 0, spentResources: {}, ...patch,
});
const MAX = sheet2014(draft()).maxHp;

const banco = (inicial: CharacterDraft | null) => ({
  carregar: async () => ({ ok: true, data: inicial ? { ficha: { id: "p1", campaignId: "c", ownerId: "dono", revision: 1, draft: inicial, updatedAt: "" } as FichaServidor, identidade: null } : null }),
}) as unknown as FichasApi;

describe("lerPvFicha", () => {
  it("devolve PV atuais e o máximo calculado pelas regras da ficha", async () => {
    const b = banco(draft({ currentHp: 5 }));
    const r = await lerPvFicha(b, "p1");
    expect(r).toEqual({ ok: true, dados: { atual: Math.min(5, MAX), max: MAX } });
  });
  it("limita o atual ao máximo e ao mínimo zero", async () => {
    expect((await lerPvFicha(banco(draft({ currentHp: 9999 })), "p1"))).toMatchObject({ ok: true, dados: { atual: MAX } });
    expect((await lerPvFicha(banco(draft({ currentHp: -3 as never })), "p1"))).toMatchObject({ ok: true, dados: { atual: 0 } });
  });
  it("personagem sem ficha guiada acessível: 'semFicha', para o chamador cair no PV manual", async () => {
    expect(await lerPvFicha(banco(null), "p1")).toMatchObject({ ok: false, semFicha: true });
  });
  it("falha de leitura do servidor vira erro, nunca valor inventado", async () => {
    const api = { carregar: async () => ({ ok: false, error: "Sem conexão com o servidor." }) } as unknown as FichasApi;
    expect(await lerPvFicha(api, "p1")).toEqual({ ok: false, erro: "Sem conexão com o servidor." });
  });
});

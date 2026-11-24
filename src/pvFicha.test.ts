// PV da ficha para o combate: leitura automática e gravação segura (só currentHp, sobre a ficha mais recente, com controle de revisão).
import { describe, expect, it } from "vitest";
import { VERSION_2014, sheet2014 } from "./criador/regras-2014";
import { ERRO_CONFLITO_REVISAO, type FichasApi, type FichaServidor } from "./fichas";
import { gravarPvFicha, lerPvFicha, TENTATIVAS_GRAVACAO } from "./pvFicha";
import type { CharacterDraft } from "./rules/character-domain";

const draft = (patch: Partial<CharacterDraft> = {}): CharacterDraft => ({
  id: "p1", name: "Heroína", catalogueVersion: VERSION_2014, ruleset: "5e-2014", classId: "fighter", raceId: "human", backgroundId: "acolyte", level: 1,
  baseAbilities: { str: 15, dex: 12, con: 14, int: 10, wis: 12, cha: 8 }, decisions: [], inventory: [], currentHp: 0, temporaryHp: 0, spentResources: {}, ...patch,
});
const MAX = sheet2014(draft()).maxHp;

/** Banco de fichas mínimo com revisão otimista e ganchos para simular alterações concorrentes. */
function banco(inicial: CharacterDraft | null, opts: { aoCarregar?: (n: number, b: ReturnType<typeof banco>) => void; erroSalvar?: string } = {}) {
  const b = { ficha: inicial ? { id: "p1", campaignId: "c", ownerId: "dono", revision: 1, draft: inicial, updatedAt: "" } as FichaServidor : null, carregamentos: 0, salvamentos: 0, ultimoSalvo: null as CharacterDraft | null,
    api: null as unknown as FichasApi };
  b.api = {
    listar: async () => ({ ok: true, data: [] }), criar: async () => ({ ok: false, error: "x" }),
    carregar: async () => { b.carregamentos++; opts.aoCarregar?.(b.carregamentos, b); return { ok: true, data: b.ficha ? { ficha: structuredClone(b.ficha), identidade: null } : null }; },
    salvar: async (_id, esperada, d) => {
      b.salvamentos++;
      if (opts.erroSalvar) return { ok: false, error: opts.erroSalvar };
      if (!b.ficha || b.ficha.revision !== esperada) return { ok: false, error: ERRO_CONFLITO_REVISAO };
      b.ficha = { ...b.ficha, revision: b.ficha.revision + 1, draft: structuredClone(d) }; b.ultimoSalvo = d;
      return { ok: true, data: { id: "p1", revision: b.ficha.revision, updatedAt: "" } };
    },
  };
  return b;
}

describe("lerPvFicha", () => {
  it("devolve PV atuais e o máximo calculado pelas regras da ficha", async () => {
    const b = banco(draft({ currentHp: 5 }));
    const r = await lerPvFicha(b.api, "p1");
    expect(r).toEqual({ ok: true, dados: { atual: Math.min(5, MAX), max: MAX } });
  });
  it("limita o atual ao máximo e ao mínimo zero", async () => {
    expect((await lerPvFicha(banco(draft({ currentHp: 9999 })).api, "p1"))).toMatchObject({ ok: true, dados: { atual: MAX } });
    expect((await lerPvFicha(banco(draft({ currentHp: -3 as never })).api, "p1"))).toMatchObject({ ok: true, dados: { atual: 0 } });
  });
  it("personagem sem ficha guiada acessível: 'semFicha', para o chamador cair no PV manual", async () => {
    expect(await lerPvFicha(banco(null).api, "p1")).toMatchObject({ ok: false, semFicha: true });
  });
  it("falha de leitura do servidor vira erro, nunca valor inventado", async () => {
    const api: FichasApi = { listar: async () => ({ ok: true, data: [] }), criar: async () => ({ ok: false, error: "x" }), salvar: async () => ({ ok: false, error: "x" }), carregar: async () => ({ ok: false, error: "Sem conexão com o servidor." }) };
    expect(await lerPvFicha(api, "p1")).toEqual({ ok: false, erro: "Sem conexão com o servidor." });
  });
});

describe("gravarPvFicha", () => {
  it("grava só currentHp e preserva o resto da ficha (inclusive PV temporários, inventário e recursos)", async () => {
    const original = draft({ currentHp: MAX, temporaryHp: 4, spentResources: { "second-wind": 1 } as never, inventory: [{ id: "i1", itemId: "dagger", quantity: 2 }] as never });
    const b = banco(original);
    expect(await gravarPvFicha(b.api, "p1", 3)).toEqual({ ok: true, dados: { gravado: 3 } });
    expect(b.ultimoSalvo).toEqual({ ...original, currentHp: 3 });
    expect(b.ficha!.revision).toBe(2);
  });
  it("limita ao máximo da ficha e a zero", async () => {
    const b = banco(draft({ currentHp: 1 }));
    expect(await gravarPvFicha(b.api, "p1", 9999)).toEqual({ ok: true, dados: { gravado: MAX } });
    expect(await gravarPvFicha(b.api, "p1", -5)).toEqual({ ok: true, dados: { gravado: 0 } });
  });
  it("valor igual ao da ficha não grava nada (sem revisão à toa)", async () => {
    const b = banco(draft({ currentHp: 2 }));
    expect(await gravarPvFicha(b.api, "p1", 2)).toEqual({ ok: true, dados: { gravado: 2 } });
    expect(b.salvamentos).toBe(0);
  });
  it("PROTEÇÃO: se o dono salvou a ficha no meio do caminho, relê e reaplica SÓ os PV sobre a versão nova (nada do dono é perdido)", async () => {
    const b = banco(draft({ currentHp: MAX, name: "Nome antigo" }), {
      aoCarregar: (n, bd) => { if (n === 1) bd.ficha = { ...bd.ficha!, revision: 2, draft: { ...bd.ficha!.draft, name: "Nome novo do dono", temporaryHp: 7 } } as FichaServidor; },   // dono salva logo após a 1ª leitura? não: antes da gravação
    });
    // a alteração do dono acontece ENTRE a leitura e a gravação: simulamos trocando a revisão após a primeira leitura
    const real = b.api.salvar; let primeira = true;
    b.api.salvar = async (id, esperada, d, i) => { if (primeira) { primeira = false; b.ficha = { ...b.ficha!, revision: b.ficha!.revision + 1, draft: { ...b.ficha!.draft, name: "Editado pelo dono", temporaryHp: 9 } }; } return real(id, esperada, d, i); };
    const r = await gravarPvFicha(b.api, "p1", 4);
    expect(r).toEqual({ ok: true, dados: { gravado: 4 } });
    expect(b.ficha!.draft).toMatchObject({ currentHp: 4, name: "Editado pelo dono", temporaryHp: 9 });   // alteração concorrente preservada
    expect(b.carregamentos).toBeGreaterThanOrEqual(2);
  });
  it("conflito sempre: desiste depois de TENTATIVAS_GRAVACAO sem sobrescrever nada", async () => {
    const b = banco(draft({ currentHp: MAX }));
    const real = b.api.salvar;
    b.api.salvar = async (id, esperada, d, i) => { b.ficha = { ...b.ficha!, revision: b.ficha!.revision + 1 }; return real(id, esperada, d, i); };   // sempre perde a corrida
    const r = await gravarPvFicha(b.api, "p1", 1);
    expect(r.ok).toBe(false); expect(b.carregamentos).toBe(TENTATIVAS_GRAVACAO);
    expect(b.ficha!.draft.currentHp).toBe(MAX);   // a ficha continua como o dono deixou
  });
  it("erro do servidor (ex.: sem permissão) é devolvido sem insistir; sem ficha guiada é sinalizado", async () => {
    const b = banco(draft(), { erroSalvar: "Você não tem permissão para esta operação." });
    expect(await gravarPvFicha(b.api, "p1", 1)).toEqual({ ok: false, erro: "Você não tem permissão para esta operação." }); expect(b.salvamentos).toBe(1);
    expect(await gravarPvFicha(banco(null).api, "p1", 1)).toMatchObject({ ok: false, semFicha: true });
  });
});

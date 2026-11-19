// Rascunhos locais: persistência (IndexedDB simulado), recuperação, isolamento, conflitos, limites, falhas, segredos e exportação.
// Dados fictícios. Nada é conectado ao Supabase.
import { IDBFactory } from "fake-indexeddb";
import { describe, expect, it } from "vitest";
import { DraftStorageError, createDraftStore, containsSecret, flushPending, memoryBackend, openBackend, openIdbBackend, type Draft, type DraftBackend, type SyncAdapter } from "./index";

const SR = "service" + "_role", SB = "sb_" + "secret_abcdefghijk1234";   // montados por partes (ver tests/seguranca.test.ts)
const U1 = "user-ana", U2 = "user-bia", C1 = "camp-1", C2 = "camp-2";
const NOTE = (id = "n1", content: unknown = [{ type: "paragraph", content: "texto" }], extra: Record<string, unknown> = {}) => ({ kind: "note" as const, entityId: id, content, ...extra });
let clock = 1_000_000; const now = () => clock;
const store = (backend: DraftBackend, user = U1, campaign: string | null = C1, limits = {}) => createDraftStore({ backend, userId: user, campaignId: campaign, now, limits, estimate: async () => undefined });
const ok = <T extends { ok: boolean }>(r: T) => { expect(r.ok).toBe(true); return r as Extract<T, { ok: true }>; };

describe("salvar, ler e recuperar", () => {
  it("guarda rascunho pendente com versão-base, tamanho e datas; ler devolve o mesmo conteúdo", async () => {
    const s = store(memoryBackend()); clock = 5;
    const r = ok(await s.save(NOTE("n1", [{ type: "paragraph", content: "olá" }], { title: "Cena 1", baseVersion: 3 })));
    expect(r.draft).toMatchObject({ status: "pending", baseVersion: 3, title: "Cena 1", createdAt: 5, updatedAt: 5, scope: `${U1}|${C1}`, userId: U1, campaignId: C1 });
    expect(r.draft.bytes).toBeGreaterThan(10);
    expect(await s.get("note", "n1")).toEqual(r.draft);
    clock = 9; const r2 = ok(await s.save(NOTE("n1", [{ type: "paragraph", content: "olá de novo" }])));
    expect(r2.draft).toMatchObject({ baseVersion: 3, createdAt: 5, updatedAt: 9 });             // a base não muda ao editar de novo
    expect((await s.list()).map(d => d.entityId)).toEqual(["n1"]);
  });
  it("recupera os rascunhos depois de fechar e reabrir o navegador (IndexedDB)", async () => {
    const factory = new IDBFactory();
    const a = store(await openIdbBackend(factory)); ok(await a.save(NOTE("n1", [{ type: "paragraph", content: "não perder" }], { baseVersion: 2 })));
    expect(a.persistent).toBe(true);
    const b = store(await openIdbBackend(factory));                                              // nova conexão = navegador reaberto
    expect(await b.get("note", "n1")).toMatchObject({ content: [{ type: "paragraph", content: "não perder" }], status: "pending", baseVersion: 2 });
    expect((await b.usage()).pendingCount).toBe(1);
  });
  it("item novo (sem versão-base) é aceito; kind e id inválidos são recusados", async () => {
    const s = store(memoryBackend());
    expect(ok(await s.save(NOTE("novo-1"))).draft.baseVersion).toBeNull();
    for (const ruim of [{ kind: "x" as never, entityId: "a", content: 1 }, { kind: "note" as const, entityId: "", content: 1 }, { kind: "note" as const, entityId: "a/b", content: 1 }, { kind: "note" as const, entityId: "x".repeat(65), content: 1 }])
      expect(await s.save(ruim)).toMatchObject({ ok: false, reason: "invalido" });
  });
  it("remove um rascunho e ele some da listagem", async () => {
    const s = store(memoryBackend()); ok(await s.save(NOTE("n1"))); await s.remove("note", "n1"); expect(await s.list()).toEqual([]); expect(await s.hasUnsynced()).toBe(false);
  });
});

describe("isolamento entre contas e campanhas", () => {
  it("outro usuário, outra campanha e o escopo pessoal nunca enxergam os rascunhos uns dos outros (memória e IndexedDB)", async () => {
    for (const backend of [memoryBackend(), await openIdbBackend(new IDBFactory())]) {
      const a1 = store(backend, U1, C1), a2 = store(backend, U1, C2), b1 = store(backend, U2, C1), ap = store(backend, U1, null);
      ok(await a1.save(NOTE("n1", "segredo da Ana em C1")));
      expect(await a2.get("note", "n1")).toBeUndefined(); expect(await b1.get("note", "n1")).toBeUndefined(); expect(await ap.get("note", "n1")).toBeUndefined();
      for (const o of [a2, b1, ap]) { expect(await o.list()).toEqual([]); expect(await o.pending()).toEqual([]); expect(await o.hasUnsynced()).toBe(false); expect((await o.exportPending()).count).toBe(0); }
      expect(ap.scope).toBe(`${U1}|_pessoal`);
    }
  });
  it("registro forjado com a chave de outro escopo mas dono diferente nunca é devolvido", async () => {
    const backend = memoryBackend(), a = store(backend, U1, C1);
    const forjado: Draft = { key: `${U1}|${C1}|note|x1`, scope: `${U1}|${C1}`, userId: U2, campaignId: C1, kind: "note", entityId: "x1", content: "de outra conta", baseVersion: 1, status: "pending", createdAt: 1, updatedAt: 1, bytes: 10 };
    await backend.put(forjado);
    expect(await a.get("note", "x1")).toBeUndefined(); expect(await a.list()).toEqual([]);
  });
  it("trocar de usuário no mesmo navegador: o novo usuário não vê nada; os rascunhos pendentes do anterior continuam guardados para ele", async () => {
    const backend = memoryBackend(); ok(await store(backend, U1).save(NOTE("n1")));
    const depois = store(backend, U2); expect(await depois.list()).toEqual([]); ok(await depois.save(NOTE("n1", "da Bia")));
    expect((await store(backend, U1).get("note", "n1"))!.content).not.toBe("da Bia");
    expect((await store(backend, U1).list())).toHaveLength(1);
  });
  it("wipe apaga só o escopo atual (sair da conta em aparelho compartilhado)", async () => {
    const backend = memoryBackend(), a = store(backend, U1, C1), b = store(backend, U2, C1), c = store(backend, U1, C2);
    ok(await a.save(NOTE("n1"))); ok(await b.save(NOTE("n1"))); ok(await c.save(NOTE("n1")));
    expect(await a.wipe()).toBe(1); expect(await a.list()).toEqual([]); expect(await b.list()).toHaveLength(1); expect(await c.list()).toHaveLength(1);
  });
  it("o limite global conta o tamanho de todas as contas, mas a limpeza só toca no próprio escopo", async () => {
    const backend = memoryBackend(); const outro = store(backend, U2, C1, { maxTotalBytes: 1500 });
    ok(await outro.save(NOTE("o1", "x".repeat(300)))); await outro.markSynced("note", "o1", { serverVersion: 2, pushedUpdatedAt: clock });
    const meu = store(backend, U1, C1, { maxTotalBytes: 1500 });
    ok(await meu.save(NOTE("m1", "y".repeat(300))));
    expect((await meu.usage()).bytes).toBeGreaterThan(500);                                    // soma das duas contas
    const r = await meu.save(NOTE("m2", "z".repeat(1200)));
    expect(r).toMatchObject({ ok: false, reason: "limite" });
    expect(await outro.get("note", "o1")).toBeDefined();                                        // o rascunho (já salvo) de outra conta não foi tocado
  });
});

describe("conflitos de versão", () => {
  it("base diferente da do servidor → conflito; nada é sobrescrito (nem o rascunho nem o servidor)", async () => {
    const s = store(memoryBackend()); ok(await s.save(NOTE("n1", "meu texto", { baseVersion: 3 })));
    expect(await s.reconcile("note", "n1", 3)).toBe("apply");
    expect(await s.reconcile("note", "n1", 5)).toBe("conflict");
    const d = (await s.get("note", "n1"))!; expect(d).toMatchObject({ status: "conflict", serverVersionSeen: 5, content: "meu texto", baseVersion: 3 });
    expect(await s.pending()).toEqual([]);                                                       // conflito não entra na fila de envio
    expect((await s.exportPending()).count).toBe(1);                                             // mas é exportável
  });
  it("editar durante o conflito não o resolve sozinho; só uma escolha explícita resolve", async () => {
    const s = store(memoryBackend()); ok(await s.save(NOTE("n1", "v1", { baseVersion: 1 }))); await s.reconcile("note", "n1", 4);
    expect(ok(await s.save(NOTE("n1", "v2"))).draft.status).toBe("conflict");
    expect((await s.reconcile("note", "n1", 4))).toBe("conflict");
    const meu = await s.resolve("note", "n1", "meu"); expect(meu.ok).toBe(true);
    expect(await s.get("note", "n1")).toMatchObject({ status: "pending", baseVersion: 4, content: "v2" });   // mantém o texto do usuário, agora sobre a versão do servidor
    expect(await s.reconcile("note", "n1", 4)).toBe("apply");
  });
  it("usar o do servidor descarta o rascunho; salvar como cópia devolve o conteúdo e libera o original", async () => {
    const s = store(memoryBackend());
    ok(await s.save(NOTE("a", "texto A", { baseVersion: 1 }))); await s.reconcile("note", "a", 2);
    expect(await s.resolve("note", "a", "servidor")).toEqual({ ok: true, draft: undefined }); expect(await s.get("note", "a")).toBeUndefined();
    ok(await s.save(NOTE("b", "texto B", { baseVersion: 1 }))); await s.reconcile("note", "b", 2);
    const copia = await s.resolve("note", "b", "copia"); expect(copia.ok).toBe(true); expect(copia.draft?.content).toBe("texto B"); expect(await s.get("note", "b")).toBeUndefined();
    expect((await s.resolve("note", "nao-existe", "meu")).ok).toBe(false);
    ok(await s.save(NOTE("c"))); expect((await s.resolve("note", "c", "meu")).ok).toBe(false);   // só resolve quem está em conflito
  });
  it("item novo e rascunho já salvo não geram conflito", async () => {
    const s = store(memoryBackend()); ok(await s.save(NOTE("novo")));
    expect(await s.reconcile("note", "novo", 9)).toBe("apply"); expect(await s.reconcile("note", "inexistente", 9)).toBe("nothing");
    ok(await s.save(NOTE("x", "t", { baseVersion: 1 }))); await s.markSynced("note", "x", { serverVersion: 2, pushedUpdatedAt: clock });
    expect(await s.reconcile("note", "x", 7)).toBe("nothing");
  });
  it("confirmar o salvamento: se o usuário editou durante o envio, o rascunho continua pendente (nada se perde)", async () => {
    const s = store(memoryBackend()); clock = 100; const d1 = ok(await s.save(NOTE("n1", "v1", { baseVersion: 1 }))).draft;
    clock = 150; ok(await s.save(NOTE("n1", "v2 durante o envio")));
    const n = (await s.markSynced("note", "n1", { serverVersion: 2, pushedUpdatedAt: d1.updatedAt }))!;
    expect(n).toMatchObject({ status: "pending", baseVersion: 2, content: "v2 durante o envio" });
    clock = 200; const d3 = ok(await s.save(NOTE("n1", "v3"))).draft;
    expect(await s.markSynced("note", "n1", { serverVersion: 3, pushedUpdatedAt: d3.updatedAt })).toMatchObject({ status: "synced", baseVersion: 3, syncedAt: 200 });
  });
});

describe("limites, espaço e limpeza", () => {
  it("recusa rascunho grande demais sem tocar no que já existe", async () => {
    const s = store(memoryBackend(), U1, C1, { maxBytesPerDraft: 200 }); ok(await s.save(NOTE("n1", "curto")));
    expect(await s.save(NOTE("n2", "x".repeat(500)))).toMatchObject({ ok: false, reason: "rascunho_grande" });
    expect((await s.list()).map(d => d.entityId)).toEqual(["n1"]);
  });
  it("nunca descarta pendente nem conflito para abrir espaço: devolve 'limite' e mantém tudo", async () => {
    const s = store(memoryBackend(), U1, C1, { maxTotalBytes: 1200 });
    ok(await s.save(NOTE("p1", "a".repeat(350), { baseVersion: 1 }))); ok(await s.save(NOTE("p2", "b".repeat(350), { baseVersion: 1 }))); await s.reconcile("note", "p2", 9);   // p2 em conflito
    const r = await s.save(NOTE("p3", "c".repeat(600)));
    expect(r).toMatchObject({ ok: false, reason: "limite" }); expect(r.ok ? "" : r.message).toMatch(/nada foi descartado/i);
    expect((await s.list()).map(d => d.entityId).sort()).toEqual(["p1", "p2"]);
    expect((await s.get("note", "p1"))!.content).toBe("a".repeat(350));
  });
  it("antes de recusar, limpa só o que já está salvo (recuperável) neste escopo", async () => {
    const s = store(memoryBackend(), U1, C1, { maxTotalBytes: 1200 });
    ok(await s.save(NOTE("velho", "v".repeat(400), { baseVersion: 1 }))); await s.markSynced("note", "velho", { serverVersion: 2, pushedUpdatedAt: clock });
    ok(await s.save(NOTE("pend", "p".repeat(400), { baseVersion: 1 })));
    ok(await s.save(NOTE("novo", "n".repeat(400))));
    expect((await s.list()).map(d => d.entityId).sort()).toEqual(["novo", "pend"]);            // o "velho" (salvo) liberou espaço; o pendente ficou
  });
  it("aviso de espaço (80%) e cheio (100%); contagens por estado", async () => {
    const s = store(memoryBackend(), U1, C1, { maxTotalBytes: 2000 });
    ok(await s.save(NOTE("a", "x".repeat(900)))); expect((await s.usage()).level).toBe("ok");
    const r = ok(await s.save(NOTE("b", "x".repeat(800)))); expect(r.usage.level).toBe("aviso");
    expect(r.usage).toMatchObject({ count: 2, pendingCount: 2, conflictCount: 0, syncedCount: 0, persistent: false });
    ok(await s.save(NOTE("c", "x".repeat(270)))); expect((await s.usage()).level).toBe("cheio");
  });
  it("limite de quantidade de rascunhos", async () => {
    const s = store(memoryBackend(), U1, C1, { maxDrafts: 2, maxTotalBytes: 100 });
    ok(await s.save(NOTE("a", "1"))); ok(await s.save(NOTE("b", "2")));
    expect(await s.save(NOTE("c", "3"))).toMatchObject({ ok: false, reason: "limite" });
    ok(await s.save(NOTE("a", "1 editado")));                                                     // editar um existente continua permitido
  });
  it("a estimativa do navegador perto da cota sobe o nível para 'cheio'; 80% é 'aviso'", async () => {
    const b = memoryBackend(), mk = (usage: number) => createDraftStore({ backend: b, userId: U1, campaignId: C1, estimate: async () => ({ usage, quota: 100 }) });
    expect((await mk(85).usage()).level).toBe("aviso"); expect((await mk(95).usage()).level).toBe("cheio"); expect((await mk(10).usage()).browser).toEqual({ usage: 10, quota: 100 });
  });
  it("limpeza automática: só 'salvo' e antigo; pendente e conflito nunca", async () => {
    const s = store(memoryBackend(), U1, C1, { syncedRetentionDays: 7 }); clock = 1_000_000;
    for (const id of ["salvo-velho", "salvo-novo", "pend", "conf"]) ok(await s.save(NOTE(id, id, { baseVersion: 1 })));
    await s.reconcile("note", "conf", 5);
    await s.markSynced("note", "salvo-velho", { serverVersion: 2, pushedUpdatedAt: clock });
    clock += 8 * 86_400_000;
    await s.markSynced("note", "salvo-novo", { serverVersion: 2, pushedUpdatedAt: 1_000_000 });
    expect(await s.cleanup()).toBe(1);
    expect((await s.list()).map(d => d.entityId).sort()).toEqual(["conf", "pend", "salvo-novo"]);
    clock += 30 * 86_400_000; await s.cleanup(); expect((await s.list()).map(d => d.entityId).sort()).toEqual(["conf", "pend"]);
  });
});

describe("falhas de armazenamento", () => {
  it("cota excedida ao gravar: avisa, mantém o rascunho anterior intacto e não lança", async () => {
    let falha = false;
    const b = memoryBackend({ failPut: () => (falha ? Object.assign(new DraftStorageError("quota", "cheio"), {}) : null) });
    const s = store(b); ok(await s.save(NOTE("n1", "versão boa", { baseVersion: 1 }))); falha = true;
    const r = await s.save(NOTE("n1", "versão nova"));
    expect(r).toMatchObject({ ok: false, reason: "quota" }); falha = false;
    expect((await s.get("note", "n1"))!.content).toBe("versão boa");
  });
  it("erro genérico do armazenamento vira resultado, não exceção", async () => {
    const b = memoryBackend({ failPut: () => new Error("disco falhou") });
    expect(await store(b).save(NOTE("n1"))).toMatchObject({ ok: false, reason: "armazenamento" });
  });
  it("sem IndexedDB ou bloqueado (navegação privada): cai para memória, avisa e continua funcionando", async () => {
    const sem = await openBackend(undefined as unknown as IDBFactory);                           // factory ausente → usa o global; em Node/jsdom não há
    if (sem.problem) { expect(sem.backend.persistent).toBe(false); expect(sem.problem).toBeInstanceOf(DraftStorageError); }
    const bloqueado = { open() { throw Object.assign(new Error("denied"), { name: "SecurityError" }); } } as unknown as IDBFactory;
    const r = await openBackend(bloqueado);
    expect(r.problem).toMatchObject({ code: "bloqueado" }); expect(r.backend.persistent).toBe(false);
    const s = store(r.backend); ok(await s.save(NOTE("n1")));
    const u = await s.usage(); expect(u.persistent).toBe(false);
  });
  it("openIdbBackend sem IndexedDB falha com 'indisponivel'", async () => {
    const original = Object.getOwnPropertyDescriptor(globalThis, "indexedDB"); Object.defineProperty(globalThis, "indexedDB", { value: undefined, configurable: true });
    try { await expect(openIdbBackend()).rejects.toMatchObject({ code: "indisponivel" }); }
    finally { if (original) Object.defineProperty(globalThis, "indexedDB", original); else delete (globalThis as { indexedDB?: unknown }).indexedDB; }
  });
});

describe("segredos nunca vão para o armazenamento local", () => {
  it("recusa tokens, JWTs de sessão/serviço, chaves secretas e campos de senha; texto comum passa", async () => {
    const jwt = (p: object) => `eyJhbGciOiJIUzI1NiJ9.${btoa(JSON.stringify(p)).replace(/=/g, "")}.assinatura123`;
    const s = store(memoryBackend());
    for (const ruim of [{ access_token: "abc" }, { refresh_token: "x" }, { password: "123" }, { senha: "123" }, { apiKey: "1", api_key: "2" }, SB, { x: jwt({ role: SR }) }, { x: jwt({ sub: "u", exp: 1 }) }, `o ${SR} vazou`])
      expect(await s.save(NOTE("n1", ruim)), JSON.stringify(ruim).slice(0, 40)).toMatchObject({ ok: false, reason: "segredo" });
    expect(await s.save({ ...NOTE("n2"), title: SB })).toMatchObject({ ok: false, reason: "segredo" });
    ok(await s.save(NOTE("n3", [{ type: "paragraph", content: "A senha do cofre é azul; token de acesso é só uma palavra." }])));
    expect(containsSecret("texto normal")).toBe(false);
    expect(await s.list()).toHaveLength(1);
  });
});

describe("exportação manual", () => {
  it("exporta só pendentes e conflitos, sem id de conta nem chaves internas", async () => {
    const s = store(memoryBackend()); ok(await s.save(NOTE("p", "pendente", { title: "T", baseVersion: 1 }))); ok(await s.save(NOTE("c", "em conflito", { baseVersion: 1 }))); await s.reconcile("note", "c", 4);
    ok(await s.save(NOTE("s", "salvo", { baseVersion: 1 }))); await s.markSynced("note", "s", { serverVersion: 2, pushedUpdatedAt: clock });
    const e = await s.exportPending(); expect(e.count).toBe(2);
    const j = JSON.parse(e.json);
    expect(j).toMatchObject({ formato: "compendio-rascunhos", versao: 1, campanha: C1 });
    expect(j.rascunhos.map((r: { entityId: string }) => r.entityId).sort()).toEqual(["c", "p"]);
    expect(e.json).not.toContain(U1); expect(e.json).not.toMatch(/"key"|"scope"|"userId"/);
    expect(e.bytes).toBe(new TextEncoder().encode(e.json).length);
  });
});

describe("envio dos pendentes (contrato; adaptadores falsos, sem Supabase)", () => {
  const seed = async (s: ReturnType<typeof store>) => { for (const id of ["a", "b", "c"]) { clock += 1; ok(await s.save(NOTE(id, id, { baseVersion: 1 }))); } };
  it("envia em ordem, marca como salvo e devolve o resumo", async () => {
    const s = store(memoryBackend()); await seed(s); const visto: string[] = [];
    const adapter: SyncAdapter = { async push(d) { visto.push(d.entityId); return { ok: true, serverVersion: 2 }; } };
    const r = await flushPending(s, adapter);
    expect(r).toEqual({ enviados: 3, conflitos: 0, pendentes: 0, parouOffline: false, erros: 0 }); expect(visto.sort()).toEqual(["a", "b", "c"]);
    expect((await s.list()).every(d => d.status === "synced" && d.baseVersion === 2)).toBe(true);
  });
  it("conflito do servidor: marca conflito, não sobrescreve, e segue com os demais", async () => {
    const s = store(memoryBackend()); await seed(s);
    const r = await flushPending(s, { async push(d) { return d.entityId === "b" ? { ok: false, reason: "conflito", serverVersion: 7 } : { ok: true, serverVersion: 2 }; } });
    expect(r).toMatchObject({ enviados: 2, conflitos: 1, pendentes: 0 });
    expect(await s.get("note", "b")).toMatchObject({ status: "conflict", serverVersionSeen: 7, content: "b" });
    expect(await s.pending()).toEqual([]);
  });
  it("offline interrompe o envio e mantém tudo pendente; erro de rede também não perde nada", async () => {
    const s = store(memoryBackend()); await seed(s);
    const r = await flushPending(s, { async push(d) { return d.entityId === "b" ? { ok: false, reason: "offline" } : { ok: true, serverVersion: 2 }; } });
    expect(r).toMatchObject({ enviados: 1, parouOffline: true, pendentes: 2 });
    const r2 = await flushPending(s, { async push() { throw new Error("rede"); } });
    expect(r2).toMatchObject({ enviados: 0, erros: 2, pendentes: 2 });
    expect(await flushPending(s, { async push() { return { ok: true, serverVersion: 3 }; } }, { online: () => false })).toMatchObject({ enviados: 0, parouOffline: true, pendentes: 2 });
  });
  it("edição feita durante o envio continua pendente; só o escopo do usuário atual é enviado", async () => {
    const backend = memoryBackend(), s = store(backend), outro = store(backend, U2); await seed(s); ok(await outro.save(NOTE("z", "da Bia", { baseVersion: 1 })));
    const enviados: string[] = [];
    await flushPending(s, { async push(d) { enviados.push(d.entityId); if (d.entityId === "a") { clock += 5; ok(await s.save(NOTE("a", "editado no meio do envio"))); } return { ok: true, serverVersion: 2 }; } });
    expect(enviados).not.toContain("z"); expect(await outro.pending()).toHaveLength(1);
    expect(await s.get("note", "a")).toMatchObject({ status: "pending", content: "editado no meio do envio", baseVersion: 2 });
  });
});

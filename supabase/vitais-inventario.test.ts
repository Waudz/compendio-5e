// Migração 0014 (PROPOSTA) em PostgreSQL em memória (PGlite), com papéis `anon`/`authenticated` e `auth.uid()` simulado. Dados FICTÍCIOS.
// Não é o Supabase hospedado: a 0014 não foi aplicada lá.
import { randomUUID } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { beforeAll, describe, expect, it } from "vitest";
import { storageStub } from "./stub-storage";

const dir = join(__dirname, "migrations");
const U = { ana: "00000000-0000-0000-0000-00000000000a", bia: "00000000-0000-0000-0000-00000000000b", caio: "00000000-0000-0000-0000-00000000000c", dora: "00000000-0000-0000-0000-00000000000d" };
const stub = `
create role anon nologin; create role authenticated nologin;
create schema auth;
create table auth.users (id uuid primary key default gen_random_uuid(), email text);
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
grant usage on schema auth to anon, authenticated; grant execute on function auth.uid() to anon, authenticated;
grant usage on schema public to anon, authenticated;
alter default privileges in schema public grant all on tables to anon, authenticated;
alter default privileges in schema public grant all on functions to anon, authenticated;
` + storageStub;
type R = { rows: Record<string, unknown>[]; error?: string };
async function as(db: PGlite, uid: string | null, q: string, params: unknown[] = []): Promise<R> {
  await db.exec(`set role ${uid ? "authenticated" : "anon"}; select set_config('request.jwt.claim.sub', '${uid ?? ""}', false);`);
  try { return { rows: (await db.query<Record<string, unknown>>(q, params)).rows }; }
  catch (e) { return { rows: [], error: (e as Error).message }; }
  finally { await db.exec("reset role"); }
}
async function boot(): Promise<PGlite> {
  const db = new PGlite(); await db.exec(stub);
  for (const f of readdirSync(dir).filter(f => f.endsWith(".sql")).sort()) await db.exec(readFileSync(join(dir, f), "utf8"));
  for (const [n, id] of Object.entries(U)) await db.query("insert into auth.users (id, email) values ($1, $2)", [id, `${n}@exemplo.com`]);
  return db;
}
const rpc = (db: PGlite, uid: string, fn: string, ...a: unknown[]) => as(db, uid, `select public.${fn}(${a.map((_, i) => `$${i + 1}`).join(",")}) as r`, a);
async function mesa(db: PGlite, mestre: string, jogadores: string[]) {
  const cid = (await rpc(db, mestre, "create_campaign", "Mesa", "")).rows[0].r as string;
  const codigo = (await rpc(db, mestre, "create_invite", cid, 10, 7)).rows[0].r as string;
  for (const u of jogadores) await rpc(db, u, "join_campaign", codigo);
  return cid;
}
const item = (id: string, itemId: string, quantity = 1, equipped = false) => ({ id, itemId, quantity, equipped, origin: "acquired" });
const real = { mode: "real" };
const meta = { identidadePublica: { settings: { imageUrl: null, title: "", name: real, surname: real, race: real, characterClass: real, level: real, description: "" }, card: { imageUrl: null, title: "", name: "x", surname: null, race: "x", characterClass: "x", level: "1", description: "" } } };

let db: PGlite, C: string, OUTRA: string;
async function criar(uid: string, extra: Record<string, unknown> = {}, campanha = C) {
  const draft = { id: "p", name: "Thorin", level: 3, publicLabels: { race: "Anão", characterClass: "Guerreiro" }, inventory: [], currentHp: 20, temporaryHp: 0, ...extra };
  const r = await as(db, uid, "select * from public.create_guided_character($1, 'x', $2::jsonb, false, $3::jsonb)", [campanha, JSON.stringify(meta), JSON.stringify(draft)]);
  if (r.error) throw new Error(r.error);
  return r.rows[0].character_id as string;
}
type Item = ReturnType<typeof item> & Record<string, unknown>;
type Draft = { name: string; currentHp: number; temporaryHp: number; inventory: Item[]; play?: { condicoes?: string[]; morte?: { sucessos: number; falhas: number }; historico?: { texto: string; itemId?: string }[]; concedidos?: Record<string, unknown>[] } };
const ler = async (id: string) => (await db.query<{ draft: Draft; revision: number; vitals_version: string }>("select draft, revision, vitals_version from public.character_sheets where character_id = $1", [id])).rows[0];
type Estado = { pv: number; temp: number; condicoes: string[]; morte: { sucessos: number; falhas: number }; versao: number; revision: number; draft?: Draft };
const vital = (uid: string, id: string, acao: unknown, op: string = randomUUID()) => as(db, uid, "select public.alterar_vitais($1, $2::jsonb, $3::uuid) as r", [id, JSON.stringify(acao), op]);
const estado = (r: R) => { if (r.error) throw new Error(r.error); return r.rows[0].r as Estado; };
const usar = (uid: string, id: string, inst: string, cura: number, max: number, op: string = randomUUID()) => as(db, uid, "select public.usar_consumivel($1, $2, $3, $4, $5::uuid) as r", [id, inst, cura, max, op]);
const transferir = (uid: string, de: string, para: string, inst: string, q: number, op: string = randomUUID()) => as(db, uid, "select public.transferir_item($1, $2, $3, $4, $5::uuid) as r", [de, para, inst, q, op]);
const salvar = (uid: string, id: string, revisao: number, draft: unknown) => as(db, uid, "select * from public.save_guided_character($1, $2, $3::jsonb)", [id, revisao, JSON.stringify(draft)]);

beforeAll(async () => { db = await boot(); C = await mesa(db, U.ana, [U.bia, U.caio]); OUTRA = await mesa(db, U.dora, [U.caio]); });

describe("estado vital: uma fonte, operações atômicas", () => {
  it("dano consome os temporários, a cura para no máximo, condições e morte ficam na ficha, sem avançar a revisão", async () => {
    const id = await criar(U.bia);
    expect(estado(await vital(U.bia, id, { tipo: "temporarios", valor: 5 }))).toMatchObject({ pv: 20, temp: 5, revision: 1, versao: 2 });
    expect(estado(await vital(U.ana, id, { tipo: "dano", valor: 8 }))).toMatchObject({ pv: 17, temp: 0, revision: 1, versao: 3 });
    expect(estado(await vital(U.bia, id, { tipo: "cura", valor: 100, maximo: 24 }))).toMatchObject({ pv: 24 });
    expect(estado(await vital(U.ana, id, { tipo: "dano", valor: 99 }))).toMatchObject({ pv: 0 });
    estado(await vital(U.bia, id, { tipo: "morte", sucessos: 2, falhas: 1 }));
    expect(estado(await vital(U.ana, id, { tipo: "cura", valor: 3, maximo: 24 }))).toMatchObject({ pv: 3, morte: { sucessos: 0, falhas: 0 } });
    estado(await vital(U.ana, id, { tipo: "condicao", nome: "Caído", ativa: true }));
    estado(await vital(U.bia, id, { tipo: "condicao", nome: "Envenenado", ativa: true }));
    expect(estado(await vital(U.ana, id, { tipo: "condicao", nome: "Caído", ativa: false })).condicoes).toEqual(["Envenenado"]);
    expect(estado(await vital(U.bia, id, { tipo: "ajustar", valor: 6, maximo: 30 }))).toMatchObject({ pv: 9 });
    expect(estado(await vital(U.bia, id, { tipo: "definir", valor: 50, maximo: 30 }))).toMatchObject({ pv: 30 });
    estado(await vital(U.bia, id, { tipo: "temporarios", valor: 4 }));
    expect(estado(await vital(U.bia, id, { tipo: "descanso", maximo: 30 }))).toMatchObject({ pv: 30, temp: 0 });
    const f = await ler(id);
    expect(f.draft).toMatchObject({ currentHp: 30, temporaryHp: 0, play: { condicoes: ["Envenenado"] } });
    expect(f.revision).toBe(1);
  });

  it("repetir a mesma operação não aplica duas vezes", async () => {
    const id = await criar(U.bia), op = randomUUID();
    expect(estado(await vital(U.bia, id, { tipo: "dano", valor: 4 }, op)).pv).toBe(16);
    expect(estado(await vital(U.bia, id, { tipo: "dano", valor: 4 }, op)).pv).toBe(16);
  });

  it("uma cópia antiga da ficha inteira não sobrescreve PV, temporários, condições nem morte, nem pela tabela", async () => {
    const id = await criar(U.bia, { play: { inspiracao: false } });
    const antiga = await ler(id);
    estado(await vital(U.ana, id, { tipo: "dano", valor: 7 }));
    estado(await vital(U.ana, id, { tipo: "condicao", nome: "Atordoado", ativa: true }));
    const g = await salvar(U.bia, id, antiga.revision, { ...antiga.draft, name: "Thorin II", currentHp: 20, temporaryHp: 50, play: { inspiracao: true, condicoes: [] } });
    expect(g.error).toBeUndefined();   // a operação vital não gerou conflito de revisão
    expect((await ler(id)).draft).toMatchObject({ name: "Thorin II", currentHp: 13, temporaryHp: 0, play: { inspiracao: true, condicoes: ["Atordoado"] } });
    expect((await as(db, U.bia, "update public.character_sheets set draft = jsonb_set(draft, '{currentHp}', '999') where character_id = $1", [id])).error).toBeUndefined();
    expect((await ler(id)).draft.currentHp).toBe(13);
    expect((await as(db, U.bia, "update public.character_sheets set vitals_version = 999 where character_id = $1", [id])).error).toMatch(/permission denied/);
  });

  it("só o dono participante e o mestre da campanha operam; entradas inválidas são recusadas", async () => {
    const id = await criar(U.bia);
    for (const u of [U.caio, U.dora]) expect((await vital(u, id, { tipo: "dano", valor: 1 })).error).toMatch(/ficha_nao_encontrada/);
    expect((await as(db, null, "select public.alterar_vitais($1, '{\"tipo\":\"dano\",\"valor\":1}', $2::uuid)", [id, randomUUID()])).error).toMatch(/permission denied/);
    for (const ruim of [{ tipo: "dano", valor: -5 }, { tipo: "cura", valor: 5 }, { tipo: "temporarios", valor: 5000 }, { tipo: "dano", valor: "9" }, { tipo: "zerar" }, { tipo: "condicao", nome: "", ativa: true }])
      expect((await vital(U.bia, id, ruim)).error, JSON.stringify(ruim)).toMatch(/operacao_invalida/);
    for (const q of ["select * from private_ficha.operacao", "insert into private_ficha.operacao values (txid_current(), gen_random_uuid(), 'transferencia')", "select private_ficha.travar(gen_random_uuid())"])
      expect((await as(db, U.bia, q)).error, q).toMatch(/permission denied/);
    expect((await ler(id)).draft.currentHp).toBe(20);
  });
});

describe("consumo atômico", () => {
  it("baixa uma unidade, cura até o máximo, registra e não consome duas vezes na mesma operação", async () => {
    const id = await criar(U.bia, { currentHp: 5, inventory: [item("p", "potion-of-healing-common", 2)] });
    const op = randomUUID();
    const r = estado(await usar(U.bia, id, "p", 7, 24, op));
    expect(r.pv).toBe(12); expect(r.revision).toBe(2);
    expect(r.draft!.inventory).toEqual([item("p", "potion-of-healing-common", 1)]);
    expect(r.draft!.play!.historico![0]).toMatchObject({ texto: "Usou {item}: +7 PV", itemId: "potion-of-healing-common" });
    expect(estado(await usar(U.bia, id, "p", 7, 24, op)).pv).toBe(12);
    expect(estado(await usar(U.ana, id, "p", 100, 24)).pv).toBe(24);
    expect((await ler(id)).draft.inventory).toEqual([]);
    expect((await usar(U.bia, id, "p", 7, 24)).error).toMatch(/item_inexistente/);
    expect((await usar(U.caio, id, "p", 7, 24)).error).toMatch(/ficha_nao_encontrada/);
  });
  it("uma gravação antiga depois do consumo é recusada (o item não volta)", async () => {
    const id = await criar(U.bia, { inventory: [item("p", "potion-of-healing-common", 1)] });
    const antiga = await ler(id);
    estado(await usar(U.bia, id, "p", 0, 24));
    expect((await salvar(U.bia, id, antiga.revision, antiga.draft)).error).toMatch(/conflito_de_revisao/);
  });
});

describe("transferência atômica", () => {
  it("move parte ou tudo, preserva os dados da instância e as concessões presas, e registra nos dois lados", async () => {
    const de = await criar(U.bia, { inventory: [item("a", "arrow", 20)] });
    const para = await criar(U.caio, { name: "Lydia" });
    // o mestre entrega um item restrito, com uma magia presa a ele
    const f = await ler(de);
    const anel = { ...item("anel", "ring-of-protection", 1, true), customName: "Anel do pai", identificado: false };
    const concedida = { id: "g", tipo: "magia", nome: "Luz", origem: "Anel", itemInstancia: "anel" };
    expect((await salvar(U.ana, de, f.revision, { ...f.draft, inventory: [...f.draft.inventory, anel], play: { concedidos: [concedida] } })).error).toBeUndefined();

    const r = estado(await transferir(U.bia, de, para, "a", 5));
    expect(r.draft!.inventory.find(i => i.id === "a")!.quantity).toBe(15);
    const recebidas = (await ler(para)).draft.inventory;
    expect(recebidas).toHaveLength(1); expect(recebidas[0]).toMatchObject({ itemId: "arrow", quantity: 5, equipped: false });

    const op = randomUUID();
    estado(await transferir(U.bia, de, para, "anel", 1, op));
    estado(await transferir(U.bia, de, para, "anel", 1, op));   // repetida: nada duplica
    const origem = await ler(de), destino = await ler(para);
    expect(origem.draft.inventory.map(i => i.id)).toEqual(["a"]);
    expect(origem.draft.play!.concedidos).toEqual([]);
    expect(destino.draft.inventory.filter(i => i.itemId === "ring-of-protection")).toEqual([{ ...anel, equipped: false }]);
    expect(destino.draft.play!.concedidos).toEqual([concedida]);
    expect(destino.draft.play!.historico![0]).toMatchObject({ texto: "Recebeu 1× {item} de Thorin", itemId: "ring-of-protection" });
    expect(origem.draft.play!.historico![0].texto).toBe("Enviou 1× {item} para Lydia");
    // o destinatário pode usar o item recebido (a guarda passa a reconhecê-lo), mas não multiplicá-lo
    expect((await salvar(U.caio, para, destino.revision, { ...destino.draft, inventory: destino.draft.inventory.map(i => i.id === "anel" ? { ...i, equipped: true } : i) })).error).toBeUndefined();
    const d2 = await ler(para);
    expect((await salvar(U.caio, para, d2.revision, { ...d2.draft, inventory: d2.draft.inventory.map(i => i.id === "anel" ? { ...i, quantity: 2 } : i) })).error).toMatch(/item_nao_autorizado/);
  });

  it("recusa quantidade inválida, si mesmo, outra campanha, ficha alheia e quem não participa; nada muda", async () => {
    const de = await criar(U.bia, { inventory: [item("a", "arrow", 3)] });
    const para = await criar(U.caio);
    const fora = await criar(U.caio, {}, OUTRA);
    const antes = await ler(de);
    expect((await transferir(U.bia, de, para, "a", 4)).error).toMatch(/quantidade_invalida/);
    for (const q of [0, -1]) expect((await transferir(U.bia, de, para, "a", q)).error).toMatch(/operacao_invalida/);
    expect((await transferir(U.bia, de, de, "a", 1)).error).toMatch(/operacao_invalida/);
    expect((await transferir(U.bia, de, fora, "a", 1)).error).toMatch(/destino_invalido/);
    expect((await transferir(U.bia, de, para, "zzz", 1)).error).toMatch(/item_inexistente/);
    expect((await transferir(U.caio, de, para, "a", 1)).error).toMatch(/ficha_nao_encontrada/);   // não tira item de ficha alheia
    expect((await transferir(U.dora, de, fora, "a", 1)).error).toMatch(/ficha_nao_encontrada/);
    expect(await ler(de)).toEqual(antes);
    // o remetente não lê a ficha do destinatário, antes nem depois
    estado(await transferir(U.bia, de, para, "a", 1));
    expect((await as(db, U.bia, "select draft from public.character_sheets where character_id = $1", [para])).rows).toEqual([]);
  });
});

describe("reversão", () => {
  it("a 0014 reverte e reaplica sem apagar fichas", async () => {
    const base = await boot();
    const cid = await mesa(base, U.ana, [U.bia]);
    await as(base, U.bia, "select * from public.create_guided_character($1, 'x', $2::jsonb, false, $3::jsonb)", [cid, JSON.stringify(meta), JSON.stringify({ id: "p", name: "N", level: 1, inventory: [], currentHp: 7, temporaryHp: 0 })]);
    const antes = (await base.query("select draft, revision from public.character_sheets")).rows;
    await base.exec(readFileSync(join(__dirname, "rollback", "0014_vitais_inventario_atomicos_down.sql"), "utf8"));
    expect((await base.query("select draft, revision from public.character_sheets")).rows).toEqual(antes);
    expect((await base.query("select to_regprocedure('public.alterar_vitais(uuid, jsonb, uuid)') as f")).rows).toEqual([{ f: null }]);
    await base.exec(readFileSync(join(dir, "0014_vitais_inventario_atomicos.sql"), "utf8"));
    expect((await base.query("select draft, revision from public.character_sheets")).rows).toEqual(antes);
  });
});

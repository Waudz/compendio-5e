// Sincronização autorizada de PV e condições do combate com a ficha (migração 0011) em PostgreSQL em memória (PGlite). Dados FICTÍCIOS; não é o Supabase hospedado.
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { beforeAll, describe, expect, it } from "vitest";
import { storageStub } from "./stub-storage";

const dir = join(__dirname, "migrations");
const U = { ana: "00000000-0000-0000-0000-00000000000a", bia: "00000000-0000-0000-0000-00000000000b", caio: "00000000-0000-0000-0000-00000000000c", dora: "00000000-0000-0000-0000-00000000000d" };
const stub = `
create role anon nologin; create role authenticated nologin; create schema auth;
create table auth.users (id uuid primary key default gen_random_uuid(), email text);
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
grant usage on schema auth to anon, authenticated; grant execute on function auth.uid() to anon, authenticated; grant usage on schema public to anon, authenticated;
alter default privileges in schema public grant all on tables to anon, authenticated; alter default privileges in schema public grant all on functions to anon, authenticated;
` + storageStub;
type R = { rows: Record<string, unknown>[]; error?: string };
let db: PGlite, C1: string, ficha: string;
async function as(uid: string | null, q: string, params: unknown[] = []): Promise<R> {
  await db.exec(`set role ${uid ? "authenticated" : "anon"}; select set_config('request.jwt.claim.sub', '${uid ?? ""}', false);`);
  try { return { rows: (await db.query<Record<string, unknown>>(q, params)).rows }; } catch (e) { return { rows: [], error: (e as Error).message }; } finally { await db.exec("reset role"); }
}
const rpc = (uid: string | null, fn: string, ...a: unknown[]) => as(uid, `select public.${fn}(${a.map((_, i) => `$${i + 1}`).join(",")}) as r`, a);
const definir = (uid: string | null, hp: number | null, max: number | null, cond: unknown[] = [], id = ficha) => rpc(uid, "set_combat_status", id, hp, max, JSON.stringify(cond));
const status = (uid: string | null) => as(uid, "select character_id, current_hp, max_hp, conditions, version from public.character_combat_status");
const identidade = { settings: { imageUrl: null, title: "O Escudo", name: { mode: "real" }, surname: { mode: "hidden" }, race: { mode: "hidden" }, characterClass: { mode: "hidden" }, description: "" },
  card: { imageUrl: null, title: "O Escudo", name: "Thorin", surname: null, race: null, characterClass: null, description: "" } };

beforeAll(async () => {
  db = new PGlite(); await db.exec(stub);
  for (const f of readdirSync(dir).filter(f => f.endsWith(".sql")).sort()) await db.exec(readFileSync(join(dir, f), "utf8"));
  for (const [n, id] of Object.entries(U)) await db.query("insert into auth.users (id, email) values ($1, $2)", [id, `${n}@exemplo.com`]);
  C1 = (await rpc(U.ana, "create_campaign", "Mesa 1", "")).rows[0].r as string;   // mestre: ana
  const cod = (await rpc(U.ana, "create_invite", C1, 10, 7)).rows[0].r as string;
  for (const u of [U.bia, U.caio]) await rpc(u, "join_campaign", cod);
  await rpc(U.dora, "create_campaign", "Mesa de fora", "");   // dora: mestre de outra campanha
  const r = await as(U.bia, "select * from public.create_guided_character($1, 'O Escudo', $2::jsonb, false, $3::jsonb)", [C1, JSON.stringify({ identidadePublica: identidade }), JSON.stringify({ id: "x", name: "Thorin", level: 1, currentHp: 12, inventory: [] })]);
  if (r.error) throw new Error(r.error);
  ficha = (r.rows[0] as { character_id: string }).character_id;
});

describe("0011 — status de combate na ficha", () => {
  it("o mestre grava PV e condições; cada gravação avança a versão", async () => {
    expect((await definir(U.ana, 9, 12, ["Caído"])).rows[0].r).toBe(1);
    expect((await definir(U.ana, 5, 12, ["Caído", "Cego"])).rows[0].r).toBe(2);
    expect((await status(U.ana)).rows[0]).toMatchObject({ current_hp: 5, max_hp: 12, conditions: ["Caído", "Cego"], version: 2 });
  });
  it("o dono vê o status da própria ficha e NADA do combate; outro jogador, mestre de outra campanha e anon não veem", async () => {
    expect((await status(U.bia)).rows).toHaveLength(1);
    for (const u of [U.caio, U.dora]) expect((await status(u)).rows).toEqual([]);
    expect((await status(null)).error).toMatch(/permission denied/);
    expect((await as(U.bia, "select * from public.campaign_combats")).rows).toEqual([]);
    expect(Object.keys((await status(U.bia)).rows[0]).sort()).toEqual(["character_id", "conditions", "current_hp", "max_hp", "version"]);
  });
  it("jogador (nem o dono), mestre de outra campanha, anon e ficha inexistente NÃO gravam", async () => {
    for (const u of [U.bia, U.caio, U.dora]) expect((await definir(u, 1, 12)).error, String(u)).toMatch(/apenas_mestre/);
    expect((await definir(null, 1, 12)).error).toMatch(/permission denied/);
    expect((await definir(U.ana, 1, 12, [], "00000000-0000-0000-0000-0000000000ff")).error).toMatch(/ficha_inexistente/);
  });
  it("ninguém escreve direto na tabela (nem o mestre)", async () => {
    for (const u of [U.ana, U.bia]) for (const q of ["insert into public.character_combat_status(character_id,campaign_id,conditions) values (gen_random_uuid(), gen_random_uuid(), '[]')", "update public.character_combat_status set current_hp = 99", "delete from public.character_combat_status"])
      expect((await as(u, q)).error, q).toMatch(/permission denied/);
  });
  it.each([[13, 12, []], [-1, 12, []], [5, null, []], [null, 12, []], [5, 0, []], [5, 12, Array.from({ length: 17 }, (_, i) => `c${i}`)], [5, 12, [""]], [5, 12, ["x".repeat(41)]], [5, 12, [1]]])("valida no servidor: hp=%s max=%s condições=%j", async (hp, max, cond) => {
    expect((await definir(U.ana, hp as number | null, max as number | null, cond as unknown[])).error).toBeTruthy();
  });
  it("só condições (sem PV) é válido", async () => { expect((await definir(U.ana, null, null, ["Envenenado"])).error).toBeUndefined(); });
  it("o status não altera a ficha nem sua revisão (não conflita com a edição pelo dono)", async () => {
    const antes = (await as(U.bia, "select revision, draft from public.character_sheets where character_id=$1", [ficha])).rows[0];
    await definir(U.ana, 3, 12, ["Caído"]);
    expect((await as(U.bia, "select revision, draft from public.character_sheets where character_id=$1", [ficha])).rows[0]).toEqual(antes);
  });
  it("finalizar: só o mestre da campanha limpa os status; os demais são recusados", async () => {
    for (const u of [U.bia, U.dora]) expect((await rpc(u, "clear_combat_status", C1)).error).toMatch(/apenas_mestre/);
    expect((await status(U.bia)).rows).toHaveLength(1);
    expect((await rpc(U.ana, "clear_combat_status", C1)).rows[0].r).toBe(1);
    expect((await status(U.bia)).rows).toEqual([]);
  });
  it("sair da campanha tira o acesso do dono ao status", async () => {
    await definir(U.ana, 4, 12, []);
    await db.exec("alter table public.campaign_members disable trigger user");
    await db.query("delete from public.campaign_members where campaign_id=$1 and user_id=$2", [C1, U.bia]);
    expect((await status(U.bia)).rows).toEqual([]);
    await db.exec("alter table public.campaign_members enable trigger user");
  });
});

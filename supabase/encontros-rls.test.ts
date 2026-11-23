// PostgreSQL em memória, sem URL, token ou conexão com o projeto hospedado.
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

let db: PGlite;
const uid = (n: number) => `00000000-0000-0000-0000-${String(n).padStart(12, "0")}`;
const mestreA = uid(1), jogadorA = uid(2), mestreB = uid(3), estranho = uid(4), a = uid(10), b = uid(11);
const estado = { encontros: [] as unknown[] };
const enc = (id: string, p: unknown[] = []) => ({ id, nome: "Emboscada", participantes: p });
async function como(user: string | null, sql: string, params: unknown[] = []) {
  await db.exec(`set role ${user ? "authenticated" : "anon"}`);
  await db.query("select set_config('request.jwt.claim.sub', $1, false)", [user ?? ""]);
  try { return { rows: (await db.query(sql, params)).rows, error: undefined as string | undefined }; }
  catch (e) { return { rows: [], error: (e as Error).message }; }
  finally { await db.exec("reset role"); }
}
beforeAll(async () => {
  db = new PGlite();
  await db.exec(`
    create role anon nologin; create role authenticated nologin;
    create schema auth;
    create table auth.users (id uuid primary key, email text);
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    grant usage on schema auth, public to anon, authenticated;
    grant execute on function auth.uid() to anon, authenticated;
    alter default privileges in schema public grant all on tables to anon, authenticated;
    alter default privileges in schema public grant all on functions to anon, authenticated;
  `);
  for (const prefixo of ["0001", "0002", "0003"]) {
    // Usa as funções reais de autorização do repositório, sem mock de is_master.
    const real = readdirSync(join(__dirname, "migrations")).find(n => n.startsWith(prefixo) && n.endsWith(".sql"))!;
    await db.exec(readFileSync(join(__dirname, "migrations", real), "utf8"));
  }
  for (let i = 1; i <= 4; i++) await db.query("insert into auth.users values ($1,$2)", [uid(i), `teste${i}@example.invalid`]);
  await db.query("insert into public.campaigns(id,name,created_by) values ($1,'A',$2),($3,'B',$4)", [a, mestreA, b, mestreB]);
  await db.query("insert into public.campaign_members(campaign_id,user_id,role) values ($1,$2,'mestre'),($1,$3,'jogador'),($4,$5,'mestre')", [a, mestreA, jogadorA, b, mestreB]);
  await db.exec(readFileSync(join(__dirname, "migrations/0009_campaign_combats.sql"), "utf8"));   // cria o schema private_combates
  await db.exec(readFileSync(join(__dirname, "migrations/0010_campaign_encounters.sql"), "utf8"));
});
beforeEach(async () => {
  await db.exec("truncate public.campaign_encounters");   // apenas PGlite descartável
  await db.query("insert into public.campaign_encounters(campaign_id,state) values ($1,$2),($3,$2)", [a, estado, b]);
});
afterAll(async () => { await db?.close(); });

describe("encontros preparados — RLS real em PostgreSQL isolado", () => {
  it("mestre lê e atualiza apenas a sua campanha", async () => {
    expect((await como(mestreA, "select campaign_id from public.campaign_encounters")).rows).toEqual([{ campaign_id: a }]);
    expect((await como(mestreB, "select campaign_id from public.campaign_encounters")).rows).toEqual([{ campaign_id: b }]);
    const novo = { encontros: [enc("e1", [{ id: "p1", nome: "Goblin", quantidade: 2, pv: 7, ref: { tipo: "monstro", id: "goblin" } }])] };
    expect((await como(mestreA, "update public.campaign_encounters set state=$2,version=2 where campaign_id=$1 and version=1 returning version", [a, novo])).rows).toEqual([{ version: 2 }]);
  });
  it.each([jogadorA, mestreB, estranho])("nega leitura, alteração e inserção a quem não é o mestre da campanha: %s", async user => {
    expect((await como(user, "select state from public.campaign_encounters where campaign_id=$1", [a])).rows).toEqual([]);
    expect((await como(user, "update public.campaign_encounters set version=2 where campaign_id=$1 returning campaign_id", [a])).rows).toEqual([]);
    await db.query("delete from public.campaign_encounters where campaign_id=$1", [a]);
    expect((await como(user, "insert into public.campaign_encounters(campaign_id) values($1)", [a])).error).toMatch(/row-level security/);
  });
  it("anon não tem acesso", async () => {
    for (const sql of ["select * from public.campaign_encounters", "update public.campaign_encounters set version=2", "delete from public.campaign_encounters"])
      expect((await como(null, sql)).error).toMatch(/permission denied/);
  });
  it("ninguém exclui pela Data API (nem o mestre): encontros sobrevivem à finalização do combate", async () => {
    expect((await como(mestreA, "delete from public.campaign_encounters where campaign_id=$1", [a])).error).toMatch(/permission denied/);
    expect((await como(mestreA, "select version from public.campaign_encounters where campaign_id=$1", [a])).rows).toEqual([{ version: 1 }]);
  });
  it("gravação condicionada antiga não sobrescreve a nova; a versão avança exatamente 1", async () => {
    const sql = "update public.campaign_encounters set version=2,state=$2 where campaign_id=$1 and version=1 returning version";
    expect((await como(mestreA, sql, [a, { encontros: [enc("e1")] }])).rows).toEqual([{ version: 2 }]);
    expect((await como(mestreA, sql, [a, estado])).rows).toEqual([]);
    for (const v of [1, 2, 4]) expect((await como(mestreA, "update public.campaign_encounters set version=$2 where campaign_id=$1", [a, v])).error).toBeTruthy();
  });
  it("não permite trocar campanha nem timestamps", async () => {
    for (const sql of ["update public.campaign_encounters set campaign_id=$1", "update public.campaign_encounters set created_at=now() where campaign_id=$1"])
      expect((await como(mestreA, sql, [a])).error).toMatch(/permission denied/);
  });
  it("a participação atual controla o acesso, mesmo para um ex-mestre", async () => {
    await db.exec("alter table public.campaign_members disable trigger user");
    await db.query("delete from public.campaign_members where campaign_id=$1 and user_id=$2", [a, mestreA]);
    expect((await como(mestreA, "select state from public.campaign_encounters where campaign_id=$1", [a])).rows).toEqual([]);
    await db.query("insert into public.campaign_members(campaign_id,user_id,role) values($1,$2,'mestre')", [a, mestreA]);
    await db.exec("alter table public.campaign_members enable trigger user");
    expect((await como(mestreA, "select version from public.campaign_encounters where campaign_id=$1", [a])).rows).toEqual([{ version: 1 }]);
  });
  it.each([
    {}, { encontros: "x" }, { encontros: [{ id: "", nome: "A", participantes: [] }] }, { encontros: [{ id: "e", nome: " ", participantes: [] }] }, { encontros: [{ id: "e", nome: "A" }] },
    { encontros: [enc("e"), enc("e")] },
    { encontros: [enc("e", [{ id: "p", nome: "G", quantidade: 0 }])] }, { encontros: [enc("e", [{ id: "p", nome: "G", quantidade: 51 }])] }, { encontros: [enc("e", [{ id: "p", nome: "G", quantidade: 1.5 }])] },
    { encontros: [enc("e", [{ id: "p", nome: "G", quantidade: 1, pv: 0 }])] }, { encontros: [enc("e", [{ id: "p", nome: "G", quantidade: 1 }, { id: "p", nome: "H", quantidade: 1 }])] },
    { encontros: [enc("e", [{ id: "p", nome: "G", quantidade: 1, ref: { tipo: "carro", id: "x" } }])] }, { encontros: [enc("e", [{ id: "p", nome: "G", quantidade: 1, ref: { tipo: "monstro" } }])] },
  ])("rejeita formato inválido no servidor: %j", async valor => {
    expect((await como(mestreA, "update public.campaign_encounters set state=$2,version=2 where campaign_id=$1", [a, valor])).error).toBeTruthy();
  });
  it("aceita encontro completo com referência a monstro e a personagem", async () => {
    const novo = { encontros: [enc("e1", [{ id: "p1", nome: "Goblin", quantidade: 3, pv: 7, ref: { tipo: "monstro", id: "goblin" } }, { id: "p2", nome: "Lydia", quantidade: 1, ref: { tipo: "personagem", id: "abc" } }])] };
    expect((await como(mestreA, "update public.campaign_encounters set state=$2,version=2 where campaign_id=$1 returning state", [a, novo])).rows).toEqual([{ state: novo }]);
  });
});

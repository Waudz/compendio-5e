// PostgreSQL em memória, sem URL, token ou conexão com o projeto hospedado.
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

let db: PGlite;
const uid = (n: number) => `00000000-0000-0000-0000-${String(n).padStart(12, "0")}`;
const mestreA = uid(1), jogadorA = uid(2), mestreB = uid(3), estranho = uid(4), a = uid(10), b = uid(11);
const estado = { combatentes: [], turno: null, rodada: 1 };
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
    const nomes = readdirSync(join(__dirname, "migrations"));
    const real = nomes.find(n => n.startsWith(prefixo) && n.endsWith(".sql"))!;
    await db.exec(readFileSync(join(__dirname, "migrations", real), "utf8"));
  }
  for (let i = 1; i <= 4; i++) await db.query("insert into auth.users values ($1,$2)", [uid(i), `teste${i}@example.invalid`]);
  await db.query("insert into public.campaigns(id,name,created_by) values ($1,'A',$2),($3,'B',$4)", [a, mestreA, b, mestreB]);
  await db.query("insert into public.campaign_members(campaign_id,user_id,role) values ($1,$2,'mestre'),($1,$3,'jogador'),($4,$5,'mestre')", [a, mestreA, jogadorA, b, mestreB]);
  await db.exec(readFileSync(join(__dirname, "migrations/0009_campaign_combats.sql"), "utf8"));
});
beforeEach(async () => {
  await db.exec("truncate public.campaign_combats"); // apenas PGlite descartável
  await db.query("insert into public.campaign_combats(campaign_id,state) values ($1,$2),($3,$2)", [a, estado, b]);
});
afterAll(async () => { await db?.close(); });

describe("rascunho de combate — RLS real em PostgreSQL isolado", () => {
  it("mestre lê apenas sua campanha e atualiza com retorno", async () => {
    expect((await como(mestreA, "select campaign_id from public.campaign_combats")).rows).toEqual([{ campaign_id: a }]);
    expect((await como(mestreB, "select campaign_id from public.campaign_combats")).rows).toEqual([{ campaign_id: b }]);
    expect((await como(mestreA, "update public.campaign_combats set version=2 where campaign_id=$1 and version=1 returning version", [a])).rows).toEqual([{ version: 2 }]);
  });
  it.each([jogadorA, mestreB, estranho])("nega leitura, contagem, inserção e alteração alheias: %s", async user => {
    expect((await como(user, "select state from public.campaign_combats where campaign_id=$1", [a])).rows).toEqual([]);
    expect((await como(user, "select count(*)::int as n from public.campaign_combats where campaign_id=$1", [a])).rows).toEqual([{ n: 0 }]);
    expect((await como(user, "update public.campaign_combats set version=2 where campaign_id=$1 returning campaign_id", [a])).rows).toEqual([]);
    await db.query("delete from public.campaign_combats where campaign_id=$1", [a]);
    expect((await como(user, "insert into public.campaign_combats(campaign_id) values($1)", [a])).error).toMatch(/row-level security/);
  });
  it("anon não tem grants de leitura nem gravação", async () => {
    for (const sql of ["select * from public.campaign_combats", "update public.campaign_combats set version=2", "delete from public.campaign_combats"])
      expect((await como(null, sql)).error).toMatch(/permission denied/);
    expect((await como(null, "insert into public.campaign_combats(campaign_id) values($1)", [a])).error).toMatch(/permission denied/);
  });
  it("mestre insere com versão 1; segunda criação conflita", async () => {
    await db.query("delete from public.campaign_combats where campaign_id=$1", [a]);
    expect((await como(mestreA, "insert into public.campaign_combats(campaign_id) values($1) returning version", [a])).rows).toEqual([{ version: 1 }]);
    expect((await como(mestreA, "insert into public.campaign_combats(campaign_id) values($1)", [a])).error).toMatch(/duplicate key/);
  });
  it("gravação condicionada antiga não sobrescreve a nova", async () => {
    const sql = "update public.campaign_combats set version=2,state=$2 where campaign_id=$1 and version=1 returning version";
    const novo = { ...estado, rodada: 2 };
    expect((await como(mestreA, sql, [a, novo])).rows).toEqual([{ version: 2 }]);
    expect((await como(mestreA, sql, [a, estado])).rows).toEqual([]);
    expect((await como(mestreA, "select state from public.campaign_combats where campaign_id=$1", [a])).rows).toEqual([{ state: novo }]);
  });
  it("não permite trocar campanha nem timestamps pelo cliente", async () => {
    for (const sql of ["update public.campaign_combats set campaign_id=$1", "update public.campaign_combats set created_at=now() where campaign_id=$1", "update public.campaign_combats set updated_at=now() where campaign_id=$1"])
      expect((await como(mestreA, sql, [a])).error).toMatch(/permission denied/);
  });
  it("somente mestre descarta seu combate na versão esperada; outros não excluem", async () => {
    for (const user of [jogadorA, mestreB, estranho]) {
      expect((await como(user, "delete from public.campaign_combats where campaign_id=$1 and version=1 returning campaign_id", [a])).rows).toEqual([]);
    }
    expect((await como(mestreA, "delete from public.campaign_combats where campaign_id=$1 and version=2 returning campaign_id", [a])).rows).toEqual([]);
    expect((await como(mestreA, "select version from public.campaign_combats where campaign_id=$1", [a])).rows).toEqual([{ version: 1 }]);
    expect((await como(mestreA, "delete from public.campaign_combats where campaign_id=$1 and version=1 returning campaign_id", [a])).rows).toEqual([{ campaign_id: a }]);
    expect((await como(mestreA, "select campaign_id from public.campaign_combats where campaign_id=$1", [a])).rows).toEqual([]);
    expect((await como(mestreA, "select campaign_id from public.campaign_combats where campaign_id=$1", [b])).rows).toEqual([]);
    expect((await como(mestreB, "select campaign_id from public.campaign_combats where campaign_id=$1", [b])).rows).toEqual([{ campaign_id: b }]);
  });
  it.each([{}, { combatentes: [], rodada: 1 }, { combatentes: [] }, { combatentes: [], rodada: null }, { combatentes: [], rodada: 0 }, { combatentes: [], rodada: 1.5 }])("nega envelope inválido %o", async valor => {
    expect((await como(mestreA, "update public.campaign_combats set state=$2,version=2 where campaign_id=$1", [a, valor])).error).toBeTruthy();
  });
  it("nega versão inicial arbitrária e timestamps no INSERT", async () => {
    await db.query("delete from public.campaign_combats where campaign_id=$1", [a]);
    expect((await como(mestreA, "insert into public.campaign_combats(campaign_id,version) values($1,4)", [a])).error).toMatch(/versao_inicial_invalida/);
    expect((await como(mestreA, "insert into public.campaign_combats(campaign_id,created_at) values($1,now())", [a])).error).toMatch(/permission denied/);
  });
  it("atualiza timestamp no servidor sem alterar created_at", async () => {
    const r = await como(mestreA, "update public.campaign_combats set version=2 where campaign_id=$1 returning updated_at > created_at as avancou", [a]);
    expect(r.rows).toEqual([{ avancou: true }]);
  });
  it("participação atual controla acesso mesmo para antigo mestre", async () => {
    // Alteração administrativa somente neste banco em memória. Preserva a linha.
    await db.exec("alter table public.campaign_members disable trigger user");
    await db.query("delete from public.campaign_members where campaign_id=$1 and user_id=$2", [a, mestreA]);
    expect((await como(mestreA, "select state from public.campaign_combats where campaign_id=$1", [a])).rows).toEqual([]);
    expect((await como(mestreA, "update public.campaign_combats set version=2 where campaign_id=$1 returning version", [a])).rows).toEqual([]);
    await db.query("insert into public.campaign_members(campaign_id,user_id,role) values($1,$2,'mestre')", [a, mestreA]);
    await db.exec("alter table public.campaign_members enable trigger user");
    expect((await como(mestreA, "select version from public.campaign_combats where campaign_id=$1", [a])).rows).toEqual([{ version: 1 }]);
  });
  it.each([1, 0, 3, 9007199254740992])("não aceita versão sem incremento exato: %s", async version => {
    expect((await como(mestreA, "update public.campaign_combats set version=$2 where campaign_id=$1", [a, version])).error).toBeTruthy();
  });
  it.each([
    { id: "", nome: "Goblin", lado: "inimigo", iniciativa: 1 },
    { id: "x", nome: " ", lado: "inimigo", iniciativa: 1 },
    { id: "x", nome: "Goblin", lado: "outro", iniciativa: 1 },
    { id: "x", nome: "Goblin", lado: "inimigo", iniciativa: "1" },
    { id: "x", nome: "Goblin", lado: "inimigo", iniciativa: 1, pvMax: 7, pv: 8 },
    { id: "x", nome: "Goblin", lado: "inimigo", iniciativa: 1, pvMax: 7, pv: -1 },
    { id: "x", nome: "Goblin", lado: "inimigo", iniciativa: 1, pvMax: 1.5 },
    { id: "x", nome: "Goblin", lado: "inimigo", iniciativa: 1, pv: 1 },
  ])("rejeita combatente inválido no servidor: %o", async c => {
    expect((await como(mestreA, "update public.campaign_combats set state=$2,version=2 where campaign_id=$1", [a, { ...estado, combatentes: [c], turno: c.id }])).error).toBeTruthy();
  });
  it("aceita combate completo com PV zero, empate e iniciativa decimal", async () => {
    const c = { id: "x", nome: "Goblin", lado: "inimigo", iniciativa: 1.5, pv: 0, pvMax: 7 };
    const novo = { ...estado, combatentes: [c, { ...c, id: "y" }], turno: "y" };
    expect((await como(mestreA, "update public.campaign_combats set state=$2,version=2 where campaign_id=$1 returning state", [a, novo])).rows).toEqual([{ state: novo }]);
  });
  it("rejeita IDs repetidos, turno inexistente e excesso de participantes", async () => {
    const c = { id: "x", nome: "Goblin", lado: "inimigo", iniciativa: 1 };
    for (const novo of [
      { ...estado, combatentes: [c, c], turno: "x" },
      { ...estado, combatentes: [c], turno: "ausente" },
      { ...estado, combatentes: [c], turno: null },
      { ...estado, turno: "x" },
      { ...estado, combatentes: Array.from({ length: 1001 }, (_, i) => ({ ...c, id: String(i) })), turno: "0" },
    ]) expect((await como(mestreA, "update public.campaign_combats set state=$2,version=2 where campaign_id=$1", [a, novo])).error).toBeTruthy();
  });

});

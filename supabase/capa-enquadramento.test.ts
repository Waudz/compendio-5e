// Migração 0012 (enquadramento da capa) no Postgres em memória (PGlite), com dados fictícios. Não toca em nenhum banco hospedado.
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { beforeAll, describe, expect, it } from "vitest";
import { storageStub } from "./stub-storage";

const dir = join(__dirname, "migrations");
const arquivos = () => readdirSync(dir).filter(f => f.endsWith(".sql")).sort();
const sql = (f: string) => readFileSync(join(dir, f), "utf8");
const U = { mestre: "00000000-0000-0000-0000-00000000000a", jogador: "00000000-0000-0000-0000-00000000000b", fora: "00000000-0000-0000-0000-00000000000d" };
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

let db: PGlite, C: string;
const CAPA = (c: string, n: number) => `${c}/aaaaaaaa-bbbb-4ccc-8ddd-${String(n).padStart(12, "0")}`;
async function como(uid: string | null, q: string, p: unknown[] = []) {
  await db.exec(`set role ${uid ? "authenticated" : "anon"}; select set_config('request.jwt.claim.sub', '${uid ?? ""}', false);`);
  try { return { rows: (await db.query<Record<string, unknown>>(q, p)).rows, error: undefined as string | undefined }; }
  catch (e) { return { rows: [] as Record<string, unknown>[], error: (e as Error).message }; }
  finally { await db.exec("reset role"); }
}
const gravar = (uid: string | null, valor: unknown) => como(uid, "update public.campaigns set cover_framing = $2::jsonb where id = $1 returning cover_framing", [C, valor === null ? null : JSON.stringify(valor)]);
const ler = async () => (await db.query<{ cover_framing: unknown; cover_path: string | null }>("select cover_framing, cover_path from public.campaigns where id = $1", [C])).rows[0];

beforeAll(async () => {
  db = new PGlite(); await db.exec(stub);
  const todas = arquivos();
  // a 0012 entra DEPOIS de já existirem campanha e capa: confirma que dados existentes são preservados
  for (const f of todas.filter(f => !f.startsWith("0012"))) await db.exec(sql(f));
  for (const [n, id] of Object.entries(U)) await db.query("insert into auth.users (id, email) values ($1, $2)", [id, `${n}@exemplo.com`]);
  C = (await como(U.mestre, "select public.create_campaign('Mesa', 'descrição') as r")).rows[0].r as string;
  const codigo = (await como(U.mestre, "select public.create_invite($1, 10, 7) as r", [C])).rows[0].r as string;
  await como(U.jogador, "select public.join_campaign($1)", [codigo]);
  await como(U.mestre, "update public.campaigns set cover_path = $2 where id = $1", [C, CAPA(C, 1)]);
  await db.exec(sql(todas.find(f => f.startsWith("0012"))!));
});

describe("0012: enquadramento da capa", () => {
  it("preserva a capa existente, que começa sem enquadramento", async () => {
    expect(await ler()).toEqual({ cover_framing: null, cover_path: CAPA(C, 1) });
    expect((await db.query("select name, description from public.campaigns where id = $1", [C])).rows).toEqual([{ name: "Mesa", description: "descrição" }]);
  });
  it("o mestre grava; todos os participantes leem; jogador, estranho e anônimo não gravam nem estranhos leem", async () => {
    expect((await gravar(U.mestre, { zoom: 1.5, x: 20, y: 80 })).rows).toHaveLength(1);
    expect((await como(U.jogador, "select cover_framing from public.campaigns where id = $1", [C])).rows[0].cover_framing).toEqual({ zoom: 1.5, x: 20, y: 80 });
    expect((await gravar(U.jogador, { zoom: 3, x: 0, y: 0 })).rows).toHaveLength(0);
    expect((await gravar(U.fora, { zoom: 3, x: 0, y: 0 })).rows).toHaveLength(0);
    expect((await gravar(null, { zoom: 3, x: 0, y: 0 })).rows).toHaveLength(0);
    expect((await como(U.fora, "select cover_framing from public.campaigns where id = $1", [C])).rows).toHaveLength(0);
    expect((await ler()).cover_framing).toEqual({ zoom: 1.5, x: 20, y: 80 });
  });
  it.each([
    [{ zoom: 0.5, x: 50, y: 50 }], [{ zoom: 3.1, x: 50, y: 50 }], [{ zoom: 1, x: -1, y: 50 }], [{ zoom: 1, x: 50, y: 101 }],
    [{ zoom: 1, x: 50 }], [{ x: 50, y: 50 }], [{ zoom: "2", x: 50, y: 50 }], [{ zoom: 1, x: 50, y: 50, extra: 1 }], [[1, 2, 3]], ["texto"], [{}],
  ])("recusa valor inválido: %j", async valor => {
    expect((await gravar(U.mestre, valor)).error).toMatch(/campaigns_cover_framing_check/);
  });
  it("o aplicativo zera o enquadramento no mesmo update que troca ou remove a imagem; outros campos o mantêm", async () => {
    await gravar(U.mestre, { zoom: 2, x: 10, y: 10 });
    await como(U.mestre, "update public.campaigns set name = 'Mesa 2' where id = $1", [C]);
    expect((await ler()).cover_framing).toEqual({ zoom: 2, x: 10, y: 10 });
    await como(U.mestre, "update public.campaigns set cover_path = $2, cover_framing = null where id = $1", [C, CAPA(C, 2)]);
    expect(await ler()).toEqual({ cover_framing: null, cover_path: CAPA(C, 2) });
  });
  it("a reversão remove só o enquadramento e a migração pode ser reaplicada", async () => {
    await db.exec(readFileSync(join(__dirname, "rollback", "0012_campaign_cover_framing_down.sql"), "utf8"));
    expect((await db.query("select name from public.campaigns where id = $1", [C])).rows).toEqual([{ name: "Mesa 2" }]);
    expect((await db.query("select 1 from information_schema.columns where table_name = 'campaigns' and column_name = 'cover_framing'")).rows).toHaveLength(0);
    await db.exec(sql("0012_campaign_cover_framing.sql"));
  });
});

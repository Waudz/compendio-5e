// Reversão e reaplicação das migrações 0009 (combate ativo) e 0010 (encontros) em PostgreSQL em memória: não toca em nenhum banco hospedado.
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { describe, expect, it } from "vitest";

const sql = (pasta: string, nome: string) => readFileSync(join(__dirname, pasta, nome), "utf8");
const uid = (n: number) => `00000000-0000-0000-0000-${String(n).padStart(12, "0")}`;
async function banco() {
  const db = new PGlite();
  await db.exec(`create role anon nologin; create role authenticated nologin; create schema auth; create table auth.users (id uuid primary key, email text);
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    grant usage on schema auth, public to anon, authenticated; grant execute on function auth.uid() to anon, authenticated;
    alter default privileges in schema public grant all on tables to anon, authenticated; alter default privileges in schema public grant all on functions to anon, authenticated;`);
  for (const p of ["0001", "0002", "0003"]) await db.exec(sql("migrations", readdirSync(join(__dirname, "migrations")).find(n => n.startsWith(p) && n.endsWith(".sql"))!));
  return db;
}
const tabelas = async (db: PGlite) => (await db.query<{ relname: string }>("select relname from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind='r' and relname like 'campaign\\_%' order by 1")).rows.map(r => r.relname);

describe("0009 e 0010: reversão segura e reaplicação", () => {
  it("a reversão (0010 antes da 0009) remove só as tabelas novas e preserva campanhas e membros; reaplicar funciona", async () => {
    const db = await banco();
    await db.query("insert into auth.users values ($1,'m@example.invalid')", [uid(1)]);
    await db.query("insert into public.campaigns(id,name,created_by) values ($1,'A',$2)", [uid(10), uid(1)]);
    const base = await tabelas(db);
    await db.exec(sql("migrations", "0009_campaign_combats.sql")); await db.exec(sql("migrations", "0010_campaign_encounters.sql"));
    expect(await tabelas(db)).toEqual([...base, "campaign_combats", "campaign_encounters"].sort());
    // a 0009 não pode ser revertida com a 0010 ainda aplicada (a ordem inversa é obrigatória)
    await expect(db.exec(sql("rollback", "0009_campaign_combats_down.sql"))).rejects.toThrow();
    await db.exec(sql("rollback", "0010_campaign_encounters_down.sql")); await db.exec(sql("rollback", "0009_campaign_combats_down.sql"));
    expect(await tabelas(db)).toEqual(base);
    expect((await db.query("select name from public.campaigns")).rows).toEqual([{ name: "A" }]);
    await db.exec(sql("migrations", "0009_campaign_combats.sql")); await db.exec(sql("migrations", "0010_campaign_encounters.sql"));
    expect(await tabelas(db)).toContain("campaign_encounters");
    await db.close();
  });
});

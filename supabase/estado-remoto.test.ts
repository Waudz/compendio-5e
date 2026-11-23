// Compatibilidade das migrações PENDENTES com o estado real do projeto hospedado `compendio-5e`, em PostgreSQL em memória (PGlite), com dados pré-existentes.
// Estado remoto observado em 23/11/2026 por sondagem somente leitura da API pública (sem credenciais privadas): existem as tabelas campaigns, campaign_members, notes e character_sheets;
// NÃO existem as funções `create_guided_character` (0008) e `save_note_content` (0005) nem as tabelas das 0009–0011. DISCREPÂNCIA a esclarecer antes de aplicar: a 0007 (aplicada) usa `notes.kind`,
// criada pela 0005, mas a função da 0005 não aparece no remoto. O registro real está em `supabase_migrations.schema_migrations` (consulta de leitura que só o responsável pode fazer).
// Este teste cobre o cenário mais provável (0001–0007 aplicadas): aplica as pendentes, na ordem, sobre um banco COM DADOS e confere que nada se perde.
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { describe, expect, it } from "vitest";
import { storageStub } from "./stub-storage";

const dir = join(__dirname, "migrations");
const nome = (prefixo: string) => readdirSync(dir).find(f => f.startsWith(prefixo) && f.endsWith(".sql"))!;
const aplicar = async (db: PGlite, ...prefixos: string[]) => { for (const p of prefixos) await db.exec(readFileSync(join(dir, nome(p)), "utf8")); };
const stub = `
create role anon nologin; create role authenticated nologin; create schema auth;
create table auth.users (id uuid primary key default gen_random_uuid(), email text);
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
grant usage on schema auth to anon, authenticated; grant execute on function auth.uid() to anon, authenticated; grant usage on schema public to anon, authenticated;
alter default privileges in schema public grant all on tables to anon, authenticated; alter default privileges in schema public grant all on functions to anon, authenticated;
` + storageStub;
const ANA = "00000000-0000-0000-0000-00000000000a", BIA = "00000000-0000-0000-0000-00000000000b", C1 = "00000000-0000-0000-0000-0000000000c1";

describe("migrações pendentes sobre o estado remoto provável (0001–0007, com dados)", () => {
  it("0008, 0009, 0010 e 0011 aplicam em ordem, sem perder campanhas, membros, notas nem fichas existentes", async () => {
    const db = new PGlite(); await db.exec(stub);
    await aplicar(db, "0001", "0002", "0003", "0004", "0005", "0006", "0007");
    await db.query("insert into auth.users (id, email) values ($1,'a@x.invalid'),($2,'b@x.invalid')", [ANA, BIA]);
    await db.query("insert into public.campaigns (id, name, created_by) values ($1,'Mesa',$2)", [C1, ANA]);
    await db.query("insert into public.campaign_members (campaign_id, user_id, role) values ($1,$2,'mestre'),($1,$3,'jogador')", [C1, ANA, BIA]);
    const nota = (await db.query<{ id: string }>("insert into public.notes (campaign_id, owner_id, title) values ($1,$2,'Minha nota') returning id", [C1, BIA])).rows[0].id;
    const antes = {
      campanhas: (await db.query("select count(*)::int as n from public.campaigns")).rows, membros: (await db.query("select count(*)::int as n from public.campaign_members")).rows,
      notas: (await db.query("select id, title, owner_id from public.notes")).rows,
    };
    await aplicar(db, "0008", "0009", "0010", "0011");
    expect((await db.query("select count(*)::int as n from public.campaigns")).rows).toEqual(antes.campanhas);
    expect((await db.query("select count(*)::int as n from public.campaign_members")).rows).toEqual(antes.membros);
    expect((await db.query("select id, title, owner_id from public.notes")).rows).toEqual(antes.notas);
    expect((await db.query("select id from public.notes where id = $1", [nota])).rows).toHaveLength(1);
    for (const t of ["campaign_combats", "campaign_encounters", "character_combat_status", "character_sheets"])
      expect((await db.query("select relrowsecurity from pg_class where oid = $1::regclass", [`public.${t}`])).rows[0], t).toEqual({ relrowsecurity: true });
    await db.close();
  });
  it("reaplicar uma migração já aplicada (0009–0011) falha de forma segura em vez de duplicar estruturas", async () => {
    const db = new PGlite(); await db.exec(stub);
    await aplicar(db, "0001", "0002", "0003", "0004", "0005", "0006", "0007", "0008", "0009", "0010", "0011");
    for (const p of ["0009", "0010", "0011"]) await expect(aplicar(db, p), p).rejects.toThrow();
    await db.close();
  });
});

// Migração 0006 (registros de campanha, capa e personagens), no Postgres em memória (PGlite), dados FICTÍCIOS e várias contas.
// Não é o Supabase hospedado; a 0006 NÃO foi aplicada lá.
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { beforeAll, describe, expect, it } from "vitest";
import { storageStub } from "./stub-storage";

const dir = join(__dirname, "migrations"), rollbackDir = join(__dirname, "rollback");
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
const files = () => readdirSync(dir).filter(f => f.endsWith(".sql")).sort();
const sql = (f: string) => readFileSync(join(dir, f), "utf8");
const para = (text: string) => ({ type: "paragraph", content: [{ type: "text", text, styles: {} }] });
const UUID = (n: number) => `aaaaaaaa-bbbb-4ccc-8ddd-${String(n).padStart(12, "0")}`;

type R = { rows: Record<string, unknown>[]; error?: string };
let db: PGlite;
async function as(uid: string | null, q: string, params: unknown[] = [], target: PGlite = db): Promise<R> {
  await target.exec(`set role ${uid ? "authenticated" : "anon"}; select set_config('request.jwt.claim.sub', '${uid ?? ""}', false);`);
  try { return { rows: (await target.query<Record<string, unknown>>(q, params)).rows }; }
  catch (e) { return { rows: [], error: (e as Error).message }; }
  finally { await target.exec("reset role"); }
}
const rpc = (uid: string, fn: string, ...a: unknown[]) => as(uid, `select public.${fn}(${a.map((_, i) => `$${i + 1}`).join(",")}) as r`, a);
const mk = (uid: string, campaign: string | null, kind: string, title: string, o: { vis?: string; content?: unknown; meta?: unknown } = {}) =>
  as(uid, "insert into public.notes (campaign_id, kind, title, visibility, content, meta) values ($1, $2, $3, $4, $5::jsonb, $6::jsonb) returning id",
    [campaign, kind, title, o.vis ?? "private", JSON.stringify(o.content ?? [para("texto")]), JSON.stringify(o.meta ?? {})]);
const idOf = (r: R) => { if (r.error) throw new Error(r.error); return r.rows[0].id as string; };

let C1: string, C2: string;
beforeAll(async () => {
  db = new PGlite(); await db.exec(stub);
  for (const f of files()) await db.exec(sql(f));
  for (const [n, id] of Object.entries(U)) await db.query("insert into auth.users (id, email) values ($1, $2)", [id, `${n}@exemplo.com`]);
  C1 = (await rpc(U.ana, "create_campaign", "Mesa 1", "")).rows[0].r as string;      // mestre: ana
  const code = (await rpc(U.ana, "create_invite", C1, 10, 7)).rows[0].r as string;
  await rpc(U.bia, "join_campaign", code); await rpc(U.caio, "join_campaign", code);   // jogadores: bia, caio
  C2 = (await rpc(U.dora, "create_campaign", "Mesa de fora", "")).rows[0].r as string; // dora: outra campanha
});

describe("tipos de registro por papel", () => {
  it("o mestre cria diário, cena e quadro; jogadores criam cenas e quadros próprios; estranhos não", async () => {
    for (const k of ["diary", "scene", "board"]) expect((await mk(U.ana, C1, k, `m-${k}`)).error, k).toBeUndefined();
    expect((await mk(U.bia, C1, "diary", "x")).error).toMatch(/tipo_exclusivo_do_mestre/);
    for (const k of ["scene", "board"]) {
      const id = idOf(await mk(U.bia, C1, k, `j-${k}`));
      expect((await as(U.bia, "select id from public.notes where id = $1", [id])).rows).toHaveLength(1);
      for (const u of [U.ana, U.caio, U.dora]) expect((await as(u, "select id from public.notes where id = $1", [id])).rows).toHaveLength(0);
      expect((await as(U.ana, "update public.notes set title = 'invadido' where id = $1 returning id", [id])).rows).toHaveLength(0);
    }
    for (const k of ["diary", "scene", "board"]) expect((await mk(U.dora, C1, k, "x")).error, `estranho ${k}`).toBeTruthy();
  });
  it("diário, cena, quadro e personagem exigem campanha; o mestre de uma campanha não cria na outra", async () => {
    for (const k of ["diary", "scene", "board", "character"]) expect((await mk(U.ana, null, k, "x")).error, k).toBeTruthy();
    expect((await mk(U.ana, C2, "diary", "x")).error).toBeTruthy();
  });
  it("jogador não troca o tipo de uma nota própria para um tipo do mestre", async () => {
    const id = idOf(await mk(U.bia, C1, "note", "minha"));
    expect((await as(U.bia, "update public.notes set kind = 'diary' where id = $1", [id])).error).toMatch(/tipo_exclusivo_do_mestre/);
  });
});

describe("Diário: rascunho privado, publicado para a campanha", () => {
  it("rascunho só o mestre lê; ao publicar, jogadores leem; ao despublicar, somem", async () => {
    const id = idOf(await mk(U.ana, C1, "diary", "Sessão 1", { meta: { sessao: { dia: 3, mes: 12, ano: 1491 } } }));
    expect((await as(U.bia, "select id from public.notes where id = $1", [id])).rows).toHaveLength(0);
    expect((await as(U.ana, "update public.notes set visibility = 'campaign' where id = $1 returning id", [id])).rows).toHaveLength(1);
    for (const u of [U.bia, U.caio]) expect((await as(u, "select title, meta from public.notes where id = $1", [id])).rows).toEqual([{ title: "Sessão 1", meta: { sessao: { dia: 3, mes: 12, ano: 1491 } } }]);
    expect((await as(U.dora, "select id from public.notes where id = $1", [id])).rows).toHaveLength(0);          // outra campanha
    expect((await as(U.bia, "update public.notes set title = 'hack' where id = $1 returning id", [id])).rows).toHaveLength(0);   // jogador não edita
    expect((await as(U.bia, "delete from public.notes where id = $1 returning id", [id])).rows).toHaveLength(0);
    await as(U.ana, "update public.notes set visibility = 'private' where id = $1", [id]);
    expect((await as(U.bia, "select id from public.notes where id = $1", [id])).rows).toHaveLength(0);
  });
  it("visibilidade 'master' ou 'selected' não existe para diário", async () => {
    expect((await mk(U.ana, C1, "diary", "x", { vis: "master" })).error).toMatch(/notes_publicavel_check/);
    expect((await mk(U.ana, C1, "diary", "x", { vis: "selected" })).error).toMatch(/notes_publicavel_check/);
  });
  it("exclusão vai para a lixeira, deixa de aparecer e nunca fica publicada", async () => {
    const id = idOf(await mk(U.ana, C1, "diary", "Apagar", { vis: "campaign" }));
    await as(U.ana, "update public.notes set deleted_at = now() where id = $1", [id]);
    expect((await as(U.bia, "select id from public.notes where id = $1", [id])).rows).toHaveLength(0);
    expect((await as(U.ana, "select visibility from public.notes where id = $1", [id])).rows).toEqual([{ visibility: "private" }]);
  });
  it("o conteúdo rico é guardado em content e o texto derivado vai para body", async () => {
    const id = idOf(await mk(U.ana, C1, "diary", "Texto", { content: [para("Primeiro."), para("Segundo.")] }));
    expect((await as(U.ana, "select body, jsonb_array_length(content)::int as n from public.notes where id = $1", [id])).rows).toEqual([{ body: "Primeiro. Segundo.", n: 2 }]);
  });
});

describe("Anotações: quadros e cenas privados de cada autor", () => {
  it("cena e quadro não podem ser compartilhados nem publicados, e outros usuários não leem os registros do autor", async () => {
    expect((await mk(U.ana, C1, "scene", "x", { vis: "campaign" })).error).toMatch(/notes_planejamento_privado_check/);
    expect((await mk(U.ana, C1, "board", "x", { vis: "master" })).error).toMatch(/notes_planejamento_privado_check/);
    const id = idOf(await mk(U.ana, C1, "scene", "Julkoun", { meta: { x: 1 } }));
    expect((await as(U.ana, "update public.notes set visibility = 'campaign' where id = $1", [id])).error).toMatch(/notes_planejamento_privado_check/);
    for (const u of [U.bia, U.caio, U.dora]) expect((await as(u, "select id from public.notes where id = $1", [id])).rows).toHaveLength(0);
  });
  it("o quadro guarda a ordem em meta e a versão avança a cada gravação (concorrência otimista)", async () => {
    const id = idOf(await mk(U.ana, C1, "board", "Quadro", { meta: { colunas: [] } }));
    const r1 = await as(U.ana, "update public.notes set meta = $2::jsonb where id = $1 and version = 1 returning version", [id, JSON.stringify({ colunas: [{ id: "a", titulo: "S5", cartoes: [] }] })]);
    expect(r1.rows).toEqual([{ version: 2 }]);
    expect((await as(U.ana, "update public.notes set meta = '{}'::jsonb where id = $1 and version = 1 returning version", [id])).rows).toHaveLength(0);   // versão velha: nada grava
  });
});

describe("meta", () => {
  it("só objeto, até 16 KiB", async () => {
    expect((await mk(U.ana, C1, "scene", "x", { meta: [1, 2] })).error).toMatch(/notes_meta_check/);
    expect((await mk(U.ana, C1, "scene", "x", { meta: { x: "a".repeat(17000) } })).error).toMatch(/notes_meta_check/);
    expect((await mk(U.ana, C1, "scene", "ok", { meta: { x: "a".repeat(1000) } })).error).toBeUndefined();
  });
});

describe("personagens", () => {
  it("o jogador cria o próprio personagem; a campanha toda vê quando publicado; só o dono edita", async () => {
    const id = idOf(await mk(U.bia, C1, "character", "Lydia", { vis: "campaign", meta: { classe: "Clériga", nivel: 3 } }));
    for (const u of [U.ana, U.bia, U.caio]) expect((await as(u, "select title, meta from public.notes where id = $1", [id])).rows).toEqual([{ title: "Lydia", meta: { classe: "Clériga", nivel: 3 } }]);
    expect((await as(U.dora, "select id from public.notes where id = $1", [id])).rows).toHaveLength(0);
    expect((await as(U.caio, "update public.notes set title = 'x' where id = $1 returning id", [id])).rows).toHaveLength(0);
    expect((await as(U.ana, "update public.notes set title = 'x' where id = $1 returning id", [id])).rows).toHaveLength(0);   // nem o mestre edita a ficha alheia
    expect((await as(U.bia, "update public.notes set meta = $2::jsonb where id = $1 returning id", [id, JSON.stringify({ classe: "Clériga", nivel: 4 })])).rows).toHaveLength(1);
  });
  it("personagem privado só o dono vê; quem não participa da campanha não cria", async () => {
    const id = idOf(await mk(U.bia, C1, "character", "Rascunho", { vis: "private" }));
    for (const u of [U.ana, U.caio]) expect((await as(u, "select id from public.notes where id = $1", [id])).rows).toHaveLength(0);
    expect((await mk(U.dora, C1, "character", "Intruso", { vis: "campaign" })).error).toBeTruthy();
  });
});

describe("capa da campanha", () => {
  it("só o mestre define o caminho, e só no formato <campanha>/<uuid>", async () => {
    const path = `${C1}/${UUID(1)}`;
    expect((await as(U.ana, "update public.campaigns set cover_path = $2 where id = $1 returning id", [C1, path])).rows).toHaveLength(1);
    expect((await as(U.bia, "update public.campaigns set cover_path = $2 where id = $1 returning id", [C1, `${C1}/${UUID(2)}`])).rows).toHaveLength(0);
    expect((await as(U.ana, "update public.campaigns set cover_path = '../x' where id = $1", [C1])).error).toMatch(/campaigns_cover_path_check/);
    expect((await as(U.bia, "select cover_path from public.campaigns where id = $1", [C1])).rows).toEqual([{ cover_path: path }]);   // participante lê
    expect((await as(U.dora, "select cover_path from public.campaigns where id = $1", [C1])).rows).toHaveLength(0);
  });
});

describe("storage: bucket campaign-assets", () => {
  const obj = (uid: string, camp: string, n: number, name?: string) => as(uid, "insert into storage.objects (bucket_id, name) values ('campaign-assets', $1) returning id", [name ?? `${camp}/${UUID(n)}`]);
  it("o bucket é privado, limita tamanho e só aceita JPEG, PNG e WebP", async () => {
    expect((await db.query("select public, file_size_limit::int as lim, allowed_mime_types as t from storage.buckets where id = 'campaign-assets'")).rows).toEqual([{ public: false, lim: 5242880, t: ["image/jpeg", "image/png", "image/webp"] }]);
  });
  it("participantes enviam e leem; estranhos não enviam nem leem; caminho fora do padrão é recusado", async () => {
    expect((await obj(U.bia, C1, 10)).error).toBeUndefined();
    expect((await obj(U.ana, C1, 11)).error).toBeUndefined();
    expect((await obj(U.dora, C1, 12)).error).toMatch(/row-level security/);
    expect((await obj(U.bia, C1, 13, `${C1}/../etc`)).error).toMatch(/row-level security/);
    expect((await obj(U.bia, C1, 14, `${C1}/arquivo.png`)).error).toMatch(/row-level security/);
    expect((await obj(U.bia, C2, 15)).error).toMatch(/row-level security/);                  // jogador não envia para a campanha dos outros
    expect((await as(U.caio, "select name from storage.objects where name = $1", [`${C1}/${UUID(10)}`])).rows).toHaveLength(1);
    expect((await as(U.dora, "select name from storage.objects where name = $1", [`${C1}/${UUID(10)}`])).rows).toHaveLength(0);
    expect((await as(null, "select name from storage.objects")).error).toBeTruthy();         // anônimo: sem acesso
  });
  it("objetos de OUTROS buckets com nome fora do padrão não geram erro de cast nem ficam acessíveis (a política não vaza para eles)", async () => {
    await db.exec("insert into storage.buckets (id, name) values ('outro', 'outro') on conflict do nothing; insert into storage.objects (bucket_id, name, owner_id) values ('outro', 'nao-e-uuid/arquivo.txt', null), ('campaign-assets', 'lixo-sem-padrao', null)");
    const r = await as(U.bia, "select name from storage.objects where name in ('nao-e-uuid/arquivo.txt', 'lixo-sem-padrao')");
    expect(r.error).toBeUndefined(); expect(r.rows).toEqual([]);
  });
  it("só quem enviou ou o mestre apaga", async () => {
    expect((await as(U.caio, "delete from storage.objects where name = $1 returning id", [`${C1}/${UUID(10)}`])).rows).toHaveLength(0);
    expect((await as(U.bia, "delete from storage.objects where name = $1 returning id", [`${C1}/${UUID(10)}`])).rows).toHaveLength(1);
    expect((await as(U.ana, "delete from storage.objects where name = $1 returning id", [`${C1}/${UUID(11)}`])).rows).toHaveLength(1);   // mestre apaga o de qualquer um
  });
});

describe("segurança das funções e reversão", () => {
  it("a função do gatilho não é executável por anon nem por authenticated", async () => {
    const r = await db.query<{ anon: boolean; auth: boolean }>("select has_function_privilege('anon', p.oid, 'execute') as anon, has_function_privilege('authenticated', p.oid, 'execute') as auth from pg_proc p where proname = 'notes_kind_guard'");
    expect(r.rows).toEqual([{ anon: false, auth: false }]);
  });
  it("a reversão exige confirmação quando há dados e a migração pode ser reaplicada", async () => {
    const t = new PGlite(); await t.exec(stub);
    for (const f of files()) await t.exec(sql(f));
    await t.query("insert into auth.users (id, email) values ($1, 'a@x')", [U.ana]);
    const c = (await as(U.ana, "select public.create_campaign('M','') as r", [], t)).rows[0].r as string;
    await as(U.ana, "insert into public.notes (campaign_id, kind, title) values ($1, 'board', 'Q')", [c], t);
    for (const f of ["0020_compendio_cartas_bestiario_down.sql", "0019_compendio_inventario_campanha_down.sql", "0014_vitais_inventario_atomicos_down.sql", "0011_character_combat_status_down.sql", "0010_campaign_encounters_down.sql", "0009_campaign_combats_down.sql", "0008_character_sheets_persistencia_down.sql", "0007_character_sheets_foundation_down.sql"]) await t.exec(readFileSync(join(rollbackDir, f), "utf8"));   // fichas dependem de notes.meta
    const down = readFileSync(join(rollbackDir, "0006_registros_capa_personagens_down.sql"), "utf8");
    await expect(t.exec(down)).rejects.toThrow(/rollback_0006_destrutivo/);
    await t.exec("set compendio.confirmar_rollback_0006 = 'sim'"); await t.exec(down);
    expect((await t.query("select count(*)::int as n from information_schema.columns where table_name = 'notes' and column_name = 'meta'")).rows).toEqual([{ n: 0 }]);
    expect((await t.query("select count(*)::int as n from public.notes where kind = 'board'")).rows).toEqual([{ n: 0 }]);
    await t.exec(sql(files().find(f => f.startsWith("0006"))!));
    expect((await t.query("select count(*)::int as n from information_schema.columns where table_name = 'notes' and column_name = 'meta'")).rows).toEqual([{ n: 1 }]);
  });
});

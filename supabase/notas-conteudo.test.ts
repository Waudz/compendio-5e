// Migração 0005 (conteúdo estruturado das notas), testada no Postgres em memória (PGlite) com dados FICTÍCIOS e várias contas.
// Não é o Supabase hospedado; a 0005 NÃO foi aplicada lá.
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { beforeAll, describe, expect, it } from "vitest";
import { storageStub } from "./stub-storage";

const dir = join(__dirname, "migrations"), rollbackDir = join(__dirname, "rollback");
const bnFixture = () => readFileSync(join(__dirname, "fixtures", "blocknote-0.57.0-documento.json"), "utf8");   // saída REAL de editor.document (BlockNote 0.57.0, mesmo do PR #28)
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
const files = () => readdirSync(dir).filter(f => f.endsWith(".sql") && f < "0006").sort();   // a suíte da 0005 não inclui a 0006 (tem teste próprio)
const sql = (f: string) => readFileSync(join(dir, f), "utf8");
const UUID = "11111111-2222-4333-8444-555555555555";

type R = { rows: Record<string, unknown>[]; error?: string };
let db: PGlite;
async function as(uid: string | null, q: string, params: unknown[] = [], target: PGlite = db): Promise<R> {
  await target.exec(`set role ${uid ? "authenticated" : "anon"}; select set_config('request.jwt.claim.sub', '${uid ?? ""}', false);`);
  try { return { rows: (await target.query<Record<string, unknown>>(q, params)).rows }; }
  catch (e) { return { rows: [], error: (e as Error).message }; }
  finally { await target.exec("reset role"); }
}
const rpc = (uid: string, fn: string, ...a: unknown[]) => as(uid, `select public.${fn}(${a.map((_, i) => `$${i + 1}`).join(",")}) as r`, a);
async function mk(uid: string, title: string, o: { vis?: string; campaign?: string | null; content?: unknown; kind?: string } = {}) {
  const r = await as(uid, "insert into public.notes (campaign_id, title, visibility, kind, content) values ($1, $2, $3, $4, $5::jsonb) returning id",
    [o.campaign ?? null, title, o.vis ?? "private", o.kind ?? "note", o.content === undefined ? null : JSON.stringify(o.content)]);
  if (r.error) throw new Error(r.error);
  return r.rows[0].id as string;
}
const para = (text: string) => ({ type: "paragraph", content: [{ type: "text", text, styles: {} }] });
const insertContent = (uid: string, campaign: string | null, content: unknown) => as(uid, "insert into public.notes (campaign_id, title, content) values ($1, 'x', $2::jsonb) returning id", [campaign, JSON.stringify(content)]);

let C1: string, C2: string;
beforeAll(async () => {
  db = new PGlite(); await db.exec(stub);
  for (const f of files()) await db.exec(sql(f));
  for (const [n, id] of Object.entries(U)) await db.query("insert into auth.users (id, email) values ($1, $2)", [id, `${n}@exemplo.com`]);
  C1 = (await rpc(U.ana, "create_campaign", "Mesa 1", "")).rows[0].r as string;           // mestre: ana
  const code = (await rpc(U.ana, "create_invite", C1, 10, 7)).rows[0].r as string;
  await rpc(U.bia, "join_campaign", code); await rpc(U.caio, "join_campaign", code);       // jogadores: bia, caio
  C2 = (await rpc(U.dora, "create_campaign", "Mesa de fora", "")).rows[0].r as string;     // dora: só na outra campanha
});

describe("migração 0005 sobre dados existentes", () => {
  it("preserva todas as notas, compartilhamentos e versões; novas colunas entram com valores neutros", async () => {
    const old = new PGlite(); await old.exec(stub);
    for (const f of files().filter(f => f < "0005")) await old.exec(sql(f));
    for (const [n, id] of Object.entries(U)) await old.query("insert into auth.users (id, email) values ($1, $2)", [id, `${n}@exemplo.com`]);
    const camp2 = (await as(U.ana, "select public.create_campaign('Antiga','') as r", [], old)).rows[0].r as string;
    const mkOld = async (uid: string, t: string, vis: string, c: string | null, body: string) => (await as(uid, "insert into public.notes (campaign_id, title, body, visibility) values ($1, $2, $3, $4) returning id", [c, t, body, vis], old)).rows[0].id as string;
    const a = await mkOld(U.ana, "Pessoal", "private", null, "corpo antigo 1");
    const b = await mkOld(U.ana, "Planejamento", "private", camp2, "corpo antigo 2");
    const c = await mkOld(U.ana, "Para todos", "campaign", camp2, "corpo antigo 3");
    await as(U.ana, "update public.notes set body = 'editada' where id = $1", [c], old);
    const antes = (await old.query("select id, owner_id, campaign_id, title, body, visibility, version, created_at, updated_at from public.notes order by id")).rows;
    await old.exec(sql(files().find(f => f.startsWith("0005"))!));
    const depois = (await old.query("select id, owner_id, campaign_id, title, body, visibility, version, created_at, updated_at, kind, content, content_schema, deleted_at, deleted_batch from public.notes order by id")).rows;
    expect(depois).toHaveLength(3);
    for (let i = 0; i < antes.length; i++) {
      const { kind, content, content_schema, deleted_at, deleted_batch, ...resto } = depois[i] as Record<string, unknown>;
      expect(resto).toEqual(antes[i]);                                                  // nenhuma coluna antiga mudou (inclusive version e updated_at)
      expect([kind, content, content_schema, deleted_at, deleted_batch]).toEqual(["note", null, 1, null, null]);
    }
    expect([a, b, c].every(id => depois.some(r => r.id === id))).toBe(true);
  });

  it("o rollback remove só o que a 0005 criou, preserva as notas (inclusive o body derivado) e a migração pode ser reaplicada", async () => {
    const t = new PGlite(); await t.exec(stub);
    for (const f of files()) await t.exec(sql(f));
    await t.query("insert into auth.users (id, email) values ($1, 'a@x')", [U.ana]);
    const id = (await as(U.ana, "insert into public.notes (title, content) values ('Com conteúdo', $1::jsonb) returning id", [JSON.stringify([para("texto derivado")])], t)).rows[0].id as string;
    const down = readFileSync(join(rollbackDir, "0005_notas_conteudo_down.sql"), "utf8");
    await expect(t.exec(down)).rejects.toThrow(/rollback_0005_destrutivo/);                     // trava: há content; exige backup e confirmação explícita
    expect((await t.query("select count(*)::int as n from information_schema.columns where table_name = 'notes' and column_name = 'content'")).rows).toEqual([{ n: 1 }]);   // nada foi revertido
    await t.exec("set compendio.confirmar_rollback_0005 = 'sim'");
    await t.exec(down);
    const cols = (await t.query("select column_name from information_schema.columns where table_name = 'notes'")).rows.map(r => r.column_name);
    for (const c of ["kind", "content", "content_schema", "deleted_at", "deleted_batch"]) expect(cols).not.toContain(c);
    expect((await t.query("select title, body from public.notes where id = $1", [id])).rows).toEqual([{ title: "Com conteúdo", body: "texto derivado" }]);
    expect((await t.query("select count(*)::int as n from pg_proc where proname in ('save_note_content', 'notes_content_before_write')")).rows).toEqual([{ n: 0 }]);
    await t.exec(sql(files().find(f => f.startsWith("0005"))!));                         // reaplica
    expect((await t.query("select kind, content from public.notes where id = $1", [id])).rows).toEqual([{ kind: "note", content: null }]);
  });

  it("não adiciona função privilegiada: as únicas SECURITY DEFINER continuam sendo as anteriores", async () => {
    const r = await db.query<{ proname: string }>("select proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.prosecdef order by proname");
    expect(r.rows.map(x => x.proname)).not.toContain("save_note_content"); expect(r.rows.map(x => x.proname)).not.toContain("notes_content_before_write");
    const novas = await db.query<{ proname: string; definer: boolean; anon: boolean; auth: boolean }>("select proname, prosecdef as definer, has_function_privilege('anon', p.oid, 'execute') as anon, has_function_privilege('authenticated', p.oid, 'execute') as auth from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and proname in ('save_note_content', 'notes_content_before_write') order by proname");
    expect(novas.rows).toEqual([{ proname: "notes_content_before_write", definer: false, anon: false, auth: false }, { proname: "save_note_content", definer: false, anon: false, auth: true }]);
  });
});

describe("tipo (kind)", () => {
  it("padrão 'note'; tipos especializados e genérico aceitos; tipo inválido recusado", async () => {
    const id = await mk(U.bia, "Padrão"); expect((await as(U.bia, "select kind from public.notes where id = $1", [id])).rows).toEqual([{ kind: "note" }]);
    for (const k of ["page", "scene", "npc", "location", "faction", "event", "diary"]) expect(await mk(U.bia, `Tipo ${k}`, { kind: k })).toBeTruthy();
    expect((await as(U.bia, "insert into public.notes (title, kind) values ('x', 'invasor')")).error).toMatch(/check constraint/);
    expect((await as(U.bia, "update public.notes set kind = 'invasor' where id = $1", [id])).error).toMatch(/check constraint/);
    expect((await as(U.bia, "update public.notes set kind = 'npc' where id = $1 returning kind", [id])).rows).toEqual([{ kind: "npc" }]);
  });
});

describe("conteúdo JSONB: estrutura, tamanho e referências", () => {
  it("aceita blocos válidos (parágrafo, lista aninhada, tabela, referência interna, link seguro)", async () => {
    const conteudo = [
      { type: "heading", props: { level: 2 }, content: [{ type: "text", text: "Taverna", styles: { bold: true } }] },
      { type: "paragraph", content: [{ type: "text", text: "A dona, ", styles: {} }, { type: "ref", props: { kind: "npc", refId: "marta", label: "Marta" } }, { type: "link", href: "https://exemplo.com/x?y=1", content: [{ type: "text", text: "site", styles: {} }] }] },
      { type: "bulletListItem", content: [{ type: "text", text: "Boato", styles: {} }], children: [{ type: "bulletListItem", content: [{ type: "text", text: "Sub", styles: {} }], children: [] }] },
      { type: "table", content: { type: "tableContent", rows: [{ cells: [[{ type: "text", text: "A", styles: {} }]] }] } },
      { type: "image", props: { url: "", caption: "" } },
    ];
    const r = await insertContent(U.ana, C1, conteudo); expect(r.error).toBeUndefined();
    const lida = (await as(U.ana, "select content, content_schema, body from public.notes where id = $1", [r.rows[0].id])).rows[0];
    expect(lida.content).toEqual(conteudo); expect(lida.content_schema).toBe(1);
    expect(lida.body).toContain("Taverna"); expect(lida.body).toContain("Marta"); expect(lida.body).toContain("Boato");
  });
  it("estrutura básica: precisa ser array de objetos com type; limites de tamanho, quantidade e profundidade", async () => {
    for (const ruim of [{ type: "paragraph" }, "texto", 5, [1], [{ nome: "sem type" }], [{ type: 7 }], [{ type: "x".repeat(65) }]])
      expect((await insertContent(U.ana, C1, ruim)).error, JSON.stringify(ruim)).toMatch(/conteudo_invalido|check constraint/);
    expect((await insertContent(U.ana, C1, Array.from({ length: 5001 }, () => ({ type: "paragraph" })))).error).toMatch(/check constraint/);
    expect((await insertContent(U.ana, C1, [para("x".repeat(500001))])).error).toMatch(/check constraint/);
    expect((await insertContent(U.ana, C1, [para("x".repeat(400000))])).error).toBeUndefined();            // dentro do limite de 500 kB
    let fundo: unknown = { type: "paragraph", children: [] }; for (let i = 0; i < 21; i++) fundo = { type: "paragraph", children: [fundo] };
    expect((await insertContent(U.ana, C1, [fundo])).error).toMatch(/conteudo_muito_profundo/);
    let ok: unknown = { type: "paragraph", children: [] }; for (let i = 0; i < 18; i++) ok = { type: "paragraph", children: [ok] };
    expect((await insertContent(U.ana, C1, [ok])).error).toBeUndefined();
  });
  it("links: só http(s), mailto e compendio:; javascript:, data:, file:, espaços e valores não textuais são recusados", async () => {
    const link = (href: unknown) => [{ type: "paragraph", content: [{ type: "link", href, content: [] }] }];
    for (const bom of ["https://a.com", "http://a.com/x", "mailto:a@b.com", "compendio:npc/marta"]) expect((await insertContent(U.ana, C1, link(bom))).error, bom).toBeUndefined();
    for (const mau of ["javascript:alert(1)", "JaVaScRiPt:alert(1)", " javascript:x", "data:text/html,x", "file:///etc/passwd", "//evil.com", "/relativo", "https://a.com/ x", "https://a.com/\n", 5, null, { x: 1 }, "x".repeat(2100)])
      expect((await insertContent(U.ana, C1, link(mau))).error, String(mau).slice(0, 30)).toMatch(/conteudo_link_invalido/);
  });
  it("arquivos e imagens: só referência de Storage da PRÓPRIA campanha; URL externa, outra campanha e nota pessoal são recusadas", async () => {
    const img = (url: unknown) => [{ type: "image", props: { url } }];
    const minha = `storage:campaign-assets/${C1}/${UUID}`;
    expect((await insertContent(U.ana, C1, img(minha))).error).toBeUndefined();
    for (const mau of ["https://evil.com/x.png", "http://localhost/x", "data:image/png;base64,AAAA", `storage:campaign-assets/${C2}/${UUID}`, `storage:campaign-assets/${C1}/../${UUID}`, `storage:campaign-assets/${C1}/nao-e-uuid`, `storage:other/${C1}/${UUID}`, minha + "x", 5, null])
      expect((await insertContent(U.ana, C1, img(mau))).error, String(mau)).toMatch(/conteudo_referencia_externa/);
    expect((await insertContent(U.bia, null, img(minha))).error).toMatch(/conteudo_referencia_externa/);   // nota pessoal não tem arquivos de campanha
    expect((await insertContent(U.bia, null, img(""))).error).toBeUndefined();                                // bloco ainda sem arquivo
  });
  it("chaves de carregamento externo automático (src, srcset, poster, action, formaction) são recusadas em qualquer nível", async () => {
    for (const k of ["src", "srcset", "poster", "action", "formaction"])
      expect((await insertContent(U.ana, C1, [{ type: "paragraph", children: [{ type: "video", props: { [k]: "https://x.com/a" } }] }])).error, k).toMatch(/conteudo_referencia_externa/);
  });
  it("texto com 'data:' ou 'javascript:' em prosa comum é permitido (só links e arquivos são validados)", async () => {
    expect((await insertContent(U.ana, C1, [para("Data: lua cheia. javascript: é só uma palavra aqui.")])).error).toBeUndefined();
  });
});

describe("body derivado e compatibilidade", () => {
  it("nota antiga (só body) continua funcionando; com content, o servidor deriva o body e RECUSA (não ignora em silêncio) um body diferente", async () => {
    const velho = (await as(U.bia, "insert into public.notes (title, body) values ('Antiga', 'só body') returning id")).rows[0].id as string;
    expect((await as(U.bia, "select body, content from public.notes where id = $1", [velho])).rows).toEqual([{ body: "só body", content: null }]);
    expect((await as(U.bia, "update public.notes set body = 'editado à mão' where id = $1 returning body", [velho])).rows).toEqual([{ body: "editado à mão" }]);
    expect((await as(U.bia, "insert into public.notes (title, body, content) values ('Nova', 'forjado pelo cliente', $1::jsonb)", [JSON.stringify([para("texto real")])])).error).toMatch(/body_e_derivado_do_conteudo/);
    const novo = (await as(U.bia, "insert into public.notes (title, content) values ('Nova', $1::jsonb) returning id", [JSON.stringify([para("texto real")])])).rows[0].id as string;
    expect((await as(U.bia, "select body from public.notes where id = $1", [novo])).rows).toEqual([{ body: "texto real" }]);
    expect((await as(U.bia, "update public.notes set body = 'outro forjado' where id = $1", [novo])).error).toMatch(/body_e_derivado_do_conteudo/);
    expect((await as(U.bia, "update public.notes set title = 'Outro título' where id = $1 returning body", [novo])).rows).toEqual([{ body: "texto real" }]);   // mexer em outra coluna não toca no body
    await as(U.bia, "update public.notes set content = $1::jsonb where id = $2", [JSON.stringify([para("mudou")]), novo]);
    expect((await as(U.bia, "select body from public.notes where id = $1", [novo])).rows).toEqual([{ body: "mudou" }]);
  });
  it("o body derivado respeita o limite antigo de 50 000 caracteres", async () => {
    const r = await insertContent(U.bia, null, Array.from({ length: 20 }, () => para("y".repeat(20000))));
    expect(r.error).toBeUndefined();
    expect(((await as(U.bia, "select length(body)::int as n from public.notes where id = $1", [r.rows[0].id])).rows[0].n as number)).toBeLessThanOrEqual(50000);
  });
});

describe("privilégios por coluna e isolamento (planejamento privado)", () => {
  it("anon não acessa; ninguém escolhe deleted_at/deleted_batch na criação; owner_id e campaign_id continuam imutáveis", async () => {
    expect((await as(null, "select content from public.notes")).error).toMatch(/permission denied/);
    expect((await as(U.bia, "insert into public.notes (title, deleted_at) values ('x', now())")).error).toMatch(/permission denied/);
    expect((await as(U.bia, "insert into public.notes (title, deleted_batch) values ('x', gen_random_uuid())")).error).toMatch(/permission denied/);
    const id = await mk(U.bia, "Imutável", { vis: "campaign", campaign: C1, content: [para("x")] });
    for (const col of [`owner_id = '${U.caio}'`, `campaign_id = '${C2}'`, "version = 9", "id = gen_random_uuid()"]) expect((await as(U.bia, `update public.notes set ${col} where id = $1`, [id])).error, col).toMatch(/permission denied/);
    await expect(db.query("update public.notes set campaign_id = $1 where id = $2", [C2, id])).rejects.toThrow(/campo_imutavel/);
  });
  it("jogadores NÃO leem planejamento privado do mestre (lista, id, busca no body derivado, contagem); mestre de outra campanha também não", async () => {
    const id = await mk(U.ana, "Plano secreto da sessão 6", { vis: "private", campaign: C1, kind: "scene", content: [para("o prefeito é o vilão")] });
    for (const who of [U.bia, U.caio, U.dora]) {
      expect((await as(who, "select id from public.notes where id = $1", [id])).rows, who).toEqual([]);
      expect((await as(who, "select id from public.notes where body ilike '%vilão%' or content::text ilike '%vilão%'")).rows, who).toEqual([]);
      expect((await as(who, "select count(*)::int as n from public.notes where id = $1 or kind = 'scene' and campaign_id = $2", [id, C1])).rows, who).toEqual([{ n: 0 }]);
      expect((await as(who, "update public.notes set content = '[]'::jsonb where id = $1 returning id", [id])).rows, who).toEqual([]);
      expect((await as(who, "delete from public.notes where id = $1 returning id", [id])).rows, who).toEqual([]);
    }
    expect((await as(U.ana, "select id from public.notes where id = $1", [id])).rows).toHaveLength(1);
  });
  it("campanhas diferentes: nota de uma campanha não aceita referência de arquivo da outra nem criação por quem não participa", async () => {
    expect((await insertContent(U.dora, C1, [para("invasão")])).error).toMatch(/row-level security/);
    expect((await insertContent(U.ana, C1, [{ type: "image", props: { url: `storage:campaign-assets/${C2}/${UUID}` } }])).error).toMatch(/conteudo_referencia_externa/);
  });
});

describe("exclusão lógica e restauração", () => {
  it("excluir tira a nota de todo compartilhamento na hora (privada, sem destinatários) e atribui um lote", async () => {
    const id = await mk(U.ana, "Compartilhada", { vis: "campaign", campaign: C1, content: [para("p")] });
    expect(await as(U.bia, "select id from public.notes where id = $1", [id]).then(r => r.rows)).toHaveLength(1);
    const r = await as(U.ana, "update public.notes set deleted_at = now() where id = $1 returning visibility, deleted_batch, deleted_at", [id]);
    expect(r.rows[0].visibility).toBe("private"); expect(r.rows[0].deleted_batch).toMatch(/^[0-9a-f-]{36}$/); expect(r.rows[0].deleted_at).not.toBeNull();
    expect((await as(U.bia, "select id from public.notes where id = $1", [id])).rows).toEqual([]);
    expect((await as(U.ana, "select id from public.notes where id = $1 and deleted_at is not null", [id])).rows).toHaveLength(1);   // o autor ainda a vê (lixeira)
  });
  it("excluir apaga os destinatários 'selected' e a restauração não os traz de volta nem recompartilha", async () => {
    const id = await mk(U.bia, "Selecionados", { vis: "selected", campaign: C1 });
    await as(U.bia, "insert into public.note_shares (note_id, user_id) values ($1, $2)", [id, U.caio]);
    expect(await as(U.caio, "select id from public.notes where id = $1", [id]).then(r => r.rows)).toHaveLength(1);
    const lote = "99999999-0000-4000-8000-000000000001";
    await as(U.bia, "update public.notes set deleted_at = now(), deleted_batch = $2 where id = $1", [id, lote]);
    expect((await db.query("select count(*)::int as n from public.note_shares where note_id = $1", [id])).rows).toEqual([{ n: 0 }]);
    const r = await as(U.bia, "update public.notes set deleted_at = null, visibility = 'campaign' where id = $1 returning visibility, deleted_batch, deleted_at", [id]);   // tenta restaurar JÁ compartilhando
    expect(r.rows).toEqual([{ visibility: "private", deleted_batch: null, deleted_at: null }]);                    // volta SEMPRE privada
    expect((await as(U.caio, "select id from public.notes where id = $1", [id])).rows).toEqual([]);
    expect((await as(U.bia, "update public.notes set visibility = 'campaign' where id = $1 returning visibility", [id])).rows).toEqual([{ visibility: "campaign" }]);   // compartilhar é ação explícita e separada
    expect(await as(U.caio, "select id from public.notes where id = $1", [id]).then(r => r.rows)).toHaveLength(1);
  });
  it("nota na lixeira não pode ser editada nem recompartilhada; o lote e a data não mudam; só restaurar", async () => {
    const id = await mk(U.bia, "Na lixeira", { vis: "campaign", campaign: C1, content: [para("original")] });
    const lote = "99999999-0000-4000-8000-000000000002";
    await as(U.bia, "update public.notes set deleted_at = now(), deleted_batch = $2 where id = $1", [id, lote]);
    for (const col of ["title = 'x'", "visibility = 'campaign'", "kind = 'npc'", `content = '[]'::jsonb`, "content_schema = 2", "body = 'x'"])
      expect((await as(U.bia, `update public.notes set ${col} where id = $1`, [id])).error, col).toMatch(/nota_na_lixeira/);
    expect((await as(U.bia, "select content from public.notes where id = $1", [id])).rows).toEqual([{ content: [para("original")] }]);
    const r = await as(U.bia, "update public.notes set deleted_batch = gen_random_uuid() where id = $1 returning deleted_batch", [id]);
    expect(r.rows).toEqual([{ deleted_batch: lote }]);                                                            // o lote não é reescrito
    expect((await as(U.bia, "update public.notes set deleted_at = null where id = $1 returning deleted_at, deleted_batch", [id])).rows).toEqual([{ deleted_at: null, deleted_batch: null }]);
  });
  it("só o autor exclui e restaura (mestre e colegas não); restaurar com lote ou data inconsistente é recusado pelo banco", async () => {
    const id = await mk(U.bia, "Da Bia", { vis: "campaign", campaign: C1 });
    for (const who of [U.ana, U.caio, U.dora]) expect((await as(who, "update public.notes set deleted_at = now() where id = $1 returning id", [id])).rows, who).toEqual([]);
    await as(U.bia, "update public.notes set deleted_at = now() where id = $1", [id]);
    for (const who of [U.ana, U.caio, U.dora]) expect((await as(who, "update public.notes set deleted_at = null where id = $1 returning id", [id])).rows, who).toEqual([]);
    // mesmo com privilégio total, o banco mantém data e lote juntos (o gatilho os preserva; a constraint é a rede de segurança)
    expect((await db.query("update public.notes set deleted_batch = null where id = $1 returning deleted_at is not null and deleted_batch is not null as ok", [id])).rows).toEqual([{ ok: true }]);
  });
  it("a exclusão em lote identifica as notas excluídas juntas e restaurar o lote devolve só elas", async () => {
    const [a, b, c] = [await mk(U.bia, "L1"), await mk(U.bia, "L2"), await mk(U.bia, "L3")];
    const lote = "99999999-0000-4000-8000-000000000003";
    await as(U.bia, "update public.notes set deleted_at = now(), deleted_batch = $2 where id = any($1::uuid[])", [[a, b], lote]);
    await as(U.bia, "update public.notes set deleted_at = now() where id = $1", [c]);                          // outra exclusão, outro lote
    expect((await as(U.bia, "select id from public.notes where deleted_batch = $1 order by title", [lote])).rows.map(r => r.id)).toEqual([a, b]);
    await as(U.bia, "update public.notes set deleted_at = null where deleted_batch = $1", [lote]);
    expect((await as(U.bia, "select title from public.notes where title in ('L1','L2','L3') and deleted_at is null order by title")).rows).toEqual([{ title: "L1" }, { title: "L2" }]);
  });
  it("excluir a campanha continua apagando as notas por cascata (inclusive as na lixeira)", async () => {
    const camp = (await rpc(U.dora, "create_campaign", "Efêmera", "")).rows[0].r as string;
    const vivo = await mk(U.dora, "Viva", { campaign: camp }), morto = await mk(U.dora, "Morta", { campaign: camp });
    await as(U.dora, "update public.notes set deleted_at = now() where id = $1", [morto]);
    await as(U.dora, "delete from public.campaigns where id = $1", [camp]);
    expect((await db.query("select count(*)::int as n from public.notes where id = any($1::uuid[])", [[vivo, morto]])).rows).toEqual([{ n: 0 }]);
  });
});

describe("versões e conflitos de edição", () => {
  it("save_note_content grava e incrementa a versão; versão antiga dá 'conflito_de_versao' sem alterar nada", async () => {
    const id = await mk(U.bia, "Versão", { content: [para("v1")] });
    const ok = await rpc(U.bia, "save_note_content", id, 1, JSON.stringify([para("v2")]), 1, "Título novo");
    expect(ok.error).toBeUndefined();
    expect((await as(U.bia, "select version, title, body from public.notes where id = $1", [id])).rows).toEqual([{ version: 2, title: "Título novo", body: "v2" }]);
    const velho = await rpc(U.bia, "save_note_content", id, 1, JSON.stringify([para("dispositivo atrasado")]), 1, null);
    expect(velho.error).toMatch(/conflito_de_versao/);
    expect((await as(U.bia, "select version, body from public.notes where id = $1", [id])).rows).toEqual([{ version: 2, body: "v2" }]);
  });
  it("quem não é o autor recebe o mesmo erro de nota inexistente (sem oráculo) e nunca grava", async () => {
    const id = await mk(U.ana, "Do mestre", { vis: "campaign", campaign: C1, content: [para("m")] });
    const ghost = "00000000-0000-0000-0000-0000000000ff";
    for (const who of [U.bia, U.dora]) {
      expect((await rpc(who, "save_note_content", id, 1, "[]", 1, null)).error, who).toMatch(/nota_nao_encontrada/);
      expect((await rpc(who, "save_note_content", ghost, 1, "[]", 1, null)).error, who).toMatch(/nota_nao_encontrada/);
    }
    expect((await as(U.ana, "select version, body from public.notes where id = $1", [id])).rows).toEqual([{ version: 1, body: "m" }]);
    expect((await rpc(U.ana, "save_note_content", ghost, 1, "[]", 1, null)).error).toMatch(/nota_nao_encontrada/);
  });
  it("save_note_content respeita as validações (conteúdo inválido, lixeira) e anon não executa", async () => {
    const id = await mk(U.bia, "Valida", { content: [para("v1")] });
    expect((await rpc(U.bia, "save_note_content", id, 1, JSON.stringify([{ type: "paragraph", content: [{ type: "link", href: "javascript:x", content: [] }] }]), 1, null)).error).toMatch(/conteudo_link_invalido/);
    expect((await rpc(U.bia, "save_note_content", id, 1, JSON.stringify([para("ok")]), 0, null)).error).toMatch(/check constraint/);                     // content_schema fora de 1..100
    await as(U.bia, "update public.notes set deleted_at = now() where id = $1", [id]);
    const v = (await as(U.bia, "select version from public.notes where id = $1", [id])).rows[0].version;
    expect((await rpc(U.bia, "save_note_content", id, v, JSON.stringify([para("x")]), 1, null)).error).toMatch(/nota_na_lixeira/);
    expect((await as(null, "select * from public.save_note_content($1, 1, '[]'::jsonb)", [id])).error).toMatch(/permission denied/);
  });
  it("atualizações diretas continuam com controle otimista (where version = ?)", async () => {
    const id = await mk(U.bia, "Direta", { content: [para("a")] });
    expect((await as(U.bia, "update public.notes set content = $2::jsonb where id = $1 and version = 1 returning version", [id, JSON.stringify([para("b")])])).rows).toEqual([{ version: 2 }]);
    expect((await as(U.bia, "update public.notes set content = $2::jsonb where id = $1 and version = 1 returning version", [id, JSON.stringify([para("atrasado")])])).rows).toEqual([]);
  });
});

describe("regressão: a regra de leitura não mudou", () => {
  it("visibilidades continuam valendo (privada, mestre, campanha, selecionados) sobre notas com conteúdo", async () => {
    const priv = await mk(U.bia, "Priv", { vis: "private", campaign: C1, content: [para("a")] });
    const mestre = await mk(U.bia, "ParaMestre", { vis: "master", campaign: C1, content: [para("b")] });
    const camp = await mk(U.bia, "ParaTodos", { vis: "campaign", campaign: C1, content: [para("c")] });
    const ver = async (who: string) => (await as(who, "select title from public.notes where id = any($1::uuid[]) order by title", [[priv, mestre, camp]])).rows.map(r => r.title);
    expect(await ver(U.ana)).toEqual(["ParaMestre", "ParaTodos"]);
    expect(await ver(U.caio)).toEqual(["ParaTodos"]);
    expect(await ver(U.dora)).toEqual([]);
    expect(await ver(U.bia)).toEqual(["ParaMestre", "ParaTodos", "Priv"]);
  });
});

describe("contrato com o formato real do BlockNote (0.57.0)", () => {
  const doc = (campaign: string) => JSON.parse(bnFixture().replaceAll("00000000-0000-0000-0000-0000000000c1", campaign)) as Record<string, unknown>[];
  it("o documento real (parágrafo, títulos, listas aninhadas, checklist, tabela com células-objeto, links, imagens, citação, código) é aceito e volta idêntico", async () => {
    const content = doc(C1), tipos = content.map(b => b.type);
    expect(tipos).toEqual(["heading", "paragraph", "bulletListItem", "checkListItem", "table", "image", "image", "quote", "codeBlock"]);
    const r = await insertContent(U.ana, C1, content); expect(r.error).toBeUndefined();
    expect((await as(U.ana, "select content from public.notes where id = $1", [r.rows[0].id])).rows[0].content).toEqual(content);
  });
  it("o body derivado guarda o texto necessário para busca e prévia (aninhados, tabela, links, citação, código e legenda de imagem)", async () => {
    const r = await insertContent(U.ana, C1, doc(C1));
    const body = (await as(U.ana, "select body from public.notes where id = $1", [r.rows[0].id])).rows[0].body as string;
    for (const trecho of ["Taverna do Javali Cego", "A dona,", "Marta", ", sabe do ferreiro.", "Boato 1: luzes na floresta", "Só à noite", "Sempre perto da cabana", "Preparar o mapa",
      "Oferta", "Condição", "50 PO", "Resolver em 2 dias", "Favor", "Entrada na", "biblioteca", "Nunca confie em um goblin sorridente.", "d20 + 5", "Mapa da cripta", "Imagem ainda sem arquivo"])
      expect(body, trecho).toContain(trecho);
    expect(body).not.toMatch(/https?:|storage:|mapa\.png|default|left/);           // sem URLs, nomes de arquivo nem propriedades de formatação
    expect(body.length).toBeLessThan(600);
    const achada = await as(U.ana, "select id from public.notes where id = $1 and body ilike '%goblin sorridente%'", [r.rows[0].id]); expect(achada.rows).toHaveLength(1);
  });
  it("referências de arquivo do documento real: só a campanha da própria nota; outra campanha, URL externa e nota pessoal são recusadas", async () => {
    expect((await insertContent(U.ana, C1, doc(C2))).error).toMatch(/conteudo_referencia_externa/);                       // imagem aponta para a campanha C2
    const externa = doc(C1); (externa[5].props as Record<string, unknown>).url = "https://evil.example/x.png";
    expect((await insertContent(U.ana, C1, externa)).error).toMatch(/conteudo_referencia_externa/);
    expect((await insertContent(U.bia, null, doc(C1))).error).toMatch(/conteudo_referencia_externa/);                      // pessoal não tem arquivos de campanha
    const semArquivos = doc(C1).filter(b => b.type !== "image"); expect((await insertContent(U.bia, null, semArquivos)).error).toBeUndefined();
  });
  it("o salvamento com controle de versão aceita o documento real e recalcula o body", async () => {
    const id = await mk(U.ana, "Cena real", { campaign: C1, content: [para("começo")] });
    expect((await rpc(U.ana, "save_note_content", id, 1, JSON.stringify(doc(C1)), 1, null)).error).toBeUndefined();
    expect((await as(U.ana, "select version, body like '%Taverna do Javali Cego%' as ok from public.notes where id = $1", [id])).rows).toEqual([{ version: 2, ok: true }]);
  });
});

describe("D3: o autor é dono da nota; sair da campanha não tira a edição, mas não amplia o compartilhamento", () => {
  it("fora da campanha o autor edita conteúdo, título, tipo e usa a lixeira; ninguém mais lê; ele não compartilha de novo sem participar", async () => {
    const camp = (await rpc(U.dora, "create_campaign", "Mesa D3", "")).rows[0].r as string;
    const code = (await rpc(U.dora, "create_invite", camp, 5, 7)).rows[0].r as string; await rpc(U.caio, "join_campaign", code);
    const id = await mk(U.caio, "Do Caio", { vis: "campaign", campaign: camp, kind: "scene", content: [para("antes")] });
    expect(await as(U.dora, "select id from public.notes where id = $1", [id]).then(r => r.rows)).toHaveLength(1);
    await as(U.caio, "delete from public.campaign_members where user_id = $1 and campaign_id = $2", [U.caio, camp]);          // Caio sai
    expect((await as(U.dora, "select id from public.notes where id = $1", [id])).rows).toEqual([]);                           // compartilhamento suspenso
    const ed = await rpc(U.caio, "save_note_content", id, 1, JSON.stringify([para("depois da saída")]), 1, "Título novo");
    expect(ed.error).toBeUndefined();
    expect((await as(U.caio, "update public.notes set kind = 'npc' where id = $1 returning kind", [id])).rows).toEqual([{ kind: "npc" }]);
    expect((await as(U.caio, "update public.notes set visibility = 'private' where id = $1 returning visibility", [id])).rows).toEqual([{ visibility: "private" }]);   // reduzir é permitido
    expect((await as(U.caio, "update public.notes set visibility = 'campaign' where id = $1", [id])).error).toMatch(/compartilhar_exige_participacao/);             // ampliar, não
    expect((await as(U.caio, "update public.notes set deleted_at = now() where id = $1 returning deleted_at is not null as ok", [id])).rows).toEqual([{ ok: true }]);
    expect((await as(U.caio, "update public.notes set deleted_at = null where id = $1 returning visibility", [id])).rows).toEqual([{ visibility: "private" }]);
    expect((await as(U.caio, "insert into public.notes (campaign_id, title) values ($1, 'nova fora')", [camp])).error).toMatch(/row-level security/);           // criar na campanha ainda exige participação
    await rpc(U.caio, "join_campaign", (await rpc(U.dora, "create_invite", camp, 5, 7)).rows[0].r as string);                  // volta
    expect((await as(U.caio, "update public.notes set visibility = 'campaign' where id = $1 returning visibility", [id])).rows).toEqual([{ visibility: "campaign" }]);
    expect(await as(U.dora, "select title from public.notes where id = $1", [id]).then(r => r.rows)).toEqual([{ title: "Título novo" }]);
  });
  it("tipo (kind) e conteúdo nunca concedem acesso: o mestre não lê nota privada de jogador, seja qual for o tipo", async () => {
    const id = await mk(U.bia, "NPC privado da Bia", { vis: "private", campaign: C1, kind: "npc", content: [para("segredo")] });
    for (const k of ["npc", "page", "scene", "location", "faction", "event", "diary"]) {
      await as(U.bia, "update public.notes set kind = $2 where id = $1", [id, k]);
      expect((await as(U.ana, "select id from public.notes where id = $1", [id])).rows, k).toEqual([]);
      expect((await as(U.ana, "select id from public.notes where kind = $1 and campaign_id = $2 and owner_id = $3", [k, C1, U.bia])).rows, k).toEqual([]);
    }
  });
  it("a única política alterada em relação à 0004 é notes_update (só o autor); as demais continuam iguais", async () => {
    const r = await db.query<{ tablename: string; policyname: string; cmd: string; qual: string | null; with_check: string | null }>("select tablename, policyname, cmd, qual, with_check from pg_policies where schemaname = 'public' and tablename in ('notes', 'note_shares') order by tablename, policyname");
    expect(r.rows.map(x => x.policyname).sort()).toEqual(["notes_delete", "notes_insert", "notes_select", "notes_update", "shares_delete", "shares_insert", "shares_select"]);
    const up = r.rows.find(x => x.policyname === "notes_update")!;
    expect(up.qual).toMatch(/owner_id = auth\.uid\(\)/); expect(up.with_check).toMatch(/owner_id = auth\.uid\(\)/); expect(up.with_check).not.toMatch(/is_member/);
    expect(r.rows.find(x => x.policyname === "notes_insert")!.with_check).toMatch(/is_member/);           // criar na campanha continua exigindo participação
  });
});

describe("conteúdo não se perde em silêncio", () => {
  it("não é possível apagar o content com NULL (direto, pela função ou com privilégio total); esvaziar exige '[]'", async () => {
    const id = await mk(U.bia, "Protegida", { content: [para("importante")] });
    expect((await as(U.bia, "update public.notes set content = null where id = $1", [id])).error).toMatch(/conteudo_nao_pode_ser_apagado/);
    await expect(db.query("update public.notes set content = null where id = $1", [id])).rejects.toThrow(/conteudo_nao_pode_ser_apagado/);
    expect((await rpc(U.bia, "save_note_content", id, 1, null, 1, null)).error).toMatch(/conteudo_invalido/);
    expect((await rpc(U.bia, "save_note_content", id, 1, JSON.stringify({ nao: "array" }), 1, null)).error).toMatch(/conteudo_invalido/);
    expect((await as(U.bia, "select content, version from public.notes where id = $1", [id])).rows).toEqual([{ content: [para("importante")], version: 1 }]);
    expect((await as(U.bia, "update public.notes set content = '[]'::jsonb where id = $1 returning body", [id])).rows).toEqual([{ body: "" }]);
  });
  it("nota antiga (content nulo) pode ganhar conteúdo; depois dele não volta a ser só body", async () => {
    const id = (await as(U.bia, "insert into public.notes (title, body) values ('Legada', 'texto antigo') returning id")).rows[0].id as string;
    expect((await as(U.bia, "update public.notes set content = $2::jsonb where id = $1 returning body", [id, JSON.stringify([para("migrada")])])).rows).toEqual([{ body: "migrada" }]);
  });
  it("a lixeira não perde conteúdo: o content e o body continuam intactos depois de excluir e restaurar", async () => {
    const id = await mk(U.bia, "Ciclo", { content: [para("preservar")] });
    await as(U.bia, "update public.notes set deleted_at = now() where id = $1", [id]); await as(U.bia, "update public.notes set deleted_at = null where id = $1", [id]);
    expect((await as(U.bia, "select content, body from public.notes where id = $1", [id])).rows).toEqual([{ content: [para("preservar")], body: "preservar" }]);
  });
});

describe("rollback destrutivo exige confirmação", () => {
  it("sem dados novos roda direto e devolve a política da 0004; com dados exige backup + confirmação na sessão", async () => {
    const t = new PGlite(); await t.exec(stub);
    for (const f of files()) await t.exec(sql(f));
    for (const [n, id] of Object.entries(U)) await t.query("insert into auth.users (id, email) values ($1, $2)", [id, `${n}@x`]);
    const down = readFileSync(join(rollbackDir, "0005_notas_conteudo_down.sql"), "utf8");
    const camp = (await as(U.ana, "select public.create_campaign('R','') as r", [], t)).rows[0].r as string;
    const n1 = (await as(U.ana, "insert into public.notes (campaign_id, title) values ($1, 'sem dados novos') returning id", [camp], t)).rows[0].id;
    await t.exec(down);                                                                     // nada a perder: roda sem confirmação
    expect((await t.query("select title from public.notes where id = $1", [n1])).rows).toEqual([{ title: "sem dados novos" }]);
    const pol = (await t.query("select with_check from pg_policies where policyname = 'notes_update'")).rows[0].with_check as string;
    expect(pol).toMatch(/is_member/);                                                      // política da 0004 restaurada
    await t.exec(sql(files().find(f => f.startsWith("0005"))!));                           // reaplica
    await as(U.ana, "update public.notes set kind = 'npc' where id = $1", [n1], t);        // agora há dado novo
    await expect(t.exec(down)).rejects.toThrow(/rollback_0005_destrutivo/);
    await as(U.ana, "update public.notes set kind = 'note' where id = $1", [n1], t);
    await as(U.ana, "update public.notes set deleted_at = now() where id = $1", [n1], t);  // lixeira também conta como dado novo
    await expect(t.exec(down)).rejects.toThrow(/rollback_0005_destrutivo/);
  });
});

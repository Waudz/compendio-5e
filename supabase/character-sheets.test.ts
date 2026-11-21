// Migrações 0007 (base, já aplicada) e 0008 (proposta) de `character_sheets`, no Postgres em memória (PGlite), com papéis `anon`/`authenticated` e
// `auth.uid()` simulado por sessão. Dados FICTÍCIOS. Não é o Supabase hospedado: a 0008 NÃO foi aplicada lá; isto valida o SQL e as políticas.
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { beforeAll, describe, expect, it } from "vitest";
import { storageStub } from "./stub-storage";

const dir = join(__dirname, "migrations");
const U = { ana: "00000000-0000-0000-0000-00000000000a", bia: "00000000-0000-0000-0000-00000000000b", caio: "00000000-0000-0000-0000-00000000000c",
  dora: "00000000-0000-0000-0000-00000000000d", eva: "00000000-0000-0000-0000-00000000000e" };
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
const files = (ate?: string) => readdirSync(dir).filter(f => f.endsWith(".sql") && (!ate || f <= ate)).sort();
const sql = (f: string) => readFileSync(join(dir, f), "utf8");

type R = { rows: Record<string, unknown>[]; error?: string };
async function as(db: PGlite, uid: string | null, q: string, params: unknown[] = []): Promise<R> {
  await db.exec(`set role ${uid ? "authenticated" : "anon"}; select set_config('request.jwt.claim.sub', '${uid ?? ""}', false);`);
  try { return { rows: (await db.query<Record<string, unknown>>(q, params)).rows }; }
  catch (e) { return { rows: [], error: (e as Error).message }; }
  finally { await db.exec("reset role"); }
}
async function boot(ate?: string): Promise<PGlite> {
  const db = new PGlite(); await db.exec(stub);
  for (const f of files(ate)) await db.exec(sql(f));
  for (const [n, id] of Object.entries(U)) await db.query("insert into auth.users (id, email) values ($1, $2)", [id, `${n}@exemplo.com`]);
  return db;
}

const draft = (extra: Record<string, unknown> = {}) => ({ id: "provisorio", name: "Thorin Escudo-de-Pedra", level: 3, baseAbilities: { str: 15, dex: 12, con: 14, int: 10, wis: 12, cha: 8 },
  inventory: [{ id: "i1", itemId: "longsword", quantity: 1, equipped: false, origin: "acquired" }], currentHp: 13, ...extra });
const identidade = { title: "O Escudo", name: "Thorin" };

let db: PGlite, C1: string, C2: string;
const rpc = (uid: string, fn: string, ...a: unknown[]) => as(db, uid, `select public.${fn}(${a.map((_, i) => `$${i + 1}`).join(",")}) as r`, a);
/** Cria personagem guiado como `uid` (RPC atômica). Devolve o id do servidor. */
async function criar(uid: string, campaign = C1, o: { publish?: boolean; title?: string; meta?: unknown; draft?: unknown } = {}) {
  const r = await as(db, uid, "select * from public.create_guided_character($1, $2, $3::jsonb, $4, $5::jsonb)",
    [campaign, o.title ?? "O Escudo", JSON.stringify(o.meta ?? { identidadePublica: identidade }), o.publish ?? false, JSON.stringify(o.draft ?? draft())]);
  if (r.error) throw new Error(r.error);
  return r.rows[0] as { character_id: string; revision: number };
}
const salvar = (uid: string, id: string, rev: number, d: unknown, title: string | null = null, meta: unknown = null, publish: boolean | null = null) =>
  as(db, uid, "select * from public.save_guided_character($1, $2, $3::jsonb, $4, $5::jsonb, $6)", [id, rev, JSON.stringify(d), title, meta === null ? null : JSON.stringify(meta), publish]);
const sheet = (uid: string | null, id: string) => as(db, uid, "select character_id, owner_id, revision, draft from public.character_sheets where character_id = $1", [id]);

beforeAll(async () => {
  db = await boot();
  const code = async (cid: string) => (await rpc(U.ana, "create_invite", cid, 10, 7)).rows[0].r as string;
  C1 = (await rpc(U.ana, "create_campaign", "Mesa 1", "")).rows[0].r as string;       // mestre: ana
  const c = await code(C1);
  for (const u of [U.bia, U.caio, U.eva]) await rpc(u, "join_campaign", c);             // jogadores: bia, caio, eva (eva sairá)
  C2 = (await rpc(U.dora, "create_campaign", "Mesa de fora", "")).rows[0].r as string;   // dora: mestre de outra campanha
});

describe("estado remoto atual (só a 0007): fechado para a API", () => {
  it("authenticated e anon não leem nem gravam a tabela; a RLS está ligada", async () => {
    const f = await boot("0007_character_sheets_foundation.sql");
    for (const u of [U.ana, U.bia, null]) {
      expect((await as(f, u, "select * from public.character_sheets")).error, String(u)).toMatch(/permission denied/);
      expect((await as(f, u, "insert into public.character_sheets (character_id, campaign_id, owner_id, draft) values (gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), '{}')")).error).toMatch(/permission denied/);
    }
    expect((await f.query("select relrowsecurity from pg_class where oid = 'public.character_sheets'::regclass")).rows[0]).toEqual({ relrowsecurity: true });
    expect((await f.query("select count(*)::int as n from public.character_sheets")).rows[0]).toEqual({ n: 0 });
  });
});

describe("criação, leitura e atualização pelo dono", () => {
  it("o dono cria (ficha + identidade pública na mesma transação), lê e atualiza com revisão controlada pelo servidor", async () => {
    const { character_id: id, revision } = await criar(U.bia);
    expect(revision).toBe(1);
    const lida = (await sheet(U.bia, id)).rows[0];
    expect(lida.owner_id).toBe(U.bia); expect((lida.draft as { id: string }).id).toBe(id);          // draft.id vira o id do servidor
    expect((lida.draft as { name: string }).name).toBe("Thorin Escudo-de-Pedra");
    const r = await salvar(U.bia, id, 1, draft({ currentHp: 5 }));
    expect(r.error).toBeUndefined(); expect(r.rows[0].revision).toBe(2);
    expect((await sheet(U.bia, id)).rows[0]).toMatchObject({ revision: 2, draft: expect.objectContaining({ currentHp: 5, id }) });
  });
  it("a linha pública nasce privada e só leva a identidade pública (guiado + identidadePublica)", async () => {
    const { character_id: id } = await criar(U.bia);
    const n = (await as(db, U.bia, "select title, visibility, kind, meta from public.notes where id = $1", [id])).rows[0];
    expect(n).toEqual({ title: "O Escudo", visibility: "private", kind: "character", meta: { guiado: true, identidadePublica: identidade } });
  });
  it("revisão e datas só pertencem ao servidor: o cliente não grava revision nem updated_at, nem na criação nem na atualização", async () => {
    const { character_id: id } = await criar(U.bia);
    expect((await as(db, U.bia, "update public.character_sheets set revision = 99 where character_id = $1", [id])).error).toMatch(/permission denied/);
    expect((await as(db, U.bia, "update public.character_sheets set updated_at = now() where character_id = $1", [id])).error).toMatch(/permission denied/);
    const n = (await as(db, U.bia, "insert into public.notes (campaign_id, kind, title, meta) values ($1, 'character', 'x', '{\"guiado\":true}') returning id", [C1])).rows[0].id;
    expect((await as(db, U.bia, "insert into public.character_sheets (character_id, campaign_id, owner_id, draft, revision) values ($1, $2, $3, $4::jsonb, 50)", [n, C1, U.bia, JSON.stringify(draft({ id: n }))])).error).toMatch(/permission denied/);
  });
  it("ficha enorme (> 64 KiB) e draft que não é objeto são recusados; a nota pública não fica órfã (transação desfeita)", async () => {
    const antes = Number((await db.query("select count(*)::int as n from public.notes where kind = 'character'")).rows[0].n);
    const grande = await as(db, U.bia, "select * from public.create_guided_character($1, 'X', '{}'::jsonb, false, $2::jsonb)", [C1, JSON.stringify(draft({ lixo: "x".repeat(70000) }))]);
    expect(grande.error).toMatch(/character_sheets_draft_check/);
    expect((await as(db, U.bia, "select * from public.create_guided_character($1, 'X', '{}'::jsonb, false, '[]'::jsonb)", [C1])).error).toMatch(/ficha_invalida/);
    expect(Number((await db.query("select count(*)::int as n from public.notes where kind = 'character'")).rows[0].n)).toBe(antes);
  });
});

describe("isolamento: quem NÃO pode ler a ficha privada", () => {
  it("outro jogador da mesma campanha, usuário de outra campanha e anônimo não leem nem contam; nem com a identidade publicada", async () => {
    const { character_id: id } = await criar(U.bia, C1, { publish: true });
    for (const u of [U.caio, U.dora, null]) {
      expect((await sheet(u, id)).rows, String(u)).toHaveLength(0);
      const todas = await as(db, u, "select count(*)::int as n from public.character_sheets");
      if (u) expect(todas.rows[0]).toEqual({ n: 0 }); else expect(todas.error).toMatch(/permission denied/);
    }
    // a identidade pública publicada é lida pelos demais jogadores, mas só com os campos públicos
    const pub = (await as(db, U.caio, "select title, meta from public.notes where id = $1", [id])).rows[0];
    expect(pub).toEqual({ title: "O Escudo", meta: { guiado: true, identidadePublica: identidade } });
    expect(JSON.stringify(pub)).not.toMatch(/Escudo-de-Pedra|inventory|baseAbilities|currentHp/);
    expect((await as(db, U.dora, "select id from public.notes where id = $1", [id])).rows).toHaveLength(0);
  });
  it("outro jogador não consegue atualizar a ficha nem pelo RPC (erro igual ao de ficha inexistente: sem oráculo)", async () => {
    const { character_id: id } = await criar(U.bia);
    const direto = await as(db, U.caio, "update public.character_sheets set draft = '{}'::jsonb where character_id = $1 returning character_id", [id]);
    expect(direto.rows).toHaveLength(0);
    const viaRpc = await salvar(U.caio, id, 1, draft());
    const inexistente = await salvar(U.caio, "11111111-1111-4111-8111-111111111111", 1, draft());
    expect(viaRpc.error).toMatch(/ficha_nao_encontrada/); expect(inexistente.error).toMatch(/ficha_nao_encontrada/);
    for (const u of [U.dora, null]) expect((await salvar(u as string, id, 1, draft())).error).toBeTruthy();
    expect((await sheet(U.bia, id)).rows[0].revision).toBe(1);
  });
  it("jogador não cria ficha ligada à nota de outro, a uma nota simples, nem a outra campanha", async () => {
    const outro = await criar(U.bia);
    const simples = (await as(db, U.caio, "insert into public.notes (campaign_id, kind, title) values ($1, 'note', 'n') returning id", [C1])).rows[0].id as string;
    const ins = (uid: string, nota: string, campanha: string) => as(db, uid, "insert into public.character_sheets (character_id, campaign_id, owner_id, draft) values ($1, $2, $3, $4::jsonb)",
      [nota, campanha, uid, JSON.stringify(draft({ id: nota }))]);
    expect((await ins(U.caio, outro.character_id, C1)).error).toBeTruthy();       // nota de outro dono
    expect((await ins(U.caio, simples, C1)).error).toBeTruthy();                  // nota que não é de personagem guiado
    const minha = (await as(db, U.caio, "insert into public.notes (campaign_id, kind, title, meta) values ($1, 'character', 'm', '{\"guiado\":true}') returning id", [C1])).rows[0].id as string;
    expect((await ins(U.caio, minha, C2)).error).toBeTruthy();                    // campanha diferente da nota (e sem participação)
    expect((await ins(U.ana, minha, C1)).error).toBeTruthy();                     // o mestre não cria ficha em nome do jogador
    expect((await ins(U.caio, minha, C1)).error).toBeUndefined();                 // o caminho correto funciona
  });
});

describe("mestre da campanha", () => {
  it("lê e edita a ficha (revisão controlada), mas NÃO lê anotações privadas e NÃO altera a identidade pública", async () => {
    const { character_id: id } = await criar(U.bia);                                           // identidade privada (não publicada)
    expect((await sheet(U.ana, id)).rows).toHaveLength(1);                                     // vê a ficha
    expect((await as(db, U.ana, "select id from public.notes where id = $1", [id])).rows).toHaveLength(0);   // mas não a nota/identidade privada
    const nota = (await as(db, U.bia, "insert into public.notes (campaign_id, kind, title, visibility) values ($1, 'note', 'diário íntimo', 'private') returning id", [C1])).rows[0].id as string;
    expect((await as(db, U.ana, "select id from public.notes where id = $1", [nota])).rows).toHaveLength(0);
    const r = await salvar(U.ana, id, 1, draft({ currentHp: 1 }));
    expect(r.error).toBeUndefined(); expect(r.rows[0].revision).toBe(2);
    const dono = (await sheet(U.bia, id)).rows[0];
    expect(dono).toMatchObject({ revision: 2, owner_id: U.bia, draft: expect.objectContaining({ currentHp: 1 }) });   // a bia vê a edição do mestre, dona preservada
    const hack = await salvar(U.ana, id, 2, draft(), "Novo Nome Público", { identidadePublica: { title: "forjado" } }, true);
    expect(hack.error).toMatch(/identidade_so_do_dono/);
    const n = (await as(db, U.bia, "select title, visibility, meta from public.notes where id = $1", [id])).rows[0];
    expect(n).toEqual({ title: "O Escudo", visibility: "private", meta: { guiado: true, identidadePublica: identidade } });   // identidade intacta
    expect((await sheet(U.bia, id)).rows[0].revision).toBe(2);                                // a tentativa falha inteira (transação desfeita)
  });
  it("mestre de outra campanha não lê nem edita; o mestre não cria ficha de outro, nem apaga", async () => {
    const { character_id: id } = await criar(U.bia);
    expect((await sheet(U.dora, id)).rows).toHaveLength(0);
    expect((await salvar(U.dora, id, 1, draft())).error).toBeTruthy();
    expect((await as(db, U.ana, "delete from public.character_sheets where character_id = $1", [id])).error).toMatch(/permission denied/);
  });
});

describe("conflito de revisão e concorrência", () => {
  it("duas gravações com a mesma revisão esperada: a segunda recebe conflito e NADA é sobrescrito", async () => {
    const { character_id: id } = await criar(U.bia);
    expect((await salvar(U.bia, id, 1, draft({ currentHp: 10 }))).error).toBeUndefined();
    const velha = await salvar(U.bia, id, 1, draft({ currentHp: 99 }));
    expect(velha.error).toMatch(/conflito_de_revisao/);
    expect((await sheet(U.bia, id)).rows[0]).toMatchObject({ revision: 2, draft: expect.objectContaining({ currentHp: 10 }) });
  });
  it("dono e mestre editando ao mesmo tempo: quem chega com revisão antiga recebe conflito", async () => {
    const { character_id: id } = await criar(U.bia);
    expect((await salvar(U.ana, id, 1, draft({ currentHp: 3 }))).error).toBeUndefined();     // mestre grava primeiro
    expect((await salvar(U.bia, id, 1, draft({ currentHp: 8 }))).error).toMatch(/conflito_de_revisao/);   // dona ficou com a revisão 1
    expect((await salvar(U.bia, id, 2, draft({ currentHp: 8 }))).error).toBeUndefined();      // depois de recarregar, grava
  });
  it("o conflito não revela ficha alheia: para quem não lê, o erro é o de inexistente", async () => {
    const { character_id: id } = await criar(U.bia);
    expect((await salvar(U.caio, id, 7, draft())).error).toMatch(/ficha_nao_encontrada/);
  });
});

describe("imutabilidade de proprietário, campanha e personagem", () => {
  it("o cliente não consegue trocar owner_id, campaign_id nem character_id (sem privilégio de coluna)", async () => {
    const { character_id: id } = await criar(U.bia);
    for (const col of ["owner_id", "campaign_id", "character_id", "created_at"]) {
      const valor = col === "owner_id" ? `'${U.caio}'` : col === "campaign_id" ? `'${C2}'` : col === "character_id" ? "gen_random_uuid()" : "now()";
      expect((await as(db, U.bia, `update public.character_sheets set ${col} = ${valor} where character_id = $1`, [id])).error, col).toMatch(/permission denied/);
      expect((await as(db, U.ana, `update public.character_sheets set ${col} = ${valor} where character_id = $1`, [id])).error, `mestre ${col}`).toMatch(/permission denied/);
    }
  });
  it("nem papéis privilegiados trocam esses campos: o gatilho recusa até para o dono do banco", async () => {
    const { character_id: id } = await criar(U.bia);
    for (const set of [`owner_id = '${U.caio}'`, `campaign_id = '${C2}'`, "character_id = gen_random_uuid()", "created_at = now() - interval '1 day'"]) {
      await expect(db.query(`update public.character_sheets set ${set} where character_id = $1`, [id]), set).rejects.toThrow(/campos_imutaveis|violates foreign key|character_sheets_/);
    }
    expect((await sheet(U.bia, id)).rows[0].owner_id).toBe(U.bia);
  });
  it("draft.id precisa coincidir com character_id (ficha não pode apontar para outro personagem)", async () => {
    const { character_id: id } = await criar(U.bia);
    await expect(db.query("update public.character_sheets set draft = jsonb_set(draft, '{id}', '\"outro\"') where character_id = $1", [id])).rejects.toThrow(/character_sheets_draft_id_check/);
  });
  it("a nota do personagem não pode ser apagada enquanto existir a ficha (exclusão não é atalho)", async () => {
    const { character_id: id } = await criar(U.bia);
    expect((await as(db, U.bia, "delete from public.notes where id = $1", [id])).error).toBeTruthy();
    expect((await as(db, U.bia, "delete from public.character_sheets where character_id = $1", [id])).error).toMatch(/permission denied/);
    expect((await sheet(U.bia, id)).rows).toHaveLength(1);
  });
});

describe("identidade pública separada da ficha privada", () => {
  it("o dono publica, despublica e altera a identidade; a ficha privada nunca aparece em notes", async () => {
    const { character_id: id } = await criar(U.bia);
    expect((await as(db, U.caio, "select id from public.notes where id = $1", [id])).rows).toHaveLength(0);
    const r = await salvar(U.bia, id, 1, draft(), "Cavaleiro Misterioso", { identidadePublica: { title: "Cavaleiro Misterioso" } }, true);
    expect(r.error).toBeUndefined();
    expect((await as(db, U.caio, "select title, meta from public.notes where id = $1", [id])).rows[0]).toEqual({ title: "Cavaleiro Misterioso", meta: { guiado: true, identidadePublica: { title: "Cavaleiro Misterioso" } } });
    expect((await salvar(U.bia, id, 2, draft(), null, null, false)).error).toBeUndefined();
    expect((await as(db, U.caio, "select id from public.notes where id = $1", [id])).rows).toHaveLength(0);       // despublicada
  });
  it("a edição da ficha SEM identidade preserva a identidade pública como estava", async () => {
    const { character_id: id } = await criar(U.bia, C1, { publish: true });
    expect((await salvar(U.bia, id, 1, draft({ name: "Outro nome real" }))).error).toBeUndefined();
    expect((await as(db, U.caio, "select title, meta from public.notes where id = $1", [id])).rows[0]).toEqual({ title: "O Escudo", meta: { guiado: true, identidadePublica: identidade } });
  });
  it("meta de personagem guiado não aceita dados privados: ficha, inventário e atributos são barrados pela CHECK (também em UPDATE direto)", async () => {
    const { character_id: id } = await criar(U.bia, C1, { publish: true });
    for (const meta of [{ guiado: true, inventario: ["Espada"] }, { guiado: true, baseAbilities: { str: 15 } }, { guiado: true, draft: {} }, { guiado: true, nivel: 3 }]) {
      expect((await as(db, U.bia, "update public.notes set meta = $2::jsonb where id = $1", [id, JSON.stringify(meta)])).error, JSON.stringify(meta)).toMatch(/notes_guiado_meta_check/);
    }
    expect((await as(db, U.bia, "select * from public.create_guided_character($1, 'X', $2::jsonb, true, $3::jsonb)", [C1, JSON.stringify({ inventario: ["x"] }), JSON.stringify(draft())])).error).toMatch(/notes_guiado_meta_check/);
    // personagens simples (sem `guiado`) continuam livres: nada do legado muda
    expect((await as(db, U.bia, "insert into public.notes (campaign_id, kind, title, meta) values ($1, 'character', 'simples', '{\"classe\":\"Mago\",\"nivel\":2,\"inventario\":[\"Cajado\"]}') returning id", [C1])).error).toBeUndefined();
  });
});

describe("ex-participante e saída da campanha", () => {
  it("quem sai da campanha perde o acesso à ficha e ao RPC; a ficha continua no banco e o mestre continua lendo", async () => {
    const { character_id: id } = await criar(U.eva, C1, { publish: true });
    expect((await sheet(U.eva, id)).rows).toHaveLength(1);
    expect((await as(db, U.eva, "delete from public.campaign_members where campaign_id = $1 and user_id = $2 returning user_id", [C1, U.eva])).rows).toHaveLength(1);   // eva sai
    expect((await sheet(U.eva, id)).rows).toHaveLength(0);
    expect((await salvar(U.eva, id, 1, draft())).error).toBeTruthy();
    expect((await as(db, U.eva, "select count(*)::int as n from public.character_sheets")).rows[0]).toEqual({ n: 0 });
    expect((await sheet(U.ana, id)).rows[0]).toMatchObject({ owner_id: U.eva, revision: 1 });     // preservada; mestre continua com acesso
    expect((await as(db, U.caio, "select id from public.notes where id = $1", [id])).rows).toHaveLength(0);   // identidade suspensa: dono fora da campanha (0004)
  });
  it("ex-participante não cria personagem guiado novo", async () => {
    await expect(criar(U.eva)).rejects.toThrow();
  });
});

describe("usuário anônimo", () => {
  it("não lê, não cria e não chama as funções", async () => {
    const { character_id: id } = await criar(U.bia);
    expect((await sheet(null, id)).error).toMatch(/permission denied/);
    expect((await as(db, null, "select * from public.create_guided_character($1, 'x', '{}'::jsonb, false, '{}'::jsonb)", [C1])).error).toMatch(/permission denied/);
    expect((await as(db, null, "select * from public.save_guided_character($1, 1, '{}'::jsonb)", [id])).error).toMatch(/permission denied/);
  });
});

describe("reversões", () => {
  it("a reversão da 0008 não apaga dados, volta ao estado fechado e a 0008 pode ser reaplicada; a da 0007 exige confirmação com dados", async () => {
    const t = await boot();
    const as2 = (uid: string, q: string, p: unknown[] = []) => as(t, uid, q, p);
    const c = (await as2(U.ana, "select public.create_campaign('M','') as r")).rows[0].r as string;
    const code = (await as2(U.ana, "select public.create_invite($1, 5, 7) as r", [c])).rows[0].r as string;
    await as2(U.bia, "select public.join_campaign($1)", [code]);
    const criado = await as2(U.bia, "select * from public.create_guided_character($1, 'X', '{}'::jsonb, false, $2::jsonb)", [c, JSON.stringify(draft())]);
    expect(criado.error).toBeUndefined();
    const down = (f: string) => readFileSync(join(__dirname, "rollback", f), "utf8");
    await t.exec(down("0008_character_sheets_persistencia_down.sql"));
    expect((await t.query("select count(*)::int as n from public.character_sheets")).rows[0]).toEqual({ n: 1 });               // dados preservados
    expect((await as2(U.bia, "select * from public.character_sheets")).error).toMatch(/permission denied/);                    // fechado de novo
    expect((await t.query("select count(*)::int as n from pg_proc where proname in ('create_guided_character','save_guided_character','character_sheets_guard')")).rows[0]).toEqual({ n: 0 });
    await t.exec(sql("0008_character_sheets_persistencia.sql"));                                                              // reaplicável
    expect((await as2(U.bia, "select character_id from public.character_sheets")).rows).toHaveLength(1);
    await t.exec(down("0008_character_sheets_persistencia_down.sql"));
    await expect(t.exec(down("0007_character_sheets_foundation_down.sql"))).rejects.toThrow(/rollback_0007_destrutivo/);
    await t.exec("set compendio.confirmar_rollback_0007 = 'sim'"); await t.exec(down("0007_character_sheets_foundation_down.sql"));
    expect((await t.query("select count(*)::int as n from pg_class where relname = 'character_sheets'")).rows[0]).toEqual({ n: 0 });
  });
});

describe("compatibilidade da 0008 com a estrutura REAL da 0007 (o SQL remoto original não está versionado)", () => {
  const aplica = (t: PGlite) => t.exec(sql("0008_character_sheets_persistencia.sql"));
  const intacto = async (t: PGlite) => Number((await t.query("select count(*)::int as n from pg_constraint where conname in ('notes_id_campaign_uniq','notes_guiado_meta_check')")).rows[0].n) === 0;
  const comBase = () => boot("0007_character_sheets_foundation.sql");

  it("estrutura divergente aborta a migração inteira com mensagem clara e NÃO altera nada (tipo de coluna, coluna ausente, RLS desligada)", async () => {
    for (const [ddl, esperado] of [
      ["alter table public.character_sheets drop constraint character_sheets_revision_check; alter table public.character_sheets alter column revision type text using revision::text", /coluna revision deve ser integer\/bigint/],
      ["alter table public.character_sheets drop constraint character_sheets_draft_check; alter table public.character_sheets alter column draft type text using draft::text", /coluna draft esperada como jsonb/],
      ["alter table public.character_sheets drop column owner_id cascade", /coluna owner_id esperada como uuid, encontrada: ausente/],
      ["alter table public.character_sheets disable row level security", /RLS desligada/],
    ] as const) {
      const t = await comBase();
      await t.exec(ddl);
      await expect(aplica(t), ddl).rejects.toThrow(esperado);
      expect(await intacto(t), ddl).toBe(true);
    }
  });
  it("gatilho desconhecido (ex.: um de revisão/data da 0007 original) aborta, para não haver dois donos de `revision`", async () => {
    const t = await comBase();
    await t.exec("create function public.zz_touch() returns trigger language plpgsql as $$ begin new.updated_at := now(); return new; end $$; create trigger zz_touch before update on public.character_sheets for each row execute function public.zz_touch();");
    await expect(aplica(t)).rejects.toThrow(/gatilhos desconhecidos.*zz_touch/);
    expect(await intacto(t)).toBe(true);
  });
  it("políticas com nomes diferentes dos esperados são TODAS substituídas (uma política permissiva esquecida não sobrevive)", async () => {
    const t = await comBase();
    await t.exec("create policy zz_leitura_total on public.character_sheets for select to authenticated using (true); grant select on public.character_sheets to authenticated;");
    await aplica(t);
    expect((await t.query("select policyname from pg_policies where tablename = 'character_sheets' order by 1")).rows.map(r => r.policyname)).toEqual(["character_sheets_insert", "character_sheets_select", "character_sheets_update"]);
    const c = (await as(t, U.ana, "select public.create_campaign('M','') as r")).rows[0].r as string;
    const code = (await as(t, U.ana, "select public.create_invite($1, 5, 7) as r", [c])).rows[0].r as string;
    for (const u of [U.bia, U.caio]) await as(t, u, "select public.join_campaign($1)", [code]);
    const id = (await as(t, U.bia, "select * from public.create_guided_character($1, 'X', '{}'::jsonb, false, $2::jsonb)", [c, JSON.stringify(draft())])).rows[0].character_id as string;
    expect((await as(t, U.caio, "select character_id from public.character_sheets where character_id = $1", [id])).rows).toHaveLength(0);
  });
  it("sem chave única em character_id (a 0007 real pode não ter PK), a 0008 garante uma ficha por personagem", async () => {
    const t = await comBase();
    await t.exec("alter table public.character_sheets drop constraint character_sheets_pkey");
    await aplica(t);
    expect((await t.query("select count(*)::int as n from pg_indexes where tablename = 'character_sheets' and indexdef ilike '%unique%(character_id)%'")).rows[0]).toEqual({ n: 1 });
  });
  it("linhas já existentes na 0007 são preservadas e passam a funcionar com revisão e RPC", async () => {
    const t = await comBase();
    const c = (await as(t, U.ana, "select public.create_campaign('M','') as r")).rows[0].r as string;
    const code = (await as(t, U.ana, "select public.create_invite($1, 5, 7) as r", [c])).rows[0].r as string;
    await as(t, U.bia, "select public.join_campaign($1)", [code]);
    const nota = (await as(t, U.bia, "insert into public.notes (campaign_id, kind, title, meta) values ($1, 'character', 'Antigo', '{\"guiado\":true}') returning id", [c])).rows[0].id as string;
    await t.query("insert into public.character_sheets (character_id, campaign_id, owner_id, draft, revision) values ($1, $2, $3, $4::jsonb, 4)", [nota, c, U.bia, JSON.stringify(draft({ id: nota }))]);
    await aplica(t);
    expect((await as(t, U.bia, "select revision, owner_id from public.character_sheets where character_id = $1", [nota])).rows).toEqual([{ revision: 4, owner_id: U.bia }]);
    const r = await as(t, U.bia, "select * from public.save_guided_character($1, 4, $2::jsonb)", [nota, JSON.stringify(draft({ id: nota, currentHp: 1 }))]);
    expect(r.error).toBeUndefined(); expect(r.rows[0].revision).toBe(5);
  });
  it("linha existente com draft.id diferente do character_id impede a migração (falha segura, sem corrigir dados em silêncio)", async () => {
    const t = await comBase();
    const c = (await as(t, U.ana, "select public.create_campaign('M','') as r")).rows[0].r as string;
    await as(t, U.bia, "select public.join_campaign($1)", [(await as(t, U.ana, "select public.create_invite($1, 5, 7) as r", [c])).rows[0].r]);
    const nota = (await as(t, U.bia, "insert into public.notes (campaign_id, kind, title) values ($1, 'character', 'x') returning id", [c])).rows[0].id as string;
    await t.query("insert into public.character_sheets (character_id, campaign_id, owner_id, draft) values ($1, $2, $3, '{\"id\":\"outro\"}'::jsonb)", [nota, c, U.bia]);
    await expect(aplica(t)).rejects.toThrow(/character_sheets_draft_id_check/);
    expect(await intacto(t)).toBe(true);
  });
});

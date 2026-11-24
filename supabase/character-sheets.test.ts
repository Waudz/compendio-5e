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
/** Identidade pública VÁLIDA (formato que o cliente envia: configurações + cartão resolvido). */
const idTitulo = (titulo: string, nome: string | null = null) => ({
  settings: { imageUrl: null, title: titulo, name: { mode: nome ? "real" : "hidden" }, surname: { mode: "hidden" }, race: { mode: "hidden" }, characterClass: { mode: "hidden" }, description: "" },
  card: { imageUrl: null, title: titulo, name: nome, surname: null, race: null, characterClass: null, description: "" },
});
const identidade = idTitulo("O Escudo", "Thorin");

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
    const hack = await salvar(U.ana, id, 2, draft(), "Novo Nome Público", { identidadePublica: idTitulo("forjado") }, true);
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
    const r = await salvar(U.bia, id, 1, draft(), "ignorado", { identidadePublica: idTitulo("Cavaleiro Misterioso") }, true);
    expect(r.error).toBeUndefined();
    expect((await as(db, U.caio, "select title, meta from public.notes where id = $1", [id])).rows[0]).toEqual({ title: "Cavaleiro Misterioso", meta: { guiado: true, identidadePublica: idTitulo("Cavaleiro Misterioso") } });
    expect((await salvar(U.bia, id, 2, draft(), null, null, false)).error).toBeUndefined();
    expect((await as(db, U.caio, "select id from public.notes where id = $1", [id])).rows).toHaveLength(0);       // despublicada
  });
  it("a edição da ficha SEM identidade preserva a identidade pública como estava", async () => {
    const { character_id: id } = await criar(U.bia, C1, { publish: true });
    expect((await salvar(U.bia, id, 1, draft({ name: "Outro nome real" }))).error).toBeUndefined();
    expect((await as(db, U.caio, "select title, meta from public.notes where id = $1", [id])).rows[0]).toEqual({ title: "O Escudo", meta: { guiado: true, identidadePublica: identidade } });
  });
  it("meta de personagem guiado não aceita dados privados: ficha, inventário e atributos são barrados em UPDATE direto e na criação", async () => {
    const { character_id: id } = await criar(U.bia, C1, { publish: true });
    for (const meta of [{ guiado: true, inventario: ["Espada"] }, { guiado: true, baseAbilities: { str: 15 } }, { guiado: true, draft: {} }, { guiado: true, nivel: 3 }]) {
      expect((await as(db, U.bia, "update public.notes set meta = $2::jsonb where id = $1", [id, JSON.stringify(meta)])).error, JSON.stringify(meta)).toMatch(/identidade_invalida/);
    }
    expect((await as(db, U.bia, "select * from public.create_guided_character($1, 'X', $2::jsonb, true, $3::jsonb)", [C1, JSON.stringify({ inventario: ["x"] }), JSON.stringify(draft())])).error).toMatch(/identidade_invalida/);
    // personagens simples (sem ficha) continuam livres: nada do legado muda
    expect((await as(db, U.bia, "insert into public.notes (campaign_id, kind, title, meta) values ($1, 'character', 'simples', '{\"classe\":\"Mago\",\"nivel\":2,\"inventario\":[\"Cajado\"]}') returning id", [C1])).error).toBeUndefined();
  });
});

describe("invariantes da linha pública presas à EXISTÊNCIA da ficha (bloqueios do PR #80)", () => {
  const mut = (f: (i: any) => void) => { const i = structuredClone(identidade) as any; f(i); return { guiado: true, identidadePublica: i }; };
  const nota = async (uid: string, id: string) => (await as(db, uid, "select title, kind, visibility, deleted_at, meta from public.notes where id = $1", [id])).rows[0];

  it("remover o marcador `guiado` (ou trocá-lo) NÃO desliga a proteção: a nota com ficha continua restrita à identidade pública", async () => {
    const { character_id: id } = await criar(U.bia, C1, { publish: true });
    const base = { guiado: true, identidadePublica: identidade };
    for (const meta of [{ identidadePublica: identidade }, {}, { guiado: false, identidadePublica: identidade }, { guiado: "true", identidadePublica: identidade },
                        { ...base, inventario: ["Espada"] }, { ...base, draft: {} }, { ...base, nivel: 3 }, { guiado: true, inventario: [] }]) {
      expect((await as(db, U.bia, "update public.notes set meta = $2::jsonb where id = $1", [id, JSON.stringify(meta)])).error, JSON.stringify(meta)).toMatch(/identidade_invalida/);
    }
    expect((await nota(U.bia, id)).meta).toEqual({ guiado: true, identidadePublica: identidade });   // intacta
  });
  it("identidade malformada é recusada em UPDATE direto: chave extra, tipo errado, imagem não-https, modo inválido, textos grandes, estrutura incompleta", async () => {
    const { character_id: id } = await criar(U.bia, C1, { publish: true });
    const ruins = [
      mut(i => { i.card.nivel = 3; }), mut(i => { i.settings.vida = 10; }), mut(i => { i.card.name = 5; }), mut(i => { i.card.imageUrl = "http://exemplo.com/a.png"; }),
      mut(i => { i.card.imageUrl = "javascript:alert(1)"; }), mut(i => { i.settings.imageUrl = "https://x.com/a b.png"; }), mut(i => { i.settings.name.mode = "xyz"; }),
      mut(i => { i.settings.name.extra = 1; }), mut(i => { i.settings.name.customValue = 7; }), mut(i => { i.card.description = "x".repeat(4001); }),
      mut(i => { i.card.title = "x".repeat(121); }), mut(i => { delete i.settings.race; }), mut(i => { delete i.card.surname; }), mut(i => { i.extra = {}; }),
      { guiado: true, identidadePublica: [] }, { guiado: true, identidadePublica: null }, { guiado: true, identidadePublica: { settings: identidade.settings } },
    ];
    for (const meta of ruins) expect((await as(db, U.bia, "update public.notes set meta = $2::jsonb where id = $1", [id, JSON.stringify(meta)])).error, JSON.stringify(meta)).toMatch(/identidade_invalida/);
    expect((await nota(U.bia, id)).meta).toEqual({ guiado: true, identidadePublica: identidade });
  });
  it("identidade válida e imagem https são aceitas (a validação não é restritiva demais)", async () => {
    const { character_id: id } = await criar(U.bia, C1, { publish: true });
    const ok = mut(i => { i.card.imageUrl = "https://exemplo.com/retrato.png"; i.settings.imageUrl = "https://exemplo.com/retrato.png"; i.card.description = "Um anão de poucas palavras."; i.settings.description = i.card.description; i.settings.name = { mode: "custom", customValue: "Alcunha" }; });
    expect((await as(db, U.bia, "update public.notes set meta = $2::jsonb where id = $1", [id, JSON.stringify(ok)])).error).toBeUndefined();
    expect((await nota(U.bia, id)).meta).toEqual(ok);
  });
  it("tipo, dono e campanha da nota com ficha são imutáveis; a nota não é excluída (soft-delete) nem apagada", async () => {
    const { character_id: id } = await criar(U.bia, C1, { publish: true });
    expect((await as(db, U.bia, "update public.notes set kind = 'note' where id = $1", [id])).error).toMatch(/personagem_guiado_imutavel/);
    expect((await as(db, U.bia, `update public.notes set owner_id = '${U.caio}' where id = $1`, [id])).error).toMatch(/permission denied/);
    expect((await as(db, U.bia, `update public.notes set campaign_id = '${C2}' where id = $1`, [id])).error).toMatch(/permission denied|imutavel|campaign/i);
    expect((await as(db, U.bia, "update public.notes set deleted_at = now(), deleted_batch = gen_random_uuid() where id = $1", [id])).error).toMatch(/personagem_guiado_nao_exclui/);
    expect((await as(db, U.bia, "delete from public.notes where id = $1", [id])).error).toBeTruthy();
    const n = await nota(U.bia, id);
    expect(n).toMatchObject({ kind: "character", deleted_at: null });
  });
  it("o título da nota é sempre derivado da identidade: UPDATE direto com o nome real não vaza", async () => {
    const { character_id: id } = await criar(U.bia, C1, { publish: true });
    expect((await as(db, U.bia, "update public.notes set title = 'Thorin Escudo-de-Pedra' where id = $1", [id])).error).toBeUndefined();
    expect((await as(db, U.caio, "select title from public.notes where id = $1", [id])).rows[0]).toEqual({ title: "O Escudo" });
  });
  it("nota soft-deletada por caminho privilegiado: salvar (dono, mestre, RPC e UPDATE direto) e vincular nova ficha são recusados", async () => {
    const { character_id: id } = await criar(U.bia, C1);
    await db.exec("alter table public.notes disable trigger notes_zz_ficha_guard");
    await db.query("update public.notes set deleted_at = now(), deleted_batch = gen_random_uuid() where id = $1", [id]);   // simula exclusão que escapou do gatilho
    await db.exec("alter table public.notes enable trigger notes_zz_ficha_guard");
    expect((await salvar(U.bia, id, 1, draft())).error).toBeTruthy();                          // dono
    expect((await salvar(U.ana, id, 1, draft())).error).toBeTruthy();                          // mestre (que nem lê a nota privada: a função DEFINER a enxerga)
    expect((await as(db, U.bia, "update public.character_sheets set draft = $2::jsonb where character_id = $1", [id, JSON.stringify(draft({ id }))])).error ?? "ok").toMatch(/row-level security|violates|ok/);
    const direto = await as(db, U.ana, "update public.character_sheets set draft = $2::jsonb where character_id = $1 returning revision", [id, JSON.stringify(draft({ id }))]);
    expect(direto.rows.length === 0 || !!direto.error).toBe(true);
    expect((await db.query("select revision from public.character_sheets where character_id = $1", [id])).rows[0]).toEqual({ revision: 1 });   // nada gravado
    // nova ficha para uma nota já excluída
    const outra = (await as(db, U.caio, "insert into public.notes (campaign_id, kind, title, meta) values ($1, 'character', 'x', '{\"guiado\":true}') returning id", [C1])).rows[0].id as string;
    await db.query("update public.notes set deleted_at = now(), deleted_batch = gen_random_uuid() where id = $1", [outra]);
    expect((await as(db, U.caio, "insert into public.character_sheets (character_id, campaign_id, owner_id, draft) values ($1, $2, $3, $4::jsonb)", [outra, C1, U.caio, JSON.stringify(draft({ id: outra }))])).error).toMatch(/row-level security/);
  });
  it("não nasce ficha para nota com meta inválido, mesmo que o marcador exista: a conferência é do conteúdo, não do marcador", async () => {
    const ins = (meta: unknown) => as(db, U.caio, "insert into public.notes (campaign_id, kind, title, meta) values ($1, 'character', 'x', $2::jsonb) returning id", [C1, JSON.stringify(meta)]);
    const ficha = (uid: string, nid: string) => as(db, uid, "insert into public.character_sheets (character_id, campaign_id, owner_id, draft) values ($1, $2, $3, $4::jsonb)", [nid, C1, uid, JSON.stringify(draft({ id: nid }))]);
    for (const meta of [{ inventario: ["x"] }, {}, { guiado: true, identidadePublica: { card: { nivel: 3 }, settings: {} } }]) {
      const r = await ins(meta); if (r.error) continue;                                          // se a CHECK já barra a nota, ótimo
      expect((await ficha(U.caio, r.rows[0].id as string)).error, JSON.stringify(meta)).toMatch(/row-level security/);
    }
    expect((await ficha(U.caio, (await ins({ guiado: true })).rows[0].id as string)).error).toBeUndefined();   // caminho válido
  });
  it("RPCs: p_meta inválido é recusado (criar e salvar), o título vem do servidor, `guiado` é imposto pelo servidor e a ficha não muda se a identidade for inválida", async () => {
    const criaCom = (meta: unknown, titulo: string | null = "Thorin Escudo-de-Pedra") => as(db, U.bia, "select * from public.create_guided_character($1, $2, $3::jsonb, true, $4::jsonb)", [C1, titulo, meta === null ? null : JSON.stringify(meta), JSON.stringify(draft())]);
    expect((await criaCom({ identidadePublica: identidade, inventario: [] })).error).toMatch(/identidade_invalida/);
    expect((await criaCom({ identidadePublica: mut(i => { i.card.imageUrl = "http://x.com/a.png"; }).identidadePublica })).error).toMatch(/identidade_invalida/);
    expect((await criaCom([])).error).toMatch(/identidade_invalida/);
    const antes = Number((await db.query("select count(*)::int as n from public.notes where kind = 'character'")).rows[0].n);
    // título e marcador: p_title é ignorado; guiado:false é sobrescrito por true
    const r = await criaCom({ guiado: false, identidadePublica: identidade }, "Thorin Escudo-de-Pedra");
    expect(r.error).toBeUndefined();
    const id = r.rows[0].character_id as string;
    expect(await nota(U.bia, id)).toMatchObject({ title: "O Escudo", meta: { guiado: true, identidadePublica: identidade } });
    expect(Number((await db.query("select count(*)::int as n from public.notes where kind = 'character'")).rows[0].n)).toBe(antes + 1);
    // sem identidade: título 'Personagem'
    const s2 = await criaCom(null); expect(s2.error).toBeUndefined();
    expect((await nota(U.bia, s2.rows[0].character_id as string)).title).toBe("Personagem");
    // salvar com identidade inválida: nada muda (revisão e identidade)
    const sv = await salvar(U.bia, id, 1, draft({ currentHp: 3 }), null, { identidadePublica: mut(i => { i.card.nivel = 3; }).identidadePublica }, null);
    expect(sv.error).toMatch(/identidade_invalida/);
    expect((await sheet(U.bia, id)).rows[0].revision).toBe(1);
    expect((await salvar(U.bia, id, 1, draft(), null, [] as never, null)).error).toBeTruthy();
    // p_title sozinho (sem p_meta) não altera o título
    expect((await salvar(U.bia, id, 1, draft(), "Nome real vazado", null, null)).error).toBeUndefined();
    expect((await nota(U.bia, id)).title).toBe("O Escudo");
  });
  it("com a ficha publicada, os demais jogadores leem da nota SÓ { guiado, identidadePublica } (e nenhum campo privado)", async () => {
    const { character_id: id } = await criar(U.bia, C1, { publish: true });
    const n = (await as(db, U.caio, "select meta from public.notes where id = $1", [id])).rows[0].meta as Record<string, unknown>;
    expect(Object.keys(n).sort()).toEqual(["guiado", "identidadePublica"]);
    expect(Object.keys((n.identidadePublica as Record<string, unknown>)).sort()).toEqual(["card", "settings"]);
  });
});

describe("schema private e funções SECURITY DEFINER", () => {
  it("as funções de apoio ficam em `private`, não são executáveis por anon, e as definer têm search_path fixo e são só booleanas", async () => {
    const r = await db.query<{ nome: string; definer: boolean; anon: boolean; auth: boolean; cfg: string[] | null }>(
      "select p.proname as nome, p.prosecdef as definer, has_function_privilege('anon', p.oid, 'execute') as anon, has_function_privilege('authenticated', p.oid, 'execute') as auth, p.proconfig as cfg from pg_proc p where p.pronamespace = 'private'::regnamespace order by 1");
    expect(r.rows.map(x => x.nome)).toEqual(["identidade_meta_valida", "nota_guiada_ativa", "notes_ficha_guard", "tem_ficha", "titulo_publico"]);
    expect(r.rows.filter(x => x.anon)).toEqual([]);
    expect(r.rows.filter(x => x.definer).map(x => x.nome).sort()).toEqual(["nota_guiada_ativa", "tem_ficha"]);
    for (const f of r.rows) expect(f.cfg ?? [], f.nome).toContain('search_path=""');
    expect(r.rows.find(x => x.nome === "notes_ficha_guard")!.auth).toBe(false);                 // função de gatilho: ninguém a chama
    // nada SECURITY DEFINER novo no schema exposto `public`
    expect((await db.query("select proname from pg_proc where pronamespace = 'public'::regnamespace and prosecdef and proname in ('create_guided_character','save_guided_character','character_sheets_guard')")).rows).toEqual([]);
    // anon não usa o schema nem chama as funções
    expect((await as(db, null, "select private.tem_ficha(gen_random_uuid())")).error).toMatch(/permission denied/);
  });
  it("as funções definer só respondem verdadeiro/falso e não revelam dados de notas ou fichas alheias", async () => {
    const { character_id: id } = await criar(U.bia, C1);
    for (const u of [U.caio, U.dora]) {
      const r = await as(db, u, "select private.tem_ficha($1) as a, private.nota_guiada_ativa($1, $2, $3) as b", [id, C1, U.bia]);
      expect(Object.keys(r.rows[0]).sort()).toEqual(["a", "b"]);
      expect(typeof r.rows[0].a).toBe("boolean");
    }
  });
});

describe("compatibilidade da 0007 reconstruída com o remoto (CHECK de revision)", () => {
  it("revision fora de 1..2147483647 é recusada pela estrutura da 0007", async () => {
    const t = await boot("0007_character_sheets_foundation.sql");
    const c = (await as(t, U.ana, "select public.create_campaign('M','') as r")).rows[0].r as string;
    const nota = (await t.query("insert into public.notes (owner_id, campaign_id, kind, title) values ($1, $2, 'character', 'x') returning id", [U.ana, c])).rows[0].id as string;
    const ins = (rev: number) => t.query("insert into public.character_sheets (character_id, campaign_id, owner_id, draft, revision) values ($1, $2, $3, '{}'::jsonb, $4)", [nota, c, U.ana, rev]);
    await expect(ins(0)).rejects.toThrow(/revision_check|check constraint/);
    await expect(ins(2147483648)).rejects.toThrow(/out of range|integer/);
    await expect(ins(2147483647)).resolves.toBeDefined();
    expect((await t.query("select indexname from pg_indexes where tablename = 'character_sheets' order by 1")).rows.map(x => x.indexname)).toEqual(["character_sheets_campaign_owner_idx", "character_sheets_pkey"]);
  });
  it("a 0007 só deixa INSERT/UPDATE com a nota ativa (deleted_at IS NULL) para o dono (mas a API está fechada: sem privilégio)", async () => {
    const t = await boot("0007_character_sheets_foundation.sql");
    const def = (await t.query("select polname, pg_get_expr(polwithcheck, polrelid) as chk from pg_policy where polrelid = 'public.character_sheets'::regclass and polname in ('character_sheets_insert','character_sheets_update')")).rows;
    for (const d of def) expect(String(d.chk), String(d.polname)).toMatch(/deleted_at IS NULL/i);
  });
});

describe("nota viva da ficha: dono da nota = dono da ficha e meta válido (ação final do PR #80)", () => {
  /** Cria nota + ficha por caminho privilegiado (simula linha pré-existente/corrompida que a RLS não deixaria nascer). */
  async function linha(donoNota: string, donoFicha: string, meta: unknown = { guiado: true, identidadePublica: identidade }) {
    await db.exec(`select set_config('request.jwt.claim.sub', '${donoNota}', false)`);          // o gatilho de tipo (0006) lê auth.uid(): o dono da nota participa da campanha
    const nid = (await db.query("insert into public.notes (owner_id, campaign_id, kind, title, meta) values ($1, $2, 'character', 'x', $3::jsonb) returning id", [donoNota, C1, JSON.stringify(meta)])).rows[0].id as string;
    await db.query("insert into public.character_sheets (character_id, campaign_id, owner_id, draft) values ($1, $2, $3, $4::jsonb)", [nid, C1, donoFicha, JSON.stringify(draft({ id: nid }))]);
    return nid;
  }
  const semGatilho = async (f: () => Promise<unknown>) => { await db.exec("alter table public.notes disable trigger notes_zz_ficha_guard"); try { await f(); } finally { await db.exec("alter table public.notes enable trigger notes_zz_ficha_guard"); } };
  const negado = (r: R) => expect(r.error ?? (r.rows.length === 0 ? "0 linhas row-level security" : "permitido")).toMatch(/row-level security|violates/);
  const upd = (uid: string, nid: string) => as(db, uid, "update public.character_sheets set draft = $2::jsonb where character_id = $1 returning revision", [nid, JSON.stringify(draft({ id: nid }))]);

  it("ficha cujo dono NÃO é o dono da nota: nem o dono da ficha, nem o mestre, nem a RPC conseguem atualizá-la (a 0007 exigia a igualdade)", async () => {
    const nid = await linha(U.caio, U.bia);                                                        // nota de caio, ficha de bia
    negado(await upd(U.bia, nid)); negado(await upd(U.ana, nid));
    expect((await salvar(U.bia, nid, 1, draft())).error).toBeTruthy();
    expect((await salvar(U.ana, nid, 1, draft())).error).toBeTruthy();
    expect((await db.query("select revision from public.character_sheets where character_id = $1", [nid])).rows[0]).toEqual({ revision: 1 });
    // não há reparo por API: o dono de uma nota é imutável (0004) e o da ficha também; só intervenção manual no banco resolve
    await expect(db.query("update public.notes set owner_id = $2 where id = $1", [nid, U.bia])).rejects.toThrow(/campo_imutavel/);
    // controle positivo: com dono igual, o mesmo caminho funciona
    const ok = await linha(U.bia, U.bia);
    expect((await salvar(U.bia, ok, 1, draft({ currentHp: 2 }))).error).toBeUndefined();
    expect((await salvar(U.ana, ok, 2, draft({ currentHp: 3 }))).error).toBeUndefined();          // o mestre também
  });
  it("ficha ligada a nota com meta inválido (linha corrompida/pré-existente): atualização recusada até o meta ser corrigido", async () => {
    const nid = await linha(U.bia, U.bia);
    for (const meta of [{ guiado: true, inventario: ["x"] }, {}, { guiado: true, identidadePublica: { card: { nivel: 3 }, settings: {} } }]) {
      await semGatilho(() => db.query("update public.notes set meta = $2::jsonb where id = $1", [nid, JSON.stringify(meta)]));
      negado(await upd(U.bia, nid)); negado(await upd(U.ana, nid));
      expect((await salvar(U.bia, nid, 1, draft())).error, JSON.stringify(meta)).toBeTruthy();
      expect((await salvar(U.ana, nid, 1, draft())).error, JSON.stringify(meta)).toBeTruthy();
    }
    // o dono conserta a identidade pela própria nota (o gatilho valida o novo meta) e a ficha volta a ser editável
    expect((await as(db, U.bia, "update public.notes set meta = $2::jsonb where id = $1", [nid, JSON.stringify({ guiado: true, identidadePublica: identidade })])).error).toBeUndefined();
    expect((await salvar(U.bia, nid, 1, draft({ currentHp: 4 }))).error).toBeUndefined();
  });
  it("o helper confere dono, campanha, tipo, atividade e meta: cada falha isolada devolve falso (e o caminho correto, verdadeiro)", async () => {
    const nid = await linha(U.bia, U.bia);
    const q = (p: unknown[]) => db.query<{ r: boolean }>("select private.nota_guiada_ativa($1, $2, $3) as r", p).then(x => x.rows[0].r);
    expect(await q([nid, C1, U.bia])).toBe(true);
    expect(await q([nid, C1, U.caio])).toBe(false);                                                // dono diferente
    expect(await q([nid, C2, U.bia])).toBe(false);                                                 // campanha diferente
    expect(await q(["11111111-1111-4111-8111-111111111111", C1, U.bia])).toBe(false);              // inexistente
    await semGatilho(() => db.query("update public.notes set kind = 'note' where id = $1", [nid]));
    expect(await q([nid, C1, U.bia])).toBe(false);                                                 // não é personagem
    await semGatilho(() => db.query("update public.notes set kind = 'character', deleted_at = now(), deleted_batch = gen_random_uuid() where id = $1", [nid]));
    expect(await q([nid, C1, U.bia])).toBe(false);                                                 // excluída
    await semGatilho(() => db.query("update public.notes set deleted_at = null, deleted_batch = null, meta = '{}'::jsonb where id = $1", [nid]));
    expect(await q([nid, C1, U.bia])).toBe(false);                                                 // meta inválido
  });
  it("sem CHECK global sobre meta: a 0008 não cria `notes_guiado_meta_check` (não trava notas legadas)", async () => {
    expect((await db.query("select count(*)::int as n from pg_constraint where conname = 'notes_guiado_meta_check'")).rows[0]).toEqual({ n: 0 });
  });
});

describe("notas legadas (existentes antes da 0008) continuam funcionando", () => {
  it("a 0008 aplica com notas legadas marcadas `guiado` em formato diferente; elas seguem editáveis, mas só ganham ficha com meta válido", async () => {
    const t = await boot("0007_character_sheets_foundation.sql");
    const c = (await as(t, U.ana, "select public.create_campaign('M','') as r")).rows[0].r as string;
    await as(t, U.bia, "select public.join_campaign($1)", [(await as(t, U.ana, "select public.create_invite($1, 5, 7) as r", [c])).rows[0].r]);
    const mk = async (titulo: string, meta: unknown) => (await t.query("insert into public.notes (owner_id, campaign_id, kind, title, meta) values ($1, $2, 'character', $3, $4::jsonb) returning id", [U.bia, c, titulo, JSON.stringify(meta)])).rows[0].id as string;
    const legadoGuiado = await mk("Legado guiado", { guiado: true, legado: 1, inventario: ["Corda"], nivel: 5 });
    const legadoSimples = await mk("Legado simples", { classe: "Mago", nivel: 2, inventario: ["Cajado"] });
    const legadoVazio = await mk("Legado sem meta", {});
    await t.exec(sql("0008_character_sheets_persistencia.sql"));                                  // não aborta por causa das notas legadas
    const up = (id: string, titulo: string) => as(t, U.bia, "update public.notes set title = $2 where id = $1 returning id", [id, titulo]);
    for (const id of [legadoGuiado, legadoSimples, legadoVazio]) expect((await up(id, "Renomeado")).rows).toHaveLength(1);   // continuam editáveis
    expect((await as(t, U.bia, "update public.notes set meta = $2::jsonb where id = $1 returning id", [legadoSimples, JSON.stringify({ classe: "Clérigo", nivel: 3, inventario: ["Maça"] })])).rows).toHaveLength(1);
    const ficha = (id: string) => as(t, U.bia, "insert into public.character_sheets (character_id, campaign_id, owner_id, draft) values ($1, $2, $3, $4::jsonb)", [id, c, U.bia, JSON.stringify(draft({ id }))]);
    for (const id of [legadoGuiado, legadoSimples, legadoVazio]) expect((await ficha(id)).error, id).toMatch(/row-level security/);   // sem meta estrito, não vira ficha guiada
    // o dono migra o legado para o formato estrito (sem ficha ainda): agora pode criar a ficha
    expect((await as(t, U.bia, "update public.notes set meta = $2::jsonb where id = $1", [legadoGuiado, JSON.stringify({ guiado: true, identidadePublica: identidade })])).error).toBeUndefined();
    expect((await ficha(legadoGuiado)).error).toBeUndefined();
    expect((await as(t, U.bia, "update public.notes set meta = $2::jsonb where id = $1", [legadoGuiado, JSON.stringify({ guiado: true, inventario: [] })])).error).toMatch(/identidade_invalida/);   // e a partir daí a proteção vale
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
    for (const f of ["0011_character_combat_status_down.sql", "0010_campaign_encounters_down.sql", "0009_campaign_combats_down.sql"]) await t.exec(down(f));   // as mais novas primeiro
    await t.exec(down("0008_character_sheets_persistencia_down.sql"));
    expect((await t.query("select count(*)::int as n from public.character_sheets")).rows[0]).toEqual({ n: 1 });               // dados preservados
    expect((await as2(U.bia, "select * from public.character_sheets")).error).toMatch(/permission denied/);                    // fechado de novo
    expect((await t.query("select count(*)::int as n from pg_proc where proname in ('create_guided_character','save_guided_character','character_sheets_guard','tem_ficha','nota_guiada_ativa','identidade_meta_valida','titulo_publico','notes_ficha_guard')")).rows[0]).toEqual({ n: 0 });
    expect((await t.query("select count(*)::int as n from pg_namespace where nspname = 'private'")).rows[0]).toEqual({ n: 0 });
    expect((await t.query("select count(*)::int as n from pg_trigger where tgname = 'notes_zz_ficha_guard'")).rows[0]).toEqual({ n: 0 });
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
  const intacto = async (t: PGlite) => Number((await t.query("select count(*)::int as n from pg_constraint where conname in ('notes_id_campaign_uniq')")).rows[0].n) === 0;
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

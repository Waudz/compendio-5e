// Migração 0013 (PROPOSTA) em PostgreSQL em memória (PGlite), com papéis `anon`/`authenticated` e `auth.uid()` simulado. Dados FICTÍCIOS.
// Não é o Supabase hospedado: a 0013 não foi aplicada lá.
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { beforeAll, describe, expect, it } from "vitest";
import { ITENS_DE_ORIGEM, jogadorPodeAdicionar } from "../src/catalogue/disponibilidade";
import { grantBackground2014 } from "../src/criador/regras-2014";
import { srdItemIds } from "../src/catalogue/srd-2014-items";
import personagem from "../src/criador/data/character-2014.json";
import { storageStub } from "./stub-storage";

const dir = join(__dirname, "migrations");
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
type R = { rows: Record<string, unknown>[]; error?: string };
async function as(db: PGlite, uid: string | null, q: string, params: unknown[] = []): Promise<R> {
  await db.exec(`set role ${uid ? "authenticated" : "anon"}; select set_config('request.jwt.claim.sub', '${uid ?? ""}', false);`);
  try { return { rows: (await db.query<Record<string, unknown>>(q, params)).rows }; }
  catch (e) { return { rows: [], error: (e as Error).message }; }
  finally { await db.exec("reset role"); }
}
async function boot(ate = "9999"): Promise<PGlite> {
  const db = new PGlite(); await db.exec(stub);
  for (const f of readdirSync(dir).filter(f => f.endsWith(".sql") && f.slice(0, 4) <= ate).sort()) await db.exec(readFileSync(join(dir, f), "utf8"));
  for (const [n, id] of Object.entries(U)) await db.query("insert into auth.users (id, email) values ($1, $2)", [id, `${n}@exemplo.com`]);
  return db;
}
const rpc = (db: PGlite, uid: string, fn: string, ...a: unknown[]) => as(db, uid, `select public.${fn}(${a.map((_, i) => `$${i + 1}`).join(",")}) as r`, a);
async function mesa(db: PGlite) {
  const cid = (await rpc(db, U.ana, "create_campaign", "Mesa", "")).rows[0].r as string;
  const codigo = (await rpc(db, U.ana, "create_invite", cid, 10, 7)).rows[0].r as string;
  for (const u of [U.bia, U.caio]) await rpc(db, u, "join_campaign", codigo);
  return cid;
}
const item = (id: string, itemId: string, quantity = 1, equipped = false) => ({ id, itemId, quantity, equipped, origin: "acquired" });
const ficha = (extra: Record<string, unknown> = {}) => ({ id: "provisorio", name: "Thorin", nickname: "Sombra", level: 3, publicLabels: { race: "Anão da Colina", characterClass: "Guerreiro" }, inventory: [item("i1", "longsword")], currentHp: 13, ...extra });
const real = { mode: "real" };
const apresentacao = (settings: Record<string, unknown> = {}) => ({ identidadePublica: {
  settings: { imageUrl: null, title: "", name: real, surname: real, race: real, characterClass: real, level: real, description: "", ...settings },
  card: { imageUrl: null, title: "FALSO", name: "FALSO", surname: null, race: "FALSO", characterClass: "FALSO", level: "99", description: "" },
} });

let db: PGlite, C: string;
const criar = (uid: string, draft: unknown, meta: unknown = apresentacao()) =>
  as(db, uid, "select * from public.create_guided_character($1, 'x', $2::jsonb, false, $3::jsonb)", [C, JSON.stringify(meta), JSON.stringify(draft)]);
const id = async (r: Promise<R>) => { const x = await r; if (x.error) throw new Error(x.error); return x.rows[0].character_id as string; };
const lerFicha = async (cid: string) => (await db.query<{ draft: Record<string, unknown>; revision: number }>("select draft, revision from public.character_sheets where character_id = $1", [cid])).rows[0];
/** Grava a ficha como `uid`, aplicando `patch` sobre a versão atual. */
async function salvar(uid: string, cid: string, patch: Record<string, unknown>) {
  const atual = await lerFicha(cid);
  return as(db, uid, "select * from public.save_guided_character($1, $2, $3::jsonb)", [cid, atual.revision, JSON.stringify({ ...atual.draft, ...patch })]);
}
const nota = async (uid: string, cid: string) => (await as(db, uid, "select title, visibility, meta from public.notes where id = $1", [cid])).rows[0] as
  { title: string; visibility: string; meta: { identidadePublica: { card: Record<string, string | null>; settings: Record<string, unknown> } } } | undefined;

beforeAll(async () => { db = await boot(); C = await mesa(db); });

describe("moedas por campanha", () => {
  it("começam todas ativas; só o mestre muda; a lista é validada", async () => {
    const ler = async (u: string) => (await as(db, u, "select enabled_coins from public.campaigns where id = $1", [C])).rows[0]?.enabled_coins;
    expect(await ler(U.bia)).toEqual(["cp", "sp", "ep", "gp", "pp"]);
    const mudar = (u: string, v: string) => as(db, u, `update public.campaigns set enabled_coins = ${v} where id = $1 returning id`, [C]);
    expect((await mudar(U.bia, "array['gp']")).rows).toHaveLength(0);
    expect((await mudar(U.ana, "array['cp','sp','gp']")).rows).toHaveLength(1);
    expect(await ler(U.caio)).toEqual(["cp", "sp", "gp"]);
    expect((await mudar(U.ana, "array[]::text[]")).error).toMatch(/enabled_coins_check/);
    expect((await mudar(U.ana, "array['xx']")).error).toMatch(/enabled_coins_check/);
    expect(await ler(U.dora)).toBeUndefined();
  });
});

describe("itens e concessões também são restritos na API", () => {
  it("a lista do banco é exatamente a política do aplicativo, e cobre o equipamento inicial", async () => {
    const doBanco = (await db.query<{ item_id: string }>("select item_id from private_ficha.itens_livres order by 1")).rows.map(r => r.item_id);
    expect(doBanco).toEqual([...srdItemIds(), ...ITENS_DE_ORIGEM].filter(jogadorPodeAdicionar).sort());
    expect(doBanco).toEqual(expect.arrayContaining([...ITENS_DE_ORIGEM]));
    expect(grantBackground2014({ inventory: [], decisions: [], backgroundId: "acolyte" } as never).inventory.map(i => i.itemId).filter(x => !jogadorPodeAdicionar(x))).toEqual([]);
    const iniciais = new Set<string>();
    const percorrer = (v: unknown) => { if (v && typeof v === "object") { const x = v as { item?: unknown }; if (typeof x.item === "string") iniciais.add((personagem.itemIds as Record<string, string>)[x.item] ?? x.item); Object.values(v).forEach(percorrer); } };
    percorrer(personagem.classes);
    expect(iniciais.size).toBeGreaterThan(20);
    expect([...iniciais].filter(x => !jogadorPodeAdicionar(x))).toEqual([]);
    expect(doBanco).toContain("potion-of-healing-common");
    expect(doBanco).not.toContain("potion-of-healing-greater");
    expect((await as(db, U.bia, "select * from private_ficha.itens_livres")).error).toMatch(/permission denied/);
  });

  it("o jogador não cria ficha com item raro nem o acrescenta depois; o mestre entrega, e o jogador pode gastar", async () => {
    expect((await criar(U.bia, ficha({ inventory: [item("a", "potion-of-healing-greater")] }))).error).toMatch(/item_nao_autorizado/);
    const pc = await id(criar(U.bia, ficha({ inventory: [item("a", "potion-of-healing-common", 2)] })));
    const raro = [item("a", "potion-of-healing-common", 2), item("b", "potion-of-healing-greater", 2)];
    expect((await salvar(U.bia, pc, { inventory: raro })).error).toMatch(/item_nao_autorizado/);
    expect((await salvar(U.ana, pc, { inventory: raro })).error).toBeUndefined();
    expect((await salvar(U.bia, pc, { inventory: [raro[0], { ...raro[1], quantity: 1 }] })).error).toBeUndefined();
    expect((await salvar(U.bia, pc, { inventory: raro })).error).toMatch(/item_nao_autorizado/);   // não repõe sozinho
    // dividir em duas instâncias não aumenta o total
    expect((await salvar(U.bia, pc, { inventory: [item("b", "potion-of-healing-greater", 1), item("c", "potion-of-healing-greater", 1)] })).error).toMatch(/item_nao_autorizado/);
    // direto na tabela (sem a função) vale a mesma regra
    expect((await as(db, U.bia, "update public.character_sheets set draft = jsonb_set(draft, '{inventory}', $2::jsonb) where character_id = $1", [pc, JSON.stringify([item("z", "oil-of-sharpness")])])).error).toMatch(/item_nao_autorizado/);
  });

  it("talentos, magias e habilidades concedidos: só o mestre cria ou altera; o jogador pode retirar", async () => {
    const pc = await id(criar(U.bia, ficha()));
    const dado = { id: "g1", tipo: "magia", nome: "Luz", origem: "Mestre" };
    expect((await criar(U.bia, ficha({ play: { concedidos: [dado] } }))).error).toMatch(/concessao_so_do_mestre/);
    expect((await salvar(U.bia, pc, { play: { concedidos: [dado] } })).error).toMatch(/concessao_so_do_mestre/);
    expect((await salvar(U.ana, pc, { play: { concedidos: [dado] } })).error).toBeUndefined();
    expect((await salvar(U.bia, pc, { play: { concedidos: [{ ...dado, cd: 30 }] } })).error).toMatch(/concessao_so_do_mestre/);
    expect((await salvar(U.bia, pc, { currentHp: 5 })).error).toBeUndefined();
    expect((await salvar(U.bia, pc, { play: { concedidos: [] } })).error).toBeUndefined();
  });
});

describe("apresentação pública automática", () => {
  it("é calculada pelo servidor, com nível, visível para a campanha, e ignora o cartão enviado pelo cliente", async () => {
    const pc = await id(criar(U.bia, ficha()));
    const vista = (await nota(U.caio, pc))!;
    expect(vista.visibility).toBe("campaign");
    expect(vista.meta.identidadePublica.card).toEqual({ imageUrl: null, title: "Sombra", name: "Thorin", surname: null, race: "Anão da Colina", characterClass: "Guerreiro", level: "3", description: "" });
    expect(JSON.stringify(vista)).not.toMatch(/FALSO|longsword|currentHp|inventory/);
    expect((await as(db, U.caio, "select * from public.character_sheets where character_id = $1", [pc])).rows).toHaveLength(0);
    expect(await nota(U.dora, pc)).toBeUndefined();
    expect((await as(db, null, "select * from public.notes")).error).toMatch(/permission denied/);
  });

  it("alcunha secreta e campos ocultos não chegam a ninguém, nem pelo título; o dono não consegue voltar a nota para privada", async () => {
    const pc = await id(criar(U.bia, ficha(), apresentacao({ surname: { mode: "hidden" }, level: { mode: "hidden" }, race: { mode: "custom", customValue: "Desconhecida" } })));
    const vista = (await nota(U.caio, pc))!;
    expect(JSON.stringify(vista)).not.toContain("Sombra");
    expect(vista.meta.identidadePublica.card).toMatchObject({ title: "", name: "Thorin", level: null, race: "Desconhecida" });
    expect(vista.title).toBe("Thorin");
    expect((await as(db, U.bia, "update public.notes set visibility = 'private' where id = $1", [pc])).error).toBeUndefined();
    expect((await nota(U.caio, pc))!.visibility).toBe("campaign");
    expect((await as(db, U.caio, "update public.notes set title = 'x' where id = $1 returning id", [pc])).rows).toHaveLength(0);
  });

  it("quando o MESTRE edita a ficha, a apresentação acompanha, sem lhe dar poder sobre as escolhas do dono", async () => {
    const pc = await id(criar(U.bia, ficha(), apresentacao({ surname: { mode: "hidden" } })));
    const retrato = `storage:${C}/11111111-1111-1111-1111-111111111111`;
    expect((await salvar(U.ana, pc, { name: "Thorin, o Firme", level: 4, portrait: retrato })).error).toBeUndefined();
    expect((await nota(U.caio, pc))!.meta.identidadePublica.card).toMatchObject({ name: "Thorin, o Firme", level: "4", imageUrl: retrato, title: "" });
    const r = await as(db, U.ana, "select * from public.save_guided_character($1, $2, $3::jsonb, 'x', $4::jsonb, true)", [pc, (await lerFicha(pc)).revision, JSON.stringify((await lerFicha(pc)).draft), JSON.stringify(apresentacao())]);
    expect(r.error).toMatch(/identidade_so_do_dono/);
    // retrato apontando para o armazenamento de OUTRA campanha não é publicado
    expect((await salvar(U.bia, pc, { portrait: "storage:22222222-2222-2222-2222-222222222222/11111111-1111-1111-1111-111111111111" })).error).toBeUndefined();
    expect((await nota(U.caio, pc))!.meta.identidadePublica.card.imageUrl).toBeNull();
  });
});

describe("reversão", () => {
  it("volta ao estado da 0012 sem apagar fichas, e a gravação antiga volta a funcionar", async () => {
    const f = await boot();
    const cid = await mesa(f);
    const r = await as(f, U.bia, "select * from public.create_guided_character($1, 'x', $2::jsonb, false, $3::jsonb)", [cid, JSON.stringify(apresentacao()), JSON.stringify(ficha({ portrait: `storage:${cid}/11111111-1111-1111-1111-111111111111` }))]);
    expect(r.error).toBeUndefined();
    await f.exec(readFileSync(join(__dirname, "rollback", "0013_ficha_moedas_itens_identidade_down.sql"), "utf8"));
    expect((await f.query("select count(*)::int as n from public.character_sheets")).rows[0]).toEqual({ n: 1 });
    const meta = (await f.query<{ meta: { identidadePublica: { card: Record<string, unknown> } } }>("select meta from public.notes where id = $1", [r.rows[0].character_id])).rows[0].meta;
    expect(meta.identidadePublica.card).not.toHaveProperty("level");
    expect(meta.identidadePublica.card.imageUrl).toBeNull();
    expect((await as(f, U.bia, "select * from public.save_guided_character($1, 1, $2::jsonb)", [r.rows[0].character_id, JSON.stringify(ficha({ id: r.rows[0].character_id, inventory: [item("z", "oil-of-sharpness")] }))])).error).toBeUndefined();
    expect((await f.query("select column_name from information_schema.columns where table_name = 'campaigns' and column_name = 'enabled_coins'")).rows).toHaveLength(0);
    // reaplicar depois da reversão funciona
    await f.exec(readFileSync(join(dir, "0013_ficha_moedas_itens_identidade.sql"), "utf8"));
  });
});

describe("revisão adversarial: quantidades, concessões e privacidade pela API", () => {
  const raro = "potion-of-healing-greater";
  const bruto = (id: string, itemId: unknown, quantity: unknown) => ({ id, itemId, quantity, equipped: false, origin: "acquired" });

  it("entradas que enganariam a soma ou fora do formato são recusadas de qualquer um, inclusive do mestre", async () => {
    const casos: [string, unknown][] = [
      ["positivas e negativas que se anulam", [bruto("a", raro, 7), bruto("b", raro, -7)]],
      ["quantidade em texto", [bruto("a", raro, "100")]], ["quantidade zero", [bruto("a", raro, 0)]], ["fração", [bruto("a", "potion-of-healing-common", 1.5)]],
      ["gigante", [bruto("a", "torch", 1000001)]], ["inventário que não é lista", { 0: bruto("a", raro, 5) }], ["entrada que não é objeto", ["x"]],
      ["itemId numérico", [bruto("a", 5, 1)]], ["identificador repetido", [bruto("a", "torch", 1), bruto("a", "torch", 1)]],
    ];
    const pc = await id(criar(U.bia, ficha()));
    for (const [nome, inventory] of casos) {
      expect((await criar(U.bia, ficha({ inventory }))).error, "criar: " + nome).toMatch(/ficha_invalida/);
      expect((await salvar(U.bia, pc, { inventory })).error, "jogador: " + nome).toMatch(/ficha_invalida/);
      expect((await salvar(U.ana, pc, { inventory })).error, "mestre: " + nome).toMatch(/ficha_invalida/);
    }
    expect((await salvar(U.bia, pc, { play: { concedidos: { a: 1 } } })).error).toMatch(/ficha_invalida/);
  });

  it("a concessão presa a um item não migra para outro, não se repete e não é recriada pelo jogador", async () => {
    const pc = await id(criar(U.bia, ficha()));
    const dado = { id: "g", tipo: "magia", nome: "Luz", origem: "Varinha", itemInstancia: "varinha" };
    const comVarinha = [bruto("varinha", "wand-of-magic-missiles", 1)];
    expect((await salvar(U.ana, pc, { inventory: comVarinha, play: { concedidos: [dado] } })).error).toBeUndefined();
    expect((await salvar(U.bia, pc, { inventory: [bruto("varinha", "dagger", 1)] })).error).toMatch(/concessao_so_do_mestre/);
    expect((await salvar(U.bia, pc, { play: { concedidos: [dado, dado] } })).error).toMatch(/concessao_so_do_mestre/);
    expect((await salvar(U.bia, pc, { inventory: [] })).error).toBeUndefined();   // pode descartar o item
    expect((await salvar(U.bia, pc, { inventory: [bruto("varinha", "dagger", 1)] })).error).toMatch(/concessao_so_do_mestre/);
    expect((await salvar(U.bia, pc, { inventory: comVarinha })).error).toMatch(/item_nao_autorizado/);
  });

  it("texto de campo oculto ou que segue a ficha, e título/imagem de formatos antigos, nunca chegam à campanha", async () => {
    const pc = await id(criar(U.bia, ficha({ nickname: "ALCUNHA-REAL" }), apresentacao({
      imageUrl: "https://segredo.example/antiga.png", title: "TITULO-ANTIGO", surname: { mode: "hidden", customValue: "ALCUNHA-OCULTA" },
      race: { mode: "hidden", customValue: "RACA-OCULTA" }, characterClass: { mode: "real", customValue: "CLASSE-GUARDADA" }, level: { mode: "custom", customValue: "?" },
    })));
    const visto = (await nota(U.caio, pc))!;
    expect(JSON.stringify(visto)).not.toMatch(/ALCUNHA-REAL|TITULO-ANTIGO|segredo\.example|ALCUNHA-OCULTA|RACA-OCULTA|CLASSE-GUARDADA/);
    expect(visto.meta.identidadePublica.settings).toEqual({ imageUrl: null, title: "", name: { mode: "real" }, surname: { mode: "hidden" }, race: { mode: "hidden" }, characterClass: { mode: "real" }, level: { mode: "custom", customValue: "?" }, description: "" });
    // gravação direta na nota também é limpa
    await as(db, U.bia, "update public.notes set meta = $2::jsonb where id = $1", [pc, JSON.stringify({ guiado: true, ...apresentacao({ surname: { mode: "hidden", customValue: "DE-NOVO" } }) })]);
    expect(JSON.stringify(await nota(U.caio, pc))).not.toContain("DE-NOVO");
  });

  it("as funções internas não são chamáveis pela API", async () => {
    for (const q of ["select private_ficha.projetar('{}'::jsonb, '{}'::jsonb, gen_random_uuid())", "select private_ficha.formato_valido('{}'::jsonb)", "select * from private_ficha.itens_livres"])
      expect((await as(db, U.bia, q)).error, q).toMatch(/permission denied/);
  });
});

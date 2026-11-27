// PostgreSQL descartável: NPC do Compêndio com ficha de personagem (0022, DEC-039 etapa 2) com as políticas reais. Nenhuma conexão com produção.
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { beforeAll, afterAll, describe, it, expect } from "vitest";
import { storageStub } from "./stub-storage";

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

const sql = (...p: string[]) => readFileSync(join(__dirname, ...p), "utf8");
const migracoes = () => readdirSync(join(__dirname, "migrations")).filter(x => x.endsWith(".sql")).sort();
const uid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const mestre = uid(1), ana = uid(2), beto = uid(3), fora = uid(4);
type Row = Record<string, unknown>;
let db: PGlite, campanha: string, outra: string;

async function como(user: string | null, texto: string, args: unknown[] = []) {
  await db.exec(`set role ${user ? "authenticated" : "anon"}`);
  await db.query("select set_config('request.jwt.claim.sub',$1,false)", [user ?? ""]);
  try { return { rows: (await db.query<Row>(texto, args)).rows, error: undefined as string | undefined }; }
  catch (e) { return { rows: [] as Row[], error: (e as Error).message }; }
  finally { await db.exec("reset role"); }
}
const chamar = (user: string | null, fn: string, ...args: unknown[]) => como(user, `select public.${fn}(${args.map((_, i) => `$${i + 1}`).join(",")}) as r`, args);
const admin = async (texto: string, args: unknown[] = []) => (await db.query<Row>(texto, args)).rows;

async function preparar(banco: PGlite, ate?: string) {
  await banco.exec(stub);
  for (const f of migracoes()) { if (ate && f >= ate) break; await banco.exec(sql("migrations", f)); }
}
async function criarContas() {
  for (let i = 1; i <= 4; i++) await db.query("insert into auth.users(id,email) values($1,$2)", [uid(i), `sintetico${i}@example.invalid`]);
  campanha = (await chamar(mestre, "create_campaign", "A", "")).rows[0].r as string;
  outra = (await chamar(fora, "create_campaign", "B", "")).rows[0].r as string;
  for (const jogador of [ana, beto]) {
    const convite = (await chamar(mestre, "create_invite", campanha, 10, 7)).rows[0].r;
    expect((await chamar(jogador, "join_campaign", convite)).error).toBeUndefined();
  }
}
const oculto = { mode: "hidden" }, real = { mode: "real" };
const meta = { identidadePublica: { settings: { imageUrl: null, title: "", name: real, surname: real, race: oculto, characterClass: real, level: real, description: "Descrição pública" }, card: { imageUrl: null, title: "", name: "x", surname: null, race: null, characterClass: null, level: null, description: "" } } };
const ficha = (nome: string) => ({ id: "x", name: nome, nickname: "Alcunha de " + nome, level: 3, classId: "fighter", publicLabels: { race: "Anão", characterClass: "Guerreiro" }, inventory: [{ id: "i1", itemId: "longsword", quantity: 1, equipped: false, origin: "acquired" }], currentHp: 13, story: { historia: "História de " + nome } });
async function criar(dono: string, nome: string, publicar = true, onde = campanha) {
  const r = await como(dono, "select * from public.create_guided_character($1,'x',$2::jsonb,$3,$4::jsonb)", [onde, JSON.stringify(meta), publicar, JSON.stringify(ficha(nome))]);
  expect(r.error).toBeUndefined();
  return r.rows[0].character_id as string;
}
const lerFicha = async (quem: string, id: string) => (await como(quem, "select owner_id, revision, draft from public.character_sheets where character_id=$1", [id])).rows[0] as { owner_id: string; revision: number; draft: Row } | undefined;
const nota = async (id: string) => (await admin("select owner_id, visibility, title, meta, deleted_at, kind from public.notes where id=$1", [id]))[0];

const doc = (texto: string) => [{ type: "paragraph", content: [{ type: "text", text: texto }] }];
const entrada = (titulo: string) => ({ category: "npc", systemId: "dnd5e-2014", title: titulo, description: doc("Contrabandista do porto"), secret: "SEGREDO-DO-NPC", fields: { nickname: "O Corvo", history: "HISTORIA-OCULTA" }, sheet: [] });
const novoNpc = async (titulo: string) => {
  const r = await chamar(mestre, "codex_save", campanha, null, 0, JSON.stringify(entrada(titulo)));
  expect(r.error).toBeUndefined();
  return r.rows[0].r as string;
};
const versao = async (id: string) => (await admin("select version from public.campaign_codex where id=$1", [id]))[0].version as number;
const fichaNpc = (id: string, nome: string) => ({ ...ficha(nome), id });
const darFicha = async (quem: string | null, id: string, nome: string, v?: number, onde = campanha, draft: unknown = fichaNpc(id, nome)) =>
  como(quem, "select public.codex_npc_sheet_create($1,$2,$3,$4::jsonb) as r", [onde, id, v ?? (await versao(id)), JSON.stringify(draft)]);
const projecao = async (quem: string, id: string) => ((await chamar(quem, "codex_list", campanha)).rows[0].r as Row[]).find(e => e.id === id);
const gravarFicha = (quem: string, id: string, rev: number, nome: string) => como(quem, "select * from public.save_guided_character($1,$2,$3::jsonb)", [id, rev, JSON.stringify({ ...fichaNpc(id, nome), _protocolo: 2 })]);
const vital = (quem: string, id: string, a: unknown) => como(quem, "select public.alterar_vitais($1,$2::jsonb,$3::uuid) as r", [id, JSON.stringify(a), crypto.randomUUID()]);
const transferir = (quem: string, de: string, para: string) => como(quem, "select public.transferir_item($1,$2,'i1',1,$3::uuid) as r", [de, para, crypto.randomUUID()]);
const revelar = async (id: string, chaves: string[]) => expect((await chamar(mestre, "codex_reveal", campanha, id, await versao(id), true, chaves)).error).toBeUndefined();

beforeAll(async () => { db = new PGlite(); await preparar(db); await criarContas(); }, 60000);
afterAll(async () => { await db?.close(); });

describe("ficha de personagem em NPC do Compêndio", () => {
  let edric: string;

  it("o mestre dá a ficha ao NPC com o mesmo ID, sem tocar na história, nos segredos nem na divulgação", async () => {
    edric = await novoNpc("Edric Voss");
    await revelar(edric, ["name", "description"]);
    const antes = await nota(edric);
    for (const quem of [ana, fora, null]) expect((await darFicha(quem, edric, "Edric Voss")).error).toBeDefined();
    expect((await darFicha(mestre, edric, "Edric Voss", 1)).error).toMatch(/conflito_de_versao/);
    expect((await darFicha(mestre, edric, "x", undefined, campanha, ficha("x"))).error).toMatch(/dados_invalidos/);
    expect((await darFicha(fora, edric, "x", undefined, outra)).error).toMatch(/conflito_de_versao/);
    expect((await darFicha(mestre, edric, "Edric Voss")).error).toBeUndefined();
    expect(await nota(edric)).toEqual(antes);
    expect(await lerFicha(mestre, edric)).toMatchObject({ owner_id: mestre, revision: 1 });
    expect(await projecao(mestre, edric)).toMatchObject({ characterSheet: true, secret: "SEGREDO-DO-NPC" });
    expect((await admin("select count(*)::int as n from public.notes where title=$1", ["Edric Voss"]))[0].n).toBe(1);
    expect((await darFicha(mestre, edric, "Edric Voss")).error).toMatch(/npc_ja_tem_ficha/);
  });

  it("o jogador não vê a ficha nem fica sabendo que ela existe, mesmo com a página revelada", async () => {
    expect(await lerFicha(ana, edric)).toBeUndefined();
    const visto = await projecao(ana, edric);
    expect(visto).toBeDefined();
    expect(JSON.stringify(visto)).not.toMatch(/characterSheet|SEGREDO-DO-NPC|HISTORIA-OCULTA|fighter|currentHp/);
    const alteracao = await como(ana, "update public.character_sheets set draft=draft where character_id=$1 returning character_id", [edric]);
    expect(alteracao.rows).toHaveLength(0);
    expect((await gravarFicha(ana, edric, 1, "Invasão")).error).toBeDefined();
    expect((await vital(ana, edric, { tipo: "dano", valor: 1 })).error).toBeDefined();
    expect(await lerFicha(mestre, edric)).toMatchObject({ revision: 1 });
  });

  it("a ficha salva e recebe PV como qualquer outra, e a página continua editável sem se misturar", async () => {
    expect((await gravarFicha(mestre, edric, 1, "Edric de Ferro")).error).toBeUndefined();
    expect(await lerFicha(mestre, edric)).toMatchObject({ revision: 2 });
    expect(await nota(edric)).toMatchObject({ kind: "npc", visibility: "private", title: "Edric Voss", meta: expect.objectContaining({ secret: "SEGREDO-DO-NPC" }) });
    expect((await vital(mestre, edric, { tipo: "dano", valor: 5 })).error).toBeUndefined();
    expect((await lerFicha(mestre, edric))!.draft.currentHp).toBe(8);
    const editar = await chamar(mestre, "codex_save", campanha, edric, await versao(edric), JSON.stringify({ ...entrada("Edric Voss, o Velho"), secret: "SEGREDO-NOVO" }));
    expect(editar.error).toBeUndefined();
    expect(await nota(edric)).toMatchObject({ title: "Edric Voss, o Velho", meta: expect.objectContaining({ secret: "SEGREDO-NOVO" }) });
    expect((await lerFicha(mestre, edric))!.draft.name).toBe("Edric de Ferro");
  });

  it("um NPC tem uma ficha só: criatura e personagem se excluem", async () => {
    expect((await chamar(mestre, "codex_set_combat_sheet", campanha, edric, await versao(edric), "goblin")).error).toMatch(/npc_ja_tem_ficha/);
    const outro = await novoNpc("Bruto");
    expect((await chamar(mestre, "codex_set_combat_sheet", campanha, outro, await versao(outro), "goblin")).error).toBeUndefined();
    expect((await darFicha(mestre, outro, "Bruto")).error).toMatch(/npc_ja_tem_ficha/);
    expect((await chamar(mestre, "codex_set_combat_sheet", campanha, outro, await versao(outro), null)).error).toBeUndefined();
    expect((await darFicha(mestre, outro, "Bruto")).error).toBeUndefined();
    const local = (await chamar(mestre, "codex_save", campanha, null, 0, JSON.stringify({ category: "location", title: "Porto", description: [], fields: {}, sheet: [] }))).rows[0].r as string;
    expect((await darFicha(mestre, local, "Porto")).error).toMatch(/npc_indisponivel/);
  });

  it("nada apaga ou desfigura a identidade enquanto a ficha existe", async () => {
    expect((await chamar(mestre, "codex_remove", campanha, edric, await versao(edric))).error).toMatch(/npc_com_ficha/);
    for (const comando of ["delete from public.notes where id=$1", "update public.notes set deleted_at=now() where id=$1", "update public.notes set kind='note' where id=$1",
      "update public.notes set visibility='campaign' where id=$1", "delete from public.character_sheets where character_id=$1"]) await como(mestre, comando, [edric]);
    expect(await nota(edric)).toMatchObject({ kind: "npc", visibility: "private", deleted_at: null });
    expect(await lerFicha(mestre, edric)).toBeDefined();
  });

  it("ciclo de vida de aventureiro não alcança o NPC, e jogador não entrega itens a ele", async () => {
    const acaoNpc = await como(mestre, "select public.character_lifecycle($1,$2::uuid[],'arquivar',$3,'{}'::jsonb) as r", [campanha, [edric], crypto.randomUUID()]);
    expect(acaoNpc.error).toMatch(/personagem_indisponivel/);
    const aventureiro = await criar(ana, "Thorin");
    expect((await transferir(ana, aventureiro, edric)).error).toMatch(/destino_invalido/);
    expect((await lerFicha(ana, aventureiro))!.draft.inventory).toHaveLength(1);
    expect((await transferir(mestre, aventureiro, edric)).error).toBeUndefined();
    expect((await lerFicha(mestre, edric))!.draft.inventory).toHaveLength(2);
  });

  it("quem deixa de ser o mestre perde o acesso à ficha do NPC, mesmo constando como dono da linha", async () => {
    const rev = (await lerFicha(mestre, edric))!.revision;
    await db.exec("set session_replication_role = replica");   // simula a troca de mestre sem a trava de "último mestre"
    await admin("update public.campaign_members set role='jogador' where campaign_id=$1 and user_id=$2", [campanha, mestre]);
    expect(await lerFicha(mestre, edric)).toBeUndefined();
    expect((await gravarFicha(mestre, edric, rev, "Ainda meu")).error).toBeDefined();
    expect((await vital(mestre, edric, { tipo: "dano", valor: 1 })).error).toMatch(/ficha_nao_encontrada/);
    expect((await transferir(mestre, edric, edric)).error).toBeDefined();
    await admin("update public.campaign_members set role='mestre' where campaign_id=$1 and user_id=$2", [campanha, mestre]);
    await db.exec("set session_replication_role = origin");
    expect(await lerFicha(mestre, edric)).toMatchObject({ revision: rev });
  });
});

describe("aplicação e reversão da 0022", () => {
  const estado = async (banco: PGlite) => JSON.stringify([
    (await banco.query("select * from public.notes order by id")).rows,
    (await banco.query("select * from public.character_sheets order by character_id")).rows,
    (await banco.query("select * from public.campaign_codex order by id")).rows,
  ]);

  it("aplica sem alterar dados existentes; a reversão recusa quando há NPC com ficha e restaura quando não há", async () => {
    const principal = db, campanhaPrincipal = campanha, outraPrincipal = outra;
    const banco = new PGlite();
    try {
      db = banco; await preparar(banco, "0022"); await criarContas();
      await criar(ana, "Dain");
      const npc = await novoNpc("Mira");
      expect((await chamar(mestre, "codex_set_combat_sheet", campanha, npc, await versao(npc), "goblin")).error).toBeUndefined();
      const antes = await estado(banco);
      await banco.exec(sql("migrations", "0022_npc_ficha_de_personagem.sql"));
      expect(await estado(banco)).toBe(antes);
      expect((await chamar(mestre, "codex_capabilities")).rows[0].r).toBe(22);
      await banco.exec(sql("rollback", "0022_npc_ficha_de_personagem_down.sql"));
      expect(await estado(banco)).toBe(antes);
      expect((await chamar(mestre, "codex_capabilities")).rows[0].r).toBe(21);
      expect(await projecao(mestre, npc)).not.toHaveProperty("characterSheet");
      await banco.exec(sql("migrations", "0022_npc_ficha_de_personagem.sql"));
      const outro = await novoNpc("Orin");
      expect((await darFicha(mestre, outro, "Orin")).error).toBeUndefined();
      await expect(banco.exec(sql("rollback", "0022_npc_ficha_de_personagem_down.sql"))).rejects.toThrow(/reversao_0022_recusada/);
      await banco.exec("rollback");
      expect(await lerFicha(mestre, outro)).toBeDefined();
    } finally { db = principal; campanha = campanhaPrincipal; outra = outraPrincipal; await banco.close(); }
  }, 120000);
});

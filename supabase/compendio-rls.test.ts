// PostgreSQL descartável: políticas reais, sem conexão com produção.
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { beforeAll, afterAll, describe, it, expect } from "vitest";
import { storageStub } from "./stub-storage";
const stub =
  `
create role anon nologin; create role authenticated nologin;
create schema auth;
create table auth.users (id uuid primary key default gen_random_uuid(), email text);
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
grant usage on schema auth to anon, authenticated; grant execute on function auth.uid() to anon, authenticated;
grant usage on schema public to anon, authenticated;
alter default privileges in schema public grant all on tables to anon, authenticated;
alter default privileges in schema public grant all on functions to anon, authenticated;
` + storageStub;

let db: PGlite;
let cid: string;
let otherCampaign: string;
const uid = (n: number) =>
  `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const master = uid(1),
  player = uid(2),
  other = uid(3);
async function as(user: string | null, sql: string, args: unknown[] = []) {
  await db.exec(`set role ${user ? "authenticated" : "anon"}`);
  await db.query("select set_config('request.jwt.claim.sub',$1,false)", [
    user ?? "",
  ]);
  try {
    return {
      rows: (await db.query<Record<string, unknown>>(sql, args)).rows,
      error: undefined as string | undefined,
    };
  } catch (e) {
    return { rows: [], error: (e as Error).message };
  } finally {
    await db.exec("reset role");
  }
}
const call = (user: string | null, fn: string, ...args: unknown[]) =>
  as(
    user,
    `select public.${fn}(${args.map((_, i) => `$${i + 1}`).join(",")}) as r`,
    args,
  );
type Row = Record<string, unknown>;
const versionOf = async (id: string) => (await db.query<{ version: number }>("select version from public.campaign_codex where id=$1", [id])).rows[0].version;
async function reveal(id: string, revealed: string[], opts: { visible?: boolean; links?: Record<string, boolean> } = {}) {
  const r = await as(master, "select public.codex_reveal($1,$2,$3,$4,$5,$6::jsonb)",
    [cid, id, await versionOf(id), opts.visible ?? true, revealed, JSON.stringify(opts.links ?? {})]);
  expect(r.error).toBeUndefined();
}
const seen = async (id: string) => ((await call(player, "codex_list", cid)).rows[0].r as Row[]).find((x) => x.id === id);
const links = async (user: string, id: string) => (await call(user, "codex_links_for", cid, id)).rows[0].r as Row[];
const link = (source: string, target: string, revealed = false, kind = "member", out = "Membro de", back = "Possui membro", campaign = cid, user = master) =>
  call(user, "codex_link", campaign, source, target, kind, out, back, revealed);
const noticesOf = async (id: string) => (await as(player, "select is_new from public.codex_notifications where entry_id=$1 order by id", [id])).rows;
async function save(user: string, id: string | null, v: number, data: unknown) {
  const r = await call(user, "codex_save", cid, id, v, JSON.stringify(data));
  expect(r.error).toBeUndefined();
  return r.rows[0].r as string;
}
const SHEET = [{ k: "ac", l: "CA", v: "15" }, { k: "vulnerabilities", l: "Vulnerabilidades", v: "VULNERAVEL-A-FOGO" }, { k: "actions", l: "Ações", v: "ACAO-SECRETA" }];
const text = (t: string) => [{ type: "paragraph", content: [{ type: "text", text: t }] }];
const payload = (title = "NOME-VERDADEIRO", extra: Row = {}) => ({
  category: "monster", systemId: "dnd5e-2014", definitionId: "ID-CATALOGO-" + crypto.randomUUID(), title,
  description: text("DESCRICAO"), secret: "SEGREDO", fields: { nickname: "Alcunha", history: "HISTORIA" }, sheet: SHEET, ...extra,
});
beforeAll(async () => {
  db = new PGlite();
  await db.exec(stub);
  for (const f of readdirSync(join(__dirname, "migrations")).filter((x) => x.endsWith(".sql")).sort())
    await db.exec(readFileSync(join(__dirname, "migrations", f), "utf8"));
  for (let i = 1; i <= 3; i++)
    await db.query("insert into auth.users(id,email) values($1,$2)", [uid(i), `synthetic${i}@example.invalid`]);
  cid = (await call(master, "create_campaign", "A", "")).rows[0].r as string;
  otherCampaign = (await call(other, "create_campaign", "B", "")).rows[0].r as string;
  const invite = (await call(master, "create_invite", cid, 10, 7)).rows[0].r;
  expect((await call(player, "join_campaign", invite)).error).toBeUndefined();
}, 60000);
afterAll(async () => { await db?.close(); });

describe("Compêndio: conhecimento granular e isolamento", () => {
  it("autenticação, vínculo à campanha e leitura direta das tabelas são negados", async () => {
    expect((await call(null, "codex_list", cid)).error).toMatch(/permission denied/);
    expect((await call(other, "codex_list", cid)).error).toMatch(/sem_permissao/);
    expect((await call(player, "codex_list", otherCampaign)).error).toMatch(/sem_permissao/);
    const id = await save(master, null, 0, payload());
    for (const table of ["notes", "campaign_codex"])
      expect((await as(player, `select * from public.${table} where id=$1`, [id])).rows).toEqual([]);
    for (const fn of ["codex_project($1,false)", "codex_public_title($1)", "codex_announce($1)"])
      expect((await as(player, "select public." + fn, [id])).error).toMatch(/permission denied/);
  });
  it("registro novo é secreto; publicar só a existência entrega apenas o título neutro", async () => {
    const id = await save(master, null, 0, payload());
    expect(await seen(id)).toBeUndefined();
    await reveal(id, []);
    expect(await seen(id)).toEqual({ id, category: "monster", systemId: "dnd5e-2014", visible: true, title: "Criatura desconhecida" });
    await reveal(id, ["history"], { visible: false });
    expect(await seen(id)).toBeUndefined();
  });
  it("cada campo e seção da ficha é independente; ID de catálogo só com identificação completa", async () => {
    const id = await save(master, null, 0, payload());
    const secrets = /NOME-VERDADEIRO|ID-CATALOGO|SEGREDO|DESCRICAO|HISTORIA|VULNERAVEL|ACAO-SECRETA/;
    await reveal(id, ["nickname"]);
    expect((await seen(id))!.title).toBe("Alcunha");
    expect(JSON.stringify(await seen(id))).not.toMatch(secrets);
    await reveal(id, ["sheet:vulnerabilities"]);
    let e = (await seen(id))!;
    expect(e.sheet).toEqual([SHEET[1]]);
    expect(JSON.stringify(e)).not.toMatch(/NOME-VERDADEIRO|ID-CATALOGO|SEGREDO|DESCRICAO|HISTORIA|ACAO-SECRETA/);
    await reveal(id, ["history"]);
    expect((await seen(id))!.fields).toEqual({ history: "HISTORIA" });
    await reveal(id, ["name", "sheet:ac", "sheet:actions"]);
    expect((await seen(id))!.definitionId).toBeUndefined();
    await reveal(id, ["name", "sheet:ac", "sheet:actions", "sheet:vulnerabilities"]);
    expect((await seen(id))!.definitionId).toMatch(/ID-CATALOGO/);
    await reveal(id, ["sheet"]);
    e = (await seen(id))!;
    expect(e.definitionId).toBeUndefined();
    expect(e.sheet).toEqual(SHEET);
    expect(e.secret).toBeUndefined();
    expect(e.revealed).toBeUndefined();
  });
  it("item não identificado aparece como descoberta, sem pista do tipo", async () => {
    const id = await save(master, null, 0, payload("Chave do Corvo", { category: "item" }));
    await reveal(id, ["provisional"]);
    expect((await seen(id))!.category).toBe("discovery");
    expect((await seen(id))!.title).toBe("Descoberta sem nome");
    await reveal(id, ["name", "sheet"]);
    expect((await seen(id))!.category).toBe("item");
  });
  it("um aviso por operação com informação nova; correção, ocultação e repetição não avisam; título nunca vaza", async () => {
    const data = payload("TITULO-OCULTO"), id = await save(master, null, 0, data);
    await reveal(id, ["history"], { visible: false });
    expect(await noticesOf(id)).toEqual([]);
    await reveal(id, ["nickname", "description"]);
    expect(await noticesOf(id)).toEqual([{ is_new: true }]);
    const feed = (await call(player, "codex_notification_feed", cid)).rows[0].r;
    expect(JSON.stringify(feed)).not.toContain("TITULO-OCULTO");
    await reveal(id, ["nickname"]);
    await reveal(id, ["nickname", "description"]);
    expect(await noticesOf(id)).toHaveLength(1);
    await reveal(id, ["nickname", "description", "history", "sheet:ac"]);
    expect(await noticesOf(id)).toEqual([{ is_new: true }, { is_new: false }]);
    await reveal(id, ["nickname", "description", "history", "sheet:ac", "origin"]);
    expect(await noticesOf(id)).toHaveLength(2);
    await save(master, id, await versionOf(id), { ...data, fields: { ...data.fields, history: "correção" } });
    expect(await noticesOf(id)).toHaveLength(2);
    // campo já revelado que ganha conteúdo é informação nova
    await save(master, id, await versionOf(id), { ...data, fields: { ...data.fields, origin: "informação nova" } });
    expect(await noticesOf(id)).toHaveLength(3);
    await reveal(id, [], { visible: false });
    expect(await noticesOf(id)).toEqual([]);
    expect((await as(other, "select * from public.codex_notifications")).rows).toEqual([]);
  });
  it("jogador e outro mestre não escrevem nem usam a prévia; API genérica não publica a nota", async () => {
    const data = payload(), id = await save(master, null, 0, data);
    for (const user of [player, other]) {
      expect((await call(user, "codex_save", cid, null, 0, JSON.stringify(payload()))).error).toMatch(/sem_permissao/);
      expect((await call(user, "codex_save", cid, id, 1, JSON.stringify(data))).error).toMatch(/sem_permissao/);
      expect((await as(user, "select public.codex_reveal($1,$2,1,true,$3)", [cid, id, ["name"]])).error).toMatch(/sem_permissao/);
      expect((await call(user, "codex_preview", cid, id)).error).toMatch(/sem_permissao/);
      expect((await call(user, "codex_remove", cid, id, 1)).error).toMatch(/sem_permissao/);
    }
    expect((await as(master, "update public.notes set visibility='campaign' where id=$1", [id])).error).toMatch(/registro_compendio_privado/);
  });
  it("prévia do mestre é exatamente a projeção do jogador", async () => {
    const id = await save(master, null, 0, payload());
    expect((await call(master, "codex_preview", cid, id)).rows[0].r).toEqual({ entry: null, links: [] });
    await reveal(id, ["nickname", "description", "sheet:ac"]);
    expect(((await call(master, "codex_preview", cid, id)).rows[0].r as { entry: Row }).entry).toEqual(await seen(id));
  });
  it("versão, referência, chaves, campos, ficha e enquadramento são validados; duplicata é recusada", async () => {
    const data = payload(), id = await save(master, null, 0, data);
    const bad = async (patch: Row, error: RegExp, v: number | null = 1) => expect((await call(master, "codex_save", cid, id, v, JSON.stringify({ ...data, ...patch }))).error).toMatch(error);
    await bad({ definitionId: "outra" }, /referencia_imutavel/);
    await bad({ fields: { secret: "x" } }, /campos_invalidos/);
    await bad({ sheet: [{ k: "A B", l: "x", v: "y" }] }, /ficha_invalida/);
    await bad({ sheet: [SHEET[0], SHEET[0]] }, /ficha_invalida/);
    await bad({ framing: { zoom: 4, x: 0, y: 0 } }, /enquadramento_invalido/);
    await bad({}, /versao_invalida/, null);
    expect((await call(master, "codex_save", cid, null, 0, JSON.stringify(data))).error).toMatch(/unique/);
    expect((await as(master, "select public.codex_reveal($1,$2,1,true,$3)", [cid, id, ["secret"]])).error).toMatch(/chaves_invalidas/);
    expect((await as(master, "select public.codex_reveal($1,$2,9,true,$3)", [cid, id, ["name"]])).error).toMatch(/conflito/);
    expect((await as(master, "update public.notes set title='Na fonte' where id=$1", [id])).error).toBeUndefined();
    await bad({}, /conflito_de_versao/);
  });
  it("Storage só libera a imagem revelada; escrita alheia e outra campanha negadas", async () => {
    const data = payload(), id = await save(master, null, 0, data), path = `${cid}/${id}/${uid(90)}`;
    expect((await as(master, "insert into storage.objects(bucket_id,name) values('codex-assets',$1)", [path])).error).toBeUndefined();
    await save(master, id, 1, { ...data, imagePath: path });
    const read = async () => (await as(player, "select name from storage.objects where bucket_id='codex-assets' and name=$1", [path])).rows;
    await reveal(id, ["name", "description", "sheet"]);
    expect(await read()).toEqual([]);
    expect((await seen(id))!.imagePath).toBeUndefined();
    await reveal(id, ["image"]);
    expect(await read()).toEqual([{ name: path }]);
    expect((await seen(id))!.imagePath).toBe(path);
    expect((await seen(id))!.imageDefinitionId).toBeUndefined();
    await reveal(id, ["image"], { visible: false });
    expect(await read()).toEqual([]);
    for (const user of [player, other])
      expect((await as(user, "insert into storage.objects(bucket_id,name) values('codex-assets',$1)", [`${cid}/${id}/${crypto.randomUUID()}`])).error).toMatch(/row-level security/);
    expect((await call(master, "codex_save", cid, id, await versionOf(id), JSON.stringify({ ...data, imagePath: `${otherCampaign}/${id}/${uid(91)}` }))).error).toMatch(/imagem_de_outro/);
    expect((await call(master, "codex_asset_access", "not/a/uuid", true)).rows).toEqual([{ r: false }]);
  });
  it("vínculo tipado: oculto não aparece em nenhum sentido; revelado não revela o destino; rótulo inverso", async () => {
    const a = await save(master, null, 0, payload("Edric", { category: "npc", definitionId: undefined, sheet: [] }));
    const b = await save(master, null, 0, payload("ALVO-SECRETO", { category: "organization", definitionId: undefined, sheet: [], fields: {} }));
    await reveal(a, ["name"]);
    await reveal(b, ["name"]);
    const lid = (await link(a, b)).rows[0].r as string;
    expect(await links(player, a)).toEqual([]);
    expect(await links(player, b)).toEqual([]);
    expect((await seen(a))!.relatedTerms).toBeUndefined();
    expect(await links(master, a)).toEqual([{ id: lid, targetId: b, title: "ALVO-SECRETO", category: "organization", kind: "member", relation: "Membro de", outgoing: true, revealed: false }]);
    expect((await links(master, b))[0].relation).toBe("Possui membro");
    expect((await as(player, "select * from public.codex_links")).rows).toEqual([]);
    await reveal(b, ["name"], { visible: false });
    await reveal(a, ["name"], { links: { [lid]: true } });
    expect(await links(player, a)).toEqual([]);
    expect(JSON.stringify((await call(player, "codex_list", cid)).rows)).not.toContain("ALVO-SECRETO");
    expect((await call(player, "codex_links_for", cid, b)).error).toMatch(/sem_permissao/);
    await reveal(b, []);
    expect(await links(player, a)).toEqual([{ id: lid, targetId: b, title: "Organização desconhecida", category: "organization", kind: "member", relation: "Membro de", outgoing: true }]);
    expect((await links(player, b))[0].relation).toBe("Possui membro");
    for (const user of [player, other]) {
      expect((await link(a, b, true, "leader", "Líder de", "Liderada por", cid, user)).error).toMatch(/sem_permissao/);
      expect((await call(user, "codex_unlink", cid, lid)).error).toMatch(/sem_permissao/);
    }
    expect((await link(b, a)).error).toMatch(/unique/);
    expect((await link(a, b, false, "leader", "Líder de", "Liderada por")).error).toBeUndefined();
    expect(await links(player, a)).toHaveLength(1);
    expect((await link(a, b, false, "member", "Cruzado", "Cruzado", otherCampaign)).error).toMatch(/sem_permissao/);
    const c = await save(master, null, 0, payload("Terceiro"));
    expect((await as(master, "select public.codex_reveal($1,$2,1,false,$3,$4::jsonb)", [cid, c, [], JSON.stringify({ [lid]: false })])).error).toMatch(/vinculo_invalido/);
    expect((await call(master, "codex_unlink", cid, lid)).error).toBeUndefined();
  });
  it("descoberta não concede item; portadores só quando revelados; conhecimento sobrevive à perda do item", async () => {
    const eid = await save(master, null, 0, { category: "item", systemId: "dnd5e-2014", definitionId: "ring-of-invisibility", title: "Anel descoberto" });
    expect((await db.query<Row>("select count(*)::int n from public.character_sheets")).rows).toEqual([{ n: 0 }]);
    const hidden = { mode: "hidden" };
    const meta = { identidadePublica: {
      settings: { imageUrl: null, title: "", name: { mode: "custom", customValue: "Portador público" }, surname: hidden, race: hidden, characterClass: hidden, level: hidden, description: "" },
      card: { imageUrl: null, title: "FALSO", name: "FALSO", surname: null, race: "FALSO", characterClass: "FALSO", level: "99", description: "" } } };
    const draft = { id: "provisorio", name: "NOME SECRETO", level: 3, currentHp: 10, inventory: [
      { id: "magic-instance", itemId: "ring-of-invisibility", quantity: 1, equipped: false, origin: "acquired" },
      { id: "private-other", itemId: "longsword", quantity: 1, equipped: false, origin: "acquired" }] };
    const created = await as(master, "select * from public.create_guided_character($1,'x',$2::jsonb,false,$3::jsonb)", [cid, JSON.stringify(meta), JSON.stringify(draft)]);
    expect(created.error).toBeUndefined();
    const character = created.rows[0].character_id;
    await reveal(eid, ["name"]);
    expect((await call(player, "codex_holders", cid, eid)).rows[0].r).toEqual([]);
    await reveal(eid, ["name", "holders"]);
    const r = await call(player, "codex_holders", cid, eid);
    expect(r.rows[0].r).toEqual([{ id: character, title: "Portador público" }]);
    expect(JSON.stringify(r.rows)).not.toMatch(/NOME SECRETO|longsword|inventory/);
    await db.query("select set_config('request.jwt.claim.sub',$1,false)", [master]);
    await db.query("update public.character_sheets set draft=jsonb_set(draft,'{inventory}','[]'::jsonb),revision=revision+1 where character_id=$1", [character]);
    expect((await call(player, "codex_holders", cid, eid)).rows[0].r).toEqual([]);
    expect((await seen(eid))!.title).toBe("Anel descoberto");
  });
  it("referência criada para vínculo não é descoberta até o mestre registrar", async () => {
    const data = { category: "item", systemId: "dnd5e-2014", definitionId: "dagger", title: "Adaga", registered: false };
    const id = await save(master, null, 0, data);
    const flag = async () => (await db.query<Row>("select registered from public.campaign_codex where id=$1", [id])).rows[0].registered;
    expect(await flag()).toBe(false);
    expect(await seen(id)).toBeUndefined();
    await save(master, id, 1, { ...data, registered: true });
    expect(await flag()).toBe(true);
  });
  it("contadores usam todos os avisos autorizados, não só a página recente de 50", async () => {
    const feedOf = async () => (await call(player, "codex_notification_feed", cid)).rows[0].r as { unread: number; discoveries: number; items: unknown[] };
    const before = await feedOf(), ids: string[] = [];
    for (let i = 0; i < 51; i++) { const id = await save(master, null, 0, { category: "discovery", title: "Descoberta " + i }); await reveal(id, ["name"]); ids.push(id); }
    const feed = await feedOf();
    expect(feed.items).toHaveLength(50);
    expect(feed.unread).toBe(before.unread + 51);
    expect(feed.discoveries).toBe(before.discoveries + 51);
    expect((await call(other, "codex_notification_feed", cid)).error).toMatch(/sem_permissao/);
    expect((await as(player, "update public.codex_notifications set read_at=now() where entry_id=$1", [ids[0]])).error).toBeUndefined();
    expect((await feedOf()).unread).toBe(feed.unread - 1);
    await reveal(ids[1], ["name"], { visible: false });
    expect((await feedOf()).unread).toBe(feed.unread - 2);
  });
  it("definições da campanha: só o mestre; página registrada acompanha edição e restauração; catálogo e outra campanha intactos", async () => {
    const def = (id: string, nome: string) => JSON.stringify({ definition: { id, nome } });
    const sheet = (v: string) => JSON.stringify([{ k: "ac", l: "CA", v }]);
    const saveDef = (user: string, id: string, version: number, nome: string, value: string, campaign = cid, base: string | null = "Adaga") =>
      as(user, "select public.codex_definition_save($1,'item',$2,$3,null,$4::jsonb,$5::jsonb,$6) r", [campaign, id, version, def(id, nome), sheet(value), base]);
    const remove = (user: string, id: string, version: number) =>
      as(user, "select public.codex_definition_remove($1,'item',$2,$3,$4::jsonb,'Adaga')", [cid, id, version, sheet("original")]);
    const entry = await save(master, null, 0, { category: "item", systemId: "dnd5e-2014", definitionId: "club", title: "Adaga", sheet: JSON.parse(sheet("original")) });
    await reveal(entry, ["name", "sheet"]);
    for (const user of [player, other]) {
      expect((await saveDef(user, "club", 0, "Invasão", "x")).error).toMatch(/sem_permissao/);
      expect((await remove(user, "club", 1)).error).toMatch(/sem_permissao/);
    }
    expect((await saveDef(master, "club", 0, "Adaga do Corvo", "editada")).rows).toEqual([{ r: 1 }]);
    expect((await seen(entry))!.title).toBe("Adaga do Corvo");
    expect((await seen(entry))!.sheet).toEqual(JSON.parse(sheet("editada")));
    expect((await as(player, "select * from public.campaign_definitions")).rows).toEqual([]);
    expect((await as(other, "select * from public.campaign_definitions")).rows).toEqual([]);
    expect((await as(master, "insert into public.campaign_definitions(campaign_id,kind,definition_id,data) values($1,'item','x',$2::jsonb)", [cid, def("x", "X")])).error).toMatch(/permission denied/);
    expect((await saveDef(master, "club", 0, "Duplicada", "x")).error).toMatch(/conflito_de_versao/);
    expect((await saveDef(master, "club", 1, "Adaga do Corvo", "v2")).rows).toEqual([{ r: 2 }]);
    expect((await saveDef(master, "club", 0, "Outra mesa", "x", otherCampaign)).error).toMatch(/sem_permissao/);
    expect((await saveDef(other, "club", 0, "Outra mesa", "alheia", otherCampaign)).error).toBeUndefined();
    expect((await seen(entry))!.sheet).toEqual(JSON.parse(sheet("v2")));
    expect((await remove(master, "club", 2)).error).toBeUndefined();
    expect((await seen(entry))!.title).toBe("Adaga");
    expect((await seen(entry))!.sheet).toEqual(JSON.parse(sheet("original")));
    expect((await db.query<Row>("select count(*)::int n from public.campaign_definitions where campaign_id=$1", [cid])).rows).toEqual([{ n: 0 }]);
    expect((await saveDef(master, "custom-abc", 0, "Chave", "c", cid, null)).error).toBeUndefined();
    await save(master, null, 0, { category: "item", systemId: "dnd5e-2014", definitionId: "custom-abc", title: "Chave" });
    expect((await remove(master, "custom-abc", 1)).error).toMatch(/definicao_em_uso/);
    expect((await as(master, "select public.codex_definition_save($1,'item','custom-z',0,null,$2::jsonb,'[]'::jsonb)", [cid, def("outro-id", "Z")])).error).toMatch(/check constraint/);
  });
  it("inventário: entrega do mestre, item não identificado sem vazamento em nenhuma resposta e identificação", async () => {
    const uid4 = uid(4);
    await db.query("insert into auth.users(id,email) values($1,'second@example.invalid')", [uid4]);
    await call(uid4, "join_campaign", (await call(master, "create_invite", cid, 10, 7)).rows[0].r);
    const hidden = { mode: "hidden" };
    const meta = { identidadePublica: { settings: { imageUrl: null, title: "", name: { mode: "custom", customValue: "Heroína" }, surname: hidden, race: hidden, characterClass: hidden, level: hidden, description: "" },
      card: { imageUrl: null, title: "", name: "x", surname: null, race: null, characterClass: null, level: null, description: "" } } };
    const makeSheet = async (owner: string) => {
      const r = await as(owner, "select * from public.create_guided_character($1,'x',$2::jsonb,false,$3::jsonb)", [cid, JSON.stringify(meta), JSON.stringify({ id: "provisorio", name: "PJ", level: 3, inventory: [], currentHp: 1 })]);
      expect(r.error).toBeUndefined();
      return r.rows[0].character_id as string;
    };
    const mine = await makeSheet(player), theirs = await makeSheet(uid4);
    const def = (id: string, nome: string, extra: Row = {}) => JSON.stringify({ definition: { id, nome, ...extra }, descricao: "EFEITO-SECRETO", segredoExtra: "NAO-SAIR" });
    const saveDef = (id: string, nome: string, extra: Row = {}) => as(master, "select public.codex_definition_save($1,'item',$2,0,null,$3::jsonb,'[]'::jsonb)", [cid, id, def(id, nome, extra)]);
    expect((await saveDef("custom-chave", "CHAVE-VERDADEIRA")).error).toBeUndefined();
    expect((await saveDef("custom-pocao", "Tônico da mesa", { categoria: "pocao", cura: "2d4+2" })).error).toBeUndefined();
    const defs = async (user: string) => (await call(user, "codex_definitions_for", cid)).rows[0].r as Row[];
    const ids = async (user: string) => (await defs(user)).map((d) => d.definitionId);
    expect(await ids(player)).not.toContain("custom-chave");
    expect((await call(other, "codex_definitions_for", cid)).error).toMatch(/sem_permissao/);
    const grant = (user: string, character: string, id: string, mask: Row | null, op = crypto.randomUUID(), campaign = cid) =>
      as(user, "select public.codex_grant_item($1,$2,$3,2,$4::jsonb,$5)", [campaign, character, id, mask ? JSON.stringify(mask) : null, op]);
    expect((await grant(player, mine, "custom-chave", null)).error).toMatch(/sem_permissao/);
    expect((await grant(other, mine, "custom-chave", null, undefined, otherCampaign)).error).toMatch(/destino_invalido|definicao_inexistente/);
    expect((await grant(master, mine, "custom-nao-existe", null)).error).toMatch(/definicao_inexistente/);
    const op = crypto.randomUUID();
    expect((await grant(master, mine, "custom-chave", { nome: "Chave estranha", descricao: "Fria ao toque" }, op)).error).toBeUndefined();
    expect((await grant(master, mine, "custom-chave", { nome: "Chave estranha" }, op)).error).toBeUndefined();
    const sheetOf = async (user: string, id: string) => (await as(user, "select * from public.character_sheets where character_id=$1", [id])).rows[0] as Row & { draft: { inventory: { id: string; itemId: string; quantity: number }[] }; revision: number };
    let sheet = await sheetOf(player, mine);
    expect(sheet.draft.inventory).toHaveLength(1);
    const token = sheet.draft.inventory[0].itemId;
    expect(token).toMatch(/^unid-[0-9a-f]{32}$/);
    const visibleToPlayer = JSON.stringify([sheet, await defs(player), (await call(player, "codex_list", cid)).rows]);
    expect(visibleToPlayer).not.toMatch(/custom-chave|CHAVE-VERDADEIRA|EFEITO-SECRETO|NAO-SAIR|identifiesAs/);
    expect(visibleToPlayer).toContain("Chave estranha");
    expect((await defs(master)).find((d) => d.definitionId === token)!.identifiesAs).toBe("custom-chave");
    expect(await ids(uid4)).not.toContain(token);
    for (const table of ["mascaras", "itens_vistos"]) expect((await as(player, "select * from private_ficha." + table)).error).toMatch(/permission denied/);
    // o jogador não forja o código nem a identidade verdadeira na própria ficha
    const forge = async (itemId: string) => (await as(player, "select * from public.save_guided_character($1,$2,$3::jsonb)", [mine, sheet.revision, JSON.stringify({ ...sheet.draft, _protocolo: 2, inventory: [...sheet.draft.inventory, { id: "z", itemId, quantity: 1 }] })])).error;
    expect(await forge("custom-chave")).toMatch(/item_nao_autorizado/);
    expect(await forge("unid-" + "0".repeat(32))).toMatch(/item_nao_autorizado/);
    expect((await as(player, "select public.usar_consumivel($1,$2,0,10,$3)", [mine, sheet.draft.inventory[0].id, crypto.randomUUID()])).error).toMatch(/operacao_invalida/);
    // posse só aparece quando revelada, inclusive para item ainda sem identificação
    const entry = await save(master, null, 0, { category: "item", systemId: "dnd5e-2014", definitionId: "custom-chave", title: "CHAVE-VERDADEIRA", fields: { nickname: "Chave estranha" } });
    await reveal(entry, ["nickname"]);
    expect((await call(player, "codex_holders", cid, entry)).rows[0].r).toEqual([]);
    expect((await call(master, "codex_holders", cid, entry)).rows[0].r).toEqual([{ id: mine, title: "Heroína" }]);
    expect(JSON.stringify((await call(player, "codex_list", cid)).rows)).not.toMatch(/custom-chave|CHAVE-VERDADEIRA/);
    // transferência leva o código; quem recebe vê só a aparência
    expect((await as(player, "select public.transferir_item($1,$2,$3,1,$4)", [mine, theirs, sheet.draft.inventory[0].id, crypto.randomUUID()])).error).toBeUndefined();
    expect(await ids(uid4)).toContain(token);
    expect(JSON.stringify([await sheetOf(uid4, theirs), await defs(uid4)])).not.toMatch(/custom-chave|CHAVE-VERDADEIRA/);
    for (const user of [player, other]) expect((await call(user, "codex_identify_item", cid, token)).error).toMatch(/sem_permissao/);
    expect((await call(master, "codex_identify_item", cid, token)).error).toBeUndefined();
    expect((await call(master, "codex_identify_item", cid, token)).error).toBeUndefined();
    for (const [user, id] of [[player, mine], [uid4, theirs]] as const) {
      sheet = await sheetOf(user, id);
      expect(sheet.draft.inventory.map((i) => i.itemId)).toEqual(["custom-chave"]);
      expect(JSON.stringify(sheet.draft)).not.toContain(token);
      expect(await ids(user)).toContain("custom-chave");
      expect(await ids(user)).not.toContain(token);
    }
    expect(JSON.stringify(await defs(player))).not.toContain("NAO-SAIR");
    // consumo de item da campanha respeita a fórmula da definição; o nome continua disponível depois de acabar
    expect((await grant(master, mine, "custom-pocao", null)).error).toBeUndefined();
    sheet = await sheetOf(player, mine);
    const potion = sheet.draft.inventory.find((i) => i.itemId === "custom-pocao")!;
    const use = (cura: number) => as(player, "select public.usar_consumivel($1,$2,$3,30,$4)", [mine, potion.id, cura, crypto.randomUUID()]);
    expect((await use(11)).error).toMatch(/operacao_invalida/);
    expect((await use(3)).error).toMatch(/operacao_invalida/);
    expect((await use(7)).error).toBeUndefined();
    expect((await use(7)).error).toBeUndefined();
    expect((await sheetOf(player, mine)).draft.inventory.some((i) => i.itemId === "custom-pocao")).toBe(false);
    expect(await ids(player)).toContain("custom-pocao");
    expect(await ids(uid4)).not.toContain("custom-pocao");
  });
  it("item personalizado chega a quem não o possui somente com identificação completa; vínculo não expõe ficha privada alheia", async () => {
    expect((await as(master, "select public.codex_definition_save($1,'item','custom-anel',0,null,$2::jsonb,$3::jsonb)", [cid, JSON.stringify({ definition: { id: "custom-anel", nome: "Anel" } }), JSON.stringify(SHEET)])).error).toBeUndefined();
    const entry = await save(master, null, 0, { category: "item", systemId: "dnd5e-2014", definitionId: "custom-anel", title: "Anel", sheet: SHEET });
    const has = async () => ((await call(player, "codex_definitions_for", cid)).rows[0].r as Row[]).some((d) => d.definitionId === "custom-anel");
    await reveal(entry, ["name", "sheet:ac"]);
    expect(await has()).toBe(false);
    await reveal(entry, ["sheet"]);
    expect(await has()).toBe(false);
    await reveal(entry, ["name", "sheet"]);
    expect(await has()).toBe(true);
    await reveal(entry, ["name", "sheet"], { visible: false });
    expect(await has()).toBe(false);
    const note = await db.query<Row>("insert into public.notes(campaign_id,owner_id,kind,title,visibility) values($1,$2,'character','FICHA-PRIVADA','private') returning id", [cid, player]);
    expect(note.rows).toHaveLength(1);
    expect((await link(entry, note.rows[0].id as string)).error).toMatch(/sem_permissao/);
  });
  it("ex-mestre perde acesso até ao notes de que continua dono", async () => {
    const id = await save(master, null, 0, payload());
    await db.exec("alter table public.campaign_members disable trigger user");
    await db.query("delete from public.campaign_members where campaign_id=$1 and user_id=$2", [cid, master]);
    try {
      expect((await as(master, "select meta from public.notes where id=$1", [id])).rows).toEqual([]);
      expect((await as(master, "update public.notes set title='intruso' where id=$1 returning id", [id])).rows).toEqual([]);
      expect((await call(master, "codex_list", cid)).error).toMatch(/sem_permissao/);
    } finally {
      await db.query("insert into public.campaign_members(campaign_id,user_id,role) values($1,$2,'mestre')", [cid, master]);
      await db.exec("alter table public.campaign_members enable trigger user");
    }
  });
});

describe("0017 sobre dados existentes", () => {
  it("converte níveis sem ampliar o acesso, preserva campos e vínculos; a reversão falha para o lado fechado", async () => {
    const old = new PGlite(), previous = db;
    await old.exec(stub);
    const files = readdirSync(join(__dirname, "migrations")).filter((x) => x.endsWith(".sql")).sort();
    for (const f of files.filter((x) => x < "0017")) await old.exec(readFileSync(join(__dirname, "migrations", f), "utf8"));
    db = old;
    try {
      for (const i of [1, 2]) await db.query("insert into auth.users(id,email) values($1,$2)", [uid(i), `old${i}@example.invalid`]);
      const camp = (await call(master, "create_campaign", "A", "")).rows[0].r as string;
      await call(player, "join_campaign", (await call(master, "create_invite", camp, 10, 7)).rows[0].r);
      const make = async (category: string, level: number, fields: Row = {}) => {
        const r = await call(master, "codex_save", camp, null, 0, JSON.stringify({ category, title: "T" + level + category, knowledge: level, definitionId: category === "monster" ? "m" + level : undefined, description: text("D"), fields, secret: "S" }));
        expect(r.error).toBeUndefined();
        return r.rows[0].r as string;
      };
      const levels: string[] = [];
      for (const level of [0, 1, 2, 3, 4]) levels.push(await make("monster", level));
      const npc = await make("npc", 4, { identity: "Ferreiro", region: "Porto" }), secretPlace = await make("location", 0, { identity: "Dois habitantes" });
      expect((await call(master, "codex_link", camp, npc, levels[4], "Aliado")).error).toBeUndefined();
      expect((await call(master, "codex_link", camp, npc, secretPlace, "Mora em")).error).toBeUndefined();
      await db.exec(readFileSync(join(__dirname, "migrations", files.find((x) => x.startsWith("0017"))!), "utf8"));
      const list = (await call(player, "codex_list", camp)).rows[0].r as Row[], by = (id: string) => list.find((x) => x.id === id);
      expect(by(levels[0])).toBeUndefined();
      expect(by(levels[1])!.description).toBeUndefined();
      expect(by(levels[2])!.description).toBeDefined();
      expect(by(levels[2])!.imageDefinitionId).toBeUndefined();
      expect(by(levels[3])!.imageDefinitionId).toBe("m3");
      expect(by(levels[3])!.definitionId).toBeUndefined();
      expect(by(levels[4])!.definitionId).toBe("m4");
      expect(by(npc)!.fields).toEqual({ occupation: "Ferreiro", residence: "Porto" });
      const all = (await call(master, "codex_list", camp)).rows[0].r as Row[];
      expect(all.find((x) => x.id === secretPlace)!.fields).toEqual({ inhabitants: "Dois habitantes" });
      // sincronizar a ficha de um registro já publicado por completo não gera aviso
      const antes = (await db.query<Row>("select count(*)::int n from public.codex_notifications")).rows[0].n;
      const full = all.find((x) => x.id === levels[4]) as Row & { version: number; revealed: string[] };
      expect((await as(master, "select public.codex_reveal($1,$2,$3,true,$4,'{}'::jsonb,$5::jsonb)", [camp, levels[4], full.version, full.revealed, JSON.stringify([{ k: "ac", l: "CA", v: "15" }])])).error).toBeUndefined();
      expect((await db.query<Row>("select count(*)::int n from public.codex_notifications")).rows[0].n).toBe(antes);
      expect(((await call(player, "codex_links_for", camp, npc)).rows[0].r as Row[]).map((x) => x.relation)).toEqual(["Aliado"]);
      await db.exec(readFileSync(join(__dirname, "rollback", "0017_compendio_conhecimento_granular_down.sql"), "utf8"));
      expect((await call(player, "codex_capabilities")).rows[0].r).toBe(16);
      const back = (await call(player, "codex_list", camp)).rows[0].r as Row[];
      expect(back.map((x) => x.id).sort()).toEqual([levels[4], npc].sort());
    } finally {
      db = previous;
      await old.close();
    }
  }, 60000);
  it("reversão da 0018 arquiva as definições e volta à capacidade 17", async () => {
    const fresh = new PGlite(), previous = db;
    await fresh.exec(stub);
    db = fresh;
    try {
      for (const f of readdirSync(join(__dirname, "migrations")).filter((x) => x.endsWith(".sql")).sort()) await db.exec(readFileSync(join(__dirname, "migrations", f), "utf8"));
      await db.exec(readFileSync(join(__dirname, "rollback", "0019_compendio_inventario_campanha_down.sql"), "utf8"));
      expect((await db.query<Row>("select public.codex_capabilities() r")).rows).toEqual([{ r: 18 }]);
      await db.exec(readFileSync(join(__dirname, "rollback", "0018_compendio_definicoes_campanha_down.sql"), "utf8"));
      expect((await db.query<Row>("select public.codex_capabilities() r")).rows).toEqual([{ r: 17 }]);
      expect((await db.query<Row>("select count(*)::int n from private_codex_archive.definition_snapshots")).rows).toEqual([{ n: 1 }]);
    } finally {
      db = previous;
      await fresh.close();
    }
  }, 60000);
});

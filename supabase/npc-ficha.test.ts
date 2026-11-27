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
  definir(quem, id, { tipo: "personagem", draft }, { v, onde });
type Extra = { v?: number; onde?: string; op?: string; revisao?: number | null; confirmacao?: string | null };
const definir = async (quem: string | null, id: string, nova: unknown, x: Extra = {}) =>
  como(quem, "select public.codex_npc_sheet_set($1,$2,$3,$4::jsonb,$5::uuid,$6,$7) as r",
    [x.onde ?? campanha, id, x.v ?? (await versao(id)), nova === null ? null : JSON.stringify(nova), x.op ?? crypto.randomUUID(), x.revisao ?? null, x.confirmacao ?? null]);
const criaturaDe = (id: string, nome = "Capanga") => ({ tipo: "criatura", base: "bandit", definicao: { id: `custom-npc-${id}`, nome, marcador: `CRIATURA-${nome}` }, secoes: [] });
const eventos = async (id: string) => (await admin("select removida, nova, copia, copia_expira_em from private_ficha.npc_ficha_eventos where entry_id=$1 order by id", [id])) as { removida: string | null; nova: string | null; copia: Row | null; copia_expira_em: Date | null }[];
const combate = async (id: string) => (await admin("select combat_definition_id as d from public.campaign_codex where id=$1", [id]))[0].d as string | null;
const definicoes = async (id: string) => (await admin("select data from public.campaign_definitions where definition_id=$1", [`custom-npc-${id}`])).length;
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
    expect((await darFicha(mestre, edric, "Edric Voss")).error).toMatch(/confirmacao_exigida/);
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

describe("adicionar, trocar e remover a ficha (cópia privada de 30 dias)", () => {
  const CONFIRMA = "remover-ficha";
  let npc: string;
  const identidade = async () => ({ nota: await nota(npc), pagina: (await admin("select image_path, visible, revealed, registered from public.campaign_codex where id=$1", [npc]))[0], vinculos: await admin("select * from public.codex_links where $1 in (source_id, target_id) order by id", [npc]) });

  it("criatura própria: cópia exclusiva do NPC, editável, fora do alcance de outros NPCs e dos jogadores", async () => {
    npc = await novoNpc("Garra");
    await revelar(npc, ["name"]);
    for (const quem of [ana, fora, null]) expect((await definir(quem, npc, criaturaDe(npc))).error).toBeDefined();
    expect((await definir(mestre, npc, { ...criaturaDe(npc), definicao: { id: "goblin", nome: "x" } })).error).toMatch(/dados_invalidos/);
    expect((await definir(mestre, npc, { tipo: "modelo" })).error).toMatch(/dados_invalidos/);
    expect((await definir(mestre, npc, null)).error).toMatch(/sem_ficha/);
    expect((await definir(mestre, npc, criaturaDe(npc))).error).toBeUndefined();
    expect(await combate(npc)).toBe(`custom-npc-${npc}`);
    expect(await definicoes(npc)).toBe(1);
    expect(await projecao(mestre, npc)).toMatchObject({ combatDefinitionId: `custom-npc-${npc}` });
    expect(JSON.stringify([await projecao(ana, npc), (await chamar(ana, "codex_definitions_for", campanha)).rows[0].r])).not.toMatch(/custom-npc|CRIATURA-/);
    const outroNpc = await novoNpc("Outro");
    expect((await chamar(mestre, "codex_set_combat_sheet", campanha, outroNpc, await versao(outroNpc), `custom-npc-${npc}`)).error).toMatch(/definicao_inexistente/);
    // o caminho antigo não descarta uma ficha própria sem cópia
    expect((await chamar(mestre, "codex_set_combat_sheet", campanha, npc, await versao(npc), null)).error).toMatch(/ficha_propria_exige_substituicao/);
    expect((await chamar(mestre, "codex_remove", campanha, npc, await versao(npc))).error).toMatch(/npc_com_ficha/);
  });

  it("substituir criatura por personagem guarda a cópia e não toca na identidade", async () => {
    const antes = await identidade();
    expect((await darFicha(mestre, npc, "Garra")).error).toMatch(/confirmacao_exigida/);
    expect((await definir(mestre, npc, { tipo: "personagem", draft: fichaNpc(npc, "Garra") }, { confirmacao: CONFIRMA })).error).toBeUndefined();
    expect(await identidade()).toEqual(antes);
    expect(await combate(npc)).toBeNull();
    expect(await definicoes(npc)).toBe(0);
    expect(await lerFicha(mestre, npc)).toMatchObject({ revision: 1 });
    const ultimo = (await eventos(npc)).at(-1)!;
    expect(ultimo).toMatchObject({ removida: "criatura", nova: "personagem" });
    expect(JSON.stringify(ultimo.copia)).toContain("CRIATURA-Capanga");
    const dias = (new Date(ultimo.copia_expira_em!).getTime() - Date.now()) / 86400000;
    expect(dias).toBeGreaterThan(29.9); expect(dias).toBeLessThanOrEqual(30);
  });

  it("remover a ficha de personagem exige confirmação e revisão atual, é idempotente e falha inteira", async () => {
    expect((await definir(mestre, npc, null)).error).toMatch(/confirmacao_exigida/);
    expect((await definir(mestre, npc, null, { confirmacao: CONFIRMA, revisao: 99 })).error).toMatch(/conflito_de_revisao/);
    // substituição que falha não pode perder a ficha atual
    expect((await definir(mestre, npc, { ...criaturaDe(npc), secoes: { invalidas: true } }, { confirmacao: CONFIRMA, revisao: 1 })).error).toBeDefined();
    expect(await lerFicha(mestre, npc)).toBeDefined();
    const antes = await identidade(), op = crypto.randomUUID(), v = await versao(npc);
    expect((await definir(mestre, npc, null, { confirmacao: CONFIRMA, revisao: 1, op })).error).toBeUndefined();
    expect((await definir(mestre, npc, null, { confirmacao: CONFIRMA, revisao: 1, op, v })).error).toBeUndefined();
    expect((await eventos(npc)).filter(e => e.removida === "personagem")).toHaveLength(1);
    expect(await versao(npc)).toBe(v + 1);
    expect(await identidade()).toEqual(antes);
    expect(await lerFicha(mestre, npc)).toBeUndefined();
    expect(await projecao(mestre, npc)).not.toHaveProperty("characterSheet");
    expect(JSON.stringify((await eventos(npc)).at(-1)!.copia)).toContain("Alcunha de Garra");
  });

  it("a cópia fica fora da API e é apagada depois do prazo; o histórico permanece", async () => {
    for (const quem of [mestre, ana, null]) expect((await como(quem, "select * from private_ficha.npc_ficha_eventos")).error).toMatch(/permission denied/);
    expect((await como(mestre, "select private_ficha.purgar_copias()")).error).toMatch(/permission denied/);
    const total = (await eventos(npc)).length;
    await admin("select private_ficha.purgar_copias()");
    expect((await eventos(npc)).some(e => e.copia)).toBe(true);
    await admin("update private_ficha.npc_ficha_eventos set copia_expira_em = now() - interval '1 minute' where copia is not null");
    await admin("select private_ficha.purgar_copias()");
    const depois = await eventos(npc);
    expect(depois).toHaveLength(total);
    expect(depois.some(e => e.copia)).toBe(false);
    expect((await admin("select count(*)::int as n from private_ficha.npc_ficha_eventos x where x::text like '%CRIATURA-%' or x::text like '%Alcunha de Garra%'"))[0].n).toBe(0);
    expect(await nota(npc)).toMatchObject({ title: "Garra", deleted_at: null });
    // sem ficha, a página volta a poder ser removida
    expect((await chamar(mestre, "codex_remove", campanha, npc, await versao(npc))).error).toBeUndefined();
  });

  it("trocar a referência compartilhada antiga não copia o catálogo", async () => {
    const velho = await novoNpc("Velho");
    expect((await chamar(mestre, "codex_set_combat_sheet", campanha, velho, await versao(velho), "goblin")).error).toBeUndefined();
    expect((await definir(mestre, velho, criaturaDe(velho))).error).toBeUndefined();
    expect((await eventos(velho)).at(-1)).toMatchObject({ removida: null, nova: "criatura", copia: null });
  });
});

describe("estado vital e PV persistentes", () => {
  const vida = (quem: string | null, id: string, patch: unknown, x: { op?: string; v?: number | null; onde?: string } = {}) =>
    como(quem, "select public.character_life_set($1,$2,$3::jsonb,$4::uuid,$5) as r", [x.onde ?? campanha, id, JSON.stringify(patch), x.op ?? crypto.randomUUID(), x.v ?? null]);
  const linhas = async (quem: string, id: string) => (await como(quem, "select estado, pv, temp, condicoes, version from public.character_life where note_id=$1", [id])).rows;

  it("o estado vital é do mestre, separado dos PV; o jogador só o vê quando revelado, inclusive 'desconhecido'", async () => {
    const npc = await novoNpc("Sombra");
    await revelar(npc, ["name"]);
    expect(await projecao(mestre, npc)).toMatchObject({ vitalStatus: "vivo" });
    for (const quem of [ana, fora, null]) expect((await vida(quem, npc, { estado: "morto" })).error).toBeDefined();
    expect((await vida(mestre, npc, { estado: "zumbi" })).error).toBeDefined();
    expect((await vida(mestre, npc, { pv: 3 }, { v: 0 })).error).toMatch(/estado_da_ficha/);   // sem ficha de criatura
    expect((await vida(mestre, npc, { estado: "desconhecido" })).error).toBeUndefined();
    expect(await projecao(ana, npc)).not.toHaveProperty("vitalStatus");
    expect(await linhas(ana, npc)).toEqual([]);
    await revelar(npc, ["name", "vitalStatus"]);
    expect(await projecao(ana, npc)).toMatchObject({ vitalStatus: "desconhecido" });
  });

  it("NPC com ficha de criatura guarda PV, temporários e condições, com versão e sem repetir operação", async () => {
    const npc = await novoNpc("Ogro");
    expect((await definir(mestre, npc, criaturaDe(npc, "Ogro"))).error).toBeUndefined();
    const op = crypto.randomUUID();
    expect((await vida(mestre, npc, { pv: 20, temp: 3, condicoes: ["Caído"] }, { v: 0, op })).error).toBeUndefined();
    expect((await vida(mestre, npc, { pv: 20, temp: 3, condicoes: ["Caído"] }, { v: 0, op })).error).toBeUndefined();
    expect(await linhas(mestre, npc)).toEqual([{ estado: "vivo", pv: 20, temp: 3, condicoes: ["Caído"], version: 1 }]);
    expect((await vida(mestre, npc, { pv: 1 }, { v: 0 })).error).toMatch(/conflito_de_versao/);
    expect((await vida(mestre, npc, { pv: 0 }, { v: 1 })).error).toBeUndefined();
    expect((await linhas(mestre, npc))[0]).toMatchObject({ estado: "vivo", pv: 0 });   // 0 PV não é morte
    expect((await vida(mestre, npc, { estado: "morto" })).error).toBeUndefined();
    // trocar a ficha zera PV e condições do corpo antigo e mantém o estado vital
    expect((await definir(mestre, npc, null, { confirmacao: "remover-ficha" })).error).toBeUndefined();
    expect((await linhas(mestre, npc))[0]).toMatchObject({ estado: "morto", pv: null, temp: 0, condicoes: [] });
  });

  it("aventureiro: o mestre marca; o dono lê o próprio estado; outro jogador não; PV continuam na ficha", async () => {
    const heroi = await criar(ana, "Lira");
    expect((await vida(ana, heroi, { estado: "morto" })).error).toMatch(/sem_permissao/);
    expect((await vida(mestre, heroi, { pv: 1 }, { v: 0 })).error).toMatch(/estado_da_ficha/);
    expect((await vida(mestre, heroi, { estado: "morto" })).error).toBeUndefined();
    expect(await linhas(ana, heroi)).toHaveLength(1);
    expect(await linhas(beto, heroi)).toEqual([]);
    expect((await vida(mestre, heroi, { estado: "vivo" })).error).toBeUndefined();   // ressuscitar preserva tudo
    expect(await lerFicha(ana, heroi)).toBeDefined();
    for (const comando of ["insert into public.character_life(note_id,campaign_id) values ($1, '" + campanha + "')", "update public.character_life set estado='morto' where note_id=$1", "delete from public.character_life where note_id=$1"])
      expect((await como(mestre, comando, [heroi])).error).toMatch(/permission denied/);
  });

  it("combate e encontros aceitam a referência a NPC e continuam recusando tipos desconhecidos", async () => {
    const estadoDe = (tipo: string) => JSON.stringify({ combatentes: [{ id: "c1", nome: "Ogro", lado: "inimigo", iniciativa: 1, ref: { tipo, id: "x" } }], turno: "c1", rodada: 1 });
    const valido = async (tipo: string) => (await admin("select private_combates.valid_campaign_combat_state($1::jsonb) as ok", [estadoDe(tipo)]))[0].ok;
    expect(await valido("npc")).toBe(true);
    expect(await valido("personagem")).toBe(true);
    expect(await valido("outro")).toBe(false);
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
      const diagnostico = async () => (await banco.exec(sql("preflight", "0022_conferir.sql"))).map(r => r.rows as Row[]);
      const [funcoesAntes, objetosAntes, contagensAntes, zerosAntes] = await diagnostico();
      expect(funcoesAntes.map(f => f.situacao)).toEqual(Array(12).fill("antes"));
      expect(objetosAntes[0]).toEqual({ versao: 21, tem_operacao_de_ficha: false, tem_estado_vital: false, tem_retencao_de_npc: false });
      await banco.exec(sql("migrations", "0022_npc_ficha_de_personagem.sql"));
      expect(await estado(banco)).toBe(antes);
      expect((await chamar(mestre, "codex_capabilities")).rows[0].r).toBe(22);
      const [funcoesDepois, objetosDepois, contagensDepois, zerosDepois] = await diagnostico();
      expect(funcoesDepois.map(f => f.situacao)).toEqual(Array(12).fill("depois"));
      expect(objetosDepois[0]).toEqual({ versao: 22, tem_operacao_de_ficha: true, tem_estado_vital: true, tem_retencao_de_npc: true });
      expect(contagensDepois).toEqual(contagensAntes);
      for (const z of [zerosAntes, zerosDepois]) expect(Object.values(z[0]).map(Number)).toEqual([0, 0]);
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

// PostgreSQL descartável: ciclo de vida dos personagens (0021) com as políticas reais. Nenhuma conexão com produção.
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
const acao = (quem: string | null, ids: string | string[], nome: string, extra: { op?: string; revisoes?: Record<string, number>; destino?: string; campanha?: string; confirmacao?: string | null } = {}) =>
  como(quem, "select public.character_lifecycle($1,$2::uuid[],$3,$4,$5::jsonb,$6,$7) as r",
    [extra.campanha ?? campanha, Array.isArray(ids) ? ids : [ids], nome, extra.op ?? crypto.randomUUID(), JSON.stringify(extra.revisoes ?? {}), extra.destino ?? null,
      extra.confirmacao !== undefined ? extra.confirmacao : nome === "excluir" ? "excluir-sem-recuperacao" : null]);
/** Todo o texto guardado no banco (inclusive esquemas privados), para provar que um conteúdo não sobrou em lugar nenhum. */
async function ondeAparece(trecho: string) {
  const tabelas = await admin("select format('%I.%I', schemaname, tablename) as t from pg_tables where schemaname in ('public','private','private_ficha','private_combates')") as { t: string }[];
  const achadas: string[] = [];
  for (const { t } of tabelas) if ((await admin(`select 1 from ${t} x where x::text like $1 limit 1`, [`%${trecho}%`])).length) achadas.push(t);
  return achadas;
}
const copias = async (id: string) => admin("select acao, copia is not null as tem, copia_expira_em from private_ficha.ciclo_eventos where character_id=$1 order by id", [id]) as Promise<{ acao: string; tem: boolean; copia_expira_em: Date | null }[]>;
const lerFicha = async (quem: string, id: string) => (await como(quem, "select owner_id, revision, draft from public.character_sheets where character_id=$1", [id])).rows[0] as { owner_id: string; revision: number; draft: Row } | undefined;
const revisao = async (id: string) => (await admin("select revision from public.character_sheets where character_id=$1", [id]))[0].revision as number;
const nota = async (id: string) => (await admin("select owner_id, visibility, title, meta, deleted_at, kind from public.notes where id=$1", [id]))[0];
const situacoes = async (quem: string) => (await chamar(quem, "character_states", campanha)).rows[0].r as Row[];
const situacao = async (id: string) => ((await situacoes(mestre)).find(x => x.id === id)?.state as string | undefined) ?? "ativo";
const avisos = async (quem: string) => (await como(quem, "select kind, title, read_at from public.character_notices order by id")).rows;
const salvar = async (quem: string, id: string, rev: number, nome: string) => como(quem, "select * from public.save_guided_character($1,$2,$3::jsonb)", [id, rev, JSON.stringify(ficha(nome))]);

beforeAll(async () => { db = new PGlite(); await preparar(db); await criarContas(); }, 60000);
afterAll(async () => { await db?.close(); });

describe("renúncia do jogador", () => {
  it("o antigo dono perde leitura e escrita; ficha, inventário, identidade e vínculos continuam; o mestre é avisado", async () => {
    const id = await criar(ana, "Lyra");
    const antes = (await lerFicha(ana, id))!;
    // outra sessão do mesmo jogador ainda com a ficha aberta
    for (const quem of [beto, fora, null]) expect((await acao(quem, id, "renunciar", { revisoes: { [id]: antes.revision } })).error).toBeDefined();
    expect((await acao(mestre, id, "renunciar", { revisoes: { [id]: antes.revision } })).error).toContain("sem_permissao");
    expect((await acao(ana, id, "renunciar", { revisoes: { [id]: antes.revision - 1 } })).error).toContain("conflito_de_revisao");
    const op = crypto.randomUUID();
    expect((await acao(ana, id, "renunciar", { op, revisoes: { [id]: antes.revision } })).error).toBeUndefined();
    expect((await acao(ana, id, "renunciar", { op, revisoes: { [id]: antes.revision } })).error).toBeUndefined();   // repetição inofensiva
    expect(await lerFicha(ana, id)).toBeUndefined();
    expect((await salvar(ana, id, antes.revision, "Invasão")).error).toContain("ficha_nao_encontrada");
    expect((await salvar(ana, id, antes.revision + 1, "Invasão")).error).toContain("ficha_nao_encontrada");
    expect((await chamar(ana, "alterar_vitais", id, JSON.stringify({ tipo: "dano", valor: 1 }), crypto.randomUUID())).error).toBeDefined();
    expect((await como(ana, "update public.notes set title='Meu de novo' where id=$1 returning id", [id])).rows).toEqual([]);
    expect((await como(ana, "delete from public.notes where id=$1 returning id", [id])).rows).toEqual([]);
    const depois = (await lerFicha(mestre, id))!;
    expect(depois.owner_id).toBe(mestre);
    expect(depois.draft).toEqual(antes.draft);
    const n = await nota(id);
    expect(n).toMatchObject({ owner_id: mestre, visibility: "campaign", deleted_at: null, title: "Alcunha de Lyra" });
    expect((n.meta as { identidadePublica: { card: Row; settings: Row } }).identidadePublica.card.race).toBeNull();   // privacidade por campo mantida
    expect(await situacao(id)).toBe("aguardando");
    expect(await situacoes(beto)).toContainEqual({ id, state: "aguardando" });                                        // sem dados do dono anterior
    expect(await avisos(mestre)).toContainEqual({ kind: "renuncia", title: "Alcunha de Lyra", read_at: null });
    expect(await avisos(ana)).toEqual([]);
    expect(await avisos(beto)).toEqual([]);
    expect((await criar(ana, "Nova"))).toBeTruthy();                                                                   // pode criar outro na hora
    for (const nomeAcao of ["arquivar", "npc", "excluir", "reativar"]) expect((await acao(ana, id, nomeAcao, { revisoes: { [id]: await revisao(id) } })).error).toContain("sem_permissao");
  });

  it("a API não forja a marca de troca de dono nem lê o ciclo", async () => {
    const id = await criar(ana, "Forja");
    for (const quem of [ana, mestre]) {
      expect((await como(quem, "update public.character_sheets set owner_id=$1 where character_id=$2", [beto, id])).error).toBeDefined();
      expect((await como(quem, "update public.notes set owner_id=$1 where id=$2", [beto, id])).error).toBeDefined();
      for (const tabela of ["ciclo", "ciclo_eventos", "transferencias", "mudanca_ciclo"]) expect((await como(quem, `select * from private_ficha.${tabela}`)).error).toBeDefined();
      expect((await como(quem, "select private_ficha.trocar_dono($1,$2)", [id, beto])).error).toMatch(/permission denied/);
      expect((await como(quem, "insert into public.character_notices(campaign_id,recipient,character_id,kind,title) values($1,$2,$3,'renuncia','x')", [campanha, mestre, id])).error).toBeDefined();
    }
  });
});

describe("decisões do mestre", () => {
  it("arquivar, converter em NPC e reativar preservam o mesmo registro, sem duplicar", async () => {
    const id = await criar(ana, "Brann");
    const antes = (await lerFicha(ana, id))!;
    const total = async () => (await admin("select count(*)::int as n from public.notes where campaign_id=$1", [campanha]))[0].n as number;
    const notas = await total();
    for (const [nomeAcao, esperado] of [["arquivar", "arquivado"], ["npc", "npc"], ["aguardar", "aguardando"], ["reativar", "ativo"]]) {
      expect((await acao(mestre, id, nomeAcao)).error).toBeUndefined();
      expect(await situacao(id)).toBe(esperado);
      expect((await lerFicha(mestre, id))!.draft).toEqual(antes.draft);
      expect(await lerFicha(ana, id)).toBeUndefined();
    }
    expect(await total()).toBe(notas);
  });

  it("manter só no Compêndio: remove a ficha, preserva identidade e vínculos, e ninguém recria a ficha", async () => {
    const id = await criar(ana, "Selva");
    const alvo = (await chamar(mestre, "codex_save", campanha, null, 0, JSON.stringify({ category: "location", title: "Vila", description: [], fields: {}, sheet: [] }))).rows[0].r as string;
    expect((await chamar(mestre, "codex_link", campanha, id, alvo, "residence", "Mora em", "Habitante", true)).error).toBeUndefined();
    expect((await acao(mestre, id, "compendio", { revisoes: { [id]: 0 } })).error).toContain("conflito_de_revisao");
    expect((await acao(mestre, id, "compendio", { revisoes: { [id]: await revisao(id) } })).error).toBeUndefined();
    expect(await admin("select 1 from public.character_sheets where character_id=$1", [id])).toEqual([]);
    expect(await nota(id)).toMatchObject({ deleted_at: null, visibility: "campaign", title: "Alcunha de Selva" });
    expect(((await chamar(mestre, "codex_links_for", campanha, id)).rows[0].r as Row[]).map(l => l.targetId)).toEqual([alvo]);
    expect(await situacao(id)).toBe("compendio");
    const [{ copia }] = await admin("select copia from private_ficha.ciclo_eventos where character_id=$1 and acao='compendio'", [id]) as { copia: { ficha: { draft: Row }; itens_vistos: string[] } }[];
    expect(copia.ficha.draft.inventory).toHaveLength(1);
    expect(copia.itens_vistos).toContain("longsword");
    expect((await como(mestre, "insert into public.character_sheets(character_id,campaign_id,owner_id,draft) values($1,$2,$3,$4::jsonb)", [id, campanha, mestre, JSON.stringify({ ...ficha("x"), id })])).error).toContain("personagem_encerrado");
    expect((await como(mestre, "delete from public.notes where id=$1 returning id", [id])).rows).toEqual([]);
    expect((await como(mestre, "update public.notes set deleted_at=now() where id=$1", [id])).error).toBeDefined();
    for (const nomeAcao of ["arquivar", "npc", "reativar"]) expect((await acao(mestre, id, nomeAcao)).error).toContain("sem_ficha");
  });

  it("excluir definitivamente remove ficha, registro ativo e vínculos; combate, encontros e documentos continuam", async () => {
    const id = await criar(ana, "Dain");
    const alvo = (await chamar(mestre, "codex_save", campanha, null, 0, JSON.stringify({ category: "organization", title: "Guilda", description: [{ type: "paragraph", content: [{ type: "text", text: `Fundada por @[Alcunha de Dain](${id})` }] }], fields: {}, sheet: [] }))).rows[0].r as string;
    expect((await chamar(mestre, "codex_link", campanha, id, alvo, "member", "Membro de", "Possui membro", true)).error).toBeUndefined();
    const diario = (await como(mestre, "insert into public.notes(campaign_id,kind,title,body,visibility) values($1,'diary','Sessão 1','Dain caiu na ponte','campaign') returning id", [campanha])).rows[0].id as string;
    const combatente = { id: "c1", nome: "Dain", iniciativa: 5, lado: "aliado", pv: 9, pvMax: 20, ref: { tipo: "personagem", id } };
    await db.query("insert into public.campaign_combats as b(campaign_id,state) values($1,$2::jsonb) on conflict(campaign_id) do update set state=excluded.state,version=b.version+1", [campanha, JSON.stringify({ combatentes: [combatente], turno: "c1", rodada: 2 })]);
    await db.query("insert into public.campaign_encounters as b(campaign_id,state) values($1,$2::jsonb) on conflict(campaign_id) do update set state=excluded.state,version=b.version+1", [campanha, JSON.stringify({ encontros: [{ id: "e1", nome: "Ponte", participantes: [{ id: "p1", nome: "Dain", quantidade: 1, pv: 13, ref: { tipo: "personagem", id } }] }] })]);
    const op = crypto.randomUUID(), rev = await revisao(id);
    for (const confirmacao of [null, "sim"]) expect((await acao(mestre, id, "excluir", { revisoes: { [id]: rev }, confirmacao })).error).toContain("confirmacao_exigida");
    expect(await lerFicha(mestre, id)).toBeDefined();
    expect((await acao(mestre, id, "excluir", { op, revisoes: { [id]: rev } })).error).toBeUndefined();
    expect((await acao(mestre, id, "excluir", { op, revisoes: { [id]: rev } })).error).toBeUndefined();
    expect((await acao(mestre, id, "excluir", { revisoes: { [id]: rev } })).error).toContain("personagem_indisponivel");
    for (const quem of [ana, beto, mestre]) {
      expect(await lerFicha(quem, id)).toBeUndefined();
      expect((await situacoes(quem)).some(x => x.id === id)).toBe(false);
    }
    expect((await nota(id)).deleted_at).not.toBeNull();
    expect((await como(beto, "select id from public.notes where id=$1", [id])).rows).toEqual([]);
    expect((await chamar(mestre, "codex_links_for", campanha, alvo)).rows[0].r).toEqual([]);
    expect(await admin("select 1 from public.codex_links where $1 in (source_id,target_id)", [id])).toEqual([]);
    // o jogador lê a referência narrativa como texto simples, sem o ID
    expect((await chamar(mestre, "codex_reveal", campanha, alvo, (await admin("select version from public.campaign_codex where id=$1", [alvo]))[0].version, true, ["name", "description"])).error).toBeUndefined();
    const visto = JSON.stringify(((await chamar(beto, "codex_list", campanha)).rows[0].r as Row[]).find(x => x.id === alvo));
    expect(visto).toContain("Fundada por");
    expect(visto).not.toContain(id);
    expect((await admin("select body from public.notes where id=$1", [diario]))[0].body).toBe("Dain caiu na ponte");
    const estado = (await admin("select state from public.campaign_combats where campaign_id=$1", [campanha]))[0].state as { combatentes: Row[]; turno: string };
    expect(estado.combatentes[0]).toEqual({ id: "c1", nome: "Dain", iniciativa: 5, lado: "aliado", pv: 9, pvMax: 20 });
    const encontros = (await admin("select state from public.campaign_encounters where campaign_id=$1", [campanha]))[0].state as { encontros: { participantes: Row[] }[] };
    expect(encontros.encontros[0].participantes[0]).toEqual({ id: "p1", nome: "Dain", quantidade: 1, pv: 13 });
    // nenhuma cópia recuperável: nem a do próprio ato; só o histórico (quem, quando, o quê, título) continua
    expect(await copias(id)).toEqual([{ acao: "excluir", tem: false, copia_expira_em: null }]);
    expect((await admin("select acao, titulo, actor_id from private_ficha.ciclo_eventos where character_id=$1", [id]))).toEqual([{ acao: "excluir", titulo: "Alcunha de Dain", actor_id: mestre }]);
    expect(await nota(id)).toMatchObject({ meta: {} });
    expect(await ondeAparece("História de Dain")).toEqual([]);
    expect(JSON.stringify([await nota(id), await admin("select * from private_ficha.ciclo_eventos where character_id=$1", [id])])).not.toContain("Descrição pública");   // resumo público derivado da ficha
    expect(await admin("select 1 from private_ficha.itens_vistos where character_id=$1", [id])).toEqual([]);
    expect((await avisos(mestre)).some(a => a.title === "Alcunha de Dain")).toBe(false);
  });

  it("exclusão em lote é tudo ou nada, só do mestre e só da própria campanha", async () => {
    const a = await criar(ana, "Lote A"), b = await criar(beto, "Lote B");
    const alheio = await criar(fora, "De outra campanha", true, outra);
    const revisoes = { [a]: await revisao(a), [b]: await revisao(b), [alheio]: await revisao(alheio) };
    expect((await acao(ana, [a, b], "excluir", { revisoes })).error).toContain("sem_permissao");
    expect((await acao(fora, [a, b], "excluir", { revisoes })).error).toContain("sem_permissao");
    expect((await acao(mestre, [a, alheio], "excluir", { revisoes })).error).toContain("personagem_indisponivel");
    expect((await acao(mestre, [a, b], "excluir", { revisoes: { ...revisoes, [b]: 0 } })).error).toContain("conflito_de_revisao");
    expect(await lerFicha(mestre, a)).toBeDefined();
    expect(await lerFicha(mestre, b)).toBeDefined();
    expect((await acao(mestre, [a, b, a], "excluir", { revisoes })).error).toBeUndefined();
    expect(await admin("select 1 from public.character_sheets where character_id = any($1::uuid[])", [[a, b]])).toEqual([]);
    expect(await admin("select 1 from public.character_sheets where character_id=$1", [alheio])).toHaveLength(1);
  });

  it("personagem sem ficha guiada (registro antigo simples) pode ser excluído", async () => {
    const simples = (await como(ana, "insert into public.notes(campaign_id,kind,title,visibility) values($1,'character','Antigo','campaign') returning id", [campanha])).rows[0].id as string;
    expect((await acao(mestre, simples, "arquivar")).error).toContain("sem_ficha");
    expect((await acao(mestre, simples, "excluir")).error).toBeUndefined();
    expect((await nota(simples)).deleted_at).not.toBeNull();
  });
});

describe("retenção das cópias", () => {
  it("só no Compêndio: a cópia dura 30 dias e depois é apagada pela limpeza (agendada ou na operação seguinte)", async () => {
    const id = await criar(ana, "Prazo");
    expect((await acao(mestre, id, "compendio", { revisoes: { [id]: await revisao(id) } })).error).toBeUndefined();
    const [antes] = await copias(id);
    expect(antes.tem).toBe(true);
    const dias = (new Date(antes.copia_expira_em!).getTime() - Date.now()) / 86400000;
    expect(dias).toBeGreaterThan(29.9); expect(dias).toBeLessThan(30.1);
    expect(await ondeAparece("História de Prazo")).toEqual(["private_ficha.ciclo_eventos"]);
    for (const quem of [ana, mestre]) {
      expect((await como(quem, "select copia from private_ficha.ciclo_eventos")).error).toBeDefined();
      expect((await como(quem, "select private_ficha.purgar_copias()")).error).toMatch(/permission denied/);
    }
    // um dia antes do vencimento continua; vencida, a limpeza apaga
    await db.query("update private_ficha.ciclo_eventos set copia_expira_em = now() + interval '1 day' where character_id=$1", [id]);
    await admin("select private_ficha.purgar_copias()");
    expect((await copias(id))[0].tem).toBe(true);
    await db.query("update private_ficha.ciclo_eventos set copia_expira_em = now() - interval '1 second' where character_id=$1", [id]);
    const outro = await criar(beto, "Gatilho");
    expect((await acao(mestre, outro, "arquivar")).error).toBeUndefined();       // qualquer operação do ciclo também limpa
    expect(await copias(id)).toEqual([{ acao: "compendio", tem: false, copia_expira_em: null }]);
    expect(await ondeAparece("História de Prazo")).toEqual([]);
    expect(await nota(id)).toMatchObject({ deleted_at: null, title: "Alcunha de Prazo" });   // o registro do Compêndio continua
  });

  it("excluir depois de só no Compêndio apaga a cópia ainda no prazo; arquivar não tem prazo", async () => {
    const id = await criar(ana, "Apagar");
    expect((await acao(mestre, id, "compendio", { revisoes: { [id]: await revisao(id) } })).error).toBeUndefined();
    expect(await ondeAparece("História de Apagar")).toEqual(["private_ficha.ciclo_eventos"]);
    expect((await acao(mestre, id, "excluir")).error).toBeUndefined();
    expect((await copias(id)).map(c => c.tem)).toEqual([false, false]);
    expect(await ondeAparece("História de Apagar")).toEqual([]);
    const guardado = await criar(ana, "Guardado");
    expect((await acao(mestre, guardado, "arquivar")).error).toBeUndefined();
    await admin("select private_ficha.purgar_copias()");
    expect((await lerFicha(mestre, guardado))!.draft).toMatchObject({ story: { historia: "História de Guardado" } });
    expect((await copias(guardado)).every(c => !c.tem && c.copia_expira_em === null)).toBe(true);
  });
});

describe("transferência com aceite", () => {
  it("o dono continua com o personagem até o aceite; depois só o destinatário controla", async () => {
    const id = await criar(ana, "Troca");
    const antes = (await lerFicha(ana, id))!;
    for (const destino of [fora, ana]) expect((await acao(mestre, id, "transferir", { destino })).error).toContain("destino_invalido");
    expect((await acao(ana, id, "transferir", { destino: beto })).error).toContain("sem_permissao");
    expect((await acao(mestre, id, "transferir", { destino: beto })).error).toBeUndefined();
    expect((await lerFicha(ana, id))).toBeDefined();
    expect(await lerFicha(beto, id)).toBeUndefined();                       // nada da ficha antes do aceite
    expect((await situacoes(mestre)).find(x => x.id === id)).toMatchObject({ state: "ativo", pendingTo: beto });
    expect((await situacoes(ana)).some(x => x.id === id)).toBe(false);
    const ofertas = (await chamar(beto, "character_offers", campanha)).rows[0].r as Row[];
    expect(ofertas).toHaveLength(1);
    expect(ofertas[0]).toMatchObject({ characterId: id, title: "Alcunha de Troca" });
    expect(JSON.stringify(ofertas)).not.toContain("História");
    expect((await chamar(ana, "character_offers", campanha)).rows[0].r).toEqual([]);
    const oferta = ofertas[0].id as string;
    expect((await chamar(ana, "character_offer_answer", oferta, true)).error).toContain("oferta_indisponivel");
    expect((await chamar(mestre, "character_offer_answer", oferta, true)).error).toContain("oferta_indisponivel");
    expect((await chamar(beto, "character_offer_answer", oferta, true)).error).toBeUndefined();
    expect((await chamar(beto, "character_offer_answer", oferta, true)).error).toBeUndefined();   // repetição inofensiva
    expect((await chamar(beto, "character_offer_answer", oferta, false)).error).toContain("oferta_indisponivel");
    const novo = (await lerFicha(beto, id))!;
    expect(novo.owner_id).toBe(beto);
    expect(novo.draft).toEqual(antes.draft);
    expect(await lerFicha(ana, id)).toBeUndefined();
    expect((await salvar(ana, id, novo.revision, "Invasão")).error).toContain("ficha_nao_encontrada");
    expect((await salvar(beto, id, novo.revision, "Troca")).error).toBeUndefined();
    expect((await nota(id)).owner_id).toBe(beto);
    expect(await avisos(beto)).toContainEqual(expect.objectContaining({ kind: "oferta" }));
    expect(await avisos(mestre)).toContainEqual(expect.objectContaining({ kind: "oferta-aceita" }));
  });

  it("recusa, cancelamento e outra decisão do mestre encerram a oferta", async () => {
    const id = await criar(ana, "Oferta");
    const oferta = async () => ((await chamar(beto, "character_offers", campanha)).rows[0].r as Row[]).find(o => o.characterId === id)?.id as string;
    expect((await acao(mestre, id, "transferir", { destino: beto })).error).toBeUndefined();
    const primeira = await oferta();
    expect((await chamar(beto, "character_offer_answer", primeira, false)).error).toBeUndefined();
    expect(await lerFicha(ana, id)).toBeDefined();
    expect(await oferta()).toBeUndefined();
    expect((await acao(mestre, id, "transferir", { destino: beto })).error).toBeUndefined();
    const segunda = await oferta();
    expect((await acao(mestre, id, "cancelar-transferencia")).error).toBeUndefined();
    expect((await chamar(beto, "character_offer_answer", segunda, true)).error).toContain("oferta_indisponivel");
    expect((await acao(mestre, id, "transferir", { destino: beto })).error).toBeUndefined();
    const terceira = await oferta();
    expect((await acao(mestre, id, "arquivar")).error).toBeUndefined();
    expect((await chamar(beto, "character_offer_answer", terceira, true)).error).toContain("oferta_indisponivel");
    expect(await lerFicha(beto, id)).toBeUndefined();
  });

  it("transferir de um arquivado reativa para o destinatário", async () => {
    const id = await criar(ana, "Volta");
    expect((await acao(mestre, id, "arquivar")).error).toBeUndefined();
    expect((await acao(mestre, id, "transferir", { destino: beto })).error).toBeUndefined();
    expect(await situacao(id)).toBe("arquivado");
    const oferta = ((await chamar(beto, "character_offers", campanha)).rows[0].r as Row[]).find(o => o.characterId === id)!.id as string;
    expect((await chamar(beto, "character_offer_answer", oferta, true)).error).toBeUndefined();
    expect(await situacao(id)).toBe("ativo");
    expect((await lerFicha(beto, id))!.owner_id).toBe(beto);
  });
});

describe("capacidade e reversão", () => {
  it("anuncia a versão vigente e a reversão da 0021 é recusada depois que o ciclo foi usado", async () => {
    expect((await chamar(mestre, "codex_capabilities")).rows[0].r).toBe(22);
    await expect(db.exec(sql("rollback", "0021_personagens_ciclo_de_vida_down.sql"))).rejects.toThrow(/reversao_0021_recusada/);
    await db.exec("rollback");
    expect((await chamar(mestre, "codex_capabilities")).rows[0].r).toBe(22);
  });

  it("sem uso, a reversão volta à 0020 e a migração pode ser aplicada de novo", async () => {
    const principal = db, anteriores = [campanha, outra] as const;
    db = new PGlite();
    try {
      await preparar(db); await criarContas();
      const id = await criar(ana, "Antes");
      await db.exec(sql("rollback", "0021_personagens_ciclo_de_vida_down.sql"));
      expect((await chamar(mestre, "codex_capabilities")).rows[0].r).toBe(20);
      expect((await salvar(ana, id, await revisao(id), "Depois")).error).toBeUndefined();
      expect((await como(ana, "delete from public.notes where id=$1", [id])).error).toBeDefined();   // guarda anterior de volta
      await db.exec(sql("migrations", "0021_personagens_ciclo_de_vida.sql"));
      expect((await chamar(mestre, "codex_capabilities")).rows[0].r).toBe(21);
    } finally { await db.close(); db = principal; [campanha, outra] = anteriores; }
  }, 60000);
});

describe("identidades ocultas de registros antigos", () => {
  it("outra origem do mesmo aviso: o jogador saiu da campanha; o mestre é informado e pode devolver a identidade à campanha", async () => {
    const sair = uid(5);
    await db.query("insert into auth.users(id,email) values($1,'sai@example.invalid')", [sair]);
    const convite = (await chamar(mestre, "create_invite", campanha, 10, 7)).rows[0].r;
    expect((await chamar(sair, "join_campaign", convite)).error).toBeUndefined();
    const id = await criar(sair, "Partiu");
    expect((await como(mestre, "select id from public.notes where id=$1", [id])).rows).toHaveLength(1);
    expect((await como(sair, "delete from public.campaign_members where campaign_id=$1 and user_id=$2 returning user_id", [campanha, sair])).rows).toHaveLength(1);
    expect((await nota(id)).visibility).toBe("campaign");                                            // ninguém ocultou nada
    expect((await como(mestre, "select id from public.notes where id=$1", [id])).rows).toEqual([]);   // mas a regra de leitura esconde
    expect(await lerFicha(mestre, id)).toBeDefined();
    expect(await situacoes(mestre)).toContainEqual({ id, state: "ativo", ownerLeft: true });
    expect((await situacoes(beto)).some(x => x.id === id)).toBe(false);
    expect((await acao(mestre, id, "transferir", { destino: mestre })).error).toBeUndefined();
    for (const quem of [mestre, beto]) expect((await como(quem, "select id from public.notes where id=$1", [id])).rows).toHaveLength(1);
    expect(await lerFicha(beto, id)).toBeUndefined();
    expect((await situacoes(mestre)).some(x => x.id === id)).toBe(false);
  });

  it("a origem é a ficha criada antes da 0013 e nunca regravada; o reparo mantém as escolhas por campo", async () => {
    const principal = db, anteriores = [campanha, outra] as const;
    db = new PGlite();
    try {
      await preparar(db, "0013"); await criarContas();
      const antiga = (await como(ana, "select * from public.create_guided_character($1,'x',$2::jsonb,false,$3::jsonb)", [campanha, JSON.stringify({ identidadePublica: { settings: { imageUrl: null, title: "", name: real, surname: oculto, race: oculto, characterClass: real, description: "" }, card: { imageUrl: null, title: "", name: "Velha", surname: null, race: null, characterClass: null, description: "" } } }), JSON.stringify(ficha("Velha"))])).rows[0].character_id as string;
      for (const f of migracoes().filter(x => x >= "0013")) await db.exec(sql("migrations", f));
      const nova = await criar(beto, "Nova", false);
      expect((await nota(antiga)).visibility).toBe("private");                        // o que aparece como "oculto para outros jogadores"
      expect((await nota(nova)).visibility).toBe("campaign");                          // desde a 0013 não há como ficar oculta
      const diagnostico = await db.exec(sql("preflight", "personagens_exclusao_visibilidade.sql"));
      expect(diagnostico.length).toBeGreaterThan(3);
      expect((await nota(antiga)).visibility).toBe("private");                         // diagnóstico é somente leitura
      const draft = (await lerFicha(ana, antiga))!;
      await db.exec(sql("reparos", "identidades_ocultas_antigas.sql"));
      const reparada = await nota(antiga);
      expect(reparada.visibility).toBe("campaign");
      expect((reparada.meta as { identidadePublica: { card: Row } }).identidadePublica.card).toMatchObject({ name: "Velha", race: null, title: "" });
      expect((await lerFicha(ana, antiga))!).toEqual(draft);                            // a ficha não muda (nem a revisão)
      expect((await lerFicha(beto, antiga))).toBeUndefined();                           // ficha completa continua privada
      expect((await como(beto, "select id from public.notes where id=$1", [antiga])).rows).toHaveLength(1);
      const versao = (await admin("select version from public.notes where id=$1", [antiga]))[0].version;
      await db.exec(sql("reparos", "identidades_ocultas_antigas.sql"));                 // idempotente
      expect((await admin("select version from public.notes where id=$1", [antiga]))[0].version).toBe(versao);
    } finally { await db.close(); db = principal; [campanha, outra] = anteriores; }
  }, 90000);
});

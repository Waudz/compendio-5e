// Testa as migrações SQL e a RLS de verdade, num Postgres real em memória (PGlite).
// Não é o Supabase hospedado: o schema `auth` e os papéis anon/authenticated são simulados abaixo
// do mesmo jeito que o Supabase os fornece (auth.uid() lê o claim `sub`).
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { beforeAll, describe, expect, it } from "vitest";
import { storageStub } from "./stub-storage";

const dir = join(__dirname, "migrations");
let db: PGlite;
const ids = { ana: "00000000-0000-0000-0000-00000000000a", bia: "00000000-0000-0000-0000-00000000000b", caio: "00000000-0000-0000-0000-00000000000c", dora: "00000000-0000-0000-0000-00000000000d" };

const stub = `
create role anon nologin; create role authenticated nologin;
create schema auth;
create table auth.users (id uuid primary key default gen_random_uuid(), email text);
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
grant usage on schema auth to anon, authenticated; grant execute on function auth.uid() to anon, authenticated;
grant usage on schema public to anon, authenticated;
-- Como no Supabase: tabelas e funções novas nascem acessíveis a anon/authenticated (as migrações precisam revogar).
alter default privileges in schema public grant all on tables to anon, authenticated;
alter default privileges in schema public grant all on functions to anon, authenticated;
` + storageStub;

/** Executa como um usuário autenticado (ou anônimo). Devolve linhas, ou { error } com a mensagem do Postgres. */
async function as(uid: string | null, sql: string, params: unknown[] = []): Promise<{ rows: Record<string, unknown>[]; error?: string }> {
  await db.exec(`set role ${uid ? "authenticated" : "anon"}; select set_config('request.jwt.claim.sub', '${uid ?? ""}', false);`);
  try { return { rows: (await db.query<Record<string, unknown>>(sql, params)).rows }; }
  catch (e) { return { rows: [], error: (e as Error).message }; }
  finally { await db.exec("reset role"); }
}
const rpc = async (uid: string | null, fn: string, ...args: unknown[]) => as(uid, `select public.${fn}(${args.map((_, i) => `$${i + 1}`).join(",")}) as r`, args);

beforeAll(async () => {
  db = new PGlite();
  await db.exec(stub);
  for (const f of readdirSync(dir).filter(f => f.endsWith(".sql")).sort()) await db.exec(readFileSync(join(dir, f), "utf8"));
  for (const [n, id] of Object.entries(ids)) await db.query("insert into auth.users (id, email) values ($1, $2)", [id, `${n}@exemplo.com`]);
});

let camp: string; let code: string;

describe("criação e visibilidade", () => {
  it("cria perfil automaticamente", async () => {
    expect((await db.query("select display_name from public.profiles where id = $1", [ids.ana])).rows[0]).toEqual({ display_name: "ana" });
  });
  it("visitante (anon) e usuário sem login não acessam nada", async () => {
    for (const t of ["profiles", "campaigns", "campaign_members", "campaign_invites"]) expect((await as(null, `select * from public.${t}`)).error).toMatch(/permission denied/);
    expect((await rpc(null, "create_campaign", "X", "")).error).toMatch(/permission denied/);
  });
  it("criar campanha torna o criador mestre; valida nome e descrição", async () => {
    const r = await rpc(ids.ana, "create_campaign", "  Festival da Lua ", "Aventura");
    camp = r.rows[0].r as string; expect(camp).toMatch(/^[0-9a-f-]{36}$/);
    expect((await as(ids.ana, "select name, description from public.campaigns")).rows).toEqual([{ name: "Festival da Lua", description: "Aventura" }]);
    expect((await as(ids.ana, "select role from public.campaign_members where campaign_id = $1", [camp])).rows).toEqual([{ role: "mestre" }]);
    expect((await rpc(ids.ana, "create_campaign", "   ", "")).error).toMatch(/nome_invalido/);
    expect((await rpc(ids.ana, "create_campaign", "x".repeat(81), "")).error).toMatch(/nome_invalido/);
    expect((await rpc(ids.ana, "create_campaign", "ok", "d".repeat(1001))).error).toMatch(/descricao_invalida/);
  });
  it("não é possível criar campanha ou participante por INSERT direto (nem se promover)", async () => {
    expect((await as(ids.bia, "insert into public.campaigns (name, created_by) values ('Hack', $1)", [ids.bia])).error).toMatch(/permission denied/);
    expect((await as(ids.bia, "insert into public.campaign_members (campaign_id, user_id, role) values ($1, $2, 'mestre')", [camp, ids.bia])).error).toMatch(/permission denied/);
    expect((await as(ids.bia, "insert into public.campaign_invites (campaign_id, code, created_by, expires_at, max_uses) values ($1,'AAAAAAAAAAAA',$2, now()+interval '1 day', 1)", [camp, ids.bia])).error).toMatch(/permission denied/);
  });
  it("terceiros não enxergam campanha, participantes nem convites", async () => {
    expect((await as(ids.bia, "select * from public.campaigns")).rows).toEqual([]);
    expect((await as(ids.bia, "select * from public.campaign_members")).rows).toEqual([]);
    expect((await as(ids.bia, "select * from public.campaign_invites")).rows).toEqual([]);
    expect((await as(ids.bia, "select id from public.profiles where id = $1", [ids.ana])).rows).toEqual([]);
  });
});

describe("convites", () => {
  it("só o mestre cria convite", async () => {
    expect((await rpc(ids.bia, "create_invite", camp, 5, 7)).error).toMatch(/sem_permissao/);
    const r = await rpc(ids.ana, "create_invite", camp, 2, 7); code = r.rows[0].r as string;
    expect(code).toMatch(/^[A-Z0-9]{12}$/);
  });
  it("entrar com código: vira jogador; código inválido dá erro genérico", async () => {
    expect((await rpc(ids.bia, "join_campaign", "ZZZZZZZZZZZZ")).error).toMatch(/convite_invalido/);
    expect((await rpc(ids.bia, "join_campaign", code.toLowerCase())).rows[0].r).toBe(camp);
    expect((await as(ids.bia, "select role from public.campaign_members where user_id = $1", [ids.bia])).rows).toEqual([{ role: "jogador" }]);
  });
  it("entrar de novo é idempotente e não consome o convite", async () => {
    await rpc(ids.bia, "join_campaign", code);
    expect((await db.query("select uses from public.campaign_invites where code = $1", [code])).rows).toEqual([{ uses: 1 }]);
  });
  it("jogador vê a campanha e companheiros, mas não os convites", async () => {
    expect((await as(ids.bia, "select name from public.campaigns")).rows).toEqual([{ name: "Festival da Lua" }]);
    expect((await as(ids.bia, "select count(*)::int as n from public.campaign_members")).rows).toEqual([{ n: 2 }]);
    expect((await as(ids.bia, "select * from public.campaign_invites")).rows).toEqual([]);
    expect((await as(ids.bia, "select display_name from public.profiles where id = $1", [ids.ana])).rows).toEqual([{ display_name: "ana" }]);
  });
  it("respeita limite de usos, expiração e revogação", async () => {
    await rpc(ids.caio, "join_campaign", code);                                   // 2º uso
    expect((await rpc(ids.dora, "join_campaign", code)).error).toMatch(/convite_invalido/); // esgotado
    const c2 = (await rpc(ids.ana, "create_invite", camp, 5, 7)).rows[0].r as string;
    await db.query("update public.campaign_invites set expires_at = now() - interval '1 minute' where code = $1", [c2]);
    expect((await rpc(ids.dora, "join_campaign", c2)).error).toMatch(/convite_invalido/);
    const c3 = (await rpc(ids.ana, "create_invite", camp, 5, 7)).rows[0].r as string;
    expect((await as(ids.ana, "delete from public.campaign_invites where code = $1 returning id", [c3])).rows).toHaveLength(1);
    expect((await rpc(ids.dora, "join_campaign", c3)).error).toMatch(/convite_invalido/);
  });
  it("jogador não apaga convites", async () => {
    const c = (await rpc(ids.ana, "create_invite", camp, 5, 7)).rows[0].r as string;
    expect((await as(ids.bia, "delete from public.campaign_invites where code = $1 returning id", [c])).rows).toEqual([]);
    expect((await db.query("select 1 from public.campaign_invites where code = $1", [c])).rows).toHaveLength(1);
  });
  it("parâmetros do convite são limitados no servidor", async () => {
    await rpc(ids.ana, "create_invite", camp, 9999, 9999);
    const r = (await db.query<{ max_uses: number; days: number }>("select max_uses, round(extract(epoch from expires_at - now()) / 86400)::int as days from public.campaign_invites order by created_at desc limit 1")).rows[0];
    expect(r.max_uses).toBe(50); expect(r.days).toBe(30);
  });
});

describe("papéis e participantes (escalonamento de privilégios)", () => {
  it("jogador não altera papéis, nem o próprio", async () => {
    expect((await rpc(ids.bia, "set_member_role", camp, ids.bia, "mestre")).error).toMatch(/does not exist/);   // a função de promoção foi removida
    expect((await as(ids.bia, "update public.campaign_members set role = 'mestre' where user_id = $1", [ids.bia])).error).toMatch(/permission denied/);
    expect((await as(ids.bia, "insert into public.campaign_members (campaign_id, user_id, role) values ($1, $2, 'mestre')", [camp, ids.dora])).error).toMatch(/permission denied/);
  });
  it("jogador não edita nem apaga a campanha", async () => {
    expect((await as(ids.bia, "update public.campaigns set name = 'X' where id = $1 returning id", [camp])).rows).toEqual([]);
    expect((await as(ids.bia, "delete from public.campaigns where id = $1 returning id", [camp])).rows).toEqual([]);
    expect((await as(ids.bia, "update public.campaigns set created_by = $1 where id = $2", [ids.bia, camp])).error).toMatch(/permission denied/);
  });
  it("jogador não remove outros participantes, mas pode sair", async () => {
    expect((await as(ids.bia, "delete from public.campaign_members where user_id = $1 returning user_id", [ids.caio])).rows).toEqual([]);
    expect((await as(ids.caio, "delete from public.campaign_members where user_id = $1 returning user_id", [ids.caio])).rows).toHaveLength(1);
  });
  it("mestre edita informações e a data de atualização muda", async () => {
    const r = await as(ids.ana, "update public.campaigns set name = 'Festival da Lua II', description = 'Nova' where id = $1 returning name", [camp]);
    expect(r.rows).toEqual([{ name: "Festival da Lua II" }]);
    expect((await db.query("select updated_at > created_at as ok from public.campaigns where id = $1", [camp])).rows).toEqual([{ ok: true }]);
  });
  it("ninguém é promovido: não existe função de papéis nem para o mestre", async () => {
    expect((await rpc(ids.ana, "set_member_role", camp, ids.bia, "mestre")).error).toMatch(/does not exist/);
    expect((await db.query("select count(*)::int as n from pg_proc where proname = 'set_member_role'")).rows).toEqual([{ n: 0 }]);
  });
  it("o banco rejeita um segundo mestre, mesmo com privilégio total (sem passar pela RLS)", async () => {
    await expect(db.query("update public.campaign_members set role = 'mestre' where campaign_id = $1 and user_id = $2", [camp, ids.bia])).rejects.toThrow(/mestre_unico|campaign_members_single_master/);
    await expect(db.query("insert into public.campaign_members (campaign_id, user_id, role) values ($1, $2, 'mestre')", [camp, ids.dora])).rejects.toThrow(/mestre_unico|campaign_members_single_master/);
    await expect(db.query("update public.campaign_members set role = 'jogador' where campaign_id = $1 and user_id = $2", [camp, ids.ana])).rejects.toThrow(/ultimo_mestre|mestre_unico/);
    expect((await db.query("select count(*)::int as n from public.campaign_members where campaign_id = $1 and role = 'mestre'", [camp])).rows).toEqual([{ n: 1 }]);
  });
  it("o índice único sozinho já impede dois mestres (defesa em profundidade)", async () => {
    await db.exec("alter table public.campaign_members disable trigger campaign_members_single_master");
    try { await expect(db.query("update public.campaign_members set role = 'mestre' where campaign_id = $1 and user_id = $2", [camp, ids.bia])).rejects.toThrow(/campaign_members_single_master|duplicate key/); }
    finally { await db.exec("alter table public.campaign_members enable trigger campaign_members_single_master"); }
  });
  it("o mestre (criador) não sai nem é removido; a campanha continua com ele", async () => {
    expect((await as(ids.ana, "delete from public.campaign_members where user_id = $1 and campaign_id = $2 returning user_id", [ids.ana, camp])).rows).toEqual([]);
    expect((await as(ids.ana, "select role from public.campaign_members where user_id = $1 and campaign_id = $2", [ids.ana, camp])).rows).toEqual([{ role: "mestre" }]);
  });
  it("mestre remove participante", async () => {
    expect((await as(ids.ana, "delete from public.campaign_members where user_id = $1 returning user_id", [ids.bia])).rows).toHaveLength(1);
    expect((await as(ids.bia, "select * from public.campaigns")).rows).toEqual([]);
  });
});

describe("várias campanhas por usuário", () => {
  it("o mesmo usuário é mestre em umas e jogador em outras, e o mestre é sempre o criador", async () => {
    const mine1 = (await rpc(ids.dora, "create_campaign", "Dora 1", "")).rows[0].r as string;
    const mine2 = (await rpc(ids.dora, "create_campaign", "Dora 2", "")).rows[0].r as string;
    const code2 = (await rpc(ids.dora, "create_invite", mine1, 5, 7)).rows[0].r as string;
    await rpc(ids.caio, "join_campaign", code2);
    const guest = (await rpc(ids.caio, "create_campaign", "Caio 1", "")).rows[0].r as string;
    const roles = (await as(ids.caio, "select c.name, m.role from public.campaign_members m join public.campaigns c on c.id = m.campaign_id where m.user_id = $1 order by c.name", [ids.caio])).rows;
    expect(roles).toEqual(expect.arrayContaining([{ name: "Dora 1", role: "jogador" }, { name: "Caio 1", role: "mestre" }]));
    for (const id of [mine1, mine2, guest]) {
      const r = (await db.query("select count(*)::int as n, bool_and(m.user_id = c.created_by) as creator from public.campaign_members m join public.campaigns c on c.id = m.campaign_id where m.campaign_id = $1 and m.role = 'mestre' group by m.campaign_id", [id])).rows[0];
      expect(r).toEqual({ n: 1, creator: true });
    }
    expect((await as(ids.caio, "delete from public.campaign_members where user_id = $1 and campaign_id = $2 returning user_id", [ids.caio, mine1])).rows).toHaveLength(1);   // jogador sai
    expect((await as(ids.dora, "delete from public.campaign_members where user_id = $1 and campaign_id = $2 returning user_id", [ids.dora, mine1])).rows).toEqual([]);          // mestre não sai
    expect((await as(ids.dora, "delete from public.campaigns where id = $1 returning id", [mine2])).rows).toHaveLength(1);                                                      // mas exclui
  });
});

describe("isolamento entre campanhas e exclusão", () => {
  it("mestre de uma campanha não administra outra", async () => {
    const other = (await rpc(ids.dora, "create_campaign", "Outra", "")).rows[0].r as string;
    expect((await rpc(ids.ana, "create_invite", other, 5, 7)).error).toMatch(/sem_permissao/);
    expect((await as(ids.ana, "insert into public.campaign_members (campaign_id, user_id, role) values ($1, $2, 'jogador')", [other, ids.ana])).error).toMatch(/permission denied/);
    expect((await as(ids.ana, "select * from public.campaigns where id = $1", [other])).rows).toEqual([]);
    expect((await as(ids.ana, "update public.campaigns set name='x' where id = $1 returning id", [other])).rows).toEqual([]);
  });
  it("mestre exclui a campanha (cascata) mesmo sendo o último mestre", async () => {
    expect((await as(ids.ana, "delete from public.campaigns where id = $1 returning id", [camp])).rows).toHaveLength(1);
    expect((await db.query("select count(*)::int as n from public.campaign_members where campaign_id = $1", [camp])).rows).toEqual([{ n: 0 }]);
    expect((await db.query("select count(*)::int as n from public.campaign_invites where campaign_id = $1", [camp])).rows).toEqual([{ n: 0 }]);
  });
  it("perfil: só o próprio nome é editável", async () => {
    expect((await as(ids.dora, "update public.profiles set display_name = 'Dora' where id = $1 returning id", [ids.dora])).rows).toHaveLength(1);
    expect((await as(ids.dora, "update public.profiles set display_name = 'x' where id = $1 returning id", [ids.ana])).rows).toEqual([]);
    expect((await as(ids.dora, "update public.profiles set id = $1 where id = $2", [ids.caio, ids.dora])).error).toMatch(/permission denied/);
  });
  it("limite de campanhas por usuário", async () => {
    for (let i = 0; i < 19; i++) await rpc(ids.bia, "create_campaign", `C${i}`, "");
    expect((await rpc(ids.bia, "create_campaign", "C19", "")).rows[0].r).toBeTruthy();
    expect((await rpc(ids.bia, "create_campaign", "C20", "")).error).toMatch(/limite_campanhas/);
  });
});

describe("migrações em banco que já tinha contas (backfill de perfis)", () => {
  it("cria perfil para contas anteriores e é idempotente", async () => {
    const old = new PGlite();
    await old.exec(stub);
    await old.query("insert into auth.users (id, email) values ($1, 'antiga@exemplo.com')", [ids.ana]);   // antes das migrações: sem gatilho, sem perfil
    const files = readdirSync(dir).filter(f => f.endsWith(".sql")).sort();
    for (const f of files) await old.exec(readFileSync(join(dir, f), "utf8"));
    expect((await old.query("select display_name from public.profiles where id = $1", [ids.ana])).rows).toEqual([{ display_name: "antiga" }]);
    await old.exec(readFileSync(join(dir, files.find(f => f.startsWith("0002"))!), "utf8"));                              // reaplicar não quebra
    expect((await old.query("select count(*)::int as n from public.profiles")).rows).toEqual([{ n: 1 }]);
  });
});

describe("auditoria estrutural", () => {
  it("toda função SECURITY DEFINER fixa search_path vazio", async () => {
    const r = await db.query<{ proname: string; proconfig: string[] | null }>("select proname, proconfig from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.prosecdef");
    expect(r.rows.length).toBeGreaterThan(0);
    for (const f of r.rows) expect(f.proconfig, f.proname).toContain("search_path=\"\"");
  });
  it("nenhuma função do schema public é executável por anon; só as de uso do app por authenticated", async () => {
    const r = await db.query<{ proname: string; anon: boolean; auth: boolean }>("select proname, has_function_privilege('anon', p.oid, 'execute') as anon, has_function_privilege('authenticated', p.oid, 'execute') as auth from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public'");
    expect(r.rows.filter(f => f.anon)).toEqual([]);
    expect(r.rows.filter(f => f.auth).map(f => f.proname).sort()).toEqual(["character_lifecycle", "character_offer_answer", "character_offers", "character_states", "codex_set_combat_sheet", "codex_npc_sheet_create", "codex_definitions_for", "codex_grant_item", "codex_identify_item", "codex_definition_remove", "codex_definition_save", "codex_preview", "codex_reveal", "codex_capabilities", "codex_link", "codex_links_for", "codex_node_visible", "codex_notification_feed", "codex_unlink", "alterar_vitais", "can_read_note", "can_share_note", "clear_combat_status", "codex_asset_access", "codex_holders", "codex_list", "codex_note_access", "codex_remove", "codex_save", "codex_visible", "create_campaign", "create_guided_character", "create_invite", "is_master", "is_member", "is_note_owner", "join_campaign", "note_readable", "save_guided_character", "save_note_content", "set_combat_status", "shares_campaign", "transferir_item", "usar_consumivel"].sort());
  });
  it("RLS está ativa em todas as tabelas do schema public", async () => {
    const r = await db.query<{ relname: string; relrowsecurity: boolean }>("select c.relname, c.relrowsecurity from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relkind = 'r'");
    expect(r.rows.length).toBe(15);   // + character_sheets (0007), campaign_combats (0009), campaign_encounters (0010), character_combat_status (0011), campaign_definitions (0018), character_notices (0021)
    expect(r.rows.filter(t => !t.relrowsecurity)).toEqual([]);
  });
});

describe("migração 0003 sobre dados antigos", () => {
  it("normaliza vários mestres e criador ausente, e depois aplica a regra", async () => {
    const old = new PGlite();
    await old.exec(stub);
    const files = readdirSync(dir).filter(f => f.endsWith(".sql")).sort();
    for (const f of files.filter(f => f < "0003")) await old.exec(readFileSync(join(dir, f), "utf8"));
    for (const [n, id] of Object.entries(ids)) await old.query("insert into auth.users (id, email) values ($1, $2) on conflict do nothing", [id, `${n}@exemplo.com`]);
    const cid = "00000000-0000-0000-0000-0000000000c1";
    await old.query("insert into public.campaigns (id, name, created_by) values ($1, 'Antiga', $2)", [cid, ids.ana]);
    await old.query("insert into public.campaign_members (campaign_id, user_id, role) values ($1, $2, 'mestre'), ($1, $3, 'mestre')", [cid, ids.bia, ids.caio]);   // criador fora, dois outros mestres
    await old.exec(readFileSync(join(dir, files.find(f => f.startsWith("0003"))!), "utf8"));
    expect((await old.query("select user_id, role from public.campaign_members where campaign_id = $1 order by role, user_id", [cid])).rows)
      .toEqual([{ user_id: ids.bia, role: "jogador" }, { user_id: ids.caio, role: "jogador" }, { user_id: ids.ana, role: "mestre" }]);
    await old.exec(readFileSync(join(dir, files.find(f => f.startsWith("0003"))!), "utf8"));   // idempotente
    await expect(old.query("update public.campaign_members set role = 'mestre' where user_id = $1", [ids.bia])).rejects.toThrow();
  });
});

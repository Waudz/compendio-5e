// Autorização de notas, testada no Postgres real em memória (PGlite) com várias contas e papéis.
// Não é o Supabase hospedado: ver cabeçalho de rls.test.ts.
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { beforeAll, describe, expect, it } from "vitest";

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
`;
const migrations = () => readdirSync(dir).filter(f => f.endsWith(".sql")).sort().map(f => readFileSync(join(dir, f), "utf8"));

let db: PGlite;
type R = { rows: Record<string, unknown>[]; error?: string };
async function as(uid: string | null, sql: string, params: unknown[] = []): Promise<R> {
  await db.exec(`set role ${uid ? "authenticated" : "anon"}; select set_config('request.jwt.claim.sub', '${uid ?? ""}', false);`);
  try { return { rows: (await db.query<Record<string, unknown>>(sql, params)).rows }; }
  catch (e) { return { rows: [], error: (e as Error).message }; }
  finally { await db.exec("reset role"); }
}
const rpc = (uid: string, fn: string, ...a: unknown[]) => as(uid, `select public.${fn}(${a.map((_, i) => `$${i + 1}`).join(",")}) as r`, a);
/** Cria nota como `uid`; devolve o id. */
async function mk(uid: string, title: string, visibility = "private", campaign: string | null = null, body = "") {
  const r = await as(uid, "insert into public.notes (campaign_id, title, body, visibility) values ($1, $2, $3, $4) returning id", [campaign, title, body, visibility]);
  if (r.error) throw new Error(r.error);
  return r.rows[0].id as string;
}
const titles = async (uid: string, extra = "") => (await as(uid, `select title from public.notes ${extra} order by title`)).rows.map(r => r.title);
const share = (uid: string, nid: string, to: string) => as(uid, "insert into public.note_shares (note_id, user_id) values ($1, $2) returning user_id", [nid, to]);

let C1: string, C2: string;
beforeAll(async () => {
  db = new PGlite();
  await db.exec(stub);
  for (const m of migrations()) await db.exec(m);
  for (const [n, id] of Object.entries(U)) await db.query("insert into auth.users (id, email) values ($1, $2)", [id, `${n}@exemplo.com`]);
  C1 = (await rpc(U.ana, "create_campaign", "Mesa 1", "")).rows[0].r as string;           // mestre: ana
  const code = (await rpc(U.ana, "create_invite", C1, 10, 7)).rows[0].r as string;
  await rpc(U.bia, "join_campaign", code); await rpc(U.caio, "join_campaign", code);       // jogadores: bia, caio
  C2 = (await rpc(U.dora, "create_campaign", "Mesa de fora", "")).rows[0].r as string;     // dora: só na outra campanha
});

describe("notas pessoais e isolamento entre contas", () => {
  it("visitante (anon) não acessa nada", async () => {
    for (const t of ["notes", "note_shares"]) expect((await as(null, `select * from public.${t}`)).error).toMatch(/permission denied/);
    expect((await as(null, "insert into public.notes (title) values ('x')")).error).toMatch(/permission denied/);
  });
  it("nota pessoal é só do autor: não aparece em listagem, busca, contagem nem por id", async () => {
    const id = await mk(U.bia, "Segredo pessoal da Bia", "private", null, "plano secreto");
    expect(await titles(U.bia)).toContain("Segredo pessoal da Bia");
    for (const who of [U.ana, U.caio, U.dora]) {
      expect(await titles(who)).not.toContain("Segredo pessoal da Bia");
      expect((await as(who, "select id from public.notes where id = $1", [id])).rows).toEqual([]);
      expect((await as(who, "select id from public.notes where body ilike '%secreto%' or title ilike '%segredo%'")).rows).toEqual([]);
      expect((await as(who, "select count(*)::int as n from public.notes where id = $1", [id])).rows).toEqual([{ n: 0 }]);
      expect((await as(who, "select * from public.notes n join public.note_shares s on s.note_id = n.id where n.id = $1", [id])).rows).toEqual([]);
    }
  });
  it("nota pessoal não pode ser compartilhada (constraint) nem vinculada a campanha alheia", async () => {
    expect((await as(U.bia, "insert into public.notes (title, visibility) values ('x', 'campaign')")).error).toMatch(/check constraint/);
    expect((await as(U.dora, "insert into public.notes (campaign_id, title) values ($1, 'x')", [C1])).error).toMatch(/row-level security/);     // dora não participa de C1
    expect((await as(U.bia, "insert into public.notes (campaign_id, title) values ($1, 'x')", [C2])).error).toMatch(/row-level security/);       // bia não participa de C2
  });
  it("ninguém cria nota em nome de outro nem escolhe owner_id/version", async () => {
    expect((await as(U.bia, "insert into public.notes (owner_id, title) values ($1, 'x')", [U.ana])).error).toMatch(/permission denied/);
    expect((await as(U.bia, "insert into public.notes (title, version) values ('x', 99)")).error).toMatch(/permission denied/);
  });
  it("validação: título e tamanho", async () => {
    expect((await as(U.bia, "insert into public.notes (title) values ('   ')")).error).toMatch(/check constraint/);
    expect((await as(U.bia, "insert into public.notes (title) values ($1)", ["x".repeat(121)])).error).toMatch(/check constraint/);
    expect((await as(U.bia, "insert into public.notes (title, body) values ('ok', $1)", ["x".repeat(50001)])).error).toMatch(/check constraint/);
  });
});

describe("visibilidade em campanha", () => {
  it("privada de jogador: o mestre NÃO vê (lista, busca, id, contagem), nem altera ou apaga", async () => {
    const id = await mk(U.bia, "Diário privado da Bia", "private", C1, "desconfio do mestre");
    expect(await titles(U.ana)).not.toContain("Diário privado da Bia");
    expect((await as(U.ana, "select id from public.notes where id = $1", [id])).rows).toEqual([]);
    expect((await as(U.ana, "select id from public.notes where body ilike '%mestre%'")).rows).toEqual([]);
    expect((await as(U.ana, "update public.notes set title = 'hack' where id = $1 returning id", [id])).rows).toEqual([]);
    expect((await as(U.ana, "delete from public.notes where id = $1 returning id", [id])).rows).toEqual([]);
    expect((await db.query("select title from public.notes where id = $1", [id])).rows).toEqual([{ title: "Diário privado da Bia" }]);
  });
  it("visível ao mestre: mestre e autor leem; outros jogadores e forasteiros não", async () => {
    await mk(U.bia, "Pergunta ao mestre", "master", C1);
    expect(await titles(U.ana)).toContain("Pergunta ao mestre");
    expect(await titles(U.bia)).toContain("Pergunta ao mestre");
    expect(await titles(U.caio)).not.toContain("Pergunta ao mestre");
    expect(await titles(U.dora)).not.toContain("Pergunta ao mestre");
  });
  it("da campanha: todos os participantes leem; quem não participa não", async () => {
    await mk(U.ana, "Resumo da sessão 1", "campaign", C1);
    for (const who of [U.ana, U.bia, U.caio]) expect(await titles(who)).toContain("Resumo da sessão 1");
    expect(await titles(U.dora)).not.toContain("Resumo da sessão 1");
  });
  it("mestre pode ter nota só sua dentro da campanha (privada) e notas para jogadores", async () => {
    await mk(U.ana, "Segredo do vilão", "private", C1, "o vilão é o taverneiro");
    expect(await titles(U.bia)).not.toContain("Segredo do vilão");
    expect(await titles(U.caio)).not.toContain("Segredo do vilão");
    expect((await as(U.bia, "select id from public.notes where body ilike '%taverneiro%'")).rows).toEqual([]);
  });
  it("selecionados: só autor e escolhidos leem; não-participante e auto-compartilhamento são recusados", async () => {
    const id = await mk(U.bia, "Plano com o Caio", "selected", C1, "só nós dois");
    expect(await titles(U.caio)).not.toContain("Plano com o Caio");                 // ainda sem seleção
    expect((await share(U.bia, id, U.caio)).error).toBeUndefined();
    expect(await titles(U.caio)).toContain("Plano com o Caio");
    expect(await titles(U.ana)).not.toContain("Plano com o Caio");                  // mestre também não, se não foi escolhido
    expect((await share(U.bia, id, U.dora)).error).toMatch(/row-level security/);   // destinatário fora da campanha
    expect((await share(U.bia, id, U.bia)).error).toMatch(/row-level security/);    // para si mesmo
    expect((await share(U.caio, id, U.ana)).error).toMatch(/row-level security/);   // selecionado não repassa
    expect((await share(U.ana, id, U.ana)).error).toMatch(/row-level security/);    // terceiro nem o mestre
  });
  it("lista de selecionados: autor vê tudo; selecionado só a própria linha; outros nada", async () => {
    const id = await mk(U.bia, "Lista", "selected", C1);
    await share(U.bia, id, U.caio); await share(U.bia, id, U.ana);
    expect((await as(U.bia, "select user_id from public.note_shares where note_id = $1", [id])).rows).toHaveLength(2);
    expect((await as(U.caio, "select user_id from public.note_shares where note_id = $1", [id])).rows).toEqual([{ user_id: U.caio }]);
    expect((await as(U.dora, "select * from public.note_shares where note_id = $1", [id])).rows).toEqual([]);
    expect((await as(U.caio, "delete from public.note_shares where note_id = $1 and user_id = $2 returning user_id", [id, U.ana])).rows).toEqual([]);   // não remove os outros
    expect((await as(U.bia, "delete from public.note_shares where note_id = $1 and user_id = $2 returning user_id", [id, U.ana])).rows).toHaveLength(1);
  });
  it("mudar a visibilidade apaga os selecionados; voltar a 'selected' não os ressuscita", async () => {
    const id = await mk(U.bia, "Muda", "selected", C1); await share(U.bia, id, U.caio);
    await as(U.bia, "update public.notes set visibility = 'master' where id = $1", [id]);
    expect((await db.query("select count(*)::int as n from public.note_shares where note_id = $1", [id])).rows).toEqual([{ n: 0 }]);
    await as(U.bia, "update public.notes set visibility = 'selected' where id = $1", [id]);
    expect(await titles(U.caio)).not.toContain("Muda");
  });
  it("compartilhar com campanha e depois tornar privada retira o acesso na hora", async () => {
    const id = await mk(U.bia, "Temporária", "campaign", C1);
    expect(await titles(U.caio)).toContain("Temporária");
    await as(U.bia, "update public.notes set visibility = 'private' where id = $1", [id]);
    expect(await titles(U.caio)).not.toContain("Temporária");
  });
});

describe("proteção de proprietário, campanha e versão", () => {
  it("owner_id, campaign_id e version não podem ser alterados por clientes", async () => {
    const id = await mk(U.bia, "Imutável", "campaign", C1);
    for (const col of ["owner_id = '" + U.caio + "'", "campaign_id = '" + C2 + "'", "campaign_id = null", "version = 50", "id = gen_random_uuid()", "created_at = now() - interval '9 years'"])
      expect((await as(U.bia, `update public.notes set ${col} where id = $1`, [id])).error, col).toMatch(/permission denied/);
  });
  it("mesmo com privilégio total, o banco rejeita troca de dono/campanha (gatilho)", async () => {
    const id = await mk(U.bia, "Imutável 2", "campaign", C1);
    await expect(db.query("update public.notes set owner_id = $1 where id = $2", [U.caio, id])).rejects.toThrow(/campo_imutavel/);
    await expect(db.query("update public.notes set campaign_id = $1 where id = $2", [C2, id])).rejects.toThrow(/campo_imutavel/);
  });
  it("só o autor edita e exclui; participante com acesso de leitura não escreve", async () => {
    const id = await mk(U.bia, "Só da Bia", "campaign", C1);
    for (const who of [U.ana, U.caio, U.dora]) {
      expect((await as(who, "update public.notes set title = 'x' where id = $1 returning id", [id])).rows, who).toEqual([]);
      expect((await as(who, "delete from public.notes where id = $1 returning id", [id])).rows, who).toEqual([]);
    }
    expect((await as(U.bia, "update public.notes set body = 'ok' where id = $1 returning id", [id])).rows).toHaveLength(1);
  });
  it("controle otimista: a versão sobe no servidor e uma edição baseada em versão antiga não grava", async () => {
    const id = await mk(U.bia, "Versão", "private", C1, "v1");
    expect((await as(U.bia, "select version from public.notes where id = $1", [id])).rows).toEqual([{ version: 1 }]);
    expect((await as(U.bia, "update public.notes set body = 'v2' where id = $1 and version = 1 returning version", [id])).rows).toEqual([{ version: 2 }]);
    expect((await as(U.bia, "update public.notes set body = 'dispositivo atrasado' where id = $1 and version = 1 returning version", [id])).rows).toEqual([]);   // conflito: 0 linhas
    expect((await as(U.bia, "select body from public.notes where id = $1", [id])).rows).toEqual([{ body: "v2" }]);
  });
  it("can_read_note não revela existência: nota inexistente e nota inacessível respondem igual", async () => {
    const id = await mk(U.bia, "Oculta", "private", C1);
    const ghost = "00000000-0000-0000-0000-0000000000ff";
    expect((await rpc(U.dora, "can_read_note", id)).rows).toEqual([{ r: false }]);
    expect((await rpc(U.dora, "can_read_note", ghost)).rows).toEqual([{ r: false }]);
    expect((await rpc(U.ana, "can_read_note", id)).rows).toEqual([{ r: false }]);
    expect((await rpc(U.bia, "can_read_note", id)).rows).toEqual([{ r: true }]);
    expect((await as(null, "select public.can_read_note($1)", [id])).error).toMatch(/permission denied/);
  });
});

describe("participação atual e saída da campanha", () => {
  it("removido da campanha perde o acesso imediatamente (leitor), sem mexer nas notas dos outros", async () => {
    const code = (await rpc(U.ana, "create_invite", C1, 10, 7)).rows[0].r as string;
    const eva = "00000000-0000-0000-0000-00000000000e";
    await db.query("insert into auth.users (id, email) values ($1, 'eva@exemplo.com')", [eva]);
    await rpc(eva, "join_campaign", code);
    await mk(U.ana, "Aviso geral", "campaign", C1);
    expect(await titles(eva)).toContain("Aviso geral");
    await as(U.ana, "delete from public.campaign_members where user_id = $1 and campaign_id = $2", [eva, C1]);
    expect(await titles(eva)).not.toContain("Aviso geral");
    expect((await as(eva, "insert into public.notes (campaign_id, title) values ($1, 'x')", [C1])).error).toMatch(/row-level security/);
  });
  it("autor que sai: nada é apagado; ele lê/exclui as suas, mas o compartilhamento fica inativo e a edição é bloqueada", async () => {
    const mine = await mk(U.caio, "Nota do Caio", "campaign", C1, "conteúdo");
    expect(await titles(U.ana)).toContain("Nota do Caio");
    await as(U.caio, "delete from public.campaign_members where user_id = $1 and campaign_id = $2", [U.caio, C1]);   // Caio sai
    expect(await titles(U.ana)).not.toContain("Nota do Caio");                                   // mestre deixa de ver
    expect(await titles(U.bia)).not.toContain("Nota do Caio");
    expect(await titles(U.caio)).toContain("Nota do Caio");                                      // autor mantém
    expect((await as(U.caio, "update public.notes set body = 'x' where id = $1 returning id", [mine])).error).toMatch(/row-level security/);   // sem edição fora da campanha
    expect((await db.query("select count(*)::int as n from public.notes where id = $1", [mine])).rows).toEqual([{ n: 1 }]);  // nada apagado
    expect((await as(U.caio, "select title from public.notes where campaign_id = $1 and visibility = 'campaign' and owner_id <> $2", [C1, U.caio])).rows).toEqual([]);   // e não lê as dos outros
    // volta por novo convite: o compartilhamento original volta a valer
    const code = (await rpc(U.ana, "create_invite", C1, 10, 7)).rows[0].r as string;
    await rpc(U.caio, "join_campaign", code);
    expect(await titles(U.ana)).toContain("Nota do Caio");
  });
  it("autor fora da campanha pode excluir a própria nota", async () => {
    const id = await mk(U.bia, "Para apagar", "campaign", C1);
    await as(U.bia, "delete from public.campaign_members where user_id = $1 and campaign_id = $2", [U.bia, C1]);
    expect((await as(U.bia, "delete from public.notes where id = $1 returning id", [id])).rows).toHaveLength(1);
  });
  it("excluir a campanha apaga suas notas e compartilhamentos (cascata); notas pessoais ficam", async () => {
    const camp = (await rpc(U.dora, "create_campaign", "Efêmera", "")).rows[0].r as string;
    const n = await mk(U.dora, "Da campanha efêmera", "campaign", camp);
    const personal = await mk(U.dora, "Pessoal da Dora");
    await as(U.dora, "delete from public.campaigns where id = $1", [camp]);
    expect((await db.query("select id from public.notes where id = any($1)", [[n, personal]])).rows).toEqual([{ id: personal }]);
  });
});

describe("migração reversível e auditoria", () => {
  it("o script de reversão remove tudo que a 0004 criou e a migração pode ser reaplicada", async () => {
    const t = new PGlite(); await t.exec(stub);
    const ms = migrations(); for (const m of ms) await t.exec(m);
    const down = readFileSync(join(__dirname, "rollback", "0004_notas_down.sql"), "utf8");
    await t.exec(down);
    expect((await t.query("select count(*)::int as n from pg_class c join pg_namespace s on s.oid = c.relnamespace where s.nspname = 'public' and c.relname in ('notes', 'note_shares')")).rows).toEqual([{ n: 0 }]);
    expect((await t.query("select count(*)::int as n from pg_proc p join pg_namespace s on s.oid = p.pronamespace where s.nspname = 'public' and p.proname in ('can_read_note', 'can_share_note', 'is_note_owner', 'notes_before_update', 'note_shares_limit')")).rows).toEqual([{ n: 0 }]);
    await t.exec(ms[ms.length - 1]);   // reaplica a última (0004)
    expect((await t.query("select count(*)::int as n from pg_class where relname = 'notes'")).rows).toEqual([{ n: 1 }]);
  });
  it("RLS ativa nas tabelas novas e funções novas sem acesso a anon", async () => {
    const r = await db.query<{ relname: string; relrowsecurity: boolean }>("select relname, relrowsecurity from pg_class where relname in ('notes', 'note_shares') and relkind = 'r'");
    expect(r.rows.map(x => x.relrowsecurity)).toEqual([true, true]);
    const f = await db.query<{ proname: string; anon: boolean }>("select proname, has_function_privilege('anon', p.oid, 'execute') as anon from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and proname in ('can_read_note','can_share_note','is_note_owner','notes_before_update','note_shares_limit')");
    expect(f.rows).toHaveLength(5); expect(f.rows.filter(x => x.anon)).toEqual([]);
  });
  it("limite de 50 compartilhamentos por nota", async () => {
    const id = await mk(U.ana, "Muitos", "selected", C1);
    const ins = (n: number) => db.query("insert into public.note_shares (note_id, user_id) select $1, u from (select gen_random_uuid() u from generate_series(1, $2)) x", [id, n]);
    await db.exec("alter table public.note_shares disable trigger user");   // cria 49 linhas fictícias sem FK de perfis
    await db.exec("alter table public.note_shares drop constraint note_shares_user_id_fkey");
    await ins(50); await db.exec("alter table public.note_shares enable trigger user");
    expect((await share(U.ana, id, U.bia)).error).toMatch(/limite_compartilhamentos/);
  });
});

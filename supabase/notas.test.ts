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
    await t.exec(readFileSync(join(__dirname, "rollback", "0005_notas_conteudo_down.sql"), "utf8"));   // a 0005 depende de notes: reverte-se primeiro
    await t.exec(down);
    expect((await t.query("select count(*)::int as n from pg_class c join pg_namespace s on s.oid = c.relnamespace where s.nspname = 'public' and c.relname in ('notes', 'note_shares')")).rows).toEqual([{ n: 0 }]);
    expect((await t.query("select count(*)::int as n from pg_proc p join pg_namespace s on s.oid = p.pronamespace where s.nspname = 'public' and p.proname in ('can_read_note', 'can_share_note', 'is_note_owner', 'notes_before_update', 'note_shares_limit')")).rows).toEqual([{ n: 0 }]);
    await t.exec(ms.find((_, i) => i === 3)!); await t.exec(ms[4]);   // reaplica 0004 e depois 0005
    expect((await t.query("select count(*)::int as n from pg_class where relname = 'notes'")).rows).toEqual([{ n: 1 }]);
  });
  it("RLS ativa nas tabelas novas e funções novas sem acesso a anon", async () => {
    const r = await db.query<{ relname: string; relrowsecurity: boolean }>("select relname, relrowsecurity from pg_class where relname in ('notes', 'note_shares') and relkind = 'r'");
    expect(r.rows.map(x => x.relrowsecurity)).toEqual([true, true]);
    const f = await db.query<{ proname: string; anon: boolean }>("select proname, has_function_privilege('anon', p.oid, 'execute') as anon from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and proname in ('can_read_note','can_share_note','is_note_owner','notes_before_update','note_shares_limit')");
    expect(f.rows).toHaveLength(5); expect(f.rows.filter(x => x.anon)).toEqual([]);
  });
});

describe("revisão de segurança: vazamentos entre usuários", () => {
  const rls = /row-level security/;
  /** Garante que o jogador participe de C1 (testes anteriores podem tê-lo removido). */
  const ensureMember = async (uid: string) => { const code = (await rpc(U.ana, "create_invite", C1, 10, 7)).rows[0].r as string; await rpc(uid, "join_campaign", code); };
  beforeAll(async () => { await ensureMember(U.bia); await ensureMember(U.caio); });

  it("inserir compartilhamento em nota alheia, inexistente ou com destinatário inexistente dá o MESMO erro (sem oráculo)", async () => {
    const foreign = await mk(U.ana, "Nota da Ana", "selected", C1);
    const ghost = "00000000-0000-0000-0000-0000000000aa";
    const errs = [
      (await share(U.bia, foreign, U.caio)).error,                                           // nota de outro autor
      (await share(U.bia, ghost, U.caio)).error,                                             // nota que não existe
      (await share(U.dora, foreign, U.dora)).error,                                          // forasteiro
      (await share(U.ana, foreign, "00000000-0000-0000-0000-0000000000bb")).error,           // destinatário que não existe
    ];
    for (const e of errs) expect(e).toMatch(rls);
    expect(new Set(errs).size).toBe(1);
  });

  it("criar nota em campanha inexistente ou alheia dá o mesmo erro", async () => {
    const e1 = (await as(U.bia, "insert into public.notes (campaign_id, title) values ($1, 'x')", [C2])).error;
    const e2 = (await as(U.bia, "insert into public.notes (campaign_id, title) values ('00000000-0000-0000-0000-0000000000cc', 'x')")).error;
    expect(e1).toMatch(rls); expect(e1).toBe(e2);
  });

  it("limites só aparecem depois da checagem de RLS: nota alheia com 50 compartilhamentos não denuncia nada", async () => {
    const id = await mk(U.ana, "Cheia", "selected", C1);
    await db.exec("alter table public.note_shares drop constraint note_shares_user_id_fkey");      // permite 50 destinatários fictícios (só neste teste)
    await db.query("insert into public.note_shares (note_id, user_id) select $1, gen_random_uuid() from generate_series(1, 50)", [id]);
    expect((await share(U.dora, id, U.dora)).error).toMatch(rls);                                  // forasteiro: erro genérico, não "limite"
    expect((await share(U.bia, id, U.caio)).error).toMatch(rls);                                   // jogador não-autor: idem
    await expect(db.query("insert into public.note_shares (note_id, user_id) values ($1, $2)", [id, U.bia])).rejects.toThrow(/limite_compartilhamentos/);   // o 51º é barrado (autor/servidor)
  });

  it("limite de notas por usuário (5000)", async () => {
    await expect(db.query("insert into public.notes (owner_id, title) select $1, 'n' || g from generate_series(1, 5001) g", [U.dora])).rejects.toThrow(/limite_notas/);
  });

  it("selecionado não enxerga a linha de compartilhamento quando a nota está suspensa (autor fora da campanha)", async () => {
    const id = await mk(U.bia, "Suspensa", "selected", C1); await share(U.bia, id, U.caio);
    expect((await as(U.caio, "select note_id from public.note_shares where note_id = $1", [id])).rows).toHaveLength(1);
    await as(U.bia, "delete from public.campaign_members where user_id = $1 and campaign_id = $2", [U.bia, C1]);   // autor sai
    expect(await titles(U.caio)).not.toContain("Suspensa");
    expect((await as(U.caio, "select note_id from public.note_shares where note_id = $1", [id])).rows).toEqual([]);   // nem o id aparece
    expect((await as(U.bia, "select title from public.notes where id = $1", [id])).rows).toEqual([{ title: "Suspensa" }]);   // autor mantém
  });

  it("funções expostas não são oráculos: argumentos forjados só revelam o que o chamador já pode saber", async () => {
    // note_readable com dados inventados: forasteiro nunca recebe true para campanha da qual não participa
    expect((await as(U.dora, "select public.note_readable(gen_random_uuid(), $1, $2, 'campaign') as r", [U.ana, C1])).rows).toEqual([{ r: false }]);
    expect((await as(U.dora, "select public.note_readable(gen_random_uuid(), $1, $2, 'master') as r", [U.ana, C1])).rows).toEqual([{ r: false }]);
    // jogador não vira mestre por argumento: 'master' continua false para ele
    expect((await as(U.bia, "select public.note_readable(gen_random_uuid(), $1, $2, 'master') as r", [U.caio, C2])).rows).toEqual([{ r: false }]);
    // can_share_note e is_note_owner só dizem "sim" ao dono
    const id = await mk(U.ana, "Dela", "selected", C1);
    expect((await as(U.dora, "select public.can_share_note($1, $2) as r", [id, U.bia])).rows).toEqual([{ r: false }]);
    expect((await as(U.bia, "select public.can_share_note($1, $2) as r", [id, U.caio])).rows).toEqual([{ r: false }]);
    expect((await as(U.bia, "select public.is_note_owner($1) as r", [id])).rows).toEqual([{ r: false }]);
    expect((await as(U.ana, "select public.is_note_owner($1) as r", [id])).rows).toEqual([{ r: true }]);
  });

  it("predicados do usuário não enxergam linhas barradas pela RLS (nem por erro, ordenação ou agregação)", async () => {
    await ensureMember(U.bia);
    await mk(U.bia, "Cofre", "private", C1, "senha=12345");
    expect((await as(U.ana, "select title from public.notes where 1 / (case when body like '%12345%' then 0 else 1 end) = 1")).error).toBeUndefined();   // nenhum erro de divisão: a linha nem é avaliada
    expect((await as(U.ana, "select count(*)::int as n, max(title) as t from public.notes where body like '%12345%'")).rows).toEqual([{ n: 0, t: null }]);
    expect((await as(U.ana, "select n.title from public.notes n where exists (select 1 from public.notes m where m.id = n.id and m.body like '%12345%')")).rows).toEqual([]);
    expect((await as(U.ana, "explain select * from public.notes where body like '%12345%'")).error).toBeUndefined();
  });

  it("gatilhos e funções internas não são executáveis por clientes; só 4 funções de nota são SECURITY DEFINER", async () => {
    const f = await db.query<{ proname: string; definer: boolean; anon: boolean; auth: boolean }>(`select proname, prosecdef as definer,
      has_function_privilege('anon', p.oid, 'execute') as anon, has_function_privilege('authenticated', p.oid, 'execute') as auth
      from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and proname in
      ('notes_before_update', 'note_shares_limit', 'notes_owner_limit', 'can_read_note', 'note_readable', 'can_share_note', 'is_note_owner')`);
    const by = Object.fromEntries(f.rows.map(r => [r.proname, r]));
    for (const t of ["notes_before_update", "note_shares_limit", "notes_owner_limit"]) expect(by[t], t).toMatchObject({ definer: false, anon: false, auth: false });
    for (const d of ["can_read_note", "note_readable", "can_share_note", "is_note_owner"]) expect(by[d], d).toMatchObject({ definer: true, anon: false, auth: true });
  });
});

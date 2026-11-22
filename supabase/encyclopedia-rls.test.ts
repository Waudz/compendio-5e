// Ensaio descartável dos rascunhos; nunca conecta ao Supabase hospedado.
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { beforeAll, afterAll, describe, expect, it } from "vitest";
import { storageStub } from "./stub-storage";

const master = "00000000-0000-0000-0000-000000000001";
const player = "00000000-0000-0000-0000-000000000002";
const stranger = "00000000-0000-0000-0000-000000000003";
let db: PGlite;
let campaign: string;
let entry: string;
async function as(uid: string | null, sql: string, params: unknown[] = []) {
  await db.exec("set role " + (uid ? "authenticated" : "anon"));
  try {
    await db.query("select set_config('request.jwt.claim.sub', $1, false)", [uid ?? ""]);
    return (await db.query<Record<string, unknown>>(sql, params)).rows;
  } finally { await db.exec("reset role"); }
}
const publications = (uid: string | null) => as(uid, "select * from public.encyclopedia_publications");
beforeAll(async () => {
  db = new PGlite();
  await db.exec(`
    create role anon nologin; create role authenticated nologin;
    create schema auth;
    create table auth.users (id uuid primary key default gen_random_uuid(), email text);
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    grant usage on schema auth, public to anon, authenticated;
    grant execute on function auth.uid() to anon, authenticated;
    alter default privileges in schema public grant all on tables to anon, authenticated;
    alter default privileges in schema public grant all on functions to anon, authenticated;
  ` + storageStub);
  const dir = join(__dirname, "migrations");
  for (const f of readdirSync(dir).filter(f=>f.endsWith(".sql")).sort()) await db.exec(readFileSync(join(dir,f),"utf8"));
  for (const uid of [master,player,stranger]) await db.query("insert into auth.users(id,email) values ($1,$2)",[uid,uid+"@example.test"]);
  for (const f of ["SQL","PROJECAO-PUBLICA","SINCRONIZACAO-PUBLICA","LIXEIRA-TRANSICOES"]) await db.exec(readFileSync(join(__dirname,"../docs/ENCICLOPEDIA-"+f+"-RASCUNHO.sql"),"utf8"));
  campaign = (await as(master,"select public.create_campaign('Ensaio','') as id"))[0].id as string;
  const code = (await as(master,"select public.create_invite($1,5,7) as code",[campaign]))[0].code;
  await as(player,"select public.join_campaign($1)",[code]);
  entry = (await as(master,"insert into public.encyclopedia_entries(campaign_id,kind,name,summary,public_description) values ($1,'character','Ferreiro','Artesão','Senha secreta') returning id",[campaign]))[0].id as string;
  await as(master,"insert into public.encyclopedia_master_details(entry_id,master_notes) values ($1,'Cultista')",[entry]);
});
afterAll(async()=>{if(db) await db.close();});
describe("Enciclopédia: projeção e RLS em Postgres descartável",()=>{
  it("nasce oculta; jogador não lê origem ou detalhes",async()=>{
    expect(await publications(player)).toEqual([]);
    expect(await as(player,"select * from public.encyclopedia_entries")).toEqual([]);
    expect(await as(player,"select * from public.encyclopedia_master_details")).toEqual([]);
    expect(await as(player,"select * from public.encyclopedia_history")).toEqual([]);
    await expect(publications(null)).rejects.toThrow(/permission denied/);
  });
  it("publica somente campos permitidos e revoga descrição ao reduzir visibilidade",async()=>{
    await as(master,"update public.encyclopedia_entries set visibility='summary' where id=$1",[entry]);
    expect(await publications(player)).toEqual([expect.objectContaining({name:"Ferreiro",public_description:"",visibility:"summary"})]);
    expect(await publications(stranger)).toEqual([]);
    expect(JSON.stringify(await publications(player))).not.toMatch(/Cultista|Senha secreta|mechanics/);
    await as(master,"update public.encyclopedia_entries set visibility='full' where id=$1",[entry]);
    expect(await publications(player)).toEqual([expect.objectContaining({public_description:"Senha secreta"})]);
    await as(master,"update public.encyclopedia_entries set visibility='summary' where id=$1",[entry]);
    expect(await publications(player)).toEqual([expect.objectContaining({public_description:""})]);
  });
  it("nega adulteração direta da projeção e mudança da campanha",async()=>{
    await expect(as(player,"update public.encyclopedia_publications set name='Hack'")).rejects.toThrow(/permission denied/);
    await expect(as(master,"update public.encyclopedia_entries set campaign_id=$1 where id=$2",[campaign,entry])).rejects.toThrow(/permission denied/);
    expect(await as(player,"update public.encyclopedia_entries set name='Hack' where id=$1 returning id",[entry])).toEqual([]);
  });
  it("lixeira remove publicação e deriva autor no servidor; restauração republica",async()=>{
    const rows=await as(master,"update public.encyclopedia_entries set deleted_at='2000-01-01',deleted_by=$2 where id=$1 returning deleted_by,deleted_at > '2020-01-01' as valid",[entry,stranger]);
    expect(rows).toEqual([{deleted_by:master,valid:true}]);
    expect(await publications(player)).toEqual([]);
    await as(master,"update public.encyclopedia_entries set deleted_at=null,deleted_by=null where id=$1",[entry]);
    expect(await publications(player)).toHaveLength(1);
  });
  it("ocultar e remover membro revoga novas consultas",async()=>{
    await as(master,"update public.encyclopedia_entries set visibility='hidden' where id=$1",[entry]);
    expect(await publications(player)).toEqual([]);
    await as(master,"update public.encyclopedia_entries set visibility='full' where id=$1",[entry]);
    expect(await publications(player)).toHaveLength(1);
    await as(player,"delete from public.campaign_members where campaign_id=$1 and user_id=$2",[campaign,player]);
    expect(await publications(player)).toEqual([]);
  });
});

// Banco local descartável; a 0023 (proposta) não é aplicada remotamente.
import {readFileSync,readdirSync} from 'node:fs';
import {join} from 'node:path';
import {PGlite} from '@electric-sql/pglite';
import {beforeAll,afterAll,it,expect} from 'vitest';
import {storageStub} from './stub-storage';
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


let db:PGlite,cid:string,other:string,a:string,b:string,link:string;
const master='00000000-0000-4000-8000-000000000001', player='00000000-0000-4000-8000-000000000002';
async function rpc(who:string|null,fn:string,...args:unknown[]){
 await db.exec(`set role ${who?'authenticated':'anon'}`);
 await db.query("select set_config('request.jwt.claim.sub',$1,false)",[who??'']);
 try{return (await db.query<{r:unknown}>(`select public.${fn}(${args.map((_,i)=>'$'+(i+1)).join(',')}) as r`,args)).rows[0].r;}
 finally{await db.exec('reset role');}
}
const data=(title:string)=>({category:'npc',systemId:'dnd5e-2014',title,description:[],fields:{},sheet:[],secret:'SEGREDO'});
const version=async()=>Number((await db.query<{version:number}>('select version from public.campaign_codex where id=$1',[a])).rows[0].version);
const edit=(who:string|null,changes:unknown,v?:number)=>Promise.resolve(v??version()).then(n=>rpc(who,'codex_save_edit',cid,a,n,JSON.stringify(data('Atualizado')),JSON.stringify(changes)));
beforeAll(async()=>{
 db=new PGlite();await db.exec(stub);
 for(const f of readdirSync(join(__dirname,'migrations')).filter(x=>x.endsWith('.sql')).sort())await db.exec(readFileSync(join(__dirname,'migrations',f),'utf8'));

 await db.query('insert into auth.users(id,email) values($1,$2),($3,$4)',[master,'m@example.invalid',player,'p@example.invalid']);
 cid=await rpc(master,'create_campaign','Teste','') as string;
 const token=await rpc(master,'create_invite',cid,10,7);await rpc(player,'join_campaign',token);
 other=await rpc(player,'create_campaign','Outra','') as string;
 a=await rpc(master,'codex_save',cid,null,0,JSON.stringify(data('Original'))) as string;
 b=await rpc(master,'codex_save',cid,null,0,JSON.stringify(data('Destino'))) as string;
 link=await rpc(master,'codex_link',cid,a,b,'related','Relacionado','Relacionado',false) as string;
});
afterAll(async()=>{await db?.close();});
it('jogador, visitante e anônimo não editam; nenhum conteúdo muda',async()=>{
 const v=await version();
 await expect(edit(player,{remover:[],adicionar:[]})).rejects.toThrow(/sem_permissao/);
 await expect(edit(null,{remover:[],adicionar:[]})).rejects.toThrow(/permission denied/);
 await expect(rpc(master,'codex_save_edit',other,a,v,JSON.stringify(data('X')),JSON.stringify({remover:[],adicionar:[]}))).rejects.toThrow(/sem_permissao/);
 expect(await version()).toBe(v);
});
it('qualquer vínculo inválido reverte também conteúdo e remoções anteriores',async()=>{
 const v=await version();
 await expect(edit(master,{remover:[link],adicionar:[{source:b,target:b,relation:{kind:'related',label:'Relacionado',inverse:'Relacionado'}}]})).rejects.toThrow(/vinculo_invalido/);
 expect(await version()).toBe(v);
 expect((await db.query<{title:string}>('select title from public.notes where id=$1',[a])).rows[0].title).toBe('Original');
 expect((await db.query('select id from public.codex_links where id=$1',[link])).rows).toHaveLength(1);
});
it('valida estrutura JSON e concorrência, sem gravação parcial',async()=>{
 const v=await version();
 for(const x of [null,[],{remover:[],adicionar:[],extra:true},{remover:[],adicionar:[{source:null,target:b,relation:{kind:'related',label:'x',inverse:'y',revealed:'true'}}]}])await expect(edit(master,x)).rejects.toThrow();
 await expect(edit(master,{remover:[],adicionar:[]},v+10)).rejects.toThrow(/conflito_de_versao/);
 expect(await version()).toBe(v);
});
it('estado vital acompanha a transação e conflito não muda conteúdo',async()=>{
 await edit(master,{remover:[],adicionar:[],estado:{anterior:'vivo',valor:'morto'}});
 const life=()=>db.query<{estado:string}>('select estado from public.character_life where note_id=$1',[a]);
 expect((await life()).rows[0].estado).toBe('morto');
 const v=await version();
 await expect(edit(master,{remover:[],adicionar:[],estado:{anterior:'vivo',valor:'desconhecido'}})).rejects.toThrow(/conflito_de_versao/);
 expect(await version()).toBe(v);expect((await life()).rows[0].estado).toBe('morto');
 await edit(master,{remover:[],adicionar:[],estado:{anterior:'morto',valor:'vivo'}});
});
it('referência de catálogo nasce secreta com vínculo; falha reverte sua criação',async()=>{
 const token='catalog:test-item',reference={token,data:{category:'item',systemId:'dnd5e-2014',definitionId:'test-item',title:'Item de teste',description:[],fields:{},sheet:[],registered:false}};
 const op={source:null,target:token,relation:{kind:'owner',label:'Proprietário de',inverse:'Propriedade de'}};
 const antes=Number((await db.query<{n:number}>('select count(*)::int n from public.campaign_codex')).rows[0].n);
 await expect(edit(master,{remover:[],adicionar:[op,{source:b,target:b,relation:op.relation}],referencias:[reference]})).rejects.toThrow();
 expect(Number((await db.query<{n:number}>('select count(*)::int n from public.campaign_codex')).rows[0].n)).toBe(antes);
 await edit(master,{remover:[],adicionar:[op],referencias:[reference]});
 const refs=await db.query<{id:string;visible:boolean;registered:boolean}>("select id,visible,registered from public.campaign_codex where definition_id='test-item'");
 expect(refs.rows).toHaveLength(1);expect(refs.rows[0]).toMatchObject({visible:false,registered:false});
 const related=await rpc(master,'codex_links_for',cid,a) as {id:string;targetId:string}[];
 const l=related.find(x=>x.targetId===refs.rows[0].id)!;expect(l).toBeTruthy();await rpc(master,'codex_unlink',cid,l.id);
});
it('conteúdo e relação inversa são gravados numa transação; rollback de infraestrutura preserva dados',async()=>{
 await edit(master,{remover:[link],adicionar:[{source:null,target:b,relation:{kind:'resident',label:'Habita',inverse:'Habitante'}}]});
 const ida=await rpc(master,'codex_links_for',cid,a) as {relation:string}[];
 const volta=await rpc(master,'codex_links_for',cid,b) as {relation:string}[];
 expect(ida.map(l=>l.relation)).toEqual(['Habita']);expect(volta.map(l=>l.relation)).toEqual(['Habitante']);
 await db.exec(readFileSync(join(__dirname,'rollback','0023_edicao_codex_atomica_down.sql'),'utf8'));
 expect((await db.query('select id from public.codex_links where campaign_id=$1',[cid])).rows).toHaveLength(1);
 expect((await db.query<{title:string}>('select title from public.notes where id=$1',[a])).rows[0].title).toBe('Atualizado');
});

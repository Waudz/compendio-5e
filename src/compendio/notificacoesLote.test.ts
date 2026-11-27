import {describe,it,expect} from "vitest";
import {createClient} from "@supabase/supabase-js";
import {marcarLote} from "./notificacoesLote";
function fixture(count=2){
 const rows=Array.from({length:count},(_,i)=>({id:i+1,entry_id:"a",read_at:null as string|null}));
 rows.push({id:count+20,entry_id:"outra-campanha",read_at:null});
 let fail=false,arrive=false;const calls:URL[]=[];
 const client=createClient("http://localhost:1","public-test-key",{auth:{persistSession:false,autoRefreshToken:false},global:{fetch:async(input,init)=>{
  const u=new URL(String(input));calls.push(u);
  if(u.pathname.endsWith("/rpc/codex_list"))return Response.json([{id:"a"}]);
  if(init?.method==="PATCH"){
   if(fail)return Response.json({message:"offline"},{status:503});
   if(arrive)rows.push({id:count+1,entry_id:"a",read_at:null});
   const ids=u.searchParams.get("id")!.slice(4,-1).split(",").map(Number);
   rows.forEach(r=>{if(ids.includes(r.id)&&!r.read_at)r.read_at=JSON.parse(init.body as string).read_at;});
   return new Response(null,{status:204});
  }
  const max=Number(u.searchParams.get("id")!.slice(3));
  return Response.json(rows.filter(r=>r.entry_id==="a"&&r.id<max&&!r.read_at).sort((a,b)=>b.id-a.id).slice(0,500));
 }}});
 return {client,rows,calls,fail:()=>{fail=true;},arrive:()=>{arrive=true;}};
}
describe("leitura em lote: contrato HTTP sem rede",()=>{
 it("inclui mais que os 50 do feed, pagina, preserva outra campanha e chegada nova",async()=>{
  const f=fixture(1001);f.arrive();await marcarLote(f.client,"ca",1001,new AbortController().signal);
  expect(f.rows.filter(r=>r.id<=1001&&r.read_at)).toHaveLength(1001);
  expect(f.rows.filter(r=>r.id>1001).every(r=>r.read_at===null)).toBe(true);
  expect(f.calls.filter(u=>u.searchParams.has("entry_id")).length).toBe(3);
 });
 it("não sobrescreve uma leitura existente",async()=>{
  const f=fixture();f.rows[0].read_at="2026-01-01";await marcarLote(f.client,"ca",2,new AbortController().signal);
  expect(f.rows[0].read_at).toBe("2026-01-01");expect(f.rows[1].read_at).not.toBeNull();
 });
 it("propaga falha e preserva os pendentes",async()=>{
  const f=fixture();f.fail();await expect(marcarLote(f.client,"ca",2,new AbortController().signal)).rejects.toThrow();expect(f.rows.every(r=>r.read_at===null)).toBe(true);
 });
 it("aborta ao sair do escopo antes de qualquer chamada",async()=>{
  const f=fixture(),c=new AbortController();c.abort();await expect(marcarLote(f.client,"ca",2,c.signal)).rejects.toThrow();expect(f.calls).toHaveLength(0);
 });
});

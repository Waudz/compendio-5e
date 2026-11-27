import type {SupabaseClient} from "@supabase/supabase-js";

/** Snapshot explícito: RLS autoriza cada SELECT/UPDATE; a lista projetada limita a campanha.
 * O teto vem do feed aberto. IDs posteriores nunca entram, mesmo entre páginas/lotes.
 * Uma falha pode deixar lotes anteriores lidos: o chamador sempre recarrega o feed real.
 */
export async function marcarLote(client:SupabaseClient,campaign:string,through:number,signal:AbortSignal):Promise<void>{
  signal.throwIfAborted();
  if(!Number.isSafeInteger(through)||through<1)throw Error("Notificação inválida.");
  const projected=await client.rpc("codex_list",{p_campaign:campaign}).abortSignal(signal);
  if(projected.error)throw Error("Não foi possível verificar as notificações.");
  const entries=(projected.data as {id:string}[]).map(x=>x.id),snapshot:number[]=[];
  for(let i=0;i<entries.length;i+=100){
    let cursor=through+1;
    for(;;){
      signal.throwIfAborted();
      const r=await client.from("codex_notifications").select("id").in("entry_id",entries.slice(i,i+100)).is("read_at",null).lt("id",cursor).order("id",{ascending:false}).limit(500).abortSignal(signal);
      if(r.error)throw Error("Não foi possível carregar todas as notificações.");
      const ids=(r.data as {id:number}[]).map(x=>x.id);
      snapshot.push(...ids);
      if(ids.length<500)break;
      cursor=ids[ids.length-1];
    }
  }
  const now=new Date().toISOString();
  for(let i=0;i<snapshot.length;i+=100){
    signal.throwIfAborted();
    const r=await client.from("codex_notifications").update({read_at:now}).in("id",snapshot.slice(i,i+100)).is("read_at",null).abortSignal(signal);
    if(r.error)throw Error("Não foi possível marcar todas como lidas. Confira sua conexão e tente novamente.");
  }
}

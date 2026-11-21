/** Narrow transport boundary for master-only narrative trash RPCs.
 * Authentication/authorization are enforced by Supabase functions, not this client.
 * Never use a service-role key in browser code.
 */
export type NarrativeTrashOperation='trash'|'restore';
const trashOperations:Readonly<Record<NarrativeTrashOperation,NarrativeTrashRpcName>>={
 trash:'encyclopedia_trash_entry',restore:'encyclopedia_restore_entry'
};
export type NarrativeTrashRpcName='encyclopedia_trash_entry'|'encyclopedia_restore_entry';
export type NarrativeTrashRpcClient={
 rpc(name:NarrativeTrashRpcName,args:{p_entry_id:string}):PromiseLike<{
  data:boolean|null;
  error:{message:string}|null;
 }>;
};
export type NarrativeTrashOutcome=
 |{status:'changed'}
 |{status:'not-changed'}
 |{status:'error';message:string};

export async function updateNarrativeTrash(
 client:NarrativeTrashRpcClient,
 operation:NarrativeTrashOperation,
 entryId:string
):Promise<NarrativeTrashOutcome>{
 if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(entryId))
  return {status:'error',message:'invalid_entry_id'};
 if(!Object.prototype.hasOwnProperty.call(trashOperations,operation))
  return {status:'error',message:'invalid_operation'};
 const rpcName=trashOperations[operation];
 try{
  const result=await client.rpc(rpcName,{p_entry_id:entryId});
  if(result.error)return {status:'error',message:'request_failed'};
  return result.data===true?{status:'changed'}:{status:'not-changed'};
 }catch{
  return {status:'error',message:'request_failed'};
 }
}

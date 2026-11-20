import {describe,expect,it,vi} from 'vitest';
import {updateNarrativeTrash,type NarrativeTrashRpcClient} from './encyclopedia-trash-gateway';
const id='123e4567-e89b-42d3-a456-426614174000';
describe('encyclopedia trash RPC gateway',()=>{
 it('calls trash with only the entry id, never client-supplied role or actor',async()=>{
  const rpc=vi.fn().mockResolvedValue({data:true,error:null});
  const result=await updateNarrativeTrash({rpc},'trash',id);
  expect(result).toEqual({status:'changed'});
  expect(rpc).toHaveBeenCalledExactlyOnceWith('encyclopedia_trash_entry',{p_entry_id:id});
 });
 it('calls restore and treats denied/no-op uniformly',async()=>{
  const rpc=vi.fn().mockResolvedValue({data:false,error:null});
  expect(await updateNarrativeTrash({rpc},'restore',id)).toEqual({status:'not-changed'});
  expect(rpc).toHaveBeenCalledExactlyOnceWith('encyclopedia_restore_entry',{p_entry_id:id});
 });
 it('rejects invalid identifiers without contacting server',async()=>{
  const rpc=vi.fn();
  expect(await updateNarrativeTrash({rpc},'trash','not-a-uuid')).toEqual({status:'error',message:'invalid_entry_id'});
  expect(rpc).not.toHaveBeenCalled();
 });
 it('does not expose backend error details',async()=>{
  const rpc=vi.fn().mockResolvedValue({data:null,error:{message:'private database detail'}});
  expect(await updateNarrativeTrash({rpc},'trash',id)).toEqual({status:'error',message:'request_failed'});
 });
 it('handles network failures and missing results safely',async()=>{
  const rpc=vi.fn().mockRejectedValue(new Error('private token'));
  expect(await updateNarrativeTrash({rpc},'trash',id)).toEqual({status:'error',message:'request_failed'});
  const client:NarrativeTrashRpcClient={rpc:async()=>({data:null,error:null})};
  expect(await updateNarrativeTrash(client,'restore',id)).toEqual({status:'not-changed'});
 });
});

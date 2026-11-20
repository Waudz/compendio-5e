/** Stage API responses for human review, without silently publishing their rules.
 * The API's descriptions and mechanics differ by resource; keep the raw payload.
 */
import {srd2014ResourcePath,type ReviewedSrdRecord,type Srd2014Collection} from './srd-2014-import';
export type SrdStagingRecord=ReviewedSrdRecord&{
 provenance:{url:string;fetchedAt:string;provider:'dnd5eapi-2014'};
 issues:string[];
};
export function stageSrd2014Record(
 collection:Srd2014Collection,index:string,payload:unknown,fetchedAt:string
):SrdStagingRecord{
 const url=srd2014ResourcePath(collection,index);
 if(!Number.isFinite(Date.parse(fetchedAt))) throw new Error('Invalid fetch timestamp');
 if(!payload||typeof payload!=='object'||Array.isArray(payload))
  throw new Error('Invalid API payload');
 const value=payload as Record<string,unknown>;
 if(value.index!==index||typeof value.name!=='string'||!value.name.trim())
  throw new Error('API resource identity mismatch');
 const issues:string[]=[];
 if(typeof value.url==='string' && !value.url.includes('/api/2014/'+collection+'/'+index))
  issues.push('API resource URL differs from requested 2014 resource');
 const descriptions=Array.isArray(value.desc)?
  value.desc.filter((x):x is string=>typeof x==='string').join('\n'):
  typeof value.desc==='string'?value.desc:'';
 if(!descriptions.trim()) issues.push('Description requires editorial review');
 if(collection==='classes'&&(!Number.isInteger(value.hit_die)||Number(value.hit_die)<1))
  issues.push('Class hit die missing or invalid');
 if(collection==='spells'&&(!Number.isInteger(value.level)||Number(value.level)<0||Number(value.level)>9))
  issues.push('Spell level missing or invalid');
 return {collection,index,name:value.name,description:descriptions.trim()||'Pendente de revisão',
  data:structuredClone(value),reviewed:false,provenance:{url,fetchedAt,provider:'dnd5eapi-2014'},issues};
}
export function stageSrd2014Batch(
 collection:Srd2014Collection,payloads:unknown[],fetchedAt:string
):SrdStagingRecord[]{
 const seen=new Set<string>();
 return payloads.map(payload=>{
  const id=payload&&typeof payload==='object'&&!Array.isArray(payload)?
   (payload as Record<string,unknown>).index:undefined;
  if(typeof id!=='string') throw new Error('API record missing index');
  const staged=stageSrd2014Record(collection,id,payload,fetchedAt);
  if(seen.has(staged.index)) throw new Error('Duplicate staged API record: '+staged.index);
  seen.add(staged.index);
  return staged;
 });
}

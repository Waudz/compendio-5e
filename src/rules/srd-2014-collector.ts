/** Controlled, injectable API collector. No fetch occurs when this module is imported.
 * Use in an explicit maintenance action, never during character rendering.
 */
import {SRD_2014_API_BASE,srd2014ResourcePath,type Srd2014Collection} from './srd-2014-import';
import {stageSrd2014Batch,type SrdStagingRecord} from './srd-2014-staging';
export type SrdFetch=(url:string)=>Promise<{ok:boolean;status:number;json():Promise<unknown>}>;
export type SrdCollectionResult={collection:Srd2014Collection;records:SrdStagingRecord[];expectedCount:number};
const identifier=/^[a-z0-9]+(?:[.-][a-z0-9]+)*$/;
export async function collectSrd2014Collection(
 collection:Srd2014Collection,fetcher:SrdFetch,fetchedAt:string
):Promise<SrdCollectionResult>{
 // Validate the collection before any network request.
 srd2014ResourcePath(collection,'validation');
 const listing=await fetcher(SRD_2014_API_BASE+'/'+collection);
 if(!listing.ok) throw new Error('SRD index request failed: '+listing.status);
 const index=await listing.json();
 if(!index||typeof index!=='object'||Array.isArray(index))
  throw new Error('Invalid SRD collection index');
 const result=(index as Record<string,unknown>).results;
 const count=(index as Record<string,unknown>).count;
 if(!Array.isArray(result)||!Number.isSafeInteger(count)||Number(count)<0||result.length!==count)
  throw new Error('Incomplete SRD collection index');
 const ids:string[]=[];
 for(const item of result){
  if(!item||typeof item!=='object'||Array.isArray(item))throw new Error('Invalid SRD index entry');
  const id=(item as Record<string,unknown>).index;
  if(typeof id!=='string'||!identifier.test(id))throw new Error('Invalid SRD index identifier');
  if(ids.includes(id))throw new Error('Duplicate SRD index identifier: '+id);
  ids.push(id);
 }
 // Sequential by design: avoids uncontrolled parallel API requests.
 const payloads:unknown[]=[];
 for(const id of ids){
  const response=await fetcher(srd2014ResourcePath(collection,id));
  if(!response.ok)throw new Error('SRD detail request failed for '+id+': '+response.status);
  payloads.push(await response.json());
 }
 const records=stageSrd2014Batch(collection,payloads,fetchedAt);
 if(records.length!==count)throw new Error('Incomplete SRD collection');
 return {collection,records,expectedCount:Number(count)};
}

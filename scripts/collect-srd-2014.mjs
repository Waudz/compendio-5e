#!/usr/bin/env node
/** Manual SRD 2014 staging collector. No automatic publication or repository writes.
 * Usage: node scripts/collect-srd-2014.mjs classes [output-directory]
 */
import {mkdir,writeFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {createHash} from 'node:crypto';
const collections=new Set(['races','subraces','classes','subclasses','spells','equipment','features','traits']);
const [collection,outArg='.srd-2014-staging']=process.argv.slice(2);
if(!collections.has(collection)){
 console.error('Usage: node scripts/collect-srd-2014.mjs <races|subraces|classes|subclasses|spells|equipment|features|traits> [output-directory]');
 process.exitCode=1;
}else{
 const base='https://www.dnd5eapi.co/api/2014';
 const identifier=/^[a-z0-9]+(?:[.-][a-z0-9]+)*$/;
 const fetchedAt=new Date().toISOString();
 async function get(path){
  const url=new URL(path,base+'/');
  if(url.origin!=='https://www.dnd5eapi.co'||!url.pathname.startsWith('/api/2014/'))
   throw new Error('Untrusted API URL');
  const controller=new AbortController();
  const timeout=setTimeout(()=>controller.abort(),12000);
  try{
   const response=await fetch(url,{signal:controller.signal,headers:{accept:'application/json'}});
   if(!response.ok)throw new Error('API returned '+response.status+' for '+url.pathname);
   const text=await response.text();
   if(text.length>2_000_000)throw new Error('API response exceeds size limit');
   return JSON.parse(text);
  }finally{clearTimeout(timeout)}
 }
 try{
  const listing=await get('/api/2014/'+collection);
  if(!listing||!Array.isArray(listing.results)||!Number.isSafeInteger(listing.count)||
   listing.count<0||listing.count>1500||listing.results.length!==listing.count)
   throw new Error('Incomplete or excessive collection index');
  const ids=listing.results.map(row=>row?.index);
  if(ids.some(id=>typeof id!=='string'||!identifier.test(id))||new Set(ids).size!==ids.length)
   throw new Error('Invalid or duplicate collection identifiers');
  const records=[];
  for(const id of ids){
   const url=base+'/'+collection+'/'+id;
   const data=await get('/api/2014/'+collection+'/'+id);
   if(!data||data.index!==id||typeof data.name!=='string'||!data.name.trim())
    throw new Error('API identity mismatch for '+id);
   const desc=Array.isArray(data.desc)?data.desc.filter(x=>typeof x==='string').join('\n'):
    typeof data.desc==='string'?data.desc:'';
   const issues=[];
   if(!desc.trim())issues.push('Description requires editorial review');
   if(collection==='classes'&&(!Number.isInteger(data.hit_die)||data.hit_die<1))
    issues.push('Class hit die missing or invalid');
   if(collection==='spells'&&(!Number.isInteger(data.level)||data.level<0||data.level>9))
    issues.push('Spell level missing or invalid');
   records.push({collection,index:id,name:data.name,description:desc.trim()||'Pendente de revisão',
    data,reviewed:false,provenance:{url,fetchedAt,provider:'dnd5eapi-2014'},issues});
  }
  const output={schemaVersion:1,collection,fetchedAt,expectedCount:listing.count,records};
  const bytes=JSON.stringify(output,null,2)+'\n';
  const hash=createHash('sha256').update(bytes).digest('hex');
  const directory=resolve(outArg);
  await mkdir(directory,{recursive:true});
  const filename=collection+'-'+fetchedAt.replace(/[:.]/g,'-')+'.json';
  await writeFile(join(directory,filename),bytes,{flag:'wx'});
  console.log(JSON.stringify({file:join(directory,filename),sha256:hash,
   count:records.length,unreviewed:records.filter(x=>!x.reviewed).length,
   withIssues:records.filter(x=>x.issues.length>0).length},null,2));
 }catch(error){console.error('Collection failed without publishing:',error);process.exitCode=1}
}

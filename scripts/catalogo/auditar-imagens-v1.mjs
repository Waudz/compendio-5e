// Auditoria somente leitura. --http verifica URLs públicas; não usa conta, RPC privada ou Storage write.
import {readFileSync} from 'node:fs';
const read=p=>JSON.parse(readFileSync(new URL(p,import.meta.url),'utf8'));
const map=read('../../src/catalogue/data/imagens-v1.json');
const items=new Set(read('../../src/catalogue/data/srd-2014-items.json').items.map(x=>x.id));
const monsters=new Set(read('../../src/catalogue/sistemas/dnd5e-2014/data/monstros.json').itens.map(x=>x.id));
const rows=Object.entries(map.itens).map(([id,v])=>({id,type:'item',...v,known:items.has(id)})).concat(Object.entries(map.monstros).map(([id,v])=>({id,type:'monster',...v,known:monsters.has(id)})));
const report={itens:Object.keys(map.itens).length,monstros:Object.keys(map.monstros).length,semDefinicao:rows.filter(x=>!x.known).map(x=>x.id),urlsInvalidas:[],http:[],locaisDoNavegador:'Exigem exportação do aparelho; não são arquivos do repositório.'};
for(const row of rows){
 const url=row.url??map.base+row.caminho;
 if(!/^https:\/\/(pdjzahpxjrlbqqtzkfdr\.supabase\.co\/storage\/v1\/object\/public\/catalogos\/|waudz\.github\.io\/rastreador-dnd\/fotos\/)/.test(url))report.urlsInvalidas.push(row.id);
}
if(process.argv.includes('--http')){
 let index=0;
 await Promise.all(Array.from({length:6},async()=>{while(index<rows.length){const row=rows[index++];if(report.urlsInvalidas.includes(row.id))continue;
  try{const r=await fetch(row.url??map.base+row.caminho,{method:'HEAD',redirect:'error',signal:AbortSignal.timeout(12000)});report.http.push({id:row.id,status:r.status,tipo:r.headers.get('content-type')});}catch{report.http.push({id:row.id,status:'indisponivel'});}
 }}));
}
report.http.sort((a,b)=>a.id.localeCompare(b.id));
console.log(JSON.stringify(report,null,2));
if(report.semDefinicao.length||report.urlsInvalidas.length||report.http.some(x=>x.status!==200))process.exitCode=1;

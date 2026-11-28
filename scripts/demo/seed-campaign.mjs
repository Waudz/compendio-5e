// Uso: node scripts/demo/seed-campaign.mjs [--apply]
// Requer SUPABASE_URL, SUPABASE_ANON_KEY e DEMO_ACCESS_TOKEN (sessão do mestre).
// Sem --apply, apenas exibe o plano. Não usa service_role.
import { createClient } from '@supabase/supabase-js';
const campaign = '94228e34-bfe0-4800-93fe-19b354c6580a';
const name = 'Os Segredos de Valebruma';
const description = 'Uma antiga maldição ameaça uma vila isolada. Desaparecimentos misteriosos revelam uma conspiração ligada às ruínas de uma civilização esquecida.';
const entries = [
 ['npc','Aldric','Veterano que protege a torre e esconde a origem da maldição.',{nickname:'O Guardião',race:'Humano',occupation:'Vigia'}],
 ['npc','Mira Folhaverde','Curandeira que investiga a névoa e procura os desaparecidos.',{race:'Elfa',occupation:'Curandeira'}],
 ['npc','Borin Pedrafria','Ferreiro que encontrou um fragmento de metal encantado.',{race:'Anão',occupation:'Ferreiro'}],
 ['npc','Serena Voss','Estudiosa das ruínas e tradutora de inscrições antigas.',{race:'Humana',occupation:'Erudita'}],
 ['location','Valebruma','Vila cercada por pinheiros, onde a névoa nunca desaparece.',{type:'Vila',region:'Vale do Norte'}],
 ['location','Torre do Vigia','Torre de pedra abandonada sobre uma colina.',{type:'Ruína'}],
 ['location','Bosque dos Sussurros','Trilhas sinuosas cercadas de árvores retorcidas.',{type:'Floresta'}],
 ['organization','Ordem da Chama Cinzenta','Ordem secreta que protege conhecimentos proibidos.',{purpose:'Conter a maldição'}],
 ['organization','Guarda de Valebruma','Milícia local responsável pelas patrulhas.',{purpose:'Proteger a vila'}],
 ['discovery','O Segredo da Torre','Uma inscrição revela que a torre funciona como selo arcano.',{context:'Encontrada no subterrâneo da torre'}],
 ['discovery','O Sino Silencioso','O sino da vila toca sozinho antes de cada desaparecimento.',{context:'Investigação na praça'}],
 ['item','Lanterna de Cinzas','Lanterna antiga cuja chama azul revela inscrições ocultas.',{}],
];
const diary = [
 ['Sessão 1 — Chegada a Valebruma','O grupo chegou à vila, conversou com Aldric e investigou o desaparecimento de dois viajantes.'],
 ['Sessão 2 — O bosque','Mira conduziu o grupo ao bosque, onde encontraram marcas de um ritual antigo.'],
 ['Sessão 3 — A torre','Os aventureiros descobriram o selo arcano sob a torre e decidiram procurar a Ordem.'],
];
const blocks = text => [{type:'paragraph',content:[{type:'text',text,styles:{}}]}];
console.log({campaign,name,entries:entries.map(x=>x[1]),diary:diary.map(x=>x[0])});
if (!process.argv.includes('--apply')) process.exit(0);
const {SUPABASE_URL, SUPABASE_ANON_KEY, DEMO_ACCESS_TOKEN} = process.env;
if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !DEMO_ACCESS_TOKEN) throw Error('Configure as variáveis de ambiente.');
if (new URL(SUPABASE_URL).hostname !== 'gwcttjlxzelzjhbuitmi.supabase.co') throw Error('Projeto inesperado.');
const client = createClient(SUPABASE_URL,SUPABASE_ANON_KEY,{global:{headers:{Authorization:'Bearer '+DEMO_ACCESS_TOKEN}},auth:{persistSession:false,autoRefreshToken:false}});
async function ok(p){const {data,error}=await p;if(error)throw Error(error.message);return data;}
const {user}=await ok(client.auth.getUser(DEMO_ACCESS_TOKEN));
const c=await ok(client.from('campaigns').select('id,name').eq('id',campaign).single());
if (!['Campanha Teste',name].includes(c.name)) throw Error('Campanha inesperada.');
if (!await ok(client.rpc('is_master',{p_campaign:campaign}))) throw Error('Sessão não é de mestre.');
const existing=await ok(client.from('notes').select('id,title,kind,meta').eq('campaign_id',campaign).is('deleted_at',null));
const ids={};
for(const [category,title,text,fields] of entries){
 const kind=({npc:'npc',location:'location',organization:'faction'})[category]??'page';
 const found=existing.filter(x=>x.title===title&&x.kind===kind);
 if(found.length>1)throw Error('Registro ambíguo: '+title);
 ids[title]=found[0]?.id??await ok(client.rpc('codex_save',{p_campaign:campaign,p_entry:null,p_version:0,p_data:{category,title,description:blocks(text),fields}}));
}
const links=await ok(client.from('codex_links').select('source_id,target_id,kind').eq('campaign_id',campaign));
for(const [a,b,relation,inverse] of [['Aldric','Torre do Vigia','Protege','Protegida por'],['Mira Folhaverde','Valebruma','Mora em','Habitante'],['Borin Pedrafria','Valebruma','Trabalha em','Local de trabalho'],['Serena Voss','Ordem da Chama Cinzenta','Integra','Integrante'],['O Segredo da Torre','Torre do Vigia','Descoberto em','Descoberta'],['Guarda de Valebruma','Valebruma','Protege','Protegida por']]){
 if(!links.some(x=>x.source_id===ids[a]&&x.target_id===ids[b]&&x.kind==='related'))await ok(client.rpc('codex_link',{p_campaign:campaign,p_source:ids[a],p_target:ids[b],p_kind:'related',p_relation:relation,p_inverse:inverse,p_revealed:false}));
}
await ok(client.from('campaigns').update({name,description}).eq('id',campaign).select('id').single());
for(const [i,[title,text]] of diary.entries()){
 if(!existing.some(x=>x.kind==='diary'&&x.title===title))await ok(client.from('notes').insert({campaign_id:campaign,owner_id:user.id,kind:'diary',title,content:blocks(text),visibility:'campaign',meta:{sessao:{dia:i+1,mes:10,ano:1491}}}).select('id').single());
}
for(const old of existing.filter(x=>x.kind==='diary'&&!diary.some(d=>d[0]===x.title))){
 await ok(client.from('notes').update({deleted_at:new Date().toISOString()}).eq('campaign_id',campaign).eq('kind','diary').eq('id',old.id).select('id').single());
}
console.log('Registros narrativos e diário criados. Imagens, fichas e encontros não incluídos nesta versão.');

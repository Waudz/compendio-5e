/** Local-only vertical slice. Never imported by the production build. */
import { useState } from 'react';
import { buildPilotCharacterCatalog } from '../rules/character-catalogue-adapter';
import { coreClassAsiAdvancements } from '../rules/class-asi-2014';
import { addInventoryInstance, changeInventoryInstanceQuantity, createCharacterSheet, type CharacterDraft } from '../rules/character-domain';
import type { RulesCatalogue } from '../rules/rules-catalogue';
const race = { sourceId:'srd-2014',kind:'race' as const,id:'dwarf',revision:'1' };
const background = { sourceId:'srd-2014',kind:'background' as const,id:'acolyte',revision:'1' };
const klass = { sourceId:'srd-2014',kind:'class' as const,id:'fighter',revision:'1' };
const entries = [
 {ref:race,name:'Anão',data:{id:'dwarf',grants:[{type:'ability',ability:'con',amount:2,source:'dwarf'}]}},
 {ref:background,name:'Acólito',data:{id:'acolyte',grants:[]}},
 {ref:klass,name:'Guerreiro',data:{id:'fighter',levels:Array.from({length:20},(_,i)=>({level:i+1,hitDie:10,grants:[]}))}}
];
const rules:RulesCatalogue = {registry:{
 sources:[{id:'srd-2014',origin:'srd-2014',title:'SRD 2014 — piloto ilustrativo',ruleset:'5e-2014'}],
 entries:entries.map(e=>({ref:e.ref,name:e.name,ruleset:'5e-2014'}))
},definitions:entries.map(e=>({ref:e.ref,description:e.name,data:e.data}))};
const {catalog,ids} = buildPilotCharacterCatalog(rules,{race,background,class:klass},coreClassAsiAdvancements('fighter'));
const KEY='compendio5e:dev:character-pilot:v1';
const STORAGE_SCHEMA=1;
type SavedPilot = { schemaVersion:number; draft:CharacterDraft };
function isRecord(value:unknown):value is Record<string,unknown> {
 return value!==null && typeof value==='object' && !Array.isArray(value);
}
function validDraftShape(value:unknown):value is CharacterDraft {
 if(!isRecord(value) || !Array.isArray(value.decisions) || !Array.isArray(value.inventory) ||
  !isRecord(value.baseAbilities) || !isRecord(value.spentResources) ||
  typeof value.name!=='string' || typeof value.id!=='string') return false;
 const abilities=['str','dex','con','int','wis','cha'];
 const baseAbilities=value.baseAbilities;
 return abilities.every(k=>Number.isInteger(baseAbilities[k]) && Number(baseAbilities[k])>=1 && Number(baseAbilities[k])<=30) &&
  value.decisions.every(x=>isRecord(x) && typeof x.id==='string' && Array.isArray(x.optionIds) && x.optionIds.every(id=>typeof id==='string')) &&
  value.inventory.every(x=>isRecord(x) && typeof x.id==='string' && typeof x.itemId==='string' &&
   typeof x.equipped==='boolean' && (x.origin==='starting'||x.origin==='acquired'));
}
function initial():CharacterDraft {
 return {id:crypto.randomUUID(),name:'',ruleset:'5e-2014',catalogueVersion:catalog.version,
 baseAbilities:{str:15,dex:12,con:14,int:10,wis:12,cha:8},
 raceId:ids.raceId,backgroundId:ids.backgroundId,classId:ids.classId,
 level:1,decisions:[],inventory:[],currentHp:12,temporaryHp:0,spentResources:{}};
}
function restore():CharacterDraft {
 try {
  const raw=localStorage.getItem(KEY);
  if(raw) {
   const parsed:unknown=JSON.parse(raw);
   if(!isRecord(parsed) || parsed.schemaVersion!==STORAGE_SCHEMA || !validDraftShape(parsed.draft))
    throw Error('Invalid saved character schema');
   const draft=parsed.draft;
   if(draft.raceId!==ids.raceId || draft.backgroundId!==ids.backgroundId || draft.classId!==ids.classId)
    throw Error('Saved character references do not match pilot');
   createCharacterSheet(draft,catalog);
   return draft;
  }
 } catch { /* corrupted local data is not trusted */ }
 return initial();
}
export default function CharacterPilot(){
 const [draft,setDraft]=useState<CharacterDraft>(restore);
 const [message,setMessage]=useState('');
 let sheet:ReturnType<typeof createCharacterSheet>|null=null;
 let error='';
 try {sheet=createCharacterSheet(draft,catalog);}catch(e){error=e instanceof Error?e.message:String(e);}
 const change=(next:CharacterDraft)=>{setDraft(next);setMessage('Alterações não salvas');};
 const save=()=>{
  if(!sheet || !draft.name.trim()){setMessage('Informe o nome e corrija os erros antes de salvar');return;}
  try{const record:SavedPilot={schemaVersion:STORAGE_SCHEMA,draft};
   localStorage.setItem(KEY,JSON.stringify(record));
   setMessage(sheet.pending.length?'Rascunho incompleto salvo neste navegador':'Salvo neste navegador (somente demonstração)');}
  catch{setMessage('Não foi possível salvar neste navegador');}
 };
 return <main style={{maxWidth:720,margin:'2rem auto',padding:20,fontFamily:'system-ui',lineHeight:1.6}}>
  <h1>Criador de personagem — piloto local</h1>
  <p>Ambiente experimental. Não usa Supabase, não altera personagens reais e não contém o catálogo SRD completo.</p>
  <label>Nome do personagem <input aria-label="Nome do personagem" value={draft.name}
   onChange={e=>change({...draft,name:e.target.value})}/></label>
  <p>Raça: Anão · Antecedente: Acólito · Classe: Guerreiro (referências versionadas)</p>
  <label>Nível <select aria-label="Nível" value={draft.level} onChange={e=>change({...draft,level:Number(e.target.value)})}>
   {[1,2,3,4].map(n=><option key={n} value={n}>{n}</option>)}
  </select></label>
  {draft.level>=4 && <label style={{display:'block'}}>Melhoria de atributo (nível 4)
   <select aria-label="Melhoria de atributo" value={draft.decisions.find(x=>x.id==='fighter-asi-4')?.optionIds[0]??''}
    onChange={e=>change({...draft,decisions:e.target.value?[{id:'fighter-asi-4',optionIds:[e.target.value]}]:[]})}>
    <option value="">Escolha uma melhoria</option>
    <option value="str-plus-two">+2 Força</option>
   </select></label>}
  {error && <p role="alert">{error}</p>}
  {sheet && <section aria-label="Ficha calculada">
   <h2>Ficha</h2><p>Força: {sheet.abilities.str} · Constituição: {sheet.abilities.con} · PV máximo: {sheet.maxHp}</p>
   <p>Escolhas pendentes: {sheet.pending.length?sheet.pending.join(', '):'nenhuma'}</p>
   <p role="note">{!draft.name.trim() || sheet.pending.length?'Estado: rascunho incompleto':'Estado: rascunho completo (não publicado)'}</p>
   <h2>Inventário</h2>
   <button onClick={()=>change(addInventoryInstance(draft,{id:crypto.randomUUID(),itemId:'longsword',quantity:1,equipped:false,origin:'acquired'}))}>
    Adicionar espada longa
   </button>
   <ul>{sheet.inventory.map(item=><li key={item.id}>
    Espada longa · quantidade {item.quantity} · ID {item.id.slice(0,8)}
    <button aria-label={'Adicionar quantidade '+item.id} onClick={()=>change(changeInventoryInstanceQuantity(draft,item.id,1))}>+1</button>
    <button aria-label={'Remover quantidade '+item.id} onClick={()=>change(changeInventoryInstanceQuantity(draft,item.id,-1))}>−1</button>
   </li>)}</ul>
  </section>}
  <p><button onClick={save}>Salvar rascunho local</button>{' '}
  <button onClick={()=>{const next=restore();setDraft(next);setMessage('Rascunho recarregado do navegador');}}>Reabrir rascunho salvo</button></p>
  <p role="status">{message}</p>
 </main>;
}

/** Local-only vertical slice. Never imported by the production build. */
import { useState } from 'react';
import { buildPilotCharacterCatalog } from '../rules/character-catalogue-adapter';
import {fighter2014Advancements} from '../rules/fighter-2014';
import { addInventoryInstance, changeInventoryInstanceQuantity, createCharacterSheet, type CharacterDraft } from '../rules/character-domain';
import {pilotRefs,pilotRules} from './pilot-rules';
import {fighterEquipmentOptions2014} from '../rules/starting-equipment-2014';
import {applyStartingEquipmentSelection,replaceStartingEquipmentSelection} from '../rules/starting-equipment-selection';
import {ABILITY_ORDER,POINT_BUY_BUDGET,pointBuySpent,validatePointBuy,isStandardArray} from '../rules/ability-generation-2014';
const {catalog,ids} = buildPilotCharacterCatalog(pilotRules,{race:pilotRefs.race,background:pilotRefs.background,class:pilotRefs.class},fighter2014Advancements);
const KEY='compendio5e:dev:character-pilot:fighter-srd51-v2';
const STORAGE_SCHEMA=2;
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
 level:1,decisions:[],inventory:[],currentHp:13,temporaryHp:0,spentResources:{}};
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
function equipmentChoicesFromInventory(draft:CharacterDraft):Record<string,string> {
 const choices:Record<string,string>={};
 for(const [group,options] of Object.entries(fighterEquipmentOptions2014)){
  const item=draft.inventory.find(entry=>entry.id.startsWith('starting-choice:fighter-'+group+':'));
  const selected=item?.id.split(':')[2];
  choices[group]=options.some(option=>option.id===selected)?selected!:options[0].id;
 }
 return choices;
}
function equipmentGroupsComplete(draft:CharacterDraft):boolean {
 return Object.entries(fighterEquipmentOptions2014).every(([group,options])=>{
  const prefix='starting-choice:fighter-'+group+':';
  return options.some(option=>option.components.every(component=>draft.inventory.some(entry=>
   entry.id===prefix+option.id+':'+component.itemId&&entry.itemId===component.itemId&&entry.quantity===component.quantity)));
 });
}
export default function CharacterPilot(){
 const [draft,setDraft]=useState<CharacterDraft>(restore);
 const [message,setMessage]=useState('');
 const [abilityMethod,setAbilityMethod]=useState<'point-buy'|'standard-array'>(()=>isStandardArray(draft.baseAbilities)?'standard-array':'point-buy');
 const [abilityError,setAbilityError]=useState('');
 const [equipmentChoices,setEquipmentChoices]=useState<Record<string,string>>(()=>equipmentChoicesFromInventory(draft));
 let sheet:ReturnType<typeof createCharacterSheet>|null=null;
 let error='';
 try {sheet=createCharacterSheet(draft,catalog);}catch(e){error=e instanceof Error?e.message:String(e);}
 const change=(next:CharacterDraft)=>{setDraft(next);setMessage('Alterações não salvas');};
 const changeAbility=(ability:typeof ABILITY_ORDER[number],score:number)=>{
  const next={...draft.baseAbilities,[ability]:score};
  try {if(abilityMethod==='point-buy')validatePointBuy(next);else if(!isStandardArray(next)){
    setAbilityError('Na matriz padrão, troque a posição de dois valores para preservar os seis resultados.');return;
   }
   setAbilityError('');change({...draft,baseAbilities:next,currentHp:Math.min(draft.currentHp,10+Math.floor((next.con+2-10)/2))});
  }catch(e){setAbilityError(e instanceof Error?e.message:String(e));}
 };
 const confirmEquipment=()=>{
  try{
   const known=new Set(pilotRules.registry.entries.filter(entry=>entry.ref.kind==='item').map(entry=>entry.ref.id));
   let next=draft;
   const changes:{group:string;oldOptionId:string;newOptionId:string}[]=[];
   for(const group of Object.keys(fighterEquipmentOptions2014)){
    const old=next.inventory.find(item=>item.id.startsWith('starting-choice:fighter-'+group+':'));
    const oldOptionId=old?.id.split(':')[2];
    if(oldOptionId&&oldOptionId!==equipmentChoices[group])changes.push({group,oldOptionId,newOptionId:equipmentChoices[group]});
   }
   if(changes.length&&!window.confirm('Substituir os equipamentos iniciais selecionados? Itens iniciais já utilizados ou alterados não serão substituídos.'))return;
   for(const [group,options] of Object.entries(fighterEquipmentOptions2014)){
    const option=options.find(item=>item.id===equipmentChoices[group]);
    if(!option)throw Error('Selecione equipamento: '+group);
    const sourceId='fighter-'+group;
    const old=next.inventory.find(item=>item.id.startsWith('starting-choice:'+sourceId+':'));
    const oldOptionId=old?.id.split(':')[2];
    if(oldOptionId&&oldOptionId!==option.id){
     const oldOption=options.find(item=>item.id===oldOptionId);
     if(!oldOption)throw Error('Equipamento inicial anterior desconhecido');
     next=replaceStartingEquipmentSelection(next,{sourceId,optionId:oldOption.id,components:oldOption.components},
      {sourceId,optionId:option.id,components:option.components},known,true);
    }else next=applyStartingEquipmentSelection(next,{sourceId,optionId:option.id,components:option.components},known);
   }
   change(next);setMessage('Equipamentos iniciais da classe adicionados; revise o inventário');
  }catch(e){setMessage(e instanceof Error?e.message:'Não foi possível confirmar os equipamentos');}
 };
 const save=()=>{
  if(!sheet || !draft.name.trim()){setMessage('Informe o nome e corrija os erros antes de salvar');return;}
  try{const record:SavedPilot={schemaVersion:STORAGE_SCHEMA,draft};
   localStorage.setItem(KEY,JSON.stringify(record));
   setMessage(sheet.pending.length || !equipmentGroupsComplete(draft)?'Rascunho incompleto salvo neste navegador':'Salvo neste navegador (somente demonstração)');}
  catch{setMessage('Não foi possível salvar neste navegador');}
 };
 return <main style={{maxWidth:720,margin:'2rem auto',padding:20,fontFamily:'system-ui',lineHeight:1.6}}>
  <h1>Criador de personagem — piloto local</h1>
  <p>Ambiente experimental. Não usa Supabase, não altera personagens reais e não contém o catálogo SRD completo.</p>
  <label>Nome do personagem <input aria-label="Nome do personagem" value={draft.name}
   onChange={e=>change({...draft,name:e.target.value})}/></label>
  <p>Raça: Anão · Antecedente: Acólito · Classe: Guerreiro (referências versionadas)</p>
  <fieldset><legend>Atributos-base (antes dos bônus raciais)</legend>
   <label>Método <select aria-label="Método de atributos" value={abilityMethod} onChange={e=>{
    const method=e.target.value as 'point-buy'|'standard-array';setAbilityMethod(method);setAbilityError('');
    const baseAbilities=method==='standard-array'?{str:15,dex:14,con:13,int:12,wis:10,cha:8}:{str:15,dex:12,con:14,int:10,wis:12,cha:8};
    change({...draft,baseAbilities,currentHp:10+Math.floor((baseAbilities.con+2-10)/2)});
   }}><option value="point-buy">Compra de pontos (27)</option><option value="standard-array">Matriz padrão</option></select></label>
   {abilityMethod==='point-buy'&&<p>Pontos gastos: {pointBuySpent(draft.baseAbilities)} / {POINT_BUY_BUDGET}</p>}
   {ABILITY_ORDER.map(ability=><label key={ability} style={{display:'inline-block',marginRight:12}}>{ability.toUpperCase()} <select aria-label={'Atributo '+ability} value={draft.baseAbilities[ability]}
    onChange={e=>{const score=Number(e.target.value);if(abilityMethod==='standard-array'){
     const other=ABILITY_ORDER.find(key=>key!==ability&&draft.baseAbilities[key]===score);
     if(other){const baseAbilities={...draft.baseAbilities,[ability]:score,[other]:draft.baseAbilities[ability]};
      change({...draft,baseAbilities,currentHp:Math.min(draft.currentHp,10+Math.floor((baseAbilities.con+2-10)/2))});}
    }else changeAbility(ability,score);}}>
    {(abilityMethod==='standard-array'?[...new Set([15,14,13,12,10,8])]:[8,9,10,11,12,13,14,15]).map(score=><option key={score} value={score}>{score}</option>)}
   </select></label>)}
   {abilityError&&<p role="alert">{abilityError}</p>}
  </fieldset>
  <label>Nível <select aria-label="Nível" value={draft.level} onChange={e=>change({...draft,level:Number(e.target.value)})}>
   {[1,2,3,4,5,6].map(n=><option key={n} value={n}>{n}</option>)}
  </select></label>
  {fighter2014Advancements.flatMap(adv=>adv.level<=draft.level?adv.choices??[]:[]).map(choice=>choice.count>1?<fieldset key={choice.id}>
   <legend>Perícias do Guerreiro (escolha {choice.count})</legend>
   {choice.options.map(option=>{const chosen=draft.decisions.find(d=>d.id===choice.id)?.optionIds??[];
    return <label key={option.id} style={{display:'inline-block',marginRight:12}}>
     <input type="checkbox" aria-label={'Perícia '+option.id} checked={chosen.includes(option.id)}
      disabled={!chosen.includes(option.id)&&chosen.length>=choice.count}
      onChange={e=>change({...draft,decisions:[...draft.decisions.filter(d=>d.id!==choice.id),
       {id:choice.id,optionIds:e.target.checked?[...chosen,option.id]:chosen.filter(id=>id!==option.id)}]})}/>
     {option.id.replaceAll('-', ' ')}
    </label>})}
  </fieldset>:<label key={choice.id} style={{display:'block'}}>
   {choice.id==='fighter-style-1'?'Estilo de luta (nível 1)':choice.id==='fighter-archetype-3'?'Arquétipo marcial (nível 3)':
    'Melhoria de atributo (nível '+choice.level+')'}
   <select aria-label={choice.id==='fighter-asi-4'?'Melhoria de atributo':choice.id} value={draft.decisions.find(d=>d.id===choice.id)?.optionIds[0]??''}
    onChange={e=>change({...draft,decisions:[...draft.decisions.filter(d=>d.id!==choice.id),
     ...(e.target.value?[{id:choice.id,optionIds:[e.target.value]}]:[])]})}>
    <option value="">Selecione uma opção</option>
    {choice.options.map(option=><option key={option.id} value={option.id}>{option.id.replaceAll('-', ' ')}</option>)}
   </select>
  </label>)}
  {error && <p role="alert">{error}</p>}
  {sheet && <section aria-label="Ficha calculada">
   <h2>Ficha</h2><p>Força: {sheet.abilities.str} · Constituição: {sheet.abilities.con} · PV máximo: {sheet.maxHp}</p>
   <p>Características: {sheet.features.join(', ')||'nenhuma'}</p>
   <p>Perícias: {sheet.skills.join(', ')||'nenhuma'}</p>
   <p>Recursos: {Object.entries(sheet.resources).map(([name,value])=>name+' '+String(value.remaining)+'/'+String(value.maximum)).join(' · ')||'nenhum'}</p>
   <p>Escolhas pendentes: {sheet.pending.length?sheet.pending.join(', '):'nenhuma'}</p>
   <p role="note">{!draft.name.trim() || sheet.pending.length || !equipmentGroupsComplete(draft)?'Estado: rascunho incompleto':'Estado: rascunho completo (não publicado)'}</p>
   <h2>Equipamentos iniciais — Guerreiro</h2>
   <p>Escolha um conjunto de cada grupo. As opções de armas marciais são amostras enquanto o catálogo completo não for auditado.</p>
   {Object.entries(fighterEquipmentOptions2014).map(([group,options])=><fieldset key={group}>
    <legend>{({armor:'Armadura',weapons:'Armas marciais',ranged:'Armas adicionais',pack:'Pacote de aventureiro'} as Record<string,string>)[group]}</legend>
    <select aria-label={'Equipamento '+group} value={equipmentChoices[group]}
     onChange={e=>setEquipmentChoices(previous=>({...previous,[group]:e.target.value}))}>
     {options.map(option=><option key={option.id} value={option.id}>{option.name}</option>)}
    </select>
    <ul>{options.find(option=>option.id===equipmentChoices[group])?.components.map(item=><li key={item.itemId}>
     {pilotRules.registry.entries.find(entry=>entry.ref.kind==='item'&&entry.ref.id===item.itemId)?.name??item.itemId} ×{item.quantity}
    </li>)}</ul>
   </fieldset>)}
   <button onClick={confirmEquipment}>Confirmar equipamentos iniciais</button>
   <h2>Inventário</h2>
   <button onClick={()=>change(addInventoryInstance(draft,{id:crypto.randomUUID(),itemId:'longsword',quantity:1,equipped:false,origin:'acquired'}))}>
    Adicionar espada longa
   </button>
   <ul>{sheet.inventory.map(item=><li key={item.id}>
    {pilotRules.registry.entries.find(entry=>entry.ref.kind==='item'&&entry.ref.id===item.itemId)?.name??item.itemId} · quantidade {item.quantity} · ID {item.id.slice(0,8)}
    <button aria-label={'Adicionar quantidade '+item.id} onClick={()=>change(changeInventoryInstanceQuantity(draft,item.id,1))}>+1</button>
    <button aria-label={'Remover quantidade '+item.id} onClick={()=>change(changeInventoryInstanceQuantity(draft,item.id,-1))}>−1</button>
   </li>)}</ul>
  </section>}
  <p><button onClick={save}>Salvar rascunho local</button>{' '}
  <button onClick={()=>{const next=restore();setDraft(next);setEquipmentChoices(equipmentChoicesFromInventory(next));setMessage('Rascunho recarregado do navegador');}}>Reabrir rascunho salvo</button></p>
  <p role="status">{message}</p>
 </main>;
}

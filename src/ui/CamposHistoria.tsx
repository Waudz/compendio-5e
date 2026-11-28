import type {CharacterDraft} from '../rules/character-domain';
import {CAMPOS_HISTORIA,CAMPOS_ORIGEM,LOCAIS_DA_HISTORIA} from '../ficha/campos';
import {useConhecimento} from '../compendio/conhecimento';
import {SecaoNarrativa} from './SecaoNarrativa';
type Historia=NonNullable<CharacterDraft['story']>;
/** Adaptador da narrativa canônica da ficha; não copia raça, classe, nível ou identidade pública. */
export function CamposHistoria({value,onChange}:{value:Historia;onChange:(h:Historia)=>void}){
 // só os locais que a projeção já entrega a este usuário: escolher um não revela nada a ninguém
 const locais=useConhecimento().items.filter(e=>e.category==='location').sort((a,b)=>a.title.localeCompare(b.title,'pt-BR'));
 const campo=(id:keyof Historia,label:string,longo=false)=><label key={id}>{label}{longo?<textarea aria-label={label} rows={id==='historia'?6:3} maxLength={id==='historia'?8000:1500} value={value[id]??''} onChange={e=>onChange({...value,[id]:e.target.value})}/>:<input aria-label={label} maxLength={120} value={value[id]??''} onChange={e=>onChange({...value,[id]:e.target.value})}/>}</label>;
 const origem=(id:keyof Historia,label:string)=>{
  const ligacao=LOCAIS_DA_HISTORIA[id];
  if(!ligacao)return campo(id,label);
  const escolhido=value[ligacao]??'',visivel=locais.find(l=>l.id===escolhido);
  return <div key={id} className="vinculo-campo">
   <label>{label}<input aria-label={label} maxLength={120} disabled={!!escolhido} placeholder="Texto livre" value={visivel?visivel.title:value[id]??''} onChange={e=>onChange({...value,[id]:e.target.value})}/></label>
   {(locais.length>0||escolhido)&&<select aria-label={`Vincular ${label} a um local`} value={escolhido} onChange={e=>{const l=locais.find(x=>x.id===e.target.value);onChange({...value,[ligacao]:l?.id??'',[id]:l?l.title:''});}}>
    <option value="">Ou escolher um local do Compêndio…</option>
    {escolhido&&!visivel&&<option value={escolhido}>{value[id]||'Local indisponível'}</option>}
    {locais.map(l=><option key={l.id} value={l.id}>{l.title}</option>)}
   </select>}
  </div>;
 };
 return <><SecaoNarrativa titulo="Origem e residência">{CAMPOS_ORIGEM.map(([id,label])=>origem(id,label))}</SecaoNarrativa><SecaoNarrativa titulo="História e vínculos pessoais"><div className="etapa-historia">{CAMPOS_HISTORIA.map(([id,label])=>campo(id,label,true))}{campo('observacoes','Observações',true)}</div></SecaoNarrativa></>;
}

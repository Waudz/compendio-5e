import type {CharacterDraft} from '../rules/character-domain';
import {CAMPOS_HISTORIA,CAMPOS_ORIGEM} from '../ficha/campos';
import {SecaoNarrativa} from './SecaoNarrativa';
type Historia=NonNullable<CharacterDraft['story']>;
/** Adaptador da narrativa canônica da ficha; não copia raça, classe, nível ou identidade pública. */
export function CamposHistoria({value,onChange}:{value:Historia;onChange:(h:Historia)=>void}){
 const campo=(id:keyof Historia,label:string,longo=false)=><label key={id}>{label}{longo?<textarea aria-label={label} rows={id==='historia'?6:3} maxLength={id==='historia'?8000:1500} value={value[id]??''} onChange={e=>onChange({...value,[id]:e.target.value})}/>:<input aria-label={label} maxLength={120} value={value[id]??''} onChange={e=>onChange({...value,[id]:e.target.value})}/>}</label>;
 return <><SecaoNarrativa titulo="Origem e residência">{CAMPOS_ORIGEM.map(([id,label])=>campo(id,label))}</SecaoNarrativa><SecaoNarrativa titulo="História e personalidade"><div className="etapa-historia">{CAMPOS_HISTORIA.map(([id,label])=>campo(id,label,true))}{campo('observacoes','Observações',true)}</div></SecaoNarrativa></>;
}

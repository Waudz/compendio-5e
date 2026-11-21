import {useState} from 'react';
import {defaultPublicIdentity,publicIdentityCard,type PrivateIdentitySource,type PublicIdentityField,type PublicIdentitySettings} from '../rules/public-identity';

type Props={source:PrivateIdentitySource;initialSettings?:PublicIdentitySettings;onSave:(settings:PublicIdentitySettings)=>void;onSkip?:()=>void};
const FIELDS=[['name','Nome'],['surname','Sobrenome'],['race','Raça'],['characterClass','Classe']] as const;
type FieldKey=typeof FIELDS[number][0];

/** Editor da identidade pública: nunca lê nem publica a ficha privada; recebe só os campos de origem informados. */
export default function PublicIdentityEditor({source,initialSettings,onSave,onSkip}:Props){
 const [settings,setSettings]=useState<PublicIdentitySettings>(()=>initialSettings??defaultPublicIdentity());
 const updateField=(key:FieldKey,patch:PublicIdentityField)=>setSettings(previous=>({...previous,[key]:patch}));
 const preview=publicIdentityCard(settings,source);
 const displayedName=[preview.name,preview.surname].filter(Boolean).join(' ');
 return <section aria-label="Cartão de Identidade público">
  <h2>Como os outros personagens veem você</h2>
  <p>Este cartão não mostra sua ficha completa, nível ou inventário. Campos ocultos não revelam o valor verdadeiro.</p>
  <label>Título ou alcunha <input aria-label="Título público" value={settings.title} onChange={e=>setSettings(previous=>({...previous,title:e.target.value}))}/></label>
  {FIELDS.map(([key,label])=><fieldset key={key}>
   <legend>{label}</legend>
   <label>Visibilidade de {label.toLowerCase()} <select aria-label={'Visibilidade '+label} value={settings[key].mode}
    onChange={e=>updateField(key,{mode:e.target.value as PublicIdentityField['mode'],customValue:settings[key].customValue})}>
    <option value="real">Mostrar verdadeiro</option>
    <option value="custom">Mostrar personalizado</option>
    <option value="hidden">Ocultar</option>
   </select></label>
   {settings[key].mode==='custom'&&<label>{label} público <input aria-label={label+' público'} value={settings[key].customValue??''}
    onChange={e=>updateField(key,{mode:'custom',customValue:e.target.value})}/></label>}
  </fieldset>)}
  <label>Imagem pública (URL) <input aria-label="Imagem pública" value={settings.imageUrl??''}
   onChange={e=>setSettings(previous=>({...previous,imageUrl:e.target.value||null}))}/></label>
  <label>Descrição pública <textarea aria-label="Descrição pública" value={settings.description}
   onChange={e=>setSettings(previous=>({...previous,description:e.target.value}))}/></label>
  <section aria-label="Prévia para outros jogadores">
   <h3>Prévia para outros jogadores</h3>
   {preview.imageUrl&&<img alt="Retrato público do personagem" src={preview.imageUrl} style={{maxWidth:120,maxHeight:120}}/>}
   <p>{preview.title||displayedName||'Identidade desconhecida'}</p>
   {preview.title&&displayedName&&<p>{displayedName}</p>}
   {preview.race&&<p>Raça: {preview.race}</p>}
   {preview.characterClass&&<p>Classe: {preview.characterClass}</p>}
   {preview.description&&<p>{preview.description}</p>}
  </section>
  <button type="button" onClick={()=>onSave(settings)}>Salvar identidade pública</button>
  {onSkip&&<button type="button" onClick={onSkip}>Configurar depois</button>}
 </section>;
}

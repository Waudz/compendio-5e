// Identidade pública: só a APRESENTAÇÃO do personagem aos outros jogadores. Não é outra ficha. "Usar da ficha" acompanha a ficha;
// o que é personalizado permanece como escrito; "Ocultar" não revela o valor verdadeiro. O retrato é o mesmo da ficha.
import {useState} from 'react';
import {defaultPublicIdentity,presentation,publicIdentityCard,type ChavePublica,type CampoPublico,type ModoPublico,type PublicIdentity,type SheetPublicSource} from '../rules/public-identity';
import {RetratoQuadrado} from '../RetratoCombate';
import {retratoValido} from '../fichas';

type Props={source:SheetPublicSource;initialIdentity?:PublicIdentity;onSave:(identity:PublicIdentity)=>void;onSkip?:()=>void};
const FIELDS:readonly (readonly [ChavePublica,string,string])[]=[['name','Nome','Nome público'],['alias','Alcunha','Alcunha pública'],['race','Raça','Raça pública'],['characterClass','Classe','Classe pública']];

/** Editor da identidade pública: nunca lê nem publica a ficha privada; recebe só os campos de origem informados. */
export default function PublicIdentityEditor({source,initialIdentity,onSave,onSkip}:Props){
 const [identity,setIdentity]=useState<PublicIdentity>(()=>initialIdentity??defaultPublicIdentity());
 const set=(key:ChavePublica,field:CampoPublico)=>setIdentity(previous=>({...previous,[key]:field}));
 const card=publicIdentityCard(identity,source),shown=presentation(card);
 const nothingToShow=!card.name&&!card.alias;
 return <section aria-label="Cartão de Identidade público" className="identidade-publica">
  <h2>Como os outros jogadores veem você</h2>
  <p className="muted">Opcional: sem mudar nada, usa o que está na ficha e acompanha as alterações. O retrato é o mesmo da ficha. Atributos, PV, CA, nível e inventário nunca aparecem.</p>
  {FIELDS.map(([key,label,customLabel])=>{const field=identity[key];return <fieldset key={key}>
   <legend>{label}</legend>
   <label>Visibilidade <select aria-label={'Visibilidade '+label} value={field.mode}
    onChange={e=>set(key,{mode:e.target.value as ModoPublico,value:field.value})}>
    <option value="sheet">{'Usar da ficha'+(source[key]?' ('+source[key]+')':' (vazio)')}</option>
    <option value="custom">Personalizar</option>
    <option value="hidden">Ocultar</option>
   </select></label>
   {field.mode==='custom'&&<label>{customLabel} <input aria-label={customLabel} maxLength={120} value={field.value??''}
    onChange={e=>set(key,{mode:'custom',value:e.target.value})}/></label>}
  </fieldset>;})}
  <label>Descrição pública <textarea aria-label="Descrição pública" rows={3} maxLength={4000} value={identity.description}
   onChange={e=>setIdentity(previous=>({...previous,description:e.target.value}))}/></label>
  <section aria-label="Prévia para outros jogadores" className="identidade-previa">
   <RetratoQuadrado tipo="personagem" tamanho={72} src={retratoValido(card.imageUrl)?card.imageUrl:null}/>
   <div><p className="identidade-nome">{shown.nome}</p>
    {shown.alcunha&&<p className="identidade-alcunha"><em>{shown.alcunha}</em></p>}
    {(card.race||card.characterClass)&&<p className="muted">{[card.race,card.characterClass].filter(Boolean).join(' · ')}</p>}
    {card.description&&<p>{card.description}</p>}</div>
  </section>
  {nothingToShow&&<p role="alert" className="notice err">Apresente ao menos o nome ou a alcunha.</p>}
  <button type="button" className="btn-secondary" disabled={nothingToShow} onClick={()=>onSave(identity)}>Salvar identidade pública</button>
  {onSkip&&<button type="button" className="btn-secondary" onClick={onSkip}>Configurar depois</button>}
 </section>;
}

// Identidade pública: só a APRESENTAÇÃO do personagem aos outros jogadores. Não é outra ficha. "Usar da ficha" acompanha a ficha;
// o que é personalizado permanece como escrito; "Ocultar" não revela o valor verdadeiro. O retrato é o mesmo da ficha. Cada mudança
// vale para a ficha em edição e é gravada pelo botão Salvar; não há caixa de publicação.
import { NomeComAlcunha } from "../ui/NomeComAlcunha";
import {useState} from 'react';
import {defaultPublicIdentity,presentation,publicIdentityCard,type ChavePublica,type CampoPublico,type ModoPublico,type PublicIdentity,type SheetPublicSource} from '../rules/public-identity';
import {RetratoQuadrado} from '../RetratoCombate';
import {retratoValido} from '../fichas';

type Props={source:SheetPublicSource;initialIdentity?:PublicIdentity;onChange:(identity:PublicIdentity)=>void;onSkip?:()=>void};
const FIELDS:readonly (readonly [ChavePublica,string,string])[]=[['name','Nome','Nome público'],['alias','Alcunha','Alcunha pública'],['race','Raça','Raça pública'],['characterClass','Classe','Classe pública'],['level','Nível','Nível público']];

/** Editor da identidade pública: nunca lê nem publica a ficha privada; recebe só os campos de origem informados. */
export default function PublicIdentityEditor({source,initialIdentity,onChange,onSkip}:Props){
 const [identity,setIdentity]=useState<PublicIdentity>(()=>initialIdentity??defaultPublicIdentity());
 const aplicar=(proxima:PublicIdentity)=>{setIdentity(proxima);onChange(proxima);};
 const set=(key:ChavePublica,field:CampoPublico)=>aplicar({...identity,[key]:field});
 const card=publicIdentityCard(identity,source),shown=presentation(card);
 const nothingToShow=!card.name&&!card.alias;
 return <section aria-label="Cartão de Identidade público" className="identidade-publica">
  <h2>Como os outros jogadores veem seu personagem</h2>
  <p className="muted">Sem mudar nada, a apresentação acompanha a ficha. O retrato é o mesmo da ficha. Atributos, PV, CA, inventário e anotações nunca aparecem.</p>
  <div className="identidade-grade">
  <div className="identidade-campos">
  {FIELDS.map(([key,label,customLabel])=>{const field=identity[key];return <div key={key} className="identidade-campo">
   <label>{label}<select aria-label={'Visibilidade '+label} value={field.mode}
    onChange={e=>set(key,{mode:e.target.value as ModoPublico,value:field.value})}>
    <option value="sheet">{'Usar da ficha'+(source[key]?' ('+source[key]+')':' (vazio)')}</option>
    <option value="custom">Personalizar</option>
    <option value="hidden">Ocultar</option>
   </select></label>
   {field.mode==='custom'&&<label>{customLabel}<input aria-label={customLabel} maxLength={120} value={field.value??''}
    onChange={e=>set(key,{mode:'custom',value:e.target.value})}/></label>}
  </div>;})}
  <label className="identidade-descricao">Descrição pública<textarea aria-label="Descrição pública" rows={3} maxLength={4000} value={identity.description}
   onChange={e=>aplicar({...identity,description:e.target.value})}/></label>
  </div>
  {/* o MESMO cartão que a campanha vê no Início e em Personagens */}
  <section aria-label="Prévia para outros jogadores" className="identidade-previa">
   <h3 className="identidade-previa-titulo">Prévia: como aparece no Início e em Personagens</h3>
   <div className="home-char">
    <RetratoQuadrado tipo="personagem" tamanho={72} src={retratoValido(card.imageUrl)?card.imageUrl:null}/>
    <span><NomeComAlcunha nome={shown.nome} alcunha={shown.alcunha} classeDoNome="identidade-nome"/>
     {(card.race||card.characterClass||card.level)&&<small>{[card.race,card.characterClass,card.level&&`Nível ${card.level}`].filter(Boolean).join(' · ')}</small>}</span>
   </div>
   {card.description&&<p className="identidade-texto">{card.description}</p>}
  </section>
  </div>
  {nothingToShow&&<p role="alert" className="notice err">Apresente ao menos o nome ou a alcunha.</p>}
  {onSkip&&<button type="button" className="btn-secondary" onClick={onSkip}>Configurar depois</button>}
 </section>;
}

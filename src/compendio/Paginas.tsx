import {useContext,useEffect,useMemo,useRef,useState} from 'react';
import {ArrowLeft,Pencil,Trash2,ExternalLink} from 'lucide-react';
import {useCampaigns} from '../CampaignsContext';
import {useAuth} from '../AuthContext';
import {useRegistros} from '../RegistrosContext';
import {VoltarPaginaContext} from '../voltarPagina';
import {Aviso} from '../Diario';
import {MenuDeAcoes} from '../ui/MenuDeAcoes';
import {RetratoQuadrado} from '../RetratoCombate';
import {cartaoPublico} from '../fichas';
import {registrarTitulo} from '../registrosStore';
import {avisarConhecimento,type Conhecimento,type Divulgacao,type Previa} from './conhecimento';
import {EditorConhecimento} from './RegistrosCampanha';
import {VisaoRegistro} from './VisaoRegistro';
import {EntregarItem} from './EntregarItem';
import {ListaVinculos,NovoVinculoBotao,useVinculos,type ControlesVinculo} from './Vinculos';
import {alternarChaves,presetBestiario,todasAsChaves,PRESETS_BESTIARIO} from './chaves';
import {secoesDaDefinicao,useDefinicao,useDefinicoes} from './definicoes';
import {mesmasSecoes} from './ficha';
import {useLinhasCampanha,useIdentidades} from './consulta';
import {lerRegra,monstroSpec} from './navegacao';
import type {TabSpec} from '../workspace';
import {carregarIndice,categoria} from '../catalogue/nucleo/registro';
import type {CategoriaDef} from '../catalogue/nucleo/tipos';
import {DND5E_2014,garantirSistemaDnd5e2014} from '../catalogue/sistemas/dnd5e-2014';
import {Detalhe} from './CompendioCatalogo';
export function VoltarCompendio({onOpenContent,label='Compêndio'}:{onOpenContent:(s:TabSpec)=>void;label?:string}){const back=useContext(VoltarPaginaContext);return <button className="cd-back" onClick={()=>back?back():onOpenContent({kind:'secao',ref:'compendio'})}><ArrowLeft size={16}/> {label}</button>;}
/** Vínculos de um aventureiro: a divulgação é feita pela ponta que é registro do Compêndio. */
export function RelacoesRegistro({id,onOpenContent}:{id:string;onOpenContent:(s:TabSpec)=>void}){
 const dados=useLinhasCampanha(),vinculos=useVinculos(id,dados),{active}=useCampaigns(),acoes=useDivulgacao(vinculos);
 const master=active?.role==='mestre';
 if(!master&&!vinculos.links.length&&!vinculos.error)return null;
 return <section className="cd-relations" aria-label="Registros relacionados"><h2>Registros relacionados</h2>{(vinculos.error||acoes.error)&&<Aviso erro t={vinculos.error??acoes.error!}/>}{!vinculos.error&&vinculos.loaded&&!vinculos.links.length&&<p className="muted">Nenhum registro relacionado.</p>}
 <ListaVinculos links={vinculos.links} rows={vinculos.data.rows} onOpenContent={onOpenContent} controles={master?acoes.controlesVinculo():undefined}/>{master&&<NovoVinculoBotao id={id} vinculos={vinculos}/>}</section>;
}
/** Operações de divulgação: uma por vez, até a projeção recarregada trazer a nova versão. */
function useDivulgacao(vinculos:ReturnType<typeof useVinculos>){
 const {active}=useCampaigns(),{api,items}=vinculos.data;
 const [pending,setPending]=useState<{items:unknown}>(),[error,setError]=useState('');
 const busy=!!pending&&pending.items===items;
 const executar=(op:()=>Promise<unknown>)=>{if(busy)return;setPending({items});setError('');void op().then(()=>{vinculos.reload();avisarConhecimento();},e=>{setPending(undefined);setError(e instanceof Error?e.message:'Não foi possível alterar a visibilidade.');avisarConhecimento();});};
 const revelar=(entry:Conhecimento,data:Partial<Divulgacao>)=>{if(!api||!active)return;executar(()=>api.reveal(active.campaign.id,entry.id,entry.version,{visible:entry.visible,revealed:entry.revealed??[],...data}));};
 const controlesVinculo=(atual?:Conhecimento,sheet?:Divulgacao['sheet']):ControlesVinculo=>({busy,
  onRevelar:(link,on)=>{const dono=atual??items.find(x=>x.id===link.targetId);if(dono)revelar(dono,{links:{[link.id]:on},sheet});else setError('Este vínculo não pertence a um registro do Compêndio.');},
  onRemover:link=>{if(api&&active&&window.confirm(`Remover o vínculo com ${link.title}? Os registros são preservados.`))executar(()=>api.unlink(active.campaign.id,link.id));}});
 return {busy,error,revelar,controlesVinculo};
}
export function RegistroCompendioPagina({id,onOpenContent}:{id:string;onOpenContent:(s:TabSpec)=>void}){
 const data=useLinhasCampanha(),{active}=useCampaigns(),[edit,setEdit]=useState(false),[error,setError]=useState(''),[asPlayer,setAsPlayer]=useState(false);
 const vinculos=useVinculos(id,data),acoes=useDivulgacao(vinculos),semDefinicoes=useDefinicoes().indisponivel;
 const row=data.rows.find(r=>r.entry?.id===id),entry=row?.entry;
 const master=active?.role==='mestre';
 useEffect(()=>{if(entry)registrarTitulo(id,entry.title);},[id,entry?.title]);
 // A ficha enviada ao servidor acompanha a definição atual; divergências são regravadas na próxima divulgação.
 const definicao=useDefinicao(entry?.category??'',master?entry?.definitionId:undefined,entry?.systemId);
 const secoes=useMemo(()=>definicao&&!semDefinicoes?secoesDaDefinicao(definicao):undefined,[definicao,semDefinicoes]);
 const desatualizada=!!secoes&&!!entry&&!mesmasSecoes(secoes,entry.sheet);
 const tentativa=useRef('');
 useEffect(()=>{const chave=`${id}:${entry?.version}`;if(master&&entry&&desatualizada&&tentativa.current!==chave){tentativa.current=chave;acoes.revelar(entry,{sheet:secoes});}},[master,desatualizada,entry?.version]);
 const [previa,setPrevia]=useState<{chave:string;data?:Previa;error?:string}>();
 const chavePrevia=`${active?.campaign.id}:${id}:${entry?.version}:${JSON.stringify(vinculos.links.map(l=>[l.id,l.revealed]))}`;
 useEffect(()=>{let alive=true;if(asPlayer&&master&&data.api&&active)void data.api.preview(active.campaign.id,id).then(value=>{if(alive)setPrevia({chave:chavePrevia,data:value});},()=>{if(alive)setPrevia({chave:chavePrevia,error:'Não foi possível gerar a prévia.'});});return()=>{alive=false;};},[asPlayer,chavePrevia]);
 if(data.loading&&!entry)return <div className="content cd-page"><p role="status">Carregando registro…</p></div>;
 if(!entry||!row)return <div className="content cd-page"><VoltarCompendio onOpenContent={onOpenContent}/><Aviso t={data.error??'Registro indisponível para esta campanha e este usuário.'}/></div>;
 const remove=()=>{if(!data.api||!active||!window.confirm('Remover este registro? Os registros relacionados serão preservados.'))return;void data.api.remove(active.campaign.id,id,entry.version).then(()=>{avisarConhecimento();onOpenContent({kind:'secao',ref:'compendio'});},()=>setError('Não foi possível remover. Recarregue a versão atual.'));};
 const atual:Conhecimento=secoes?{...entry,sheet:secoes}:entry;
 const reveladas=entry.revealed??[];
 const extra=desatualizada?{sheet:secoes}:{};
 const todosVinculos=(on:boolean)=>Object.fromEntries(vinculos.links.map(l=>[l.id,on]));
 const vista=previa?.chave===chavePrevia?previa:undefined;
 return <div className="content cd-page cd-record-page"><header className="cd-page-actions"><VoltarCompendio onOpenContent={onOpenContent}/>{master&&<><button className="cd-icon" aria-label="Editar registro" onClick={()=>setEdit(true)}><Pencil size={17}/></button><MenuDeAcoes rotulo="Mais ações do registro" acoes={[{rotulo:'Editar',icone:Pencil,acao:()=>setEdit(true)},{rotulo:'Remover registro',icone:Trash2,perigo:true,acao:remove}]}/></>}</header>
 {(error||acoes.error||vinculos.error)&&<Aviso erro t={error||acoes.error||vinculos.error!}/>}
 {master&&<section className="cd-share" aria-label="Visibilidade para os jogadores">
  <p role="status">{asPlayer?'Prévia: é isto que os jogadores recebem.':entry.visible?'Publicado: os jogadores veem somente o que está marcado com o olho.':'Registro secreto: os jogadores não sabem que ele existe.'}</p>
  <div className="cd-share-actions">
   <button type="button" className="btn-secondary" aria-pressed={asPlayer} onClick={()=>setAsPlayer(v=>!v)}>{asPlayer?'Voltar à visão do mestre':'Ver como jogador'}</button>
   {!asPlayer&&<><button type="button" className="btn-secondary" disabled={acoes.busy} onClick={()=>acoes.revelar(entry,{visible:!entry.visible,...extra})}>{entry.visible?'Ocultar registro':'Publicar registro'}</button>
   <button type="button" className="btn-secondary" disabled={acoes.busy} onClick={()=>acoes.revelar(entry,{visible:true,revealed:todasAsChaves(atual),links:todosVinculos(true),...extra})}>Revelar tudo</button>
   <button type="button" className="btn-secondary" disabled={acoes.busy} onClick={()=>acoes.revelar(entry,{visible:false,revealed:[],links:todosVinculos(false),...extra})}>Ocultar tudo</button></>}
  </div>
  {!asPlayer&&entry.category==='monster'&&<div className="cd-share-actions" role="group" aria-label="Níveis do bestiário"><small className="muted">Atalhos:</small>{PRESETS_BESTIARIO.map((nome,i)=><button key={nome} type="button" className="btn-secondary" disabled={acoes.busy} onClick={()=>acoes.revelar(entry,{visible:true,revealed:presetBestiario((i+1) as 1|2|3|4,atual),...extra})}>{i+1} · {nome}</button>)}</div>}
 </section>}
 {master&&asPlayer?(vista?.error?<Aviso erro t={vista.error}/>:!vista?.data?<p role="status">Gerando prévia…</p>:!vista.data.entry?<p>Os jogadores não veem este registro.</p>:<div className="cd-preview" aria-label="Prévia do jogador" role="region"><VisaoRegistro entry={vista.data.entry} mostrarPosse={reveladas.includes('holders')} links={vista.data.links} rows={[]} onOpenContent={onOpenContent}/></div>)
 :<VisaoRegistro entry={atual} mostrarPosse links={vinculos.links} rows={data.rows} onOpenContent={onOpenContent}
   controles={master?{busy:acoes.busy,alternar:(chaves,on)=>acoes.revelar(entry,{revealed:alternarChaves(reveladas,chaves,on,atual),...extra})}:undefined}
   controlesVinculo={master?acoes.controlesVinculo(entry,extra.sheet):undefined}
   rodapeVinculos={master?<NovoVinculoBotao id={id} vinculos={vinculos}/>:undefined}/>}
 {master&&!asPlayer&&entry.category==='item'&&entry.definitionId&&<div className="cd-registrar"><EntregarItem definitionId={entry.definitionId} nome={entry.title} nomeAparente={entry.fields?.nickname}/></div>}
 {master&&!asPlayer&&entry.definitionId&&(entry.category==='monster'||entry.category==='item')&&<button type="button" className="btn-link" onClick={()=>onOpenContent(entry.category==='monster'?monstroSpec(entry.definitionId!):{kind:'item',ref:entry.definitionId!})}><ExternalLink size={15}/> Consultar definição original</button>}
 {master&&!asPlayer&&<section className="cd-private"><h2>Notas privadas do mestre</h2><p style={{whiteSpace:'pre-wrap'}}>{entry.secret||'Nenhuma nota privada.'}</p><small>Nunca são enviadas aos jogadores.</small></section>}
 {edit&&<EditorConhecimento entry={entry} category={entry.category} onDone={()=>{setEdit(false);data.refresh();}}/>}</div>;
}
export function IdentidadePagina({id,onOpenContent}:{id:string;onOpenContent:(s:TabSpec)=>void}){
 const {items,loading,error}=useIdentidades(),{active}=useCampaigns(),{user}=useAuth(),api=useRegistros();const p=items.find(x=>x.id===id);const [detail,setDetail]=useState<{scope:string;owner:string;description:string}>();const scope=`${user?.id}:${active?.campaign.id}:${id}`;
 useEffect(()=>{let alive=true;if(api&&active)void api.get(id).then(r=>{if(alive&&r.ok&&r.data?.campaignId===active.campaign.id&&r.data.visibility==='campaign'){const card=cartaoPublico(r.data.meta);setDetail({scope,owner:r.data.ownerId,description:card?.description??''});}});return()=>{alive=false;};},[api,scope]);
 if(loading)return <div className="content cd-page"><p role="status">Carregando identidade…</p></div>;
 return <div className="content cd-page"><VoltarCompendio onOpenContent={onOpenContent} label="Personagens"/>{!p?<Aviso t={error??'Identidade indisponível nesta campanha.'}/>:<><div className="cd-identity"><RetratoQuadrado src={p.retratoUrl} tipo="personagem" tamanho={100}/><div><h1>{p.nome}</h1>{p.alcunha&&<p><em>{p.alcunha}</em></p>}<p>{p.classe}</p>{p.nivel!==null&&<p>Nível {p.nivel}</p>}</div></div>{detail?.scope===scope&&detail.description&&<section><h2>Descrição</h2><p>{detail.description}</p></section>}{(active?.role==='mestre'||(detail?.scope===scope&&detail.owner===user?.id))&&<button className="btn-primary" onClick={()=>onOpenContent({kind:'ficha',ref:id,title:p.nome})}><ExternalLink size={15}/> Abrir ficha completa</button>}<RelacoesRegistro id={id} onOpenContent={onOpenContent}/></>}</div>;
}
export function RegraPagina({refId,onOpenContent}:{refId:string;onOpenContent:(s:TabSpec)=>void}){
 const ref=lerRegra(refId),[loaded,setLoaded]=useState<{ref:string;cat:CategoriaDef<unknown>;item:unknown}>(),[error,setError]=useState('');
 useEffect(()=>{let alive=true;garantirSistemaDnd5e2014();const c=ref?categoria(DND5E_2014,ref.category) as CategoriaDef<unknown>|undefined:undefined;if(c)void carregarIndice(c).then(index=>{const item=index.itens.find(x=>c.idDe(x)===ref?.id);if(alive&&item){setLoaded({ref:refId,cat:c,item});registrarTitulo(refId,c.nomeDe(item));}else if(alive)setError('Regra não encontrada.');},()=>{if(alive)setError('Não foi possível carregar a regra.');});else setError('Referência de regra inválida.');return()=>{alive=false;};},[refId]);
 const current=loaded?.ref===refId?loaded:undefined;
 return <div className="content cd-page cd-rule-page"><VoltarCompendio onOpenContent={onOpenContent}/>{current?<><h1>{current.cat.nomeDe(current.item)}</h1><Detalhe cat={current.cat} item={current.item}/></>:error?<Aviso erro t={error}/>:<p role="status">Carregando regra…</p>}</div>;
}

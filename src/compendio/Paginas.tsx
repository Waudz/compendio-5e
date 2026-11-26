import {SeletorRegistro} from "./SeletorRegistro";
import {useContext,useEffect,useState} from 'react';
import {ArrowLeft,Link2,Pencil,Plus,Trash2,ExternalLink,EyeOff} from 'lucide-react';
import {useCampaigns} from '../CampaignsContext';
import {useAuth} from '../AuthContext';
import {useRegistros} from '../RegistrosContext';
import {VoltarPaginaContext} from '../voltarPagina';
import {Aviso} from '../Diario';
import {Modal} from '../ui/Modal';
import {MenuDeAcoes} from '../ui/MenuDeAcoes';
import {useAbrirEmAba} from '../abrirEmAba';
import {RetratoQuadrado} from '../RetratoCombate';
import {deBlocos} from '../registros';
import {cartaoPublico} from '../fichas';
import {registrarTitulo} from '../registrosStore';
import {avisarConhecimento,type CodexLink} from './conhecimento';
import {EditorConhecimento,DetalheConhecido} from './RegistrosCampanha';
import {ImagemLinha} from './ComponentesCategoria';
import {useLinhasCampanha,useIdentidades,nomesCategoria,nomesRegistro} from './consulta';
import {CAMPOS} from './campos';
import {identidadeSpec,registroSpec,lerRegra} from './navegacao';
import type {TabSpec} from '../workspace';
import {carregarIndice,categoria} from '../catalogue/nucleo/registro';
import type {CategoriaDef} from '../catalogue/nucleo/tipos';
import {DND5E_2014,garantirSistemaDnd5e2014} from '../catalogue/sistemas/dnd5e-2014';
import {Detalhe} from './CompendioCatalogo';
export function VoltarCompendio({onOpenContent,label='Compêndio'}:{onOpenContent:(s:TabSpec)=>void;label?:string}){const back=useContext(VoltarPaginaContext);return <button className="cd-back" onClick={()=>back?back():onOpenContent({kind:'secao',ref:'compendio'})}><ArrowLeft size={16}/> {label}</button>;}
export function RelacoesRegistro({id,onOpenContent}:{id:string;onOpenContent:(s:TabSpec)=>void}){
 const {active}=useCampaigns(),data=useLinhasCampanha(),context=useAbrirEmAba();const [links,setLinks]=useState<{scope:string;items:CodexLink[]}>(),[error,setError]=useState(''),[open,setOpen]=useState(false),[target,setTarget]=useState(''),[relation,setRelation]=useState('Relacionado'),[query,setQuery]=useState(''),[busy,setBusy]=useState(false),[revision,setRevision]=useState(0);
 const scope=`${active?.campaign.id}:${active?.role}:${id}`;
 useEffect(()=>{let alive=true;setError('');if(data.api&&active)void data.api.links(active.campaign.id,id).then(items=>{if(alive)setLinks({scope,items});},()=>{if(alive){setLinks({scope,items:[]});setError('Não foi possível carregar os vínculos. A migração 0016 deve estar disponível.');}});return()=>{alive=false;};},[data.api,scope,revision]);
 const current=links?.scope===scope?links.items:[];
 const candidates=data.rows.filter(r=>(r.entry||r.pc)&&r.id!==id&&!current.some(l=>l.targetId===r.id));
 return <section className="cd-relations"><h2>Registros relacionados</h2>{error&&<Aviso erro t={error}/>}{!error&&links?.scope===scope&&!current.length&&<p className="muted">Nenhum registro relacionado.</p>}<ul>{current.map(link=>{const spec=link.category==='character'?identidadeSpec(link.targetId,link.title):registroSpec(link.targetId,link.title);return <li key={link.id}><button className="cd-relation" onClick={e=>{if(!context.aoClicar(e,spec))onOpenContent(spec);}} onAuxClick={e=>context.aoBotaoDoMeio(e,spec)} onMouseDown={e=>{if(e.button===1)e.preventDefault();}} onContextMenu={e=>context.aoClicarDireito(e,spec)}><Link2 size={17}/><span><strong>{link.title}</strong><small>{nomesCategoria[link.category]} · {link.relation}</small></span></button>{active?.role==='mestre'&&<button className="cd-icon" aria-label={`Remover vínculo com ${link.title}`} onClick={()=>{if(data.api&&active)void data.api.unlink(active.campaign.id,link.id).then(()=>setRevision(v=>v+1),()=>setError('Não foi possível remover o vínculo.'));}}><Trash2 size={15}/></button>}</li>;})}</ul>
 {active?.role==='mestre'&&<button className="btn-link" onClick={()=>setOpen(true)}><Plus size={15}/> Vincular registro</button>}
 {open&&<Modal titulo="Vincular registro" onFechar={()=>setOpen(false)} ocupado={busy} acoes={<button className="btn-primary" disabled={!candidates.some(row=>row.id===target)||busy||data.loading||!!data.error} onClick={()=>{if(!data.api||!active)return;setBusy(true);void data.api.link(active.campaign.id,id,target,relation).then(()=>{setOpen(false);setTarget('');setRevision(v=>v+1);},()=>setError('Não foi possível vincular. Confira a campanha e tente novamente.')).finally(()=>setBusy(false));}}>Vincular</button>}><SeletorRegistro rows={candidates} selected={target} onSelect={setTarget} query={query} onQuery={setQuery} loading={data.loading} error={data.error}/><label>Relação<input value={relation} maxLength={80} onChange={e=>setRelation(e.target.value)}/></label>{error&&<p role="alert">{error}</p>}</Modal>}
 </section>;
}
export function RegistroCompendioPagina({id,onOpenContent}:{id:string;onOpenContent:(s:TabSpec)=>void}){
 const data=useLinhasCampanha(),{active}=useCampaigns(),[edit,setEdit]=useState(false),[error,setError]=useState('');
 const row=data.rows.find(r=>r.entry?.id===id),entry=row?.entry;
 if(data.loading)return <div className="content cd-page"><p role="status">Carregando registro…</p></div>;
 if(!entry||!row)return <div className="content cd-page"><VoltarCompendio onOpenContent={onOpenContent}/><Aviso t={data.error??'Registro indisponível para esta campanha e este usuário.'}/></div>;
 const master=active?.role==='mestre';
 const remove=()=>{if(!data.api||!active||!window.confirm('Remover este registro? Os registros relacionados serão preservados.'))return;void data.api.remove(active.campaign.id,id,entry.version).then(()=>{avisarConhecimento();onOpenContent({kind:'secao',ref:'compendio'});},()=>setError('Não foi possível remover. Recarregue a versão atual.'));};
 return <div className="content cd-page cd-record-page"><header className="cd-page-actions"><VoltarCompendio onOpenContent={onOpenContent}/>{master&&<><button className="cd-icon" aria-label="Editar registro" onClick={()=>setEdit(true)}><Pencil size={17}/></button><MenuDeAcoes rotulo="Mais ações do registro" acoes={[{rotulo:'Editar',icone:Pencil,acao:()=>setEdit(true)},{rotulo:'Remover registro',icone:Trash2,perigo:true,acao:remove}]}/></>}</header>
 <div className="cd-identity"><ImagemLinha row={row} size={100}/><div><h1>{entry.title}</h1>{entry.fields?.nickname&&<p className="muted"><em>{entry.fields.nickname}</em></p>}<p>{nomesRegistro[entry.category]}{entry.fields?.identity?' · '+entry.fields.identity:''}</p>{entry.fields?.region&&<p>{entry.fields.region}</p>}{master&&<small>{entry.knowledge===0?<><EyeOff size={13}/> Não revelado aos jogadores</>:'Conhecimento compartilhado · '+entry.knowledge+'/4'}</small>}</div></div>
 {error&&<Aviso erro t={error}/>}<section className="cd-description"><h2>Descrição</h2><p style={{whiteSpace:'pre-wrap'}}>{deBlocos(entry.description??[])||'Sem descrição.'}</p></section>
 {(CAMPOS[entry.category]??[]).filter(f=>!['nickname','identity','region'].includes(f.id)&&entry.fields?.[f.id]).map(f=><section key={f.id}><h2>{f.label}</h2><p style={{whiteSpace:'pre-wrap'}}>{entry.fields?.[f.id]}</p></section>)}
 {['monster','item'].includes(entry.category)&&<div className="cd-definition"><DetalheConhecido entry={{...entry,knowledge:master?4:entry.knowledge,description:undefined,imagePath:undefined,imageDefinitionId:undefined}} onOpenContent={onOpenContent}/></div>}
 {(master||entry.knowledge>=2)&&<RelacoesRegistro id={id} onOpenContent={onOpenContent}/>}
 {master&&<section className="cd-private"><h2>Notas privadas do mestre</h2><p style={{whiteSpace:'pre-wrap'}}>{entry.secret||'Nenhuma nota privada.'}</p><small>Visíveis somente ao mestre.</small></section>}
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

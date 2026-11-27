/** Páginas de consulta do Compêndio. São o mesmo conteúdo da janela de consulta (desktop) e da página completa. */
import {useContext,useEffect,useMemo,useRef,useState} from 'react';
import {ArrowLeft,ClipboardList,Eye,Link2,Pencil,Trash2,Unlink,ExternalLink,Users2} from 'lucide-react';
import {useCampaigns} from '../CampaignsContext';
import {useAuth} from '../AuthContext';
import {useRegistros} from '../RegistrosContext';
import {VoltarPaginaContext} from '../voltarPagina';
import {OrigemAbaContext} from '../abrirEmAba';
import {Aviso} from '../Diario';
import {Modal} from '../ui/Modal';
import {MenuDeAcoes,type AcaoDeMenu} from '../ui/MenuDeAcoes';
import {RetratoQuadrado} from '../RetratoCombate';
import {SeletorMonstro} from '../CombateCompartilhado';
import {cartaoPublico} from '../fichas';
import {presentation,type PublicIdentityCard} from '../rules/public-identity';
import {registrarTitulo} from '../registrosStore';
import {avisarConhecimento,type Conhecimento,type Divulgacao,type Previa} from './conhecimento';
import {EditorConhecimento,RegistrarDescoberta} from './RegistrosCampanha';
import {VisaoRegistro} from './VisaoRegistro';
import {GerenciarConhecimento} from './GerenciarConhecimento';
import {EntregarItem} from './EntregarItem';
import {ListaVinculos,NovoVinculoBotao,useVinculos,type ControlesVinculo} from './Vinculos';
import {secoesDaDefinicao,useDefinicao,useDefinicoes} from './definicoes';
import {mesmasSecoes} from './ficha';
import {useLinhasCampanha,useIdentidades,nomesCategoria,nomesRegistro} from './consulta';
import {lerRegra,monstroSpec,npcSpec,regraSpec} from './navegacao';
import {useNaCarta} from './ConsultaCarta';
import {Carta,FatosCarta,type Fato} from './Carta';
import {definirTituloPrevia} from './tituloPrevia';
import {imagemDoMonstro} from '../ficha/imagensCatalogo';
import {rotuloTamanho,rotuloTipoCriatura} from '../catalogue/sistemas/dnd5e-2014/rotulos';
import type {TabSpec} from '../workspace';
import {carregarIndice,categoria} from '../catalogue/nucleo/registro';
import type {CategoriaDef} from '../catalogue/nucleo/tipos';
import {DND5E_2014,garantirSistemaDnd5e2014} from '../catalogue/sistemas/dnd5e-2014';
import {Detalhe} from './CompendioCatalogo';

export function VoltarCompendio({onOpenContent,label='Compêndio'}:{onOpenContent:(s:TabSpec)=>void;label?:string}){
 const back=useContext(VoltarPaginaContext),janela=useNaCarta();
 if(janela)return null;   // a janela de consulta fecha pelo próprio cabeçalho
 return <button className="cd-back" onClick={()=>back?back():onOpenContent({kind:'secao',ref:'compendio'})}><ArrowLeft size={16}/> {label}</button>;
}
/** Vínculos de um aventureiro: a divulgação é feita pela ponta que é registro do Compêndio. */
export function RelacoesRegistro({id,onOpenContent}:{id:string;onOpenContent:(s:TabSpec)=>void}){
 const dados=useLinhasCampanha(),vinculos=useVinculos(id,dados),{active}=useCampaigns(),acoes=useDivulgacao(vinculos),[editar,setEditar]=useState(false);
 const master=active?.role==='mestre';
 if(!master&&!vinculos.links.length&&!vinculos.error)return null;
 return <section className="cd-relations" aria-label="Registros relacionados">{vinculos.links.length>0&&<h2>Registros relacionados</h2>}{(vinculos.error||acoes.error)&&<Aviso erro t={vinculos.error??acoes.error!}/>}
 <ListaVinculos links={vinculos.links} rows={vinculos.data.rows} onOpenContent={onOpenContent} controles={master&&editar?acoes.controlesVinculo:undefined}/>
 {master&&<div className="cd-share-actions"><NovoVinculoBotao id={id} vinculos={vinculos}/>{vinculos.links.length>0&&<button type="button" className="btn-link" aria-pressed={editar} onClick={()=>setEditar(v=>!v)}>{editar?'Concluir':'Remover vínculos'}</button>}</div>}</section>;
}
/** Operações de divulgação: uma por vez, até a projeção recarregada trazer a nova versão. */
function useDivulgacao(vinculos:ReturnType<typeof useVinculos>){
 const {active}=useCampaigns(),{api,items}=vinculos.data;
 const [pending,setPending]=useState<{items:unknown}>(),[error,setError]=useState('');
 const busy=!!pending&&pending.items===items;
 const executar=(op:()=>Promise<unknown>,depois?:()=>void)=>{if(busy)return;setPending({items});setError('');void op().then(()=>{depois?.();vinculos.reload();avisarConhecimento();},e=>{setPending(undefined);setError(e instanceof Error?e.message:'Não foi possível alterar a visibilidade.');avisarConhecimento();});};
 const revelar=(entry:Conhecimento,data:Partial<Divulgacao>,depois?:()=>void)=>{if(!api||!active)return;executar(()=>api.reveal(active.campaign.id,entry.id,entry.version,{visible:entry.visible,revealed:entry.revealed??[],...data}),depois);};
 const controlesVinculo:ControlesVinculo={busy,onRemover:link=>{if(api&&active&&window.confirm(`Remover o vínculo com ${link.title}? Os registros são preservados.`))executar(()=>api.unlink(active.campaign.id,link.id));}};
 return {busy,error,revelar,executar,controlesVinculo};
}
const SeletorPapel=({jogador,onTrocar}:{jogador:boolean;onTrocar:(v:boolean)=>void})=><span className="carta-papel" role="group" aria-label="Visualizar como">
 <button type="button" aria-pressed={!jogador} onClick={()=>onTrocar(false)}>Mestre</button><button type="button" aria-pressed={jogador} onClick={()=>onTrocar(true)}>Jogador</button></span>;

export function RegistroCompendioPagina({id,onOpenContent,semFicha=false}:{id:string;onOpenContent:(s:TabSpec)=>void;/** Já está dentro da ficha deste registro. */semFicha?:boolean}){
 const data=useLinhasCampanha(),{active}=useCampaigns(),[edit,setEdit]=useState(false),[error,setError]=useState(''),[asPlayer,setAsPlayer]=useState(false),[gerenciando,setGerenciando]=useState(false),[escolhendo,setEscolhendo]=useState(false);
 const vinculos=useVinculos(id,data),acoes=useDivulgacao(vinculos),semDefinicoes=useDefinicoes().indisponivel;
 const origem=useContext(OrigemAbaContext)??'secao:compendio';
 const row=data.rows.find(r=>r.entry?.id===id),entry=row?.entry;
 const master=active?.role==='mestre';
 useEffect(()=>{if(entry)registrarTitulo(id,entry.title);},[id,entry?.title]);
 // A ficha enviada ao servidor acompanha a definição atual; divergências são regravadas na próxima divulgação.
 const definicao=useDefinicao(entry?.category??'',master&&entry?.category==='item'?entry.definitionId:undefined,entry?.systemId);
 const secoes=useMemo(()=>definicao&&!semDefinicoes?secoesDaDefinicao(definicao):undefined,[definicao,semDefinicoes]);
 const desatualizada=!!secoes&&!!entry&&!mesmasSecoes(secoes,entry.sheet);
 const tentativa=useRef('');
 useEffect(()=>{const chave=`${id}:${entry?.version}`;if(master&&entry&&desatualizada&&tentativa.current!==chave){tentativa.current=chave;acoes.revelar(entry,{sheet:secoes});}},[master,desatualizada,entry?.version]);
 const [previa,setPrevia]=useState<{chave:string;data?:Previa;error?:string}>();
 const chavePrevia=`${active?.campaign.id}:${id}:${entry?.version}:${JSON.stringify(vinculos.links.map(l=>[l.id,l.revealed]))}`;
 useEffect(()=>{let alive=true;if(asPlayer&&master&&data.api&&active)void data.api.preview(active.campaign.id,id).then(value=>{if(alive)setPrevia({chave:chavePrevia,data:value});},()=>{if(alive)setPrevia({chave:chavePrevia,error:'Não foi possível gerar a prévia.'});});return()=>{alive=false;};},[asPlayer,chavePrevia]);
 const vista=previa?.chave===chavePrevia?previa:undefined;
 const naCarta=!!useNaCarta();
 const tituloNaPrevia=asPlayer&&!naCarta?vista?.data?.entry?.title??'Prévia do jogador':null;
 useEffect(()=>{definirTituloPrevia(id,tituloNaPrevia);return()=>definirTituloPrevia(id,null);},[id,tituloNaPrevia]);
 if(data.loading&&!entry)return <div className="content cd-page"><p role="status">Carregando registro…</p></div>;
 if(!entry||!row)return <div className="content cd-page"><VoltarCompendio onOpenContent={onOpenContent}/><Aviso t={data.error??'Registro indisponível para esta campanha e este usuário.'}/></div>;
 const remove=()=>{if(!data.api||!active||!window.confirm('Remover este registro? Os registros relacionados serão preservados.'))return;void data.api.remove(active.campaign.id,id,entry.version).then(()=>{avisarConhecimento();onOpenContent({kind:'secao',ref:'compendio'});},()=>setError('Não foi possível remover. Recarregue a versão atual.'));};
 const atual:Conhecimento=secoes?{...entry,sheet:secoes}:entry;
 const extra=desatualizada?{sheet:secoes}:{};
 const ficha=semFicha?undefined:entry.category==='monster'&&entry.definitionId&&entry.systemId==='dnd5e-2014'?monstroSpec(entry.definitionId,entry.title):entry.category==='npc'&&entry.combatDefinitionId?npcSpec(entry.id,entry.title):undefined;
 const ficharNpc=(definicao:string|null)=>{if(data.api?.setCombatSheet&&active)acoes.executar(()=>data.api!.setCombatSheet!(active.campaign.id,id,entry.version,definicao));};
 const menu:AcaoDeMenu[]=[
  ...(entry.category==='npc'&&data.api?.setCombatSheet?[{rotulo:entry.combatDefinitionId?'Trocar ficha de combate':'Vincular ficha de combate',icone:Link2,acao:()=>setEscolhendo(true)},
   ...(entry.combatDefinitionId?[{rotulo:'Desvincular ficha de combate',icone:Unlink,acao:()=>{if(window.confirm('Desvincular a ficha de combate deste NPC? A criatura continua no Bestiário.'))ficharNpc(null);}}]:[])]:[]),
  ...(entry.definitionId&&entry.category==='item'?[{rotulo:'Consultar definição original',icone:ExternalLink,acao:()=>onOpenContent({kind:'item',ref:entry.definitionId!})}]:[]),
  {rotulo:'Remover registro',icone:Trash2,perigo:true,acao:remove},
 ];
 const trilhaMestre=entry.category==='item'?nomesCategoria.item:`${nomesCategoria[entry.category]} / ${nomesRegistro[entry.category]}`;
 const botoes=master?<>
  {ficha&&<button type="button" className="btn-primary" onClick={()=>onOpenContent(ficha)}><ClipboardList size={14} aria-hidden="true"/> Ver ficha</button>}
  <button type="button" className="btn-secondary" aria-label="Editar registro" onClick={()=>setEdit(true)}><Pencil size={14} aria-hidden="true"/> Editar</button>
  <button type="button" className="btn-secondary" aria-label="Gerenciar conhecimento" onClick={()=>setGerenciando(true)}><Eye size={14} aria-hidden="true"/> Conhecimento</button>
  <button type="button" className="btn-secondary" aria-label="Ver como jogador" onClick={()=>setAsPlayer(true)}><Users2 size={14} aria-hidden="true"/> Prévia</button>
  {entry.category==='item'&&entry.definitionId&&<EntregarItem definitionId={entry.definitionId} nome={entry.title} nomeAparente={entry.fields?.nickname}/>}
  <MenuDeAcoes rotulo="Mais ações do registro" acoes={menu}/>
 </>:undefined;
 return <div className="content cd-page cd-record-page"><VoltarCompendio onOpenContent={onOpenContent}/>
 {(error||acoes.error||vinculos.error)&&<Aviso erro t={error||acoes.error||vinculos.error!}/>}
 {master&&asPlayer?(vista?.data?.entry
   ?<div className="cd-preview" aria-label="Prévia do jogador" role="region"><VisaoRegistro entry={vista.data.entry} versaoPosse={entry} mostrarPosse={!!entry.revealed?.includes('holders')} links={vista.data.links} rows={[]} trilha={nomesCategoria[vista.data.entry.category]} topo={<SeletorPapel jogador onTrocar={setAsPlayer}/>} onOpenContent={onOpenContent}/></div>
   :<Carta trilha="Prévia do jogador" topo={<SeletorPapel jogador onTrocar={setAsPlayer}/>} nome="Prévia do jogador" rotulo="Prévia do jogador">{vista?.error?<Aviso erro t={vista.error}/>:!vista?.data?<p role="status">Gerando prévia…</p>:<p>Os jogadores não veem este registro.</p>}</Carta>)
 :master&&gerenciando?<GerenciarConhecimento entry={atual} links={vinculos.links} busy={acoes.busy} origem={origem} onCancelar={()=>setGerenciando(false)} onSalvar={r=>acoes.revelar(entry,{...r,...extra},()=>setGerenciando(false))}/>
 :<VisaoRegistro entry={atual} mostrarPosse links={vinculos.links} rows={data.rows} onOpenContent={onOpenContent} trilha={master?trilhaMestre:nomesCategoria[entry.category]} acoes={botoes} privado={master}
   rodapeVinculos={master?<NovoVinculoBotao id={id} vinculos={vinculos}/>:undefined}/>}
 {escolhendo&&<Modal titulo={`Ficha de combate de ${entry.title}`} onFechar={()=>setEscolhendo(false)} largura={520}>
   <p className="muted">Reutiliza uma criatura do Bestiário ou criada nesta campanha. Os jogadores não recebem a ficha.</p>
   <SeletorMonstro rotulo="Bestiário" acao="Vincular" onEscolher={m=>{setEscolhendo(false);ficharNpc(m.id);}}/>
 </Modal>}
 {edit&&<EditorConhecimento entry={entry} category={entry.category} onDone={()=>{setEdit(false);vinculos.reload();data.refresh();}}/>}</div>;
}

/** Identidade pública de um aventureiro: a mesma carta no Compêndio e na página inicial. É a projeção do personagem. */
export function IdentidadePagina({id,onOpenContent}:{id:string;onOpenContent:(s:TabSpec)=>void}){
 const {items,loading,error}=useIdentidades(),{active}=useCampaigns(),{user}=useAuth(),api=useRegistros();const p=items.find(x=>x.id===id);
 const [detail,setDetail]=useState<{scope:string;owner?:string;card:PublicIdentityCard|null}>();const scope=`${user?.id}:${active?.campaign.id}:${id}`;
 useEffect(()=>{let alive=true;if(api&&active)void api.get(id).then(r=>{if(!alive)return;const reg=r.ok&&r.data?.campaignId===active.campaign.id?r.data:null;setDetail({scope,owner:reg?.ownerId,card:reg&&(reg.visibility==='campaign'||reg.ownerId===user?.id)?cartaoPublico(reg.meta):null});},()=>{if(alive)setDetail({scope,card:null});});return()=>{alive=false;};},[api,scope]);
 useEffect(()=>{if(p)registrarTitulo(id,p.nome);},[id,p?.nome]);
 if(loading||(!!api&&detail?.scope!==scope))return <div className="content cd-page"><p role="status">Carregando identidade…</p></div>;
 const atual=detail?.scope===scope?detail:undefined,card=atual?.card??null;
 const visto=card?presentation(card):p?{nome:p.nome,alcunha:p.alcunha??null}:null;
 const podeFicha=active?.role==='mestre'||!!p?.meu||(!!atual?.owner&&atual.owner===user?.id);
 const fatos:Fato[]=(card?[['race','Raça',card.race],['class','Classe',card.characterClass],['level','Nível',card.level]]:[['class','Classe',p?.classe],['level','Nível',p?.nivel!=null?String(p.nivel):null]])
  .flatMap(([k,rotulo,valor])=>valor?[{k:k!,rotulo:rotulo!,valor}]:[]);
 const descricao=card?card.description:p?.descricao??'';
 return <div className="content cd-page"><VoltarCompendio onOpenContent={onOpenContent} label="Personagens"/>
  {!p||!visto?<Aviso t={error??'Identidade indisponível nesta campanha.'}/>:<Carta trilha="Personagens / Aventureiro" nome={visto.nome} alcunha={visto.alcunha} rotulo={`Identidade pública de ${visto.nome}`}
   imagem={<RetratoQuadrado src={card?card.imageUrl:p.retratoUrl} tipo="personagem" tamanho={200}/>}
   acoes={podeFicha?<button type="button" className="btn-primary" onClick={()=>onOpenContent({kind:'ficha',ref:id,title:p.nome})}><ClipboardList size={14} aria-hidden="true"/> Ver ficha</button>:undefined}>
   <FatosCarta fatos={fatos}/>
   {descricao&&<p className="cd-texto">{descricao}</p>}
   {active?.role==='mestre'&&!card&&p.nota&&<p className="muted">Identidade pública indisponível ({p.nota}).</p>}
   <RelacoesRegistro id={id} onOpenContent={onOpenContent}/>
  </Carta>}</div>;
}

/** Carta de uma criatura do catálogo. Com página na campanha, é a própria carta do registro. */
function CriaturaDoBestiario({id,onOpenContent}:{id:string;onOpenContent:(s:TabSpec)=>void}){
 const data=useLinhasCampanha(true),{active}=useCampaigns();
 const entry=data.items.find(e=>e.category==='monster'&&e.systemId==='dnd5e-2014'&&e.definitionId===id&&e.registered!==false);
 const definicao=useDefinicao('monster',active?.role==='mestre'?id:undefined);
 useEffect(()=>{if(definicao&&!entry)registrarTitulo(regraSpec('bestiario',id).ref,definicao.nome);},[definicao?.nome]);
 if(entry)return <RegistroCompendioPagina id={entry.id} onOpenContent={onOpenContent}/>;
 const m=definicao?.kind==='monster'?definicao.monstro:undefined;
 return <div className="content cd-page"><VoltarCompendio onOpenContent={onOpenContent} label="Bestiário"/>
  {active?.role!=='mestre'?<Aviso t={data.loading?'Verificando conhecimento…':'Criatura não revelada nesta campanha.'}/>:!m?<p role="status">Carregando criatura…</p>
  :<Carta trilha="Bestiário / Criatura" nome={m.nome} linha={`${rotuloTipoCriatura(m.tipo)} · ${rotuloTamanho(m.tamanho)}`}
    imagem={<RetratoQuadrado src={imagemDoMonstro(id)} tipo="monstro" tamanho={200}/>}
    acoes={<><button type="button" className="btn-primary" onClick={()=>onOpenContent(monstroSpec(id,m.nome))}><ClipboardList size={14} aria-hidden="true"/> Ver ficha</button><RegistrarDescoberta category="monster" id={id} onOpenContent={onOpenContent}/></>}>
    <p className="muted">Esta criatura ainda não tem história registrada na campanha. Os jogadores não a veem.</p>
  </Carta>}</div>;
}

export function RegraPagina({refId,onOpenContent}:{refId:string;onOpenContent:(s:TabSpec)=>void}){
 const ref=lerRegra(refId);
 return ref?.category==='bestiario'?<CriaturaDoBestiario id={ref.id} onOpenContent={onOpenContent}/>:<RegraDoCatalogo refId={refId} onOpenContent={onOpenContent}/>;
}
function RegraDoCatalogo({refId,onOpenContent}:{refId:string;onOpenContent:(s:TabSpec)=>void}){
 const ref=lerRegra(refId),[loaded,setLoaded]=useState<{ref:string;cat:CategoriaDef<unknown>;item:unknown}>(),[error,setError]=useState('');
 useEffect(()=>{let alive=true;garantirSistemaDnd5e2014();const c=ref?categoria(DND5E_2014,ref.category) as CategoriaDef<unknown>|undefined:undefined;if(c)void carregarIndice(c).then(index=>{const item=index.itens.find(x=>c.idDe(x)===ref?.id);if(alive&&item){setLoaded({ref:refId,cat:c,item});registrarTitulo(refId,c.nomeDe(item));}else if(alive)setError('Regra não encontrada.');},()=>{if(alive)setError('Não foi possível carregar a regra.');});else setError('Referência de regra inválida.');return()=>{alive=false;};},[refId]);
 const current=loaded?.ref===refId?loaded:undefined;
 return <div className="content cd-page cd-rule-page"><VoltarCompendio onOpenContent={onOpenContent}/>{current?<Carta trilha={`Regras / ${current.cat.rotulo}`} nome={current.cat.nomeDe(current.item)} rotulo={`Regra: ${current.cat.nomeDe(current.item)}`}><Detalhe cat={current.cat} item={current.item}/></Carta>:error?<Aviso erro t={error}/>:<p role="status">Carregando regra…</p>}</div>;
}

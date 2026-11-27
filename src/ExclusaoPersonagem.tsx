import {useEffect,useRef,useState} from "react";
import {useAuth} from "./AuthContext";
import {useCampaigns} from "./CampaignsContext";
import {useFichas} from "./RegistrosContext";
import {limparRecuperacao} from "./criador/recuperacao";
import {Modal} from "./ui/Modal";
import {publicarExclusao} from "./registrosStore";
import {avisarConhecimento} from "./compendio/conhecimento";
export const PERSONAGEM_EXCLUIDO="compendio:personagem-excluido";
export type AlvoExclusao={id:string;nome:string;revisao:number|null};
export function useExclusaoPersonagem(){
 const api=useFichas(),{user}=useAuth(),{active}=useCampaigns(),scope=`${user?.id}:${active?.campaign.id}`;
 const current=useRef(scope);current.current=scope;
 const [target,setTarget]=useState<(AlvoExclusao&{operation:string})|null>(null),[name,setName]=useState(""),[error,setError]=useState(""),[busy,setBusy]=useState(false);
 useEffect(()=>{setTarget(null);setName("");setError("");setBusy(false);},[scope]);
 const solicitar=(value:AlvoExclusao)=>{setTarget({...value,operation:crypto.randomUUID()});setName("");setError("");};
 const excluir=async()=>{
  if(!api||!target||busy||name!==target.nome)return;setBusy(true);setError("");
  try{
   const r=await api.excluir(target.id,target.revisao,target.nome,target.operation);
   if(current.current!==scope)return;
   if(!r.ok){setError(r.error);return;}
   if(user&&active)limparRecuperacao(user.id,active.campaign.id,target.id);
   setTarget(null);publicarExclusao(target.id,"exclusao-personagem");avisarConhecimento();
   window.dispatchEvent(new CustomEvent(PERSONAGEM_EXCLUIDO,{detail:{id:target.id,campaignId:active?.campaign.id}}));
  }catch{if(current.current===scope)setError("Não foi possível confirmar a exclusão. Confira sua conexão e tente novamente.");}
  finally{if(current.current===scope)setBusy(false);}
 };
 const dialog=target&&<Modal titulo="Excluir personagem" onFechar={()=>setTarget(null)} ocupado={busy} acoes={<><button className="btn-secondary" disabled={busy} onClick={()=>setTarget(null)}>Cancelar</button><button className="btn-secondary danger" disabled={busy||name!==target.nome} onClick={()=>void excluir()}>{busy?"Excluindo…":"Excluir personagem"}</button></>}>
  <p>Excluir <strong>{target.nome}</strong> desta campanha?</p>
  <p>A ficha e o inventário sairão das listas. Os vínculos deixarão de aparecer e as abas serão fechadas. O histórico da campanha e os PV do combate serão preservados. Alterações não salvas serão descartadas. Não há restauração pelo aplicativo.</p>
  <label>Digite o nome do personagem para confirmar<input value={name} disabled={busy} onChange={e=>setName(e.target.value)} autoComplete="off"/></label>
  {error&&<p role="alert">{error}</p>}
 </Modal>;
 return {solicitar,dialog,disponivel:!!api};
}

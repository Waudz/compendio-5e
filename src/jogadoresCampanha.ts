import {useEffect,useState} from "react";
import {useAuth} from "./AuthContext";
import {useCampaigns} from "./CampaignsContext";
import {PERFIL_ATUALIZADO} from "./profiles";
/** Só nomes públicos já autorizados pela API de participantes. Nunca usa e-mail. */
export function useJogadoresCampanha(){
 const {api,active}=useCampaigns(),{user}=useAuth(),scope=`${user?.id}:${active?.campaign.id}`;
 const [version,setVersion]=useState(0),[state,setState]=useState<{scope:string;names:Map<string,string>}>();
 useEffect(()=>{const refresh=()=>setVersion(v=>v+1);window.addEventListener(PERFIL_ATUALIZADO,refresh);return()=>window.removeEventListener(PERFIL_ATUALIZADO,refresh);},[]);
 useEffect(()=>{let alive=true;if(api&&active&&typeof api.members==='function')void api.members(active.campaign.id).then(r=>{if(alive)setState({scope,names:new Map(r.ok?r.data.map(m=>[m.user_id,m.display_name]):[])});},()=>{if(alive)setState({scope,names:new Map()});});return()=>{alive=false;};},[api,scope,version]);
 return (id:string|undefined)=>id&&state?.scope===scope?state.names.get(id):undefined;
}

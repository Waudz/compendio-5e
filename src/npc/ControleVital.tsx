import {useState} from "react";
import {Modal} from "../ui/Modal";
import {MenuDeAcoes,type AcaoDeMenu} from "../ui/MenuDeAcoes";
import {SecaoNarrativa} from "../ui/SecaoNarrativa";
// Estado vital (vivo, morto, desconhecido): pertence à identidade, separado de PV e condições. Ícones neutros com texto.
import { CircleHelp, Heart, Skull,Pencil } from "lucide-react";
import { rotuloVital, useVidas, VITALIDADES, type EstadoVitalidade } from "./estado";

const ICONES = { vivo: Heart, morto: Skull, desconhecido: CircleHelp } as const;
export function RotuloVital({ estado }: { estado: EstadoVitalidade }) {
  const Icone = ICONES[estado];
  return <span className="rotulo-vital"><Icone size={13} aria-hidden="true"/> {rotuloVital(estado)}</span>;
}
/** Escolha do mestre. Não aparece enquanto o banco não aceita o estado vital. */
export function ControleVital({ noteId, atual,acoes=[] }: { acoes?:AcaoDeMenu[];noteId: string; /** Quando a página já traz o estado do servidor. */ atual?: EstadoVitalidade }) {
  const vidas = useVidas();
  const [aberto,setAberto]=useState(false),[rascunho,setRascunho]=useState<EstadoVitalidade>("vivo"),[salvando,setSalvando]=useState(false);
  if (!vidas.disponivel) return null;
  const estado = vidas.mapa.get(noteId)?.estado ?? atual ?? "vivo";
  return <><MenuDeAcoes rotulo="Ações da identidade" acoes={[{rotulo:'Editar identidade',icone:Pencil,acao:()=>{setRascunho(estado);setAberto(true);}},...acoes]}/>
    {aberto&&<Modal titulo="Editar identidade" onFechar={()=>setAberto(false)} ocupado={salvando} acoes={<><button type="button" className="btn-primary" disabled={salvando} onClick={async()=>{
      if(rascunho==='morto'&&estado!=='morto'&&!window.confirm('Confirmar morte? A ficha, os PV e as condições serão preservados.'))return;
      setSalvando(true);const ok=rascunho===estado||await vidas.definir(noteId,rascunho);setSalvando(false);if(ok)setAberto(false);
    }}>Salvar</button><button type="button" className="btn-secondary" disabled={salvando} onClick={()=>setAberto(false)}>Cancelar</button></>}>
      <SecaoNarrativa titulo="Identidade"><label>Estado vital<select value={rascunho} onChange={e=>setRascunho(e.target.value as EstadoVitalidade)}>{VITALIDADES.map(([v,r])=><option key={v} value={v}>{r}</option>)}</select></label></SecaoNarrativa>
      {vidas.erro&&<p role="alert">{vidas.erro}</p>}
    </Modal>}
  </>;
}

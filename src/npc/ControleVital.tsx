// Estado vital (vivo, morto, desconhecido): pertence à identidade, separado de PV e condições. Ícones neutros com texto.
import { CircleHelp, Heart, Skull } from "lucide-react";
import { rotuloVital, useVidas, VITALIDADES, type EstadoVitalidade } from "./estado";

const ICONES = { vivo: Heart, morto: Skull, desconhecido: CircleHelp } as const;
export function RotuloVital({ estado }: { estado: EstadoVitalidade }) {
  const Icone = ICONES[estado];
  return <span className="rotulo-vital"><Icone size={13} aria-hidden="true"/> {rotuloVital(estado)}</span>;
}
/** Escolha do mestre. Não aparece enquanto o banco não aceita o estado vital. */
export function ControleVital({ noteId, atual }: { noteId: string; /** Quando a página já traz o estado do servidor. */ atual?: EstadoVitalidade }) {
  const vidas = useVidas();
  if (!vidas.disponivel) return null;
  const estado = vidas.mapa.get(noteId)?.estado ?? atual ?? "vivo";
  return <span className="controle-vital">
    <label>Estado vital <select aria-label="Estado vital" value={estado} onChange={e => void vidas.definir(noteId, e.target.value as EstadoVitalidade)}>{VITALIDADES.map(([v, r]) => <option key={v} value={v}>{r}</option>)}</select></label>
    {vidas.erro && <span role="alert" className="muted">{vidas.erro}</span>}
  </span>;
}

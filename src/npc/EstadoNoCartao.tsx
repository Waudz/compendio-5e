// Estado compacto num cartão de Personagens: PV, temporários, condições e estado vital, lidos da MESMA fonte da ficha.
// Uma linha só (o cartão não muda de altura). 0 PV aparece como "caído"; morte é o estado vital.
import type { LinhaVital } from "../vitais/loja";
import { RotuloVital } from "./ControleVital";
import type { EstadoVitalidade } from "./estado";

export function EstadoNoCartao({ vital, maximo, vitalidade }: { vital?: LinhaVital; maximo?: number; vitalidade: EstadoVitalidade }) {
  const pv = vital && maximo ? `PV ${Math.min(maximo, vital.pv)}/${maximo}` : null;
  const texto = [pv && vital!.temp ? `${pv} (+${vital!.temp})` : pv, vital && vital.pv === 0 && vitalidade !== "morto" ? "caído" : null, ...(vital?.condicoes ?? [])].filter(Boolean).join(" · ");
  return <span className="cd-estado" title={texto || undefined}>{vitalidade !== "vivo" && <RotuloVital estado={vitalidade}/>}{vitalidade !== "vivo" && texto ? " · " : ""}{texto || (vitalidade === "vivo" ? " " : "")}</span>;
}

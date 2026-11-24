import { RetratoQuadrado } from "./RetratoCombate";
import type { EstadoCombate } from "./combate";

export function FaixaTurnos({ ordem, turno, retratos }: { ordem: EstadoCombate["combatentes"]; turno: EstadoCombate["turno"]; retratos: ReadonlyMap<string,string> }) {
  const atual = ordem.findIndex(c => c.id === turno);
  if (atual < 0) return null;
  const anteriores = ordem.slice(Math.max(0, atual - 3), atual);
  const seguintes = ordem.slice(atual + 1, atual + 4);
  const retrato = (c: typeof ordem[number], ativo = false) => <div key={c.id} className={ativo ? "faixa-personagem ativo" : "faixa-personagem"} title={c.nome}><RetratoQuadrado tipo={c.ref?.tipo ?? "avulso"} src={c.ref?.tipo === "personagem" ? retratos.get(c.ref.id) : undefined} tamanho={ativo ? 58 : 40}/><small>{c.nome}</small><span>{c.iniciativa}</span></div>;
  return <div className="faixa-turnos" aria-label="Sequência visual de turnos"><div className="faixa-passados">{anteriores.map(c => retrato(c))}</div>{retrato(ordem[atual], true)}<div className="faixa-proximos">{seguintes.map(c => retrato(c))}</div></div>;
}

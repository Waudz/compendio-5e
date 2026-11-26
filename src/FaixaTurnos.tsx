import { RetratoQuadrado } from "./RetratoCombate";
import { imagemDoMonstro } from "./ficha/imagensCatalogo";
import type { EstadoCombate } from "./combate";

/** A trilha inteira se move; os cartões mantêm a identidade entre turnos. */
export function FaixaTurnos({ ordem, turno, retratos }: { ordem: EstadoCombate["combatentes"]; turno: EstadoCombate["turno"]; retratos: ReadonlyMap<string, string> }) {
  const atual = ordem.findIndex(c => c.id === turno);
  if (atual < 0) return null;
  return <div className="faixa-turnos" aria-label="Sequência visual de turnos"><div className="faixa-trilha" style={{ transform: `translateX(calc(50% - var(--faixa-passo) * ${atual + 0.5}))` }}>{ordem.map((c, i) => <div key={c.id} className={`faixa-personagem${i === atual ? " ativo" : i < atual ? " passado" : ""}${c.pvMax && c.pv === 0 ? " derrotado" : ""}`} aria-current={i === atual ? "step" : undefined} title={c.nome}><RetratoQuadrado tipo={c.ref?.tipo ?? "avulso"} src={c.ref?.tipo === "personagem" ? retratos.get(c.ref.id) : c.ref?.tipo === "monstro" ? imagemDoMonstro(c.ref.id) : undefined} tamanho={60}/><small>{c.nome}</small><span>{c.iniciativa}</span></div>)}</div></div>;
}

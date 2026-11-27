// NPCs com ficha como combatentes ou participantes. Com ficha de personagem, entram como personagem (PV pelas regras da ficha);
// com ficha de criatura, como `npc`. Mortos ficam de fora, a menos que o mestre peça.
import { useState } from "react";
import { useFichas } from "../RegistrosContext";
import { Aviso } from "../Diario";
import { PesquisaCatalogo } from "../PesquisaCatalogo";
import { useConhecimento, type Conhecimento } from "../compendio/conhecimento";
import { lerPvFicha } from "../pvFicha";
import type { Monstro } from "../catalogue/sistemas/dnd5e-2014/esquemas";
import { temFicha, useBancoDeNpcs, useCriaturasDeNpc, useVidas } from "./estado";

const sem = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLocaleLowerCase("pt-BR");
export type NpcEscolhido =
  | { id: string; nome: string; tipo: "personagem"; pvMax: number; pvAtual: number }
  | { id: string; nome: string; tipo: "npc"; pvMax: number; pvAtual: number; ca: number; destreza: number };

export function SeletorNpc({ onEscolher, buscaControlada, ocultarVazio = false }: { onEscolher: (n: NpcEscolhido) => void; buscaControlada?: string; ocultarVazio?: boolean }) {
  const banco = useBancoDeNpcs(), conhecimento = useConhecimento(), fichas = useFichas();
  const criaturas = useCriaturasDeNpc(banco), vidas = useVidas(banco);
  const [buscaLocal, setBusca] = useState(""), [mortos, setMortos] = useState(false), [lendo, setLendo] = useState(false), [aviso, setAviso] = useState<string | null>(null);
  if (!banco) return null;
  const busca = buscaControlada ?? buscaLocal;
  const comFicha = conhecimento.items.filter(temFicha);
  const achados = comFicha.filter(e => (mortos || vidas.estadoDe(e.id) !== "morto") && sem(e.title).includes(sem(busca)));
  const haMortos = comFicha.some(e => vidas.estadoDe(e.id) === "morto");
  if (ocultarVazio && !achados.length) return null;
  const escolher = async (e: Conhecimento) => {
    setAviso(null);
    if (e.characterSheet) {
      if (!fichas) { setAviso("Ficha indisponível. Não foi possível adicionar o NPC."); return; }
      setLendo(true);
      const r = await lerPvFicha(fichas, e.id);
      setLendo(false);
      if (r.ok) onEscolher({ id: e.id, nome: e.title, tipo: "personagem", pvMax: r.dados.max, pvAtual: r.dados.atual });
      else setAviso(`Não foi possível adicionar ${e.title}: ${r.erro}`);
      return;
    }
    const m: Monstro | undefined = criaturas.get(e.id);
    if (!m) { setAviso("A ficha deste NPC ainda está carregando."); return; }
    onEscolher({ id: e.id, nome: e.title, tipo: "npc", pvMax: m.pv, pvAtual: Math.min(m.pv, vidas.mapa.get(e.id)?.pv ?? m.pv), ca: m.ca, destreza: m.atributos.dex });
  };
  return <section className="ini-seletor" aria-label="Adicionar NPC da campanha">
    <strong>NPCs com ficha</strong>
    {aviso && <Aviso erro t={aviso}/>}
    {!comFicha.length ? <p className="muted">Nenhum NPC com ficha nesta campanha.</p> : <>
      <PesquisaCatalogo somenteResultados={buscaControlada !== undefined} rotulo="Buscar NPC" valor={busca} onChange={setBusca} minimo={0} vazio={!achados.length}
        resultados={achados.slice(0, 8).map(e => <li key={e.id}><button type="button" className="btn-secondary" disabled={lendo} onClick={() => void escolher(e)} aria-label={`Adicionar ${e.title}`}>{e.title}{vidas.estadoDe(e.id) === "morto" ? " (morto)" : ""}</button></li>)}/>
      {haMortos && <label className="cd-check"><input type="checkbox" checked={mortos} onChange={e => setMortos(e.target.checked)}/> Incluir mortos</label>}
    </>}
  </section>;
}

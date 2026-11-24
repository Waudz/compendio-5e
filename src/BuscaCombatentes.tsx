import { useState, type ReactNode } from "react";
import { SeletorMonstro, SeletorPersonagem } from "./CombateCompartilhado";
import { SeletorEncontro } from "./SeletorEncontro";
import type { Encontro } from "./combate";
import type { Monstro } from "./catalogue/sistemas/dnd5e-2014/esquemas";

const abas = ["Todos", "Personagens", "Bestiário", "Encontros preparados", "Combatente avulso"] as const;
const normalizar = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR");
export function BuscaCombatentes({ campaignId, encontros, monstro, personagem, enviar, avulso }: {
  campaignId: string; encontros: readonly Encontro[] | null; monstro: (m: Monstro) => void;
  personagem: (p: { id: string; nome: string }, max?: number, atual?: number) => void;
  enviar: (enc: Encontro) => void; avulso: ReactNode;
}) {
  const [aba, setAba] = useState<typeof abas[number]>("Todos"), [busca, setBusca] = useState(""), [aberto, setAberto] = useState(false);
  const [selecionado, setSelecionado] = useState<Encontro | null>(null);
  const visivel = (v: typeof aba) => aba === "Todos" || aba === v;
  return <section className="ini-busca-unica" aria-label="Adicionar ao combate">
    <div className="ini-fontes" role="group" aria-label="Fontes de combatentes">{abas.map(v => <button key={v} type="button" className="btn-secondary" aria-pressed={aba === v} onClick={() => { setAba(v); setAberto(true); }}>{v}</button>)}</div>
    {aba === "Combatente avulso" ? <><p className="muted">Crie um combatente que não está no catálogo.</p>{avulso}</> : <div className="pesquisa-catalogo" onFocus={() => setAberto(true)} onBlur={e => { if (!e.currentTarget.contains(e.relatedTarget)) setAberto(false); }} onKeyDown={e => { if (e.key === "Escape") { setAberto(false); e.stopPropagation(); } }}>
      <label>Buscar combatentes<input type="search" value={busca} placeholder="Personagens, monstros ou encontros…" onChange={e => { setBusca(e.target.value); setAberto(true); }}/></label>
      {aberto && <div className="pesquisa-resultados ini-resultados-unicos">
        {visivel("Personagens") && <SeletorPersonagem key={campaignId} campaignId={campaignId} buscaControlada={busca} onEscolher={personagem}/>}
        {visivel("Bestiário") && <SeletorMonstro rotulo="Bestiário" buscaControlada={busca} onEscolher={monstro}/>}
        {visivel("Encontros preparados") && <section aria-label="Encontros preparados"><strong>Encontros preparados</strong>{encontros === null ? <p role="status">Carregando encontros…</p> : <ul className="ini-achados">{encontros.filter(e => normalizar(e.nome).includes(normalizar(busca))).map(e => <li key={e.id}><button type="button" onClick={() => { setSelecionado(e); setAberto(false); }} aria-label={`Selecionar encontro ${e.nome}`}><strong>{e.nome}</strong><small>{e.participantes.reduce((n, p) => n + p.quantidade, 0)} criaturas · escolher indivíduos</small></button></li>)}{!encontros.length && <li>Nenhum encontro preparado. Crie um em Encontros.</li>}</ul>}</section>}
      </div>}
    </div>}
    {selecionado && <SeletorEncontro automatico encontros={[encontros?.find(e => e.id === selecionado.id) ?? selecionado]} onEnviar={enviar} aoFechar={() => setSelecionado(null)} rotulo="Adicionar encontro preparado"/>}
  </section>;
}

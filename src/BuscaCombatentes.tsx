import { SeletorNpc, type NpcEscolhido } from "./npc/SeletorNpc";
import { useState, type ReactNode } from "react";
import { SeletorMonstro, SeletorPersonagem } from "./CombateCompartilhado";
import { BarraExcedente } from "./BarraExcedente";
import { SeletorEncontro } from "./SeletorEncontro";
import type { Encontro } from "./combate";
import type { Monstro } from "./catalogue/sistemas/dnd5e-2014/esquemas";

const abas = ["Todos", "Personagens", "Bestiário", "Encontros preparados", "Combatente avulso"] as const;
const normalizar = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR");
export function BuscaCombatentes({ campaignId, encontros, monstro, personagem, enviar, avulso, npc }: {
  campaignId: string; encontros: readonly Encontro[] | null; monstro: (m: Monstro) => void;
  personagem: (p: { id: string; nome: string }, max?: number, atual?: number) => void;
  enviar: (enc: Encontro) => void; avulso: ReactNode; npc?: (n: NpcEscolhido) => void;
}) {
  const [aba, setAba] = useState<typeof abas[number]>("Todos"), [busca, setBusca] = useState(""), [aberto, setAberto] = useState(false);
  const [selecionado, setSelecionado] = useState<Encontro | null>(null);
  const visivel = (v: typeof aba) => aba === v || (aba === "Todos" && busca.trim().length > 0);
  return <section className="ini-busca-unica" aria-label="Adicionar ao combate">
    <BarraExcedente className="ini-fontes" rotulo="Fontes de combatentes" itens={abas} ativo={aba} onSelecionar={v => { setAba(v); setBusca(""); setAberto(false); }}/>
    {aba === "Combatente avulso" ? <><p className="muted">Crie um combatente que não está no catálogo.</p>{avulso}</> : <div className="pesquisa-catalogo" onFocus={e => { if (e.target instanceof HTMLInputElement) setAberto(true); }} onBlur={e => { if (!e.currentTarget.contains(e.relatedTarget)) setAberto(false); }} onKeyDown={e => { if (e.key === "Escape") { setAberto(false); e.stopPropagation(); } }}>
      <label>Buscar combatentes<input type="search" value={busca} placeholder="Personagens, monstros ou encontros…" onChange={e => { setBusca(e.target.value); setAberto(true); }}/></label>
      {aberto && (aba !== "Todos" || busca.trim().length > 0) && <div className="pesquisa-resultados ini-resultados-unicos">
        {visivel("Personagens") && <SeletorPersonagem key={campaignId} campaignId={campaignId} buscaControlada={busca} ocultarVazio={aba === "Todos"} onEscolher={(p, max, atual) => { personagem(p, max, atual); setAberto(false); setBusca(""); }}/>}
        {visivel("Personagens") && npc && <SeletorNpc buscaControlada={busca} ocultarVazio={aba === "Todos"} onEscolher={n => { npc(n); setAberto(false); setBusca(""); }}/>}
        {visivel("Bestiário") && <SeletorMonstro rotulo="Bestiário" buscaControlada={busca} ocultarVazio={aba === "Todos"} onEscolher={m => { monstro(m); setAberto(false); setBusca(""); }}/>}
        {visivel("Encontros preparados") && (aba !== "Todos" || encontros === null || encontros.some(e => normalizar(e.nome).includes(normalizar(busca)))) && <section aria-label="Encontros preparados"><strong>Encontros preparados</strong>{encontros === null ? <p role="status">Carregando encontros…</p> : <ul className="ini-achados">{encontros.filter(e => normalizar(e.nome).includes(normalizar(busca))).sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR")).map(e => <li key={e.id}><button type="button" onClick={() => { setSelecionado(e); setAberto(false); }} aria-label={`Selecionar encontro ${e.nome}`}><strong>{e.nome}</strong><small>{e.participantes.reduce((n, p) => n + p.quantidade, 0)} criaturas · escolher indivíduos</small></button></li>)}{!encontros.length && <li>Nenhum encontro preparado. Crie um em Encontros.</li>}</ul>}</section>}
      </div>}
    </div>}
    {selecionado && <SeletorEncontro automatico encontros={[encontros?.find(e => e.id === selecionado.id) ?? selecionado]} onEnviar={enviar} aoFechar={() => setSelecionado(null)} rotulo="Adicionar encontro preparado"/>}
  </section>;
}

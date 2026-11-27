// Página de uma magia (aba `magia:<id>`), aberta a partir da ficha no segundo grupo de abas, com a mesma definição do Compêndio.
import { useEffect, useState } from "react";
import { magiaPorId } from "../catalogue/contratos";
import type { Magia } from "../catalogue/sistemas/dnd5e-2014/esquemas";
import { Aviso } from "../Diario";
import { registrarTitulo } from "../registrosStore";
import {VoltarCompendio} from "./Paginas";
import type { TabSpec } from "../workspace";
import { DetalheMagia } from "./DetalheMagia";
import { Carta } from "./Carta";

export function MagiaPagina({ id, onOpenContent }: { id: string; onOpenContent: (s: TabSpec) => void }) {
  const [dados, setDados] = useState<{ id: string; magia?: Magia; erro?: boolean } | null>(null), [tentativa, setTentativa] = useState(0);
  useEffect(() => {
    let vivo = true; setDados(null);
    magiaPorId(id).then(magia => { if (!vivo) return; if (magia) registrarTitulo(id, magia.nome); setDados({ id, magia }); }, () => { if (vivo) setDados({ id, erro: true }); });
    return () => { vivo = false; };
  }, [id, tentativa]);
  if (!dados || dados.id !== id) return <div className="content"><p className="muted" role="status">Carregando magia…</p></div>;
  return <div className="content cd-page"><VoltarCompendio onOpenContent={onOpenContent}/>{dados.magia ? <Carta trilha="Regras / Magia" nome={dados.magia.nome}><DetalheMagia magia={dados.magia}/></Carta>
    : <Aviso erro t={dados.erro ? "Não foi possível carregar a magia." : "Magia não encontrada."} onRetry={dados.erro ? () => setTentativa(n => n + 1) : undefined}/>}</div>;
}

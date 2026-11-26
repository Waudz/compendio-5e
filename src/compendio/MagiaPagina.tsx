// Página de uma magia (aba `magia:<id>`), aberta a partir da ficha no segundo grupo de abas, com a mesma definição do Compêndio.
import { useEffect, useState } from "react";
import { magiaPorId } from "../catalogue/contratos";
import type { Magia } from "../catalogue/sistemas/dnd5e-2014/esquemas";
import { Aviso } from "../Diario";
import { registrarTitulo } from "../registrosStore";
import { DetalheMagia } from "./DetalheMagia";

export function MagiaPagina({ id }: { id: string }) {
  const [dados, setDados] = useState<{ id: string; magia?: Magia; erro?: boolean } | null>(null), [tentativa, setTentativa] = useState(0);
  useEffect(() => {
    let vivo = true; setDados(null);
    magiaPorId(id).then(magia => { if (!vivo) return; if (magia) registrarTitulo(id, magia.nome); setDados({ id, magia }); }, () => { if (vivo) setDados({ id, erro: true }); });
    return () => { vivo = false; };
  }, [id, tentativa]);
  if (!dados || dados.id !== id) return <div className="content"><p className="muted" role="status">Carregando magia…</p></div>;
  return <div className="content">{dados.magia ? <><h1>{dados.magia.nome}</h1><DetalheMagia magia={dados.magia}/></>
    : <Aviso erro t={dados.erro ? "Não foi possível carregar a magia." : "Magia não encontrada."} onRetry={dados.erro ? () => setTentativa(n => n + 1) : undefined}/>}</div>;
}

import { useAbrirEmAba } from "./abrirEmAba";
import type { RefCombate } from "./combate";
import type { ReactNode } from "react";
import { imagemDoMonstro } from "./ficha/imagensCatalogo";
import { RetratoQuadrado, type TipoRetrato } from "./RetratoCombate";

/** Identidade visual compartilhada; ações permanecem específicas de cada contexto. */
export function CriaturaIdentidade({ nome, tipo, retrato, detalhes, children, className, referencia }: { nome: string; tipo: TipoRetrato; retrato?: string | null; detalhes?: ReactNode; children?: ReactNode; className?: string; referencia?: RefCombate }) {
  const nav = useAbrirEmAba();
  const spec = referencia ? { kind: referencia.tipo === "personagem" ? "ficha" as const : "item" as const, ref: referencia.tipo === "personagem" ? referencia.id : `monstro:${referencia.id}`, title: nome } : null;
  const imagem = retrato ?? (referencia?.tipo === "monstro" ? imagemDoMonstro(referencia.id) : null);
  return <><RetratoQuadrado src={imagem} tipo={tipo} tamanho={44}/><div className={className ?? "ini-nome"}>{spec && nav.disponivel ? <button type="button" className="btn-link criatura-ficha" onClick={() => nav.abrir(spec)} aria-label={`Abrir ficha completa de ${nome}`}><strong>{nome}</strong></button> : <strong>{nome}</strong>}{detalhes && <small>{detalhes}</small>}{children}</div></>;
}

import type { ReactNode } from "react";
import { RetratoQuadrado, type TipoRetrato } from "./RetratoCombate";

/** Identidade visual compartilhada; ações permanecem específicas de cada contexto. */
export function CriaturaIdentidade({ nome, tipo, retrato, detalhes, children, className }: { nome: string; tipo: TipoRetrato; retrato?: string | null; detalhes?: ReactNode; children?: ReactNode; className?: string }) {
  return <><RetratoQuadrado src={retrato} tipo={tipo} tamanho={44}/><div className={className ?? "ini-nome"}><strong>{nome}</strong>{detalhes && <small>{detalhes}</small>}{children}</div></>;
}

/** Referências internas serializadas como links do BlockNote, sem URL externa. */
export type TipoReferencia = "monstro" | "item" | "magia" | "personagem" | "anotacao";
export type ReferenciaInterna = { tipo: TipoReferencia; id: string };
const TIPOS = new Set<TipoReferencia>(["monstro", "item", "magia", "personagem", "anotacao"]);
const PREFIXO = "compendio://referencia/";
/** IDs opacos: escapados no endereço; sem HTML ou javascript: executável. */
export function criarLinkInterno({ tipo, id }: ReferenciaInterna): string {
  if (!TIPOS.has(tipo) || !id || id.length > 512) throw new Error("Referência inválida");
  return PREFIXO + tipo + "/" + encodeURIComponent(id);
}
export function lerLinkInterno(href: unknown): ReferenciaInterna | null {
  if (typeof href !== "string" || !href.startsWith(PREFIXO)) return null;
  const resto = href.slice(PREFIXO.length);
  const barra = resto.indexOf("/");
  if (barra < 0) return null;
  const tipo = resto.slice(0, barra) as TipoReferencia;
  if (!TIPOS.has(tipo)) return null;
  try {
    const id = decodeURIComponent(resto.slice(barra + 1));
    if (!id || id.length > 512 || id.includes("/")) return null;
    return { tipo, id };
  } catch { return null; }
}

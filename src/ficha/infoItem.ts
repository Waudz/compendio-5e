// Resumo de jogo de um item no inventário, só com dados do catálogo. Aqui é o valor BÁSICO do item; o que o personagem rola
// (com atributo e proficiência) aparece em Habilidades › Ataques.
import { categoriaDoItemRotulo, raridadeRotulo, srdItem } from "../catalogue/srd-2014-items";
import { dadosDaArma } from "./regrasFicha";

export function infoDoItem(itemId: string): string[] {
  const d = srdItem(itemId); if (!d) return [];
  const arma = dadosDaArma(itemId);
  if (arma) return [`Dano básico ${arma.dado}${arma.tipo ? ` ${arma.tipo}` : ""}${arma.duasMaos ? ` (${arma.duasMaos} com duas mãos)` : ""}`, ...(arma.propriedades.length ? [arma.propriedades.join(", ")] : []), `Alcance ${arma.alcance}`];
  if (d.armadura) {
    const a = d.armadura;
    return [a.categoria === "shield" ? `Escudo: +${a.ca} de CA` : `CA ${a.ca}${a.somaDes ? ` + Des${a.maxDes != null ? ` (máx. ${a.maxDes})` : ""}` : ""}`,
      ...(a.forMin ? [`Força mínima ${a.forMin}`] : []), ...(a.furtividade ? ["Desvantagem em Furtividade"] : [])];
  }
  if (d.categoria === "pocao") return [d.cura ? `Efeito: recupera ${d.cura} PV` : "Poção: o catálogo ainda não descreve o efeito", ...(d.raridade !== "mundano" ? [`Raridade ${raridadeRotulo(d.raridade)}`] : [])];
  return [categoriaDoItemRotulo(d.categoria),
    ...(d.cura ? [`Efeito: recupera ${d.cura} PV`] : []),
    ...(d.pacote ? [`${d.pacote.length} tipos de item`] : []),
    ...(d.raridade !== "mundano" ? [`Raridade ${raridadeRotulo(d.raridade)}${d.sintonia ? ", requer sintonização" : ""}`] : [])];
}

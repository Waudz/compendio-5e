/** Adaptadores de consulta: nenhuma cópia das regras do criador ou do combate. */
import type { CategoriaDef } from "../../nucleo/tipos";
import dados from "../../../criador/data/character-2014.json";
import { ORIGENS_2014 } from "../../../criador/origens-2014";
import { CONDICOES_5E, CONDICOES_TEXTO } from "../../../rules/condicoes-5e";
export type ConsultaRegra = {
  id: string;
  nome: string;
  texto: string;
  fonte: string;
};
function categoria(
  id: string,
  rotulo: string,
  itens: readonly ConsultaRegra[],
): CategoriaDef<ConsultaRegra> {
  return {
    id,
    rotulo,
    rotuloItem: rotulo,
    carregar: async () => itens,
    dadosEmMemoria: () => itens,
    idDe: (x) => x.id,
    nomeDe: (x) => x.nome,
    subtituloDe: (x) => x.fonte,
    corpoDe: (x) => x.texto,
    resumoDe: (x) => x.texto.slice(0, 160),
    filtros: [],
    ordenacoes: [
      {
        id: "nome",
        rotulo: "Nome",
        comparar: (a, b) => a.nome.localeCompare(b.nome, "pt-BR"),
      },
    ],
  };
}
export const categoriaOrigens = categoria(
  "origens",
  "Origens",
  ORIGENS_2014.map((o) => ({
    id: o.id,
    nome: o.nome,
    texto: `${o.resumo}\nCaracterística: ${o.caracteristica}. Perícias: ${o.pericias.join(", ") || "à escolha"}. Idiomas adicionais: ${o.idiomas}. Ouro inicial: ${o.ouro} PO.`,
    fonte:
      o.fonte === "srd"
        ? "SRD 5.1 · resumo de consulta"
        : o.fonte === "personalizada"
          ? "Personalizada · combinar com o mestre"
          : "Compêndio · adaptação parcial; consulte o mestre",
  })),
);
export const categoriaTalentos = categoria(
  "talentos",
  "Talentos e habilidades",
  dados.features.map((f) => ({
    id: f.id,
    nome: f.nome,
    texto: f.descricao,
    fonte: "SRD 5.1 · característica do motor de regras",
  })),
);
export const categoriaRegras = categoria(
  "regras",
  "Regras e condições",
  CONDICOES_5E.map((nome) => ({
    id: nome,
    nome,
    texto: CONDICOES_TEXTO[nome],
    fonte: "SRD 5.1 · resumo de condição; considere características e exceções",
  })),
);

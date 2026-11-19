// Início da campanha: funções puras e contratos de dados. Sem React, sem rede.
// O Diário e os Personagens ainda não têm persistência (migração 0005 é só proposta): estes contratos definem
// o que o Início espera receber, para que a integração futura seja só ligar uma fonte real. Nada aqui inventa dados.
import type { Res, Role } from "./campaigns";

/** Calendário de Harptos (Forgotten Realms): 12 meses de 30 dias. */
export const HARPTOS_MESES = ["Hammer", "Alturiak", "Ches", "Tarsakh", "Mirtul", "Kythorn", "Flamerule", "Eleasis", "Eleint", "Marpenoth", "Uktar", "Nightal"] as const;
export type DataHarptos = { dia: number; mes: number; ano: number };

/** "3 de Nightal, 1491 DR". Data ausente, fora do intervalo ou malformada => null (nunca texto inventado). */
export function formatarDataHarptos(d: Partial<DataHarptos> | null | undefined): string | null {
  if (!d) return null;
  const { dia, mes, ano } = d;
  if (![dia, mes, ano].every(n => Number.isInteger(n))) return null;
  if (mes! < 1 || mes! > 12 || dia! < 1 || dia! > 30) return null;
  return `${dia} de ${HARPTOS_MESES[mes! - 1]}, ${ano} DR`;
}

/** Bloco de conteúdo no formato do editor (BlockNote): só os campos que o Início lê. */
export type BlocoTexto = { type?: string; content?: unknown; children?: unknown };
export type EntradaDiario = {
  id: string; titulo: string;
  dataSessao?: DataHarptos | null;
  publicada: boolean;                  // jogadores só veem entradas publicadas/autorizadas
  atualizadaEm: string;                // ISO; desempata a "mais recente"
  conteudo: BlocoTexto[];
};
export type Aventureiro = { id: string; nome: string; classe: string; nivel: number; retratoUrl?: string | null };

/** Fontes de dados do Início. Cada uma é opcional: sem fonte, o Início mostra "ainda não disponível" em vez de dados falsos. */
export type FonteDiario = { maisRecente: (campanhaId: string, papel: Role) => Promise<Res<EntradaDiario | null>> };
export type FonteAventureiros = { listar: (campanhaId: string) => Promise<Res<Aventureiro[]>> };

const textoInline = (c: unknown): string => {
  if (typeof c === "string") return c;
  if (!Array.isArray(c)) return "";
  return c.map(i => (i && typeof i === "object" && (i as { type?: string }).type === "text" ? String((i as { text?: unknown }).text ?? "") : i && typeof i === "object" && Array.isArray((i as { content?: unknown }).content) ? textoInline((i as { content: unknown }).content) : "")).join("");
};

/** Primeiro parágrafo com texto: ignora imagens, títulos, listas, metadados e parágrafos vazios/só com espaços. */
export function primeiroParagrafo(blocos: BlocoTexto[] | null | undefined): string | null {
  for (const b of blocos ?? []) {
    if (!b || b.type !== "paragraph") continue;
    const t = textoInline(b.content).replace(/\s+/g, " ").trim();
    if (t) return t;
  }
  return null;
}

/** Corta em limite de palavra, com reticências só se cortou. */
export function resumirTexto(t: string, max = 280): string {
  if (t.length <= max) return t;
  const corte = t.slice(0, max).replace(/\s+\S*$/, "");
  return `${corte || t.slice(0, max)}…`;
}

/** Entrada mais recente que o papel pode ver. Jogador: só publicadas. Defesa em profundidade; a RLS é a barreira real. */
export function maisRecenteVisivel(entradas: EntradaDiario[], papel: Role): EntradaDiario | null {
  const ok = entradas.filter(e => papel === "mestre" || e.publicada);
  return ok.reduce<EntradaDiario | null>((a, e) => !a || e.atualizadaEm > a.atualizadaEm ? e : a, null);
}

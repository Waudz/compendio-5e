import type { statistics2014 } from "../criador/regras-2014";
import type { CharacterDraft, CharacterSheet } from "../rules/character-domain";
import type { TabSpec } from "../workspace";
import type { EstadoJogo } from "./estadoJogo";
import type { AcaoVital } from "../vitais/vitais";

export type Estatisticas = ReturnType<typeof statistics2014>;
/** O que cada aba recebe: a ficha calculada, as estatísticas do motor 2014 e o estado de jogo. Toda mudança passa por `onChange`. */
export type PropsAba = {
  draft: CharacterDraft; sheet: CharacterSheet; stats: Estatisticas; estado: EstadoJogo;
  onChange: (proximo: CharacterDraft) => void; onOpenContent: (s: TabSpec) => void;
  /** PV, temporários, condições e morte só mudam por operação (nunca junto com a ficha inteira). */
  vital: (acao: AcaoVital) => void;
};
export const sinal = (n: number) => (n >= 0 ? `+${n}` : String(n));
export const metros = (n: number) => `${(Math.round(n * 10) / 10).toLocaleString("pt-BR")} m`;
export const novoId = () => crypto.randomUUID();

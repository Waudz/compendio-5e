// Estado vital do personagem (D&D 5e 2014): PV atuais, PV temporários, condições e salvaguardas contra a morte. A ÚNICA fonte é a ficha;
// o que muda isso são OPERAÇÕES (nunca "o valor inteiro que eu estava vendo"), aplicadas no servidor com a linha travada (migração 0014).
// Esta função é o espelho puro das mesmas regras: usada para mostrar a mudança na hora, no armazenamento local e na API em memória.
import type { CharacterDraft } from "../rules/character-domain";

export type Morte = { sucessos: number; falhas: number };
export type Vitais = { pv: number; temp: number; condicoes: string[]; morte: Morte };
/** Estado confirmado pelo servidor: `versao` ordena as leituras; `revision` é a da ficha inteira (muda quando outra parte dela muda). */
export type EstadoVital = Vitais & { id: string; versao: number; revision: number };
export type AcaoVital =
  | { tipo: "dano" | "temporarios"; valor: number }
  | { tipo: "cura" | "definir" | "ajustar"; valor: number; maximo: number }
  | { tipo: "condicao"; nome: string; ativa: boolean }
  | ({ tipo: "morte" } & Morte)
  | { tipo: "descanso"; maximo: number };
export const MAX_CONDICOES = 16;

const inteiro = (v: unknown, min: number, max: number, padrao = 0) => (typeof v === "number" && Number.isFinite(v) ? Math.min(max, Math.max(min, Math.trunc(v))) : padrao);
const objeto = (v: unknown): Record<string, unknown> => (v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {});

export function vitaisDoDraft(d: Pick<CharacterDraft, "currentHp" | "temporaryHp" | "play">): Vitais {
  const jogo = objeto(d.play), morte = objeto(jogo.morte);
  return {
    pv: inteiro(d.currentHp, 0, 1_000_000), temp: inteiro(d.temporaryHp, 0, 999),
    condicoes: Array.isArray(jogo.condicoes) ? [...new Set(jogo.condicoes.filter((c): c is string => typeof c === "string" && !!c))].slice(0, MAX_CONDICOES) : [],
    morte: { sucessos: inteiro(morte.sucessos, 0, 3), falhas: inteiro(morte.falhas, 0, 3) },
  };
}
const mesmasListas = (a: string[], b: string[]) => a.length === b.length && a.every((x, i) => x === b[i]);
/** A ficha com o estado vital informado. Devolve o MESMO objeto quando nada muda (não marca a ficha como alterada à toa). */
export function comVitais(d: CharacterDraft, v: Vitais): CharacterDraft {
  const a = vitaisDoDraft(d);
  if (a.pv === v.pv && a.temp === v.temp && mesmasListas(a.condicoes, v.condicoes) && a.morte.sucessos === v.morte.sucessos && a.morte.falhas === v.morte.falhas
    && d.currentHp === v.pv && d.temporaryHp === v.temp) return d;
  return { ...d, currentHp: v.pv, temporaryHp: v.temp, play: { ...objeto(d.play), condicoes: v.condicoes, morte: v.morte } };
}

export function aplicarAcao(v: Vitais, a: AcaoVital): Vitais {
  let { pv, temp } = v, morte = v.morte, condicoes = v.condicoes;
  const n = "valor" in a ? Math.trunc(a.valor) : 0;
  if (a.tipo === "dano" && n > 0) { const doTemp = Math.min(temp, n); temp -= doTemp; pv = Math.max(0, pv - (n - doTemp)); }
  else if (a.tipo === "cura" && n > 0 && pv < a.maximo) pv = Math.min(a.maximo, pv + n);
  else if (a.tipo === "temporarios" && n >= 0 && n <= 999) temp = n;                       // não se acumulam: substituem (0 remove)
  else if (a.tipo === "definir" && n >= 0) pv = Math.min(a.maximo, n);
  else if (a.tipo === "ajustar") pv = Math.min(a.maximo, Math.max(0, pv + n));
  else if (a.tipo === "descanso") { pv = a.maximo; temp = 0; morte = { sucessos: 0, falhas: 0 }; }
  else if (a.tipo === "morte") morte = { sucessos: inteiro(a.sucessos, 0, 3), falhas: inteiro(a.falhas, 0, 3) };
  else if (a.tipo === "condicao" && a.nome.trim()) {
    const outras = condicoes.filter(c => c !== a.nome);
    condicoes = a.ativa && outras.length < MAX_CONDICOES ? [...outras, a.nome] : outras;
  }
  if (v.pv === 0 && pv > 0) morte = { sucessos: 0, falhas: 0 };                            // voltar de 0 PV zera as salvaguardas contra a morte
  return { pv, temp, condicoes, morte };
}
export const novaOperacao = (): string => crypto.randomUUID();

// PV da ficha para o combate: leitura ao adicionar o personagem à iniciativa. Alterações NÃO passam por aqui: PV, temporários e condições
// têm uma única fonte (a ficha) e mudam por operação (`vitais/loja.ts`, migração 0014).
import type { FichasApi } from "./fichas";
import type { CharacterDraft } from "./rules/character-domain";

export type PvFicha = { atual: number; max: number };
export type ResultadoPv<T> = { ok: true; dados: T } | { ok: false; erro: string; semFicha?: boolean };

/** PV máximo calculado pelas regras da ficha (mesmo cálculo que a ficha mostra). Carregado sob demanda: as regras são grandes. */
async function maximo(draft: CharacterDraft): Promise<number> {
  const { sheet2014 } = await import("./criador/regras-2014");
  return sheet2014({ ...draft, currentHp: 0 }).maxHp;   // o cálculo do máximo não depende (nem falha por causa) dos PV atuais gravados
}
const inteiro = (n: unknown) => (typeof n === "number" && Number.isFinite(n) ? Math.floor(n) : 0);

/** PV atuais e máximos da ficha guiada do personagem. `semFicha`: o personagem não tem ficha guiada legível (ex.: personagem simples). */
export async function lerPvFicha(fichas: FichasApi, id: string): Promise<ResultadoPv<PvFicha>> {
  const r = await fichas.carregar(id);
  if (!r.ok) return { ok: false, erro: r.error };
  if (!r.data) return { ok: false, erro: "Este personagem não tem ficha guiada acessível.", semFicha: true };
  try {
    const max = await maximo(r.data.ficha.draft);
    if (!Number.isFinite(max) || max < 1) return { ok: false, erro: "Não foi possível calcular o PV máximo da ficha." };
    return { ok: true, dados: { atual: Math.min(max, Math.max(0, inteiro(r.data.ficha.draft.currentHp))), max } };
  } catch { return { ok: false, erro: "Não foi possível calcular o PV máximo da ficha." }; }
}

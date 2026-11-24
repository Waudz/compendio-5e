// PV da ficha para o combate: leitura (ao adicionar o personagem à iniciativa) e gravação segura (ao finalizar o combate).
// Só o campo `currentHp` do rascunho da ficha é alterado, sempre sobre a versão MAIS RECENTE lida do servidor e com controle de revisão:
// se o dono (ou outro dispositivo) salvou a ficha no meio do caminho, a gravação é recusada pelo banco (conflito) e refeita sobre a ficha nova;
// nada além de `currentHp` é tocado e nenhuma ficha é sobrescrita com uma cópia antiga. Usa só a API pública das fichas (RLS: dono ou mestre).
import { ehConflitoDeRevisao, type FichasApi } from "./fichas";
import type { CharacterDraft } from "./rules/character-domain";

export type PvFicha = { atual: number; max: number };
export type ResultadoPv<T> = { ok: true; dados: T } | { ok: false; erro: string; semFicha?: boolean };
export const TENTATIVAS_GRAVACAO = 3;

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

/**
 * Grava `pv` como PV atuais da ficha (limitado a 0..PV máximo). Relê a ficha a cada tentativa e usa a revisão lida: em conflito de revisão
 * (alteração concorrente) tenta de novo sobre a versão nova, até `TENTATIVAS_GRAVACAO`; depois desiste SEM sobrescrever nada.
 */
export async function gravarPvFicha(fichas: FichasApi, id: string, pv: number): Promise<ResultadoPv<{ gravado: number }>> {
  let ultimo = "Não foi possível salvar os PV na ficha.";
  for (let i = 0; i < TENTATIVAS_GRAVACAO; i++) {
    const r = await fichas.carregar(id);
    if (!r.ok) return { ok: false, erro: r.error };
    if (!r.data) return { ok: false, erro: "Este personagem não tem ficha guiada acessível.", semFicha: true };
    let max: number;
    try { max = await maximo(r.data.ficha.draft); } catch { return { ok: false, erro: "Não foi possível calcular o PV máximo da ficha." }; }
    const novo = Math.min(max, Math.max(0, inteiro(pv)));
    if (inteiro(r.data.ficha.draft.currentHp) === novo) return { ok: true, dados: { gravado: novo } };   // já está igual: nada a gravar
    const s = await fichas.salvar(id, r.data.ficha.revision, { ...r.data.ficha.draft, currentHp: novo });
    if (s.ok) return { ok: true, dados: { gravado: novo } };
    if (!ehConflitoDeRevisao(s)) return { ok: false, erro: s.error };
    ultimo = "A ficha foi alterada por outra pessoa várias vezes seguidas durante o salvamento.";
  }
  return { ok: false, erro: ultimo };
}

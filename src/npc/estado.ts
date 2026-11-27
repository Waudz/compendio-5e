// NPCs na mecânica que já existe. Ficha de personagem: é uma ficha como as outras (PV, condições e morte por `vitais/loja`).
// Ficha de criatura: PV e condições ficam em `character_life`, mas passam pela MESMA fila e pelas MESMAS regras (`aplicarAcao`).
// Estado vital (vivo, morto, desconhecido) é da identidade narrativa e vale para NPCs e aventureiros.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useCampaigns } from "../CampaignsContext";
import type { Monstro } from "../catalogue/sistemas/dnd5e-2014/esquemas";
import { avisarConhecimento, useCodexApi, useConhecimento, type CodexApi, type Conhecimento } from "../compendio/conhecimento";
import { carregarDefinicao, useDefinicoes } from "../compendio/definicoes";
import type { Secao } from "../compendio/ficha";
import type { FichasApi } from "../fichas";
import type { CharacterDraft } from "../rules/character-domain";
import { aplicarAcao, novaOperacao, type Vitais } from "../vitais/vitais";
import type { LinhaVital } from "../vitais/loja";

export type EstadoVitalidade = "vivo" | "morto" | "desconhecido";
export const VITALIDADES: [EstadoVitalidade, string][] = [["vivo", "Vivo"], ["morto", "Morto"], ["desconhecido", "Desconhecido"]];
export const rotuloVital = (v: EstadoVitalidade) => VITALIDADES.find(x => x[0] === v)![1];
export type LinhaVida = { noteId: string; estado: EstadoVitalidade; pv: number | null; temp: number; condicoes: string[]; version: number };
export type PatchVida = Partial<{ estado: EstadoVitalidade; pv: number | null; temp: number; condicoes: string[] }>;

export type NovaFichaDeNpc =
  | { tipo: "personagem"; draft: CharacterDraft }
  | { tipo: "criatura"; definicao: Monstro; base?: string; secoes: Secao[] }
  | null;
export type PedidoDeFicha = { operacao: string; /** Revisão da ficha de personagem que será substituída ou removida. */ revisao?: number; /** Intenção declarada de perder a ficha atual (a cópia fica 30 dias). */ confirmar?: boolean };
export const idDaCriaturaPropria = (entryId: string) => `custom-npc-${entryId}`;
export const ehCriaturaDeNpc = (definitionId: string | undefined) => !!definitionId?.startsWith("custom-npc-");

export type TipoDeFicha = "nenhuma" | "personagem" | "criatura" | "referencia";
/** Um NPC tem no máximo uma ficha. `referencia`: vínculo antigo a uma criatura compartilhada do catálogo. */
export const tipoDeFicha = (e: Pick<Conhecimento, "id" | "characterSheet" | "combatDefinitionId">): TipoDeFicha =>
  e.characterSheet ? "personagem" : !e.combatDefinitionId ? "nenhuma" : e.combatDefinitionId === idDaCriaturaPropria(e.id) ? "criatura" : "referencia";
export const temFicha = (e: Conhecimento) => e.category === "npc" && tipoDeFicha(e) !== "nenhuma";

/** O banco aceita fichas de NPC, estado vital e combatente NPC (0022). Falso enquanto não se sabe: o app age como antes. */
export function useBancoDeNpcs(): boolean {
  const api = useCodexApi(), { active } = useCampaigns();
  const mestre = active?.role === "mestre";
  const [ok, setOk] = useState<{ api: CodexApi; ok: boolean }>();
  useEffect(() => {
    let vivo = true;
    if (mestre && api?.bancoDeNpcs) void api.bancoDeNpcs().then(v => { if (vivo) setOk({ api, ok: v }); }, () => {});
    return () => { vivo = false; };
  }, [api, mestre]);
  return mestre && !!ok && ok.api === api && ok.ok;
}

const EVENTO_VIDA = "compendio5e:vida";
export const avisarVida = () => window.dispatchEvent(new Event(EVENTO_VIDA));

/** Estado vital e PV persistentes autorizados a quem olha (o mestre recebe tudo). Relê em intervalo, no foco e após gravar. */
export function useVidas(ativo = true) {
  const api = useCodexApi(), { active } = useCampaigns(), cid = active?.campaign.id;
  const [estado, setEstado] = useState<{ cid: string; mapa: Map<string, LinhaVida> }>();
  const [erro, setErro] = useState<string | null>(null);
  useEffect(() => {
    if (!ativo || !api?.vidas || !cid) return;
    let vivo = true;
    const ler = () => api.vidas!(cid).then(l => { if (vivo) setEstado({ cid, mapa: new Map(l.map(x => [x.noteId, x])) }); }, () => {});
    void ler();
    const t = setInterval(() => { if (document.visibilityState !== "hidden") void ler(); }, 15000);
    window.addEventListener(EVENTO_VIDA, ler); window.addEventListener("focus", ler);
    return () => { vivo = false; clearInterval(t); window.removeEventListener(EVENTO_VIDA, ler); window.removeEventListener("focus", ler); };
  }, [ativo, api, cid]);
  const mapa = estado && estado.cid === cid ? estado.mapa : VAZIO;
  const definir = useCallback(async (noteId: string, vital: EstadoVitalidade) => {
    if (!api?.gravarVida || !cid) return false;
    setErro(null);
    try { await api.gravarVida(cid, noteId, { estado: vital }, novaOperacao()); avisarVida(); avisarConhecimento(); return true; }
    catch (e) { setErro(e instanceof Error ? e.message : "Não foi possível alterar o estado vital."); return false; }
  }, [api, cid]);
  return { mapa, erro, definir, disponivel: !!api?.gravarVida, estadoDe: (id: string): EstadoVitalidade => mapa.get(id)?.estado ?? "vivo" };
}
const VAZIO: Map<string, LinhaVida> = new Map();

/** NPCs com ficha de criatura e o PV máximo da definição que cada um usa. */
export function useCriaturasDeNpc(ativo: boolean): Map<string, Monstro> {
  const conhecimento = useConhecimento(), definicoes = useDefinicoes();
  const npcs = ativo ? conhecimento.items.filter(e => e.category === "npc" && !e.characterSheet && e.combatDefinitionId) : [];
  const chave = npcs.map(e => `${e.id}=${e.combatDefinitionId}`).join("|");
  const [estado, setEstado] = useState<Map<string, Monstro>>(() => new Map());
  useEffect(() => {
    if (!chave || definicoes.carregando) { if (!chave) setEstado(m => (m.size ? new Map() : m)); return; }
    let vivo = true;
    void Promise.all(chave.split("|").map(async par => {
      const [id, definicao] = par.split("=");
      const d = await carregarDefinicao("monster", definicao, definicoes.lista);
      return d?.kind === "monster" ? [id, d.monstro] as const : null;
    })).then(r => { if (vivo) setEstado(new Map(r.flatMap(x => (x ? [x] : [])))); }, () => {});
    return () => { vivo = false; };
  }, [chave, definicoes.lista, definicoes.carregando]);
  return estado;
}

const linhaDeCriatura = (id: string, max: number, v: LinhaVida | undefined): LinhaVital => ({
  id, versao: v?.version ?? 0, revision: 0, pv: Math.min(max, v?.pv ?? max), temp: v?.temp ?? 0, condicoes: v?.condicoes ?? [], morte: { sucessos: 0, falhas: 0 },
  draft: {} as CharacterDraft, maximo: max,
});

/** A API de fichas de sempre, atendendo também os NPCs com ficha de criatura. */
export function comNpcsDeCriatura(fichas: FichasApi, codex: CodexApi, campaignId: string, maximo: (id: string) => number | undefined): FichasApi {
  const ler = async (id: string) => (await codex.vidas!(campaignId)).find(v => v.noteId === id);
  return {
    ...fichas,
    lerVitais: async ids => {
      const criaturas = ids.filter(id => maximo(id) !== undefined), resto = ids.filter(id => maximo(id) === undefined);
      const base = resto.length ? await fichas.lerVitais(resto) : { ok: true as const, data: [] };
      if (!base.ok || !criaturas.length) return base;
      try {
        const vidas = new Map((await codex.vidas!(campaignId)).map(v => [v.noteId, v]));
        return { ok: true, data: [...base.data, ...criaturas.map(id => linhaDeCriatura(id, maximo(id)!, vidas.get(id)))] };
      } catch (e) { return { ok: false, error: e instanceof Error ? e.message : "Não foi possível ler o estado dos NPCs." }; }
    },
    alterarVitais: async (id, acao, operacao) => {
      const max = maximo(id);
      if (max === undefined) return fichas.alterarVitais(id, acao, operacao);
      let falha = "Não foi possível gravar o estado do NPC.";
      for (let tentativa = 0; tentativa < 3; tentativa++) {
        try {
          const atual = linhaDeCriatura(id, max, await ler(id));
          const novo: Vitais = aplicarAcao(atual, acao);
          const g = await codex.gravarVida!(campaignId, id, { pv: Math.min(max, novo.pv), temp: novo.temp, condicoes: novo.condicoes }, operacao, atual.versao);
          avisarVida();
          return { ok: true, data: linhaDeCriatura(id, max, g) };
        } catch (e) { falha = e instanceof Error ? e.message : falha; if (!/Outra sessão|versao|versão/i.test(falha)) break; }
      }
      return { ok: false, error: falha };
    },
  };
}

/** Fichas e NPCs de criatura atrás de uma só API, estável enquanto a campanha for a mesma (a fila de vitais depende disso). */
export function useFichasComNpcs(fichas: FichasApi | null, ativo: boolean): { api: FichasApi | null; criaturas: Map<string, Monstro> } {
  const codex = useCodexApi(), { active } = useCampaigns(), cid = active?.campaign.id;
  const banco = useBancoDeNpcs(), criaturas = useCriaturasDeNpc(ativo && banco);
  const atual = useRef(criaturas); atual.current = criaturas;
  const api = useMemo(() => (fichas && codex?.vidas && codex.gravarVida && cid && banco
    ? comNpcsDeCriatura(fichas, codex, cid, id => atual.current.get(id)?.pv) : fichas), [fichas, codex, cid, banco]);
  return { api, criaturas };
}

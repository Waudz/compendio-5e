// Ciclo de vida dos personagens (0021). Quem pode fazer o quê é decidido no banco; aqui ficam os tipos, as chamadas e as mensagens.
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Res } from "./campaigns";

export type Situacao = "ativo" | "aguardando" | "arquivado" | "npc" | "compendio";
export type AcaoCiclo = "renunciar" | "aguardar" | "arquivar" | "npc" | "reativar" | "transferir" | "cancelar-transferencia" | "compendio" | "excluir";
export type SituacaoPersonagem = { id: string; state: Situacao; pendingTo?: string; previousOwner?: string };
export type OfertaPersonagem = { id: string; characterId: string; title: string; createdAt: string };
export type TipoAviso = "renuncia" | "oferta" | "oferta-aceita" | "oferta-recusada";
export type AvisoPersonagem = { id: number; characterId: string; kind: TipoAviso; title: string; readAt: string | null; createdAt: string };

export type PedidoCiclo = {
  campaignId: string; ids: string[]; acao: AcaoCiclo; /** A mesma em uma nova tentativa: repetir não faz nada. */ operacao: string;
  /** Revisão de cada ficha que quem pede está vendo (exigida quando a ficha é removida ou renunciada). */ revisoes?: Record<string, number>;
  destino?: string;
};

export type CicloApi = {
  /** `null`: o banco ainda não tem a 0021, e o aplicativo não oferece as ações do ciclo. */
  situacoes: (campaignId: string) => Promise<Res<SituacaoPersonagem[] | null>>;
  agir: (p: PedidoCiclo) => Promise<Res<true>>;
  ofertas: (campaignId: string) => Promise<Res<OfertaPersonagem[]>>;
  responder: (oferta: string, aceitar: boolean) => Promise<Res<true>>;
  avisos: (campaignId: string) => Promise<Res<AvisoPersonagem[]>>;
  lerAvisos: (ids: number[]) => Promise<Res<true>>;
};

export const ERRO_SEM_CICLO = "O banco ainda não foi atualizado para esta ação. Nada foi alterado.";
export function mensagemDoCiclo(bruta: string): string {
  const m = bruta.toLowerCase();
  if (m.includes("conflito_de_revisao")) return "A ficha mudou em outro lugar. Feche esta janela, confira a versão atual e tente de novo. Nada foi alterado.";
  if (m.includes("personagem_indisponivel")) return "Este personagem não está mais disponível. Nada foi alterado.";
  if (m.includes("sem_permissao")) return "Você não tem permissão para esta ação. Nada foi alterado.";
  if (m.includes("sem_ficha")) return "Este personagem não tem mais ficha técnica. Nada foi alterado.";
  if (m.includes("destino_invalido")) return "Escolha outro participante desta campanha. Nada foi alterado.";
  if (m.includes("oferta_indisponivel")) return "Esta transferência não está mais disponível.";
  if (m.includes("failed to fetch") || m.includes("networkerror") || m.includes("load failed")) return "Sem conexão com o servidor. Confira a lista antes de tentar de novo.";
  return "Não foi possível confirmar a operação. Confira a lista antes de tentar de novo.";
}
const semFuncao = (e: { code?: string; message?: string }) => e.code === "PGRST202" || /could not find the function|does not exist|schema cache/i.test(e.message ?? "");

export function criarCicloApi(client: SupabaseClient): CicloApi {
  const rpc = async <T,>(nome: string, args: Record<string, unknown>, ler: (d: unknown) => T): Promise<Res<T>> => {
    try {
      const r = await client.rpc(nome, args);
      if (r.error) return { ok: false, error: semFuncao(r.error) ? ERRO_SEM_CICLO : mensagemDoCiclo(r.error.message) };
      return { ok: true, data: ler(r.data) };
    } catch (e) { return { ok: false, error: mensagemDoCiclo(e instanceof Error ? e.message : "") }; }
  };
  return {
    situacoes: async campaignId => {
      const r = await rpc("character_states", { p_campaign: campaignId }, d => (d ?? []) as SituacaoPersonagem[]);
      return !r.ok && r.error === ERRO_SEM_CICLO ? { ok: true, data: null } : r;
    },
    agir: p => rpc("character_lifecycle", { p_campaign: p.campaignId, p_ids: p.ids, p_action: p.acao, p_operation: p.operacao, p_revisions: p.revisoes ?? {}, p_target: p.destino ?? null }, () => true as const),
    ofertas: campaignId => rpc("character_offers", { p_campaign: campaignId }, d => (d ?? []) as OfertaPersonagem[]),
    responder: (oferta, aceitar) => rpc("character_offer_answer", { p_offer: oferta, p_accept: aceitar }, () => true as const),
    avisos: async campaignId => {
      const r = await client.from("character_notices").select("id, character_id, kind, title, read_at, created_at").eq("campaign_id", campaignId).order("id", { ascending: false }).limit(50);
      if (r.error) return { ok: false, error: mensagemDoCiclo(r.error.message) };
      return { ok: true, data: (r.data as { id: number; character_id: string; kind: TipoAviso; title: string; read_at: string | null; created_at: string }[]).map(x => ({ id: x.id, characterId: x.character_id, kind: x.kind, title: x.title, readAt: x.read_at, createdAt: x.created_at })) };
    },
    lerAvisos: async ids => {
      if (!ids.length) return { ok: true, data: true };
      const r = await client.from("character_notices").update({ read_at: new Date().toISOString() }).in("id", ids).is("read_at", null);
      return r.error ? { ok: false, error: mensagemDoCiclo(r.error.message) } : { ok: true, data: true };
    },
  };
}

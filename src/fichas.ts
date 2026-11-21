// Fichas PRIVADAS dos personagens guiados no Supabase (tabela `character_sheets`) + identidade pública na linha `notes` do personagem.
// Exige a migração `supabase/migrations/0008_character_sheets_persistencia.sql` (PROPOSTA, NÃO aplicada): sem ela as funções não existem e a
// interface mostra a mensagem de "atualização do banco necessária" (ERRO_SCHEMA), sem perder o que foi digitado.
// A autorização real é a RLS + as funções SECURITY INVOKER do banco; nada aqui concede acesso. Só a chave pública (anon) é usada no navegador.
import type { SupabaseClient } from "@supabase/supabase-js";
import { erroCampanha, type Res } from "./campaigns";
import type { CharacterDraft } from "./rules/character-domain";
import { publicIdentityCard, type PrivateIdentitySource, type PublicIdentityCard, type PublicIdentitySettings } from "./rules/public-identity";

/** O que o servidor confirma ao gravar: o id definitivo (do servidor), a nova revisão e a data. */
export type GravacaoFicha = { id: string; revision: number; updatedAt: string };
export type FichaServidor = { id: string; campaignId: string; ownerId: string; revision: number; draft: CharacterDraft; updatedAt: string };
export type ResumoFicha = { id: string; ownerId: string; nome: string; nivel: number | null; revision: number; updatedAt: string };
/** Identidade pública como gravada em `notes.meta.identidadePublica`: as configurações (sem nenhum valor privado) e o cartão já resolvido. */
export type IdentidadeGravada = { settings: PublicIdentitySettings; card: PublicIdentityCard; publicada: boolean };
export type EntradaIdentidade = { identity: PublicIdentitySettings; source: PrivateIdentitySource; publicar: boolean };

export type FichasApi = {
  /** Fichas que o usuário pode LER (as próprias; todas as da campanha para o mestre). A RLS decide; nada aqui filtra por segurança. */
  listar: (campaignId: string) => Promise<Res<ResumoFicha[]>>;
  /** `null`: não existe ou sem permissão (indistinguíveis de propósito). `identidade` é null quando a linha pública não é legível (ex.: mestre). */
  carregar: (id: string) => Promise<Res<{ ficha: FichaServidor; identidade: IdentidadeGravada | null } | null>>;
  criar: (campaignId: string, draft: CharacterDraft, identidade: EntradaIdentidade) => Promise<Res<GravacaoFicha>>;
  /** Controle de revisão: se outra gravação ocorreu antes, devolve o erro ERRO_CONFLITO_REVISAO e NÃO sobrescreve. `identidade` só vale para o dono. */
  salvar: (id: string, revisaoEsperada: number, draft: CharacterDraft, identidade?: EntradaIdentidade) => Promise<Res<GravacaoFicha>>;
};

export const ERRO_CONFLITO_REVISAO = "Outra alteração desta ficha foi salva antes da sua (o mestre ou outro dispositivo). Nada foi sobrescrito.";
export const ehConflitoDeRevisao = (r: Res<unknown>) => !r.ok && r.error === ERRO_CONFLITO_REVISAO;
export const ERRO_SEM_FICHA = "Personagem não encontrado ou sem permissão para alterá-lo.";
export const MAX_META_IDENTIDADE = 12000;   // a coluna notes.meta aceita 16 KiB; sobra margem

/** Título e meta da linha PÚBLICA do personagem. Parte SÓ da identidade pública resolvida: nunca recebe a ficha. */
export function projetarIdentidade(e: EntradaIdentidade): { titulo: string; meta: { identidadePublica: { settings: PublicIdentitySettings; card: PublicIdentityCard } } } {
  const card = publicIdentityCard(e.identity, e.source);
  const titulo = (card.title || [card.name, card.surname].filter(Boolean).join(" ") || "Personagem").slice(0, 120);
  const meta = { identidadePublica: { settings: e.identity, card } };
  if (JSON.stringify(meta).length > MAX_META_IDENTIDADE) throw new Error("A identidade pública está grande demais. Reduza a descrição.");
  return { titulo, meta };
}

export const ehGuiado = (meta: Record<string, unknown> | undefined) => !!meta && meta.guiado === true;
/** Cartão público de uma linha `notes` de personagem guiado (ou null se o formato for inesperado: nunca inventa dados). */
export function cartaoPublico(meta: Record<string, unknown> | undefined): PublicIdentityCard | null {
  const c = (meta as { identidadePublica?: { card?: unknown } } | undefined)?.identidadePublica?.card as Partial<PublicIdentityCard> | undefined;
  if (!c || typeof c !== "object" || typeof c.title !== "string" || typeof c.description !== "string") return null;
  const t = (v: unknown) => (typeof v === "string" ? v : null);
  return { imageUrl: t(c.imageUrl), title: c.title, name: t(c.name), surname: t(c.surname), race: t(c.race), characterClass: t(c.characterClass), description: c.description };
}
export function identidadeDe(meta: Record<string, unknown> | undefined, publicada: boolean): IdentidadeGravada | null {
  const g = (meta as { identidadePublica?: { settings?: PublicIdentitySettings } } | undefined)?.identidadePublica;
  const card = cartaoPublico(meta);
  return g?.settings && card ? { settings: g.settings, card, publicada } : null;
}

type FichaRow = { character_id: string; campaign_id: string; owner_id: string; revision: number; draft: CharacterDraft; updated_at: string };
const fromRow = (r: FichaRow): FichaServidor => ({ id: r.character_id, campaignId: r.campaign_id, ownerId: r.owner_id, revision: r.revision, draft: r.draft, updatedAt: r.updated_at });
const msg = (e: unknown) => {
  const m = ((e as { message?: string } | null)?.message ?? "").toLowerCase();
  if (m.includes("conflito_de_revisao")) return ERRO_CONFLITO_REVISAO;
  if (m.includes("ficha_nao_encontrada") || m.includes("nota_nao_encontrada")) return ERRO_SEM_FICHA;
  if (m.includes("identidade_so_do_dono")) return "Só o dono do personagem altera a identidade pública.";
  if (m.includes("character_sheets_draft") || (m.includes("check constraint") && m.includes("character_sheets"))) return "A ficha é grande demais ou inválida para ser salva.";   // nome da restrição pode diferir do remoto
  if (m.includes("notes_guiado_meta_check")) return "A identidade pública contém dados não permitidos.";
  if (m.includes("failed to fetch") || m.includes("networkerror") || m.includes("load failed")) return "Sem conexão com o servidor.";
  return erroCampanha(e);
};
const run = async <T,>(fn: () => PromiseLike<{ data: T | null; error: unknown }>): Promise<Res<T>> => {
  try { const { data, error } = await fn(); return error || data === null ? { ok: false, error: msg(error) } : { ok: true, data }; } catch (e) { return { ok: false, error: msg(e) }; }
};

export function createFichasApi(client: SupabaseClient): FichasApi {
  const params = (e: EntradaIdentidade) => { const p = projetarIdentidade(e); return { p_title: p.titulo, p_meta: p.meta, p_publish: e.publicar }; };
  return {
    listar: campaignId => run<ResumoFicha[]>(async () => {
      const r = await client.from("character_sheets").select("character_id, owner_id, revision, updated_at, nome:draft->>name, nivel:draft->>level").eq("campaign_id", campaignId).order("updated_at", { ascending: false });
      if (r.error) return { data: null, error: r.error };
      return { data: (r.data as unknown as { character_id: string; owner_id: string; revision: number; updated_at: string; nome: string | null; nivel: string | null }[])
        .map(x => ({ id: x.character_id, ownerId: x.owner_id, nome: (x.nome ?? "").trim() || "Sem nome", nivel: x.nivel !== null && Number.isInteger(Number(x.nivel)) ? Number(x.nivel) : null, revision: x.revision, updatedAt: x.updated_at })), error: null };
    }),
    carregar: async id => {
      try {
        const s = await client.from("character_sheets").select("character_id, campaign_id, owner_id, revision, draft, updated_at").eq("character_id", id).maybeSingle();
        if (s.error) return { ok: false, error: msg(s.error) };
        if (!s.data) return { ok: true, data: null };
        const n = await client.from("notes").select("meta, visibility").eq("id", id).maybeSingle();   // o mestre não lê a nota privada: identidade null
        const identidade = !n.error && n.data ? identidadeDe((n.data as { meta: Record<string, unknown> }).meta, (n.data as { visibility: string }).visibility === "campaign") : null;
        return { ok: true, data: { ficha: fromRow(s.data as FichaRow), identidade } };
      } catch (e) { return { ok: false, error: msg(e) }; }
    },
    criar: (campaignId, draft, identidade) => run<GravacaoFicha>(async () => {
      const r = await client.rpc("create_guided_character", { p_campaign_id: campaignId, p_draft: draft, ...params(identidade) });
      if (r.error) return { data: null, error: r.error };
      const x = (r.data as { character_id: string; revision: number; updated_at: string }[] | null)?.[0];
      return x ? { data: { id: x.character_id, revision: x.revision, updatedAt: x.updated_at }, error: null } : { data: null, error: { message: "ficha_nao_encontrada" } };
    }),
    salvar: (id, esperada, draft, identidade) => run<GravacaoFicha>(async () => {
      const r = await client.rpc("save_guided_character", { p_id: id, p_expected_revision: esperada, p_draft: draft, ...(identidade ? params(identidade) : {}) });
      if (r.error) return { data: null, error: r.error };
      const x = (r.data as { revision: number; updated_at: string }[] | null)?.[0];
      return x ? { data: { id, revision: x.revision, updatedAt: x.updated_at }, error: null } : { data: null, error: { message: "ficha_nao_encontrada" } };
    }),
  };
}

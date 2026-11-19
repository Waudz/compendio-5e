// Registros de campanha (Diário, cenas e quadro de Planejamento) sobre a tabela `notes` (infraestrutura única de páginas).
// Exige as migrações 0005 (kind/content) e 0006 (meta; ver docs/propostas/0006_registros_meta.sql): NÃO aplicadas sem autorização.
// A autorização real é a RLS de `notes`; os filtros daqui são só de apresentação.
import type { SupabaseClient } from "@supabase/supabase-js";
import { erroCampanha, type Res } from "./campaigns";
import type { BlocoTexto, DataHarptos } from "./inicio";

export type RegistroKind = "diary" | "scene" | "board";
export type Visibilidade = "private" | "campaign";
export type Registro = {
  id: string; kind: RegistroKind; campaignId: string; ownerId: string;
  title: string; content: BlocoTexto[]; visibility: Visibilidade;
  meta: Record<string, unknown>; version: number; createdAt: string; updatedAt: string;
};
export type NovoRegistro = { kind: RegistroKind; campaignId: string; title: string; content?: BlocoTexto[]; visibility?: Visibilidade; meta?: Record<string, unknown> };
export type PatchRegistro = Partial<Pick<Registro, "title" | "content" | "visibility" | "meta">>;

export type RegistrosApi = {
  list: (campaignId: string, kind: RegistroKind) => Promise<Res<Registro[]>>;
  get: (id: string) => Promise<Res<Registro | null>>;
  create: (n: NovoRegistro) => Promise<Res<Registro>>;
  /** Concorrência otimista: falha com `conflito_de_versao` se outra gravação ocorreu antes. */
  update: (id: string, version: number, patch: PatchRegistro) => Promise<Res<Registro>>;
  remove: (id: string) => Promise<Res<true>>;
};

export const MAX_TITULO = 120;
export const validarTitulo = (t: string) => { const n = t.trim(); return n && n.length <= MAX_TITULO ? null : `O título deve ter de 1 a ${MAX_TITULO} caracteres.`; };

/** Publicado = visível a toda a campanha. Rascunho = privado (só o autor). */
export const publicado = (r: Pick<Registro, "visibility">) => r.visibility === "campaign";
export const dataSessao = (r: Pick<Registro, "meta">): DataHarptos | null => {
  const s = (r.meta as { sessao?: Partial<DataHarptos> }).sessao;
  return s && [s.dia, s.mes, s.ano].every(n => Number.isInteger(n)) ? s as DataHarptos : null;
};
/** Mais recentes primeiro: data da sessão (ano, mês, dia) e, em empate ou ausência, última atualização. */
export function ordenarDiario(rs: Registro[]): Registro[] {
  const chave = (r: Registro) => { const d = dataSessao(r); return d ? d.ano * 10000 + d.mes * 100 + d.dia : -1; };
  return [...rs].sort((a, b) => chave(b) - chave(a) || b.updatedAt.localeCompare(a.updatedAt));
}

type Row = { id: string; kind: RegistroKind; campaign_id: string; owner_id: string; title: string; content: BlocoTexto[] | null; visibility: string; meta: Record<string, unknown> | null; version: number; created_at: string; updated_at: string };
const COLS = "id, kind, campaign_id, owner_id, title, content, visibility, meta, version, created_at, updated_at";
const fromRow = (r: Row): Registro => ({ id: r.id, kind: r.kind, campaignId: r.campaign_id, ownerId: r.owner_id, title: r.title, content: r.content ?? [], visibility: r.visibility === "campaign" ? "campaign" : "private", meta: r.meta ?? {}, version: r.version, createdAt: r.created_at, updatedAt: r.updated_at });
const msg = (e: unknown) => { const m = ((e as { message?: string } | null)?.message ?? "").toLowerCase(); return m.includes("conflito_de_versao") ? "Outra pessoa alterou este registro. Recarregue para continuar." : erroCampanha(e); };
const run = async <T,>(fn: () => PromiseLike<{ data: T | null; error: unknown }>): Promise<Res<T>> => {
  try { const { data, error } = await fn(); return error || data === null ? { ok: false, error: msg(error) } : { ok: true, data }; } catch (e) { return { ok: false, error: msg(e) }; }
};

export function createRegistrosApi(client: SupabaseClient): RegistrosApi {
  return {
    list: (campaignId, kind) => run<Registro[]>(async () => {
      const r = await client.from("notes").select(COLS).eq("campaign_id", campaignId).eq("kind", kind).is("deleted_at", null).order("updated_at", { ascending: false });
      return r.error ? { data: null, error: r.error } : { data: (r.data as Row[]).map(fromRow), error: null };
    }),
    get: id => run<Registro | null>(async () => {
      const r = await client.from("notes").select(COLS).eq("id", id).is("deleted_at", null).maybeSingle();
      return r.error ? { data: null, error: r.error } : { data: r.data ? fromRow(r.data as Row) : null, error: null };
    }),
    create: n => run<Registro>(async () => {
      const r = await client.from("notes").insert({ campaign_id: n.campaignId, kind: n.kind, title: n.title.trim(), content: n.content ?? [], visibility: n.visibility ?? "private", meta: n.meta ?? {} }).select(COLS).single();
      return r.error ? { data: null, error: r.error } : { data: fromRow(r.data as Row), error: null };
    }),
    update: (id, version, p) => run<Registro>(async () => {
      const r = await client.from("notes").update({ ...(p.title !== undefined && { title: p.title.trim() }), ...(p.content && { content: p.content }), ...(p.visibility && { visibility: p.visibility }), ...(p.meta && { meta: p.meta }) })
        .eq("id", id).eq("version", version).select(COLS);
      if (r.error) return { data: null, error: r.error };
      return r.data?.length ? { data: fromRow(r.data[0] as Row), error: null } : { data: null, error: { message: "conflito_de_versao" } };
    }),
    remove: id => run<true>(async () => {
      const r = await client.from("notes").update({ deleted_at: new Date().toISOString() }).eq("id", id).select("id");   // lixeira (0005), não apaga de vez
      return r.error ? { data: null, error: r.error } : r.data?.length ? { data: true as const, error: null } : { data: null, error: { message: "sem_permissao" } };
    }),
  };
}

/** Primeiro texto de um registro, para prévias. */
export const textoDe = (r: Registro): string => (r.content ?? []).map(b => (Array.isArray(b.content) ? (b.content as { text?: string }[]).map(i => i.text ?? "").join("") : "")).filter(Boolean).join("\n");

/** Editor simples: um parágrafo por linha em branco. Formato dos blocos igual ao do BlockNote, para trocar o editor sem migrar dados. */
export const paraBlocos = (texto: string): BlocoTexto[] => texto.split(/\n{2,}/).map(p => p.trim()).filter(Boolean).map(p => ({ type: "paragraph", content: [{ type: "text", text: p, styles: {} }] }));
export const deBlocos = (blocos: BlocoTexto[]): string => (blocos ?? []).filter(b => b.type === "paragraph").map(b => (Array.isArray(b.content) ? (b.content as { text?: string }[]).map(i => i.text ?? "").join("") : "")).join("\n\n");

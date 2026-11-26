// Capa da campanha: imagem horizontal escolhida pelo mestre. Armazenamento no bucket privado `campaign-assets`
// (caminho `<campanha>/<uuid>`, o mesmo contrato que a migração 0005 usa para imagens de conteúdo) e `campaigns.cover_path`.
// Exige a migração 0006 (coluna + bucket + políticas; ver docs/propostas/0006_registros_meta.sql): NÃO aplicada sem autorização.
import type { SupabaseClient } from "@supabase/supabase-js";
import { erroCampanha, type Res } from "./campaigns";
import { ENQUADRAMENTO_PADRAO, estiloEnquadramento, normalizar, type Enquadramento } from "./imagem/enquadramento";
const lerEnquadramento = normalizar;

export const CAPA_TIPOS = ["image/jpeg", "image/png", "image/webp"] as const;
export const CAPA_MAX_BYTES = 5 * 1024 * 1024;

/** Enquadramento NÃO destrutivo, o mesmo de toda imagem editável (ver imagem/enquadramento.ts). */
export { ENQUADRAMENTO_PADRAO, estiloEnquadramento, normalizar as lerEnquadramento, type Enquadramento };
/** A coluna `cover_framing` (migração 0012) ainda não existe no banco. */
const semColuna = (e: unknown) => { const x = e as { code?: string; message?: string } | null; return !!x && (x.code === "42703" || x.code === "PGRST204" || /cover_framing/.test(x.message ?? "")); };

export type CapaApi = {
  /** Enquadramento salvo. `suportado: false` quando o banco ainda não tem a 0012 (ou a implementação não oferece). */
  enquadramento?: (campaignId: string) => Promise<Res<{ suportado: boolean; valor: Enquadramento }>>;
  salvarEnquadramento?: (campaignId: string, e: Enquadramento) => Promise<Res<true>>;
  /** URL de exibição (assinada e temporária) ou null se a campanha não tem capa. */
  obter: (campaignId: string) => Promise<Res<string | null>>;
  definir: (campaignId: string, arquivo: File) => Promise<Res<string>>;
  remover: (campaignId: string) => Promise<Res<true>>;
  /** Imagens avulsas no mesmo bucket (retratos de personagens): enviar devolve o caminho a guardar; urlDe gera a URL temporária. */
  enviar: (campaignId: string, arquivo: File) => Promise<Res<string>>;
  urlDe: (caminho: string) => Promise<Res<string>>;
  apagar: (caminho: string) => Promise<Res<true>>;
};

/** Valida tipo e tamanho ANTES de enviar. SVG é recusado de propósito (pode conter script). */
export function validarCapa(f: Pick<File, "type" | "size">): string | null {
  if (!(CAPA_TIPOS as readonly string[]).includes(f.type)) return "Use uma imagem JPEG, PNG ou WebP.";
  if (f.size <= 0) return "O arquivo está vazio.";
  if (f.size > CAPA_MAX_BYTES) return "A imagem deve ter no máximo 5 MB.";
  return null;
}

const uuid = () => crypto.randomUUID();
const falha = <T,>(e: unknown): Res<T> => ({ ok: false, error: erroCampanha(e) });

async function trocarCaminho(client: SupabaseClient, campaignId: string, path: string | null) {
  const r = await client.from("campaigns").update({ cover_path: path, cover_framing: null }).eq("id", campaignId).select("id");
  return r.error && semColuna(r.error) ? client.from("campaigns").update({ cover_path: path }).eq("id", campaignId).select("id") : r;
}

export function createCapaApi(client: SupabaseClient): CapaApi {
  const BUCKET = "campaign-assets";
  return {
    enquadramento: async campaignId => {
      try {
        const r = await client.from("campaigns").select("cover_framing").eq("id", campaignId).maybeSingle();
        if (r.error) return semColuna(r.error) ? { ok: true, data: { suportado: false, valor: ENQUADRAMENTO_PADRAO } } : falha(r.error);
        return { ok: true, data: { suportado: true, valor: lerEnquadramento((r.data as { cover_framing?: unknown } | null)?.cover_framing) } };
      } catch (e) { return falha(e); }
    },
    salvarEnquadramento: async (campaignId, e) => {
      try {
        const u = await client.from("campaigns").update({ cover_framing: lerEnquadramento(e) }).eq("id", campaignId).select("id");
        if (u.error) return falha(u.error); return u.data?.length ? { ok: true, data: true } : { ok: false, error: "Apenas o mestre pode fazer isso." };
      } catch (e2) { return falha(e2); }
    },
    obter: async campaignId => {
      try {
        const r = await client.from("campaigns").select("cover_path").eq("id", campaignId).maybeSingle();
        if (r.error) return falha(r.error);
        const path = (r.data as { cover_path?: string | null } | null)?.cover_path;
        if (!path) return { ok: true, data: null };
        const s = await client.storage.from(BUCKET).createSignedUrl(path, 3600);
        return s.error || !s.data ? falha(s.error) : { ok: true, data: s.data.signedUrl };
      } catch (e) { return falha(e); }
    },
    definir: async (campaignId, arquivo) => {
      const bad = validarCapa(arquivo); if (bad) return { ok: false, error: bad };
      try {
        const antigo = await client.from("campaigns").select("cover_path").eq("id", campaignId).maybeSingle();
        const path = `${campaignId}/${uuid()}`;
        const up = await client.storage.from(BUCKET).upload(path, arquivo, { contentType: arquivo.type, upsert: false });
        if (up.error) return falha(up.error);
        const u = await trocarCaminho(client, campaignId, path);
        if (u.error || !u.data?.length) { await client.storage.from(BUCKET).remove([path]); return u.error ? falha(u.error) : { ok: false, error: "Apenas o mestre pode fazer isso." }; }
        const old = (antigo.data as { cover_path?: string | null } | null)?.cover_path; if (old) await client.storage.from(BUCKET).remove([old]);   // a capa substituída não fica órfã
        const s = await client.storage.from(BUCKET).createSignedUrl(path, 3600);
        return s.error || !s.data ? falha(s.error) : { ok: true, data: s.data.signedUrl };
      } catch (e) { return falha(e); }
    },
    enviar: async (campaignId, arquivo) => {
      const bad = validarCapa(arquivo); if (bad) return { ok: false, error: bad };
      try { const path = `${campaignId}/${uuid()}`; const up = await client.storage.from(BUCKET).upload(path, arquivo, { contentType: arquivo.type, upsert: false }); return up.error ? falha(up.error) : { ok: true, data: path }; } catch (e) { return falha(e); }
    },
    urlDe: async caminho => { try { const s = await client.storage.from(BUCKET).createSignedUrl(caminho, 3600); return s.error || !s.data ? falha(s.error) : { ok: true, data: s.data.signedUrl }; } catch (e) { return falha(e); } },
    apagar: async caminho => { try { const r = await client.storage.from(BUCKET).remove([caminho]); return r.error ? falha(r.error) : { ok: true, data: true }; } catch (e) { return falha(e); } },
    remover: async campaignId => {
      try {
        const antigo = await client.from("campaigns").select("cover_path").eq("id", campaignId).maybeSingle();
        const u = await trocarCaminho(client, campaignId, null);
        if (u.error) return falha(u.error); if (!u.data?.length) return { ok: false, error: "Apenas o mestre pode fazer isso." };
        const old = (antigo.data as { cover_path?: string | null } | null)?.cover_path; if (old) await client.storage.from(BUCKET).remove([old]);
        return { ok: true, data: true };
      } catch (e) { return falha(e); }
    },
  };
}

// Acesso a dados de campanhas (Supabase). Sem React. A autorização real é feita pela RLS e pelas
// funções SQL (supabase/migrations); aqui só chamamos e traduzimos erros.
import type { SupabaseClient } from "@supabase/supabase-js";

export type Role = "mestre" | "jogador";
export type Campaign = { id: string; name: string; description: string; created_at: string };
export type Membership = { role: Role; campaign: Campaign };
export type Member = { user_id: string; role: Role; joined_at: string; display_name: string };
export type Invite = { id: string; code: string; expires_at: string; max_uses: number; uses: number };
export type Res<T> = { ok: true; data: T } | { ok: false; error: string };

export const MAX_NAME = 80, MAX_DESCRIPTION = 1000;

/** Mensagem em português para erros das funções SQL e da API; nunca expõe detalhes internos. */
export function erroCampanha(e: unknown): string {
  const m = ((e as { message?: string } | null)?.message ?? "").toLowerCase();
  const table: [string, string][] = [
    ["convite_invalido", "Convite inválido, expirado ou esgotado."],
    ["sem_permissao", "Apenas o mestre pode fazer isso."],
    ["ultimo_mestre", "O mestre não pode sair da campanha; exclua a campanha se não precisar mais dela."],
    ["mestre_unico", "Cada campanha tem um único mestre: o criador."],
    ["campanha_inexistente", "Campanha não encontrada."],
    ["nome_invalido", `O nome deve ter de 1 a ${MAX_NAME} caracteres.`],
    ["descricao_invalida", `A descrição pode ter até ${MAX_DESCRIPTION} caracteres.`],
    ["limite_campanhas", "Você atingiu o limite de campanhas criadas."],
    ["limite_convites", "Há convites ativos demais. Revogue algum antes de criar outro."],
        ["nao_autenticado", "Entre na sua conta para continuar."],
    ["jwt expired", "Sua sessão expirou. Entre novamente."],
    ["failed to fetch", "Sem conexão com o servidor. Tente de novo."],
    ["network", "Sem conexão com o servidor. Tente de novo."],
  ];
  return table.find(([k]) => m.includes(k))?.[1] ?? "Não foi possível concluir a operação. Tente novamente.";
}

const wrap = async <T,>(fn: () => PromiseLike<{ data: T | null; error: unknown }>): Promise<Res<T>> => {
  try { const { data, error } = await fn(); return error || data === null ? { ok: false, error: erroCampanha(error) } : { ok: true, data }; }
  catch (e) { return { ok: false, error: erroCampanha(e) }; }
};

export const validateCampaign = (name: string, description: string) => {
  const n = name.trim();
  if (!n) return "Informe o nome da campanha.";
  if (n.length > MAX_NAME) return `O nome deve ter até ${MAX_NAME} caracteres.`;
  if (description.length > MAX_DESCRIPTION) return `A descrição pode ter até ${MAX_DESCRIPTION} caracteres.`;
  return null;
};
export const normalizeCode = (c: string) => c.replace(/[\s-]/g, "").toUpperCase();
export const validateCode = (c: string) => /^[A-Z0-9]{12}$/.test(normalizeCode(c)) ? null : "O código do convite tem 12 letras e números.";

export function createCampaignApi(client: SupabaseClient, userId: string) {
  return {
    list: () => wrap<Membership[]>(async () => {
      const { data, error } = await client.from("campaign_members").select("role, campaigns(id, name, description, created_at)").eq("user_id", userId);
      if (error) return { data: null, error };
      const rows = (data ?? []) as unknown as { role: Role; campaigns: Campaign | null }[];
      return { data: rows.filter(r => r.campaigns).map(r => ({ role: r.role, campaign: r.campaigns! })).sort((a, b) => a.campaign.name.localeCompare(b.campaign.name, "pt-BR")), error: null };
    }),
    create: (name: string, description = "") => wrap<string>(async () => client.rpc("create_campaign", { p_name: name, p_description: description })),
    update: (id: string, name: string, description: string) => wrap<Campaign>(async () => {
      const r = await client.from("campaigns").update({ name: name.trim(), description }).eq("id", id).select("id, name, description, created_at");
      // RLS filtra silenciosamente quem não é mestre: 0 linhas = sem permissão.
      return r.error ? { data: null, error: r.error } : r.data?.length ? { data: r.data[0] as Campaign, error: null } : { data: null, error: { message: "sem_permissao" } };
    }),
    remove: (id: string) => wrap<true>(async () => {
      const r = await client.from("campaigns").delete().eq("id", id).select("id");
      return r.error ? { data: null, error: r.error } : r.data?.length ? { data: true as const, error: null } : { data: null, error: { message: "sem_permissao" } };
    }),
    join: (code: string) => wrap<string>(async () => client.rpc("join_campaign", { p_code: normalizeCode(code) })),
    members: (id: string) => wrap<Member[]>(async () => {
      const { data, error } = await client.from("campaign_members").select("user_id, role, joined_at, profiles(display_name)").eq("campaign_id", id);
      if (error) return { data: null, error };
      const rows = (data ?? []) as unknown as { user_id: string; role: Role; joined_at: string; profiles: { display_name: string } | null }[];
      return { data: rows.map(r => ({ user_id: r.user_id, role: r.role, joined_at: r.joined_at, display_name: r.profiles?.display_name || "Participante" }))
        .sort((a, b) => (a.role === b.role ? a.display_name.localeCompare(b.display_name, "pt-BR") : a.role === "mestre" ? -1 : 1)), error: null };
    }),
    removeMember: (id: string, uid: string) => wrap<true>(async () => {
      const r = await client.from("campaign_members").delete().eq("campaign_id", id).eq("user_id", uid).select("user_id");
      return r.error ? { data: null, error: r.error } : r.data?.length ? { data: true as const, error: null } : { data: null, error: { message: "sem_permissao" } };
    }),
    invites: (id: string) => wrap<Invite[]>(async () => client.from("campaign_invites").select("id, code, expires_at, max_uses, uses").eq("campaign_id", id).gt("expires_at", new Date().toISOString()).order("created_at", { ascending: false })),
    createInvite: (id: string, maxUses = 5, days = 7) => wrap<string>(async () => client.rpc("create_invite", { p_campaign_id: id, p_max_uses: maxUses, p_days: days })),
    revokeInvite: (inviteId: string) => wrap<true>(async () => {
      const r = await client.from("campaign_invites").delete().eq("id", inviteId).select("id");
      return r.error ? { data: null, error: r.error } : r.data?.length ? { data: true as const, error: null } : { data: null, error: { message: "sem_permissao" } };
    }),
  };
}
export type CampaignApi = ReturnType<typeof createCampaignApi>;

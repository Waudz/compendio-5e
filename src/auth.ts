// Regras de autenticação sem React: validação, tradução de erros e chamadas ao SDK.
import type { SupabaseClient } from "@supabase/supabase-js";

export type Result = { ok: true; message?: string } | { ok: false; error: string };
export const MIN_PASSWORD = 8;

export const validateEmail = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e.trim()) ? null : "Informe um e-mail válido.";
export const validatePassword = (p: string) => p.length >= MIN_PASSWORD ? null : `A senha deve ter pelo menos ${MIN_PASSWORD} caracteres.`;

/** Mensagem em português para qualquer erro do SDK/rede. Nunca expõe detalhes técnicos. */
export function traduzirErro(e: unknown): string {
  const err = e as { code?: string; message?: string; status?: number; name?: string } | null;
  const code = err?.code ?? "", msg = (err?.message ?? "").toLowerCase();
  if (code === "invalid_credentials" || msg.includes("invalid login")) return "E-mail ou senha incorretos.";
  if (code === "email_not_confirmed" || msg.includes("not confirmed")) return "Confirme seu e-mail antes de entrar. Verifique a caixa de entrada.";
  if (code === "user_already_exists" || msg.includes("already registered")) return "Este e-mail já está cadastrado. Tente entrar ou recuperar a senha.";
  if (code === "signup_disabled") return "O cadastro está fechado. O acesso é liberado pela administração.";
  if (code === "weak_password") return "Senha fraca. Use uma senha mais longa e variada.";
  if (code === "same_password") return "A nova senha deve ser diferente da atual.";
  if (code === "over_request_rate_limit" || code === "over_email_send_rate_limit" || err?.status === 429) return "Muitas tentativas. Aguarde um pouco e tente de novo.";
  if (code === "session_expired" || code === "refresh_token_not_found" || code === "session_not_found") return "Sua sessão expirou. Entre novamente.";
  if (err?.name === "AuthRetryableFetchError" || msg.includes("fetch") || msg.includes("network") || msg.includes("failed to")) return "Sem conexão com o servidor. Verifique a internet e tente de novo.";
  return "Não foi possível concluir a operação. Tente novamente.";
}

const redirect = () => {
  const url = new URL(import.meta.env.BASE_URL, location.origin);
  const invite = new URLSearchParams(location.search).get("convite");
  if (invite && /^[A-Z0-9]{12}$/i.test(invite)) url.searchParams.set("convite", invite.toUpperCase());
  return url.toString();
};
const guard = async (fn: () => Promise<Result>): Promise<Result> => { try { return await fn(); } catch (e) { return { ok: false, error: traduzirErro(e) }; } };

export type AuthApi = {
  signIn(email: string, password: string): Promise<Result>;
  signUp(email: string, password: string): Promise<Result>;
  signOut(): Promise<Result>;
  requestReset(email: string): Promise<Result>;
  changePassword(password: string): Promise<Result>;
  resendConfirmation(email: string): Promise<Result>;
};

export function createAuthApi(client: SupabaseClient): AuthApi {
  const { auth } = client;
  return {
    signIn: (email, password) => guard(async () => {
      const { error } = await auth.signInWithPassword({ email: email.trim(), password });
      return error ? { ok: false, error: traduzirErro(error) } : { ok: true };
    }),
    // Mantido no contrato para clientes antigos; não cria contas nesta Alpha fechada.
    signUp: async () => ({ ok: false, error: "O cadastro está fechado. O acesso é liberado pela administração." }),
    signOut: () => guard(async () => {
      const { error } = await auth.signOut();
      return error ? { ok: false, error: traduzirErro(error) } : { ok: true };
    }),
    requestReset: email => guard(async () => {
      const { error } = await auth.resetPasswordForEmail(email.trim(), { redirectTo: redirect() });
      // Mensagem neutra: não revela se o e-mail existe.
      return error ? { ok: false, error: traduzirErro(error) } : { ok: true, message: "Se o e-mail estiver cadastrado, você receberá um link para redefinir a senha." };
    }),
    changePassword: password => guard(async () => {
      const { error } = await auth.updateUser({ password });
      return error ? { ok: false, error: traduzirErro(error) } : { ok: true, message: "Senha alterada." };
    }),
    resendConfirmation: email => guard(async () => {
      const { error } = await auth.resend({ type: "signup", email: email.trim(), options: { emailRedirectTo: redirect() } });
      return error ? { ok: false, error: traduzirErro(error) } : { ok: true, message: "Link de confirmação reenviado." };
    }),
  };
}

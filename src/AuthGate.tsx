import { BookOpen } from "lucide-react";
import type { ReactNode } from "react";
import { AuthForms, NewPasswordForm } from "./AccountPanel";
import { useAuth } from "./AuthContext";

const Screen = ({ children }: { children: ReactNode }) => <div className="gate">
  <div className="gate-card">
    <div className="gate-brand"><BookOpen size={24}/><strong>Compêndio <span>5e</span></strong></div>
    {children}
  </div></div>;

/** Porta de entrada: o aplicativo só é montado com sessão válida. Não existe acesso anônimo. */
export function AuthGate({ children }: { children: ReactNode }) {
  const { status, recovery } = useAuth();
  const hasInvite = new URLSearchParams(window.location.search).has("convite");
  if (status === "unconfigured") return <Screen><div className="auth"><h1>Ambiente não configurado</h1>
    <div className="notice err" role="alert">O login não está configurado neste ambiente (faltam <code>VITE_SUPABASE_URL</code> e <code>VITE_SUPABASE_ANON_KEY</code>). O aplicativo exige conta e não abre sem ele.</div></div></Screen>;
  if (status === "loading") return <Screen><p role="status">Carregando sessão…</p></Screen>;
  if (status === "signedOut") return <Screen>
    {hasInvite && <div className="notice ok" role="status">Você recebeu um convite de campanha. Entre ou crie uma conta; o convite será mantido e aceito em seguida.</div>}
    <AuthForms/></Screen>;
  if (recovery) return <Screen><div className="auth"><h1>Definir nova senha</h1><NewPasswordForm primary/></div></Screen>;
  return <>{children}</>;
}

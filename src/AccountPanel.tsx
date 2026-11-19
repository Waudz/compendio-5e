import { useState, type FormEvent } from "react";
import { useAuth } from "./AuthContext";
import { validateEmail, validatePassword, type Result } from "./auth";

type Mode = "login" | "signup" | "forgot";
type Msg = { kind: "ok" | "err"; text: string } | null;

export function AccountPanel() {
  const { status, user, recovery, loadError, api } = useAuth();
  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState(""), [password, setPassword] = useState(""), [again, setAgain] = useState("");
  const [busy, setBusy] = useState(false), [msg, setMsg] = useState<Msg>(null), [needsConfirm, setNeedsConfirm] = useState(false);

  const run = async (check: string | null, call: () => Promise<Result>, after?: (r: Result) => void) => {
    if (check) { setMsg({ kind: "err", text: check }); return; }
    setBusy(true); setMsg(null);
    const r = await call();
    setBusy(false);
    setMsg(r.ok ? (r.message ? { kind: "ok", text: r.message } : null) : { kind: "err", text: r.error });
    after?.(r);
  };
  const submit = (fn: () => void) => (e: FormEvent) => { e.preventDefault(); if (!busy) fn(); };
  const notice = msg && <div className={`notice ${msg.kind}`} role={msg.kind === "err" ? "alert" : "status"}>{msg.text}</div>;
  const go = (m: Mode) => { setMode(m); setMsg(null); setNeedsConfirm(false); };
  const newPassword = () => run(validatePassword(password) ?? (password !== again ? "As senhas não coincidem." : null), () => api!.changePassword(password), r => { if (r.ok) { setPassword(""); setAgain(""); } });
  const passwordFields = <>
    <label>Nova senha<input type="password" autoComplete="new-password" value={password} onChange={e => setPassword(e.target.value)}/></label>
    <label>Repita a nova senha<input type="password" autoComplete="new-password" value={again} onChange={e => setAgain(e.target.value)}/></label></>;

  if (status === "unconfigured") return <div className="auth"><h1>Conta</h1>
    <div className="notice">Modo visitante. O login ainda não está configurado neste ambiente (faltam <code>VITE_SUPABASE_URL</code> e <code>VITE_SUPABASE_ANON_KEY</code>). O conteúdo público continua disponível.</div></div>;
  if (status === "loading") return <div className="auth"><h1>Conta</h1><p role="status">Carregando sessão…</p></div>;

  if (status === "authenticated" && recovery) return <div className="auth"><h1>Definir nova senha</h1>
    <form onSubmit={submit(newPassword)}>{passwordFields}
      <button className="btn-primary" disabled={busy}>{busy ? "Salvando…" : "Salvar senha"}</button></form>{notice}</div>;

  if (status === "authenticated") return <div className="auth"><h1>Conta</h1>
    <p>Conectado como <strong>{user?.email}</strong>.</p>
    <h2>Alterar senha</h2>
    <form onSubmit={submit(newPassword)}>{passwordFields}
      <button className="btn-secondary" disabled={busy}>Alterar senha</button></form>
    {notice}
    <div className="links"><button className="btn-secondary" disabled={busy} onClick={() => run(null, () => api!.signOut())}>Sair</button></div></div>;

  const title = mode === "login" ? "Entrar" : mode === "signup" ? "Criar conta" : "Recuperar senha";
  return <div className="auth"><h1>{title}</h1>
    <p>Sem conta você continua navegando como visitante pelo conteúdo público.</p>
    {loadError && <div className="notice err" role="alert">{loadError}</div>}
    <form noValidate onSubmit={submit(() => {
      const e = validateEmail(email);
      if (mode === "forgot") return run(e, () => api!.requestReset(email));
      if (mode === "signup") return run(e ?? validatePassword(password) ?? (password !== again ? "As senhas não coincidem." : null), () => api!.signUp(email, password), r => { if (r.ok) setNeedsConfirm(true); });
      return run(e ?? (password ? null : "Informe a senha."), () => api!.signIn(email, password), r => { if (!r.ok && /Confirme seu e-mail/.test(r.error)) setNeedsConfirm(true); });
    })}>
      <label>E-mail<input type="email" autoComplete="email" value={email} onChange={e => setEmail(e.target.value)}/></label>
      {mode !== "forgot" && <label>Senha<input type="password" autoComplete={mode === "signup" ? "new-password" : "current-password"} value={password} onChange={e => setPassword(e.target.value)}/></label>}
      {mode === "signup" && <label>Repita a senha<input type="password" autoComplete="new-password" value={again} onChange={e => setAgain(e.target.value)}/></label>}
      <button className="btn-primary" disabled={busy}>{busy ? "Aguarde…" : title}</button>
    </form>
    {notice}
    {needsConfirm && <div className="links"><button className="btn-link" disabled={busy} onClick={() => run(validateEmail(email), () => api!.resendConfirmation(email))}>Reenviar e-mail de confirmação</button></div>}
    <div className="links">
      {mode !== "login" && <button className="btn-link" onClick={() => go("login")}>Já tenho conta</button>}
      {mode !== "signup" && <button className="btn-link" onClick={() => go("signup")}>Criar conta</button>}
      {mode !== "forgot" && <button className="btn-link" onClick={() => go("forgot")}>Esqueci a senha</button>}
    </div></div>;
}

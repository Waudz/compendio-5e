import { useState, type FormEvent } from "react";
import { useAuth } from "./AuthContext";
import { useUnsaved } from "./unsaved";
import { validateEmail, validatePassword, type Result } from "./auth";

type Msg = { kind: "ok" | "err"; text: string } | null;

/** Estado comum dos formulários: bloqueio de duplo envio e mensagem de resultado. */
function useForm() {
  const [busy, setBusy] = useState(false), [msg, setMsg] = useState<Msg>(null);
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
  return { busy, run, submit, notice, setMsg };
}

/** Nova senha (alterar senha na conta ou concluir a recuperação). */
export function NewPasswordForm({ primary = false }: { primary?: boolean }) {
  const { api, endRecovery } = useAuth();
  const [password, setPassword] = useState(""), [again, setAgain] = useState("");
  const f = useForm();
  return <>
    <form onSubmit={f.submit(() => f.run(validatePassword(password) ?? (password !== again ? "As senhas não coincidem." : null), () => api!.changePassword(password), r => { if (r.ok) { setPassword(""); setAgain(""); if (primary) endRecovery(); /* recuperação concluída: segue para o app */ } }))}>
      <label>Nova senha<input type="password" autoComplete="new-password" value={password} onChange={e => setPassword(e.target.value)}/></label>
      <label>Repita a nova senha<input type="password" autoComplete="new-password" value={again} onChange={e => setAgain(e.target.value)}/></label>
      <button className={primary ? "btn-primary" : "btn-secondary"} disabled={f.busy}>{primary ? (f.busy ? "Salvando…" : "Salvar senha") : "Alterar senha"}</button>
    </form>{f.notice}</>;
}

/** Entrar, criar conta e recuperar senha. Só aparece na porta de entrada (sem sessão). */
export function AuthForms() {
  const { loadError, api } = useAuth();
  const [mode, setMode] = useState<"login" | "signup" | "forgot">("login");
  const [email, setEmail] = useState(""), [password, setPassword] = useState(""), [again, setAgain] = useState("");
  const [needsConfirm, setNeedsConfirm] = useState(false);
  const f = useForm();
  const go = (m: typeof mode) => { setMode(m); f.setMsg(null); setNeedsConfirm(false); };
  const title = mode === "login" ? "Entrar" : mode === "signup" ? "Criar conta" : "Recuperar senha";
  return <div className="auth"><h1>{title}</h1>
    {loadError && <div className="notice err" role="alert">{loadError}</div>}
    <form noValidate onSubmit={f.submit(() => {
      const e = validateEmail(email);
      if (mode === "forgot") return f.run(e, () => api!.requestReset(email));
      if (mode === "signup") return f.run(e ?? validatePassword(password) ?? (password !== again ? "As senhas não coincidem." : null), () => api!.signUp(email, password), r => { if (r.ok) setNeedsConfirm(true); });
      return f.run(e ?? (password ? null : "Informe a senha."), () => api!.signIn(email, password), r => { if (!r.ok && /Confirme seu e-mail/.test(r.error)) setNeedsConfirm(true); });
    })}>
      <label>E-mail<input type="email" autoComplete="email" value={email} onChange={e => setEmail(e.target.value)}/></label>
      {mode !== "forgot" && <label>Senha<input type="password" autoComplete={mode === "signup" ? "new-password" : "current-password"} value={password} onChange={e => setPassword(e.target.value)}/></label>}
      {mode === "signup" && <label>Repita a senha<input type="password" autoComplete="new-password" value={again} onChange={e => setAgain(e.target.value)}/></label>}
      <button className="btn-primary" disabled={f.busy}>{f.busy ? "Aguarde…" : title}</button>
    </form>
    {f.notice}
    {needsConfirm && <div className="links"><button className="btn-link" disabled={f.busy} onClick={() => f.run(validateEmail(email), () => api!.resendConfirmation(email))}>Reenviar e-mail de confirmação</button></div>}
    <div className="links">
      {mode !== "login" && <button className="btn-link" onClick={() => go("login")}>Já tenho conta</button>}
      {mode !== "signup" && <button className="btn-link" onClick={() => go("signup")}>Criar conta</button>}
      {mode !== "forgot" && <button className="btn-link" onClick={() => go("forgot")}>Esqueci a senha</button>}
    </div></div>;
}

/** Aba Conta (já autenticado): e-mail, alterar senha e sair. */
export function AccountPanel() {
  const { status, user, api } = useAuth();
  const unsaved = useUnsaved();
  const f = useForm();
  if (status !== "authenticated") return null;   // a porta de entrada garante a sessão; nada de conta sem login
  return <div className="auth"><h1>Conta</h1>
    <p>Conectado como <strong>{user?.email}</strong>.</p>
    <h2>Alterar senha</h2>
    <NewPasswordForm/>
    <div className="links"><button className="btn-secondary" disabled={f.busy} onClick={async () => { if (await unsaved.confirmAll()) await f.run(null, () => api!.signOut()); }}>Sair</button></div>
    {f.notice}</div>;
}

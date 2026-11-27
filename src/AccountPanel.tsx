import { APP_PHASE, APP_VERSION } from "./version";
import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { useAuth } from "./AuthContext";
import { createProfileApi, PERFIL_ATUALIZADO } from "./profiles";
import { useUnsavedGuard } from "./unsaved";
import { useUnsaved } from "./unsaved";
import { validateEmail, validatePassword, type Result } from "./auth";
import { lerTema, salvarTema, TEMAS, type Tema } from "./tema";

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

/** Entrar e recuperar senha para contas existentes. Só aparece na porta de entrada (sem sessão). */
export function AuthForms() {
  const { loadError, api } = useAuth();
  const [mode, setMode] = useState<"login" | "forgot" | "signup">("login");
  const [email, setEmail] = useState(""), [password, setPassword] = useState("");
  const [needsConfirm, setNeedsConfirm] = useState(false);
  const f = useForm();
  const go = (m: typeof mode) => { setMode(m); f.setMsg(null); setNeedsConfirm(false); };
  const title = mode === "login" ? "Entrar" : mode === "signup" ? "Criar conta" : "Recuperar senha";
  return <div className="auth"><h1>{title}</h1>
    <p className="muted">{mode === "signup" ? "Crie sua conta para participar de uma campanha. O acesso a campanhas privadas exige convite." : "Entre para acessar suas campanhas e personagens."}</p>
    {loadError && <div className="notice err" role="alert">{loadError}</div>}
    <form noValidate onSubmit={f.submit(() => {
      const e = validateEmail(email);
      if (mode === "forgot") return f.run(e, () => api!.requestReset(email));
      if (mode === "signup") return f.run(e ?? validatePassword(password), () => api!.signUp(email, password), r => { if (r.ok) { setPassword(""); setNeedsConfirm(true); } });
      return f.run(e ?? (password ? null : "Informe a senha."), () => api!.signIn(email, password), r => { if (!r.ok && /Confirme seu e-mail/.test(r.error)) setNeedsConfirm(true); });
    })}>
      <label>E-mail<input type="email" autoComplete="email" value={email} onChange={e => setEmail(e.target.value)}/></label>
      {mode !== "forgot" && <label>Senha<input type="password" autoComplete={mode === "signup" ? "new-password" : "current-password"} value={password} onChange={e => setPassword(e.target.value)}/></label>}
      <button className="btn-primary" disabled={f.busy}>{f.busy ? "Aguarde…" : title}</button>
    </form>
    {f.notice}
    {needsConfirm && <div className="links"><button className="btn-link" disabled={f.busy} onClick={() => f.run(validateEmail(email), () => api!.resendConfirmation(email))}>Reenviar e-mail de confirmação</button></div>}
    <div className="links">
      {mode === "login" && <button className="btn-link" onClick={() => go("signup")}>Criar conta</button>}
      {mode !== "login" && <button className="btn-link" onClick={() => go("login")}>Já tenho conta</button>}
      {mode !== "forgot" && <button className="btn-link" onClick={() => go("forgot")}>Esqueci a senha</button>}
    </div></div>;
}

function SeletorTema() {
  const [tema, setTema] = useState<Tema>(lerTema);
  return <><h2>Aparência</h2><label>Tema neste aparelho<select value={tema} onChange={e => { const t = e.target.value as Tema; setTema(t); salvarTema(t); }}>{TEMAS.map(([v, r]) => <option key={v} value={v}>{r}</option>)}</select></label></>;
}

/** Aba Conta (já autenticado): e-mail, alterar senha e sair. */
export function AccountPanel() {
  const { status, user, api, client } = useAuth();
  const unsaved = useUnsaved();
  const f = useForm();
  if (status !== "authenticated") return null;   // a porta de entrada garante a sessão; nada de conta sem login
  return <div className="auth"><h1>Conta</h1>
    <p>Conectado como <strong>{user?.email}</strong>.</p>
    <ProfileName key={user?.id} client={client} userId={user?.id}/>
    <EmailForm key={`email:${user?.id}`}/>
    <h2>Alterar senha</h2>
    <NewPasswordForm/>
    <div className="links"><button className="btn-secondary" disabled={f.busy} onClick={async () => { if (await unsaved.confirmAll()) await f.run(null, () => api!.signOut()); }}>Sair</button></div>
    {f.notice}</div>;
}

function ProfileName({client, userId}: {client: ReturnType<typeof useAuth>["client"]; userId?: string}) {
  const profile = useMemo(() => client && userId ? createProfileApi(client, userId) : null, [client, userId]);
  const [name, setName] = useState(""), [saved, setSaved] = useState(""), [loaded, setLoaded] = useState(false);
  const [loading, setLoading] = useState(false);
  const saving = useRef(false), latestName = useRef(name); latestName.current = name;
  const f = useForm();
  const load = async () => {
    if (!profile) return;
    setLoading(true); const r = await profile.load(); setLoading(false);
    if (r.ok) { setName(r.data); setSaved(r.data); setLoaded(true); f.setMsg(null); }
    else f.setMsg({kind: "err", text: r.error});
  };
  useEffect(() => {
    let alive = true;
    if (profile) { setLoading(true); void profile.load().then(r => {
      if (!alive) return; setLoading(false);
      if (r.ok) { setName(r.data); setSaved(r.data); setLoaded(true); }
      else f.setMsg({kind: "err", text: r.error});
    }); }
    return () => { alive = false; };
  }, [profile]);
  const save = async (): Promise<Result> => {
    if (!profile || !loaded) return {ok:false,error:"Carregue o perfil antes de salvar."};
    if (saving.current) return {ok:false,error:"Aguarde o salvamento em andamento."};
    saving.current = true;
    const snapshot = name;
    const r = await profile.save(snapshot); saving.current = false;
    if (r.ok) { setSaved(snapshot); window.dispatchEvent(new Event(PERFIL_ATUALIZADO)); f.setMsg({kind: "ok", text: "Nome atualizado."}); }
    else f.setMsg({kind: "err", text: r.error});
    if (!r.ok) return r;
    return latestName.current !== snapshot ? {ok:false,error:"O nome anterior foi salvo. Há alterações mais recentes para salvar."} : {ok:true,message:"Nome atualizado."};
  };
  useUnsavedGuard("conta:perfil", loaded && name !== saved, async () => (await save()).ok);
  return <section><h2>Nome de exibição</h2><p className="muted">Este nome identifica sua conta nas campanhas. Os nomes dos personagens não mudam.</p>
    <form onSubmit={f.submit(() => f.run(null, save))}>
      <label>Nome de exibição<input autoComplete="nickname" maxLength={60} value={name} disabled={!loaded || loading} onChange={e => setName(e.target.value)}/></label>
      <button className="btn-primary" disabled={!loaded || loading || f.busy || name === saved}>{f.busy ? "Salvando…" : "Salvar nome"}</button>
    </form>{!loaded && !loading && <button className="btn-link" onClick={() => void load()}>Tentar carregar perfil novamente</button>}{f.notice}</section>;
}

function EmailForm() {
  const {user, api} = useAuth();
  const [email, setEmail] = useState(""); const f = useForm();
  const rawProviders: unknown = user?.app_metadata?.providers;
  const providers = Array.isArray(rawProviders) ? rawProviders.filter((p): p is string => typeof p === "string") : [];
  return <section><h2>E-mail da conta</h2>
    {providers?.length ? <p className="muted">Método de acesso: {providers.map(p => p === "email" ? "E-mail e senha" : p).join(", ")}</p> : null}
    <form onSubmit={f.submit(() => f.run(validateEmail(email), () => api!.changeEmail(email), r => {if (r.ok) setEmail("");}))}>
      <label>Novo e-mail<input type="email" autoComplete="email" value={email} onChange={e => setEmail(e.target.value)}/></label>
      <button className="btn-secondary" disabled={f.busy}>Solicitar alteração de e-mail</button>
    </form>{f.notice}</section>;
}

export function SettingsPanel() {
  return <div className="auth"><h1>Configurações</h1><SeletorTema/></div>;
}
export function AboutPanel() {
  return <div className="auth"><h1>Sobre o Compêndio</h1><p><strong>Compêndio 5e 2.0</strong> · {APP_PHASE} · versão {APP_VERSION}</p>
    <p>Ferramenta gratuita para organizar campanhas, personagens e consultas de D&amp;D 5e (2014).</p>
    <h2>Créditos e licenças</h2><p>Projeto de William de Almeida dos Santos e colaboradores.</p>
    <p>Este trabalho inclui material do System Reference Document 5.1 de Wizards of the Coast LLC, disponível em <a href="https://dnd.wizards.com/resources/systems-reference-document" target="_blank" rel="noopener noreferrer">SRD 5.1</a>. Esse material é licenciado sob <a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noopener noreferrer">Creative Commons Attribution 4.0 International</a>.</p>
    <p>Interface: React, FlexLayout, dnd-kit, Mantine e Supabase JS (MIT); BlockNote (MPL-2.0); Lucide (ISC). As licenças dos dados e atribuições adicionais estão documentadas no repositório.</p>
    <p><a href="https://github.com/Waudz/compendio-5e" target="_blank" rel="noopener noreferrer">Repositório e documentação do projeto</a></p>
    <p>Projeto de fãs, sem afiliação ou endosso oficial de Wizards of the Coast. Dungeons &amp; Dragons e D&amp;D são marcas de seus respectivos titulares.</p>
  </div>;
}

import { PERFIL_ATUALIZADO } from "./profiles";
import { Ellipsis, LogOut } from "lucide-react";
import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { useFecharMenu } from "./useFecharMenu";
import { useAuth } from "./AuthContext";
import { useCampaigns } from "./CampaignsContext";
import { MAX_DESCRIPTION, MAX_NAME, validateCampaign, validateCode, type Invite, type Member, type Res } from "./campaigns";
import type { NavMode } from "./navigation";
import { useUnsaved } from "./unsaved";
import type { TabSpec } from "./workspace";

type Msg = { kind: "ok" | "err"; text: string } | null;
export const Notice = ({ m }: { m: Msg }) => m ? <div className={`notice ${m.kind}`} role={m.kind === "err" ? "alert" : "status"}>{m.text}</div> : null;
const dateBr = (iso: string) => new Date(iso).toLocaleDateString("pt-BR");
export const inviteUrl = (code: string) => {
  const url = new URL(import.meta.env.BASE_URL, window.location.origin);
  url.searchParams.set("convite", code);
  return url.toString();
};
const incomingInvite = () => new URLSearchParams(window.location.search).get("convite") ?? "";
const clearIncomingInvite = () => {
  const url = new URL(window.location.href);
  url.searchParams.delete("convite");
  window.history.replaceState(window.history.state, "", url.pathname + url.search + url.hash);
};

/** Executa uma ação assíncrona com bloqueio de duplo clique e mensagem de resultado. */
export function useAction() {
  const [busy, setBusy] = useState(false), [msg, setMsg] = useState<Msg>(null);
  const run = useCallback(async <T,>(fn: () => Promise<Res<T>>, okText?: string): Promise<Res<T> | null> => {
    if (busy) return null;
    setBusy(true); setMsg(null);
    const r = await fn();
    setBusy(false);
    setMsg(r.ok ? (okText ? { kind: "ok", text: okText } : null) : { kind: "err", text: r.error });
    return r;
  }, [busy]);
  return { busy, msg, setMsg, run };
}

/** Sem API de campanhas (só ocorre fora da porta de entrada, ex.: testes ou erro de configuração). */
function NeedLogin({ title }: { title: string; onOpen?: (s: TabSpec) => void }) {
  return <div className="auth"><h1>{title}</h1><div className="notice" role="status">Conta necessária para usar campanhas.</div></div>;
}

/** Hub: campanhas das quais participo, criar, entrar por convite, definir a ativa. */
export function CampaignsPanel({ onOpen }: { onOpen: (s: TabSpec, mode?: NavMode) => void }) {
  const { api, memberships, loading, error, activeId, setActive, refresh } = useCampaigns();
  const unsaved = useUnsaved();
  const [name, setName] = useState(""), [desc, setDesc] = useState(""), [code, setCode] = useState(incomingInvite);
  const create = useAction(), join = useAction();
  const [autoJoinError, setAutoJoinError] = useState<string | null>(null);
  const [autoJoining, setAutoJoining] = useState(false);
  const autoAttempted = useRef<string | null>(null);
  const invite = incomingInvite();

  const acceptInvite = useCallback(async (inviteCode: string) => {
    if (!api) return;
    const bad = validateCode(inviteCode);
    if (bad) { setAutoJoinError(bad); return; }
    setAutoJoining(true);
    setAutoJoinError(null);
    try {
      const result = await api.join(inviteCode);
      if (!result.ok) { setAutoJoinError(result.error); return; }
      clearIncomingInvite();
      setCode("");
      await refresh();
      if (await unsaved.confirmAll()) setActive(result.data);
      onOpen({ kind: "campanha", ref: result.data }, "new");
    } catch {
      setAutoJoinError("Não foi possível aceitar o convite. Tente novamente.");
    } finally {
      setAutoJoining(false);
    }
  }, [api, refresh, setActive, onOpen, unsaved]);

  useEffect(() => {
    if (!api || !invite || autoAttempted.current === invite) return;
    autoAttempted.current = invite;
    void acceptInvite(invite);
  }, [api, invite, acceptInvite]);

  if (!api) return <NeedLogin title="Campanhas"/>;

  const onCreate = async (e: FormEvent) => {
    e.preventDefault();
    const bad = validateCampaign(name, desc); if (bad) { create.setMsg({ kind: "err", text: bad }); return; }
    const r = await create.run(() => api.create(name.trim(), desc), "Campanha criada.");
    if (r?.ok) { setName(""); setDesc(""); await refresh(); if (await unsaved.confirmAll()) setActive(r.data); onOpen({ kind: "campanha", ref: r.data, title: name.trim() }, "new"); }
  };
  const onJoin = async (e: FormEvent) => {
    e.preventDefault();
    const entered = code.includes("convite=") ? (() => { try { return new URL(code).searchParams.get("convite") ?? code; } catch { return code; } })() : code;
    const bad = validateCode(entered); if (bad) { join.setMsg({ kind: "err", text: bad }); return; }
    const r = await join.run(() => api.join(entered), "Você entrou na campanha.");
    if (r?.ok) { setCode(""); clearIncomingInvite(); await refresh(); if (await unsaved.confirmAll()) setActive(r.data); onOpen({ kind: "campanha", ref: r.data }, "new"); }
  };

  return <div className="auth wide"><h1>Campanhas</h1>
    <p>Apenas uma campanha fica ativa por vez; cada uma tem o seu espaço de trabalho.</p>
    {loading && memberships.length === 0 && <p role="status">Carregando campanhas…</p>}
    {error && <div className="notice err" role="alert">{error} <button className="btn-link" onClick={() => void refresh()}>Tentar de novo</button></div>}
    {!loading && !error && memberships.length === 0 && <div className="notice">Você ainda não participa de nenhuma campanha. Crie uma ou entre com um convite.</div>}
    <ul className="camp-list">{memberships.map(({ campaign: c, role }) => <li key={c.id} className={c.id === activeId ? "camp active" : "camp"}>
      <div><strong>{c.name}</strong> <span className="badge">{role === "mestre" ? "Mestre" : "Jogador"}</span>{c.id === activeId && <span className="badge on">Ativa</span>}
        {c.description && <p>{c.description}</p>}</div>
      <div className="row">
        <button className="btn-secondary" onClick={() => onOpen({ kind: "campanha", ref: c.id, title: c.name })}>Abrir</button>
        {c.id !== activeId && <button className="btn-secondary" onClick={async () => { if (await unsaved.confirmAll()) setActive(c.id); }}>Tornar ativa</button>}
      </div></li>)}</ul>

    <h2>Criar campanha</h2>
    <form noValidate onSubmit={onCreate}>
      <label>Nome<input value={name} maxLength={MAX_NAME} onChange={e => setName(e.target.value)}/></label>
      <label>Descrição (opcional)<textarea value={desc} maxLength={MAX_DESCRIPTION} rows={3} onChange={e => setDesc(e.target.value)}/></label>
      <button className="btn-primary" disabled={create.busy}>{create.busy ? "Criando…" : "Criar campanha"}</button></form>
    <Notice m={create.msg}/>

    <h2>Entrar com convite</h2>
    {invite ? <div role="status" aria-live="polite">
      {autoJoining ? <p>Aceitando convite e abrindo campanha…</p> : autoJoinError ? <>
        <div className="notice err" role="alert">{autoJoinError}</div>
        <button className="btn-secondary" disabled={autoJoining} onClick={() => void acceptInvite(invite)}>Tentar novamente</button>
      </> : <p>Preparando entrada na campanha…</p>}
    </div> : <form noValidate onSubmit={onJoin}>
      <label>Código ou link do convite<input value={code} autoComplete="off" autoCapitalize="characters" onChange={e => setCode(e.target.value)}/></label>
      <button className="btn-primary" disabled={join.busy}>{join.busy ? "Entrando…" : "Entrar na campanha"}</button></form>}
    {!invite && <Notice m={join.msg}/>}
  </div>;
}

/** Ações do próprio participante, recolhidas num menu "…" (mesmo visual e fechamento dos outros menus). */
function MenuParticipante({ sair, desativado }: { sair: () => void; desativado: boolean }) {
  const [aberto, setAberto] = useState(false), menu = useRef<HTMLDivElement>(null), gatilho = useRef<HTMLButtonElement>(null);
  useFecharMenu(aberto, menu, gatilho, () => setAberto(false));
  return <div className="menu-participante">
    <button ref={gatilho} type="button" className="btn-secondary ini-icone" aria-label="Mais opções da sua participação" title="Mais opções" aria-expanded={aberto} disabled={desativado} onClick={() => setAberto(a => !a)}><Ellipsis size={16} aria-hidden="true"/></button>
    {aberto && <div ref={menu} className="barra-menu menu-participante-opcoes"><button type="button" className="btn-secondary menu-sair" onClick={() => { setAberto(false); sair(); }}><LogOut size={15} aria-hidden="true"/> Sair da campanha</button></div>}
  </div>;
}

/** Detalhes de uma campanha: dados básicos, participantes e convites. */
export function CampaignPanel({ id, onOpen, embedded = false, readOnly = false }: { id: string; onOpen: (s: TabSpec, mode?: NavMode) => void; embedded?: boolean; readOnly?: boolean }) {
  const { api, memberships, activeId, setActive, refresh } = useCampaigns();
  const unsaved = useUnsaved();
  const { user } = useAuth();
  const mem = memberships.find(m => m.campaign.id === id);
  const isMaster = mem?.role === "mestre";
  const [name, setName] = useState(mem?.campaign.name ?? ""), [desc, setDesc] = useState(mem?.campaign.description ?? "");
  const [members, setMembers] = useState<Member[] | null>(null), [invites, setInvites] = useState<Invite[]>([]);
  const [loadErr, setLoadErr] = useState<string | null>(null), [confirmDelete, setConfirmDelete] = useState(false);
  useEffect(() => { setName(mem?.campaign.name ?? ""); setDesc(mem?.campaign.description ?? ""); }, [mem?.campaign.name, mem?.campaign.description]);
  const save = useAction(), people = useAction(), inv = useAction(), danger = useAction();

  const load = useCallback(async () => {
    if (!api || !mem) return;
    if (typeof api.members !== "function") { setLoadErr("Participantes indisponíveis."); return; }
    const m = await api.members(id);
    if (!m.ok) { setLoadErr(m.error); return; }
    setLoadErr(null); setMembers(m.data);
    if (mem.role === "mestre" && !readOnly) { const i = await api.invites(id); if (i.ok) setInvites(i.data); }
  }, [api, id, mem?.role, readOnly]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { const refreshProfile = () => { void load(); }; void load(); window.addEventListener(PERFIL_ATUALIZADO, refreshProfile); return () => window.removeEventListener(PERFIL_ATUALIZADO, refreshProfile); }, [load]);

  if (!api) return <NeedLogin title="Campanha"/>;
  if (!mem) return <div className="auth"><h1>Campanha</h1><div className="notice">Você não participa desta campanha (ou ela foi removida).</div></div>;
  const c = mem.campaign;

  const onSave = async (e: FormEvent) => {
    e.preventDefault();
    const bad = validateCampaign(name, desc); if (bad) { save.setMsg({ kind: "err", text: bad }); return; }
    const r = await save.run(() => api.update(id, name, desc), "Informações salvas.");
    if (r?.ok) { await refresh(); onOpen({ kind: "campanha", ref: id, title: r.data.name }); }
  };
  const act = async (fn: () => Promise<Res<unknown>>, okText: string, target = people) => { const r = await target.run(fn, okText); if (r?.ok) { await load(); await refresh(); } };
  const leave = async (uid: string) => { const r = await people.run(() => api.removeMember(id, uid), "Feito."); if (r?.ok) { if (uid === user?.id && activeId === id) setActive(null); await refresh(); } };

  return <div className={embedded ? "campaign-admin" : "auth wide"}>{!embedded && <><h1>{c.name}</h1>
    <p><span className="badge">{isMaster ? "Mestre" : "Jogador"}</span>{c.id === activeId ? <span className="badge on">Ativa</span> : <button className="btn-link" onClick={async () => { if (await unsaved.confirmAll()) setActive(id); }}>Tornar ativa</button>}</p>

    <h2>Informações</h2>
    {isMaster ? <form noValidate onSubmit={onSave}>
      <label>Nome<input value={name} maxLength={MAX_NAME} onChange={e => setName(e.target.value)}/></label>
      <label>Descrição<textarea value={desc} maxLength={MAX_DESCRIPTION} rows={3} onChange={e => setDesc(e.target.value)}/></label>
      <button className="btn-secondary" disabled={save.busy}>{save.busy ? "Salvando…" : "Salvar informações"}</button></form>
      : <p>{c.description || "Sem descrição."}</p>}
    <Notice m={save.msg}/>

</>}

    <h2>Participantes</h2>
    {loadErr && <div className="notice err" role="alert">{loadErr} <button className="btn-link" onClick={() => void load()}>Tentar de novo</button></div>}
    {!members && !loadErr && <p role="status">Carregando participantes…</p>}
    <ul className="camp-list">{members?.map(m => <li key={m.user_id} className="camp">
      <div><strong>{m.display_name}</strong>{m.user_id === user?.id && " (você)"} <span className="badge">{m.role === "mestre" ? "Mestre" : "Jogador"}</span></div>
      <div className="row">
        {isMaster && !readOnly && m.user_id !== user?.id && <>
          <button className="btn-secondary" disabled={people.busy} onClick={() => leave(m.user_id)}>Remover</button></>}
        {m.user_id === user?.id && !isMaster && <MenuParticipante desativado={people.busy} sair={() => { if (window.confirm(`Sair da campanha "${c.name}"? Você deixará de ter acesso a ela e precisará de um novo convite para voltar.`)) void leave(m.user_id); }}/>}
      </div></li>)}</ul>
    <Notice m={people.msg}/>

    {isMaster && !readOnly && <><h2>Convites</h2>
      <p>Quem entra por convite é sempre jogador. Compartilhe o link só com quem deve participar.</p>
      <ul className="camp-list">{invites.map(i => <li key={i.id} className="camp">
        <div><code className="code">{inviteUrl(i.code)}</code> <span className="badge">{i.uses}/{i.max_uses} usos</span> <span className="badge">até {dateBr(i.expires_at)}</span></div>
        <div className="row">
          <button className="btn-secondary" onClick={() => void navigator.clipboard?.writeText(inviteUrl(i.code))}>Copiar link</button>
          <button className="btn-secondary" disabled={inv.busy} onClick={() => act(() => api.revokeInvite(i.id), "Convite revogado.", inv)}>Revogar</button></div></li>)}</ul>
      {invites.length === 0 && <p>Nenhum convite ativo.</p>}
      <button className="btn-primary" disabled={inv.busy} onClick={() => act(() => api.createInvite(id), "Convite criado.", inv)}>{inv.busy ? "Criando…" : "Criar convite"}</button>
      <Notice m={inv.msg}/>

      <h2>Zona de risco</h2>
      {!confirmDelete ? <button className="btn-secondary danger" onClick={() => setConfirmDelete(true)}>Excluir campanha</button>
        : <div className="notice err" role="alertdialog">Excluir “{c.name}” apaga participantes e convites e não pode ser desfeito.
          <div className="row"><button className="btn-secondary danger" disabled={danger.busy} onClick={async () => { const r = await danger.run(() => api.remove(id)); if (r?.ok) { if (activeId === id) setActive(null); await refresh(); } }}>Excluir definitivamente</button>
            <button className="btn-secondary" onClick={() => setConfirmDelete(false)}>Cancelar</button></div></div>}
      <Notice m={danger.msg}/></>}
  </div>;
}

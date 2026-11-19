// Diário: lista de registros de sessão (mestre: rascunhos e publicados; jogador: só publicados) e página de cada registro.
// O Diário é redigido manualmente pelo mestre; nada é resumido nem publicado automaticamente.
import { Eye, EyeOff, Plus, Trash2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useCampaigns } from "./CampaignsContext";
import { HARPTOS_MESES, formatarDataHarptos, primeiroParagrafo, resumirTexto, type DataHarptos } from "./inicio";
import { dataSessao, deBlocos, ordenarDiario, paraBlocos, publicado, validarTitulo, type Registro } from "./registros";
import { useRegistros } from "./RegistrosContext";
import { avisarRegistros, registrarTitulo, useVersaoRegistros } from "./registrosStore";
import { useUnsavedGuard } from "./unsaved";
import type { TabSpec } from "./workspace";

const Aviso = ({ t, erro }: { t: string; erro?: boolean }) => <div className={erro ? "notice err" : "notice"} role={erro ? "alert" : "status"}>{t}</div>;

export function DiarioPanel({ onOpenContent }: { onOpenContent: (s: TabSpec) => void }) {
  const api = useRegistros(), { active } = useCampaigns(), v = useVersaoRegistros();
  const [lista, setLista] = useState<Registro[] | null>(null), [erro, setErro] = useState<string | null>(null), [busy, setBusy] = useState(false);
  const cid = active?.campaign.id, mestre = active?.role === "mestre";
  useEffect(() => {
    if (!api || !cid) return; let vivo = true; setLista(null);
    api.list(cid, "diary").then(r => { if (!vivo) return; if (r.ok) { setLista(ordenarDiario(r.data)); setErro(null); } else setErro(r.error); });
    return () => { vivo = false; };
  }, [api, cid, v]);
  if (!active) return <div className="content"><h1>Diário</h1><Aviso t="O Diário pertence a uma campanha. Escolha uma campanha ativa na barra lateral."/></div>;
  if (!api) return <div className="content"><h1>Diário</h1><Aviso t="Conta necessária para usar o Diário."/></div>;
  const novo = async () => {
    if (busy || !cid) return; setBusy(true);
    const r = await api.create({ kind: "diary", campaignId: cid, title: "Nova sessão", visibility: "private", meta: {} });
    setBusy(false);
    if (!r.ok) { setErro(r.error); return; }
    avisarRegistros(); onOpenContent({ kind: "documento", ref: r.data.id, title: r.data.title });
  };
  return <div className="content diario">
    <div className="eyebrow">{active.campaign.name.toLocaleUpperCase("pt-BR")}</div>
    <div className="row-between"><h1>Diário</h1>{mestre && <button className="btn-primary" onClick={novo} disabled={busy}><Plus size={15} aria-hidden="true"/> Novo registro</button>}</div>
    {erro && <Aviso erro t={erro}/>}
    {!lista && !erro && <p role="status" className="muted">Carregando o Diário…</p>}
    {lista && lista.length === 0 && <p className="muted" data-testid="diario-lista-vazia">{mestre ? "Nenhum registro ainda. Crie o primeiro registro de sessão." : "O mestre ainda não publicou registros."}</p>}
    <ul className="registro-lista">{lista?.map(r => {
      const d = formatarDataHarptos(dataSessao(r)), t = primeiroParagrafo(r.content);
      return <li key={r.id}><button className="registro-item" onClick={() => onOpenContent({ kind: "documento", ref: r.id, title: r.title })}>
        <strong>{r.title}</strong>
        <span className="muted">{d ?? "Sem data de sessão"}{mestre && <span className={publicado(r) ? "badge on" : "badge"}>{publicado(r) ? "Publicado" : "Rascunho"}</span>}</span>
        {t && <span className="registro-previa">{resumirTexto(t, 200)}</span>}</button></li>;
    })}</ul>
  </div>;
}

const num = (s: string) => (s.trim() === "" ? NaN : Number(s));

export function RegistroPagina({ id }: { id: string }) {
  const api = useRegistros(), { active } = useCampaigns();
  const [reg, setReg] = useState<Registro | null | undefined>(undefined), [erro, setErro] = useState<string | null>(null);
  const [titulo, setTitulo] = useState(""), [texto, setTexto] = useState(""), [dia, setDia] = useState(""), [mes, setMes] = useState(""), [ano, setAno] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; t: string } | null>(null), [busy, setBusy] = useState(false), [confirmar, setConfirmar] = useState(false);
  const mestre = active?.role === "mestre";
  const carregar = useCallback(async () => {
    if (!api) return; const r = await api.get(id);
    if (!r.ok) { setErro(r.error); return; }
    setErro(null); setReg(r.data);
    if (r.data) { registrarTitulo(id, r.data.title); const d = dataSessao(r.data); setTitulo(r.data.title); setTexto(deBlocos(r.data.content)); setDia(d ? String(d.dia) : ""); setMes(d ? String(d.mes) : ""); setAno(d ? String(d.ano) : ""); }
  }, [api, id]);
  useEffect(() => { void carregar(); }, [carregar]);

  const diario = reg?.kind === "diary";
  const editavel = useMemo(() => !!reg && (reg.content ?? []).every(b => b.type === "paragraph"), [reg]);   // só edita o que o editor simples preserva por inteiro
  const dataMontada = (): { ok: true; d: DataHarptos | null } | { ok: false; t: string } => {
    if (!dia.trim() && !mes.trim() && !ano.trim()) return { ok: true, d: null };
    const d = { dia: num(dia), mes: num(mes), ano: num(ano) };
    return formatarDataHarptos(d) ? { ok: true, d } : { ok: false, t: "Data inválida: dia de 1 a 30, mês escolhido e ano numérico." };
  };
  const sujo = !!reg && mestre && (titulo !== reg.title || texto !== deBlocos(reg.content) || `${dia}|${mes}|${ano}` !== (() => { const d = dataSessao(reg); return d ? `${d.dia}|${d.mes}|${d.ano}` : "||"; })());
  useUnsavedGuard(`documento:${id}`, sujo);

  if (!api) return <div className="content"><Aviso t="Conta necessária."/></div>;
  if (erro) return <div className="content"><Aviso erro t={erro}/></div>;
  if (reg === undefined) return <div className="content"><p role="status" className="muted">Carregando…</p></div>;
  if (reg === null) return <div className="content"><h1>Registro</h1><Aviso t="Registro não encontrado ou sem permissão para vê-lo."/></div>;

  const salvar = async (patch: Partial<{ visibility: "private" | "campaign" }> = {}) => {
    const bad = validarTitulo(titulo); if (bad) { setMsg({ ok: false, t: bad }); return; }
    const dm = diario ? dataMontada() : { ok: true as const, d: null }; if (!dm.ok) { setMsg({ ok: false, t: dm.t }); return; }
    setBusy(true); setMsg(null);
    const meta = diario ? (() => { const { sessao: _antiga, ...resto } = reg.meta as { sessao?: unknown }; return dm.d ? { ...resto, sessao: dm.d } : resto; })() : reg.meta;
    const r = await api.update(reg.id, reg.version, { title: titulo, ...(editavel && { content: paraBlocos(texto) }), meta, ...patch });
    setBusy(false);
    if (!r.ok) { setMsg({ ok: false, t: r.error }); return; }
    registrarTitulo(reg.id, r.data.title); setReg(r.data); setMsg({ ok: true, t: patch.visibility ? (patch.visibility === "campaign" ? "Publicado para os jogadores." : "Voltou a ser rascunho.") : "Registro salvo." }); avisarRegistros();
  };
  const excluir = async () => { setBusy(true); const r = await api.remove(reg.id); setBusy(false); if (!r.ok) { setMsg({ ok: false, t: r.error }); return; } setReg(null); avisarRegistros(); };

  if (!mestre) {
    if (!diario) return <div className="content"><Aviso t="Registro não encontrado ou sem permissão para vê-lo."/></div>;
    const d = formatarDataHarptos(dataSessao(reg));
    return <div className="content registro"><div className="eyebrow">DIÁRIO</div><h1>{reg.title}</h1>{d && <time className="muted">{d}</time>}
      <div className="registro-corpo">{reg.content.filter(b => b.type === "paragraph").map((b, i) => <p key={i}>{deBlocos([b])}</p>)}</div></div>;
  }
  return <div className="content registro auth wide">
    <div className="eyebrow">{diario ? `DIÁRIO · ${publicado(reg) ? "PUBLICADO PARA OS JOGADORES" : "RASCUNHO (SÓ VOCÊ VÊ)"}` : "PLANEJAMENTO · CENA (PRIVADA)"}</div>
    <form noValidate onSubmit={e => { e.preventDefault(); void salvar(); }}>
      <label>Título<input value={titulo} maxLength={120} onChange={e => setTitulo(e.target.value)}/></label>
      {diario && <fieldset className="data-harptos"><legend>Data da sessão (calendário de Harptos)</legend>
        <label>Dia<input inputMode="numeric" value={dia} onChange={e => setDia(e.target.value)} aria-label="Dia"/></label>
        <label>Mês<select value={mes} onChange={e => setMes(e.target.value)} aria-label="Mês"><option value="">—</option>{HARPTOS_MESES.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}</select></label>
        <label>Ano (DR)<input inputMode="numeric" value={ano} onChange={e => setAno(e.target.value)} aria-label="Ano"/></label></fieldset>}
      {editavel
        ? <label>Texto do registro<textarea rows={14} value={texto} onChange={e => setTexto(e.target.value)} placeholder="Escreva o que aconteceu. Uma linha em branco separa os parágrafos."/></label>
        : <Aviso t="Este registro tem blocos (imagens, listas…) que o editor simples ainda não preserva; edite-o quando o editor rico estiver disponível. Título, data e publicação podem ser alterados."/>}
      <div className="row"><button className="btn-primary" disabled={busy}>{busy ? "Salvando…" : "Salvar"}</button>
        {diario && (publicado(reg)
          ? <button type="button" className="btn-secondary" disabled={busy || sujo} onClick={() => void salvar({ visibility: "private" })}><EyeOff size={15} aria-hidden="true"/> Despublicar</button>
          : <button type="button" className="btn-secondary" disabled={busy || sujo} onClick={() => void salvar({ visibility: "campaign" })}><Eye size={15} aria-hidden="true"/> Publicar para os jogadores</button>)}
        {!confirmar ? <button type="button" className="btn-secondary danger" onClick={() => setConfirmar(true)}><Trash2 size={15} aria-hidden="true"/> Excluir</button>
          : <><button type="button" className="btn-secondary danger" disabled={busy} onClick={() => void excluir()}>Confirmar exclusão</button><button type="button" className="btn-secondary" onClick={() => setConfirmar(false)}>Cancelar</button></>}</div>
      {diario && sujo && <p className="muted">Salve antes de publicar: a publicação usa o texto salvo.</p>}
      {msg && <Aviso erro={!msg.ok} t={msg.t}/>}
    </form>
  </div>;
}

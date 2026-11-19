// Diário: lista de registros de sessão (mestre: rascunhos e publicados; jogador: só publicados) e página de cada registro.
// A mesma página (`RegistroPagina`) edita as cenas do Planejamento. O Diário é redigido manualmente pelo mestre; nada é resumido nem publicado sozinho.
import { Eye, EyeOff, Plus, Trash2 } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useAbrirEmAba } from "./abrirEmAba";
import { ConflitoAviso } from "./ConflitoAviso";
import { useCampaigns } from "./CampaignsContext";
import { EditorLazy } from "./EditorLazy";
import { HARPTOS_MESES, formatarDataHarptos, previaTexto, resumirTexto, type BlocoTexto, type DataHarptos } from "./inicio";
import { dataSessao, ordenarDiario, publicado, validarTitulo, type Registro } from "./registros";
import { useRegistros } from "./RegistrosContext";
import { avisarRegistros, novaOrigem, publicarExclusao, publicarRegistro, registrarTitulo, useSincronia, useVersaoRegistros } from "./registrosStore";
import { useUnsavedGuard } from "./unsaved";
import type { TabSpec } from "./workspace";

export const Aviso = ({ t, erro, onRetry }: { t: string; erro?: boolean; onRetry?: () => void }) =>
  <div className={erro ? "notice err" : "notice"} role={erro ? "alert" : "status"}>{t}{onRetry && <> <button className="btn-link" onClick={onRetry}>Tentar de novo</button></>}</div>;

export function DiarioPanel({ onOpenContent }: { onOpenContent: (s: TabSpec) => void }) {
  const api = useRegistros(), { active } = useCampaigns(), v = useVersaoRegistros();
  const [lista, setLista] = useState<Registro[] | null>(null), [erro, setErro] = useState<string | null>(null), [busy, setBusy] = useState(false), [tentativa, setTentativa] = useState(0);
  const cid = active?.campaign.id, mestre = active?.role === "mestre", { aoClicarDireito } = useAbrirEmAba();
  useEffect(() => {
    if (!api || !cid) return; let vivo = true; setLista(null);
    api.list(cid, "diary").then(r => { if (!vivo) return; if (r.ok) { setLista(ordenarDiario(r.data)); setErro(null); } else setErro(r.error); });
    return () => { vivo = false; };
  }, [api, cid, v, tentativa]);
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
    {erro && <Aviso erro t={erro} onRetry={() => setTentativa(n => n + 1)}/>}
    {!lista && !erro && <p role="status" className="muted">Carregando o Diário…</p>}
    {lista && lista.length === 0 && <p className="muted" data-testid="diario-lista-vazia">{mestre ? "Nenhum registro ainda. Crie o primeiro registro de sessão." : "O mestre ainda não publicou registros."}</p>}
    <ul className="registro-lista">{lista?.map(r => {
      const d = formatarDataHarptos(dataSessao(r)), t = previaTexto(r.content, 500, "\n");
      return <li key={r.id}><button className="registro-item" onClick={() => onOpenContent({ kind: "documento", ref: r.id, title: r.title })} onContextMenu={e => aoClicarDireito(e, { kind: "documento", ref: r.id, title: r.title })}>
        <strong>{r.title}</strong>
        <span className="muted">{d ?? "Sem data de sessão"}{mestre && <span className={publicado(r) ? "badge on" : "badge"}>{publicado(r) ? "Publicado" : "Rascunho"}</span>}</span>
        {t && <span className="registro-previa">{resumirTexto(t, 200)}</span>}</button></li>;
    })}</ul>
  </div>;
}

const num = (s: string) => (s.trim() === "" ? NaN : Number(s));
const dataTxt = (r: Registro) => { const d = dataSessao(r); return d ? `${d.dia}|${d.mes}|${d.ano}` : "||"; };

/** Página de um registro (aba `documento:<id>`): diário ou cena. Mestre edita; jogador só lê o diário publicado. */
export function RegistroPagina({ id }: { id: string }) {
  const api = useRegistros(), { active } = useCampaigns();
  const origem = useRef(novaOrigem()).current;
  const [reg, setReg] = useState<Registro | null | undefined>(undefined), [erro, setErro] = useState<string | null>(null), [tentativa, setTentativa] = useState(0);
  const [titulo, setTitulo] = useState(""), [dia, setDia] = useState(""), [mes, setMes] = useState(""), [ano, setAno] = useState("");
  const [blocos, setBlocos] = useState<BlocoTexto[]>([]), [editou, setEditou] = useState(false), [chaveEditor, setChaveEditor] = useState(0);
  const [msg, setMsg] = useState<{ ok: boolean; t: string } | null>(null), [busy, setBusy] = useState(false), [confirmar, setConfirmar] = useState(false);
  const mestre = active?.role === "mestre";
  const aplicar = useCallback((r: Registro) => {
    setReg(r); registrarTitulo(id, r.title); setTitulo(r.title); setBlocos(r.content); setEditou(false);
    const d = dataSessao(r); setDia(d ? String(d.dia) : ""); setMes(d ? String(d.mes) : ""); setAno(d ? String(d.ano) : "");
  }, [id]);
  useEffect(() => {
    if (!api) return; let vivo = true;
    api.get(id).then(r => { if (!vivo) return; if (!r.ok) { setErro(r.error); return; } setErro(null); if (r.data) { aplicar(r.data); setChaveEditor(k => k + 1); } else setReg(null); });
    return () => { vivo = false; };
  }, [api, id, aplicar, tentativa]);

  const diario = reg?.kind === "diary";
  const sujo = !!reg && mestre && (editou || titulo !== reg.title || `${dia}|${mes}|${ano}` !== dataTxt(reg));
  useUnsavedGuard(`documento:${id}`, sujo);
  const sinc = useSincronia({ id, versao: reg?.version ?? 0, sujo, origem,
    aoRemoto: r => { aplicar(r); setChaveEditor(k => k + 1); },       // sem alterações locais: troca pelo dado salvo em outro lugar, sem F5
    aoExcluido: () => setReg(null),
    aoManter: r => setReg(x => x ? { ...x, version: r.version } : x) });   // mantém o que o usuário digitou; só passa a basear-se na versão nova

  if (!api) return <div className="content"><Aviso t="Conta necessária."/></div>;
  if (erro) return <div className="content"><Aviso erro t={erro} onRetry={() => setTentativa(n => n + 1)}/></div>;
  if (reg === undefined) return <div className="content"><p role="status" className="muted">Carregando…</p></div>;
  if (reg === null) return <div className="content"><h1>Registro</h1><Aviso t="Registro não encontrado, excluído ou sem permissão para vê-lo."/></div>;

  const dataMontada = (): { ok: true; d: DataHarptos | null } | { ok: false; t: string } => {
    if (!dia.trim() && !mes.trim() && !ano.trim()) return { ok: true, d: null };
    const d = { dia: num(dia), mes: num(mes), ano: num(ano) };
    return formatarDataHarptos(d) ? { ok: true, d } : { ok: false, t: "Data inválida: dia de 1 a 30, mês escolhido e ano numérico." };
  };
  const salvar = async (patch: Partial<{ visibility: "private" | "campaign" }> = {}) => {
    const bad = validarTitulo(titulo); if (bad) { setMsg({ ok: false, t: bad }); return; }
    const dm = diario ? dataMontada() : { ok: true as const, d: null }; if (!dm.ok) { setMsg({ ok: false, t: dm.t }); return; }
    setBusy(true); setMsg(null);
    const { sessao: _antiga, ...resto } = reg.meta as { sessao?: unknown };
    const meta = diario ? (dm.d ? { ...resto, sessao: dm.d } : resto) : reg.meta;
    const r = await api.update(reg.id, reg.version, { title: titulo, content: blocos, meta, ...patch });
    setBusy(false);
    if (!r.ok) {
      if (/alterou/i.test(r.error)) { const g = await api.get(reg.id); if (g.ok) sinc.sinalizar(g.data); }   // conflito com o servidor: mesmo caminho seguro
      setMsg({ ok: false, t: r.error }); return;
    }
    aplicar(r.data); setMsg({ ok: true, t: patch.visibility ? (patch.visibility === "campaign" ? "Publicado para os jogadores." : "Voltou a ser rascunho.") : "Registro salvo." }); publicarRegistro(r.data, origem);
  };
  const excluir = async () => { setBusy(true); const r = await api.remove(reg.id); setBusy(false); if (!r.ok) { setMsg({ ok: false, t: r.error }); return; } setReg(null); publicarExclusao(reg.id, origem); };

  if (!mestre) {
    if (!diario) return <div className="content"><Aviso t="Registro não encontrado, excluído ou sem permissão para vê-lo."/></div>;
    const d = formatarDataHarptos(dataSessao(reg));
    return <div className="content registro"><div className="eyebrow">DIÁRIO</div><h1>{reg.title}</h1>{d && <time className="muted">{d}</time>}
      <div className="registro-corpo"><EditorLazy key={reg.version} inicial={reg.content} editavel={false} rotulo="Texto do registro"/></div></div>;
  }
  return <div className="content registro auth wide">
    <div className="eyebrow">{diario ? `DIÁRIO · ${publicado(reg) ? "PUBLICADO PARA OS JOGADORES" : "RASCUNHO (SÓ VOCÊ VÊ)"}` : "PLANEJAMENTO · CENA (PRIVADA)"}</div>
    <form noValidate onSubmit={e => { e.preventDefault(); void salvar(); }}>
      <label>Título<input value={titulo} maxLength={120} onChange={e => setTitulo(e.target.value)}/></label>
      {diario && <fieldset className="data-harptos"><legend>Data da sessão (calendário de Harptos)</legend>
        <label>Dia<input inputMode="numeric" value={dia} onChange={e => setDia(e.target.value)} aria-label="Dia"/></label>
        <label>Mês<select value={mes} onChange={e => setMes(e.target.value)} aria-label="Mês"><option value="">—</option>{HARPTOS_MESES.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}</select></label>
        <label>Ano (DR)<input inputMode="numeric" value={ano} onChange={e => setAno(e.target.value)} aria-label="Ano"/></label></fieldset>}
      <div className="campo-editor"><span className="campo-rotulo">Texto do registro</span>
        <EditorLazy key={chaveEditor} inicial={blocos} rotulo="Texto do registro" onChange={b => { setBlocos(b); setEditou(true); }}/></div>
      <div className="row"><button className="btn-primary" disabled={busy}>{busy ? "Salvando…" : "Salvar"}</button>
        {diario && (publicado(reg)
          ? <button type="button" className="btn-secondary" disabled={busy || sujo} onClick={() => void salvar({ visibility: "private" })}><EyeOff size={15} aria-hidden="true"/> Despublicar</button>
          : <button type="button" className="btn-secondary" disabled={busy || sujo} onClick={() => void salvar({ visibility: "campaign" })}><Eye size={15} aria-hidden="true"/> Publicar para os jogadores</button>)}
        {!confirmar ? <button type="button" className="btn-secondary danger" onClick={() => setConfirmar(true)}><Trash2 size={15} aria-hidden="true"/> Excluir</button>
          : <><button type="button" className="btn-secondary danger" disabled={busy} onClick={() => void excluir()}>Confirmar exclusão</button><button type="button" className="btn-secondary" onClick={() => setConfirmar(false)}>Cancelar</button></>}</div>
      {diario && sujo && <p className="muted">Salve antes de publicar: a publicação usa o texto salvo.</p>}
      {sinc.conflito && <ConflitoAviso conflito={sinc.conflito} onUsarRemoto={sinc.usarRemoto} onManter={sinc.manterMinhas} onFechar={sinc.descartarAviso}/>}
      {msg && <Aviso erro={!msg.ok} t={msg.t}/>}
    </form>
  </div>;
}

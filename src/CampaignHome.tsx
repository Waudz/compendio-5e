// Início da campanha: capa, nome e descrição, prévia do Diário e Aventureiros. É a aba `campanha:<id>` (mesma entidade de sempre).
// Capa, Diário e Personagens ainda não têm módulo/persistência: cada seção recebe uma fonte opcional (ver inicio.ts) e,
// sem ela, mostra um estado honesto "ainda não disponível". Nada aqui inventa dados nem cria um segundo Diário.
import { BookOpen, Image as ImageIcon, Library, NotebookPen, Pencil, ScrollText, Users } from "lucide-react";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useAbrirEmAba } from "./abrirEmAba";
import { useAventureiros } from "./AventureirosContext";
import { fontePersonagens } from "./perfilPersonagem";
import { useCapa, useRegistros } from "./RegistrosContext";
import { validarCapa } from "./capa";
import { fonteDiario, useVersaoRegistros } from "./registrosStore";
import { CampaignPanel, Notice, useAction } from "./CampaignPanels";
import { useCampaigns } from "./CampaignsContext";
import { MAX_DESCRIPTION, MAX_NAME, validateCampaign, type Res } from "./campaigns";
import { formatarDataHarptos, maisRecenteVisivel, primeiroParagrafo, resumirTexto, type Aventureiro, type EntradaDiario, type FonteAventureiros, type FonteDiario } from "./inicio";
import type { NavMode } from "./navigation";
import { useUnsavedGuard } from "./unsaved";
import type { TabSpec } from "./workspace";

type Load<T> = { s: "carregando" } | { s: "erro"; msg: string } | { s: "ok"; data: T };

/** Carrega uma vez por (fonte, campanha); recarrega quando a chave muda. Sem fonte: nunca chama nada. */
function useFonte<T>(chave: string, carregar: (() => Promise<Res<T>>) | null): (Load<T> & { recarregar: () => void }) | null {
  const [st, setSt] = useState<Load<T>>({ s: "carregando" }), [tick, setTick] = useState(0);
  useEffect(() => {
    if (!carregar) return;
    let vivo = true; setSt({ s: "carregando" });
    carregar().then(r => { if (vivo) setSt(r.ok ? { s: "ok", data: r.data } : { s: "erro", msg: r.error }); })
      .catch(() => { if (vivo) setSt({ s: "erro", msg: "Não foi possível carregar." }); });
    return () => { vivo = false; };
  }, [chave, tick]); // eslint-disable-line react-hooks/exhaustive-deps
  return carregar ? { ...st, recarregar: () => setTick(n => n + 1) } : null;
}

function Capa({ campaignId, isMaster, editing, name, onEdit }: { campaignId: string; isMaster: boolean; editing: boolean; name: string; onEdit: () => void }) {
  const api = useCapa();
  const [url, setUrl] = useState<string | null>(null), [pronto, setPronto] = useState(false), [msg, setMsg] = useState<string | null>(null), [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!api) { setPronto(true); return; } let vivo = true; setPronto(false);
    api.obter(campaignId).then(r => { if (!vivo) return; if (r.ok) setUrl(r.data); else setMsg(r.error); setPronto(true); });
    return () => { vivo = false; };
  }, [api, campaignId]);
  const escolher = async (f: File | undefined) => {
    if (!f || !api) return; const bad = validarCapa(f); if (bad) { setMsg(bad); return; }
    setBusy(true); setMsg(null); const r = await api.definir(campaignId, f); setBusy(false);
    if (r.ok) setUrl(r.data); else setMsg(r.error);
  };
  const remover = async () => { if (!api) return; setBusy(true); setMsg(null); const r = await api.remover(campaignId); setBusy(false); if (r.ok) setUrl(null); else setMsg(r.error); };
  return <section className="home-cover-wrap" aria-label="Capa da campanha" data-testid="inicio-capa">
    <div className="home-cover">{url ? <img src={url} alt="Capa da campanha"/> : <div className="home-cover-empty"><ImageIcon size={26} aria-hidden="true"/><span>{pronto ? "Sem capa" : "Carregando…"}</span></div>}<h1 className="home-name">{name}</h1>{isMaster && <button type="button" className="home-edit" aria-label="Editar informações" title="Editar campanha" aria-expanded={editing} onClick={onEdit}><Pencil size={18}/></button>}</div>
    {isMaster && editing && api && <div className="home-cover-actions row">
      <label className="btn-secondary file-btn">{url ? "Substituir capa" : "Adicionar capa"}<input type="file" accept="image/jpeg,image/png,image/webp" hidden disabled={busy} onChange={e => { void escolher(e.target.files?.[0]); e.target.value = ""; }}/></label>
      {url && <button className="btn-secondary" disabled={busy} onClick={() => void remover()}>Remover capa</button>}
      {busy && <span className="muted" role="status">Enviando…</span>}</div>}
    {msg && <div className="notice err" role="alert">{msg}</div>}
  </section>;
}

function NomeDescricao({ id, onOpen, editing, setEditing }: { id: string; onOpen: (s: TabSpec, mode?: NavMode) => void; editing: boolean; setEditing: (v: boolean) => void }) {
  const { api, memberships, refresh } = useCampaigns();
  const mem = memberships.find(m => m.campaign.id === id);
  const c = mem?.campaign, isMaster = mem?.role === "mestre";
  const [name, setName] = useState(c?.name ?? ""), [desc, setDesc] = useState(c?.description ?? "");
  const save = useAction();
  useEffect(() => { if (!editing) { setName(c?.name ?? ""); setDesc(c?.description ?? ""); } }, [c?.name, c?.description, editing]);
  const dirty = editing && (name !== (c?.name ?? "") || desc !== (c?.description ?? ""));
  useUnsavedGuard(`campanha:${id}`, dirty);
  if (!c) return null;
  const onSave = async (e: FormEvent) => {
    e.preventDefault();
    const bad = validateCampaign(name, desc); if (bad) { save.setMsg({ kind: "err", text: bad }); return; }
    if (!api) return;
    const r = await save.run(() => api.update(id, name, desc), "Informações salvas.");
    if (r?.ok) { setEditing(false); await refresh(); onOpen({ kind: "campanha", ref: id, title: r.data.name }); }
  };
  return <section className="home-about" aria-label="Nome e descrição">
    {!isMaster || !editing
      ? <>{c.description ? <p className="home-desc">{c.description}</p> : <p className="home-desc muted">Sem descrição.</p>}
        </>
      : <form noValidate onSubmit={onSave} className="home-form">
        <label>Nome<input value={name} maxLength={MAX_NAME} onChange={e => setName(e.target.value)}/></label>
        <label>Descrição<textarea value={desc} maxLength={MAX_DESCRIPTION} rows={4} onChange={e => setDesc(e.target.value)}/></label>
        <div className="row"><button className="btn-secondary" disabled={save.busy}>{save.busy ? "Salvando…" : "Salvar informações"}</button>
          <button type="button" className="btn-secondary" onClick={() => { setEditing(false); save.setMsg(null); }}>Cancelar</button></div></form>}
    <Notice m={save.msg}/>
  </section>;
}

export function DiarioPrevia({ campaignId, isMaster, fonte, onOpenContent }: { campaignId: string; isMaster: boolean; fonte?: FonteDiario; onOpenContent: (s: TabSpec) => void }) {
  const papel = isMaster ? "mestre" : "jogador", { aoClicarDireito } = useAbrirEmAba();
  const v = useVersaoRegistros();   // recarrega a prévia quando o Diário muda
  const st = useFonte(`${campaignId}|${papel}|${v}`, fonte ? () => fonte.maisRecente(campaignId, papel) : null);
  let corpo;
  if (!st) corpo = <p className="muted" data-testid="diario-indisponivel">O Diário ainda não está disponível nesta versão.</p>;
  else if (st.s === "carregando") corpo = <p className="muted" role="status">Carregando o Diário…</p>;
  else if (st.s === "erro") corpo = <div className="notice err" role="alert">{st.msg} <button className="btn-link" onClick={st.recarregar}>Tentar de novo</button></div>;
  else {
    const e: EntradaDiario | null = st.data ? maisRecenteVisivel([st.data], papel) : null;   // defesa: jogador nunca vê não publicada
    if (!e) corpo = <p className="muted" data-testid="diario-vazio">Nenhum registro no Diário ainda.</p>;
    else {
      const data = formatarDataHarptos(e.dataSessao), texto = primeiroParagrafo(e.conteudo);
      corpo = <article className="home-diario-entry">
        <h3>{e.titulo}</h3>{data && <time className="muted">{data}</time>}{isMaster && !e.publicada && <span className="badge" title="Só você vê este registro">Rascunho</span>}
        {texto && <p>{resumirTexto(texto)}</p>}
        <button className="btn-link" onClick={() => onOpenContent({ kind: "documento", ref: e.id, title: e.titulo })} onContextMenu={ev => aoClicarDireito(ev, { kind: "documento", ref: e.id, title: e.titulo })}>Ver registro completo</button></article>;
    }
  }
  return <section className="home-sec" aria-label="Diário"><h2><ScrollText size={16} aria-hidden="true"/> Diário</h2>{corpo}</section>;
}

export function Aventureiros({ campaignId, fonte, onOpenContent }: { campaignId: string; fonte?: FonteAventureiros; onOpenContent: (s: TabSpec) => void }) {
  const { aoClicarDireito } = useAbrirEmAba();
  const st = useFonte(campaignId, fonte ? () => fonte.listar(campaignId) : null);
  let corpo;
  if (!st) corpo = <p className="muted" data-testid="aventureiros-indisponivel">Os personagens ainda não estão disponíveis nesta versão.</p>;
  else if (st.s === "carregando") corpo = <p className="muted" role="status">Carregando aventureiros…</p>;
  else if (st.s === "erro") corpo = <div className="notice err" role="alert">{st.msg} <button className="btn-link" onClick={st.recarregar}>Tentar de novo</button></div>;
  else if (st.data.length === 0) corpo = <p className="muted" data-testid="aventureiros-vazio">Nenhum aventureiro vinculado a esta campanha.</p>;
  else corpo = <ul className="home-party">{st.data.map((a: Aventureiro) => <li key={a.id}>
    <button className="home-char" onClick={() => onOpenContent({ kind: "ficha", ref: a.id, title: `Ficha: ${a.nome}` })} onContextMenu={ev => aoClicarDireito(ev, { kind: "ficha", ref: a.id, title: `Ficha: ${a.nome}` })} title={`Abrir ficha de ${a.nome}`}>
      {a.retratoUrl ? <img src={a.retratoUrl} alt="" loading="lazy"/> : <span className="home-portrait" aria-hidden="true">{a.nome.slice(0, 1).toLocaleUpperCase("pt-BR")}</span>}
      <span><strong>{a.nome}</strong>{" "}<small>{a.classe}{a.nivel != null ? ` · nível ${a.nivel}` : ""}</small></span></button></li>)}</ul>;
  return <section className="home-sec" aria-label="Aventureiros"><h2><Users size={16} aria-hidden="true"/> Aventureiros</h2>{corpo}</section>;
}

/** Aba `campanha:<id>`. Mestre e jogador usam a mesma página; só o mestre vê edição e a gestão (convites/exclusão). */
export function CampaignHome({ id, onOpen, onOpenContent, diario, aventureiros }: {
  id: string; onOpen: (s: TabSpec, mode?: NavMode) => void; onOpenContent: (s: TabSpec) => void;
  diario?: FonteDiario; aventureiros?: FonteAventureiros;
}) {
  const { api, memberships } = useCampaigns();
  const mem = memberships.find(m => m.campaign.id === id);
  const regApi = useRegistros(), capaApi = useCapa(), fonteCtx = useAventureiros();
  const fonteAv = useMemo(() => fonteCtx ?? (regApi ? fontePersonagens(regApi, capaApi) : null), [fonteCtx, regApi, capaApi]);
  const diarioFonte = useMemo(() => diario ?? (regApi ? fonteDiario(regApi) : undefined), [diario, regApi]);
  const [editing, setEditing] = useState(false);
  const [gerir, setGerir] = useState(false);   // participantes/convites só são carregados quando a seção é aberta (evita consultas à toa)
  if (!api) return <div className="auth"><h1>Campanha</h1><div className="notice" role="status">Conta necessária para usar campanhas.</div></div>;
  if (!mem) return <div className="auth"><h1>Campanha</h1><div className="notice" role="status">Você não participa desta campanha (ou ela foi removida).</div></div>;
  const isMaster = mem.role === "mestre";
  return <div className="home" data-testid="campanha-inicio">
    <Capa campaignId={id} isMaster={isMaster} name={mem.campaign.name} editing={editing} onEdit={() => setEditing(true)}/>
    <NomeDescricao id={id} onOpen={onOpen} editing={editing} setEditing={setEditing}/>
    {isMaster && editing && <section className="home-sec"><CampaignPanel id={id} onOpen={onOpen} embedded/></section>}
    {isMaster && <nav className="home-shortcuts" aria-label="Atalhos da campanha">
      <button type="button" onClick={() => onOpen({kind:"secao",ref:"planejamento"})}><NotebookPen size={19} aria-hidden="true"/> Anotações</button>
      <button type="button" onClick={() => onOpen({kind:"secao",ref:"enciclopedia"})}><BookOpen size={19} aria-hidden="true"/> Enciclopédia</button>
      <button type="button" onClick={() => onOpen({kind:"secao",ref:"compendio"})}><BookOpen size={19} aria-hidden="true"/> Compêndio</button>
      <button type="button" onClick={() => onOpen({kind:"secao",ref:"personagens"})}><Users size={19} aria-hidden="true"/> Personagens</button>
      <button type="button" onClick={() => onOpen({kind:"secao",ref:"diario"})}><Library size={19} aria-hidden="true"/> Diário</button>
    </nav>}
    <div className="home-columns"><DiarioPrevia campaignId={id} isMaster={isMaster} fonte={diarioFonte} onOpenContent={onOpenContent}/>
    <Aventureiros campaignId={id} fonte={aventureiros ?? fonteAv ?? undefined} onOpenContent={onOpenContent}/></div>
    {!isMaster && <details className="home-manage" onToggle={e => setGerir((e.currentTarget as HTMLDetailsElement).open)}><summary>{isMaster ? "Gerenciar campanha" : "Participantes"}</summary>
      {gerir && <CampaignPanel id={id} onOpen={onOpen} embedded/>}</details>}
  </div>;
}

// Início da campanha: capa, nome e descrição, prévia do Diário e Aventureiros. É a aba `campanha:<id>` (mesma entidade de sempre).
// Capa, Diário e Personagens ainda não têm módulo/persistência: cada seção recebe uma fonte opcional (ver inicio.ts) e,
// sem ela, mostra um estado honesto "ainda não disponível". Nada aqui inventa dados nem cria um segundo Diário.
import { Image as ImageIcon, ScrollText, Users } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { CampaignPanel, Notice, useAction } from "./CampaignPanels";
import { useCampaigns } from "./CampaignsContext";
import { MAX_DESCRIPTION, MAX_NAME, validateCampaign, type Res } from "./campaigns";
import { formatarDataHarptos, maisRecenteVisivel, primeiroParagrafo, resumirTexto, type Aventureiro, type EntradaDiario, type FonteAventureiros, type FonteDiario } from "./inicio";
import type { NavMode } from "./navigation";
import { useUnsavedGuard } from "./unsaved";
import type { TabSpec } from "./workspace";

type Load<T> = { s: "carregando" } | { s: "erro"; msg: string } | { s: "ok"; data: T };

/** Carrega uma vez por (fonte, campanha); recarrega quando a chave muda. Sem fonte: nunca chama nada. */
function useFonte<T>(chave: string, carregar: (() => Promise<Res<T>>) | null): Load<T> | null {
  const [st, setSt] = useState<Load<T>>({ s: "carregando" });
  useEffect(() => {
    if (!carregar) return;
    let vivo = true; setSt({ s: "carregando" });
    carregar().then(r => { if (vivo) setSt(r.ok ? { s: "ok", data: r.data } : { s: "erro", msg: r.error }); })
      .catch(() => { if (vivo) setSt({ s: "erro", msg: "Não foi possível carregar." }); });
    return () => { vivo = false; };
  }, [chave]); // eslint-disable-line react-hooks/exhaustive-deps
  return carregar ? st : null;
}

function Capa({ isMaster }: { isMaster: boolean }) {
  return <section className="home-cover" aria-label="Capa da campanha" data-testid="inicio-capa">
    <div className="home-cover-empty"><ImageIcon size={26} aria-hidden="true"/><span>Sem capa</span>
      {isMaster && <small>A escolha da imagem de capa depende do armazenamento de imagens, ainda não disponível.</small>}</div>
  </section>;
}

function NomeDescricao({ id, onOpen }: { id: string; onOpen: (s: TabSpec, mode?: NavMode) => void }) {
  const { api, memberships, refresh } = useCampaigns();
  const mem = memberships.find(m => m.campaign.id === id);
  const c = mem?.campaign, isMaster = mem?.role === "mestre";
  const [name, setName] = useState(c?.name ?? ""), [desc, setDesc] = useState(c?.description ?? "");
  const [editing, setEditing] = useState(false);
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
    <h1 className="home-name">{c.name}</h1>
    {!isMaster || !editing
      ? <>{c.description ? <p className="home-desc">{c.description}</p> : <p className="home-desc muted">Sem descrição.</p>}
        {isMaster && <button className="btn-secondary" onClick={() => setEditing(true)}>Editar informações</button>}</>
      : <form noValidate onSubmit={onSave} className="home-form">
        <label>Nome<input value={name} maxLength={MAX_NAME} onChange={e => setName(e.target.value)}/></label>
        <label>Descrição<textarea value={desc} maxLength={MAX_DESCRIPTION} rows={4} onChange={e => setDesc(e.target.value)}/></label>
        <div className="row"><button className="btn-secondary" disabled={save.busy}>{save.busy ? "Salvando…" : "Salvar informações"}</button>
          <button type="button" className="btn-secondary" onClick={() => { setEditing(false); save.setMsg(null); }}>Cancelar</button></div></form>}
    <Notice m={save.msg}/>
  </section>;
}

export function DiarioPrevia({ campaignId, isMaster, fonte, onOpenContent }: { campaignId: string; isMaster: boolean; fonte?: FonteDiario; onOpenContent: (s: TabSpec) => void }) {
  const papel = isMaster ? "mestre" : "jogador";
  const st = useFonte(`${campaignId}|${papel}`, fonte ? () => fonte.maisRecente(campaignId, papel) : null);
  let corpo;
  if (!st) corpo = <p className="muted" data-testid="diario-indisponivel">O Diário ainda não está disponível nesta versão.</p>;
  else if (st.s === "carregando") corpo = <p className="muted" role="status">Carregando o Diário…</p>;
  else if (st.s === "erro") corpo = <div className="notice err" role="alert">{st.msg}</div>;
  else {
    const e: EntradaDiario | null = st.data ? maisRecenteVisivel([st.data], papel) : null;   // defesa: jogador nunca vê não publicada
    if (!e) corpo = <p className="muted" data-testid="diario-vazio">Nenhum registro no Diário ainda.</p>;
    else {
      const data = formatarDataHarptos(e.dataSessao), texto = primeiroParagrafo(e.conteudo);
      corpo = <article className="home-diario-entry">
        <h3>{e.titulo}</h3>{data && <time className="muted">{data}</time>}
        {texto && <p>{resumirTexto(texto)}</p>}
        <button className="btn-link" onClick={() => onOpenContent({ kind: "documento", ref: e.id, title: e.titulo })}>Ver registro completo</button></article>;
    }
  }
  return <section className="home-sec" aria-label="Diário"><h2><ScrollText size={16} aria-hidden="true"/> Último registro do Diário</h2>{corpo}</section>;
}

export function Aventureiros({ campaignId, fonte, onOpenContent }: { campaignId: string; fonte?: FonteAventureiros; onOpenContent: (s: TabSpec) => void }) {
  const st = useFonte(campaignId, fonte ? () => fonte.listar(campaignId) : null);
  let corpo;
  if (!st) corpo = <p className="muted" data-testid="aventureiros-indisponivel">Os personagens ainda não estão disponíveis nesta versão.</p>;
  else if (st.s === "carregando") corpo = <p className="muted" role="status">Carregando aventureiros…</p>;
  else if (st.s === "erro") corpo = <div className="notice err" role="alert">{st.msg}</div>;
  else if (st.data.length === 0) corpo = <p className="muted" data-testid="aventureiros-vazio">Nenhum aventureiro vinculado a esta campanha.</p>;
  else corpo = <ul className="home-party">{st.data.map((a: Aventureiro) => <li key={a.id}>
    <button className="home-char" onClick={() => onOpenContent({ kind: "ficha", ref: a.id, title: `Ficha: ${a.nome}` })} aria-label={`Abrir ficha de ${a.nome}`}>
      {a.retratoUrl ? <img src={a.retratoUrl} alt="" loading="lazy"/> : <span className="home-portrait" aria-hidden="true">{a.nome.slice(0, 1).toLocaleUpperCase("pt-BR")}</span>}
      <span><strong>{a.nome}</strong><small>{a.classe} · nível {a.nivel}</small></span></button></li>)}</ul>;
  return <section className="home-sec" aria-label="Aventureiros"><h2><Users size={16} aria-hidden="true"/> Aventureiros</h2>{corpo}</section>;
}

/** Aba `campanha:<id>`. Mestre e jogador usam a mesma página; só o mestre vê edição e a gestão (convites/exclusão). */
export function CampaignHome({ id, onOpen, onOpenContent, diario, aventureiros }: {
  id: string; onOpen: (s: TabSpec, mode?: NavMode) => void; onOpenContent: (s: TabSpec) => void;
  diario?: FonteDiario; aventureiros?: FonteAventureiros;
}) {
  const { api, memberships } = useCampaigns();
  const mem = memberships.find(m => m.campaign.id === id);
  const [gerir, setGerir] = useState(false);   // participantes/convites só são carregados quando a seção é aberta (evita consultas à toa)
  if (!api) return <div className="auth"><h1>Campanha</h1><div className="notice" role="status">Conta necessária para usar campanhas.</div></div>;
  if (!mem) return <div className="auth"><h1>Campanha</h1><div className="notice" role="status">Você não participa desta campanha (ou ela foi removida).</div></div>;
  const isMaster = mem.role === "mestre";
  return <div className="home" data-testid="campanha-inicio">
    <Capa isMaster={isMaster}/>
    <NomeDescricao id={id} onOpen={onOpen}/>
    <DiarioPrevia campaignId={id} isMaster={isMaster} fonte={diario} onOpenContent={onOpenContent}/>
    <Aventureiros campaignId={id} fonte={aventureiros} onOpenContent={onOpenContent}/>
    <details className="home-manage" onToggle={e => setGerir((e.currentTarget as HTMLDetailsElement).open)}><summary>{isMaster ? "Gerenciar campanha" : "Participantes"}</summary>
      {gerir && <CampaignPanel id={id} onOpen={onOpen} embedded/>}</details>
  </div>;
}

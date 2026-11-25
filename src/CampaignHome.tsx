// Início da campanha: capa, nome e descrição, prévia do Diário e Aventureiros. É a aba `campanha:<id>` (mesma entidade de sempre).
// Capa, Diário e Personagens ainda não têm módulo/persistência: cada seção recebe uma fonte opcional (ver inicio.ts) e,
// sem ela, mostra um estado honesto "ainda não disponível". Nada aqui inventa dados nem cria um segundo Diário.
import { BookOpen, Library, NotebookPen, Pencil, ScrollText, Users, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { EditorCapa, FaixaCapa, useCapaCampanha, type EstadoCapa } from "./CapaCampanha";
import { RetratoQuadrado } from "./RetratoCombate";
import { useAbrirEmAba } from "./abrirEmAba";
import { useAventureiros } from "./AventureirosContext";
import { fontePersonagens } from "./perfilPersonagem";
import { useCapa, useRegistros } from "./RegistrosContext";
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

function InformacoesForm({ id, onOpen, fechar, aoSujar }: { id: string; onOpen: (s: TabSpec, mode?: NavMode) => void; fechar: () => void; aoSujar: (sujo: boolean) => void }) {
  const { api, memberships, refresh } = useCampaigns();
  const c = memberships.find(m => m.campaign.id === id)?.campaign;
  const [name, setName] = useState(c?.name ?? ""), [desc, setDesc] = useState(c?.description ?? "");
  const save = useAction();
  const dirty = name !== (c?.name ?? "") || desc !== (c?.description ?? "");
  useEffect(() => { aoSujar(dirty); return () => aoSujar(false); }, [dirty, aoSujar]);
  if (!c) return null;
  const onSave = async (e: FormEvent) => {
    e.preventDefault();
    const bad = validateCampaign(name, desc); if (bad) { save.setMsg({ kind: "err", text: bad }); return; }
    if (!api) return;
    const r = await save.run(() => api.update(id, name, desc), "Informações salvas.");
    if (r?.ok) { await refresh(); onOpen({ kind: "campanha", ref: id, title: r.data.name }); fechar(); }
  };
  return <form noValidate onSubmit={onSave} className="home-form">
    <label>Nome<input value={name} maxLength={MAX_NAME} onChange={e => setName(e.target.value)}/></label>
    <label>Descrição<textarea value={desc} maxLength={MAX_DESCRIPTION} rows={4} onChange={e => setDesc(e.target.value)}/></label>
    <div className="row"><button className="btn-secondary" disabled={save.busy}>{save.busy ? "Salvando…" : "Salvar informações"}</button>
      <button type="button" className="btn-secondary" onClick={fechar}>Cancelar</button></div>
    <Notice m={save.msg}/>
  </form>;
}

/** Único lugar de configuração da campanha (só o mestre): informações, capa e enquadramento, participantes, convites e exclusão. */
function EditarCampanha({ id, capa, onOpen, fechar, sujo, aoSujar }: { id: string; capa: EstadoCapa; onOpen: (s: TabSpec, mode?: NavMode) => void; fechar: () => void; sujo: boolean; aoSujar: (v: boolean) => void }) {
  const dialogo = useRef<HTMLDialogElement>(null);
  useEffect(() => { if (!dialogo.current?.open) dialogo.current?.showModal(); }, []);
  const sair = () => { capa.descartar(); fechar(); };
  // fechar pelo X ou por Escape confirma antes de descartar o que não foi salvo
  const pedirSaida = () => { if ((sujo || capa.alterado) && !window.confirm("Descartar as alterações não salvas?")) return; sair(); };
  return <dialog ref={dialogo} className="ini-dialogo campanha-dialogo" aria-label="Editar campanha" onCancel={e => { e.preventDefault(); pedirSaida(); }}>
    <header><h2>Editar campanha</h2><button type="button" className="btn-secondary ini-icone" aria-label="Fechar edição" title="Fechar" onClick={pedirSaida}><X size={16} aria-hidden="true"/></button></header>
    <section aria-label="Informações da campanha"><h3>Informações</h3><InformacoesForm id={id} onOpen={onOpen} fechar={sair} aoSujar={aoSujar}/></section>
    <section aria-label="Imagem e enquadramento"><h3>Imagem da capa</h3><EditorCapa capa={capa}/></section>
    <section aria-label="Participantes e convites"><CampaignPanel id={id} onOpen={onOpen} embedded/></section>
  </dialog>;
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
      <RetratoQuadrado src={a.retratoUrl} tipo="personagem" tamanho={72}/>
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
  const capa = useCapaCampanha(id);
  const [formSujo, setFormSujo] = useState(false);
  useUnsavedGuard(`campanha:${id}`, editing && (formSujo || capa.alterado));   // texto ou enquadramento ainda não salvos
  useEffect(() => { setEditing(false); }, [id]);
  if (!api) return <div className="auth"><h1>Campanha</h1><div className="notice" role="status">Conta necessária para usar campanhas.</div></div>;
  if (!mem) return <div className="auth"><h1>Campanha</h1><div className="notice" role="status">Você não participa desta campanha (ou ela foi removida).</div></div>;
  const isMaster = mem.role === "mestre", descricao = mem.campaign.description;
  return <div className="home" data-testid="campanha-inicio">
    <FaixaCapa capa={capa} nome={mem.campaign.name} acao={isMaster && <button type="button" className="home-edit" aria-label="Editar informações" title="Editar campanha" aria-haspopup="dialog" onClick={() => setEditing(true)}><Pencil size={14} aria-hidden="true"/> Editar</button>}/>
    {capa.msg && !editing && <div className="notice err" role="alert">{capa.msg}</div>}
    <p className={descricao ? "home-desc" : "home-desc muted"}>{descricao || "Sem descrição."}</p>
    {isMaster && <nav className="home-shortcuts" aria-label="Atalhos da campanha">
      <button type="button" onClick={() => onOpen({kind:"secao",ref:"planejamento"})}><NotebookPen size={16} aria-hidden="true"/> Anotações</button>
      <button type="button" onClick={() => onOpen({kind:"secao",ref:"enciclopedia"})}><BookOpen size={16} aria-hidden="true"/> Enciclopédia</button>
      <button type="button" onClick={() => onOpen({kind:"secao",ref:"compendio"})}><BookOpen size={16} aria-hidden="true"/> Compêndio</button>
      <button type="button" onClick={() => onOpen({kind:"secao",ref:"personagens"})}><Users size={16} aria-hidden="true"/> Personagens</button>
      <button type="button" onClick={() => onOpen({kind:"secao",ref:"diario"})}><Library size={16} aria-hidden="true"/> Diário</button>
    </nav>}
    <Aventureiros campaignId={id} fonte={aventureiros ?? fonteAv ?? undefined} onOpenContent={onOpenContent}/>
    <div className="home-columns">
      <DiarioPrevia campaignId={id} isMaster={isMaster} fonte={diarioFonte} onOpenContent={onOpenContent}/>
      <div className="home-people">{!editing && <CampaignPanel id={id} onOpen={onOpen} embedded readOnly={isMaster}/>}</div>
    </div>
    {isMaster && editing && <EditarCampanha id={id} capa={capa} onOpen={onOpen} fechar={() => setEditing(false)} sujo={formSujo} aoSujar={setFormSujo}/>}
  </div>;
}

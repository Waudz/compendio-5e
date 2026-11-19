// Personagens da campanha: lista (retrato, nome, classe, nível) e perfil de cada um. Qualquer participante cria o seu; só o dono edita.
// Visível para a campanha = publicado; privado = só o dono vê. A ficha completa (atributos, magias, inventário) ainda não existe.
import { Plus, Trash2, UserRound } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useAbrirEmAba } from "./abrirEmAba";
import { Aviso } from "./Diario";
import { useAuth } from "./AuthContext";
import { useCampaigns } from "./CampaignsContext";
import { NIVEL_MAX, NIVEL_MIN, lerPerfil, ordenarPersonagens, validarPerfil } from "./perfilPersonagem";
import { validarCapa } from "./capa";
import type { Registro } from "./registros";
import { useCapa, useRegistros } from "./RegistrosContext";
import { avisarRegistros, registrarTitulo, useVersaoRegistros } from "./registrosStore";
import { useUnsavedGuard } from "./unsaved";
import type { TabSpec } from "./workspace";

/** Retrato com URL temporária; sem retrato (ou se falhar) mostra a inicial. */
function Retrato({ caminho, nome, tamanho = 44 }: { caminho: string | null; nome: string; tamanho?: number }) {
  const capa = useCapa(); const [url, setUrl] = useState<string | null>(null);
  useEffect(() => { setUrl(null); if (!caminho || !capa) return; let vivo = true; void capa.urlDe(caminho).then(r => { if (vivo && r.ok) setUrl(r.data); }); return () => { vivo = false; }; }, [caminho, capa]);
  return url ? <img className="retrato" src={url} alt="" width={tamanho} height={tamanho}/> : <span className="retrato retrato-inicial" style={{ width: tamanho, height: tamanho }} aria-hidden="true">{nome.slice(0, 1).toLocaleUpperCase("pt-BR") || <UserRound size={18}/>}</span>;
}

export function PersonagensPanel({ onOpenContent }: { onOpenContent: (s: TabSpec) => void }) {
  const api = useRegistros(), { active } = useCampaigns(), { user } = useAuth(), v = useVersaoRegistros(), { aoClicarDireito } = useAbrirEmAba();
  const [lista, setLista] = useState<Registro[] | null>(null), [erro, setErro] = useState<string | null>(null), [busy, setBusy] = useState(false), [tentativa, setTentativa] = useState(0);
  const cid = active?.campaign.id;
  useEffect(() => {
    if (!api || !cid) return; let vivo = true; setLista(null);
    api.list(cid, "character").then(r => { if (!vivo) return; if (r.ok) { setLista(ordenarPersonagens(r.data)); setErro(null); } else setErro(r.error); });
    return () => { vivo = false; };
  }, [api, cid, v, tentativa]);
  if (!active) return <div className="content"><h1>Personagens</h1><Aviso t="Os personagens pertencem a uma campanha. Escolha uma campanha ativa na barra lateral."/></div>;
  if (!api) return <div className="content"><h1>Personagens</h1><Aviso t="Conta necessária para usar os personagens."/></div>;
  const novo = async () => {
    if (busy || !cid) return; setBusy(true);
    const r = await api.create({ kind: "character", campaignId: cid, title: "Novo personagem", visibility: "private", meta: { classe: "", nivel: 1 } });
    setBusy(false);
    if (!r.ok) { setErro(r.error); return; }
    avisarRegistros(); onOpenContent({ kind: "ficha", ref: r.data.id, title: r.data.title });
  };
  return <div className="content personagens">
    <div className="eyebrow">{active.campaign.name.toLocaleUpperCase("pt-BR")}</div>
    <div className="row-between"><h1>Personagens</h1><button className="btn-primary" onClick={novo} disabled={busy}><Plus size={15} aria-hidden="true"/> Novo personagem</button></div>
    <p>Cada participante cria o próprio personagem. Só o dono edita; “visível para a campanha” aparece no Início.</p>
    {erro && <Aviso erro t={erro} onRetry={() => setTentativa(n => n + 1)}/>}
    {!lista && !erro && <p className="muted" role="status">Carregando personagens…</p>}
    {lista && lista.length === 0 && <p className="muted" data-testid="personagens-vazio">Nenhum personagem ainda. Crie o primeiro.</p>}
    <ul className="home-party">{lista?.map(r => { const p = lerPerfil(r.meta); return <li key={r.id}>
      <button className="home-char" onClick={() => onOpenContent({ kind: "ficha", ref: r.id, title: r.title })} onContextMenu={e => aoClicarDireito(e, { kind: "ficha", ref: r.id, title: r.title })} aria-label={`Abrir ficha de ${r.title}`}>
        <Retrato caminho={p.retrato} nome={r.title}/>
        <span><strong>{r.title}</strong><small>{p.classe || "Sem classe"} · nível {p.nivel}{r.ownerId === user?.id ? " · seu" : ""}{r.visibility === "private" ? " · privado" : ""}</small></span></button></li>; })}</ul>
  </div>;
}

/** Aba `ficha:<id>`: perfil do personagem. Dono edita; os demais só leem. */
export function FichaPagina({ id }: { id: string }) {
  const api = useRegistros(), capa = useCapa(), { user } = useAuth();
  const [reg, setReg] = useState<Registro | null | undefined>(undefined), [erro, setErro] = useState<string | null>(null), [tentativa, setTentativa] = useState(0);
  const [nome, setNome] = useState(""), [classe, setClasse] = useState(""), [nivel, setNivel] = useState("1"), [publico, setPublico] = useState(false), [retrato, setRetrato] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; t: string } | null>(null), [busy, setBusy] = useState(false), [confirmar, setConfirmar] = useState(false);
  const aplicar = useCallback((r: Registro) => {
    const p = lerPerfil(r.meta); setReg(r); registrarTitulo(id, r.title); setNome(r.title); setClasse(p.classe); setNivel(String(p.nivel)); setPublico(r.visibility === "campaign"); setRetrato(p.retrato);
  }, [id]);
  useEffect(() => {
    if (!api) return; let vivo = true;
    api.get(id).then(r => { if (!vivo) return; if (!r.ok) { setErro(r.error); return; } setErro(null); if (r.data && r.data.kind === "character") aplicar(r.data); else setReg(null); });
    return () => { vivo = false; };
  }, [api, id, aplicar, tentativa]);
  const dono = !!reg && reg.ownerId === user?.id;
  const original = reg ? lerPerfil(reg.meta) : null;
  const sujo = !!reg && dono && (nome !== reg.title || classe !== original!.classe || nivel !== String(original!.nivel) || publico !== (reg.visibility === "campaign") || retrato !== original!.retrato);
  useUnsavedGuard(`ficha:${id}`, sujo);

  if (!api) return <div className="content"><Aviso t="Conta necessária."/></div>;
  if (erro) return <div className="content"><Aviso erro t={erro} onRetry={() => setTentativa(n => n + 1)}/></div>;
  if (reg === undefined) return <div className="content"><p className="muted" role="status">Carregando…</p></div>;
  if (reg === null) return <div className="content"><h1>Personagem</h1><Aviso t="Personagem não encontrado, excluído ou sem permissão para vê-lo."/></div>;

  if (!dono) {
    const p = lerPerfil(reg.meta);
    return <div className="content ficha"><div className="eyebrow">PERSONAGEM</div>
      <div className="ficha-topo"><Retrato caminho={p.retrato} nome={reg.title} tamanho={72}/><div><h1>{reg.title}</h1><p>{p.classe || "Sem classe"} · nível {p.nivel}</p></div></div></div>;
  }
  const salvar = async (): Promise<boolean> => {
    const n = Number(nivel); const bad = validarPerfil(nome, classe, n); if (bad) { setMsg({ ok: false, t: bad }); return false; }
    setBusy(true); setMsg(null);
    const r = await api.update(reg.id, reg.version, { title: nome, visibility: publico ? "campaign" : "private", meta: { ...reg.meta, classe: classe.trim(), nivel: n, retrato } });
    setBusy(false);
    if (!r.ok) { setMsg({ ok: false, t: r.error }); return false; }
    aplicar(r.data); setMsg({ ok: true, t: "Personagem salvo." }); avisarRegistros(); return true;
  };
  const escolherRetrato = async (f: File | undefined) => {
    if (!f || !capa) return; const bad = validarCapa(f); if (bad) { setMsg({ ok: false, t: bad }); return; }
    setBusy(true); setMsg(null); const r = await capa.enviar(reg.campaignId, f); setBusy(false);
    if (r.ok) setRetrato(r.data); else setMsg({ ok: false, t: r.error });   // vale ao salvar; o arquivo anterior é apagado depois do salvamento
  };
  const excluir = async () => { setBusy(true); const r = await api.remove(reg.id); setBusy(false); if (!r.ok) { setMsg({ ok: false, t: r.error }); return; } if (original?.retrato && capa) void capa.apagar(original.retrato); setReg(null); avisarRegistros(); };
  return <div className="content ficha auth wide"><div className="eyebrow">PERSONAGEM · {reg.visibility === "campaign" ? "VISÍVEL PARA A CAMPANHA" : "PRIVADO (SÓ VOCÊ VÊ)"}</div>
    <form noValidate onSubmit={e => { e.preventDefault(); void salvar().then(ok => { if (ok && original?.retrato && retrato !== original.retrato && capa) void capa.apagar(original.retrato); }); }}>
      <div className="ficha-topo"><Retrato caminho={retrato} nome={nome} tamanho={72}/>
        <div className="row"><label className="btn-secondary file-btn">{retrato ? "Trocar retrato" : "Adicionar retrato"}<input type="file" hidden accept="image/jpeg,image/png,image/webp" disabled={busy || !capa} onChange={e => { void escolherRetrato(e.target.files?.[0]); e.target.value = ""; }}/></label>
          {retrato && <button type="button" className="btn-secondary" onClick={() => setRetrato(null)}>Remover retrato</button>}</div></div>
      <label>Nome<input value={nome} maxLength={120} onChange={e => setNome(e.target.value)}/></label>
      <label>Classe<input value={classe} maxLength={40} onChange={e => setClasse(e.target.value)} placeholder="Ex.: Clériga"/></label>
      <label>Nível<input type="number" min={NIVEL_MIN} max={NIVEL_MAX} value={nivel} onChange={e => setNivel(e.target.value)}/></label>
      <label className="check"><input type="checkbox" checked={publico} onChange={e => setPublico(e.target.checked)}/> Visível para a campanha (aparece em Aventureiros no Início)</label>
      <div className="row"><button className="btn-primary" disabled={busy}>{busy ? "Salvando…" : "Salvar"}</button>
        {!confirmar ? <button type="button" className="btn-secondary danger" onClick={() => setConfirmar(true)}><Trash2 size={15} aria-hidden="true"/> Excluir</button>
          : <><button type="button" className="btn-secondary danger" disabled={busy} onClick={() => void excluir()}>Confirmar exclusão</button><button type="button" className="btn-secondary" onClick={() => setConfirmar(false)}>Cancelar</button></>}</div>
      {msg && <Aviso erro={!msg.ok} t={msg.t}/>}
    </form></div>;
}

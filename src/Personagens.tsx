import { rotuloClasse, rotuloRaca } from './criador/rotulos';
// Personagens da campanha: lista (retrato, nome, classe, nível) e perfil de cada um. Qualquer participante cria o seu; só o dono edita.
// Visível para a campanha = publicado; privado = só o dono vê. A ficha completa (atributos, magias, inventário) ainda não existe.
import { Plus, Trash2, UserRound } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAbrirEmAba } from "./abrirEmAba";
import { Aviso } from "./Diario";
import { useAuth } from "./AuthContext";
import { useCampaigns } from "./CampaignsContext";
import { NIVEL_MAX, NIVEL_MIN, lerPerfil, ordenarPersonagens, validarPerfil } from "./perfilPersonagem";
import { validarCapa } from "./capa";
import type { Registro } from "./registros";
import { useCapa, useFichas, useRegistros } from "./RegistrosContext";
import { avisarRegistros, registrarTitulo, useVersaoRegistros } from "./registrosStore";
import { useUnsavedGuard } from "./unsaved";
import { armazenamentoLocalExperimental, type ResumoPersonagemGuiado } from "./criador/armazenamento";
import { CriadorGuiado } from "./criador/CriadorGuiado";
import { cartaoPublico, ehGuiado, type ResumoFicha } from "./fichas";
import type { TabSpec } from "./workspace";

/** Retrato com URL temporária; sem retrato (ou se falhar) mostra a inicial. */
function Retrato({ caminho, nome, tamanho = 44 }: { caminho: string | null; nome: string; tamanho?: number }) {
  const capa = useCapa(); const [url, setUrl] = useState<string | null>(null);
  useEffect(() => { setUrl(null); if (!caminho || !capa) return; let vivo = true; void capa.urlDe(caminho).then(r => { if (vivo && r.ok) setUrl(r.data); }); return () => { vivo = false; }; }, [caminho, capa]);
  return url ? <img className="retrato" src={url} alt="" width={tamanho} height={tamanho}/> : <span className="retrato retrato-inicial" style={{ width: tamanho, height: tamanho }} aria-hidden="true">{nome.slice(0, 1).toLocaleUpperCase("pt-BR") || <UserRound size={18}/>}</span>;
}

export function PersonagensPanel({ onOpenContent }: { onOpenContent: (s: TabSpec) => void }) {
  const api = useRegistros(), { active } = useCampaigns(), { user } = useAuth(), v = useVersaoRegistros(), { aoClicarDireito } = useAbrirEmAba();
  const [lista, setLista] = useState<Registro[] | null>(null), [erro, setErro] = useState<string | null>(null), [tentativa, setTentativa] = useState(0);
  const cid = active?.campaign.id;
  useEffect(() => {
    if (!api || !cid) return; let vivo = true; setLista(null);
    api.list(cid, "character").then(r => { if (!vivo) return; if (r.ok) { setLista(ordenarPersonagens(r.data)); setErro(null); } else setErro(r.error); });
    return () => { vivo = false; };
  }, [api, cid, v, tentativa]);
  if (!active) return <div className="content"><h1>Personagens</h1><Aviso t="Os personagens pertencem a uma campanha. Escolha uma campanha ativa na barra lateral."/></div>;
  if (!api) return <div className="content"><h1>Personagens</h1><Aviso t="Conta necessária para usar os personagens."/></div>;
  const novo = () => onOpenContent({ kind: "criador", ref: `novo-${crypto.randomUUID()}`, title: "Novo personagem" });
  return <div className="content personagens">
    <div className="eyebrow">{active.campaign.name.toLocaleUpperCase("pt-BR")}</div>
    <div className="row-between"><h1>Personagens</h1><button className="btn-primary" onClick={novo}><Plus size={15} aria-hidden="true"/> Criar personagem</button></div>
    <p>Cada participante cria o próprio personagem. Só o dono edita; “visível para a campanha” aparece no Início.</p>
    <SecaoGuiados cid={active.campaign.id} userId={user?.id ?? null} publicos={lista} versao={v} onOpenContent={onOpenContent}/>
    {erro && <Aviso erro t={erro} onRetry={() => setTentativa(n => n + 1)}/>}
    {!lista && !erro && <p className="muted" role="status">Carregando personagens…</p>}
    {lista && lista.filter(r => !ehGuiado(r.meta)).length === 0 && <p className="muted" data-testid="personagens-vazio">Nenhum personagem ainda. Crie o primeiro.</p>}
    <ul className="home-party">{lista?.filter(r => !ehGuiado(r.meta)).map(r => { const p = lerPerfil(r.meta); return <li key={r.id}>
      <button className="home-char" onClick={() => onOpenContent({ kind: "ficha", ref: r.id, title: r.title })} onContextMenu={e => aoClicarDireito(e, { kind: "ficha", ref: r.id, title: r.title })} title={`Abrir ficha de ${r.title}`}>
        <Retrato caminho={p.retrato} nome={r.title}/>
        <span><strong>{r.title}</strong><small>{p.classe || "Sem classe"} · nível {p.nivel}{r.ownerId === user?.id ? " · seu" : ""}{r.visibility === "private" ? " · privado" : ""}</small></span></button></li>; })}</ul>
  </div>;
}

/** Personagens do criador guiado. Com conta e API de fichas: as fichas que o usuário pode ler (as próprias; todas, se for o mestre) vêm do SERVIDOR; as identidades públicas
 * dos outros vêm da lista de registros; os rascunhos do armazenamento local EXPERIMENTAL (versão anterior) ficam numa lista própria, com envio explícito. */
function SecaoGuiados({ cid, userId, publicos, versao, onOpenContent }: { cid: string; userId: string | null; publicos: Registro[] | null; versao: number; onOpenContent: (s: TabSpec) => void }) {
  const fichas = useFichas(), { aoClicarDireito } = useAbrirEmAba();
  const [meus, setMeus] = useState<ResumoFicha[] | null>(null), [erro, setErro] = useState<string | null>(null), [tentativa, setTentativa] = useState(0);
  const [aviso, setAviso] = useState<{ ok: boolean; t: string } | null>(null), [descartando, setDescartando] = useState<string | null>(null), [enviando, setEnviando] = useState<string | null>(null);
  useEffect(() => {
    if (!fichas) { setMeus(null); setErro(null); return; } let vivo = true;
    fichas.listar(cid).then(r => { if (!vivo) return; if (r.ok) { setMeus(r.data); setErro(null); } else setErro(r.error); });
    return () => { vivo = false; };
  }, [fichas, cid, versao, tentativa]);
  const locais = useMemo<ResumoPersonagemGuiado[]>(() => { try { return userId ? armazenamentoLocalExperimental(userId, cid).listar() : []; } catch { return []; } }, [userId, cid, versao, tentativa]);
  useEffect(() => { locais.forEach(g => registrarTitulo(g.id, g.nome)); meus?.forEach(m => registrarTitulo(m.id, m.nome)); }, [locais, meus]);   // abas restauradas mostram o nome
  const idsMeus = new Set((meus ?? []).map(m => m.id));
  const publicas = (publicos ?? []).filter(r => ehGuiado(r.meta) && !idsMeus.has(r.id));
  /** Envio explícito de um rascunho local para a campanha: só apaga a cópia local DEPOIS que o servidor confirma. Falhou = continua só local. */
  const enviar = async (g: ResumoPersonagemGuiado) => {
    if (!fichas || !userId || enviando) return; setEnviando(g.id); setAviso(null);
    try {
      const loc = armazenamentoLocalExperimental(userId, cid); const p = loc.carregar(g.id);
      if (!p) { setAviso({ ok: false, t: "O rascunho local não foi encontrado." }); return; }
      if (!p.draft.name.trim()) { setAviso({ ok: false, t: "Dê um nome ao personagem (abra o rascunho e salve) antes de enviá-lo." }); return; }
      const r = await fichas.criar(cid, p.draft, { identity: p.identity, source: { name: p.draft.name, surname: "", race: p.draft.catalogueVersion === 'character-srd-2014-v2' ? rotuloRaca(p.draft.raceId) : 'Anão', characterClass: rotuloClasse(p.draft.classId) }, publicar: false });
      if (!r.ok) { setAviso({ ok: false, t: `${r.error} O rascunho continua guardado neste navegador.` }); return; }
      loc.excluir(g.id); avisarRegistros(); setTentativa(n => n + 1);
      setAviso({ ok: true, t: `“${p.draft.name}” foi enviado para a campanha e a cópia deste navegador foi removida. A identidade pública começou privada.` });
    } catch (e) { setAviso({ ok: false, t: `${e instanceof Error ? e.message : "Não foi possível enviar."} O rascunho continua guardado neste navegador.` }); }
    finally { setEnviando(null); }
  };
  const descartar = (g: ResumoPersonagemGuiado) => { if (!userId) return; try { armazenamentoLocalExperimental(userId, cid).excluir(g.id); } catch { /* ignora */ } setDescartando(null); avisarRegistros(); setTentativa(n => n + 1); setAviso({ ok: true, t: `Rascunho “${g.nome}” removido deste navegador.` }); };
  const item = (spec: TabSpec, rotulo: string, nome: string, detalhe: string) => <button className="home-char" onClick={() => onOpenContent(spec)} onContextMenu={e => aoClicarDireito(e, spec)} title={rotulo}>
    <Retrato caminho={null} nome={nome}/><span><strong>{nome}</strong><small>{detalhe}</small></span></button>;

  return <section className="personagens-guiados" aria-label="Criador guiado">
    <h2>Criador guiado {fichas ? null : <small className="muted">(experimental)</small>}</h2>
    <p className="muted">{fichas ? "Personagens 2014 com equipamento do catálogo oficial e inventário; opções SRD adicionais são ativadas dentro da ficha. A ficha completa é privada: só você e o mestre a leem; os outros jogadores veem apenas a identidade pública que você publicar."
      : "Personagens 2014 com equipamento do catálogo oficial e inventário; opções SRD adicionais são ativadas dentro da ficha. Sem conta e API de fichas, os personagens guiados ficam só neste navegador (experimental)."}</p>
    {aviso && <Aviso erro={!aviso.ok} t={aviso.t}/>}
    {fichas && erro && <Aviso erro t={erro} onRetry={() => setTentativa(n => n + 1)}/>}
    {fichas && !meus && !erro && <p className="muted" role="status">Carregando fichas…</p>}
    {fichas && meus && meus.length === 0 && publicas.length === 0 && <p className="muted" data-testid="guiados-vazio">Nenhum personagem guiado na campanha ainda.</p>}
    {fichas && meus && meus.length > 0 && <><h3>Fichas na campanha</h3><ul className="home-party" aria-label="Fichas na campanha">{meus.map(m => <li key={m.id}>
      {item({ kind: "ficha", ref: m.id, title: m.nome }, `Abrir ficha guiada ${m.nome}`, m.nome, `${rotuloClasse(m.classId)}${m.nivel != null ? ` · nível ${m.nivel}` : ""} · ${m.ownerId === userId ? "sua ficha" : "ficha de outro participante"}`)}</li>)}</ul></>}
    {publicas.length > 0 && <><h3>Identidades públicas</h3><ul className="home-party" aria-label="Identidades públicas">{publicas.map(r => { const c = cartaoPublico(r.meta); return <li key={r.id}>
      {item({ kind: "ficha", ref: r.id, title: r.title }, `Abrir identidade pública de ${r.title}`, r.title, [c?.race, c?.characterClass].filter(Boolean).join(" · ") || "Identidade pública")}</li>; })}</ul></>}
    {!fichas && (locais.length === 0 ? <p className="muted" data-testid="guiados-vazio">Nenhum personagem guiado neste navegador.</p>
      : <ul className="home-party">{locais.map(g => <li key={g.id}>{item({ kind: "criador", ref: g.id, title: g.nome }, `Abrir personagem guiado ${g.nome}`, g.nome, `${rotuloClasse(g.classId)} · nível ${g.nivel} · guiado (neste navegador)`)}</li>)}</ul>)}
    {fichas && locais.length > 0 && <div data-testid="rascunhos-locais"><h3>Rascunhos neste navegador <small className="muted">(experimental)</small></h3>
      <p className="muted">Criados antes do salvamento na campanha. Nada é enviado nem apagado sozinho: envie cada um quando quiser; a cópia local só é removida depois que o servidor confirmar.</p>
      <ul className="criador-locais">{locais.map(g => <li key={g.id}><span><strong>{g.nome}</strong> <small className="muted">nível {g.nivel}</small></span>
        <span className="row"><button className="btn-secondary" onClick={() => onOpenContent({ kind: "criador", ref: g.id, title: g.nome })} aria-label={`Revisar rascunho local ${g.nome}`}>Revisar</button>
          <button className="btn-primary" onClick={() => void enviar(g)} disabled={enviando !== null} aria-label={`${enviando === g.id ? "Enviando…" : "Enviar para a campanha"}: ${g.nome}`}>{enviando === g.id ? "Enviando…" : "Enviar para a campanha"}</button>
          {descartando === g.id ? <><button className="btn-secondary danger" onClick={() => descartar(g)}>Confirmar descarte</button><button className="btn-secondary" onClick={() => setDescartando(null)}>Cancelar</button></>
            : <button className="btn-secondary danger" onClick={() => setDescartando(g.id)} aria-label={`Descartar rascunho local ${g.nome}`}>Descartar</button>}</span></li>)}</ul></div>}
  </section>;
}

/** Identidade pública de um personagem guiado, para quem NÃO é o dono: só o que o jogador publicou (nunca nível, PV, inventário ou escolhas). */
function CartaoPublicoGuiado({ reg }: { reg: Registro }) {
  const c = cartaoPublico(reg.meta);
  if (!c) return <div className="content"><h1>{reg.title}</h1><Aviso t="Identidade pública indisponível."/></div>;
  const nome = [c.name, c.surname].filter(Boolean).join(" ");
  return <div className="content ficha" data-testid="cartao-publico"><div className="eyebrow">PERSONAGEM · IDENTIDADE PÚBLICA</div>
    <div className="ficha-topo"><Retrato caminho={null} nome={reg.title} tamanho={72}/><div><h1>{c.title || nome || reg.title}</h1>{c.title && nome && <p>{nome}</p>}</div></div>
    {c.race && <p>Raça: {c.race}</p>}{c.characterClass && <p>Classe: {c.characterClass}</p>}{c.description && <p>{c.description}</p>}
    <p className="muted">Os detalhes da ficha são privados do jogador e do mestre.</p></div>;
}

/** Aba `ficha:<id>`: perfil do personagem. Dono edita; os demais só leem. */
export function FichaPagina({ id, onOpenContent }: { id: string; onOpenContent?: (s: TabSpec) => void }) {
  const api = useRegistros(), capa = useCapa(), { user } = useAuth();
  const [reg, setReg] = useState<Registro | null | undefined>(undefined), [erro, setErro] = useState<string | null>(null), [tentativa, setTentativa] = useState(0);
  const [nome, setNome] = useState(""), [classe, setClasse] = useState(""), [nivel, setNivel] = useState("1"), [publico, setPublico] = useState(false), [retrato, setRetrato] = useState<string | null>(null);
  const [subsecao, setSubsecao] = useState<"ficha" | "inventario">("ficha");
  const [inventario, setInventario] = useState<string[]>([]);
  const [novoItem, setNovoItem] = useState("");
  const toque = useRef<{ x: number; y: number } | null>(null);
  const gesto = {
    onTouchStart: (e: React.TouchEvent<HTMLDivElement>) => { const t = e.touches[0]; toque.current = { x: t.clientX, y: t.clientY }; },
    onTouchEnd: (e: React.TouchEvent<HTMLDivElement>) => {
      if (!toque.current || window.matchMedia("(min-width:701px)").matches) return;
      const t = e.changedTouches[0], dx = t.clientX - toque.current.x, dy = t.clientY - toque.current.y;
      toque.current = null;
      if (Math.abs(dx) < 65 || Math.abs(dx) < Math.abs(dy) * 1.4) return;
      if ((e.target as HTMLElement).closest("input,textarea,select,[contenteditable],button")) return;
      setSubsecao(dx < 0 ? "inventario" : "ficha");
    }
  };
  const secoes = <nav className="ficha-subnav" aria-label="Seções da ficha"><button type="button" className={subsecao === "ficha" ? "active" : ""} onClick={() => setSubsecao("ficha")}>Ficha</button><button type="button" className={subsecao === "inventario" ? "active" : ""} onClick={() => setSubsecao("inventario")}>Inventário</button></nav>;
  const [msg, setMsg] = useState<{ ok: boolean; t: string } | null>(null), [busy, setBusy] = useState(false), [confirmar, setConfirmar] = useState(false);
  const aplicar = useCallback((r: Registro) => {
    const p = lerPerfil(r.meta); setReg(r); registrarTitulo(id, r.title); setNome(r.title); setClasse(p.classe); setNivel(String(p.nivel)); setPublico(r.visibility === "campaign"); setRetrato(p.retrato); setInventario(Array.isArray(r.meta.inventario) ? r.meta.inventario.filter((x): x is string => typeof x === "string") : []);
  }, [id]);
  useEffect(() => {
    if (!api) return; let vivo = true;
    api.get(id).then(r => { if (!vivo) return; if (!r.ok) { setErro(r.error); return; } setErro(null); if (r.data && r.data.kind === "character") aplicar(r.data); else setReg(null); });
    return () => { vivo = false; };
  }, [api, id, aplicar, tentativa]);
  const dono = !!reg && reg.ownerId === user?.id;
  const original = reg ? lerPerfil(reg.meta) : null;
  const sujo = !!reg && dono && (nome !== reg.title || classe !== original!.classe || nivel !== String(original!.nivel) || publico !== (reg.visibility === "campaign") || retrato !== original!.retrato || JSON.stringify(inventario) !== JSON.stringify(Array.isArray(reg.meta.inventario) ? reg.meta.inventario : []));
  useUnsavedGuard(`ficha:${id}`, sujo);

  if (!api) return <div className="content"><Aviso t="Conta necessária."/></div>;
  if (erro) return <div className="content"><Aviso erro t={erro} onRetry={() => setTentativa(n => n + 1)}/></div>;
  if (reg === undefined) return <div className="content"><p className="muted" role="status">Carregando…</p></div>;
  if (reg === null) return <div className="content"><h1>Personagem</h1><Aviso t="Personagem não encontrado, excluído ou sem permissão para vê-lo."/></div>;

  if (ehGuiado(reg.meta)) return dono ? <CriadorGuiado id={reg.id} onOpenContent={onOpenContent ?? (() => {})} initialView/> : <CartaoPublicoGuiado reg={reg}/>;   // ficha guiada: editor do dono; os demais só o cartão público
  if (!dono) {
    const p = lerPerfil(reg.meta);
    return <div className="content ficha" {...gesto}><div className="eyebrow">PERSONAGEM</div>
      <div className="ficha-topo"><Retrato caminho={p.retrato} nome={reg.title} tamanho={72}/><div><h1>{reg.title}</h1><p>{p.classe || "Sem classe"} · nível {p.nivel}</p></div></div>{secoes}{subsecao === "inventario" && <ul>{inventario.map((item, i) => <li key={i}>{item}</li>)}</ul>}</div>;
  }
  const salvar = async (): Promise<boolean> => {
    const n = Number(nivel); const bad = validarPerfil(nome, classe, n); if (bad) { setMsg({ ok: false, t: bad }); return false; }
    setBusy(true); setMsg(null);
    const r = await api.update(reg.id, reg.version, { title: nome, visibility: publico ? "campaign" : "private", meta: { ...reg.meta, classe: classe.trim(), nivel: n, retrato, inventario } });
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
  return <div className="content ficha auth wide" {...gesto}><div className="eyebrow">PERSONAGEM · {reg.visibility === "campaign" ? "VISÍVEL PARA A CAMPANHA" : "PRIVADO (SÓ VOCÊ VÊ)"}</div>
    {secoes}
    <form noValidate onSubmit={e => { e.preventDefault(); void salvar().then(ok => { if (ok && original?.retrato && retrato !== original.retrato && capa) void capa.apagar(original.retrato); }); }}>
      {subsecao === "ficha" && <><div className="ficha-topo"><Retrato caminho={retrato} nome={nome} tamanho={72}/>
        <div className="row"><label className="btn-secondary file-btn">{retrato ? "Trocar retrato" : "Adicionar retrato"}<input type="file" hidden accept="image/jpeg,image/png,image/webp" disabled={busy || !capa} onChange={e => { void escolherRetrato(e.target.files?.[0]); e.target.value = ""; }}/></label>
          {retrato && <button type="button" className="btn-secondary" onClick={() => setRetrato(null)}>Remover retrato</button>}</div></div>
      <label>Nome<input value={nome} maxLength={120} onChange={e => setNome(e.target.value)}/></label>
      <label>Classe<input value={classe} maxLength={40} onChange={e => setClasse(e.target.value)} placeholder="Ex.: Clériga"/></label>
      <label>Nível<input type="number" min={NIVEL_MIN} max={NIVEL_MAX} value={nivel} onChange={e => setNivel(e.target.value)}/></label>
      <label className="check"><input type="checkbox" checked={publico} onChange={e => setPublico(e.target.checked)}/> Visível para a campanha (aparece em Aventureiros no Início)</label>
      </>}
      {subsecao === "inventario" && <section className="ficha-inventario">
        <h2>Inventário</h2>
        <p>Itens carregados pelo personagem. Salve para sincronizar entre dispositivos.</p>
        {publico && <p className="notice" role="note">Atenção: nesta ficha simples o inventário é gravado junto do perfil e fica visível para a campanha enquanto estiver publicada. Para um inventário privado, use o criador guiado.</p>}
        <ul>{inventario.map((item, i) => <li key={i}><span>{item}</span><button type="button" className="btn-secondary" onClick={() => setInventario(items => items.filter((_, j) => j !== i))}>Remover</button></li>)}</ul>
        <div className="row"><input aria-label="Nome do item" placeholder="Novo item" value={novoItem} onChange={e => setNovoItem(e.target.value)}/><button type="button" className="btn-secondary" onClick={() => { if (novoItem.trim()) { setInventario(items => [...items, novoItem.trim()]); setNovoItem(""); } }}>Adicionar</button></div>
      </section>}
      <div className="row"><button className="btn-primary" disabled={busy}>{busy ? "Salvando…" : "Salvar"}</button>
        {!confirmar ? <button type="button" className="btn-secondary danger" onClick={() => setConfirmar(true)}><Trash2 size={15} aria-hidden="true"/> Excluir</button>
          : <><button type="button" className="btn-secondary danger" disabled={busy} onClick={() => void excluir()}>Confirmar exclusão</button><button type="button" className="btn-secondary" onClick={() => setConfirmar(false)}>Cancelar</button></>}</div>
      {msg && <Aviso erro={!msg.ok} t={msg.t}/>}
    </form></div>;
}

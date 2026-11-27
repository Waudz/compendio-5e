import {useJogadoresCampanha} from "./jogadoresCampanha";
import {useAbrirConsulta} from "./compendio/ConsultaCarta";
import {identidadeSpec} from "./compendio/navegacao";
import { origemPublica, rotuloClasse, rotuloRaca } from './criador/rotulos';
// Personagens da campanha: lista (retrato, nome, classe, nível) e perfil de cada um. Qualquer participante cria o seu; só o dono edita.
// Ficha completa só para dono/mestre; os demais consultam a identidade pública na carta compartilhada.
import { ROTULO_SITUACAO, useCiclo } from "./CicloPersonagens";
import type {MenuItem} from "./ContextMenu";
import { Plus, Trash2, UserRound,MoreHorizontal } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAbrirEmAba } from "./abrirEmAba";
import { Aviso } from "./Diario";
import { useAuth } from "./AuthContext";
import { useCampaigns } from "./CampaignsContext";
import { NIVEL_MAX, NIVEL_MIN, lerPerfil, validarPerfil } from "./perfilPersonagem";
import { validarCapa } from "./capa";
import type { Registro } from "./registros";
import { useCapa, useFichas, useRegistros } from "./RegistrosContext";
import { avisarRegistros, registrarTitulo, useVersaoRegistros } from "./registrosStore";
import { useUnsavedGuard } from "./unsaved";
import { armazenamentoLocalExperimental, type ResumoPersonagemGuiado } from "./criador/armazenamento";
import { CriadorGuiado } from "./criador/CriadorGuiado";
import { cartaoPublico, ehGuiado } from "./fichas";
import { presentation } from "./rules/public-identity";
import { listarPersonagens, rotuloPrivacidade, type ListaPersonagens, type PersonagemCampanha } from "./personagensCampanha";
import { RetratoQuadrado } from "./RetratoCombate";
import { EditorEnquadramento } from "./imagem/EditorEnquadramento";
import { estiloEnquadramento, juntar, separar, type Enquadramento } from "./imagem/enquadramento";
import type { TabSpec } from "./workspace";

/** URL temporária de um caminho do armazenamento (o enquadramento no fim do caminho é aplicado na exibição). */
function useUrlDoCaminho(caminho: string | null) {
  const capa = useCapa(); const [url, setUrl] = useState<string | null>(null);
  const base = caminho ? separar(caminho).base : null;
  useEffect(() => { setUrl(null); if (!base || !capa) return; let vivo = true; void capa.urlDe(base).then(r => { if (vivo && r.ok) setUrl(r.data); }); return () => { vivo = false; }; }, [base, capa]);
  return url;
}
/** Retrato com URL temporária; sem retrato (ou se falhar) mostra a inicial. */
function Retrato({ caminho, nome, tamanho = 44 }: { caminho: string | null; nome: string; tamanho?: number }) {
  const url = useUrlDoCaminho(caminho);
  return url ? <span className="retrato retrato-enquadrado" style={{ width: tamanho, height: tamanho }}><img src={url} alt="" style={estiloEnquadramento(separar(caminho!).enquadramento)}/></span> : <span className="retrato retrato-inicial" style={{ width: tamanho, height: tamanho }} aria-hidden="true">{nome.slice(0, 1).toLocaleUpperCase("pt-BR") || <UserRound size={18}/>}</span>;
}

/** Retrato somente leitura do perfil simples, ampliável. */
function RetratoDaFicha({ caminho, nome, tamanho }: { caminho: string | null; nome: string; tamanho: number }) {
  const url = useUrlDoCaminho(caminho);
  return url ? <RetratoQuadrado src={juntar(url, separar(caminho!).enquadramento)} tipo="personagem" tamanho={tamanho} ampliar={nome}/> : <Retrato caminho={null} nome={nome} tamanho={tamanho}/>;
}

/** Retrato de um cartão da lista: imagem pública (guiado), retrato do perfil simples, ou o espaço padrão. */
function RetratoDaLista({ p }: { p: PersonagemCampanha }) {
  const url = useUrlDoCaminho(p.retratoCaminho);
  return <RetratoQuadrado src={p.retratoUrl ?? (url ? juntar(url, separar(p.retratoCaminho!).enquadramento) : null)} tipo="personagem" tamanho={56}/>;
}

type Grupo = "ativos" | "aguardando" | "arquivados" | "outros";
const GRUPOS: [Grupo, string][] = [["ativos", "Ativos"], ["aguardando", "Aguardando decisão"], ["arquivados", "Arquivados"], ["outros", "NPCs e só no Compêndio"]];

/** Uma lista só: cada personagem aparece uma vez, com a ficha e a identidade pública vinculadas pelo mesmo registro. */
export function PersonagensPanel({ onOpenContent, somenteMeus = false }: { onOpenContent: (s: TabSpec) => void; somenteMeus?: boolean }) {
  const api = useRegistros(), fichas = useFichas(), { active } = useCampaigns(), { user } = useAuth(), v = useVersaoRegistros(), { aoClicarDireito, aoClicar, aoBotaoDoMeio,abrirMenuEm } = useAbrirEmAba();
  const [dados, setDados] = useState<ListaPersonagens | null>(null), [erro, setErro] = useState<string | null>(null), [tentativa, setTentativa] = useState(0);
  const [aviso, setAviso] = useState<{ ok: boolean; t: string } | null>(null), [descartando, setDescartando] = useState<string | null>(null), [enviando, setEnviando] = useState<string | null>(null);
  const consultar=useAbrirConsulta(onOpenContent),jogador=useJogadoresCampanha(),ciclo=useCiclo();
  const [grupo, setGrupo] = useState<Grupo>("ativos"), [selecao, setSelecao] = useState<string[] | null>(null);
  const cid = active?.campaign.id, userId = user?.id ?? null;
  useEffect(() => { setDados(null); setErro(null); setAviso(null); setGrupo("ativos"); setSelecao(null); }, [cid]);   // nada de uma campanha aparece em outra
  useEffect(() => {
    if (!api || !cid) return; let vivo = true;
    listarPersonagens(cid, { registros: api, fichas, userId }).then(r => { if (!vivo) return; if (r.ok) { setDados(r.data); setErro(null); } else setErro(r.error); }, () => { if (vivo) setErro("Não foi possível carregar os personagens."); });
    return () => { vivo = false; };
  }, [api, fichas, cid, userId, v, tentativa]);
  const locais = useMemo<ResumoPersonagemGuiado[]>(() => { try { return userId && cid ? armazenamentoLocalExperimental(userId, cid).listar() : []; } catch { return []; } }, [userId, cid, v, tentativa]);
  useEffect(() => { locais.forEach(g => registrarTitulo(g.id, g.nome)); dados?.personagens.forEach(p => registrarTitulo(p.id, p.nome)); }, [locais, dados]);   // abas restauradas mostram o nome
  if (!active) return <div className="content"><h1>Personagens</h1><Aviso t="Os personagens pertencem a uma campanha. Escolha uma campanha ativa na barra lateral."/></div>;
  if (!api) return <div className="content"><h1>Personagens</h1><Aviso t="Conta necessária para usar os personagens."/></div>;
  const campanhaId = active.campaign.id;
  const novo = () => onOpenContent({ kind: "criador", ref: `novo-${crypto.randomUUID()}`, title: "Novo personagem" });
  /** Envio explícito de um rascunho local para a campanha: só apaga a cópia local DEPOIS que o servidor confirma. Falhou = continua só local. */
  const enviar = async (g: ResumoPersonagemGuiado) => {
    if (!fichas || !userId || enviando) return; setEnviando(g.id); setAviso(null);
    try {
      const loc = armazenamentoLocalExperimental(userId, campanhaId); const p = loc.carregar(g.id);
      if (!p) { setAviso({ ok: false, t: "O rascunho local não foi encontrado." }); return; }
      if (!p.draft.name.trim()) { setAviso({ ok: false, t: "Dê um nome ao personagem (abra o rascunho e salve) antes de enviá-lo." }); return; }
      const source = origemPublica(p.draft, p.draft.catalogueVersion === 'character-srd-2014-v2' ? rotuloRaca(p.draft.raceId) : 'Anão', rotuloClasse(p.draft.classId));
      const r = await fichas.criar(campanhaId, { ...p.draft, publicLabels: { race: source.race, characterClass: source.characterClass } }, { identity: p.identity, source });
      if (!r.ok) { setAviso({ ok: false, t: `${r.error} O rascunho continua guardado neste navegador.` }); return; }
      loc.excluir(g.id); avisarRegistros(); setTentativa(n => n + 1);
      setAviso({ ok: true, t: `“${p.draft.name}” foi enviado para a campanha e a cópia deste navegador foi removida. Os outros jogadores veem só a apresentação dele.` });
    } catch (e) { setAviso({ ok: false, t: `${e instanceof Error ? e.message : "Não foi possível enviar."} O rascunho continua guardado neste navegador.` }); }
    finally { setEnviando(null); }
  };
  const descartar = (g: ResumoPersonagemGuiado) => { if (!userId) return; try { armazenamentoLocalExperimental(userId, campanhaId).excluir(g.id); } catch { /* ignora */ } setDescartando(null); avisarRegistros(); setTentativa(n => n + 1); setAviso({ ok: true, t: `Rascunho “${g.nome}” removido deste navegador.` }); };
  const mestre = active.role === "mestre", comCiclo = ciclo.disponivel && !!dados?.ciclo;
  const todos = dados?.personagens ?? [];
  const selecionados = (selecao ?? []).filter(id => todos.some(p => p.id === id));
  const alternar = (id: string) => setSelecao(s => (s?.includes(id) ? s.filter(x => x !== id) : [...(s ?? []), id]));
  const cartao = (chave: string, spec: TabSpec, dica: string, retrato: React.ReactNode, nome: string, alcunha: string | null, detalhe: string, notas: (string | null)[]) => {
    const p = todos.find(x => x.id === chave);
    const acao: MenuItem | null = !comCiclo || !p ? null : mestre ? { label: "Gerenciar personagem", onSelect: () => ciclo.gerenciar(p.id) }
      : p.meu && p.comFicha ? { label: "Excluir personagem", danger: true, onSelect: () => ciclo.pedirRenuncia(p.id) } : null;
    const extras: MenuItem[] = acao ? ["-", acao] : [];
    return <li key={chave}>
    {selecao && p && <input type="checkbox" className="personagem-marcar" aria-label={`Selecionar ${nome}`} checked={selecionados.includes(p.id)} onChange={() => alternar(p.id)}/>}
    <button className="home-char" onClick={e => {if(!aoClicar(e,spec))consultar(spec);}} onAuxClick={e=>aoBotaoDoMeio(e,spec)} onMouseDown={e=>{if(e.button===1)e.preventDefault();}} onContextMenu={e => aoClicarDireito(e, spec,extras)} title={dica}>{retrato}
      <span><strong>{nome}</strong>{alcunha && <>{" "}<em className="home-char-alcunha">{alcunha}</em></>}{" "}<small>{detalhe}</small>{notas.filter(Boolean).map(n => <small key={n} className="home-char-nota">{n}</small>)}</span></button>
    {!selecao && extras.length > 0 && <button type="button" className="personagem-menu icon-btn" aria-label={`Mais ações de ${nome}`} onClick={e=>abrirMenuEm(e.currentTarget,spec,extras)}><MoreHorizontal size={16}/></button>}</li>;};
  // fora da seleção, cada grupo mostra a sua situação; quem não é mestre só vê quem está em jogo (os demais continuam no Compêndio)
  const grupoDe = (p: PersonagemCampanha): Grupo => (p.situacao === "ativo" ? "ativos" : p.situacao === "aguardando" ? "aguardando" : p.situacao === "arquivado" ? "arquivados" : "outros");
  const mostraGrupos = mestre && comCiclo && !somenteMeus;
  const personagens = todos.filter(p => (somenteMeus ? p.meu : grupoDe(p) === (mostraGrupos ? grupo : "ativos")));
  const soLocais = fichas ? [] : locais;   // sem API de fichas, os guiados deste navegador fazem parte da própria lista
  const vazio = !!dados && personagens.length === 0 && soLocais.length === 0;
  const abrirFicha = (p: PersonagemCampanha) => p.situacao !== "compendio" && (p.meu || mestre);
  return <div className="content personagens">
    <div className="eyebrow">{active.campaign.name.toLocaleUpperCase("pt-BR")}</div>
    <div className="row-between"><h1>{somenteMeus ? "Meus personagens" : "Personagens"}</h1><button className="btn-primary" onClick={novo}><Plus size={15} aria-hidden="true"/> Criar personagem</button></div>
    <p className="muted">Cada participante cria o próprio personagem. A ficha é privada (dono e mestre); os outros jogadores veem só a apresentação, sem o que o dono ocultar.{fichas ? "" : " Sem conta e API de fichas, os personagens guiados ficam só neste navegador (experimental)."}</p>
    {aviso && <Aviso erro={!aviso.ok} t={aviso.t}/>}
    {erro && <Aviso erro t={erro} onRetry={() => setTentativa(n => n + 1)}/>}
    {dados?.avisoFichas && <Aviso erro t={`${dados.avisoFichas} A lista pode estar incompleta.`} onRetry={() => setTentativa(n => n + 1)}/>}
    {!dados && !erro && <p className="muted" role="status">Carregando personagens…</p>}
    {ciclo.ofertas.map(o => <p key={o.id} className="notice" role="note">O mestre quer transferir <strong>{o.title}</strong> para você.{" "}<button type="button" className="btn-secondary" onClick={() => ciclo.abrirOferta(o)}>Responder</button></p>)}
    {mostraGrupos && <div className="personagens-gestao">
      <div className="cd-filters" role="group" aria-label="Situação dos personagens">{GRUPOS.map(([id, rotulo]) => { const n = todos.filter(p => grupoDe(p) === id).length; return id === "outros" && !n ? null : <button key={id} type="button" aria-pressed={grupo === id} onClick={() => setGrupo(id)}>{rotulo}{" "}<span className="muted">{n}</span></button>; })}</div>
      {!selecao ? <button type="button" className="btn-secondary" disabled={!todos.length} onClick={() => setSelecao([])}>Selecionar</button>
        : <div className="personagens-selecao" role="group" aria-label="Seleção de personagens">
          <button type="button" className="btn-secondary" onClick={() => setSelecao(todos.map(p => p.id))}>Selecionar todos da campanha ({todos.length})</button>
          <button type="button" className="btn-secondary danger" disabled={!selecionados.length} onClick={() => ciclo.excluirVarios(selecionados)}>Excluir selecionados ({selecionados.length})</button>
          <button type="button" className="btn-secondary" onClick={() => setSelecao(null)}>Cancelar seleção</button></div>}
    </div>}
    {vazio && !dados?.avisoFichas && <p className="muted" data-testid="personagens-vazio">{!todos.length || somenteMeus || !mostraGrupos && grupo === "ativos" ? "Nenhum personagem ainda. Crie o primeiro." : "Nenhum personagem neste grupo."}</p>}
    <section className="personagens-lista" aria-label="Personagens da campanha">
      <ul className="home-party">
        {personagens.map(p => cartao(p.id, abrirFicha(p)?{ kind: "ficha", ref: p.id, title: p.nome }:identidadeSpec(p.id,p.nome), abrirFicha(p)?`Abrir ficha de ${p.nome}`:`Consultar ${p.nome}`, <RetratoDaLista p={p}/>, p.nome, p.alcunha,
          [p.classe, p.nivel != null ? `nível ${p.nivel}` : null, p.meu ? (p.comFicha ? "sua ficha" : "seu") : p.comFicha ? "ficha de outro participante" : null].filter(Boolean).join(" · "),
          [p.situacao === "ativo" && jogador(p.ownerId) ? `Jogador: ${jogador(p.ownerId)}` : null, p.situacao !== "ativo" ? ROTULO_SITUACAO[p.situacao] : null, p.pendenteDe ? `Transferência aguardando ${jogador(p.pendenteDe) ?? "aceite"}` : null, rotuloPrivacidade(p, mestre)]))}
        {soLocais.map(g => cartao(g.id, { kind: "criador", ref: g.id, title: g.nome }, `Abrir personagem guiado ${g.nome}`, <RetratoQuadrado tipo="personagem" tamanho={56}/>, g.nome, null, `${rotuloClasse(g.classId)} · nível ${g.nivel} · guiado (neste navegador)`, []))}
      </ul>
    </section>
    {fichas && locais.length > 0 && <div data-testid="rascunhos-locais"><h2>Rascunhos neste navegador <small className="muted">(experimental)</small></h2>
      <p className="muted">Criados antes do salvamento na campanha. Nada é enviado nem apagado sozinho: envie cada um quando quiser; a cópia local só é removida depois que o servidor confirmar.</p>
      <ul className="criador-locais">{locais.map(g => <li key={g.id}><span><strong>{g.nome}</strong> <small className="muted">nível {g.nivel}</small></span>
        <span className="row"><button className="btn-secondary" onClick={() => onOpenContent({ kind: "criador", ref: g.id, title: g.nome })} aria-label={`Revisar rascunho local ${g.nome}`}>Revisar</button>
          <button className="btn-primary" onClick={() => void enviar(g)} disabled={enviando !== null} aria-label={`${enviando === g.id ? "Enviando…" : "Enviar para a campanha"}: ${g.nome}`}>{enviando === g.id ? "Enviando…" : "Enviar para a campanha"}</button>
          {descartando === g.id ? <><button className="btn-secondary danger" onClick={() => descartar(g)}>Confirmar descarte</button><button className="btn-secondary" onClick={() => setDescartando(null)}>Cancelar</button></>
            : <button className="btn-secondary danger" onClick={() => setDescartando(g.id)} aria-label={`Descartar rascunho local ${g.nome}`}>Descartar</button>}</span></li>)}</ul></div>}
  </div>;
}

/** Identidade pública de um personagem guiado, para quem NÃO é o dono: só o que o jogador publicou (nunca nível, PV, inventário ou escolhas). */
function CartaoPublicoGuiado({ reg }: { reg: Registro }) {
  const c = cartaoPublico(reg.meta);
  if (!c) return <div className="content"><h1>{reg.title}</h1><Aviso t="Apresentação indisponível."/></div>;
  const visto = presentation(c);
  return <div className="content ficha" data-testid="cartao-publico"><div className="eyebrow">PERSONAGEM</div>
    <div className="ficha-topo"><RetratoQuadrado tipo="personagem" src={c.imageUrl} tamanho={96} ampliar={visto.nome}/><div><h1>{visto.nome}</h1>{visto.alcunha && <p className="identidade-alcunha"><em>{visto.alcunha}</em></p>}</div></div>
    {c.race && <p>Raça: {c.race}</p>}{c.characterClass && <p>Classe: {c.characterClass}</p>}{c.level && <p>Nível: {c.level}</p>}{c.description && <p>{c.description}</p>}
    <p className="muted">Os detalhes da ficha são privados do jogador e do mestre.</p></div>;
}

/** Aba `ficha:<id>`: perfil do personagem. Dono edita; os demais só leem. */
export function FichaPagina({ id, onOpenContent }: { id: string; onOpenContent?: (s: TabSpec) => void }) {
  const api = useRegistros(), capa = useCapa(), { user } = useAuth(), fichasApi = useFichas(), { active } = useCampaigns();
  const mestreComFichas = active?.role === "mestre" && !!fichasApi;
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
  const [novoRetrato, setNovoRetrato] = useState<{ arquivo: File; url: string } | null>(null), [ajustando, setAjustando] = useState(false);
  const urlRetrato = useUrlDoCaminho(retrato);
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
  if (reg === null && mestreComFichas) return <CriadorGuiado id={id} onOpenContent={onOpenContent ?? (() => {})} initialView/>;
  if (reg === null) return <div className="content"><h1>Personagem</h1><Aviso t="Personagem não encontrado, excluído ou sem permissão para vê-lo."/></div>;

  if (ehGuiado(reg.meta)) return dono || (mestreComFichas && reg.campaignId === active?.campaign.id) ? <CriadorGuiado id={reg.id} onOpenContent={onOpenContent ?? (() => {})} initialView/> : <CartaoPublicoGuiado reg={reg}/>;   // ficha guiada: editor do dono; os demais só o cartão público
  if (!dono) {
    const p = lerPerfil(reg.meta);
    return <div className="content ficha" {...gesto}><div className="eyebrow">PERSONAGEM</div>
      <div className="ficha-topo"><RetratoDaFicha caminho={p.retrato} nome={reg.title} tamanho={72}/><div><h1>{reg.title}</h1><p>{p.classe || "Sem classe"} · nível {p.nivel}</p></div></div>{secoes}{subsecao === "inventario" && <ul>{inventario.map((item, i) => <li key={i}>{item}</li>)}</ul>}</div>;
  }
  const salvar = async (): Promise<boolean> => {
    const n = Number(nivel); const bad = validarPerfil(nome, classe, n); if (bad) { setMsg({ ok: false, t: bad }); return false; }
    setBusy(true); setMsg(null);
    const r = await api.update(reg.id, reg.version, { title: nome, visibility: publico ? "campaign" : "private", meta: { ...reg.meta, classe: classe.trim(), nivel: n, retrato, inventario } });
    setBusy(false);
    if (!r.ok) { setMsg({ ok: false, t: r.error }); return false; }
    aplicar(r.data); setMsg({ ok: true, t: "Personagem salvo." }); avisarRegistros(); return true;
  };
  const escolherRetrato = (f: File | undefined) => {
    if (!f || !capa) return; const bad = validarCapa(f); if (bad) { setMsg({ ok: false, t: bad }); return; }
    setMsg(null); setNovoRetrato({ arquivo: f, url: URL.createObjectURL(f) });
  };
  const fecharNovo = () => { if (novoRetrato) URL.revokeObjectURL(novoRetrato.url); setNovoRetrato(null); };
  const enviarRetrato = async (e: Enquadramento) => {
    if (!novoRetrato || !capa) return;
    setBusy(true); const r = await capa.enviar(reg.campaignId, novoRetrato.arquivo); setBusy(false);
    if (r.ok) setRetrato(juntar(r.data, e)); else setMsg({ ok: false, t: r.error });   // vale ao salvar; o arquivo anterior é apagado depois do salvamento
    fecharNovo();
  };
  const excluir = async () => { setBusy(true); const r = await api.remove(reg.id); setBusy(false); if (!r.ok) { setMsg({ ok: false, t: r.error }); return; } if (original?.retrato && capa) void capa.apagar(separar(original.retrato).base); setReg(null); avisarRegistros(); };
  return <div className="content ficha auth wide" {...gesto}><div className="eyebrow">PERSONAGEM · {reg.visibility === "campaign" ? "VISÍVEL PARA A CAMPANHA" : "PRIVADO (SÓ VOCÊ VÊ)"}</div>
    {secoes}
    <form noValidate onSubmit={e => { e.preventDefault(); void salvar().then(ok => { if (ok && original?.retrato && (!retrato || separar(retrato).base !== separar(original.retrato).base) && capa) void capa.apagar(separar(original.retrato).base); }); }}>
      {subsecao === "ficha" && <><div className="ficha-topo"><Retrato caminho={retrato} nome={nome} tamanho={72}/>
        <div className="row"><label className="btn-secondary file-btn">{retrato ? "Trocar retrato" : "Adicionar retrato"}<input type="file" className="arquivo-invisivel" accept="image/jpeg,image/png,image/webp" disabled={busy || !capa} onChange={e => { escolherRetrato(e.target.files?.[0]); e.target.value = ""; }}/></label>
          {retrato && <button type="button" className="btn-secondary" disabled={!urlRetrato} onClick={() => setAjustando(true)}>Ajustar enquadramento</button>}
          {retrato && <button type="button" className="btn-secondary" onClick={() => setRetrato(null)}>Remover retrato</button>}</div></div>
      {novoRetrato && <EditorEnquadramento titulo="Enquadrar retrato" src={novoRetrato.url} proporcao={1} previas={[96, 56]} ocupado={busy} confirmar="Usar esta imagem" onConfirmar={e => void enviarRetrato(e)} onCancelar={fecharNovo}/>}
      {ajustando && retrato && urlRetrato && <EditorEnquadramento titulo="Ajustar enquadramento do retrato" src={urlRetrato} inicial={separar(retrato).enquadramento} proporcao={1} previas={[96, 56]}
        onConfirmar={e => { setRetrato(juntar(retrato, e)); setAjustando(false); }} onCancelar={() => setAjustando(false)}/>}
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

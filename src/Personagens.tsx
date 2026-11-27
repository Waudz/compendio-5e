import {useJogadoresCampanha} from "./jogadoresCampanha";
import {useAbrirConsulta} from "./compendio/ConsultaCarta";
import {identidadeSpec} from "./compendio/navegacao";
import { origemPublica, rotuloClasse, rotuloRaca } from './criador/rotulos';
// Personagens da campanha: lista (retrato, nome, classe, nível) e perfil de cada um. Qualquer participante cria o seu; só o dono edita.
// Ficha completa só para dono/mestre; os demais consultam a identidade pública na carta compartilhada.
import { ROTULO_SITUACAO, useCiclo } from "./CicloPersonagens";
import { Drama, Settings2, Trash2, UserRound } from "lucide-react";
import { BotaoCriar, type OpcaoDeCriacao } from "./ui/BotaoCriar";
import { BarraDeSelecao, useSelecao } from "./ui/SelecaoMultipla";
import { CartoesCategoria, FerramentasCategoria } from "./compendio/ComponentesCategoria";
import type { LinhaCompendio } from "./compendio/consulta";
import { EditorConhecimento } from "./compendio/RegistrosCampanha";
import { useCodexApi, useConhecimento } from "./compendio/conhecimento";
import { npcSpec, registroSpec } from "./compendio/navegacao";
import { aplicarDaCampanha, useDefinicoes } from "./compendio/definicoes";
import { formatarND } from "./catalogue/sistemas/dnd5e-2014/formatar";
import { normalizar } from "./catalogue/nucleo/busca";
import "./compendio/compendio-categorias.css";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import { cartaoPublico, ehGuiado, type ResumoFicha } from "./fichas";
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


/** Situação mostrada nos filtros. Quem está "só no Compêndio" não tem ficha e não aparece aqui. */
type Situacao = "todos" | "ativos" | "aguardando" | "arquivados";
const SITUACOES: [Situacao, string][] = [["todos", "Todos"], ["ativos", "Ativos"], ["aguardando", "Aguardando decisão"], ["arquivados", "Arquivados"]];
const situacaoDe = (p: PersonagemCampanha): Exclude<Situacao, "todos"> => (p.situacao === "aguardando" ? "aguardando" : p.situacao === "arquivado" ? "arquivados" : "ativos");
type Visao = "lista" | "grade";
const chaveDaVisao = (userId: string | null) => `compendio5e:personagens:visao:${userId ?? "anonimo"}`;
const lerVisao = (userId: string | null): Visao => { try { return localStorage.getItem(chaveDaVisao(userId)) === "grade" ? "grade" : "lista"; } catch { return "lista"; } };

/** Linha da lista: um personagem (ficha ou rascunho) ou um NPC do Compêndio com ficha. */
type LinhaDePersonagem = LinhaCompendio & { busca: string; situacaoDaLinha: Exclude<Situacao, "todos">; npc: boolean; personagem?: PersonagemCampanha };

/** NPCs criados no Compêndio com ficha de criatura. Só o mestre recebe essa informação do banco. */
function useNpcsComFicha(ativo: boolean, fichasDeNpc?: ResumoFicha[]): { linhas: LinhaDePersonagem[]; carregando: boolean } {
  const conhecimento = useConhecimento(), definicoes = useDefinicoes();
  const comFicha = ativo ? conhecimento.items.filter(e => e.category === "npc" && (e.combatDefinitionId || e.characterSheet)) : [];
  const precisa = comFicha.some(e => e.combatDefinitionId);
  const [padrao, setPadrao] = useState<Awaited<ReturnType<typeof import("./catalogue/contratos").todosOsMonstros>>>([]);
  useEffect(() => { if (!precisa) return; let vivo = true; void import("./catalogue/contratos").then(c => c.todosOsMonstros()).then(ms => { if (vivo) setPadrao(ms); }, () => {}); return () => { vivo = false; }; }, [precisa]);
  const monstros = useMemo(() => (padrao.length ? aplicarDaCampanha("monster", padrao, definicoes.lista) : padrao), [padrao, definicoes.lista]);
  return { carregando: ativo && conhecimento.loading, linhas: comFicha.map(e => {
    if (e.characterSheet) {
      const f = fichasDeNpc?.find(x => x.id === e.id);
      const dados = f ? [f.classId ? rotuloClasse(f.classId) : null, f.nivel != null ? `nível ${f.nivel}` : null].filter(Boolean).join(" · ") : "";
      return { id: e.id, title: e.title, alcunha: e.fields?.nickname, subtitle: dados || "Ficha de personagem", category: "npc", body: "", entry: e, image: f?.retrato ?? null,
        spec: { kind: "ficha" as const, ref: e.id, title: e.title }, rodape: "NPC · ficha de personagem", busca: normalizar(`${e.title} ${e.fields?.nickname ?? ""}`), situacaoDaLinha: "ativos" as const, npc: true };
    }
    const m = monstros.find(x => x.id === e.combatDefinitionId);
    const detalhe = m ? `${m.nome} · ND ${formatarND(m.nd)} · PV ${m.pv}` : "Ficha de criatura";
    return { id: e.id, title: e.title, alcunha: e.fields?.nickname, subtitle: detalhe, category: "npc", body: "", entry: e, spec: npcSpec(e.id, e.title), rodape: "NPC · ficha de criatura", busca: normalizar(`${e.title} ${e.fields?.nickname ?? ""}`), situacaoDaLinha: "ativos" as const, npc: true };
  }) };
}

/** Gerenciamento técnico das fichas: aventureiros e, para o mestre, os NPCs que têm ficha. A história de cada um fica no Compêndio. */
export function PersonagensPanel({ onOpenContent, somenteMeus = false }: { onOpenContent: (s: TabSpec) => void; somenteMeus?: boolean }) {
  const api = useRegistros(), fichas = useFichas(), { active } = useCampaigns(), { user } = useAuth(), v = useVersaoRegistros(), codex = useCodexApi();
  const [dados, setDados] = useState<ListaPersonagens | null>(null), [erro, setErro] = useState<string | null>(null), [tentativa, setTentativa] = useState(0);
  const [aviso, setAviso] = useState<{ ok: boolean; t: string } | null>(null), [descartando, setDescartando] = useState<string | null>(null), [enviando, setEnviando] = useState<string | null>(null);
  const consultar = useAbrirConsulta(onOpenContent), jogador = useJogadoresCampanha(), ciclo = useCiclo();
  const [situacao, setSituacao] = useState<Situacao>("todos"), [criandoNpc, setCriandoNpc] = useState(false);
  const cid = active?.campaign.id, userId = user?.id ?? null, mestre = active?.role === "mestre";
  const [pesquisa, setPesquisa] = useState(""), [ordem, setOrdem] = useState("nome"), [visao, setVisao] = useState<Visao>(() => lerVisao(userId));
  useEffect(() => { setVisao(lerVisao(userId)); }, [userId]);
  const trocarVisao = (nova: Visao) => { setVisao(nova); try { localStorage.setItem(chaveDaVisao(userId), nova); } catch { /* só não lembra */ } };
  useEffect(() => { setDados(null); setErro(null); setAviso(null); setSituacao("todos"); setPesquisa(""); setCriandoNpc(false); }, [cid]);   // nada de uma campanha aparece em outra
  useEffect(() => {
    if (!api || !cid) return; let vivo = true;
    listarPersonagens(cid, { registros: api, fichas, userId }).then(r => { if (!vivo) return; if (r.ok) { setDados(r.data); setErro(null); } else setErro(r.error); }, () => { if (vivo) setErro("Não foi possível carregar os personagens."); });
    return () => { vivo = false; };
  }, [api, fichas, cid, userId, v, tentativa]);
  const locais = useMemo<ResumoPersonagemGuiado[]>(() => { try { return userId && cid ? armazenamentoLocalExperimental(userId, cid).listar() : []; } catch { return []; } }, [userId, cid, v, tentativa]);
  useEffect(() => { locais.forEach(g => registrarTitulo(g.id, g.nome)); dados?.personagens.forEach(p => registrarTitulo(p.id, p.nome)); }, [locais, dados]);   // abas restauradas mostram o nome
  const { linhas: npcsDoCompendio, carregando: carregandoNpcs } = useNpcsComFicha(!!mestre && !somenteMeus, dados?.fichasDeNpc);
  const selecaoDe = useSelecao(`${userId}:${cid}:${active?.role}`);
  const caminhos = useUrlsDosCaminhos(dados?.personagens ?? []);
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

  const comCiclo = ciclo.disponivel && !!dados?.ciclo;
  const todos = dados?.personagens ?? [];
  const abreFicha = (p: PersonagemCampanha) => p.situacao !== "compendio" && (p.meu || mestre);
  const linhaDe = (p: PersonagemCampanha): LinhaDePersonagem => {
    const npc = p.situacao === "npc";
    const responsavel = p.situacao === "ativo" ? jogador(p.ownerId) : undefined;
    const aviso = rotuloPrivacidade(p, mestre);
    const rodape = [npc ? "NPC · ficha de personagem" : responsavel ? `Jogador: ${responsavel}` : null, !npc && p.situacao !== "ativo" ? ROTULO_SITUACAO[p.situacao] : null,
      p.pendenteDe ? `Transferência aguardando ${jogador(p.pendenteDe) ?? "aceite"}` : null, aviso].filter(Boolean).join(" · ");
    return { id: p.id, title: p.nome, category: npc ? "npc" : "character", body: "", image: p.retratoUrl ?? caminhos.get(p.id) ?? null,
      alcunha: p.alcunha, subtitle: [p.classe, p.nivel != null ? `nível ${p.nivel}` : null, p.meu ? (p.comFicha ? "sua ficha" : "seu") : null].filter(Boolean).join(" · "),
      rodape: rodape || "Aventureiro", spec: abreFicha(p) ? { kind: "ficha", ref: p.id, title: p.nome } : identidadeSpec(p.id, p.nome),
      busca: normalizar(`${p.nome} ${p.alcunha ?? ""} ${responsavel ?? ""}`), situacaoDaLinha: situacaoDe(p), npc, personagem: p };
  };
  // o jogador só vê aventureiros em jogo; NPCs e personagens fora de jogo são assunto do mestre (a narrativa continua no Compêndio)
  const doGrupo = todos.filter(p => p.situacao !== "compendio" && (somenteMeus ? p.meu : mestre || p.situacao === "ativo"));
  const rascunhos: LinhaDePersonagem[] = (fichas ? [] : locais).map(g => ({ id: g.id, title: g.nome, category: "character", body: "", subtitle: `${rotuloClasse(g.classId)} · nível ${g.nivel} · guiado (neste navegador)`,
    rodape: "Rascunho", spec: { kind: "criador", ref: g.id, title: g.nome }, busca: normalizar(g.nome), situacaoDaLinha: "ativos", npc: false }));
  const universo = [...doGrupo.map(linhaDe), ...rascunhos, ...npcsDoCompendio];
  const termos = normalizar(pesquisa).split(/\s+/).filter(Boolean);
  const linhas = universo.filter(l => (situacao === "todos" || l.situacaoDaLinha === situacao) && termos.every(t => l.busca.includes(t)))
    .sort((a, b) => a.title.localeCompare(b.title, "pt-BR") * (ordem === "inverso" ? -1 : 1));
  const mostraSecoes = mestre && !somenteMeus;
  const vazio = !!dados && universo.length === 0;
  // elegível: quem o usuário pode gerenciar E está visível com os filtros e a pesquisa atuais
  const podeSelecionar = mestre && comCiclo && !somenteMeus;
  const selecao = selecaoDe(podeSelecionar ? linhas.filter(l => l.personagem).map(l => l.id) : []);

  const extrasDe = (linha: LinhaCompendio) => {
    const l = linha as LinhaDePersonagem, p = l.personagem;
    if (!p) return l.entry ? [{ rotulo: "Abrir identidade no Compêndio", icone: Drama, acao: () => onOpenContent(registroSpec(l.id, l.title)) }] : [];
    if (!comCiclo) return [];
    if (mestre) return [{ rotulo: "Gerenciar personagem", icone: Settings2, acao: () => ciclo.gerenciar(p.id) }];
    return p.meu && p.comFicha ? [{ rotulo: "Excluir personagem", icone: Trash2, perigo: true, acao: () => ciclo.pedirRenuncia(p.id) }] : [];
  };
  const marcacao = selecao.ativa && podeSelecionar ? { pode: (l: LinhaCompendio) => !!(l as LinhaDePersonagem).personagem, marcado: (l: LinhaCompendio) => selecao.marcado(l.id), alternar: (l: LinhaCompendio) => selecao.alternar(l.id) } : undefined;
  // ficha própria ou do mestre abre direto; os demais consultam a apresentação na carta do Compêndio
  const abrir = (s: TabSpec) => (s.kind === "identidade" ? consultar(s) : onOpenContent(s));
  const cartoes = (rows: LinhaDePersonagem[], rotulo: string) => <CartoesCategoria rows={rows} view={visao} onOpen={abrir} listLabel={rotulo} extrasDe={extrasDe} marcacao={marcacao} enxuto/>;
  const criacao: OpcaoDeCriacao[] = [{ rotulo: "Criar aventureiro", icone: UserRound, acao: novo },
    ...(mestre && codex && !somenteMeus ? [{ rotulo: "Criar NPC", icone: Drama, acao: () => setCriandoNpc(true) }] : [])];

  return <div className="content personagens cd-page">
    <div className="eyebrow">{active.campaign.name.toLocaleUpperCase("pt-BR")}</div>
    <div className="row-between"><h1>{somenteMeus ? "Meus personagens" : "Personagens"}</h1><BotaoCriar opcoes={criacao}/></div>
    {aviso && <Aviso erro={!aviso.ok} t={aviso.t}/>}
    {erro && <Aviso erro t={erro} onRetry={() => setTentativa(n => n + 1)}/>}
    {dados?.avisoFichas && <Aviso erro t={`${dados.avisoFichas} A lista pode estar incompleta.`} onRetry={() => setTentativa(n => n + 1)}/>}
    {!dados && !erro && <p className="muted" role="status">Carregando personagens…</p>}
    {ciclo.ofertas.map(o => <p key={o.id} className="notice" role="note">O mestre quer transferir <strong>{o.title}</strong> para você.{" "}<button type="button" className="btn-secondary" onClick={() => ciclo.abrirOferta(o)}>Responder</button></p>)}
    <FerramentasCategoria compacta searchLabel="Pesquisar por personagem ou jogador" placeholder="Pesquisar por personagem ou jogador…" query={pesquisa} onQuery={setPesquisa} view={visao} onView={trocarVisao} order={ordem} onOrder={setOrdem}
      filters={mostraSecoes && comCiclo ? <>
        <div className="cd-filters" role="group" aria-label="Situação dos personagens">{SITUACOES.map(([id, rotulo]) => <button key={id} type="button" aria-pressed={situacao === id} onClick={() => setSituacao(id)}>{rotulo}</button>)}</div>
        <label className="cd-filtro-compacto"><span className="sr-only">Situação</span><select aria-label="Filtrar por situação" value={situacao} onChange={e => setSituacao(e.target.value as Situacao)}>{SITUACOES.map(([id, rotulo]) => <option key={id} value={id}>{rotulo}</option>)}</select></label>
      </> : undefined}/>
    {podeSelecionar && <BarraDeSelecao selecao={selecao} rotulo="Seleção de personagens" acoes={<button type="button" className="btn-secondary danger" onClick={() => ciclo.excluirVarios(selecao.marcados)}>Excluir selecionados ({selecao.marcados.length})</button>}/>}
    {vazio && !dados?.avisoFichas && <p className="muted" data-testid="personagens-vazio">Nenhum personagem ainda. Crie o primeiro.</p>}
    {!!dados && !vazio && !linhas.length && <p className="muted" role="status">{termos.length ? "Nenhum personagem encontrado nesta pesquisa." : "Nenhum personagem neste filtro."}</p>}
    <section className="personagens-lista" aria-label="Personagens da campanha">
      {mostraSecoes ? <>
        {linhas.some(l => !l.npc) && <section aria-label="Aventureiros"><h2 className="personagens-secao">Aventureiros</h2>{cartoes(linhas.filter(l => !l.npc), "Aventureiros")}</section>}
        {!!dados && !vazio && linhas.length > 0 && <section aria-label="NPCs"><h2 className="personagens-secao">NPCs</h2>
          {linhas.some(l => l.npc) ? cartoes(linhas.filter(l => l.npc), "NPCs")
            : !carregandoNpcs && <p className="muted personagens-sem-npc">{termos.length || situacao !== "todos" ? "Nenhum NPC com ficha neste filtro." : "Nenhum NPC com ficha. NPCs sem ficha ficam no Compêndio."}</p>}</section>}
      </> : cartoes(linhas, somenteMeus ? "Meus personagens" : "Aventureiros")}
    </section>
    {fichas && locais.length > 0 && <div data-testid="rascunhos-locais"><h2>Rascunhos neste navegador <small className="muted">(experimental)</small></h2>
      <p className="muted">Criados antes do salvamento na campanha. Nada é enviado nem apagado sozinho: envie cada um quando quiser; a cópia local só é removida depois que o servidor confirmar.</p>
      <ul className="criador-locais">{locais.map(g => <li key={g.id}><span><strong>{g.nome}</strong> <small className="muted">nível {g.nivel}</small></span>
        <span className="row"><button className="btn-secondary" onClick={() => onOpenContent({ kind: "criador", ref: g.id, title: g.nome })} aria-label={`Revisar rascunho local ${g.nome}`}>Revisar</button>
          <button className="btn-primary" onClick={() => void enviar(g)} disabled={enviando !== null} aria-label={`${enviando === g.id ? "Enviando…" : "Enviar para a campanha"}: ${g.nome}`}>{enviando === g.id ? "Enviando…" : "Enviar para a campanha"}</button>
          {descartando === g.id ? <><button className="btn-secondary danger" onClick={() => descartar(g)}>Confirmar descarte</button><button className="btn-secondary" onClick={() => setDescartando(null)}>Cancelar</button></>
            : <button className="btn-secondary danger" onClick={() => setDescartando(g.id)} aria-label={`Descartar rascunho local ${g.nome}`}>Descartar</button>}</span></li>)}</ul></div>}
    {criandoNpc && <EditorConhecimento category="npc" entry={null} onDone={id => { setCriandoNpc(false); avisarRegistros(); if (id) { setAviso({ ok: true, t: "NPC criado no Compêndio. Atribua uma ficha para ele aparecer em Personagens." }); onOpenContent(registroSpec(id)); } }}/>}
  </div>;
}

/** Retratos de perfis simples, guardados no armazenamento da campanha. */
function useUrlsDosCaminhos(personagens: PersonagemCampanha[]): ReadonlyMap<string, string> {
  const capa = useCapa(), [urls, setUrls] = useState<ReadonlyMap<string, string>>(new Map());
  const pedidos = personagens.filter(p => !p.retratoUrl && p.retratoCaminho).map(p => `${p.id} ${p.retratoCaminho}`).join("\n");
  useEffect(() => {
    if (!capa || !pedidos) { setUrls(new Map()); return; }
    let vivo = true;
    void Promise.all(pedidos.split("\n").map(async linha => { const [id, caminho] = linha.split(" "), { base, enquadramento } = separar(caminho), u = await capa.urlDe(base); return u.ok ? [id, juntar(u.data, enquadramento)] as const : null; }))
      .then(r => { if (vivo) setUrls(new Map(r.flatMap(x => (x ? [x] : [])))); }, () => {});
    return () => { vivo = false; };
  }, [capa, pedidos]);
  return urls;
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

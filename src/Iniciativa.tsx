// Iniciativa e Encontros (somente o mestre). Dois modos de armazenamento, sempre visíveis na tela:
//  • LOCAL (padrão): neste aparelho, por usuário e campanha (`compendio5e:iniciativa:<usuário>:<campanha>`).
//  • NUVEM (VITE_COMBATE_REMOTO=1 + Supabase com as migrações 0009/0010 aplicadas): combate e encontros no servidor, salvamento automático com confirmação,
//    conflito de versão explícito, recuperação de falhas de conexão e retomada em outro aparelho (DEC-20261123-G/H). Combates antigos do navegador NÃO são importados
//    nem apagados: ficam como backup local, com opção de baixar. A lógica de combate é neutra quanto ao sistema de RPG (`combate.ts`).
import { ChevronLeft, ChevronRight, Copy, Dices, Download, LayoutGrid, List, Pencil, Plus, RotateCcw, Swords, Trash2 } from "lucide-react";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { useAventureiros } from "./AventureirosContext";
import { useAuth } from "./AuthContext";
import { useCampaigns } from "./CampaignsContext";
import { Aviso } from "./Diario";
import { useUnsavedGuard } from "./unsaved";
import {
  adicionar, adicionarParticipante, alterarPv, alternarCondicao, chaveCombate, chaveEncontros, combateVazio, definirIniciativa, duplicarEncontro, enviarParaCombate, lerCombate, lerEncontros,
  novoId, ordenar, proximoTurno, reiniciarRodadas, remover, renomearEncontro, rolarIniciativa, turnoAnterior, type Encontro, type EstadoCombate, type Lado, type RefCombate,
} from "./combate";
import { criarApiEncontros } from "./encontrosRemoto";
import { criarApiLinhaCombate, type ApiLinha } from "./linhaRemota";
import { useLinhaRemota, type SyncRemoto } from "./useLinhaRemota";
import type { Monstro } from "./catalogue/sistemas/dnd5e-2014/esquemas";

const EVENTO = "compendio5e:armazenamento";
export type VisualizacaoCombate = "cartoes" | "lista";
export const chaveVisualizacaoCombate = (userId: string) => `compendio5e:visualizacao-combate:${userId}`;
export const lerVisualizacaoCombate = (valor: string | null): VisualizacaoCombate => valor === "lista" ? "lista" : "cartoes";
type Estado<T> = { status: "carregando" } | { status: "erro"; mensagem?: string } | { status: "pronto"; valor: T; falhaGravacao?: boolean };
type EstadoEscopado<T> = { chave: string | null; estado: Estado<T> };

// ---------------------------------------------------------------- nuvem (opcional, explícita)
export type ApisNuvem = { combate: ApiLinha<EstadoCombate>; encontros: ApiLinha<Encontro[]> };
/** Permite injetar as APIs (testes e futuras integrações). Sem provedor, a nuvem só liga com VITE_COMBATE_REMOTO=1 e cliente Supabase configurado. */
export const NuvemContext = createContext<ApisNuvem | null>(null);
const nuvemHabilitada = () => import.meta.env.VITE_COMBATE_REMOTO === "1";
function useNuvem(): ApisNuvem | null {
  const injetada = useContext(NuvemContext), { client } = useAuth() as { client?: Parameters<typeof criarApiEncontros>[0] | null };
  return useMemo(() => injetada ?? (nuvemHabilitada() && client ? { combate: criarApiLinhaCombate(client), encontros: criarApiEncontros(client) } : null), [injetada, client]);
}

/** Lê o valor do armazenamento local (com estado de carregamento e de erro), grava a cada mudança e se mantém em dia com outras telas do mesmo aparelho. */
function useArmazenado<T>(chave: string | null, ler: (bruto: string | null) => T) {
  const [snapshot, setSnapshot] = useState<EstadoEscopado<T>>({ chave: null, estado: { status: "carregando" } });
  const estado = snapshot.chave === chave ? snapshot.estado : { status: "carregando" as const };
  const setEstado = useCallback((proximo: Estado<T>) => setSnapshot({ chave, estado: proximo }), [chave]);
  const [tentativa, setTentativa] = useState(0);
  const lerRef = useRef(ler); lerRef.current = ler;
  const pendente = useRef<{ chave: string; valor: T } | null>(null);
  const atual = useRef<T | null>(null);
  const carregar = useCallback(() => {
    if (!chave || pendente.current?.chave === chave) return;
    try { const v = lerRef.current(localStorage.getItem(chave)); atual.current = v; setEstado({ status: "pronto", valor: v }); } catch { setEstado({ status: "erro" }); }
  }, [chave, setEstado]);
  useEffect(() => { if (!chave) return; setEstado({ status: "carregando" }); const t = setTimeout(carregar, 0); return () => clearTimeout(t); }, [carregar, tentativa, chave, setEstado]);
  useEffect(() => {
    const aoMudar = (e: Event) => { if ((e as CustomEvent<string>).detail === chave) carregar(); };
    window.addEventListener(EVENTO, aoMudar); return () => window.removeEventListener(EVENTO, aoMudar);
  }, [chave, carregar]);
  const gravar = useCallback((valor: T) => {
    if (!chave) return false;
    atual.current = valor;
    try {
      localStorage.setItem(chave, JSON.stringify(valor));
      pendente.current = null;
      setEstado({ status: "pronto", valor });
      window.dispatchEvent(new CustomEvent(EVENTO, { detail: chave }));
      return true;
    } catch {
      pendente.current = { chave, valor };
      setEstado({ status: "pronto", valor, falhaGravacao: true });
      return false;
    }
  }, [chave, setEstado]);
  /** Aplica a alteração sobre o valor MAIS RECENTE (não sobre o da última renderização): ações seguidas não se perdem. */
  const alterar = useCallback((fn: (v: T) => T) => { if (atual.current === null) return false; gravar(fn(atual.current)); return true; }, [gravar]);
  const salvarPendente = useCallback(() => pendente.current?.chave === chave ? gravar(pendente.current.valor) : true, [chave, gravar]);
  const descartar = useCallback(() => { if (chave) { try { localStorage.removeItem(chave); } catch { /* sem armazenamento */ } } setTentativa(n => n + 1); }, [chave]);
  return { estado, gravar, alterar, salvarPendente, tentar: () => {
    if (pendente.current?.chave === chave) gravar(pendente.current.valor);
    else setTentativa(n => n + 1);
  }, descartar };
}

const rotuloLado: Record<Lado, string> = { aliado: "Aliado", inimigo: "Inimigo", neutro: "Neutro" };
/** Condições do D&D 5e 2014 (a lista de cada sistema fica na interface; o domínio aceita texto livre curto). */
const CONDICOES_5E = ["Cego", "Enfeitiçado", "Surdo", "Amedrontado", "Agarrado", "Incapacitado", "Invisível", "Paralisado", "Petrificado", "Envenenado", "Caído", "Contido", "Atordoado", "Inconsciente", "Exaustão"];
const numero = (s: string) => (s.trim() === "" ? undefined : Number(s.replace(",", ".")));
const sem = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLocaleLowerCase("pt-BR");

function useEscopo() {
  const { user } = useAuth(), { active } = useCampaigns();
  return { userId: user?.id ?? null, campaignId: active?.campaign.id ?? null, campanha: active?.campaign.name ?? null, podeGerenciar: active?.role === "mestre" };
}
function SemCampanha({ titulo }: { titulo: string }) {
  return <div className="content"><div className="eyebrow">COMPÊNDIO 5e</div><h1>{titulo}</h1>
    <div className="notice" role="status">Escolha ou entre em uma campanha para usar esta tela: os dados ficam separados por campanha.</div></div>;
}
function AcessoRestrito({ titulo }: { titulo: string }) {
  return <div className="content"><div className="eyebrow">COMPÊNDIO 5e</div><h1>{titulo}</h1>
    <div className="notice" role="status">Somente o mestre da campanha pode acessar este módulo.</div></div>;
}
function ErroArmazenamento({ onTentar, onDescartar, o }: { onTentar: () => void; onDescartar: () => void; o: string }) {
  return <>
    <Aviso erro t={`Não foi possível ler ${o} guardado neste aparelho (dado corrompido ou armazenamento bloqueado).`} onRetry={onTentar}/>
    <p className="muted">Se continuar, você pode <button className="btn-link" onClick={onDescartar}>descartar o que está guardado e começar de novo</button>. Isso só apaga {o} desta campanha neste aparelho.</p>
  </>;
}

/** Modo de armazenamento sempre visível (local ou nuvem) e estado da sincronização. */
function ModoArmazenamento({ nuvem, sync, mensagem, o, onTentar, onRecarregar }: { nuvem: boolean; sync: SyncRemoto; mensagem: string | null; o: string; onTentar: () => void; onRecarregar: () => void }) {
  if (!nuvem) return <p className="muted ini-modo" role="status" data-modo="local">Modo local: {o} ficam só neste aparelho e não aparecem em outros dispositivos.</p>;
  if (sync === "conflito") return <div className="notice err" role="alert" data-modo="nuvem" data-sync="conflito">
    {mensagem ?? "Outra sessão alterou os dados."} Suas últimas alterações não foram gravadas (uma cópia ficou neste aparelho). <button className="btn-link" onClick={onRecarregar}>Recarregar do servidor</button> (descarta o que não foi gravado).</div>;
  if (sync === "permissao") return <Aviso erro t={mensagem ?? "Sem permissão para gravar."}/>;
  if (sync === "falha") return <div className="notice err" role="alert" data-modo="nuvem" data-sync="falha">{mensagem ?? "Sem conexão com o servidor."} As alterações continuam nesta tela e serão enviadas assim que a conexão voltar. <button className="btn-link" onClick={onTentar}>Tentar agora</button></div>;
  return <p className="muted ini-modo" role="status" data-modo="nuvem" data-sync={sync}>{sync === "salvando" ? "Salvando na nuvem…" : `Salvo na nuvem (${o}): disponível em qualquer aparelho em que você entrar como mestre desta campanha.`}</p>;
}
function BackupLocal({ chave, rotulo }: { chave: string; rotulo: string }) {
  const [bruto, setBruto] = useState<string | null>(null);
  useEffect(() => { try { setBruto(localStorage.getItem(chave)); } catch { setBruto(null); } }, [chave]);
  if (!bruto) return null;
  const baixar = () => { const url = URL.createObjectURL(new Blob([bruto], { type: "application/json" })); const a = document.createElement("a"); a.href = url; a.download = `${rotulo}-backup-local.json`; a.click(); URL.revokeObjectURL(url); };
  return <p className="muted" role="note">Há {rotulo} guardado neste aparelho (de antes da nuvem). Ele <strong>não foi importado nem apagado</strong>. <button className="btn-link" onClick={baixar}><Download size={13} aria-hidden="true"/> Baixar backup</button></p>;
}

// ---------------------------------------------------------------- seletores de conteúdo canônico (sem bancos paralelos)
const modAtributo = (v: number) => Math.floor((v - 10) / 2);
function SeletorMonstro({ rotulo, onEscolher }: { rotulo: string; onEscolher: (m: Monstro) => void }) {
  const [aberto, setAberto] = useState(false), [busca, setBusca] = useState("");
  const [dados, setDados] = useState<{ status: "carregando" } | { status: "erro" } | { status: "pronto"; lista: readonly Monstro[] }>({ status: "carregando" });
  const carregar = useCallback(() => { setDados({ status: "carregando" }); import("./catalogue/contratos").then(c => c.todosOsMonstros()).then(lista => setDados({ status: "pronto", lista }), () => setDados({ status: "erro" })); }, []);
  useEffect(() => { if (aberto && dados.status === "carregando") carregar(); }, [aberto]);   // eslint-disable-line react-hooks/exhaustive-deps
  const achados = useMemo(() => {
    if (dados.status !== "pronto" || busca.trim().length < 2) return [];
    const q = sem(busca.trim());
    return dados.lista.filter(m => sem(m.nome).includes(q) || sem(m.en).includes(q)).slice(0, 8);
  }, [dados, busca]);
  return <details className="ini-seletor" open={aberto} onToggle={e => setAberto((e.target as HTMLDetailsElement).open)}>
    <summary>{rotulo}</summary>
    {dados.status === "carregando" && aberto && <p className="muted" role="status">Carregando o Bestiário…</p>}
    {dados.status === "erro" && <Aviso erro t="Não foi possível carregar o Bestiário." onRetry={carregar}/>}
    {dados.status === "pronto" && <>
      <label>Buscar monstro<input type="search" value={busca} onChange={e => setBusca(e.target.value)} placeholder="Nome em português ou inglês"/></label>
      {busca.trim().length >= 2 && achados.length === 0 && <p className="muted">Nenhum monstro encontrado.</p>}
      <ul className="ini-achados">{achados.map(m => <li key={m.id}><button type="button" className="btn-secondary" onClick={() => onEscolher(m)} aria-label={`Adicionar ${m.nome} do Bestiário`}>
        <strong>{m.nome}</strong> <small>ND {m.nd >= 1 ? m.nd : m.nd === 0.5 ? "1/2" : m.nd === 0.25 ? "1/4" : m.nd === 0.125 ? "1/8" : m.nd} · PV {m.pv} · CA {m.ca}</small></button></li>)}</ul>
    </>}
  </details>;
}
function SeletorPersonagem({ campaignId, onEscolher }: { campaignId: string; onEscolher: (p: { id: string; nome: string }) => void }) {
  const fonte = useAventureiros();
  const [aberto, setAberto] = useState(false);
  const [dados, setDados] = useState<{ status: "carregando" } | { status: "erro" } | { status: "pronto"; lista: { id: string; nome: string; classe: string }[] }>({ status: "carregando" });
  const carregar = useCallback(() => { if (!fonte) return; setDados({ status: "carregando" }); fonte.listar(campaignId).then(r => setDados(r.ok ? { status: "pronto", lista: r.data } : { status: "erro" }), () => setDados({ status: "erro" })); }, [fonte, campaignId]);
  useEffect(() => { if (aberto && dados.status === "carregando") carregar(); }, [aberto]);   // eslint-disable-line react-hooks/exhaustive-deps
  if (!fonte) return null;
  return <details className="ini-seletor" open={aberto} onToggle={e => setAberto((e.target as HTMLDetailsElement).open)}>
    <summary>Adicionar personagem da campanha</summary>
    {dados.status === "carregando" && aberto && <p className="muted" role="status">Carregando personagens…</p>}
    {dados.status === "erro" && <Aviso erro t="Não foi possível carregar os personagens da campanha." onRetry={carregar}/>}
    {dados.status === "pronto" && (dados.lista.length === 0 ? <p className="muted">Esta campanha ainda não tem personagens vinculados.</p>
      : <ul className="ini-achados">{dados.lista.map(p => <li key={p.id}><button type="button" className="btn-secondary" onClick={() => onEscolher(p)} aria-label={`Adicionar ${p.nome} (personagem)`}><strong>{p.nome}</strong> <small>{p.classe}</small></button></li>)}</ul>)}
  </details>;
}

// ---------------------------------------------------------------- Iniciativa
/** Combate: mesmo contrato nos dois modos. `aplicar` recebe uma função sobre o estado mais recente. */
function useLojaCombate(userId: string | null, campaignId: string | null, podeGerenciar: boolean, nuvem: ApisNuvem | null) {
  const ativo = !!(userId && campaignId && podeGerenciar);
  const local = useArmazenado<EstadoCombate>(ativo && !nuvem ? chaveCombate(userId!, campaignId!) : null, lerCombate);
  const remoto = useLinhaRemota<EstadoCombate>({ api: ativo && nuvem ? nuvem.combate : null, campaignId: ativo && nuvem ? campaignId : null, vazio: combateVazio, chaveBackup: ativo && nuvem ? `compendio5e:combate-nuvem:${userId}:${campaignId}` : null });
  // um envio de encontro (outra aba/painel) avisa por evento: relê, a não ser que haja alteração minha ainda não gravada
  useEffect(() => {
    if (!nuvem || !campaignId) return;
    const aoMudar = (e: Event) => { if ((e as CustomEvent<string>).detail === `nuvem:combate:${campaignId}` && !remoto.sujo) void remoto.recarregar(); };
    window.addEventListener(EVENTO, aoMudar); return () => window.removeEventListener(EVENTO, aoMudar);
  }, [nuvem, campaignId, remoto.sujo, remoto.recarregar]);   // eslint-disable-line react-hooks/exhaustive-deps
  if (nuvem) {
    const estado: Estado<EstadoCombate> = remoto.carga.status === "pronto" ? { status: "pronto", valor: remoto.carga.valor } : remoto.carga.status === "erro" ? { status: "erro", mensagem: remoto.carga.mensagem } : { status: "carregando" };
    return { nuvem: true as const, estado, aplicar: (fn: (e: EstadoCombate) => EstadoCombate) => remoto.alterar(fn), sync: remoto.sync, mensagem: remoto.mensagem, sujo: remoto.sujo, salvar: async () => { remoto.tentarAgora(); return remoto.sync === "salvo"; },
      tentar: remoto.tentarAgora, recarregar: remoto.recarregar, descartar: () => void remoto.recarregar(),
      finalizar: async (): Promise<string | null> => { const r = await remoto.finalizar(); return r.ok ? null : r.mensagem; } };
  }
  return { nuvem: false as const, estado: local.estado, aplicar: (fn: (e: EstadoCombate) => EstadoCombate) => local.alterar(fn), sync: "salvo" as SyncRemoto, mensagem: null, sujo: local.estado.status === "pronto" && !!local.estado.falhaGravacao,
    salvar: async () => local.salvarPendente(), tentar: local.tentar, recarregar: async () => local.tentar(), descartar: local.descartar,
    finalizar: async (): Promise<string | null> => { local.alterar(() => combateVazio()); return null; } };
}

export function IniciativaPanel() {
  const { userId, campaignId, campanha, podeGerenciar } = useEscopo();
  const nuvem = useNuvem();
  const loja = useLojaCombate(userId, campaignId, podeGerenciar, nuvem);
  const { estado, aplicar } = loja;
  useUnsavedGuard("secao:iniciativa", loja.sujo, loja.salvar);
  const [nome, setNome] = useState(""), [ini, setIni] = useState(""), [pv, setPv] = useState(""), [lado, setLado] = useState<Lado>("inimigo");
  const [visualizacao, setVisualizacao] = useState<VisualizacaoCombate>("cartoes"), [erroFinalizar, setErroFinalizar] = useState<string | null>(null);
  const [mods, setMods] = useState<Record<string, number>>({});   // bônus de iniciativa por combatente (monstros: Destreza do catálogo)
  useEffect(() => {
    try { setVisualizacao(lerVisualizacaoCombate(localStorage.getItem(chaveVisualizacaoCombate(userId ?? "")))); }
    catch { setVisualizacao("cartoes"); }
  }, [userId]);
  const alterarVisualizacao = (proxima: VisualizacaoCombate) => {
    setVisualizacao(proxima);
    if (userId) try { localStorage.setItem(chaveVisualizacaoCombate(userId), proxima); } catch { /* preferência em memória */ }
  };
  if (!userId || !campaignId) return <SemCampanha titulo="Iniciativa"/>;
  if (!podeGerenciar) return <AcessoRestrito titulo="Iniciativa"/>;
  const combate = estado.status === "pronto" ? estado.valor : null;
  const submeter = (ev: React.FormEvent) => {
    ev.preventDefault(); if (!combate || !nome.trim()) return;
    const max = numero(pv), valorIni = numero(ini) ?? 0;
    aplicar(e => adicionar(e, { nome, iniciativa: valorIni, lado, ...(max && max > 0 ? { pv: max, pvMax: max } : {}) }));
    setNome(""); setIni(""); setPv("");
  };
  const adicionarMonstro = (m: Monstro) => {
    const id = novoId(), bonus = modAtributo(m.atributos.dex);
    const existentes = (combate?.combatentes ?? []).filter(c => c.ref?.tipo === "monstro" && c.ref.id === m.id).length;
    setMods(x => ({ ...x, [id]: bonus }));
    aplicar(e => rolarIniciativa(adicionar(e, { id, nome: existentes || e.combatentes.some(c => c.nome === m.nome) ? `${m.nome} ${existentes + 1}` : m.nome, iniciativa: 0, lado: "inimigo", pv: m.pv, pvMax: m.pv, ref: { tipo: "monstro", id: m.id } }), id, bonus));
  };
  const adicionarPersonagem = (p: { id: string; nome: string }) => aplicar(e => e.combatentes.some(c => c.ref?.tipo === "personagem" && c.ref.id === p.id) ? e : adicionar(e, { nome: p.nome, iniciativa: 0, lado: "aliado", ref: { tipo: "personagem", id: p.id } }));
  const ordem = combate ? ordenar(combate.combatentes) : [];
  const finalizar = async () => {
    if (!window.confirm("Finalizar e descartar este combate? Os encontros salvos serão preservados. Esta ação não pode ser desfeita.")) return;
    setErroFinalizar(await loja.finalizar());
  };
  return <div className="content iniciativa">
    <div className="eyebrow">{(campanha ?? "").toLocaleUpperCase("pt-BR")} · COMBATE</div><h1>Iniciativa</h1>
    {estado.status === "carregando" && <div className="notice" role="status" aria-live="polite">Carregando o combate…</div>}
    {estado.status === "erro" && (nuvem ? <Aviso erro t={estado.mensagem ?? "Não foi possível carregar o combate no servidor."} onRetry={loja.tentar}/> : <ErroArmazenamento onTentar={loja.tentar} onDescartar={loja.descartar} o="o combate"/>)}
    {estado.status === "pronto" && !nuvem && estado.falhaGravacao && <Aviso erro t="Não foi possível salvar o combate. As alterações continuam nesta tela; tente salvar novamente antes de sair." onRetry={loja.tentar}/>}
    {erroFinalizar && <Aviso erro t={erroFinalizar}/>}
    {combate && <>
      <ModoArmazenamento nuvem={loja.nuvem} sync={loja.sync} mensagem={loja.mensagem} o="o combate" onTentar={loja.tentar} onRecarregar={() => void loja.recarregar()}/>
      {loja.nuvem && <BackupLocal chave={chaveCombate(userId, campaignId)} rotulo="combate"/>}
      <form className="ini-form" onSubmit={submeter} aria-label="Adicionar combatente">
        <label>Nome<input value={nome} onChange={e => setNome(e.target.value)} required maxLength={60}/></label>
        <label>Iniciativa<input inputMode="decimal" value={ini} onChange={e => setIni(e.target.value)} placeholder="0"/></label>
        <label>PV (opcional)<input inputMode="numeric" value={pv} onChange={e => setPv(e.target.value)}/></label>
        <label>Lado<select value={lado} onChange={e => setLado(e.target.value as Lado)}>{(Object.keys(rotuloLado) as Lado[]).map(l => <option key={l} value={l}>{rotuloLado[l]}</option>)}</select></label>
        <button type="submit" className="btn-secondary"><Plus size={15} aria-hidden="true"/> Adicionar</button>
      </form>
      <SeletorMonstro rotulo="Adicionar do Bestiário (rola a iniciativa)" onEscolher={adicionarMonstro}/>
      <SeletorPersonagem campaignId={campaignId} onEscolher={adicionarPersonagem}/>
      <div className="ini-barra">
        <strong role="status">Rodada {combate.rodada}</strong>
        <button className="btn-secondary" onClick={() => aplicar(turnoAnterior)} disabled={!ordem.length}><ChevronLeft size={15} aria-hidden="true"/> Turno anterior</button>
        <button className="btn-secondary" onClick={() => aplicar(proximoTurno)} disabled={!ordem.length}><ChevronRight size={15} aria-hidden="true"/> Próximo turno</button>
        <button className="btn-secondary" onClick={() => aplicar(reiniciarRodadas)} disabled={!ordem.length}><RotateCcw size={15} aria-hidden="true"/> Reiniciar rodadas</button>
        <button className="btn-secondary" onClick={() => void finalizar()} disabled={!ordem.length}><Trash2 size={15} aria-hidden="true"/> Finalizar combate</button>
      </div>
      <div className="ini-visualizacao" role="group" aria-label="Visualização dos combatentes">
        <button type="button" className={visualizacao === "cartoes" ? "btn-secondary selecionado" : "btn-secondary"} aria-pressed={visualizacao === "cartoes"} onClick={() => alterarVisualizacao("cartoes")}><LayoutGrid size={15} aria-hidden="true"/> Cartões</button>
        <button type="button" className={visualizacao === "lista" ? "btn-secondary selecionado" : "btn-secondary"} aria-pressed={visualizacao === "lista"} onClick={() => alterarVisualizacao("lista")}><List size={15} aria-hidden="true"/> Lista compacta</button>
      </div>
      {ordem.length === 0
        ? <div className="placeholder vazio" role="status"><Swords size={30} aria-hidden="true"/><strong>Nenhum combatente ainda</strong><span>Adicione quem vai lutar acima, com a iniciativa de cada um. Encontros preparados na aba Encontros podem ser enviados para cá.</span></div>
        : <ol className={`ini-lista ${visualizacao === "lista" ? "ini-lista-compacta" : "ini-lista-cartoes"}`} aria-label="Ordem de iniciativa">{ordem.map(c => <Linha key={c.id} c={c} atual={c.id === combate.turno} aplicar={aplicar} bonus={mods[c.id] ?? 0}/>)}</ol>}
    </>}
  </div>;
}
type Aplicar = (fn: (e: EstadoCombate) => EstadoCombate) => boolean;
function Linha({ c, atual, aplicar, bonus }: { c: EstadoCombate["combatentes"][number]; atual: boolean; aplicar: Aplicar; bonus: number }) {
  const [valor, setValor] = useState("");
  const acao = (sinal: 1 | -1) => { const n = numero(valor); if (n && n > 0) { aplicar(e => alterarPv(e, c.id, sinal * n)); setValor(""); } };
  return <li className={`ini-item lado-${c.lado}${atual ? " atual" : ""}`} aria-current={atual ? "true" : undefined}>
    <div className="ini-nome"><strong>{c.nome}</strong> <small>{rotuloLado[c.lado]}{c.ref ? (c.ref.tipo === "monstro" ? " · Bestiário" : " · personagem") : ""}{atual ? " · turno atual" : ""}</small></div>
    <label className="ini-valor">Iniciativa<input aria-label={`Iniciativa de ${c.nome}`} inputMode="decimal" defaultValue={c.iniciativa} key={c.iniciativa}
      onBlur={e => { const n = numero(e.target.value); if (n !== undefined && n !== c.iniciativa) aplicar(x => definirIniciativa(x, c.id, n)); }}/></label>
    <button className="btn-secondary" onClick={() => aplicar(e => rolarIniciativa(e, c.id, bonus))} aria-label={`Rolar iniciativa de ${c.nome}`} title={bonus ? `1d20 ${bonus > 0 ? "+" : ""}${bonus}` : "1d20"}><Dices size={15} aria-hidden="true"/></button>
    {c.pvMax ? <div className="ini-pv"><span aria-label={`PV de ${c.nome}`}>PV {c.pv}/{c.pvMax}{c.pv === 0 ? " · caído" : ""}</span>
      <input aria-label={`Quantidade de dano ou cura de ${c.nome}`} inputMode="numeric" value={valor} onChange={e => setValor(e.target.value)} placeholder="valor"/>
      <button className="btn-secondary" onClick={() => acao(-1)} aria-label={`Causar dano a ${c.nome}`}>Dano</button>
      <button className="btn-secondary" onClick={() => acao(1)} aria-label={`Curar ${c.nome}`}>Cura</button></div> : <span className="muted ini-pv">Sem PV</span>}
    <div className="ini-condicoes">
      {(c.condicoes ?? []).map(k => <button key={k} className="ini-chip" onClick={() => aplicar(e => alternarCondicao(e, c.id, k))} aria-label={`Remover condição ${k} de ${c.nome}`}>{k} ×</button>)}
      <select aria-label={`Adicionar condição a ${c.nome}`} value="" onChange={e => { if (e.target.value) aplicar(x => alternarCondicao(x, c.id, e.target.value)); }}>
        <option value="">+ condição</option>{CONDICOES_5E.filter(k => !(c.condicoes ?? []).includes(k)).map(k => <option key={k} value={k}>{k}</option>)}</select>
    </div>
    <button className="btn-secondary" onClick={() => aplicar(e => remover(e, c.id))} aria-label={`Remover ${c.nome}`}><Trash2 size={15} aria-hidden="true"/></button>
  </li>;
}

// ---------------------------------------------------------------- Encontros
function useLojaEncontros(userId: string | null, campaignId: string | null, podeGerenciar: boolean, nuvem: ApisNuvem | null) {
  const ativo = !!(userId && campaignId && podeGerenciar);
  const local = useArmazenado<Encontro[]>(ativo && !nuvem ? chaveEncontros(userId!, campaignId!) : null, lerEncontros);
  const remoto = useLinhaRemota<Encontro[]>({ api: ativo && nuvem ? nuvem.encontros : null, campaignId: ativo && nuvem ? campaignId : null, vazio: () => [], chaveBackup: ativo && nuvem ? `compendio5e:encontros-nuvem:${userId}:${campaignId}` : null });
  if (nuvem) {
    const estado: Estado<Encontro[]> = remoto.carga.status === "pronto" ? { status: "pronto", valor: remoto.carga.valor } : remoto.carga.status === "erro" ? { status: "erro", mensagem: remoto.carga.mensagem } : { status: "carregando" };
    return { nuvem: true as const, estado, aplicar: (fn: (l: Encontro[]) => Encontro[]) => remoto.alterar(fn), sync: remoto.sync, mensagem: remoto.mensagem, sujo: remoto.sujo, salvar: async () => { remoto.tentarAgora(); return remoto.sync === "salvo"; }, tentar: remoto.tentarAgora, recarregar: remoto.recarregar, descartar: () => void remoto.recarregar() };
  }
  return { nuvem: false as const, estado: local.estado, aplicar: (fn: (l: Encontro[]) => Encontro[]) => local.alterar(fn), sync: "salvo" as SyncRemoto, mensagem: null, sujo: local.estado.status === "pronto" && !!local.estado.falhaGravacao,
    salvar: async () => local.salvarPendente(), tentar: local.tentar, recarregar: async () => local.tentar(), descartar: local.descartar };
}

export function EncontrosPanel() {
  const { userId, campaignId, campanha, podeGerenciar } = useEscopo();
  const nuvem = useNuvem();
  const loja = useLojaEncontros(userId, campaignId, podeGerenciar, nuvem);
  const { estado, aplicar } = loja;
  useUnsavedGuard("secao:encontros", loja.sujo, loja.salvar);
  const [nome, setNome] = useState(""), [aviso, setAviso] = useState<string | null>(null);
  if (!userId || !campaignId) return <SemCampanha titulo="Encontros"/>;
  if (!podeGerenciar) return <AcessoRestrito titulo="Encontros"/>;
  const lista = estado.status === "pronto" ? estado.valor : null;
  const enviar = async (enc: Encontro) => {
    if (nuvem) {   // lê o combate da nuvem, acrescenta e grava com a versão lida; conflito/queda nunca sobrescrevem
      const r = await nuvem.combate.carregar(campaignId);
      if (!r.ok) { setAviso(`Não foi possível enviar: ${r.mensagem}`); return; }
      const s = await nuvem.combate.salvar(campaignId, enviarParaCombate(r.data.valor, enc), r.data.versao);
      if (!s.ok) { setAviso(`Não foi possível enviar: ${s.mensagem}`); return; }
      window.dispatchEvent(new CustomEvent(EVENTO, { detail: `nuvem:combate:${campaignId}` }));
      setAviso(`"${enc.nome}" foi enviado para a Iniciativa. O encontro continua salvo aqui. Informe a iniciativa de cada um lá.`); return;
    }
    const k = chaveCombate(userId, campaignId);
    try {
      const novo = enviarParaCombate(lerCombate(localStorage.getItem(k)), enc);
      localStorage.setItem(k, JSON.stringify(novo)); window.dispatchEvent(new CustomEvent(EVENTO, { detail: k }));
      setAviso(`"${enc.nome}" foi enviado para a Iniciativa. Informe a iniciativa de cada um lá.`);
    } catch { setAviso("Não foi possível enviar: o combate guardado neste aparelho está ilegível. Abra a Iniciativa para tentar de novo ou descartá-lo."); }
  };
  return <div className="content iniciativa">
    <div className="eyebrow">{(campanha ?? "").toLocaleUpperCase("pt-BR")} · PREPARAÇÃO</div><h1>Encontros</h1>
    {estado.status === "carregando" && <div className="notice" role="status" aria-live="polite">Carregando os encontros…</div>}
    {estado.status === "erro" && (nuvem ? <Aviso erro t={estado.mensagem ?? "Não foi possível carregar os encontros no servidor."} onRetry={loja.tentar}/> : <ErroArmazenamento onTentar={loja.tentar} onDescartar={loja.descartar} o="os encontros"/>)}
    {aviso && <div className="notice" role="status">{aviso}</div>}
    {estado.status === "pronto" && !nuvem && estado.falhaGravacao && <Aviso erro t="Não foi possível salvar os encontros. As alterações continuam nesta tela; tente salvar novamente antes de sair." onRetry={loja.tentar}/>}
    {lista && <>
      <ModoArmazenamento nuvem={loja.nuvem} sync={loja.sync} mensagem={loja.mensagem} o="os encontros" onTentar={loja.tentar} onRecarregar={() => void loja.recarregar()}/>
      {loja.nuvem && <BackupLocal chave={chaveEncontros(userId, campaignId)} rotulo="encontros"/>}
      <form className="ini-form" aria-label="Novo encontro" onSubmit={e => { e.preventDefault(); if (nome.trim()) { const n = nome.trim(); aplicar(l => [...l, { id: novoId(), nome: n, participantes: [] }]); setNome(""); } }}>
        <label>Nome do encontro<input value={nome} onChange={e => setNome(e.target.value)} required maxLength={80}/></label>
        <button type="submit" className="btn-secondary"><Plus size={15} aria-hidden="true"/> Criar encontro</button>
      </form>
      {lista.length === 0
        ? <div className="placeholder vazio" role="status"><Swords size={30} aria-hidden="true"/><strong>Nenhum encontro preparado</strong><span>Crie um encontro, liste quem participa (do Bestiário ou digitando nome, quantidade e PV) e envie para a Iniciativa na hora do combate.</span></div>
        : lista.map(enc => <Cartao key={enc.id} enc={enc} salvar={n => aplicar(l => l.map(x => (x.id === enc.id ? n : x)))}
          duplicar={() => aplicar(l => { const i = l.findIndex(x => x.id === enc.id); const copia = duplicarEncontro(enc); return i < 0 ? l : [...l.slice(0, i + 1), copia, ...l.slice(i + 1)]; })}
          excluir={() => { if (window.confirm(`Excluir o encontro "${enc.nome}"?`)) aplicar(l => l.filter(x => x.id !== enc.id)); }} enviar={() => void enviar(enc)}/>)}
    </>}
  </div>;
}
function Cartao({ enc, salvar, excluir, enviar, duplicar }: { enc: Encontro; salvar: (e: Encontro) => void; excluir: () => void; enviar: () => void; duplicar: () => void }) {
  const [nome, setNome] = useState(""), [qtd, setQtd] = useState("1"), [pv, setPv] = useState(""), [renomeando, setRenomeando] = useState(false), [novoNome, setNovoNome] = useState(enc.nome);
  const adicionarMonstro = (m: Monstro) => salvar(adicionarParticipante(enc, { nome: m.nome, quantidade: 1, pv: m.pv, ref: { tipo: "monstro", id: m.id } as RefCombate }));
  return <section className="ini-cartao" aria-label={`Encontro ${enc.nome}`}>
    {renomeando
      ? <form className="ini-form" aria-label={`Renomear ${enc.nome}`} onSubmit={e => { e.preventDefault(); salvar(renomearEncontro(enc, novoNome)); setRenomeando(false); }}>
        <label>Novo nome<input value={novoNome} onChange={e => setNovoNome(e.target.value)} required maxLength={80}/></label>
        <button type="submit" className="btn-secondary">Salvar nome</button><button type="button" className="btn-secondary" onClick={() => setRenomeando(false)}>Cancelar</button></form>
      : <h2>{enc.nome} <button className="btn-link" onClick={() => { setNovoNome(enc.nome); setRenomeando(true); }} aria-label={`Renomear encontro ${enc.nome}`}><Pencil size={13} aria-hidden="true"/></button></h2>}
    {enc.participantes.length === 0 ? <p className="muted">Sem participantes. Adicione abaixo.</p>
      : <ul>{enc.participantes.map(p => <li key={p.id}>{p.quantidade}× {p.nome}{p.pv ? ` · PV ${p.pv}` : ""}{p.ref?.tipo === "monstro" ? " · Bestiário" : ""}
        <button className="btn-link" onClick={() => salvar({ ...enc, participantes: enc.participantes.filter(x => x.id !== p.id) })} aria-label={`Remover ${p.nome} de ${enc.nome}`}>remover</button>
        <label className="ini-qtd">Qtd.<input aria-label={`Quantidade de ${p.nome} em ${enc.nome}`} inputMode="numeric" defaultValue={p.quantidade} key={p.quantidade}
          onBlur={e => { const n = numero(e.target.value); if (n !== undefined && Number.isInteger(n) && n >= 1 && n <= 50 && n !== p.quantidade) salvar({ ...enc, participantes: enc.participantes.map(x => x.id === p.id ? { ...x, quantidade: n } : x) }); }}/></label></li>)}</ul>}
    <SeletorMonstro rotulo="Adicionar do Bestiário" onEscolher={adicionarMonstro}/>
    <form className="ini-form" aria-label={`Adicionar participante a ${enc.nome}`} onSubmit={e => { e.preventDefault(); salvar(adicionarParticipante(enc, { nome, quantidade: numero(qtd) ?? 1, pv: numero(pv) })); setNome(""); setQtd("1"); setPv(""); }}>
      <label>Nome<input value={nome} onChange={e => setNome(e.target.value)} required maxLength={60}/></label>
      <label>Quantidade<input inputMode="numeric" value={qtd} onChange={e => setQtd(e.target.value)}/></label>
      <label>PV de cada (opcional)<input inputMode="numeric" value={pv} onChange={e => setPv(e.target.value)}/></label>
      <button type="submit" className="btn-secondary"><Plus size={15} aria-hidden="true"/> Adicionar</button>
    </form>
    <div className="ini-barra">
      <button className="btn-secondary" onClick={enviar} disabled={!enc.participantes.length}><Swords size={15} aria-hidden="true"/> Enviar para a Iniciativa</button>
      <button className="btn-secondary" onClick={duplicar} aria-label={`Duplicar encontro ${enc.nome}`}><Copy size={15} aria-hidden="true"/> Duplicar</button>
      <button className="btn-secondary" onClick={excluir}><Trash2 size={15} aria-hidden="true"/> Excluir encontro</button>
    </div>
  </section>;
}

import { Download } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAventureiros } from "./AventureirosContext";
import { useAuth } from "./AuthContext";
import { useCampaigns } from "./CampaignsContext";
import { Aviso } from "./Diario";
import type { Lado } from "./combate";
import { NuvemContext, type ApisNuvem } from "./nuvem";
import { lerPvFicha } from "./pvFicha";
import { useFichas } from "./RegistrosContext";
import type { SyncRemoto } from "./useLinhaRemota";
import type { Monstro } from "./catalogue/sistemas/dnd5e-2014/esquemas";
export const EVENTO = "compendio5e:armazenamento";
export type VisualizacaoCombate = "cartoes" | "lista";
export const chaveVisualizacaoCombate = (userId: string) => `compendio5e:visualizacao-combate:${userId}`;
export const lerVisualizacaoCombate = (valor: string | null): VisualizacaoCombate => valor === "lista" ? "lista" : "cartoes";
export type Estado<T> = { status: "carregando" } | { status: "erro"; mensagem?: string } | { status: "pronto"; valor: T; falhaGravacao?: boolean };
type EstadoEscopado<T> = { chave: string | null; estado: Estado<T> };

// ---------------------------------------------------------------- nuvem (opcional, explícita): ver nuvem.tsx
export { NuvemContext, type ApisNuvem };

/** Lê o valor do armazenamento local (com estado de carregamento e de erro), grava a cada mudança e se mantém em dia com outras telas do mesmo aparelho. */
export function useArmazenado<T>(chave: string | null, ler: (bruto: string | null) => T) {
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

export const rotuloLado: Record<Lado, string> = { aliado: "Aliado", inimigo: "Inimigo", neutro: "Neutro" };
/** Condições do D&D 5e 2014 (a lista de cada sistema fica na interface; o domínio aceita texto livre curto). */
export const CONDICOES_5E = ["Cego", "Enfeitiçado", "Surdo", "Amedrontado", "Agarrado", "Incapacitado", "Invisível", "Paralisado", "Petrificado", "Envenenado", "Caído", "Contido", "Atordoado", "Inconsciente", "Exaustão"];
export const numero = (s: string) => (s.trim() === "" ? undefined : Number(s.replace(",", ".")));
const sem = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLocaleLowerCase("pt-BR");

export function useEscopo() {
  const { user } = useAuth(), { active } = useCampaigns();
  return { userId: user?.id ?? null, campaignId: active?.campaign.id ?? null, campanha: active?.campaign.name ?? null, podeGerenciar: active?.role === "mestre" };
}
export function SemCampanha({ titulo }: { titulo: string }) {
  return <div className="content"><div className="eyebrow">COMPÊNDIO 5e</div><h1>{titulo}</h1>
    <div className="notice" role="status">Escolha ou entre em uma campanha para usar esta tela: os dados ficam separados por campanha.</div></div>;
}
export function AcessoRestrito({ titulo }: { titulo: string }) {
  return <div className="content"><div className="eyebrow">COMPÊNDIO 5e</div><h1>{titulo}</h1>
    <div className="notice" role="status">Somente o mestre da campanha pode acessar este módulo.</div></div>;
}
export function ErroArmazenamento({ onTentar, onDescartar, o }: { onTentar: () => void; onDescartar: () => void; o: string }) {
  return <>
    <Aviso erro t={`Não foi possível ler ${o} guardado neste aparelho (dado corrompido ou armazenamento bloqueado).`} onRetry={onTentar}/>
    <p className="muted">Se continuar, você pode <button className="btn-link" onClick={onDescartar}>descartar o que está guardado e começar de novo</button>. Isso só apaga {o} desta campanha neste aparelho.</p>
  </>;
}

/** Modo de armazenamento sempre visível (local ou nuvem) e estado da sincronização. */
/** Baixa uma cópia (JSON) do que está na nuvem: é como os dados gravados só no servidor saem de lá (volta ao modo local, backup, mudança de projeto). */
function baixarJson(dados: unknown, nome: string) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(dados, null, 2)], { type: "application/json" })); const a = document.createElement("a"); a.href = url; a.download = `${nome}.json`; a.click(); URL.revokeObjectURL(url);
}
export function ModoArmazenamento({ nuvem, sync, mensagem, o, onTentar, onRecarregar, dados, arquivo }: { nuvem: boolean; sync: SyncRemoto; mensagem: string | null; o: string; onTentar: () => void; onRecarregar: () => void; dados?: unknown; arquivo?: string }) {
  const baixar = nuvem && dados !== undefined ? <button className="btn-link" onClick={() => baixarJson(dados, arquivo ?? "copia-nuvem")}><Download size={13} aria-hidden="true"/> Baixar cópia (JSON)</button> : null;
  if (!nuvem) return <p className="muted ini-modo" role="status" data-modo="local">Modo local: {o} ficam só neste aparelho e não aparecem em outros dispositivos.</p>;
  if (sync === "conflito") return <div className="notice err" role="alert" data-modo="nuvem" data-sync="conflito">
    {mensagem ?? "Outra sessão alterou os dados."} Suas últimas alterações não foram gravadas (uma cópia ficou neste aparelho). <button className="btn-link" onClick={onRecarregar}>Recarregar do servidor</button> (descarta o que não foi gravado).</div>;
  if (sync === "permissao") return <Aviso erro t={mensagem ?? "Sem permissão para gravar."}/>;
  if (sync === "falha") return <div className="notice err" role="alert" data-modo="nuvem" data-sync="falha">{mensagem ?? "Sem conexão com o servidor."} As alterações continuam nesta tela e serão enviadas assim que a conexão voltar. <button className="btn-link" onClick={onTentar}>Tentar agora</button></div>;
  return <p className="muted ini-modo" role="status" data-modo="nuvem" data-sync={sync}>{sync === "salvando" ? "Salvando na nuvem…" : `Salvo na nuvem (${o}): disponível em qualquer aparelho em que você entrar como mestre desta campanha.`} {baixar}</p>;
}
export function BackupLocal({ chave, rotulo }: { chave: string; rotulo: string }) {
  const [bruto, setBruto] = useState<string | null>(null);
  useEffect(() => { try { setBruto(localStorage.getItem(chave)); } catch { setBruto(null); } }, [chave]);
  if (!bruto) return null;
  const baixar = () => { const url = URL.createObjectURL(new Blob([bruto], { type: "application/json" })); const a = document.createElement("a"); a.href = url; a.download = `${rotulo}-backup-local.json`; a.click(); URL.revokeObjectURL(url); };
  return <p className="muted" role="note">Há {rotulo} guardado neste aparelho (de antes da nuvem). Ele <strong>não foi importado nem apagado</strong>. <button className="btn-link" onClick={baixar}><Download size={13} aria-hidden="true"/> Baixar backup</button></p>;
}

// ---------------------------------------------------------------- seletores de conteúdo canônico (sem bancos paralelos)
export const modAtributo = (v: number) => Math.floor((v - 10) / 2);
export function SeletorMonstro({ rotulo, onEscolher }: { rotulo: string; onEscolher: (m: Monstro) => void }) {
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
export function SeletorPersonagem({ campaignId, onEscolher }: { campaignId: string; onEscolher: (p: { id: string; nome: string }, pvMax?: number, pvAtual?: number) => void }) {
  const fonte = useAventureiros(), fichas = useFichas();
  const [aberto, setAberto] = useState(false), [pvTexto, setPvTexto] = useState(""), [lendo, setLendo] = useState<string | null>(null), [aviso, setAviso] = useState<string | null>(null);
  const [dados, setDados] = useState<{ status: "carregando" } | { status: "erro" } | { status: "pronto"; lista: { id: string; nome: string; classe: string }[] }>({ status: "carregando" });
  const carregar = useCallback(() => { if (!fonte) return; setDados({ status: "carregando" }); fonte.listar(campaignId).then(r => setDados(r.ok ? { status: "pronto", lista: r.data } : { status: "erro" }), () => setDados({ status: "erro" })); }, [fonte, campaignId]);
  useEffect(() => { if (aberto && dados.status === "carregando") carregar(); }, [aberto]);   // eslint-disable-line react-hooks/exhaustive-deps
  if (!fonte) return null;
  /** Lê PV atuais e máximos da ficha (automático). Sem ficha legível, usa o PV máximo digitado, se houver, e avisa. */
  const escolher = async (p: { id: string; nome: string }) => {
    setAviso(null);
    const manual = numero(pvTexto), pvManual = manual && manual > 0 && Number.isInteger(manual) ? manual : undefined;
    if (!fichas) { onEscolher(p, pvManual); return; }
    setLendo(p.id);
    const r = await lerPvFicha(fichas, p.id);
    setLendo(null);
    if (r.ok) { onEscolher(p, r.dados.max, r.dados.atual); return; }
    onEscolher(p, pvManual);
    setAviso(`${p.nome} foi adicionado, mas os PV não vieram da ficha: ${r.erro}${pvManual ? " Foi usado o PV máximo digitado." : " Informe o PV máximo abaixo e adicione de novo, ou ajuste no combate."}`);
  };
  return <details className="ini-seletor" open={aberto} onToggle={e => setAberto((e.target as HTMLDetailsElement).open)}>
    <summary>Adicionar personagem da campanha</summary>
    {dados.status === "carregando" && aberto && <p className="muted" role="status">Carregando personagens…</p>}
    {dados.status === "erro" && <Aviso erro t="Não foi possível carregar os personagens da campanha." onRetry={carregar}/>}
    {dados.status === "pronto" && (dados.lista.length === 0 ? <p className="muted">Esta campanha ainda não tem personagens vinculados.</p>
      : <><p className="muted">Os PV atuais e máximos vêm da ficha do personagem.</p>
        <label>PV máximo manual (usado só se a ficha não puder ser lida)<input inputMode="numeric" value={pvTexto} onChange={e => setPvTexto(e.target.value)}/></label>
        {aviso && <Aviso erro t={aviso}/>}
        <ul className="ini-achados">{dados.lista.map(p => <li key={p.id}><button type="button" className="btn-secondary" disabled={lendo !== null} onClick={() => void escolher(p)} aria-label={`Adicionar ${p.nome} (personagem)`}><strong>{p.nome}</strong> <small>{p.classe}</small>{lendo === p.id && <small role="status"> lendo a ficha…</small>}</button></li>)}</ul></>)}
  </details>;
}


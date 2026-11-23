// Iniciativa e Encontros: telas funcionais (antes só havia o aviso "em desenvolvimento"). Sem dados fictícios: tudo é digitado por quem usa e fica guardado só neste aparelho,
// por usuário e campanha (`compendio5e:iniciativa:<usuário>:<campanha>`), então trocar de aba ou recarregar não perde nada. A lógica é neutra quanto ao sistema de RPG.
import { ChevronRight, Plus, RotateCcw, Swords, Trash2 } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "./AuthContext";
import { useCampaigns } from "./CampaignsContext";
import { Aviso } from "./Diario";
import { useUnsavedGuard } from "./unsaved";
import {
  adicionar, adicionarParticipante, alterarPv, chaveCombate, chaveEncontros, combateVazio, definirIniciativa, enviarParaCombate, lerCombate, lerEncontros, novoId, ordenar, proximoTurno,
  reiniciarRodadas, remover, type Encontro, type EstadoCombate, type Lado,
} from "./combate";

const EVENTO = "compendio5e:armazenamento";
type Estado<T> = { status: "carregando" } | { status: "erro" } | { status: "pronto"; valor: T; falhaGravacao?: boolean };
type EstadoEscopado<T> = { chave: string | null; estado: Estado<T> };

/** Lê o valor do armazenamento local (com estado de carregamento e de erro), grava a cada mudança e se mantém em dia com outras telas do mesmo aparelho. */
function useArmazenado<T>(chave: string | null, ler: (bruto: string | null) => T) {
  const [snapshot, setSnapshot] = useState<EstadoEscopado<T>>({ chave: null, estado: { status: "carregando" } });
  const estado = snapshot.chave === chave ? snapshot.estado : { status: "carregando" as const };
  const setEstado = useCallback((proximo: Estado<T>) => setSnapshot({ chave, estado: proximo }), [chave]);
  const [tentativa, setTentativa] = useState(0);
  const lerRef = useRef(ler); lerRef.current = ler;
  const pendente = useRef<{ chave: string; valor: T } | null>(null);
  const carregar = useCallback(() => {
    if (!chave || pendente.current?.chave === chave) return;
    try { setEstado({ status: "pronto", valor: lerRef.current(localStorage.getItem(chave)) }); } catch { setEstado({ status: "erro" }); }
  }, [chave, setEstado]);
  useEffect(() => { setEstado({ status: "carregando" }); const t = setTimeout(carregar, 0); return () => clearTimeout(t); }, [carregar, tentativa]);
  useEffect(() => {
    const aoMudar = (e: Event) => { if ((e as CustomEvent<string>).detail === chave) carregar(); };
    window.addEventListener(EVENTO, aoMudar); return () => window.removeEventListener(EVENTO, aoMudar);
  }, [chave, carregar]);
  const gravar = useCallback((valor: T) => {
    if (!chave) return false;
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
  const salvarPendente = useCallback(() => pendente.current?.chave === chave ? gravar(pendente.current.valor) : true, [chave, gravar]);
  const descartar = useCallback(() => { if (chave) { try { localStorage.removeItem(chave); } catch { /* sem armazenamento */ } } setTentativa(n => n + 1); }, [chave]);
  return { estado, gravar, salvarPendente, tentar: () => {
    if (pendente.current?.chave === chave) gravar(pendente.current.valor);
    else setTentativa(n => n + 1);
  }, descartar };
}

const rotuloLado: Record<Lado, string> = { aliado: "Aliado", inimigo: "Inimigo", neutro: "Neutro" };
const numero = (s: string) => (s.trim() === "" ? undefined : Number(s.replace(",", ".")));

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

// ---------------------------------------------------------------- Iniciativa
export function IniciativaPanel() {
  const { userId, campaignId, campanha, podeGerenciar } = useEscopo();
  const { estado, gravar, salvarPendente, tentar, descartar } = useArmazenado<EstadoCombate>(podeGerenciar && userId && campaignId ? chaveCombate(userId, campaignId) : null, lerCombate);
  useUnsavedGuard("secao:iniciativa", estado.status === "pronto" && !!estado.falhaGravacao, salvarPendente);
  const [nome, setNome] = useState(""), [ini, setIni] = useState(""), [pv, setPv] = useState(""), [lado, setLado] = useState<Lado>("inimigo");
  if (!userId || !campaignId) return <SemCampanha titulo="Iniciativa"/>;
  if (!podeGerenciar) return <AcessoRestrito titulo="Iniciativa"/>;
  const combate = estado.status === "pronto" ? estado.valor : null;
  const muda = (e: EstadoCombate) => gravar(e);
  const submeter = (ev: React.FormEvent) => {
    ev.preventDefault(); if (!combate || !nome.trim()) return;
    const max = numero(pv);
    muda(adicionar(combate, { nome, iniciativa: numero(ini) ?? 0, lado, ...(max && max > 0 ? { pv: max, pvMax: max } : {}) }));
    setNome(""); setIni(""); setPv("");
  };
  const ordem = combate ? ordenar(combate.combatentes) : [];
  return <div className="content iniciativa">
    <div className="eyebrow">{(campanha ?? "").toLocaleUpperCase("pt-BR")} · COMBATE</div><h1>Iniciativa</h1>
    {estado.status === "carregando" && <div className="notice" role="status" aria-live="polite">Carregando o combate…</div>}
    {estado.status === "erro" && <ErroArmazenamento onTentar={tentar} onDescartar={descartar} o="o combate"/>}
    {estado.status === "pronto" && estado.falhaGravacao && <Aviso erro t="Não foi possível salvar o combate. As alterações continuam nesta tela; tente salvar novamente antes de sair." onRetry={tentar}/>}
    {combate && <>
      <form className="ini-form" onSubmit={submeter} aria-label="Adicionar combatente">
        <label>Nome<input value={nome} onChange={e => setNome(e.target.value)} required maxLength={60}/></label>
        <label>Iniciativa<input inputMode="decimal" value={ini} onChange={e => setIni(e.target.value)} placeholder="0"/></label>
        <label>PV (opcional)<input inputMode="numeric" value={pv} onChange={e => setPv(e.target.value)}/></label>
        <label>Lado<select value={lado} onChange={e => setLado(e.target.value as Lado)}>{(Object.keys(rotuloLado) as Lado[]).map(l => <option key={l} value={l}>{rotuloLado[l]}</option>)}</select></label>
        <button type="submit" className="btn-secondary"><Plus size={15} aria-hidden="true"/> Adicionar</button>
      </form>
      <div className="ini-barra">
        <strong role="status">Rodada {combate.rodada}</strong>
        <button className="btn-secondary" onClick={() => muda(proximoTurno(combate))} disabled={!ordem.length}><ChevronRight size={15} aria-hidden="true"/> Próximo turno</button>
        <button className="btn-secondary" onClick={() => muda(reiniciarRodadas(combate))} disabled={!ordem.length}><RotateCcw size={15} aria-hidden="true"/> Reiniciar rodadas</button>
        <button className="btn-secondary" onClick={() => { if (window.confirm("Remover todos os combatentes desta campanha?")) muda(combateVazio()); }} disabled={!ordem.length}><Trash2 size={15} aria-hidden="true"/> Limpar combate</button>
      </div>
      {ordem.length === 0
        ? <div className="placeholder vazio" role="status"><Swords size={30} aria-hidden="true"/><strong>Nenhum combatente ainda</strong><span>Adicione quem vai lutar acima, com a iniciativa de cada um. Encontros preparados na aba Encontros podem ser enviados para cá.</span></div>
        : <ol className="ini-lista" aria-label="Ordem de iniciativa">{ordem.map(c => <Linha key={c.id} c={c} atual={c.id === combate.turno} muda={muda} combate={combate}/>)}</ol>}
    </>}
  </div>;
}
function Linha({ c, atual, combate, muda }: { c: EstadoCombate["combatentes"][number]; atual: boolean; combate: EstadoCombate; muda: (e: EstadoCombate) => void }) {
  const [valor, setValor] = useState("");
  const aplicar = (sinal: 1 | -1) => { const n = numero(valor); if (n && n > 0) { muda(alterarPv(combate, c.id, sinal * n)); setValor(""); } };
  return <li className={`ini-item lado-${c.lado}${atual ? " atual" : ""}`} aria-current={atual ? "true" : undefined}>
    <div className="ini-nome"><strong>{c.nome}</strong> <small>{rotuloLado[c.lado]}{atual ? " · turno atual" : ""}</small></div>
    <label className="ini-valor">Iniciativa<input aria-label={`Iniciativa de ${c.nome}`} inputMode="decimal" defaultValue={c.iniciativa} key={c.iniciativa}
      onBlur={e => { const n = numero(e.target.value); if (n !== undefined && n !== c.iniciativa) muda(definirIniciativa(combate, c.id, n)); }}/></label>
    {c.pvMax ? <div className="ini-pv"><span aria-label={`PV de ${c.nome}`}>PV {c.pv}/{c.pvMax}{c.pv === 0 ? " · caído" : ""}</span>
      <input aria-label={`Quantidade de dano ou cura de ${c.nome}`} inputMode="numeric" value={valor} onChange={e => setValor(e.target.value)} placeholder="valor"/>
      <button className="btn-secondary" onClick={() => aplicar(-1)} aria-label={`Causar dano a ${c.nome}`}>Dano</button>
      <button className="btn-secondary" onClick={() => aplicar(1)} aria-label={`Curar ${c.nome}`}>Cura</button></div> : <span className="muted ini-pv">Sem PV</span>}
    <button className="btn-secondary" onClick={() => muda(remover(combate, c.id))} aria-label={`Remover ${c.nome}`}><Trash2 size={15} aria-hidden="true"/></button>
  </li>;
}

// ---------------------------------------------------------------- Encontros
export function EncontrosPanel() {
  const { userId, campaignId, campanha, podeGerenciar } = useEscopo();
  const { estado, gravar, salvarPendente, tentar, descartar } = useArmazenado<Encontro[]>(podeGerenciar && userId && campaignId ? chaveEncontros(userId, campaignId) : null, lerEncontros);
  useUnsavedGuard("secao:encontros", estado.status === "pronto" && !!estado.falhaGravacao, salvarPendente);
  const [nome, setNome] = useState(""), [aviso, setAviso] = useState<string | null>(null);
  if (!userId || !campaignId) return <SemCampanha titulo="Encontros"/>;
  if (!podeGerenciar) return <AcessoRestrito titulo="Encontros"/>;
  const lista = estado.status === "pronto" ? estado.valor : null;
  const enviar = (enc: Encontro) => {
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
    {estado.status === "erro" && <ErroArmazenamento onTentar={tentar} onDescartar={descartar} o="os encontros"/>}
    {aviso && <div className="notice" role="status">{aviso}</div>}
    {estado.status === "pronto" && estado.falhaGravacao && <Aviso erro t="Não foi possível salvar os encontros. As alterações continuam nesta tela; tente salvar novamente antes de sair." onRetry={tentar}/>}
    {lista && <>
      <form className="ini-form" aria-label="Novo encontro" onSubmit={e => { e.preventDefault(); if (nome.trim()) { gravar([...lista, { id: novoId(), nome: nome.trim(), participantes: [] }]); setNome(""); } }}>
        <label>Nome do encontro<input value={nome} onChange={e => setNome(e.target.value)} required maxLength={80}/></label>
        <button type="submit" className="btn-secondary"><Plus size={15} aria-hidden="true"/> Criar encontro</button>
      </form>
      {lista.length === 0
        ? <div className="placeholder vazio" role="status"><Swords size={30} aria-hidden="true"/><strong>Nenhum encontro preparado</strong><span>Crie um encontro, liste quem participa (nome, quantidade e PV) e envie para a Iniciativa na hora do combate. Os encontros ficam só neste aparelho.</span></div>
        : lista.map(enc => <Cartao key={enc.id} enc={enc} salvar={n => gravar(lista.map(x => (x.id === enc.id ? n : x)))} excluir={() => { if (window.confirm(`Excluir o encontro "${enc.nome}"?`)) gravar(lista.filter(x => x.id !== enc.id)); }} enviar={() => enviar(enc)}/>)}
    </>}
  </div>;
}
function Cartao({ enc, salvar, excluir, enviar }: { enc: Encontro; salvar: (e: Encontro) => void; excluir: () => void; enviar: () => void }) {
  const [nome, setNome] = useState(""), [qtd, setQtd] = useState("1"), [pv, setPv] = useState("");
  return <section className="ini-cartao" aria-label={`Encontro ${enc.nome}`}>
    <h2>{enc.nome}</h2>
    {enc.participantes.length === 0 ? <p className="muted">Sem participantes. Adicione abaixo.</p>
      : <ul>{enc.participantes.map(p => <li key={p.id}>{p.quantidade}× {p.nome}{p.pv ? ` · PV ${p.pv}` : ""}
        <button className="btn-link" onClick={() => salvar({ ...enc, participantes: enc.participantes.filter(x => x.id !== p.id) })} aria-label={`Remover ${p.nome} de ${enc.nome}`}>remover</button></li>)}</ul>}
    <form className="ini-form" aria-label={`Adicionar participante a ${enc.nome}`} onSubmit={e => { e.preventDefault(); salvar(adicionarParticipante(enc, { nome, quantidade: numero(qtd) ?? 1, pv: numero(pv) })); setNome(""); setQtd("1"); setPv(""); }}>
      <label>Nome<input value={nome} onChange={e => setNome(e.target.value)} required maxLength={60}/></label>
      <label>Quantidade<input inputMode="numeric" value={qtd} onChange={e => setQtd(e.target.value)}/></label>
      <label>PV de cada (opcional)<input inputMode="numeric" value={pv} onChange={e => setPv(e.target.value)}/></label>
      <button type="submit" className="btn-secondary"><Plus size={15} aria-hidden="true"/> Adicionar</button>
    </form>
    <div className="ini-barra">
      <button className="btn-secondary" onClick={enviar} disabled={!enc.participantes.length}><Swords size={15} aria-hidden="true"/> Enviar para a Iniciativa</button>
      <button className="btn-secondary" onClick={excluir}><Trash2 size={15} aria-hidden="true"/> Excluir encontro</button>
    </div>
  </section>;
}

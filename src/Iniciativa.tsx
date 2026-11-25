import { BuscaCombatentes } from "./BuscaCombatentes";
import { useFecharMenu } from "./useFecharMenu";
import { ChevronLeft, ChevronRight, Ellipsis, Dices, LayoutGrid, List, Plus, RotateCcw, Swords, Trash2, Columns2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Aviso } from "./Diario";
import { useUnsavedGuard } from "./unsaved";
import { adicionar, nomeCombatenteDisponivel, alterarPv, alternarCondicao, chaveCombate, combateVazio, definirIniciativa, enviarParaCombate, lerCombate, novoId, ordenar, proximoTurno, reiniciarRodadas, remover, turnoAnterior, type EstadoCombate, type Lado } from "./combate";
import { useNuvem, type ApisNuvem } from "./nuvem";
import { gravarPvFicha } from "./pvFicha";
import { useFichas } from "./RegistrosContext";
import { idsDePersonagens, statusDoCombatente } from "./statusCombate";
import { useLinhaRemota, type SyncRemoto } from "./useLinhaRemota";
import type { Monstro } from "./catalogue/sistemas/dnd5e-2014/esquemas";
import { rolarD20, textoRolagem, type Rolagem } from "./combate";
import { useLojaEncontros } from "./Encontros";
import { useRetratosPersonagens } from "./RetratoCombate";
import { FaixaTurnos } from "./FaixaTurnos";
import { ControleNumerico } from "./ControleNumerico";
import { CriaturaIdentidade } from "./CriaturaIdentidade";
import { marcarEnviado, sincronizarComCombate } from "./estadoEncontro";
import { EVENTO, type Estado, useArmazenado, rotuloLado, CONDICOES_5E, numero, useEscopo, SemCampanha, AcessoRestrito, ErroArmazenamento, ModoArmazenamento, BackupLocal, modAtributo, type VisualizacaoCombate, chaveVisualizacaoCombate, lerVisualizacaoCombate } from "./CombateCompartilhado";
export { NuvemContext, type ApisNuvem, type VisualizacaoCombate, chaveVisualizacaoCombate, lerVisualizacaoCombate } from "./CombateCompartilhado";
export { EncontrosPanel } from "./Encontros";
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
  const nuvem = useNuvem(), fichas = useFichas();
  const loja = useLojaCombate(userId, campaignId, podeGerenciar, nuvem);
  const { estado, aplicar } = loja;
  useUnsavedGuard("secao:iniciativa", loja.sujo, loja.salvar);
  // PV e condições dos PERSONAGENS vão para a ficha pelo fluxo autorizado (função do banco que só o mestre chama); nada mais do combate sai daqui.
  const statusApi = nuvem?.status, enviados = useRef(new Map<string, string>()), [avisoFicha, setAvisoFicha] = useState<string | null>(null);
  useEffect(() => {
    if (!statusApi || !loja.nuvem || estado.status !== "pronto") return;
    const e = estado.valor, ids = idsDePersonagens(e), alvo = new Map(ids.map(id => [id, statusDoCombatente(e, id)!]));
    for (const id of enviados.current.keys()) if (!alvo.has(id)) alvo.set(id, { hp: null, max: null, condicoes: [] });   // saiu do combate: a ficha deixa de mostrar
    let cancelado = false;
    void (async () => {
      for (const [id, st] of alvo) {
        const chave = JSON.stringify(st); if (enviados.current.get(id) === chave) continue;
        const r = await statusApi.definir(id, st.hp, st.max, st.condicoes); if (cancelado) return;
        if (r.ok) { if (ids.includes(id)) enviados.current.set(id, chave); else enviados.current.delete(id); setAvisoFicha(null); } else setAvisoFicha(r.mensagem);
      }
    })();
    return () => { cancelado = true; };
  }, [estado, statusApi, loja.nuvem]);
  const [nome, setNome] = useState(""), [ini, setIni] = useState(""), [pv, setPv] = useState(""), [lado, setLado] = useState<Lado>("inimigo");
  const [visualizacao, setVisualizacao] = useState<VisualizacaoCombate>("cartoes"), [erroFinalizar, setErroFinalizar] = useState<string | null>(null);
  const atual = useRef<{ combate: EstadoCombate | null; encontros: ReturnType<typeof useLojaEncontros>["estado"]; campaignId: string | null }>({ combate: null, encontros: { status: "carregando" }, campaignId: null });
  const emRemocao = useRef(new Set<string>()), [removendo, setRemovendo] = useState<ReadonlySet<string>>(new Set()), [avisoRemocao, setAvisoRemocao] = useState<string | null>(null);
  const [menuTurno, setMenuTurno] = useState(false), menuTurnoRef = useRef<HTMLDivElement>(null), gatilhoTurnoRef = useRef<HTMLButtonElement>(null);
  useFecharMenu(menuTurno, menuTurnoRef, gatilhoTurnoRef, () => setMenuTurno(false));
  const [separarLados, setSepararLados] = useState(true);
  const [mods, setMods] = useState<Record<string, number>>({});   // bônus de iniciativa por combatente (monstros: Destreza do catálogo)
  const [rolagens, setRolagens] = useState<Record<string, Rolagem>>({});   // última rolagem de cada um (só para mostrar; o resultado já está na iniciativa)
  const retratos = useRetratosPersonagens(campaignId);
  const lojaEnc = useLojaEncontros(userId, campaignId, podeGerenciar, nuvem), encontros = lojaEnc.estado;
  useEffect(() => {
    try { setVisualizacao(lerVisualizacaoCombate(localStorage.getItem(chaveVisualizacaoCombate(userId ?? "")))); setSepararLados(localStorage.getItem(`compendio5e:lados-combate:${userId ?? ""}`) !== "unificados"); }
    catch { setVisualizacao("cartoes"); setSepararLados(true); }
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
    const r = rolarD20(bonus);
    setMods(x => ({ ...x, [id]: bonus })); setRolagens(x => ({ ...x, [id]: r }));
    aplicar(e => definirIniciativa(adicionar(e, { id, nome: nomeCombatenteDisponivel(e, m.nome), iniciativa: 0, lado: "inimigo", pv: m.pv, pvMax: m.pv, ca: m.ca, ref: { tipo: "monstro", id: m.id } }), id, r.total));
  };
  const adicionarPersonagem = (p: { id: string; nome: string }, pvMax?: number, pvAtual?: number) => { if (pvMax === undefined || pvAtual === undefined) return; aplicar(e => e.combatentes.some(c => c.ref?.tipo === "personagem" && c.ref.id === p.id) ? e : adicionar(e, { nome: p.nome, iniciativa: 0, lado: "aliado", ...(pvMax ? { pv: pvAtual ?? pvMax, pvMax } : {}), ref: { tipo: "personagem", id: p.id } })); };
  const ordem = combate ? ordenar(combate.combatentes) : [];
  // lidos por quem termina depois de uma espera (gravação na ficha): sempre o estado MAIS RECENTE, nunca o da hora do clique
  atual.current = { combate, encontros, campaignId };
  const removerCombatente: Aplicar = fn => {
    const { combate, encontros } = atual.current;
    if (!combate) return false;
    const proximo = fn(combate);
    const saiu = combate.combatentes.filter(c => !proximo.combatentes.some(x => x.id === c.id) && c.encontro);
    if (saiu.length && encontros.status !== "pronto") return false;
    const ok = aplicar(fn);
    if (ok && saiu.length) lojaEnc.aplicar(l => l.map(enc => {
      if (!saiu.some(c => c.encontro?.encontroId === enc.id)) return enc;
      return sincronizarComCombate(sincronizarComCombate(enc, combate), proximo);
    }));
    return ok;
  };
  /** Remover um personagem grava ANTES os PV atuais na ficha: se a gravação falhar (ou a página fechar no meio), ele continua no combate com os PV. */
  const pedirRemocao = async (id: string) => {
    const campanhaDoPedido = campaignId;
    const achar = () => (atual.current.campaignId === campanhaDoPedido ? atual.current.combate?.combatentes.find(c => c.id === id) : undefined);
    const alvo = achar(); if (!alvo || emRemocao.current.has(id)) return;
    if (alvo.ref?.tipo !== "personagem" || !alvo.pvMax || !fichas) { removerCombatente(e => remover(e, id)); return; }
    emRemocao.current.add(id); setRemovendo(new Set(emRemocao.current)); setAvisoRemocao(null);
    try {
      for (let c = alvo; ;) {
        const pv = c.pv ?? c.pvMax!;
        const g = await gravarPvFicha(fichas, c.ref!.id, pv);
        const agora = achar(); if (!agora) return;   // já saiu (outra sessão) ou o combate mudou de campanha
        if (!g.ok && !g.semFicha) {
          if (!window.confirm(`Não foi possível gravar os PV de ${agora.nome} (${pv}) na ficha: ${g.erro}\n\nCancelar mantém o personagem no combate para tentar de novo. Remover mesmo assim descarta essa alteração.`)) { setAvisoRemocao(`${agora.nome} continua no combate: os PV não foram gravados na ficha. Tente remover novamente.`); return; }
          break;
        }
        if ((agora.pv ?? agora.pvMax) === pv) break;
        c = agora;   // os PV mudaram durante a gravação: grava o valor novo antes de remover
      }
      removerCombatente(e => remover(e, id));
    } finally { emRemocao.current.delete(id); setRemovendo(new Set(emRemocao.current)); }
  };
  const finalizar = async () => {
    if (!window.confirm("Finalizar e descartar este combate? Os PV finais dos personagens serão gravados nas fichas. Os encontros salvos serão preservados. Esta ação não pode ser desfeita.")) return;
    // PV finais dos personagens vão para a ficha (só currentHp, sobre a ficha mais recente e com controle de revisão). Se algum falhar, o mestre decide: nada se perde em silêncio.
    if (fichas && combate) {
      const falhas: string[] = [];
      for (const c of combate.combatentes) {
        if (c.ref?.tipo !== "personagem" || !c.pvMax) continue;
        const g = await gravarPvFicha(fichas, c.ref.id, c.pv ?? c.pvMax);
        if (!g.ok && !g.semFicha) falhas.push(`${c.nome} (${g.erro})`);
      }
      if (falhas.length && !window.confirm(`Não foi possível gravar os PV finais nas fichas de: ${falhas.join("; ")}.\n\nCancelar mantém o combate aberto para tentar de novo. Finalizar mesmo assim descarta esses PV.`)) { setErroFinalizar("Combate mantido aberto: os PV finais não foram gravados em todas as fichas. Tente finalizar novamente."); return; }
    }
    const erro = await loja.finalizar(); setErroFinalizar(erro);
    if (!erro && combate) {   // sobreviventes e PV voltam para os encontros de origem; só conclui sozinho quem não tem pendências
      if (encontros.status === "pronto") lojaEnc.aplicar(l => l.map(x => sincronizarComCombate(x, combate, true)));
      else setErroFinalizar("Combate finalizado, mas os encontros não estavam carregados e não foram atualizados. Abra o encontro e conclua-o manualmente.");
    }
    if (!erro && statusApi) { enviados.current.clear(); const l = await statusApi.limpar(campaignId); if (!l.ok) setAvisoFicha(l.mensagem); }
  };
  return <div className="content iniciativa">
    <div className="eyebrow">{(campanha ?? "").toLocaleUpperCase("pt-BR")} · COMBATE</div><h1>Iniciativa</h1>
    {estado.status === "carregando" && <div className="notice" role="status" aria-live="polite">Carregando o combate…</div>}
    {estado.status === "erro" && (nuvem ? <Aviso erro t={estado.mensagem ?? "Não foi possível carregar o combate no servidor."} onRetry={loja.tentar}/> : <ErroArmazenamento onTentar={loja.tentar} onDescartar={loja.descartar} o="o combate"/>)}
    {estado.status === "pronto" && !nuvem && estado.falhaGravacao && <Aviso erro t="Não foi possível salvar o combate. As alterações continuam nesta tela; tente salvar novamente antes de sair." onRetry={loja.tentar}/>}
    {erroFinalizar && <Aviso erro t={erroFinalizar}/>}
    {avisoRemocao && <Aviso erro t={avisoRemocao}/>}
    {avisoFicha && <Aviso erro t={`Ficha do jogador não atualizada: ${avisoFicha} O combate continua salvo.`}/>}
    {combate && <>
      {(!loja.nuvem || loja.sync === "falha" || loja.sync === "conflito" || loja.sync === "permissao") && <ModoArmazenamento nuvem={loja.nuvem} sync={loja.sync} mensagem={loja.mensagem} o="o combate" onTentar={loja.tentar} onRecarregar={() => void loja.recarregar()}/>}
      {loja.nuvem && <BackupLocal chave={chaveCombate(userId, campaignId)} rotulo="combate"/>}
      <div className="ini-turnos-topo"><FaixaTurnos ordem={ordem} turno={combate.turno} retratos={retratos}/>
      <div className="ini-barra ini-controles-turno">
        <strong role="status" className="ini-rodada">Rodada {combate.rodada}</strong>
        <div className="ini-acoes-turno ini-acoes-compactas">
          <button className="btn-secondary ini-turno-icone" aria-label="Turno anterior" title="Turno anterior" onClick={() => aplicar(turnoAnterior)} disabled={!ordem.length}><ChevronLeft size={18} aria-hidden="true"/></button>
          <button className="btn-secondary ini-proximo-turno" aria-label="Próximo turno" title="Próximo turno" onClick={() => { setMenuTurno(false); aplicar(proximoTurno); }} disabled={!ordem.length}>Próximo turno <ChevronRight size={18} aria-hidden="true"/></button>
          <div className="ini-menu-turno" onBlur={e => { if (!e.currentTarget.contains(e.relatedTarget)) setMenuTurno(false); }}>
            <button ref={gatilhoTurnoRef} className="btn-secondary ini-turno-icone" aria-label="Mais ações do combate" title="Mais ações do combate" aria-expanded={menuTurno} onClick={() => setMenuTurno(v => !v)}><Ellipsis size={18} aria-hidden="true"/></button>
            {menuTurno && <div ref={menuTurnoRef} className="barra-menu ini-menu-turno-opcoes">
              <button className="btn-secondary" disabled={!ordem.length} onClick={() => { setMenuTurno(false); aplicar(reiniciarRodadas); }}><RotateCcw size={15} aria-hidden="true"/> Reiniciar rodadas</button>
              <button className="btn-secondary ini-finalizar-turno" onClick={() => { setMenuTurno(false); void finalizar(); }}><Trash2 size={15} aria-hidden="true"/> Finalizar combate</button>
            </div>}
          </div>
        </div>
      </div>
      </div>
      <BuscaCombatentes campaignId={campaignId} encontros={encontros.status === "pronto" ? encontros.valor : null} monstro={adicionarMonstro} personagem={adicionarPersonagem} enviar={enc => { if (!aplicar(e => enviarParaCombate(e, enc))) return; lojaEnc.aplicar(l => l.map(x => x.id === enc.id ? marcarEnviado(x, enc) : x)); }} avulso={<form className="ini-form" onSubmit={submeter} aria-label="Adicionar combatente">
        <label>Nome<input value={nome} onChange={e => setNome(e.target.value)} required maxLength={60}/></label>
        <label>Iniciativa<input inputMode="decimal" value={ini} onChange={e => setIni(e.target.value)} placeholder="0"/></label>
        <label>PV (opcional)<input inputMode="numeric" value={pv} onChange={e => setPv(e.target.value)}/></label>
        <label>Lado<select value={lado} onChange={e => setLado(e.target.value as Lado)}>{(Object.keys(rotuloLado) as Lado[]).map(l => <option key={l} value={l}>{rotuloLado[l]}</option>)}</select></label>
        <button type="submit" className="btn-secondary"><Plus size={15} aria-hidden="true"/> Adicionar</button>
      </form>}/>
      <div className="ini-visualizacao" role="group" aria-label="Visualização dos combatentes">
        <button type="button" className={visualizacao === "cartoes" ? "btn-secondary selecionado" : "btn-secondary"} aria-label="Cartões" title="Cartões" aria-pressed={visualizacao === "cartoes"} onClick={() => alterarVisualizacao("cartoes")}><LayoutGrid size={15} aria-hidden="true"/> Cartões</button>
        <button type="button" className={visualizacao === "lista" ? "btn-secondary selecionado" : "btn-secondary"} aria-label="Lista compacta" title="Lista compacta" aria-pressed={visualizacao === "lista"} onClick={() => alterarVisualizacao("lista")}><List size={15} aria-hidden="true"/> Lista compacta</button>
        <button type="button" className="btn-secondary" aria-label={separarLados ? "Lados separados" : "Lados unificados"} title={separarLados ? "Lados separados" : "Lados unificados"} aria-pressed={separarLados} onClick={() => { const v = !separarLados; setSepararLados(v); try { localStorage.setItem(`compendio5e:lados-combate:${userId}`, v ? "separados" : "unificados"); } catch { /* preferência em memória */ } }}><Columns2 size={15} aria-hidden="true"/><span className="sr-only">{separarLados ? "Lados separados" : "Lados unificados"}</span></button>
      </div>
      {ordem.length === 0
        ? <div className="placeholder vazio" role="status"><Swords size={30} aria-hidden="true"/><strong>Nenhum combatente ainda</strong><span>Adicione quem vai lutar acima, com a iniciativa de cada um. Encontros preparados na aba Encontros podem ser enviados para cá.</span></div>
        : <div role="group" aria-label="Combatentes" className={separarLados ? "ini-grupos separados" : "ini-grupos"}>{(separarLados ? (["aliado", "inimigo", "neutro"] as Lado[]).map(l => ({ titulo: rotuloLado[l], grupo: combate.combatentes.filter(c => c.lado === l) })).filter(g => g.grupo.length) : [{ titulo: "", grupo: combate.combatentes }]).map(({ titulo, grupo }) => <section key={titulo || "todos"} className="ini-grupo">{titulo && <h3>{titulo}</h3>}<ol className={`ini-lista ${visualizacao === "lista" ? "ini-lista-compacta" : "ini-lista-cartoes"}`} aria-label={titulo || "Ordem de iniciativa"}>{grupo.map(c => <Linha key={c.id} c={c} atual={c.id === combate.turno} aplicar={aplicar} aoRemover={() => void pedirRemocao(c.id)} ocupado={removendo.has(c.id)} bonus={mods[c.id] ?? 0} retrato={c.ref?.tipo === "personagem" ? retratos.get(c.ref.id) ?? null : null} rolagem={rolagens[c.id]} aoRolar={r => setRolagens(x => ({ ...x, [c.id]: r }))}/>)}</ol></section>)}</div>}
    </>}
  </div>;
}
type Aplicar = (fn: (e: EstadoCombate) => EstadoCombate) => boolean;
function Linha({ c, atual, aplicar, aoRemover, ocupado, bonus, retrato, rolagem, aoRolar }: { c: EstadoCombate["combatentes"][number]; atual: boolean; aplicar: Aplicar; aoRemover: () => void; ocupado: boolean; bonus: number; retrato: string | null; rolagem?: Rolagem; aoRolar: (r: Rolagem) => void }) {
  const [valor, setValor] = useState("1");
  const acao = (sinal: 1 | -1) => { if (ocupado) return; const n = numero(valor); if (n && n > 0) { if (aplicar(e => alterarPv(e, c.id, sinal * n))) setValor("1"); } };
  const rolar = () => { const r = rolarD20(bonus); aoRolar(r); aplicar(e => definirIniciativa(e, c.id, r.total)); };
  const pct = c.pvMax ? Math.max(0, Math.min(100, (c.pv ?? 0) / c.pvMax * 100)) : 0;
  return <li className={`ini-item lado-${c.lado}${c.pvMax && c.pv === 0 ? " derrotado" : ""}${atual ? " atual" : ""}`} aria-current={atual ? "true" : undefined}>
    <CriaturaIdentidade nome={c.nome} tipo={c.ref?.tipo ?? "avulso"} retrato={retrato} referencia={c.ref} detalhes={<>{rotuloLado[c.lado]}{c.ref ? (c.ref.tipo === "monstro" ? " · Bestiário" : " · personagem") : ""}{atual ? " · turno atual" : ""}{c.ca ? ` · CA ${c.ca}` : ""}</>}/>
    {c.notas && <small className="ini-notas muted">{c.notas}</small>}
    <div className="ini-ini">
      <label className="ini-valor">Iniciativa<input aria-label={`Iniciativa de ${c.nome}`} inputMode="decimal" defaultValue={c.iniciativa} key={c.iniciativa}
        onBlur={e => { const n = numero(e.target.value); if (n !== undefined && n !== c.iniciativa) aplicar(x => definirIniciativa(x, c.id, n)); }}/></label>
      <button className="btn-secondary ini-icone" onClick={rolar} aria-label={`Rolar iniciativa de ${c.nome}`} title={bonus ? `1d20 ${bonus > 0 ? "+" : "−"}${Math.abs(bonus)}` : "1d20"}><Dices size={15} aria-hidden="true"/></button>
      {rolagem && <span className="ini-rolagem" role="status" aria-label={`Resultado da rolagem de ${c.nome}`}>{textoRolagem(rolagem)}</span>}
    </div>
    {c.pvMax ? <div className="ini-pv"><span className="ini-pv-texto" aria-label={`PV de ${c.nome}`}>PV {c.pv}/{c.pvMax}{c.pv === 0 ? " · caído" : ""}</span>
      <ControleNumerico campo={{ "aria-label": `Quantidade de dano ou cura de ${c.nome}`, value: valor, onChange: e => setValor(e.target.value), placeholder: "valor" }} menos={{ rotulo: `Causar dano a ${c.nome}`, titulo: "Dano", acao: () => acao(-1) }} mais={{ rotulo: `Curar ${c.nome}`, titulo: "Cura", acao: () => acao(1) }}/>
      <div className="ini-pv-trilho" aria-hidden="true"><div className="ini-pv-preenchimento" style={{ width: `${pct}%` }} data-baixo={pct <= 25 ? "true" : undefined}/></div></div> : <span className="muted ini-pv">Sem PV</span>}
    <div className="ini-condicoes">
      {(c.condicoes ?? []).map(k => <button key={k} className="ini-chip" onClick={() => aplicar(e => alternarCondicao(e, c.id, k))} aria-label={`Remover condição ${k} de ${c.nome}`}>{k} ×</button>)}
      <select aria-label={`Adicionar condição a ${c.nome}`} value="" onChange={e => { if (e.target.value) aplicar(x => alternarCondicao(x, c.id, e.target.value)); }}>
        <option value="">+ condição</option>{CONDICOES_5E.filter(k => !(c.condicoes ?? []).includes(k)).map(k => <option key={k} value={k}>{k}</option>)}</select>
    </div>
    {ocupado && <small className="ini-gravando muted" role="status">Gravando os PV na ficha…</small>}
    <button className="btn-secondary ini-icone ini-remover" disabled={ocupado} onClick={aoRemover} aria-label={`Remover ${c.nome}`}><Trash2 size={15} aria-hidden="true"/></button>
  </li>;
}

import { RotuloVital } from "./npc/ControleVital";
import type { EstadoVitalidade } from "./npc/estado";
import { useBancoDeNpcs, useFichasComNpcs, useVidas } from "./npc/estado";
import type { NpcEscolhido } from "./npc/SeletorNpc";
import { BuscaCombatentes } from "./BuscaCombatentes";
import { useFecharMenu } from "./useFecharMenu";
import { ChevronLeft, ChevronRight, Ellipsis, Dices, LayoutGrid, List, Plus, RotateCcw, Swords, Trash2, Columns2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Aviso } from "./Diario";
import { useUnsavedGuard } from "./unsaved";
import { adicionar, nomeCombatenteDisponivel, alterarPv, alternarCondicao, chaveCombate, combateVazio, definirIniciativa, enviarParaCombate, lerCombate, novoId, ordenar, proximoTurno, reiniciarRodadas, remover, turnoAnterior, type EstadoCombate, type Lado } from "./combate";
import { useNuvem, type ApisNuvem } from "./nuvem";
import { useFichas } from "./RegistrosContext";
import { comEstadoDasFichas, idDePersonagem, idsDePersonagens, useMaximos, type CombatenteVivo } from "./vitais/combate";
import { useVitais } from "./vitais/loja";
import type { AcaoVital } from "./vitais/vitais";
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
  const { userId, campaignId, podeGerenciar } = useEscopo();
  const nuvem = useNuvem(), fichas = useFichas();
  const loja = useLojaCombate(userId, campaignId, podeGerenciar, nuvem);
  const { estado, aplicar } = loja;
  useUnsavedGuard("secao:iniciativa", loja.sujo, loja.salvar);
  // PV, PV temporários e condições dos PERSONAGENS com ficha são os DA FICHA (fonte única): lidos em tempo real e alterados por operação.
  // NPC com ficha de criatura passa pela mesma fila: a API abaixo atende fichas e NPCs
  const comNpcs = useFichasComNpcs(fichas, podeGerenciar), vidas = useVidas(podeGerenciar), bancoDeNpcs = useBancoDeNpcs();
  const idsPj = podeGerenciar && estado.status === "pronto" ? idsDePersonagens(estado.valor).filter(id => comNpcs.criaturas.has(id) || !estado.valor.combatentes.some(c => c.ref?.tipo === "npc" && c.ref.id === id)) : [];
  const vit = useVitais(podeGerenciar ? comNpcs.api : null, idsPj, campaignId);
  const linhasPj = idsPj.flatMap(id => { const l = vit.ver(id); return l ? [l] : []; });
  const maximos = useMaximos(linhasPj);
  const [nome, setNome] = useState(""), [ini, setIni] = useState(""), [pv, setPv] = useState(""), [lado, setLado] = useState<Lado>("inimigo");
  const [visualizacao, setVisualizacao] = useState<VisualizacaoCombate>("cartoes"), [erroFinalizar, setErroFinalizar] = useState<string | null>(null);
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
  /** O que aparece na tela: o combate com o estado vital das fichas. */
  const vivo = combate ? comEstadoDasFichas(combate, vit.ver, maximos) : null;
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
  /** NPC entra uma única vez; o lado começa neutro e a iniciativa é rolada quando a ficha é de criatura. */
  const adicionarNpc = (n: NpcEscolhido) => {
    const tipo = n.tipo, jaEsta = (e: EstadoCombate) => e.combatentes.some(c => (c.ref?.tipo === "personagem" || c.ref?.tipo === "npc") && c.ref.id === n.id);
    const id = novoId(), pvs = { pv: n.pvAtual, pvMax: n.pvMax };
    if (n.tipo === "personagem") { aplicar(e => (jaEsta(e) ? e : adicionar(e, { id, nome: n.nome, iniciativa: 0, lado: "neutro", ...pvs, ref: { tipo, id: n.id } }))); return; }
    const bonus = modAtributo(n.destreza), r = rolarD20(bonus);
    setMods(x => ({ ...x, [id]: bonus })); setRolagens(x => ({ ...x, [id]: r }));
    aplicar(e => (jaEsta(e) ? e : definirIniciativa(adicionar(e, { id, nome: nomeCombatenteDisponivel(e, n.nome), iniciativa: 0, lado: "neutro", ...pvs, ca: n.ca, ref: { tipo, id: n.id } }), id, r.total)));
  };
  const ordem = vivo ? ordenar(vivo.combatentes) : [];
  const removerCombatente: Aplicar = fn => {
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
  const finalizar = async () => {
    if (!window.confirm("Finalizar e descartar este combate? As fichas dos personagens já estão atualizadas. Os encontros salvos serão preservados. Esta ação não pode ser desfeita.")) return;
    const erro = await loja.finalizar(); setErroFinalizar(erro);
    if (!erro && combate) {   // sobreviventes e PV voltam para os encontros de origem; só conclui sozinho quem não tem pendências
      if (encontros.status === "pronto") lojaEnc.aplicar(l => l.map(x => sincronizarComCombate(x, combate, true)));
      else setErroFinalizar("Combate finalizado, mas os encontros não estavam carregados e não foram atualizados. Abra o encontro e conclua-o manualmente.");
    }
  };
  /** Personagem com ficha: a ação vira operação na ficha. Devolve false para o combate tratar (monstros e avulsos). */
  const naFicha = (c: CombatenteVivo, acao: AcaoVital): boolean => {
    const id = idDePersonagem(c);
    if (!c.daFicha || !id || !vit.loja) return false;
    vit.loja.enviar(id, acao); return true;
  };
  return <div className="content iniciativa">
    <div className="eyebrow">COMBATE</div><h1>Iniciativa</h1>
    {estado.status === "carregando" && <div className="notice" role="status" aria-live="polite">Carregando o combate…</div>}
    {estado.status === "erro" && (nuvem ? <Aviso erro t={estado.mensagem ?? "Não foi possível carregar o combate no servidor."} onRetry={loja.tentar}/> : <ErroArmazenamento onTentar={loja.tentar} onDescartar={loja.descartar} o="o combate"/>)}
    {estado.status === "pronto" && !nuvem && estado.falhaGravacao && <Aviso erro t="Não foi possível salvar o combate. As alterações continuam nesta tela; tente salvar novamente antes de sair." onRetry={loja.tentar}/>}
    {erroFinalizar && <Aviso erro t={erroFinalizar}/>}
    {vit.erro && <div className="notice err" role="alert" data-testid="aviso-sincronizacao">Fichas não sincronizadas: {vit.erro}{vit.pendentes > 0 ? ` ${vit.pendentes} alteração(ões) aguardando envio.` : ""} <button type="button" className="btn-link" onClick={() => { vit.loja?.tentar(); void vit.loja?.ler(idsPj); }}>Tentar agora</button></div>}
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
      <BuscaCombatentes campaignId={campaignId} encontros={encontros.status === "pronto" ? encontros.valor : null} monstro={adicionarMonstro} personagem={adicionarPersonagem} npc={adicionarNpc} enviar={enc => { if (!aplicar(e => enviarParaCombate(e, enc))) return; lojaEnc.aplicar(l => l.map(x => x.id === enc.id ? marcarEnviado(x, enc) : x)); }} avulso={<form className="ini-form" onSubmit={submeter} aria-label="Adicionar combatente">
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
        : <div role="group" aria-label="Combatentes" className={separarLados ? "ini-grupos separados" : "ini-grupos"}>{(separarLados ? (["aliado", "inimigo", "neutro"] as Lado[]).map(l => ({ titulo: rotuloLado[l], grupo: (vivo!.combatentes as CombatenteVivo[]).filter(c => c.lado === l) })).filter(g => g.grupo.length) : [{ titulo: "", grupo: vivo!.combatentes as CombatenteVivo[] }]).map(({ titulo, grupo }) => <section key={titulo || "todos"} className="ini-grupo">{titulo && <h3>{titulo}</h3>}<ol className={`ini-lista ${visualizacao === "lista" ? "ini-lista-compacta" : "ini-lista-cartoes"}`} aria-label={titulo || "Ordem de iniciativa"}>{grupo.map(c => <Linha key={c.id} c={c} atual={c.id === combate.turno} aplicar={aplicar} naFicha={naFicha} aguardandoFicha={!!idDePersonagem(c) && !!fichas && !c.daFicha && !vit.carregado} aoRemover={() => removerCombatente(e => remover(e, c.id))} vital={bancoDeNpcs && idDePersonagem(c) ? { estado: vidas.estadoDe(idDePersonagem(c)!), confirmarMorte: () => { if (window.confirm(`Confirmar a morte de ${c.nome}? O estado vital muda para Morto; a ficha, a história e os vínculos continuam.`)) void vidas.definir(idDePersonagem(c)!, "morto"); } } : undefined} bonus={mods[c.id] ?? 0} retrato={c.ref?.tipo === "personagem" ? retratos.get(c.ref.id) ?? null : null} rolagem={rolagens[c.id]} aoRolar={r => setRolagens(x => ({ ...x, [c.id]: r }))}/>)}</ol></section>)}</div>}
    </>}
  </div>;
}
type Aplicar = (fn: (e: EstadoCombate) => EstadoCombate) => boolean;
function Linha({ c, atual, aplicar, naFicha, aguardandoFicha, aoRemover, vital, bonus, retrato, rolagem, aoRolar }: { /** Quem tem identidade persistente: 0 PV não é morte; o mestre confirma. */ vital?: { estado: EstadoVitalidade; confirmarMorte: () => void }; c: CombatenteVivo; atual: boolean; aplicar: Aplicar; naFicha: (c: CombatenteVivo, a: AcaoVital) => boolean; aguardandoFicha: boolean; aoRemover: () => void; bonus: number; retrato: string | null; rolagem?: Rolagem; aoRolar: (r: Rolagem) => void }) {
  const [valor, setValor] = useState("1");
  // campo vazio vale 1, como na ficha
  const quantia = () => { const n = valor.trim() === "" ? 1 : numero(valor); return n !== undefined && Number.isInteger(n) && n > 0 ? n : null; };
  const acao = (sinal: 1 | -1) => {
    const n = quantia(); if (n === null || aguardandoFicha) return;
    if (naFicha(c, sinal < 0 ? { tipo: "dano", valor: n } : { tipo: "cura", valor: n, maximo: c.pvMax! })) { setValor("1"); return; }
    if (aplicar(e => alterarPv(e, c.id, sinal * n))) setValor("1");
  };
  const temporarios = () => { const n = valor.trim() === "" ? 1 : numero(valor); if (n !== undefined && Number.isInteger(n) && n >= 0 && n <= 999 && naFicha(c, { tipo: "temporarios", valor: n })) setValor("1"); };
  const condicao = (k: string, ativa: boolean) => { if (!aguardandoFicha && !naFicha(c, { tipo: "condicao", nome: k, ativa })) aplicar(e => alternarCondicao(e, c.id, k)); };
  const rolar = () => { const r = rolarD20(bonus); aoRolar(r); aplicar(e => definirIniciativa(e, c.id, r.total)); };
  const pct = c.pvMax ? Math.max(0, Math.min(100, (c.pv ?? 0) / c.pvMax * 100)) : 0;
  return <li className={`ini-item lado-${c.lado}${c.pvMax && c.pv === 0 ? " derrotado" : ""}${atual ? " atual" : ""}`} aria-current={atual ? "true" : undefined}>
    <CriaturaIdentidade monstroAoLado nome={c.nome} tipo={c.ref?.tipo ?? "avulso"} retrato={retrato} referencia={c.ref} detalhes={<>{rotuloLado[c.lado]}{c.ref ? (c.ref.tipo === "monstro" ? " · Bestiário" : c.ref.tipo === "npc" ? " · NPC" : " · personagem") : ""}{atual ? " · turno atual" : ""}{c.ca ? ` · CA ${c.ca}` : ""}</>}/>
    {c.notas && <small className="ini-notas muted">{c.notas}</small>}
    <div className="ini-ini">
      <label className="ini-valor">Iniciativa<input aria-label={`Iniciativa de ${c.nome}`} inputMode="decimal" defaultValue={c.iniciativa} key={c.iniciativa}
        onBlur={e => { const n = numero(e.target.value); if (n !== undefined && n !== c.iniciativa) aplicar(x => definirIniciativa(x, c.id, n)); }}/></label>
      <button className="btn-secondary ini-icone" onClick={rolar} aria-label={`Rolar iniciativa de ${c.nome}`} title={bonus ? `1d20 ${bonus > 0 ? "+" : "−"}${Math.abs(bonus)}` : "1d20"}><Dices size={15} aria-hidden="true"/></button>
      {rolagem && <span className="ini-rolagem" role="status" aria-label={`Resultado da rolagem de ${c.nome}`}>{textoRolagem(rolagem)}</span>}
    </div>
    {c.pvMax ? <div className="ini-pv"><span className="ini-pv-texto" aria-label={`PV de ${c.nome}`}>PV {c.pv}/{c.pvMax}{c.pv === 0 ? " · caído" : ""}</span>
      {!!c.temp && <small className="ini-temp" aria-label={`PV temporários de ${c.nome}`}>+{c.temp} temp.</small>}
      <ControleNumerico campo={{ "aria-label": `Quantidade de dano ou cura de ${c.nome}`, value: valor, onChange: e => setValor(e.target.value), placeholder: "1" }} menos={{ rotulo: `Causar dano a ${c.nome}`, titulo: "Dano", acao: () => acao(-1) }} mais={{ rotulo: `Curar ${c.nome}`, titulo: "Cura", acao: () => acao(1) }}/>
      {c.daFicha && <button type="button" className="btn-secondary ini-temp-botao" aria-label={`Definir PV temporários de ${c.nome}`} title="Define os PV temporários com a quantidade do campo (0 remove)" onClick={temporarios}>Temp.</button>}
      {aguardandoFicha && <small className="muted" role="status">lendo a ficha…</small>}
      <div className="ini-pv-trilho" aria-hidden="true"><div className="ini-pv-preenchimento" style={{ width: `${pct}%` }} data-baixo={pct <= 25 ? "true" : undefined}/></div></div> : <span className="muted ini-pv">Sem PV</span>}
    {vital && (vital.estado === "morto" ? <small className="ini-vital"><RotuloVital estado="morto"/></small> : c.pvMax && c.pv === 0 ? <button type="button" className="btn-secondary ini-vital" onClick={vital.confirmarMorte} aria-label={`Confirmar morte de ${c.nome}`}>Confirmar morte</button> : null)}
    <div className="ini-condicoes">
      {(c.condicoes ?? []).map(k => <button key={k} className="ini-chip" onClick={() => condicao(k, false)} aria-label={`Remover condição ${k} de ${c.nome}`}>{k} ×</button>)}
      <select aria-label={`Adicionar condição a ${c.nome}`} value="" onChange={e => { if (e.target.value) condicao(e.target.value, true); }}>
        <option value="">+ condição</option>{CONDICOES_5E.filter(k => !(c.condicoes ?? []).includes(k)).map(k => <option key={k} value={k}>{k}</option>)}</select>
    </div>
    <button className="btn-secondary ini-icone ini-remover" onClick={aoRemover} aria-label={`Remover ${c.nome}`}><Trash2 size={15} aria-hidden="true"/></button>
  </li>;
}

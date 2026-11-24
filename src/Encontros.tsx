import { Copy, FolderOpen, Plus, Swords, Trash2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Aviso } from "./Diario";
import { useUnsavedGuard } from "./unsaved";
import { chaveCombate, chaveEncontros, duplicarEncontro, enviarParaCombate, lerCombate, lerEncontros, novoId, type Encontro, type EstadoCombate } from "./combate";
import { EncontroPagina } from "./EncontroPagina";
import { ROTULO_ESTADO, duplicarEstadoAtual, estadoDe, marcarEnviado, sincronizarComCombate } from "./estadoEncontro";
import { useNuvem, type ApisNuvem } from "./nuvem";
import { useLinhaRemota, type SyncRemoto } from "./useLinhaRemota";
import { EVENTO, type Estado, useArmazenado, useEscopo, SemCampanha, AcessoRestrito, ErroArmazenamento, ModoArmazenamento, BackupLocal } from "./CombateCompartilhado";
// ---------------------------------------------------------------- Encontros
export function useLojaEncontros(userId: string | null, campaignId: string | null, podeGerenciar: boolean, nuvem: ApisNuvem | null) {
  const ativo = !!(userId && campaignId && podeGerenciar);
  const local = useArmazenado<Encontro[]>(ativo && !nuvem ? chaveEncontros(userId!, campaignId!) : null, lerEncontros);
  const remoto = useLinhaRemota<Encontro[]>({ api: ativo && nuvem ? nuvem.encontros : null, campaignId: ativo && nuvem ? campaignId : null, vazio: () => [], chaveBackup: ativo && nuvem ? `compendio5e:encontros-nuvem:${userId}:${campaignId}` : null });
  // Vários painéis (Iniciativa e Encontros) leem a mesma linha: ao gravar, avisa os outros para relerem; ao ser avisado, relê se houver versão nova.
  const aviso = campaignId ? `nuvem:encontros:${campaignId}` : null, anterior = useRef(remoto.sync);
  useEffect(() => { if (nuvem && aviso && anterior.current !== "salvo" && remoto.sync === "salvo") window.dispatchEvent(new CustomEvent(EVENTO, { detail: aviso })); anterior.current = remoto.sync; }, [remoto.sync, nuvem, aviso]);
  useEffect(() => {
    if (!nuvem || !aviso) return;
    const aoAvisar = (e: Event) => { if ((e as CustomEvent<string>).detail === aviso) void remoto.reler(); };
    window.addEventListener(EVENTO, aoAvisar); return () => window.removeEventListener(EVENTO, aoAvisar);
  }, [nuvem, aviso, remoto.reler]);   // eslint-disable-line react-hooks/exhaustive-deps
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
  const [nome, setNome] = useState(""), [aviso, setAviso] = useState<string | null>(null), [abertoId, setAbertoId] = useState<string | null>(null);
  if (!userId || !campaignId) return <SemCampanha titulo="Encontros"/>;
  if (!podeGerenciar) return <AcessoRestrito titulo="Encontros"/>;
  const lista = estado.status === "pronto" ? estado.valor : null;
  const aberto = lista && abertoId ? lista.find(x => x.id === abertoId) ?? null : null;   // some da lista (ex.: excluído em outra sessão): volta à lista
  const enviar = async (enc: Encontro) => {
    if (nuvem) {   // lê o combate da nuvem, acrescenta e grava com a versão lida; conflito/queda nunca sobrescrevem
      const r = await nuvem.combate.carregar(campaignId);
      if (!r.ok) { setAviso(`Não foi possível enviar: ${r.mensagem}`); return; }
      const s = await nuvem.combate.salvar(campaignId, enviarParaCombate(r.data.valor, enc), r.data.versao);
      if (!s.ok) { setAviso(`Não foi possível enviar: ${s.mensagem}`); return; }
      window.dispatchEvent(new CustomEvent(EVENTO, { detail: `nuvem:combate:${campaignId}` }));
      aplicar(l => l.map(x => (x.id === enc.id ? marcarEnviado(x, enc) : x)));
      setAviso(`"${enc.nome}" foi enviado para a Iniciativa. O encontro continua salvo aqui. Informe a iniciativa de cada um lá.`); return;
    }
    const k = chaveCombate(userId, campaignId);
    try {
      const novo = enviarParaCombate(lerCombate(localStorage.getItem(k)), enc);
      localStorage.setItem(k, JSON.stringify(novo)); window.dispatchEvent(new CustomEvent(EVENTO, { detail: k }));
      aplicar(l => l.map(x => (x.id === enc.id ? marcarEnviado(x, enc) : x)));
      setAviso(`"${enc.nome}" foi enviado para a Iniciativa. Informe a iniciativa de cada um lá.`);
    } catch { setAviso("Não foi possível enviar: o combate guardado neste aparelho está ilegível. Abra a Iniciativa para tentar de novo ou descartá-lo."); }
  };
  /** Lê o combate em andamento (nuvem ou local) e atualiza PV, derrotados e quem saiu neste encontro. Sem combate, equivale a "o combate acabou". */
  const sincronizar = async (enc: Encontro) => {
    let combate: EstadoCombate;
    if (nuvem) { const r = await nuvem.combate.carregar(campaignId); if (!r.ok) { setAviso(`Não foi possível ler o combate: ${r.mensagem}`); return; } combate = r.data.valor; }
    else { try { combate = lerCombate(localStorage.getItem(chaveCombate(userId, campaignId))); } catch { setAviso("Não foi possível ler o combate guardado neste aparelho."); return; } }
    const ativo = combate.combatentes.some(c => c.encontro?.encontroId === enc.id);
    aplicar(l => l.map(x => (x.id === enc.id ? sincronizarComCombate(x, combate, !ativo) : x)));
    setAviso(ativo ? "Encontro atualizado a partir do combate em andamento." : "Nenhuma criatura deste encontro está no combate: o estado atual foi atualizado como combate encerrado.");
  };
  const duplicarAtual = (enc: Encontro) => aplicar(l => { const i = l.findIndex(x => x.id === enc.id); return i < 0 ? l : [...l.slice(0, i + 1), duplicarEstadoAtual(enc), ...l.slice(i + 1)]; });
  return <div className="content iniciativa">
    <div className="eyebrow">{(campanha ?? "").toLocaleUpperCase("pt-BR")} · PREPARAÇÃO</div><h1>Encontros</h1>
    {estado.status === "carregando" && <div className="notice" role="status" aria-live="polite">Carregando os encontros…</div>}
    {estado.status === "erro" && (nuvem ? <Aviso erro t={estado.mensagem ?? "Não foi possível carregar os encontros no servidor."} onRetry={loja.tentar}/> : <ErroArmazenamento onTentar={loja.tentar} onDescartar={loja.descartar} o="os encontros"/>)}
    {aviso && <div className="notice" role="status">{aviso}</div>}
    {estado.status === "pronto" && !nuvem && estado.falhaGravacao && <Aviso erro t="Não foi possível salvar os encontros. As alterações continuam nesta tela; tente salvar novamente antes de sair." onRetry={loja.tentar}/>}
    {lista && <>
      <ModoArmazenamento nuvem={loja.nuvem} sync={loja.sync} mensagem={loja.mensagem} o="os encontros" onTentar={loja.tentar} onRecarregar={() => void loja.recarregar()} dados={lista} arquivo="encontros-nuvem"/>
      {loja.nuvem && <BackupLocal chave={chaveEncontros(userId, campaignId)} rotulo="encontros"/>}
      {aberto ? <EncontroPagina enc={aberto} salvar={n => aplicar(l => l.map(x => (x.id === aberto.id ? n : x)))} voltar={() => setAbertoId(null)} enviar={e => void enviar(e)} sincronizar={() => void sincronizar(aberto)} duplicarAtual={() => duplicarAtual(aberto)}/> : <>
      <form className="ini-form" aria-label="Novo encontro" onSubmit={e => { e.preventDefault(); if (nome.trim()) { const n = nome.trim(); const novo = { id: novoId(), nome: n, participantes: [] }; aplicar(l => [...l, novo]); setAbertoId(novo.id); setNome(""); } }}>
        <label>Nome do encontro<input value={nome} onChange={e => setNome(e.target.value)} required maxLength={80}/></label>
        <button type="submit" className="btn-secondary"><Plus size={15} aria-hidden="true"/> Criar encontro</button>
      </form>
      {lista.length === 0
        ? <div className="placeholder vazio" role="status"><Swords size={30} aria-hidden="true"/><strong>Nenhum encontro preparado</strong><span>Crie um encontro, liste quem participa (do Bestiário ou digitando nome, quantidade e PV) e envie para a Iniciativa na hora do combate.</span></div>
        : lista.map(enc => <Cartao key={enc.id} enc={enc} abrir={() => setAbertoId(enc.id)}
          duplicar={() => aplicar(l => { const i = l.findIndex(x => x.id === enc.id); const copia = duplicarEncontro(enc); return i < 0 ? l : [...l.slice(0, i + 1), copia, ...l.slice(i + 1)]; })}
          excluir={() => { if (window.confirm(`Excluir o encontro "${enc.nome}"?`)) aplicar(l => l.filter(x => x.id !== enc.id)); }} enviar={() => void enviar(enc)}/>)}
      </>}
    </>}
  </div>;
}
/** Cartão resumido da lista: abrir a página, enviar tudo, duplicar e excluir. A edição fica na página do encontro. */
function Cartao({ enc, abrir, excluir, enviar, duplicar }: { enc: Encontro; abrir: () => void; excluir: () => void; enviar: () => void; duplicar: () => void }) {
  const total = enc.participantes.reduce((s, p) => s + p.quantidade, 0);
  return <section className="ini-cartao" aria-label={`Encontro ${enc.nome}`}>
    <h2>{enc.nome} <span className="enc-estado" data-estado={estadoDe(enc)}>{ROTULO_ESTADO[estadoDe(enc)]}</span></h2>
    {enc.descricao && <p className="enc-resumo">{enc.descricao}</p>}
    <p className="muted">{enc.participantes.length === 0 ? "Sem criaturas" : `${enc.participantes.length} tipo(s) de criatura, ${total} no total: ${enc.participantes.slice(0, 4).map(p => `${p.quantidade}× ${p.nome}`).join(", ")}${enc.participantes.length > 4 ? "…" : ""}`}</p>
    <div className="ini-barra">
      <button className="btn-secondary" onClick={abrir} aria-label={`Abrir encontro ${enc.nome}`}><FolderOpen size={15} aria-hidden="true"/> Abrir</button>
      <button className="btn-secondary" onClick={enviar} disabled={!enc.participantes.length}><Swords size={15} aria-hidden="true"/> Enviar para a Iniciativa</button>
      <button className="btn-secondary" onClick={duplicar} aria-label={`Duplicar encontro ${enc.nome}`}><Copy size={15} aria-hidden="true"/> Duplicar</button>
      <button className="btn-secondary" onClick={excluir}><Trash2 size={15} aria-hidden="true"/> Excluir encontro</button>
    </div>
  </section>;
}

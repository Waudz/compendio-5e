import { Copy, Pencil, Plus, Swords, Trash2 } from "lucide-react";
import { useState } from "react";
import { Aviso } from "./Diario";
import { useUnsavedGuard } from "./unsaved";
import { adicionarParticipante, chaveCombate, chaveEncontros, duplicarEncontro, enviarParaCombate, lerCombate, lerEncontros, novoId, renomearEncontro, type Encontro, type RefCombate } from "./combate";
import { useNuvem, type ApisNuvem } from "./nuvem";
import { useLinhaRemota, type SyncRemoto } from "./useLinhaRemota";
import type { Monstro } from "./catalogue/sistemas/dnd5e-2014/esquemas";
import { EVENTO, type Estado, useArmazenado, numero, useEscopo, SemCampanha, AcessoRestrito, ErroArmazenamento, ModoArmazenamento, BackupLocal, SeletorMonstro } from "./CombateCompartilhado";
// ---------------------------------------------------------------- Encontros
export function useLojaEncontros(userId: string | null, campaignId: string | null, podeGerenciar: boolean, nuvem: ApisNuvem | null) {
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
      <ModoArmazenamento nuvem={loja.nuvem} sync={loja.sync} mensagem={loja.mensagem} o="os encontros" onTentar={loja.tentar} onRecarregar={() => void loja.recarregar()} dados={lista} arquivo="encontros-nuvem"/>
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

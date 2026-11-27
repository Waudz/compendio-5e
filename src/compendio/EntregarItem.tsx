/** Entrega de um item pelo mestre, identificado ou não, e identificação posterior. As duas operações são atômicas no servidor. */
import { useState } from 'react';
import { Gift } from 'lucide-react';
import { useCampaigns } from '../CampaignsContext';
import { Aviso } from '../Diario';
import { Modal } from '../ui/Modal';
import { avisarRegistros } from '../registrosStore';
import { avisarConhecimento, useCodexApi } from './conhecimento';
import { useIdentidades } from './consulta';

export function EntregarItem({ definitionId, nome, nomeAparente }: { definitionId: string; nome: string; nomeAparente?: string }) {
  const { active } = useCampaigns(), api = useCodexApi();
  const [open, setOpen] = useState(false);
  if (active?.role !== 'mestre' || !api?.grantItem) return null;
  return <>
    <button type="button" className="btn-secondary" onClick={() => setOpen(true)}><Gift size={15} aria-hidden="true"/> Entregar a um personagem</button>
    {open && <JanelaEntrega definitionId={definitionId} nome={nome} nomeAparente={nomeAparente} onFechar={() => setOpen(false)}/>}
  </>;
}

function JanelaEntrega({ definitionId, nome, nomeAparente, onFechar }: { definitionId: string; nome: string; nomeAparente?: string; onFechar: () => void }) {
  const { active } = useCampaigns(), api = useCodexApi(), personagens = useIdentidades();
  const [destino, setDestino] = useState(''), [quantidade, setQuantidade] = useState('1'), [oculto, setOculto] = useState(false);
  const [aparente, setAparente] = useState(nomeAparente || 'Item desconhecido'), [descricao, setDescricao] = useState('');
  const [busy, setBusy] = useState(false), [erro, setErro] = useState(''), [feito, setFeito] = useState('');
  // A mesma operação repetida (rede instável) não entrega duas vezes.
  const [operacao, setOperacao] = useState(() => crypto.randomUUID());
  const q = Number(quantidade), alvo = personagens.items.find(p => p.id === destino);
  const valido = !!alvo && Number.isInteger(q) && q >= 1 && q <= 1000 && (!oculto || !!aparente.trim());
  const entregar = () => {
    if (!api?.grantItem || !active || !valido) return;
    setBusy(true); setErro(''); setFeito('');
    api.grantItem(active.campaign.id, destino, definitionId, q, oculto ? { nome: aparente.trim(), descricao: descricao.trim() } : null, operacao).then(
      () => { setBusy(false); setFeito(`Entregue a ${alvo.nome}.`); setOperacao(crypto.randomUUID()); avisarRegistros(); avisarConhecimento(); },
      e => { setBusy(false); setErro(e instanceof Error ? e.message : 'Não foi possível entregar.'); });
  };
  return <Modal titulo={`Entregar ${nome}`} onFechar={onFechar} ocupado={busy} acoes={<button className="btn-primary" disabled={!valido || busy} onClick={entregar}>Entregar</button>}>
    <div className="cd-form codex-editor">
      <label>Personagem<select value={destino} onChange={e => setDestino(e.target.value)}><option value="">Escolher…</option>{personagens.items.map(p => <option key={p.id} value={p.id}>{p.nome}</option>)}</select></label>
      <label>Quantidade<input type="number" min={1} max={1000} value={quantidade} onChange={e => setQuantidade(e.target.value)}/></label>
      <label className="cd-check"><input type="checkbox" checked={oculto} onChange={e => setOculto(e.target.checked)}/> Entregar como não identificado</label>
      {oculto && <>
        <label>Nome aparente<input value={aparente} maxLength={120} onChange={e => setAparente(e.target.value)}/></label>
        <label>Descrição aparente<textarea value={descricao} maxLength={2000} onChange={e => setDescricao(e.target.value)}/></label>
        <p className="muted">O jogador recebe somente a aparência. Nome e propriedades verdadeiros ficam no servidor até você identificar o item.</p>
      </>}
      {personagens.loading && <p role="status">Carregando personagens…</p>}
      {personagens.error && <Aviso erro t={personagens.error}/>}
      {erro && <Aviso erro t={erro}/>}
      {feito && <p role="status">{feito}</p>}
    </div>
  </Modal>;
}

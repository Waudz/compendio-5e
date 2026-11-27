/** Vínculos de um registro: seleção com miniaturas, relações tipadas e inversas, divulgação por vínculo. */
import { useEffect, useMemo, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { useCampaigns } from '../CampaignsContext';
import { Aviso } from '../Diario';
import { Modal } from '../ui/Modal';
import { useAbrirEmAba } from '../abrirEmAba';
import { srdItemFile } from '../catalogue/srd-2014-items';
import { imagemDoItem } from '../ficha/imagensCatalogo';
import { avisarConhecimento, type NovoVinculo, type CodexLink } from './conhecimento';
import { ImagemLinha } from './ComponentesCategoria';
import { SeletorRegistro } from './SeletorRegistro';
import { garantirRegistro } from './RegistrosCampanha';
import { aplicarDaCampanha, useDefinicoes, type LinhaDefinicao } from './definicoes';
import { nomesCategoria, type useLinhasCampanha, type LinhaCompendio } from './consulta';
import { identidadeSpec, registroSpec } from './navegacao';
import { montarRelacao, OPCOES_RELACAO, PERSONALIZADA } from './relacoes';
import type { TabSpec } from '../workspace';

const CATALOGO = 'catalog:';

/** Itens do catálogo ainda sem página na campanha. Escolher um cria só a referência secreta: sem descoberta e sem inventário. */
export function linhasDoCatalogo(rows: readonly LinhaCompendio[], daMesa: readonly LinhaDefinicao[] = []): LinhaCompendio[] {
  const usados = new Set(rows.flatMap(r => (r.entry?.category === 'item' && r.entry.definitionId ? [r.entry.definitionId] : [])));
  return aplicarDaCampanha('item', srdItemFile().items, daMesa).filter(i => !usados.has(i.id)).map(i => ({
    id: CATALOGO + i.id, title: i.nome, category: 'catalog-item', subtitle: 'Item do catálogo', body: i.en, image: imagemDoItem(i.id), spec: { kind: 'item', ref: i.id, title: i.nome },
  }));
}

export function useVinculos(id: string, data: ReturnType<typeof useLinhasCampanha>) {
  const { active } = useCampaigns();
  const [state, setState] = useState<{ scope: string; items: CodexLink[]; error?: string }>(), [revision, setRevision] = useState(0);
  const scope = `${active?.campaign.id}:${active?.role}:${id}`;
  useEffect(() => {
    let alive = true;
    if (data.api && active) void data.api.links(active.campaign.id, id).then(
      items => { if (alive) setState({ scope, items }); },
      () => { if (alive) setState({ scope, items: [], error: 'Não foi possível carregar os vínculos. Verifique a conexão e as migrações do Compêndio.' }); });
    return () => { alive = false; };
  }, [data.api, scope, revision, data.items]);
  const atual = state?.scope === scope ? state : undefined;
  return { data, links: atual?.items ?? [], loaded: !!atual, error: atual?.error, reload: () => setRevision(v => v + 1) };
}

/** A divulgação de cada vínculo é feita em "Gerenciar conhecimento"; aqui só a remoção. */
export type ControlesVinculo = { busy: boolean; onRemover: (link: CodexLink) => void };

/** Mesma lista para mestre, jogador e prévia. Sem `controles`, mostra somente o que foi recebido. */
export function ListaVinculos({ links, rows, controles, onOpenContent, semAbrir = false }: { links: CodexLink[]; rows: readonly LinhaCompendio[]; controles?: ControlesVinculo; onOpenContent: (s: TabSpec) => void; /** No editor, o vínculo é só identificado: abrir descartaria o que está sendo editado. */ semAbrir?: boolean }) {
  const context = useAbrirEmAba();
  return <ul className="cd-relation-list">{links.map(link => {
      const spec = link.category === 'character' ? identidadeSpec(link.targetId, link.title) : registroSpec(link.targetId, link.title);
      // A miniatura vem da mesma linha autorizada das listas; a prévia usa o título devolvido pelo servidor.
      const row = rows.find(r => r.id === link.targetId) ?? { id: link.targetId, title: link.title, category: link.category, subtitle: '', body: '', spec };
      return <li key={link.id}>
        <button type="button" className="cd-relation" disabled={semAbrir} onClick={e => { if (!context.aoClicar(e, spec)) onOpenContent(spec); }} onAuxClick={e => context.aoBotaoDoMeio(e, spec)} onMouseDown={e => { if (e.button === 1) e.preventDefault(); }} onContextMenu={e => context.aoClicarDireito(e, spec)}>
          <ImagemLinha row={rows.length ? row : { ...row, entry: undefined, image: row.category === 'character' ? row.image : null }} size={40}/>
          <span><strong>{link.title}</strong><small>{link.relation} · {nomesCategoria[link.category]}</small></span>
        </button>
        {controles && <button className="cd-icon" disabled={controles.busy} aria-label={`Remover vínculo com ${link.title}`} onClick={() => controles.onRemover(link)}><Trash2 size={15}/></button>}
      </li>;
    })}</ul>;
}

export function NovoVinculoBotao({ id, vinculos, onAdicionar }: { id: string; vinculos: ReturnType<typeof useVinculos>; onAdicionar?: (source:string,target:string,relation:NovoVinculo,chosen:LinhaCompendio)=>void }) {
  const { active } = useCampaigns(), { data, links, reload } = vinculos;
  const [open, setOpen] = useState(false), [target, setTarget] = useState(''), [query, setQuery] = useState(''), [busy, setBusy] = useState(false), [error, setError] = useState('');
  const [relation, setRelation] = useState('related:a'), [custom, setCustom] = useState({ ida: '', volta: '' }), [revealed, setRevealed] = useState(false);
  const { lista } = useDefinicoes();
  const candidates = useMemo(() => open ? [...data.rows.filter(r => (r.entry || r.pc) && r.id !== id), ...(onAdicionar?[]:linhasDoCatalogo(data.rows, lista))] : [], [open, data.rows, id, lista, !!onAdicionar]);
  if (active?.role !== 'mestre') return null;
  const chosen = candidates.find(r => r.id === target);
  const rascunho = montarRelacao(relation, id, target, custom);
  const repetido = !!rascunho && links.some(l => l.targetId === target && l.kind === rascunho.kind && (rascunho.kind !== PERSONALIZADA || l.relation === custom.ida.trim()));
  const salvar = async () => {
    if (!data.api || !chosen) return;
    setBusy(true); setError('');
    try {
      if(onAdicionar) {
        const r=montarRelacao(relation,id,chosen.id,custom)!;
        onAdicionar(r.source,r.target,{kind:r.kind,label:r.label,inverse:r.inverse,revealed},chosen);
        setOpen(false);setTarget('');return;
      }
      const alvo = chosen.id.startsWith(CATALOGO) ? await garantirRegistro(data.api, active.campaign.id, data.items, 'item', chosen.id.slice(CATALOGO.length), false) : chosen.id;
      const r = montarRelacao(relation, id, alvo, custom)!;
      await data.api.link(active.campaign.id, r.source, r.target, { kind: r.kind, label: r.label, inverse: r.inverse, revealed });
      setOpen(false); setTarget(''); reload(); avisarConhecimento();
    } catch { setError('Não foi possível vincular. Confira a relação e a campanha e tente novamente.'); }
    finally { setBusy(false); }
  };
  return <>
    <button className="btn-link" onClick={() => setOpen(true)}><Plus size={15}/> Vincular registro</button>
    {open && <Modal titulo="Vincular registro" onFechar={() => setOpen(false)} ocupado={busy} acoes={<button className="btn-primary" disabled={!chosen || !rascunho || repetido || busy || data.loading || !!data.error} onClick={() => void salvar()}>Vincular</button>}>
      <div className="cd-form">
        <SeletorRegistro rows={candidates} selected={target} onSelect={setTarget} query={query} onQuery={setQuery} loading={data.loading} error={data.error}/>
        <label>Esta página é<select aria-label="Tipo de relação" value={relation} onChange={e => setRelation(e.target.value)}>{OPCOES_RELACAO.map(o => <option key={o.valor} value={o.valor}>{o.rotulo}</option>)}<option value={PERSONALIZADA}>Personalizada…</option></select></label>
        {relation === PERSONALIZADA && <>
          <label>Relação<input value={custom.ida} maxLength={80} placeholder="Como esta página se relaciona" onChange={e => setCustom(c => ({ ...c, ida: e.target.value }))}/></label>
          <label>Relação inversa<input value={custom.volta} maxLength={80} placeholder="Como aparece no outro registro" onChange={e => setCustom(c => ({ ...c, volta: e.target.value }))}/></label>
        </>}
        <label className="cd-check"><input type="checkbox" checked={revealed} onChange={e => setRevealed(e.target.checked)}/> Revelar este vínculo aos jogadores</label>
        <p className="muted">O vínculo não revela o registro de destino nem entrega itens.</p>
        {repetido && <p role="status">Essa relação já existe.</p>}
        {error && <Aviso erro t={error}/>}
      </div>
    </Modal>}
  </>;
}

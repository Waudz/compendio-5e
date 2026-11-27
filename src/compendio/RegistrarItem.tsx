/** Descobertas → registrar um item que já existe (do catálogo ou referenciado), mesmo já em posse de alguém. */
import { useMemo, useState } from 'react';
import { ScrollText } from 'lucide-react';
import { useCampaigns } from '../CampaignsContext';
import { Aviso } from '../Diario';
import { Modal } from '../ui/Modal';
import { useLinhasCampanha } from './consulta';
import { linhasDoCatalogo } from './Vinculos';
import { SeletorRegistro } from './SeletorRegistro';
import { garantirRegistro } from './RegistrosCampanha';
import { registroSpec } from './navegacao';
import { useDefinicoes } from './definicoes';
import type { TabSpec } from '../workspace';

export function RegistrarItemExistente({ onOpenContent }: { onOpenContent: (s: TabSpec) => void }) {
  const { active } = useCampaigns(), data = useLinhasCampanha();
  const [open, setOpen] = useState(false), [selected, setSelected] = useState(''), [query, setQuery] = useState(''), [busy, setBusy] = useState(false), [error, setError] = useState('');
  const { lista } = useDefinicoes();
  const rows = useMemo(() => open ? [...data.rows.filter(r => r.entry?.category === 'item' && r.entry.registered === false), ...linhasDoCatalogo(data.rows, lista)] : [], [open, data.rows, lista]);
  const chosen = rows.find(r => r.id === selected);
  const registrar = () => {
    if (!data.api || !active || !chosen) return;
    const definition = chosen.entry?.definitionId ?? chosen.spec.ref;
    setBusy(true); setError('');
    garantirRegistro(data.api, active.campaign.id, data.items, 'item', definition).then(
      id => { setBusy(false); setOpen(false); setSelected(''); data.refresh(); onOpenContent(registroSpec(id)); },
      e => { setBusy(false); setError(e instanceof Error ? e.message : 'Não foi possível registrar.'); });
  };
  return <>
    <button type="button" className="btn-secondary" disabled={!!data.error || data.loading} onClick={() => setOpen(true)}><ScrollText size={15} aria-hidden="true"/> Registrar item</button>
    {open && <Modal titulo="Registrar item como descoberta" onFechar={() => setOpen(false)} ocupado={busy} acoes={<button className="btn-primary" disabled={!chosen || busy} onClick={registrar}>Registrar como descoberta</button>}>
      <div className="cd-form">
        <p className="muted">A página nasce secreta, ligada à definição do item. Nada é entregue ao inventário.</p>
        <SeletorRegistro rows={rows} selected={selected} onSelect={setSelected} query={query} onQuery={setQuery} loading={data.loading} error={data.error}/>
        {error && <Aviso erro t={error}/>}
      </div>
    </Modal>}
  </>;
}

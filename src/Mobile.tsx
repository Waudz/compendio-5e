import { Actions, type Model, TabNode } from "flexlayout-react";
import { X } from "lucide-react";
import { Panel } from "./Panel";
import { activeGroup, closeTab, groups, type Kind, type TabSpec } from "./workspace";

/** Celular: sem arraste nem colunas lado a lado. Mostra só o grupo ativo (abas + conteúdo); os outros grupos ficam acessíveis por seletor. */
export function Mobile({ model, onOpen, onChange }: { model: Model; onOpen: (s: TabSpec) => void; onChange: () => void }) {
  const all = groups(model), group = activeGroup(model);
  const selected = group?.getSelectedNode();
  const tabs = (group?.getChildren() ?? []).filter((c): c is TabNode => c instanceof TabNode);
  const act = (a: ReturnType<typeof Actions.selectTab>) => { model.doAction(a); onChange(); };
  return <div className="mobile">
    {all.length > 1 && <div className="m-groups" role="group" aria-label="Colunas">{all.map((g, i) =>
      <button key={g.getId()} aria-pressed={g === group} onClick={() => act(Actions.setActiveTabset(g.getId()))}>Coluna {i + 1}</button>)}</div>}
    <div className="m-tabs" role="tablist">{tabs.map(t => <div key={t.getId()} className={t === selected ? "m-tab active" : "m-tab"}>
      <button role="tab" aria-selected={t === selected} onClick={() => act(Actions.selectTab(t.getId()))}>{t.getName()}</button>
      <button className="x" aria-label={`Fechar ${t.getName()}`} onClick={() => { closeTab(model, t.getId()); onChange(); }}><X size={14}/></button>
    </div>)}</div>
    {selected instanceof TabNode
      ? <Panel key={selected.getId()} kind={selected.getConfig().kind as Kind} entity={selected.getConfig().ref} onOpen={onOpen}/>
      : <div className="empty"><h1>Área de trabalho</h1><p>Escolha uma seção no menu.</p></div>}
  </div>;
}

import { Actions, type Model, TabNode } from "flexlayout-react";
import { MoreHorizontal, Pin, Plus, X } from "lucide-react";
import { useLongPress } from "./NavItem";
import { isPinned, type NavMode } from "./navigation";
import { Panel } from "./Panel";
import { OrigemAbaContext } from "./abrirEmAba";
import { activeGroup, groups, type Kind, type TabSpec } from "./workspace";

type Props = {
  model: Model; onChange: () => void; titleOf: (t: TabNode) => string;
  onOpen: (s: TabSpec, mode?: NavMode) => void;
  onOpenContent: (s: TabSpec, originTabId?: string) => void;
  onClose: (tabId: string) => void;                                  // já protegido contra alterações não salvas
  onTabMenu: (t: TabNode, x: number, y: number) => void;
  onNewTab: (x: number, y: number) => void;
};

/** Uma aba do celular: toque seleciona; toque prolongado e o botão "Opções" abrem o mesmo menu (sem depender do toque prolongado). */
function MobileTab({ tab, active, title, onSelect, onMenu, onClose }: { tab: TabNode; active: boolean; title: string; onSelect: () => void; onMenu: (x: number, y: number) => void; onClose: () => void }) {
  const lp = useLongPress(onMenu), pinned = isPinned(tab);
  return <div className={`${active ? "m-tab active" : "m-tab"}${pinned ? " pinned" : ""}`}>
    <button role="tab" aria-selected={active} {...lp.handlers} onContextMenu={e => { e.preventDefault(); onMenu(e.clientX, e.clientY); }}
      onClick={() => { if (!lp.consumeClick()) onSelect(); }}>
      {pinned && <Pin size={12} className="pin-icon" aria-hidden="true"/>}{title}{pinned && <span className="sr-only"> (fixada)</span>}
    </button>
    <button className="opt" aria-label={`Opções de ${title}`} onClick={e => { const r = e.currentTarget.getBoundingClientRect(); onMenu(r.left, r.bottom); }}><MoreHorizontal size={14}/></button>
    <button className="x" aria-label={`Fechar ${title}`} onClick={onClose}><X size={14}/></button>
  </div>;
}

/** Celular: sem arraste nem colunas lado a lado. Mostra só o grupo ativo (abas + conteúdo); os outros grupos ficam acessíveis por seletor. */
export function Mobile({ model, onOpen, onOpenContent, onChange, titleOf, onClose, onTabMenu, onNewTab }: Props) {
  const all = groups(model), group = activeGroup(model);
  const selected = group?.getSelectedNode();
  const tabs = (group?.getChildren() ?? []).filter((c): c is TabNode => c instanceof TabNode);
  const act = (a: ReturnType<typeof Actions.selectTab>) => { model.doAction(a); onChange(); };
  return <div className={all.length > 1 ? "mobile has-groups" : "mobile"}><div className="m-head">
    {all.length > 1 && <div className="m-groups" role="group" aria-label="Colunas">{all.map((g, i) =>
      <button key={g.getId()} aria-pressed={g === group} onClick={() => act(Actions.setActiveTabset(g.getId()))}>Coluna {i + 1}</button>)}</div>}
    <div className="m-tabs" role="tablist">
      {tabs.map(t => <MobileTab key={t.getId()} tab={t} active={t === selected} title={titleOf(t)} onSelect={() => act(Actions.selectTab(t.getId()))}
        onMenu={(x, y) => onTabMenu(t, x, y)} onClose={() => onClose(t.getId())}/>)}
      <button className="m-new" aria-label="Nova aba" onClick={e => { const r = e.currentTarget.getBoundingClientRect(); onNewTab(r.left, r.bottom); }}><Plus size={14}/><span>Nova aba</span></button>
    </div>
    </div>
    {selected instanceof TabNode
      ? <OrigemAbaContext.Provider value={selected.getId()}><Panel key={selected.getId()} kind={selected.getConfig().kind as Kind} entity={selected.getConfig().ref} onOpen={onOpen} onOpenContent={s => onOpenContent(s, selected.getId())}/></OrigemAbaContext.Provider>
      : <div className="empty"><h1>Área de trabalho</h1><p>Escolha uma seção no menu.</p></div>}
  </div>;
}

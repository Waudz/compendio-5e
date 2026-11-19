// Estado e operações puras do workspace (sem React, sem localStorage).
// O layout é SEMPRE: linha raiz -> de 1 a 3 grupos (tabsets) lado a lado -> abas.
// Nunca há linha dentro de coluna (grupos empilhados), popout, flutuantes ou bordas.
import { BookOpen, Castle, FileText, ScrollText, Shield, Swords, Users } from "lucide-react";
import { Actions, DockLocation, Model, TabNode, TabSetNode, type DropInfo, type IJsonModel, type IJsonTabNode, type IJsonTabSetNode, type Node } from "flexlayout-react";

export const MAX_GROUPS = 3;
export const MIN_GROUP_WIDTH = 220;

export type Kind = "secao" | "conta" | "campanha" | "ficha" | "npc" | "documento";
export type TabSpec = { kind: Kind; ref: string; title?: string };
export type Page = "campanhas" | "personagens" | "iniciativa" | "encontros" | "enciclopedia" | "compendio" | "documentos";

export const sections: { page: Page; title: string; icon: typeof Users }[] = [
  { page: "campanhas", title: "Campanhas", icon: Castle },
  { page: "personagens", title: "Personagens", icon: Users },
  { page: "iniciativa", title: "Iniciativa", icon: Swords },
  { page: "encontros", title: "Encontros", icon: Shield },
  { page: "enciclopedia", title: "Enciclopédia", icon: BookOpen },
  { page: "compendio", title: "Compêndio", icon: ScrollText },
  { page: "documentos", title: "Documentos", icon: FileText },
];
export const kinds: Kind[] = ["secao", "conta", "campanha", "ficha", "npc", "documento"];
const kindLabel: Record<Kind, string> = { secao: "", conta: "Conta", campanha: "Campanha", ficha: "Ficha", npc: "NPC", documento: "Documento" };

/** Id próprio da aba: `kind:ref` (ex.: secao:personagens, ficha:lydia). Uma entidade = uma aba. */
export const tabId = (s: Pick<TabSpec, "kind" | "ref">) => `${s.kind}:${s.ref}`;
export const parseTabId = (id: unknown): { kind: Kind; ref: string } | null => {
  if (typeof id !== "string") return null;
  const i = id.indexOf(":");
  const kind = id.slice(0, i) as Kind, ref = id.slice(i + 1);
  if (i < 1 || !kinds.includes(kind) || !/^[\w-]{1,64}$/.test(ref)) return null;
  if (kind === "secao" && !sections.some(s => s.page === ref)) return null;
  return { kind, ref };
};
export const defaultTitle = (s: TabSpec) =>
  s.title?.trim().slice(0, 40) || (s.kind === "conta" ? "Conta" : s.kind === "campanha" ? "Campanha" : s.kind === "secao" ? sections.find(x => x.page === s.ref)?.title ?? s.ref : `${kindLabel[s.kind]} ${s.ref}`);

const global: IJsonModel["global"] = {
  tabEnableClose: true, tabEnableRename: false, tabEnablePopout: false, tabEnablePopoutIcon: false, tabEnableFloat: false,
  tabEnablePin: false, tabSetEnableMaximize: false, tabSetEnableTabGroups: false, tabSetEnableDivide: true,
  tabSetEnableClose: true, tabSetMinWidth: MIN_GROUP_WIDTH, tabSetEnableDeleteWhenEmpty: true,
  enableEdgeDock: true, enableEdgeDockIndicators: true,
};

const tabJson = (s: TabSpec): IJsonTabNode => ({ type: "tab", id: tabId(s), name: defaultTitle(s), component: s.kind, config: { kind: s.kind, ref: s.ref } });
export const defaultLayout = (): IJsonModel => ({
  global,
  borders: [],
  layout: { type: "row", children: [{ type: "tabset", id: "grupo-1", weight: 100, active: true, selected: 0, children: [tabJson({ kind: "secao", ref: "personagens" })] }] },
});

/** true se o JSON respeita a restrição de produto: só colunas, 1 a 3 grupos, sem nada fora do layout principal. */
export function isColumnsOnly(json: IJsonModel): boolean {
  const kids = json.layout.children ?? [];
  const empty = (o?: object) => !o || Object.keys(o).length === 0;
  return empty(json.subLayouts) && empty(json.popouts) && !(json.borders?.length)
    && kids.length >= 1 && kids.length <= MAX_GROUPS
    && kids.every(k => k.type === "tabset" && (k.children ?? []).every(t => t.type === "tab"));
}

/** Aceita qualquer coisa vinda do disco e devolve um layout limpo e válido, ou null se irrecuperável. */
export function sanitizeLayout(data: unknown): IJsonModel | null {
  const root = (data as { layout?: unknown } | null)?.layout as { children?: unknown } | undefined;
  if (!root || typeof root !== "object" || !Array.isArray(root.children)) return null;
  // Aceita também linhas aninhadas (layout antigo/corrompido): achata para colunas coletando os grupos.
  const sets: Record<string, unknown>[] = [];
  const walk = (n: unknown) => {
    const o = n as { type?: string; children?: unknown[] } | null;
    if (!o || typeof o !== "object") return;
    if (o.type === "tabset") sets.push(o as Record<string, unknown>);
    else if (o.type === "row" && Array.isArray(o.children)) o.children.forEach(walk);
  };
  root.children.forEach(walk);
  const seen = new Set<string>();
  const groups: IJsonTabSetNode[] = [];
  for (const s of sets) {
    const tabs: IJsonTabNode[] = [];
    const flat = (Array.isArray(s.children) ? s.children : []).flatMap(c => (c as { type?: string; children?: unknown[] })?.type === "tab-group" ? ((c as { children?: unknown[] }).children ?? []) : [c]);
    for (const t of flat as { id?: unknown; name?: unknown }[]) {
      const p = parseTabId(t?.id);
      if (!p || seen.has(`${p.kind}:${p.ref}`)) continue;
      seen.add(`${p.kind}:${p.ref}`);
      tabs.push(tabJson({ ...p, title: typeof t.name === "string" ? t.name : undefined }));
    }
    if (!tabs.length) continue;
    const w = Number(s.weight);
    const sel = Number(s.selected);
    groups.push({ type: "tabset", id: typeof s.id === "string" && /^[\w-]{1,40}$/.test(s.id) ? s.id : undefined, weight: Number.isFinite(w) && w > 0 ? w : 100 / sets.length,
      selected: Number.isInteger(sel) && sel >= 0 && sel < tabs.length ? sel : 0, active: s.active === true, children: tabs });
  }
  if (!groups.length) return { ...defaultLayout(), layout: { type: "row", children: [{ type: "tabset", id: "grupo-1", weight: 100, active: true, children: [] }] } };
  // Mais de 3 grupos: funde o excedente no último grupo mantido.
  while (groups.length > MAX_GROUPS) { const extra = groups.pop()!; groups[MAX_GROUPS - 1].children!.push(...extra.children!); groups[MAX_GROUPS - 1].weight! += extra.weight!; }
  const ids = new Set<string>();
  groups.forEach((g, i) => { if (!g.id || ids.has(g.id)) g.id = `grupo-${i + 1}-${Math.random().toString(36).slice(2, 7)}`; ids.add(g.id); });
  let found = false;
  groups.forEach(g => { if (g.active && found) g.active = false; found ||= !!g.active; });
  if (!found) groups[0].active = true;
  return { global, borders: [], layout: { type: "row", children: groups } };
}

export function createModel(json: IJsonModel = defaultLayout()): Model {
  const model = Model.fromJson(json);
  model.setOnAllowDrop((drag, info) => allowDrop(model, drag, info));
  return model;
}

export const groups = (m: Model): TabSetNode[] => (m.getRootRow()?.getChildren() ?? []).filter((n): n is TabSetNode => n instanceof TabSetNode);
export const groupCount = (m: Model) => groups(m).length;

/** Soltura permitida? Nunca em cima/embaixo; esquerda/direita só se não passar de 3 grupos. */
export function allowDrop(model: Model, drag: Node, info: Pick<DropInfo, "location">): boolean {
  if (info.location === DockLocation.TOP || info.location === DockLocation.BOTTOM) return false;
  if (info.location === DockLocation.CENTER) return true;
  // Esquerda/direita cria um grupo, a não ser que o arrastado seja o único conteúdo do seu grupo (ele só se reposiciona).
  const parent = drag instanceof TabNode ? drag.getParent() : undefined;
  const consumesGroup = drag instanceof TabSetNode || (parent instanceof TabSetNode && parent.getChildren().length === 1);
  return groupCount(model) - (consumesGroup ? 1 : 0) + 1 <= MAX_GROUPS;
}

export const findTab = (m: Model, id: string) => { const n = m.getNodeById(id); return n instanceof TabNode ? n : undefined; };
export const activeGroup = (m: Model): TabSetNode | undefined => m.getActiveTabset() ?? groups(m)[0];

/** Abre (ou foca) uma aba. Já aberta: seleciona onde está. Nova: entra no grupo ativo, sem tirar nenhuma outra aba. */
export function openTab(m: Model, spec: TabSpec): void {
  const id = tabId(spec);
  const existing = findTab(m, id);
  if (existing) {
    const t = spec.title?.trim().slice(0, 40);
    if (t && t !== existing.getName()) m.doAction(Actions.renameTab(id, t)); // ex.: campanha renomeada
    m.doAction(Actions.selectTab(id)); const g = existing.getParent(); if (g) m.doAction(Actions.setActiveTabset(g.getId())); return; }
  const g = activeGroup(m);
  if (!g) return;
  m.doAction(Actions.addTab(tabJson(spec), g.getId(), DockLocation.CENTER, -1, true));
  m.doAction(Actions.setActiveTabset(g.getId()));
}

/** Move a aba para outro grupo existente (no fim). */
export function moveToGroup(m: Model, id: string, groupId: string): void {
  if (findTab(m, id)?.getParent()?.getId() === groupId) return;
  m.doAction(Actions.moveNode(id, groupId, DockLocation.CENTER, -1, true));
}

/** Move a aba para uma nova coluna na extremidade esquerda/direita. Devolve false se o limite de 3 impede. */
export function moveToNewColumn(m: Model, id: string, side: "left" | "right"): boolean {
  const tab = findTab(m, id), edge = groups(m)[side === "left" ? 0 : groupCount(m) - 1];
  if (!tab || !edge) return false;
  const loc = side === "left" ? DockLocation.LEFT : DockLocation.RIGHT;
  if (!allowDrop(m, tab, { location: loc })) return false;
  const alone = (tab.getParent() as TabSetNode).getChildren().length === 1;
  if (alone && tab.getParent() === edge) return false; // nada a fazer
  m.doAction(Actions.moveNode(id, edge.getId(), loc, -1, true));
  return true;
}

export const closeTab = (m: Model, id: string) => { if (findTab(m, id)) m.doAction(Actions.deleteTab(id)); };
export const closeGroup = (m: Model, groupId: string) => { if (m.getNodeById(groupId) instanceof TabSetNode) m.doAction(Actions.deleteTabset(groupId)); };
export const closeOthers = (m: Model, id: string) => {
  const g = findTab(m, id)?.getParent();
  g?.getChildren().filter(c => c.getId() !== id).forEach(c => m.doAction(Actions.deleteTab(c.getId())));
};

// Estado e operações puras do workspace (sem React, sem localStorage).
// O layout é SEMPRE: linha raiz -> de 1 a 3 grupos (tabsets) lado a lado -> abas.
// Nunca há linha dentro de coluna (grupos empilhados), popout, flutuantes ou bordas.
import { BookMarked, BookOpen, Castle, ClipboardList, FileText, ScrollText, Shield, Swords, Users } from "lucide-react";
import { Action, Actions, DockLocation, Model, RowNode, TabNode, TabSetNode, type DropInfo, type IJsonModel, type IJsonTabNode, type IJsonTabSetNode, type Node } from "flexlayout-react";

export const MAX_GROUPS = 3;
export const MIN_GROUP_WIDTH = 220;

// Um único lugar define os tipos de aba: para criar um novo (ex.: cena, encontro) basta acrescentar uma linha aqui e o painel correspondente.
const kindLabel = { secao: "", conta: "Conta", campanha: "Campanha", ficha: "Ficha", npc: "NPC", documento: "Documento", item: "Item", magia: "Magia", criador: "Personagem" } as const;
export type Kind = keyof typeof kindLabel;
export type TabSpec = { kind: Kind; ref: string; title?: string; pinned?: boolean; instance?: number };
export type Page = "campanhas" | "planejamento" | "diario" | "personagens" | "iniciativa" | "encontros" | "enciclopedia" | "compendio" | "documentos";

export type Section = { page: Page; title: string; icon: typeof Users; masterOnly?: boolean };
/** Itens do menu principal. "Campanhas" NÃO está aqui: a gestão de campanhas fica no seletor junto à campanha ativa (ver `campaignsHub`). */
export const sections: Section[] = [
  { page: "personagens", title: "Personagens", icon: Users },
  { page: "planejamento", title: "Anotações", icon: ClipboardList },
  { page: "diario", title: "Diário", icon: BookMarked },
  { page: "iniciativa", title: "Iniciativa", icon: Swords },
  { page: "encontros", title: "Encontros", icon: Shield },
  { page: "enciclopedia", title: "Enciclopédia", icon: BookOpen },
  { page: "compendio", title: "Compêndio", icon: ScrollText },
  { page: "documentos", title: "Documentos", icon: FileText },
];
/** Gestão de campanhas (criar, entrar, ativar): continua sendo uma seção válida (abas salvas, convites, seletor), mas não é item do menu principal do desktop. */
export const campaignsHub: Section = { page: "campanhas", title: "Campanhas", icon: Castle };
const knownSections: Section[] = [campaignsHub, ...sections];
/** Seções do menu para o papel atual. Anotações são acessíveis a ambos os papéis. */
export const visibleSections = (isMaster: boolean): Section[] => sections.filter(s => s.page !== "enciclopedia" && s.page !== "documentos" && (!s.masterOnly || isMaster));
/** Ordem do menu do desktop por papel (Início vem antes, separado). Sem campanha ativa (papel null) mantém todas as seções comuns. */
const menuOrder: Record<"mestre" | "jogador", Page[]> = {
  mestre: ["planejamento", "diario", "iniciativa", "encontros", "personagens", "compendio"],
  jogador: ["planejamento", "personagens", "diario", "compendio"],
};
export const desktopSections = (role: "mestre" | "jogador" | null): Section[] => role ? menuOrder[role].map(p => sections.find(s => s.page === p)!) : visibleSections(false);
export const kinds = Object.keys(kindLabel) as Kind[];

/** Id próprio da aba: `kind:ref` (ex.: secao:personagens, ficha:lydia). Uma entidade = uma aba. */
export const tabId = (s: Pick<TabSpec, "kind" | "ref" | "instance">) => `${s.kind}:${s.ref}${s.kind === "secao" && s.ref === "planejamento" && s.instance && s.instance > 1 ? `~${s.instance}` : ""}`;
export const parseTabId = (id: unknown): { kind: Kind; ref: string } | null => {
  if (typeof id !== "string") return null;
  const i = id.indexOf(":");
  const kind = id.slice(0, i) as Kind, rawRef = id.slice(i + 1);
  const match = kind === "secao" ? /^planejamento~([2-9][0-9]*)$/.exec(rawRef) : null;
  const instance = match ? Number(match[1]) : undefined;
  const ref = match ? "planejamento" : rawRef;
  if (i < 1 || !kinds.includes(kind) || !/^[\w-]{1,64}$/.test(ref)) return null;
  if (kind === "secao" && !knownSections.some(s => s.page === ref)) return null;
  return { kind, ref, ...(instance && Number.isSafeInteger(instance) ? { instance } : {}) };
};
export const defaultTitle = (s: TabSpec) =>
  s.title?.trim().slice(0, 40) || (s.kind === "conta" ? "Conta" : s.kind === "campanha" ? "Campanha" : s.kind === "secao" ? knownSections.find(x => x.page === s.ref)?.title ?? s.ref : `${kindLabel[s.kind]} ${s.ref}`);

const global: IJsonModel["global"] = {
  tabEnableClose: true, tabEnableRename: false, tabEnablePopout: false, tabEnablePopoutIcon: false, tabEnableFloat: false,
  tabEnablePin: false, tabSetEnableMaximize: false, tabSetEnableTabGroups: false, tabSetEnableDivide: true,
  tabSetEnableClose: true, tabSetMinWidth: MIN_GROUP_WIDTH, tabSetEnableDeleteWhenEmpty: true,
  enableEdgeDock: true, enableEdgeDockIndicators: true,
};

export const tabJson = (s: TabSpec): IJsonTabNode => ({ type: "tab", id: tabId(s), name: defaultTitle(s), component: s.kind, config: { kind: s.kind, ref: s.ref, ...(s.pinned ? { pinned: true } : {}) } });
export const defaultLayout = (): IJsonModel => ({
  global,
  borders: [],
  layout: { type: "row", children: [{ type: "tabset", id: "grupo-1", weight: 100, active: true, selected: 0, children: [tabJson({ kind: "secao", ref: "personagens" })] }] },
});

/** Layout sem nenhuma aba (um painel vazio). */
export const emptyLayout = (): IJsonModel => ({ ...defaultLayout(), layout: { type: "row", children: [{ type: "tabset", id: "grupo-1", weight: 100, active: true, children: [] }] } });
/** Primeira vez numa campanha (sem layout salvo): o espaço de trabalho nasce só com o Início, que é uma aba comum (pode ser fechada, movida e não reabre sozinha). */
export function firstVisitModel(campaignId: string, title?: string): Model {
  const m = createModel(emptyLayout());
  openTab(m, { kind: "campanha", ref: campaignId, title });
  return m;
}

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
    for (const t of flat as { id?: unknown; name?: unknown; pinned?: unknown }[]) {
      const p = parseTabId(t?.id);
      if (!p || seen.has(tabId(p))) continue;
      seen.add(tabId(p));
      tabs.push(tabJson({ ...p, pinned: t.pinned === true }));   // nomes guardados são ignorados: o layout persiste só ids
    }
    // Painel vazio só é mantido se já veio vazio (criado de propósito por divisão); grupo cujas abas eram todas inválidas é descartado.
    if (!tabs.length && flat.length > 0) continue;
    const w = Number(s.weight);
    const sel = Number(s.selected);
    groups.push({ type: "tabset", id: typeof s.id === "string" && /^[\w-]{1,40}$/.test(s.id) ? s.id : undefined, weight: Number.isFinite(w) && w > 0 ? w : 100 / sets.length,
      selected: Number.isInteger(sel) && sel >= 0 && sel < tabs.length ? sel : 0, active: s.active === true, children: tabs,
      ...(tabs.length ? {} : { enableDeleteWhenEmpty: false }) });   // vazio intencional: não é apagado automaticamente
  }
  if (!groups.some(g => g.children!.length) ) return { ...defaultLayout(), layout: { type: "row", children: [{ type: "tabset", id: "grupo-1", weight: 100, active: true, children: [] }] } };
  // Mais de 3 grupos: descarta primeiro painéis vazios, depois funde o excedente no último grupo mantido.
  while (groups.length > MAX_GROUPS && groups.some(g => !g.children!.length)) groups.splice(groups.map(g => !g.children!.length).lastIndexOf(true), 1);
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

/** Painel vazio criado DE PROPÓSITO por divisão: sem abas e com `enableDeleteWhenEmpty: false` (atributo documentado do FlexLayout). */
export const isIntentionalEmpty = (g: TabSetNode) => g.getChildren().length === 0 && !g.isEnableDeleteWhenEmpty();

/**
 * Painéis vazios são apagados por padrão (fechar a última aba de uma coluna remove a coluna). Só a divisão da aba única
 * os mantém, marcando o painel de origem com `enableDeleteWhenEmpty: false`. Assim que o painel recebe uma aba, volta a ser
 * um painel normal (flag restaurada): fechar a última aba dele o remove. Devolve true se corrigiu algo.
 */
export function normalizeEmptyPanels(m: Model): boolean {
  const filled = groups(m).filter(g => g.getChildren().length > 0 && !g.isEnableDeleteWhenEmpty());
  filled.forEach(g => m.doAction(Actions.updateNodeAttributes(g.getId(), { enableDeleteWhenEmpty: true })));
  return filled.length > 0;
}

export type DropVerdict = { allowed: boolean; keepSource: boolean };
const no: DropVerdict = { allowed: false, keepSource: false };

/**
 * Única fonte de verdade sobre soltura (indicadores do FlexLayout, menu e ação final usam a mesma função):
 * nunca em cima/embaixo; esquerda/direita criam colunas até 3; uma operação que não muda o layout NÃO é oferecida;
 * a aba ÚNICA solta na lateral do próprio painel divide a tela (`keepSource`): o painel de origem fica vazio de propósito.
 */
export function classifyDrop(model: Model, drag: Node, target: Node | undefined, location: DockLocation): DropVerdict {
  if (location === DockLocation.TOP || location === DockLocation.BOTTOM) return no;
  if (location === DockLocation.CENTER) return { allowed: true, keepSource: false };
  const gs = groups(model), n = gs.length;
  const source = drag instanceof TabSetNode ? drag : drag instanceof TabNode && drag.getParent() instanceof TabSetNode ? (drag.getParent() as TabSetNode) : undefined;
  const sole = drag instanceof TabNode && !!source && source.getChildren().length === 1;
  const left = location === DockLocation.LEFT;
  // Grupo-alvo: o próprio painel alvo, ou a extremidade quando o alvo é a linha raiz (encaixe na borda da área).
  const targetGroup = target instanceof TabSetNode ? target : target instanceof RowNode ? (left ? gs[0] : gs[n - 1]) : undefined;
  if (!source || !targetGroup) return { allowed: n + (sole ? 0 : drag instanceof TabSetNode ? -1 : 0) + 1 <= MAX_GROUPS, keepSource: false };
  const i = gs.indexOf(source), j = gs.indexOf(targetGroup);
  const onEdge = target instanceof RowNode;
  const ownSide = onEdge ? i === (left ? 0 : n - 1) : source === targetGroup;
  if (drag instanceof TabSetNode) {                       // mover o painel inteiro: só reordena
    if (ownSide) return no;
    if (!onEdge && ((left && j - 1 === i) || (!left && j + 1 === i))) return no;   // já está nessa posição
    return { allowed: true, keepSource: false };
  }
  if (!sole) return { allowed: n + 1 <= MAX_GROUPS, keepSource: false };            // aba de painel com várias abas: cria painel novo
  if (ownSide) return { allowed: n + 1 <= MAX_GROUPS, keepSource: true };           // divisão com aba única: o painel de origem permanece (vazio)
  if (!onEdge && ((left && j - 1 === i) || (!left && j + 1 === i))) return no;     // já está nessa posição
  return { allowed: true, keepSource: false };                                      // reposiciona: o painel esvaziado é removido
}

/** Compatível com o FlexLayout (`setOnAllowDrop`): `info` traz o alvo e o local. */
export function allowDrop(model: Model, drag: Node, info: Pick<DropInfo, "location"> & { node?: Node }): boolean {
  return classifyDrop(model, drag, info.node, info.location).allowed;
}

/**
 * Chamado para cada MOVE_NODE antes de aplicar. Recusa (undefined) movimento que o modelo não aceitaria e, na divisão da aba
 * única, devolve uma ação ATÔMICA que mantém o painel de origem vazio e o torna o painel ativo (pronto para receber a próxima
 * seção). As demais ações passam intactas.
 */
export function prepareMove(model: Model, action: Action): Action | undefined {
  if (action.type !== Actions.MOVE_NODE) return action;
  const d = action.data as { fromNode: string; toNode: string; location: string; index?: number; select?: boolean };
  const from = model.getNodeById(d.fromNode), to = model.getNodeById(d.toNode), loc = DockLocation.values.get(d.location);
  if (!from || !to || !loc) return action;
  const v = classifyDrop(model, from, to, loc);
  if (!v.allowed) return undefined;
  if (!v.keepSource) return action;
  const sourceId = (from as TabNode).getParent()!.getId();
  return Actions.group([Actions.updateNodeAttributes(sourceId, { enableDeleteWhenEmpty: false }), action, Actions.setActiveTabset(sourceId)]);
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

/** A aba pode ir para uma nova coluna na extremidade? (mesma regra dos indicadores de arraste) */
export function canMoveToNewColumn(m: Model, id: string, side: "left" | "right"): boolean {
  const tab = findTab(m, id), edge = groups(m)[side === "left" ? 0 : groupCount(m) - 1];
  return !!tab && !!edge && classifyDrop(m, tab, edge, side === "left" ? DockLocation.LEFT : DockLocation.RIGHT).allowed;
}

/** Move a aba para uma nova coluna na extremidade esquerda/direita. Aba única do painel da extremidade divide a tela. Devolve false se não for possível. */
export function moveToNewColumn(m: Model, id: string, side: "left" | "right"): boolean {
  const tab = findTab(m, id), edge = groups(m)[side === "left" ? 0 : groupCount(m) - 1];
  if (!tab || !edge || !canMoveToNewColumn(m, id, side)) return false;
  const action = prepareMove(m, Actions.moveNode(id, edge.getId(), side === "left" ? DockLocation.LEFT : DockLocation.RIGHT, -1, true));
  if (!action) return false;
  m.doAction(action);
  normalizeEmptyPanels(m);
  return true;
}

export const closeTab = (m: Model, id: string) => { if (findTab(m, id)) m.doAction(Actions.deleteTab(id)); };
export const closeGroup = (m: Model, groupId: string) => { if (m.getNodeById(groupId) instanceof TabSetNode) m.doAction(Actions.deleteTabset(groupId)); };
export const closeOthers = (m: Model, id: string) => {
  const g = findTab(m, id)?.getParent();
  g?.getChildren().filter(c => c.getId() !== id).forEach(c => m.doAction(Actions.deleteTab(c.getId())));
};

// Navegação por abas (puro, sem React): preservar abas, abrir consultas em grupos e fixar/desafixar.
// Fixação é propriedade da própria aba (`config.pinned`), não o atributo nativo do FlexLayout: o nativo agrupa as fixadas no
// início, impede fechá-las pela interface e impede arrastá-las para fora do painel, o que contraria as decisões aprovadas.
import { Actions, DockLocation, type Model, TabNode, TabSetNode } from "flexlayout-react";
import { activeGroup, findTab, groupCount, groups, MAX_GROUPS, tabId, tabJson, type TabSpec } from "./workspace";

export type NavMode = "reuse" | "new" | "newPinned";
export type NavResult = { action: "selected" | "replaced" | "created"; tabId: string };

export const isPinned = (t: TabNode) => (t.getConfig() as { pinned?: boolean } | undefined)?.pinned === true;

export function setPinned(m: Model, id: string, pinned: boolean): void {
  const t = findTab(m, id);
  if (!t || isPinned(t) === pinned) return;
  const config = { ...(t.getConfig() as Record<string, unknown>) };
  if (pinned) config.pinned = true; else delete config.pinned;
  m.doAction(Actions.updateNodeAttributes(id, { config }));
}

const tabsOf = (g: TabSetNode) => g.getChildren().filter((c): c is TabNode => c instanceof TabNode);

/** Seleciona a aba que já representa o registro (e atualiza o título, ex.: campanha renomeada). Não altera a fixação. */
function focusExisting(m: Model, existing: TabNode, spec: TabSpec): void {
  const title = spec.title?.trim().slice(0, 40);
  if (title && title !== existing.getName()) m.doAction(Actions.renameTab(existing.getId(), title));
  m.doAction(Actions.selectTab(existing.getId()));
  const g = existing.getParent(); if (g) m.doAction(Actions.setActiveTabset(g.getId()));
}

/** Navegação pelo menu: foca a aba existente ou cria outra sem remover nenhuma.
 * O parâmetro legado isDirty é preservado para compatibilidade com os chamadores.
 */
export function navigate(m: Model, spec: TabSpec, mode: NavMode = "reuse", isDirty: (id: string) => boolean = () => false): NavResult {
  void isDirty;
  // Anotações: cada comando "nova aba" deve criar uma instância independente,
  // mesmo quando a seção já está aberta em outro grupo.
  if (spec.kind === "secao" && spec.ref === "planejamento" && mode !== "reuse") {
    let instance = 2;
    while (findTab(m, tabId({ ...spec, instance }))) instance++;
    spec = { ...spec, instance };
  }
  const id = tabId(spec);
  const existing = findTab(m, id);
  if (existing) {
    focusExisting(m, existing, spec);
    if (mode === "newPinned") setPinned(m, id, true);
    return { action: "selected", tabId: id };
  }
  const group = activeGroup(m);
  if (!group) return { action: "selected", tabId: id };
  const pinned = mode === "newPinned";
  const json = tabJson({ ...spec, pinned });
  m.doAction(Actions.addTab(json, group.getId(), DockLocation.CENTER, -1, true));
  m.doAction(Actions.setActiveTabset(group.getId()));
  return { action: "created", tabId: id };
}

/** Ids das outras abas NORMAIS (não fixadas) do mesmo painel: alvo de "Fechar outras abas normais". */
export function otherNormalTabs(m: Model, id: string): string[] {
  const g = findTab(m, id)?.getParent();
  return g instanceof TabSetNode ? tabsOf(g).filter(t => t.getId() !== id && !isPinned(t)).map(t => t.getId()) : [];
}

export function closeTabs(m: Model, ids: string[]): void {
  ids.forEach(i => { if (findTab(m, i)) m.doAction(Actions.deleteTab(i)); });
}

/** Links de conteúdo: focam o registro existente ou abrem na última coluna à direita.
 * Criam até três grupos; com três grupos, adicionam aba ao último. No celular, usam o grupo atual.
 */
export function openContentLink(m: Model, spec: TabSpec, originTabId?: string, mobile = false): NavResult {
  void originTabId; // Mantido por compatibilidade com os chamadores.
  const id = tabId(spec);
  const existing = findTab(m, id);
  if (existing) { focusExisting(m, existing, spec); return { action: "selected", tabId: id }; }
  // No desktop, consultas abrem sempre na coluna mais à direita, sem substituir a origem.
  // Até três grupos: cria o grupo à direita quando há espaço, ou reutiliza o último.
  // No celular não há colunas lado a lado: preserva as abas no grupo atual.
  const last = groups(m).at(-1);
  const target = mobile ? activeGroup(m) : last;
  if (!target) return { action: "selected", tabId: id };
  const createRight = !mobile && groupCount(m) < MAX_GROUPS;
  m.doAction(Actions.addTab(tabJson({ ...spec, pinned: true }), target.getId(), createRight ? DockLocation.RIGHT : DockLocation.CENTER, -1, true));
  const created = findTab(m, id);
  const parent = created?.getParent();
  if (parent instanceof TabSetNode) m.doAction(Actions.setActiveTabset(parent.getId()));
  return { action: "created", tabId: id };
}

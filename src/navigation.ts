// Navegação por abas (puro, sem React): reutilizar a aba atual, abrir em nova aba (fixada ou não) e fixar/desafixar.
// Fixação é propriedade da própria aba (`config.pinned`), não o atributo nativo do FlexLayout: o nativo agrupa as fixadas no
// início, impede fechá-las pela interface e impede arrastá-las para fora do painel, o que contraria as decisões aprovadas.
import { Actions, DockLocation, type Model, TabNode, TabSetNode } from "flexlayout-react";
import { activeGroup, findTab, tabId, tabJson, type TabSpec } from "./workspace";

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

/**
 * Única porta de entrada de navegação (menu lateral, listas de registros, links internos).
 *  1. Mesmo id já aberto → seleciona essa aba (sem duplicar; "nova aba fixada" apenas a fixa).
 *  2. `new`/`newPinned` → cria aba no painel ativo.
 *  3. `reuse` → troca o conteúdo da aba selecionada do painel ativo se ela não for fixada nem tiver alterações não salvas;
 *     senão, outra aba normal e limpa do mesmo painel; senão cria uma aba normal. Nunca substitui aba fixada, nunca "pula" de painel.
 * Substituir = adicionar a nova aba na mesma posição e remover a antiga, de forma atômica.
 */
export function navigate(m: Model, spec: TabSpec, mode: NavMode = "reuse", isDirty: (id: string) => boolean = () => false): NavResult {
  const id = tabId(spec);
  const existing = findTab(m, id);
  if (existing) {
    const title = spec.title?.trim().slice(0, 40);
    if (title && title !== existing.getName()) m.doAction(Actions.renameTab(id, title));
    m.doAction(Actions.selectTab(id));
    const g = existing.getParent(); if (g) m.doAction(Actions.setActiveTabset(g.getId()));
    if (mode === "newPinned") setPinned(m, id, true);
    return { action: "selected", tabId: id };
  }
  const group = activeGroup(m);
  if (!group) return { action: "selected", tabId: id };
  const pinned = mode === "newPinned";
  const json = tabJson({ ...spec, pinned });
  if (mode === "reuse") {
    const tabs = tabsOf(group), selected = group.getSelectedNode();
    const eligible = (t: TabNode) => !isPinned(t) && !isDirty(t.getId());
    const target = selected instanceof TabNode && eligible(selected) ? selected : [...tabs].reverse().find(eligible);
    if (target) {
      const index = tabs.indexOf(target);
      m.doAction(Actions.group([Actions.addTab(json, group.getId(), DockLocation.CENTER, index, true), Actions.deleteTab(target.getId()), Actions.setActiveTabset(group.getId())]));
      return { action: "replaced", tabId: id };
    }
  }
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

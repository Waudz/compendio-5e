import { currentPage, visitPage } from "./tabHistory";
// Navegação por abas (puro, sem React): preservar abas, abrir consultas em grupos e fixar/desafixar.
// Fixação é propriedade da própria aba (`config.pinned`), não o atributo nativo do FlexLayout: o nativo agrupa as fixadas no
// início, impede fechá-las pela interface e impede arrastá-las para fora do painel, o que contraria as decisões aprovadas.
import { Actions, DockLocation, type Model, TabNode, TabSetNode } from "flexlayout-react";
import { aliasDoPersonagem } from "./voltarInterno";
import { activeGroup, findTab, groupCount, groups, tabId, tabJson, type TabSpec } from "./workspace";

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

/** Um personagem tem uma aba só, venha ele da lista (`ficha:`), do rascunho local ou da criação (`criador:novo-…`). */
export function abaDoRegistro(m: Model, spec: TabSpec): TabNode | undefined {
  let atual:TabNode|undefined;
  m.visitNodes(n=>{if(n instanceof TabNode&&tabId(currentPage(n))===tabId(spec))atual=n;});
  if(atual)return atual;
  if(spec.kind!=="ficha"&&spec.kind!=="criador")return undefined;
  const alias=aliasDoPersonagem(spec.ref);
  let personagem:TabNode|undefined;
  m.visitNodes(n=>{if(n instanceof TabNode){const p=currentPage(n);if((p.kind==="ficha"||p.kind==="criador")&&(p.ref===spec.ref||p.ref===alias))personagem=n;}});
  return personagem;
}

/** Seleciona a aba que já representa o registro (e atualiza o título, ex.: campanha renomeada). Não altera a fixação. */
function focusExisting(m: Model, existing: TabNode, spec: TabSpec): void {
  visitPage(m,existing.getId(),spec);
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
  const existing = abaDoRegistro(m, spec);
  if (existing) {
    focusExisting(m, existing, spec);
    if (mode === "newPinned") setPinned(m, existing.getId(), true);
    return { action: "selected", tabId: existing.getId() };
  }
  let instance=spec.instance??1;while(findTab(m,tabId({...spec,instance})))instance++;
  spec={...spec,instance};
  const id=tabId(spec);
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

/** Abertura explícita: foca registro existente ou abre no grupo escolhido.
 * Há no máximo dois grupos. No celular, usam o grupo atual; "neste grupo" abre como aba ao lado da origem.
 */
export function openContentLink(m: Model, spec: TabSpec, originTabId?: string, mobile = false, noGrupoDaOrigem = false): NavResult {
  const existing = abaDoRegistro(m, spec);
  if (existing) { focusExisting(m, existing, spec); return { action: "selected", tabId: existing.getId() }; }
  let instance=spec.instance??1;while(findTab(m,tabId({...spec,instance})))instance++;
  spec={...spec,instance};const id=tabId(spec);
  const colunas = groups(m);
  const origem = originTabId ? findTab(m, originTabId)?.getParent() : activeGroup(m);
  const source = origem instanceof TabSetNode ? origem : activeGroup(m);
  const same = mobile || noGrupoDaOrigem;
  const target = same ? source : colunas.find(g => g !== source) ?? source;
  if (!target) return { action: "selected", tabId: id };
  const split = !same && groupCount(m) < 2;
  m.doAction(Actions.addTab(tabJson(spec), target.getId(), split ? DockLocation.RIGHT : DockLocation.CENTER, -1, true));
  const parent = findTab(m, id)?.getParent();
  if (parent instanceof TabSetNode) m.doAction(Actions.setActiveTabset(parent.getId()));
  return { action: "created", tabId: id };
}

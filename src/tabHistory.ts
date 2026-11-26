import { Actions, type Model, type TabNode } from 'flexlayout-react';
import { defaultTitle, findTab, tabId, type TabSpec } from './workspace';
export type TabHistory = { pages: TabSpec[]; index: number };
export function historyOf(node: TabNode): TabHistory {
  const c = node.getConfig() as TabSpec & { history?: TabHistory; ref: string };
  return c.history ?? { pages: [{kind:c.kind,ref:c.ref}], index:0 };
}
export const currentPage = (node: TabNode): TabSpec => { const h=historyOf(node); return h.pages[h.index]; };
export function visitPage(model: Model, id: string, page: TabSpec): void {
  const node=findTab(model,id); if(!node)return;
  const h=historyOf(node); if(tabId(h.pages[h.index])===tabId(page))return;
  const pages=[...h.pages.slice(0,h.index+1),page].slice(-40);
  model.doAction(Actions.updateNodeAttributes(id,{config:{...node.getConfig(),history:{pages,index:pages.length-1}}}));
  model.doAction(Actions.renameTab(id,defaultTitle(page)));
}
export function stepHistory(model: Model, id: string, index: number): void {
  const node=findTab(model,id);if(!node)return;const h=historyOf(node);
  if(!Number.isInteger(index)||index<0||index>=h.pages.length)return;
  model.doAction(Actions.updateNodeAttributes(id,{config:{...node.getConfig(),history:{...h,index}}}));
  model.doAction(Actions.renameTab(id,defaultTitle(h.pages[index])));
}

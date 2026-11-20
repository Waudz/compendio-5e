/** Role-specific bottom navigation contract for the future player/master layouts.
 * This controls presentation only. Authorization MUST be enforced server-side.
 */
export type CampaignNavigationRole='master'|'player';
export type CampaignNavigationTab='home'|'notes'|'initiative'|'sheet'|'compendium'|'menu';
export type NavigationItem={id:CampaignNavigationTab;label:string};
const COMMON={
 home:{id:'home',label:'Início'},
 notes:{id:'notes',label:'Anotações'},
 initiative:{id:'initiative',label:'Iniciativa'},
 sheet:{id:'sheet',label:'Ficha'},
 compendium:{id:'compendium',label:'Compêndio'},
 menu:{id:'menu',label:'Menu'}
} as const satisfies Record<CampaignNavigationTab,NavigationItem>;
export function campaignNavigation(role:CampaignNavigationRole):readonly NavigationItem[]{
 return role==='master'
  ?[COMMON.home,COMMON.notes,COMMON.initiative,COMMON.compendium,COMMON.menu]
  :[COMMON.home,COMMON.notes,COMMON.sheet,COMMON.compendium,COMMON.menu];
}
export function isCampaignTabVisible(role:CampaignNavigationRole,tab:CampaignNavigationTab):boolean {
 return campaignNavigation(role).some(item=>item.id===tab);
}
/** Inventory is a subpage of the sheet, never an independent bottom tab. */
export const PLAYER_SHEET_SUBPAGES=['sheet','inventory'] as const;

/** Equipment bundles are recipes referencing canonical item IDs, never cloned item definitions.
 * SRD 5.1 (2014), CC BY 4.0. This is a subset for the Fighter creation pilot.
 */
export type EquipmentComponent={itemId:string;quantity:number};
export type EquipmentBundle={id:string;name:string;components:EquipmentComponent[]};
export const adventuringPacks2014:Record<string,EquipmentBundle>={
 explorer:{id:'explorer',name:'Pacote de Explorador',components:[
  {itemId:'backpack',quantity:1},{itemId:'bedroll',quantity:1},{itemId:'mess-kit',quantity:1},
  {itemId:'tinderbox',quantity:1},{itemId:'torch',quantity:10},{itemId:'rations',quantity:10},
  {itemId:'waterskin',quantity:1},{itemId:'hempen-rope-50-feet',quantity:1}
 ]},
 dungeoneer:{id:'dungeoneer',name:'Pacote de Aventureiro de Masmorras',components:[
  {itemId:'backpack',quantity:1},{itemId:'crowbar',quantity:1},{itemId:'hammer',quantity:1},
  {itemId:'piton',quantity:10},{itemId:'torch',quantity:10},{itemId:'tinderbox',quantity:1},
  {itemId:'rations',quantity:10},{itemId:'waterskin',quantity:1},
  {itemId:'hempen-rope-50-feet',quantity:1}
 ]}
};
export const fighterStartingEquipment2014={
 armor:['chain-mail','leather-armor-and-longbow-20-arrows'],
 weapons:['martial-weapon-and-shield','two-martial-weapons'],
 ranged:['light-crossbow-20-bolts','two-handaxes'],
 pack:['dungeoneer','explorer']
} as const;
/** Resolve a bundle into catalogue IDs, leaving each item independent in inventory. */
export function expandEquipmentBundle(bundle:EquipmentBundle):EquipmentComponent[]{
 if(!bundle.id||!bundle.components.length)throw Error('Invalid equipment bundle');
 return bundle.components.map(({itemId,quantity})=>{
  if(!itemId||!Number.isSafeInteger(quantity)||quantity<1)throw Error('Invalid equipment component');
  return {itemId,quantity};
 });
}

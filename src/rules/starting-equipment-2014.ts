/** Equipment bundles are recipes referencing canonical item IDs, never cloned item definitions.
 * SRD 5.1 (2014), CC BY 4.0. This is a subset for the Fighter creation pilot.
 */
export type EquipmentComponent={itemId:string;quantity:number};
export type EquipmentBundle={id:string;name:string;components:EquipmentComponent[]};
export const adventuringPacks2014:Record<string,EquipmentBundle>={
 explorer:{id:'explorer',name:'Pacote de Explorador',components:[
  {itemId:'backpack',quantity:1},{itemId:'bedroll',quantity:1},{itemId:'mess-kit',quantity:1},
  {itemId:'tinderbox',quantity:1},{itemId:'torch',quantity:10},{itemId:'rations-1-day',quantity:10},
  {itemId:'waterskin',quantity:1},{itemId:'rope-hempen-50-feet',quantity:1}
 ]},
 dungeoneer:{id:'dungeoneer',name:'Pacote de Aventureiro de Masmorras',components:[
  {itemId:'backpack',quantity:1},{itemId:'crowbar',quantity:1},{itemId:'hammer',quantity:1},
  {itemId:'piton',quantity:10},{itemId:'torch',quantity:10},{itemId:'tinderbox',quantity:1},
  {itemId:'rations-1-day',quantity:10},{itemId:'waterskin',quantity:1},
  {itemId:'rope-hempen-50-feet',quantity:1}
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

/** Only expand when every component resolves to the same catalogue used by the Compendium. */
export function resolvePackItems(bundle:EquipmentBundle,knownItemIds:ReadonlySet<string>):EquipmentComponent[]{
 const components=expandEquipmentBundle(bundle);
 for(const item of components)if(!knownItemIds.has(item.itemId))throw Error('Unknown catalogue item: '+item.itemId);
 return components;
}

/** Concrete SRD equipment options for the Fighter pilot. Martial-weapon
 * selections are a deliberately limited sample until the full catalogue
 * is audited; never present these as the complete weapon list.
 */
export const fighterEquipmentOptions2014={
 armor:[
  {id:'chain-mail',name:'Cota de malha',components:[{itemId:'chain-mail',quantity:1}]},
  {id:'leather-bow',name:'Armadura de couro, arco longo e 20 flechas',components:[
   {itemId:'leather-armor',quantity:1},{itemId:'longbow',quantity:1},{itemId:'arrow',quantity:20}]}
 ],
 weapons:[
  {id:'longsword-shield',name:'Espada longa e escudo (amostra de arma marcial)',components:[
   {itemId:'longsword',quantity:1},{itemId:'shield',quantity:1}]},
  {id:'two-longswords',name:'Duas espadas longas (amostra de armas marciais)',components:[
   {itemId:'longsword',quantity:2}]}
 ],
 ranged:[
  {id:'crossbow',name:'Besta leve e 20 virotes',components:[
   {itemId:'crossbow-light',quantity:1},{itemId:'crossbow-bolt',quantity:20}]},
  {id:'handaxes',name:'Dois machados de mão',components:[{itemId:'handaxe',quantity:2}]}
 ],
 pack:Object.values(adventuringPacks2014).map(pack=>({
  id:pack.id,name:pack.name,components:expandEquipmentBundle(pack)
 }))
} satisfies Record<string,{id:string;name:string;components:EquipmentComponent[]}[]>;

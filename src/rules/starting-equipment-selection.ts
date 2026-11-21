/** One transaction for starting equipment from class/background choices.
 * Recipes resolve only to item IDs in the shared Compendium catalogue.
 * Reapplying the same choice is idempotent; changing a choice never deletes
 * acquired items. The caller must request confirmation before replacing
 * previously edited starting equipment.
 */
import type {CharacterDraft,InventoryEntry} from './character-domain';
import type {EquipmentComponent} from './starting-equipment-2014';
export type StartingEquipmentSelection={sourceId:string;optionId:string;components:EquipmentComponent[]};
const PREFIX='starting-choice:';
function selectionPrefix(sourceId:string):string {
 if(!/^[a-z0-9-]+$/.test(sourceId))throw Error('Invalid equipment choice source');
 return PREFIX+sourceId+':';
}
export function applyStartingEquipmentSelection(
 draft:CharacterDraft,selection:StartingEquipmentSelection,knownItemIds:ReadonlySet<string>
):CharacterDraft {
 const prefix=selectionPrefix(selection.sourceId);
 if(!/^[a-z0-9-]+$/.test(selection.optionId)||!selection.components.length)throw Error('Invalid equipment selection');
 const seen=new Set<string>();
 for(const {itemId,quantity} of selection.components){
  if(!knownItemIds.has(itemId))throw Error('Unknown catalogue item: '+itemId);
  if(seen.has(itemId)||!Number.isSafeInteger(quantity)||quantity<1)throw Error('Invalid equipment selection components');
  seen.add(itemId);
 }
 const existing=draft.inventory.filter(item=>item.id.startsWith(prefix));
 const desired=selection.components.map(({itemId,quantity}):InventoryEntry=>({
  id:prefix+selection.optionId+':'+itemId,itemId,quantity,origin:'starting',equipped:false
 }));
 if(existing.length===desired.length&&desired.every(item=>existing.some(old=>
  old.id===item.id&&old.quantity===item.quantity&&!old.equipped)))return draft;
 if(existing.length)throw Error('Starting equipment already selected: confirm replacement before changing it');
 return {...draft,inventory:[...draft.inventory,...desired]};
}

/** Replace a previously accepted starting option only after explicit UI confirmation.
 * Edited/consumed/equipped instances are never silently restored. The caller
 * supplies the old option recipe so every original quantity can be checked.
 */
export function replaceStartingEquipmentSelection(
 draft:CharacterDraft,oldSelection:StartingEquipmentSelection,
 newSelection:StartingEquipmentSelection,knownItemIds:ReadonlySet<string>,
 confirmed:boolean
):CharacterDraft {
 if(!confirmed)throw Error('Starting equipment replacement requires confirmation');
 if(oldSelection.sourceId!==newSelection.sourceId)throw Error('Equipment source mismatch');
 const prefix=selectionPrefix(oldSelection.sourceId);
 const previous=oldSelection.components.map(item=>({
  id:prefix+oldSelection.optionId+':'+item.itemId,itemId:item.itemId,quantity:item.quantity
 }));
 const existing=draft.inventory.filter(item=>item.id.startsWith(prefix));
 if(existing.length!==previous.length||previous.some(item=>!existing.some(entry=>
  entry.id===item.id&&entry.itemId===item.itemId&&entry.quantity===item.quantity&&!entry.equipped)))
  throw Error('Starting equipment was edited; resolve inventory changes manually');
 const withoutOld={...draft,inventory:draft.inventory.filter(item=>!item.id.startsWith(prefix))};
 return applyStartingEquipmentSelection(withoutOld,newSelection,knownItemIds);
}

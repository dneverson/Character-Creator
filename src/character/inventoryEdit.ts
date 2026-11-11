// Changing the inventory of the active character. A click can run several changes
// (adding ticked rows, taking starting gear), so each reads the latest state rather
// than the one rendered.

import type { EquipmentState, InventoryItem } from './model'
import { useCharacterStore } from './store'

/** Changes the equipment as it is now; one edit, so one entry of the history. */
export function editEquipment(change: (equipment: EquipmentState) => EquipmentState) {
  const { activeId, characters, updateActive } = useCharacterStore.getState()
  const equipment = activeId ? characters[activeId]?.equipment : undefined
  if (equipment) updateActive({ equipment: change(equipment) })
}

/** Changes the stacks of the inventory as they are now. */
export const editItems = (change: (current: InventoryItem[]) => InventoryItem[]) =>
  editEquipment((equipment) => ({ ...equipment, items: change(equipment.items) }))

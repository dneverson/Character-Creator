// Changing the inventory of the current character. A click can run several changes
// (adding ticked rows, taking starting gear), so each reads the latest state rather
// than the one rendered.

import { useCallback } from 'react'
import { useLatestCharacter, useUpdateCharacter } from './useCharacterDoc'
import type { EquipmentState, InventoryItem } from './model'

/** Changes the equipment as it is now; one edit, so one entry of the history. */
export function useEditEquipment() {
  const latest = useLatestCharacter()
  const update = useUpdateCharacter()
  return useCallback(
    (change: (equipment: EquipmentState) => EquipmentState) => {
      const equipment = latest()?.equipment
      if (equipment) update({ equipment: change(equipment) })
    },
    [latest, update],
  )
}

/** Changes the stacks of the inventory as they are now. */
export function useEditItems() {
  const editEquipment = useEditEquipment()
  return useCallback(
    (change: (current: InventoryItem[]) => InventoryItem[]) =>
      editEquipment((equipment) => ({ ...equipment, items: change(equipment.items) })),
    [editEquipment],
  )
}

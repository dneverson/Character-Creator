// The character's stacks as the items they are, and by item key: what the Equipment
// section and the sheet's Inventory tab list.

import { useMemo } from 'react'
import {
  indexItems,
  inventoryKey,
  resolveInventoryItem,
  unlistedItem,
} from '../../character/inventory'
import type { InventoryItem } from '../../character/model'
import type { Item } from '../../data/items'

export function useOwnedItems(
  items: readonly Item[] | null | undefined,
  stacks: InventoryItem[],
) {
  const catalog = useMemo(() => indexItems(items ?? []), [items])
  const owned = useMemo(
    () => stacks.map((s) => resolveInventoryItem(s, catalog) ?? unlistedItem(s)),
    [stacks, catalog],
  )
  const stackOf = useMemo(
    () => new Map(stacks.map((s) => [inventoryKey(s), s])),
    [stacks],
  )
  return { catalog, owned, stackOf }
}

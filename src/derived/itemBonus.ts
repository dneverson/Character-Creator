// What an item adds by the bonus fields of the data (+1 armor, +2 weapon, a rod's
// spell attack): read from the item's own bonuses, so every magic item that states a
// bonus is covered without a table.

import { BONUS_LABELS } from '../data/labels'
import type { Item } from '../data/items'

export type BonusField = keyof typeof BONUS_LABELS

/** The signed amount an item gives to what a bonus field applies to (0 when none). */
export function itemBonus(item: Item, field: BonusField): number {
  const what = BONUS_LABELS[field]
  return item.bonuses
    .filter((b) => b.what === what)
    .reduce((sum, b) => sum + (Number(b.value) || 0), 0)
}

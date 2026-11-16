// What an item sells for. Mundane gear (weapons, armor, tools, adventuring gear) is bought
// back at half its listed price in both editions; trade goods and treasure keep their full
// value; a magic item has no standing price in the books, so the player enters what it
// fetched. The sheet prefills the amount and the player can change it.

import type { Edition } from '../data/edition'
import type { Item, ItemKind } from '../data/itemTypes'

/** What the rules put on an item when it is sold. */
export interface SellPrice {
  /** Copper for one, when the rules give one. */
  copper?: number
  /** Why, in the player's words. */
  note: string
}

interface SellRule {
  /** The share of the listed price mundane gear fetches. */
  gear: number
  /** The kinds that keep their whole value. */
  full: readonly ItemKind[]
}

/** The rule of each edition; both buy gear back at half. */
export const SELL_RULES: Record<Edition, SellRule> = {
  classic: { gear: 0.5, full: ['trade', 'treasure'] },
  one: { gear: 0.5, full: ['trade', 'treasure'] },
}

/** The price one of `item` fetches under the rules of `edition`. */
export function sellPrice(item: Item, edition: Edition): SellPrice {
  const rule = SELL_RULES[edition]
  if (item.magic) {
    return {
      note: 'A magic item sells for what the buyer and the DM agree. Enter the price.',
    }
  }
  if (item.value === undefined) {
    return { note: 'The books list no price for it. Enter what it fetched.' }
  }
  if (rule.full.includes(item.kind)) {
    return { copper: item.value, note: 'Trade goods and treasure keep their full value.' }
  }
  return {
    copper: Math.floor(item.value * rule.gear),
    note: `Mundane gear sells for ${Math.round(rule.gear * 100)}% of its listed price.`,
  }
}

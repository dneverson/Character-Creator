// Changing what a character carries while playing: taking an item, buying it, selling it or
// dropping it, wearing and attuning, and moving coins in and out of the purse. Each is a
// pure function of the equipment that returns the equipment after it and the history
// action that says what it was. None of them blocks: a price the purse cannot meet is paid
// with all of it and reported as short.

import { applyVariant } from '../data/itemVariants'
import type { Item } from '../data/items'
import {
  addCoins,
  coinsFor,
  exchangeCoins,
  priceCoin,
  receiveCoins,
  spendCoins,
  type Coin,
} from '../rules/coins'
import { COIN_COPPER } from '../rules/equipment'
import { addStack, addVariantStack, inventoryKey } from './inventory'
import type {
  EquipmentState,
  HistoryAction,
  InventoryChange,
  InventoryItem,
} from './model'

export type InventoryAction = Extract<HistoryAction, { type: 'inventory' }>

/** The equipment after a change, what the change was and how the money went. */
export interface Outcome {
  equipment: EquipmentState
  action: InventoryAction
  /** Copper the purse could not cover. */
  short?: number
  /** The item has no price in the books, so nothing was paid. */
  unpriced?: true
  /** The coin broken to pay, and the change given back. */
  broke?: Coin
}

const done = (
  equipment: EquipmentState,
  change: InventoryChange,
  rest: Omit<InventoryAction, 'type' | 'change'> = {},
): Outcome => ({ equipment, action: { type: 'inventory', change, ...rest } })

/**
 * One of `item` taken: found or given (`add`, no cost), or bought (`buy`, its price paid
 * from the purse). A generic variant is taken with its `base` item.
 */
export function acquire(
  equipment: EquipmentState,
  item: Item,
  how: 'add' | 'buy',
  base?: Item,
): Outcome {
  const made = item.variant && base ? applyVariant(item, base) : item
  const items =
    item.variant && base
      ? addVariantStack(equipment.items, item, base)
      : addStack(equipment.items, item)
  const taken = { ...equipment, items }
  const cost = made.value ?? 0
  if (how === 'add') return done(taken, 'add', { item: made.name, quantity: 1 })
  if (cost <= 0) {
    return {
      ...done(taken, 'buy', { item: made.name, quantity: 1 }),
      unpriced: true,
    }
  }
  const paid = spendCoins(equipment.currency, cost, priceCoin(cost))
  return {
    ...done({ ...taken, currency: paid.purse }, 'buy', {
      item: made.name,
      quantity: 1,
      price: cost,
      ...(paid.short > 0 && { short: paid.short }),
    }),
    ...(paid.short > 0 && { short: paid.short }),
    ...(paid.broke && { broke: paid.broke }),
  }
}

/**
 * `quantity` of the stack `key` let go: sold for `price` copper (all of it, put in the
 * purse) or dropped for nothing. The whole stack goes when the quantity covers it.
 */
export function dispose(
  equipment: EquipmentState,
  key: string,
  quantity: number,
  how: 'sell' | 'drop',
  price = 0,
): Outcome | undefined {
  const stack = equipment.items.find((s) => inventoryKey(s) === key)
  const n = Math.min(Math.floor(quantity), stack?.quantity ?? 0)
  if (!stack || n < 1) return undefined
  const items =
    n >= stack.quantity
      ? equipment.items.filter((s) => s !== stack)
      : equipment.items.map((s) => (s === stack ? { ...s, quantity: s.quantity - n } : s))
  const sold = how === 'sell' && price > 0
  return done(
    {
      ...equipment,
      items,
      currency: sold
        ? receiveCoins(equipment.currency, coinsFor(price))
        : equipment.currency,
    },
    how,
    { item: stack.name, quantity: n, ...(sold && { price }) },
  )
}

/** What a patch to a stack is: worn, attuned, a count or a note. */
function changeOf(patch: Partial<InventoryItem>): InventoryChange {
  if (patch.equipped !== undefined) return patch.equipped ? 'equip' : 'unequip'
  if (patch.attuned !== undefined) return patch.attuned ? 'attune' : 'unattune'
  return patch.quantity !== undefined ? 'quantity' : 'note'
}

/**
 * A stack changed in place. A quantity below 1 is the stack used up: it is dropped. A
 * stack the equipment does not have is left alone (undefined).
 */
export function patchStack(
  equipment: EquipmentState,
  key: string,
  patch: Partial<InventoryItem>,
): Outcome | undefined {
  const stack = equipment.items.find((s) => inventoryKey(s) === key)
  if (!stack) return undefined
  if (patch.quantity !== undefined && patch.quantity < 1) {
    return dispose(equipment, key, stack.quantity, 'drop')
  }
  const items = equipment.items.map((s) => (s === stack ? { ...s, ...patch } : s))
  return done({ ...equipment, items }, changeOf(patch), {
    item: stack.name,
    ...(patch.quantity !== undefined && { quantity: patch.quantity }),
  })
}

/** A coin count typed into the purse. */
export function setCoin(equipment: EquipmentState, coin: Coin, value: number): Outcome {
  const amount = Math.max(0, Math.floor(value) || 0)
  return done(
    { ...equipment, currency: { ...equipment.currency, [coin]: amount } },
    'coins',
    { item: coin, quantity: amount - equipment.currency[coin] },
  )
}

/** Coins found or given, put in the purse. */
export function takeCoins(
  equipment: EquipmentState,
  coin: Coin,
  amount: number,
): Outcome {
  const n = Math.max(0, Math.floor(amount) || 0)
  return done(
    { ...equipment, currency: addCoins(equipment.currency, coin, n) },
    'coins',
    {
      item: coin,
      quantity: n,
    },
  )
}

/** Coins spent: `amount` of `coin`, made up from the purse (see `spendCoins`). */
export function payCoins(equipment: EquipmentState, coin: Coin, amount: number): Outcome {
  const n = Math.max(0, Math.floor(amount) || 0)
  const paid = spendCoins(equipment.currency, n * COIN_COPPER[coin], coin)
  return {
    ...done({ ...equipment, currency: paid.purse }, 'coins', {
      item: coin,
      quantity: -n,
      ...(paid.short > 0 && { short: paid.short }),
    }),
    ...(paid.short > 0 && { short: paid.short }),
    ...(paid.broke && { broke: paid.broke }),
  }
}

/** Coins of one kind changed for another (see `exchangeCoins`); undefined when none change. */
export function changeCoins(
  equipment: EquipmentState,
  from: Coin,
  to: Coin,
  amount: number,
): Outcome | undefined {
  const swap = exchangeCoins(equipment.currency, from, to, amount)
  if (swap.got === 0) return undefined
  return done({ ...equipment, currency: swap.purse }, 'coins', {
    item: `${swap.gave} ${from} for ${swap.got} ${to}`,
    quantity: 0,
  })
}

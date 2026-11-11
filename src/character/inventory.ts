// Reading the inventory against the catalog. A stack of the inventory names an
// item; this finds what it is: a catalog item, an item made of a generic variant, or
// an item of the player's own. One function, so the table, the totals, the history
// and the sheet all see the same item.

import type { Item } from '../data/items'
import { applyVariant } from '../data/itemVariants'
import { ITEM_KIND_LABELS } from '../data/labels'
import type { CustomItem, InventoryItem } from './model'

/** The source of an item that is in no book. */
export const CUSTOM_SOURCE = 'Custom'

/** The address of a stack: its name and source, as the history names it. */
export const inventoryKey = (stack: Pick<InventoryItem, 'name' | 'source'>) =>
  `${stack.name}|${stack.source}`

/** The catalog by item key, to look stacks up in. */
export const indexItems = (items: readonly Item[]): ReadonlyMap<string, Item> =>
  new Map(items.map((item) => [item.key, item]))

/** An item of the player's own as the Item the rest of the app reads. */
export function customItem(name: string, custom: CustomItem): Item {
  return {
    key: `${name}|${CUSTOM_SOURCE}`,
    name,
    source: CUSTOM_SOURCE,
    // An item of no book has no edition and no twin; either edition's rules take it.
    edition: 'one',
    kind: custom.kind,
    category: ITEM_KIND_LABELS[custom.kind],
    rarity: custom.rarity,
    magic: custom.rarity !== undefined && custom.rarity !== 'none',
    weight: custom.weight,
    value: custom.value,
    attunement: custom.attunement
      ? { required: true, optional: false, classes: [] }
      : undefined,
    bonuses: [],
    spells: [],
    traits: [],
    details: [],
    groups: [],
    family: [],
    free: false,
    entries: custom.description ? [custom.description] : [],
  }
}

/**
 * What a stack is when nothing says what it is (its book is off, or it is gone from
 * the data): its name and source, with no stats. It is shown, never dropped.
 */
export function unlistedItem(stack: InventoryItem): Item {
  return {
    ...customItem(stack.name, { kind: 'gear', description: '' }),
    key: inventoryKey(stack),
    source: stack.source,
    category: undefined,
  }
}

/**
 * The item a stack of the inventory is: the catalog's item of that name and source,
 * else the generic variant laid over its base item, else the item of the player's
 * own. Undefined when none of them can be found (a book switched off, an item gone
 * from the data): the stack then shows its name and says it is not in the books.
 */
export function resolveInventoryItem(
  stack: InventoryItem,
  catalog: ReadonlyMap<string, Item>,
): Item | undefined {
  const found = catalog.get(inventoryKey(stack))
  if (found) return found
  if (stack.variantOf && stack.base) {
    const template = catalog.get(stack.variantOf)
    const base = catalog.get(stack.base)
    if (template && base) return applyVariant(template, base)
  }
  return stack.custom ? customItem(stack.name, stack.custom) : undefined
}

/** A name for a custom item that no stack has yet: a clash becomes "Name (2)", "Name (3)". */
export function uniqueCustomName(items: readonly InventoryItem[], name: string): string {
  const taken = new Set(
    items.filter((i) => i.source === CUSTOM_SOURCE).map((i) => i.name),
  )
  if (!taken.has(name)) return name
  let n = 2
  while (taken.has(`${name} (${n})`)) n += 1
  return `${name} (${n})`
}

/**
 * The stacks with one of a pack opened: it goes, and what it holds is added (to a stack
 * of the same item when there is one). What the catalog has no row for is kept as an
 * item of the player's own, so nothing a pack holds is lost.
 */
export function unpackStack(
  stacks: readonly InventoryItem[],
  pack: Item,
  catalog: ReadonlyMap<string, Item>,
): InventoryItem[] {
  const opened = stacks.find((s) => inventoryKey(s) === pack.key)
  const next = stacks
    .map((s) => (s === opened ? { ...s, quantity: s.quantity - 1 } : { ...s }))
    .filter((s) => s.quantity > 0)
  for (const part of pack.pack ?? []) {
    const item = part.key ? catalog.get(part.key) : undefined
    const name = item?.name ?? uniqueCustomName(next, part.name)
    const source = item?.source ?? CUSTOM_SOURCE
    const same = next.find((s) => s.name === name && s.source === source)
    if (same) same.quantity += part.quantity
    else
      next.push({
        name,
        source,
        quantity: part.quantity,
        ...(opened?.from ? { from: opened.from } : {}),
        ...(item ? {} : { custom: { kind: 'gear', description: '' } }),
      })
  }
  return next
}

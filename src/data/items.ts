// Item data: base items (weapons, armor, gear), magic and other items, and the
// generic magic variants, read into one catalog of items with every stat a player
// compares them by (see itemRead). A generic variant is one row, a template; the
// item it makes of a base item is `applyVariant`.

import { memoizeContent } from '../content/epoch'
import { resolveCopy } from './copy'
import { fetchData } from './dataClient'
import { loadBookEditions } from './edition'
import {
  inheritBase,
  makeLookups,
  packOf,
  readItem,
  type LookupRow,
  type RawItem,
} from './itemRead'
import type { Item } from './itemTypes'
import { nameSortKey } from './itemText'
import { readVariant } from './itemVariants'

export type {
  AttachedSpell,
  Bonus,
  Dice,
  Item,
  ItemArmor,
  ItemAttunement,
  ItemCharges,
  ItemContainer,
  ItemKind,
  ItemMastery,
  ItemProperty,
  ItemVehicle,
  ItemWeapon,
  PackPart,
  VariantTemplate,
} from './itemTypes'

interface ItemsFile {
  item?: RawItem[]
  itemGroup?: RawItem[]
}
interface BaseItemsFile {
  baseitem?: RawItem[]
  itemProperty?: LookupRow[]
  itemMastery?: LookupRow[]
  itemType?: LookupRow[]
}
interface VariantsFile {
  magicvariant?: RawItem[]
}

/** The lower-case "name|source" a reference to an item is made with. */
const referenceOf = (name: string, source: string) => `${name}|${source}`.toLowerCase()

/** A row found by name and source, for `_copy` and `baseItem`. */
const finder = (rows: RawItem[]) => {
  const byReference = new Map(rows.map((row) => [referenceOf(row.name, row.source), row]))
  return (name: string, source: string) => byReference.get(referenceOf(name, source))
}

const textOf = (v: unknown) => (typeof v === 'string' ? v : undefined)
const firstText = (v: unknown) =>
  Array.isArray(v) ? v.find((x) => typeof x === 'string') : undefined

/**
 * The twin of an item is the same item in the other edition's book. The data says
 * so on the older row (`reprintedAs`); both rows get the other's key. A name is
 * never matched: two different items share one.
 */
function pairTwins(pairs: { item: Item; reprintedAs: unknown }[]): void {
  const byKey = new Map(pairs.map(({ item }) => [item.key, item]))
  for (const { item, reprintedAs } of pairs) {
    const target = byKey.get(textOf(firstText(reprintedAs)) ?? '')
    if (!target || target === item) continue
    item.twin = target.key
    target.twin ??= item.key
  }
}

/** Load the full item catalog: base items, magic items, and the generic variants. */
export const loadItems = memoizeContent(async (): Promise<Item[]> => {
  const [base, magic, variants, editionOfBook] = await Promise.all([
    fetchData<BaseItemsFile>('items-base.json'),
    fetchData<ItemsFile>('items.json'),
    fetchData<VariantsFile>('magicvariants.json'),
    loadBookEditions(),
  ])
  const lookups = makeLookups(
    {
      properties: base.itemProperty ?? [],
      masteries: base.itemMastery ?? [],
      types: base.itemType ?? [],
    },
    editionOfBook,
  )

  const rows = [...(base.baseitem ?? []), ...(magic.item ?? [])]
  const findRow = finder(rows)
  const read = rows.map((row) => {
    const resolved = resolveCopy(row, findRow)
    const baseRef = textOf(resolved.baseItem)?.split('|')
    const baseRow = baseRef && findRow(baseRef[0], baseRef[1] ?? 'PHB')
    return { raw: resolved, item: readItem(inheritBase(resolved, baseRow), lookups) }
  })
  const items = read.map(({ item }) => item)
  const byReference = new Map(
    items.map((item) => [referenceOf(item.name, item.source), item]),
  )
  const findItem = (reference: string) => byReference.get(reference.toLowerCase())

  const findVariant = finder(variants.magicvariant ?? [])
  const templates = (variants.magicvariant ?? []).map((row) => {
    const resolved = resolveCopy(row, findVariant)
    return {
      raw: resolved,
      item: readVariant(
        resolved,
        lookups,
        (name, source) => findItem(`${name}|${source}`)?.kind,
      ),
    }
  })

  for (const { raw, item } of read)
    if (raw.packContents !== undefined) item.pack = packOf(raw.packContents, findItem)

  // An umbrella item (an arcane focus, armor of resistance) is an index of its members.
  for (const group of magic.itemGroup ?? [])
    for (const member of Array.isArray(group.items) ? group.items : []) {
      if (typeof member !== 'string') continue
      const found = findItem(member.includes('|') ? member : `${member}|${group.source}`)
      if (found && !found.groups.includes(group.name)) found.groups.push(group.name)
    }

  pairTwins([
    ...read.map(({ raw, item }) => ({ item, reprintedAs: raw.reprintedAs })),
    ...templates.map(({ raw, item }) => ({
      item,
      reprintedAs: (raw.inherits as { reprintedAs?: unknown } | undefined)?.reprintedAs,
    })),
  ])

  const catalog = [...items, ...templates.map(({ item }) => item)]
  catalog.sort((a, b) => nameSortKey(a.name).localeCompare(nameSortKey(b.name)))
  return catalog
})

/** Reset the module cache (tests). */
export function _clearItemCache(): void {
  loadItems.clear()
}

const RARITY_LABELS: Record<string, string> = {
  common: 'Common',
  uncommon: 'Uncommon',
  rare: 'Rare',
  'very rare': 'Very Rare',
  legendary: 'Legendary',
  artifact: 'Artifact',
  varies: 'Varies',
  unknown: 'Unknown',
}

export function rarityLabel(rarity?: string): string {
  if (!rarity) return ''
  return RARITY_LABELS[rarity] ?? rarity
}

/** Format a copper value as a gold-piece string, e.g. 1550 -> "15.5 gp". */
export function goldLabel(valueCp?: number): string {
  if (valueCp == null) return '-'
  const gp = valueCp / 100
  const rounded = Math.round(gp * 100) / 100
  return `${rounded} gp`
}

/**
 * A price as the books write it: the largest coin that makes it a whole number,
 * 5 sp, 2 gp, 25 cp. Never a fraction of a coin.
 */
export function costLabel(valueCp?: number): string {
  if (valueCp == null) return '-'
  if (valueCp > 0 && valueCp % 100 === 0) return `${valueCp / 100} gp`
  if (valueCp > 0 && valueCp % 10 === 0) return `${valueCp / 10} sp`
  return `${valueCp} cp`
}

// What a pick of a grant can be: the values the grant names, and the catalog entries of
// the free categories it allows (a standard language, an artisan's tool). A player never
// needs a book to see the list.

import type { Item } from '../data/items'
import type { Language } from '../data/languages'
import {
  valueText,
  readWeaponFilter,
  type GrantKind,
  type PickSpec,
} from '../data/grants'
import type { PickKind } from '../character/picks'
import { grantCovers } from './proficiencies'

/** The data the free categories are read from. */
export interface PickCatalog {
  languages: readonly Language[]
  items: readonly Item[]
  /** The books of the character; the free categories offer only what these print. */
  books?: readonly string[]
}

/** One value a pick can take. */
export interface PickOption {
  kind: PickKind
  /** The data's own key. */
  value: string
  label: string
}

const ARMOR_OPTIONS: PickOption[] = [
  { kind: 'armor', value: 'light', label: 'Light armor' },
  { kind: 'armor', value: 'medium', label: 'Medium armor' },
  { kind: 'armor', value: 'heavy', label: 'Heavy armor' },
  { kind: 'armor', value: 'shield', label: 'Shields' },
]

/** The item type codes of each free tool category. */
const TOOL_TYPES: Record<string, string[]> = {
  anyArtisansTool: ['AT'],
  anyGamingSet: ['GS'],
  anyMusicalInstrument: ['INS'],
  anyTool: ['AT', 'T', 'GS', 'INS'],
}

const LANGUAGE_TYPES: Record<string, string[] | undefined> = {
  anyStandard: ['standard'],
  anyExotic: ['exotic', 'rare'],
  anyLanguage: undefined,
}

const byName = (a: PickOption, b: PickOption) => a.label.localeCompare(b.label)

/** Each name once, whichever edition prints it first. */
function distinct(options: PickOption[]): PickOption[] {
  const seen = new Set<string>()
  return options.filter((o) => (seen.has(o.value) ? false : (seen.add(o.value), true)))
}

const plain = (item: Item) => !item.magic && !item.variant

const inBooks = (catalog: PickCatalog, source: string) =>
  catalog.books === undefined || catalog.books.includes(source)

function languages(any: string, catalog: PickCatalog): PickOption[] {
  const types = LANGUAGE_TYPES[any]
  return catalog.languages
    .filter((l) => {
      const printed = l.entries.filter((e) => inBooks(catalog, e.source))
      return types
        ? printed.some((e) => types.includes(e.type))
        : printed.some((e) => e.type !== 'secret')
    })
    .map((l) => ({ kind: 'language', value: l.name.toLowerCase(), label: l.name }))
}

function tools(any: string, catalog: PickCatalog): PickOption[] {
  const types = TOOL_TYPES[any]
  return catalog.items
    .filter(
      (i) =>
        plain(i) &&
        inBooks(catalog, i.source) &&
        i.type !== undefined &&
        types.includes(i.type),
    )
    .map((i) => ({ kind: 'tool', value: i.name.toLowerCase(), label: i.name }))
}

function weapons(spec: PickSpec, catalog: PickCatalog): PickOption[] {
  const filter = spec.filter === undefined ? undefined : readWeaponFilter(spec.filter)
  return catalog.items
    .filter(
      (i) =>
        plain(i) &&
        inBooks(catalog, i.source) &&
        i.kind === 'weapon' &&
        i.weapon !== undefined &&
        (filter === undefined || grantCovers(filter, i, i.name)),
    )
    .map((i) => ({ kind: 'weapon', value: i.name.toLowerCase(), label: i.name }))
}

/** The values a pick can take: the ones it names, then the categories it allows. */
export function pickOptions(spec: PickSpec, catalog: PickCatalog): PickOption[] {
  const named = spec.from.map((v): PickOption => ({
    kind: v.kind as PickKind,
    value: v.key,
    label: valueText(v),
  }))
  const free = spec.any.flatMap((any): PickOption[] => {
    if (any in LANGUAGE_TYPES) return languages(any, catalog)
    if (any in TOOL_TYPES) return tools(any, catalog)
    if (any === 'anyArmor') return ARMOR_OPTIONS
    if (any === 'anyWeapon') return weapons(spec, catalog)
    return []
  })
  // A filter without a category ("a martial weapon with the light property") is a weapon list.
  const filtered =
    spec.filter !== undefined && spec.any.length === 0 ? weapons(spec, catalog) : []
  return distinct([...named, ...free, ...filtered]).sort(byName)
}

/** The kind a card for this pick shows: a mixed pick shows the kinds other cards do not. */
export function ownKinds(kinds: readonly GrantKind[]): PickKind[] {
  return kinds.filter(
    (k): k is Exclude<GrantKind, 'mixed' | 'skill'> => k !== 'mixed' && k !== 'skill',
  )
}

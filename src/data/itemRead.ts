// Reading one row of the item data into an Item: base items, magic items, and the
// parts of a generic variant. Everything the table needs is read here, once.

import { stripTags } from '../text/tags'
import { titleCase } from '../text/titleCase'
import type { Entry } from '../text/Entries'
import type { Copyable } from './copy'
import type { Edition } from './edition'
import {
  armorClassOf,
  attachedSpellsOf,
  attunementOf,
  bonusesOf,
  categoryOf,
  chargesOf,
  codeOf,
  containerOf,
  damageTypesOf,
  kindOf,
  parseDice,
  parseRange,
  strengthOf,
  traitsOf,
  vehicleOf,
} from './itemText'
import type { Item, ItemMastery, ItemProperty, ItemWeapon, PackPart } from './itemTypes'
import { srdNameOf, inFreeRules } from './srd'

/** A row of the item files: its identity and whatever else the data states. */
export type RawItem = Copyable

type Fields = Record<string, unknown>

/** The lookups an item is read with, built from the lookup tables of the data. */
export interface ItemLookups {
  edition: (source: string) => Edition
  /** A property by its reference ("H|XPHB"; no source means the 2014 Player's Handbook). */
  property: (reference: string) => PropertyRow | undefined
  /** A weapon mastery by its reference ("Vex|XPHB"). */
  mastery: (reference: string) => ItemMastery | undefined
  /** The name of an item type, by its code. */
  typeName: (code: string) => string | undefined
}

/** A property as the data states it: its name, rule and the template of its label. */
export interface PropertyRow {
  code: string
  name: string
  rule: string
  template?: string
}

/** A row of itemProperty, itemMastery or itemType. */
export interface LookupRow {
  name?: string
  abbreviation?: string
  source: string
  template?: string
  entries?: Entry[]
}

const isText = (v: unknown): v is string => typeof v === 'string'
const isNumber = (v: unknown): v is number => typeof v === 'number'
const texts = (v: unknown): string[] => (Array.isArray(v) ? v.filter(isText) : [])

/** The words of a block of entries, tags removed. */
export function plainText(entries: unknown): string {
  if (isText(entries)) return stripTags(entries)
  if (Array.isArray(entries)) return entries.map(plainText).filter(Boolean).join(' ')
  if (entries !== null && typeof entries === 'object' && 'entries' in entries)
    return plainText(entries.entries)
  return ''
}

const ruleName = (row: LookupRow) => {
  const first = row.entries?.[0]
  return first !== null && typeof first === 'object' && 'name' in first
    ? String(first.name)
    : (row.name ?? row.abbreviation ?? '')
}

/** The lookups from the rows of the lookup tables and the book dates. */
export function makeLookups(
  tables: { properties: LookupRow[]; masteries: LookupRow[]; types: LookupRow[] },
  edition: (source: string) => Edition,
): ItemLookups {
  const properties = new Map<string, LookupRow>()
  for (const row of tables.properties)
    properties.set(`${row.abbreviation}|${row.source}`, row)
  const masteries = new Map(
    tables.masteries.map((row) => [`${row.name}|${row.source}`, row]),
  )
  const types = new Map<string, string>()
  // The 2014 and the 2024 books name a type the same way; the first one stands.
  for (const row of tables.types)
    if (row.abbreviation && row.name && !types.has(row.abbreviation))
      types.set(row.abbreviation, row.name)
  return {
    edition,
    typeName: (code) => types.get(code),
    property: (reference) => {
      const [code, source = 'PHB'] = reference.split('|')
      const row = properties.get(`${code}|${source}`)
      if (!row) return undefined
      return {
        code,
        name: ruleName(row),
        rule: plainText(row.entries),
        template: row.template,
      }
    },
    mastery: (reference) => {
      const [name, source = 'XPHB'] = reference.split('|')
      const row = masteries.get(`${name}|${source}`)
      return row ? { name, rule: plainText(row.entries) } : { name, rule: '' }
    },
  }
}

/** The text of a property for one item: its template filled in ("Thrown (Range 20/60 ft.)"). */
function propertyLabel(property: PropertyRow, raw: Fields): string {
  const template = property.template
  if (!template?.includes('{{')) return property.name
  return template
    .replace(/\{\{([^}]+)\}\}/g, (_match, field: string) => {
      if (field === 'prop_name') return property.name
      if (field === 'prop_name_lower') return property.name.toLowerCase()
      const value = raw[field.replace('item.', '')]
      return isText(value) || isNumber(value) ? titleCase(codeOf(String(value))) : ''
    })
    .replace(/^./, (c) => c.toUpperCase())
}

const SIGNED_PLACEHOLDER = /\{=(\w+)\}/g

/** Entries with `{=bonusWeapon}` style placeholders filled from the item's own fields. */
export function fillPlaceholders(entries: Entry[], raw: Fields): Entry[] {
  const text = JSON.stringify(entries)
  if (!text.includes('{=')) return entries
  const filled = text.replace(SIGNED_PLACEHOLDER, (match, field: string) => {
    const value = raw[field]
    return isText(value) || isNumber(value) ? String(value) : match
  })
  return JSON.parse(filled) as Entry[]
}

const FAMILY = [
  'sword',
  'axe',
  'bow',
  'crossbow',
  'dagger',
  'hammer',
  'mace',
  'polearm',
  'spear',
  'staff',
  'club',
  'lance',
  'rapier',
  'net',
  'arrow',
  'bolt',
]

/** Every row has a name and a source; the rest is read by `readItem`. */
export function readItem(raw: RawItem, lookups: ItemLookups): Item {
  const { name, source } = raw
  const typeRef = isText(raw.type) ? raw.type : undefined
  const type = typeRef === undefined ? undefined : codeOf(typeRef)
  const kind = kindOf(raw)
  const rarityText = isText(raw.rarity) ? raw.rarity : undefined
  const rarity =
    rarityText === undefined || rarityText === 'none'
      ? undefined
      : rarityText === 'unknown (magic)'
        ? 'unknown'
        : rarityText
  const stated = rarity !== undefined && rarityText !== 'unknown'
  const melee = type !== 'R'
  const classOf = armorClassOf(type)

  const weapon = readWeapon(raw, lookups, melee)
  const armor =
    classOf !== undefined ||
    isNumber(raw.ac) ||
    raw.strength !== undefined ||
    raw.stealth === true
      ? {
          base: classOf === 'shield' ? undefined : isNumber(raw.ac) ? raw.ac : undefined,
          bonus: classOf === 'shield' && isNumber(raw.ac) ? raw.ac : undefined,
          strength: strengthOf(raw.strength),
          stealth: raw.stealth === true,
          dexterityMax: isNumber(raw.dexterityMax) ? raw.dexterityMax : undefined,
          class: classOf,
        }
      : undefined

  return {
    key: `${name}|${source}`,
    name,
    source,
    srdName: srdNameOf(raw),
    page: isNumber(raw.page) ? raw.page : undefined,
    edition:
      raw.edition === 'classic' || raw.edition === 'one'
        ? raw.edition
        : lookups.edition(source),
    kind,
    type,
    category: categoryOf(kind, raw, type ? lookups.typeName(type) : undefined, melee),
    rarity,
    magic: stated || raw.wondrous === true || raw.staff === true,
    tier: raw.tier === 'major' || raw.tier === 'minor' ? raw.tier : undefined,
    weight: isNumber(raw.weight) ? raw.weight : undefined,
    weightNote: isText(raw.weightNote) ? raw.weightNote : undefined,
    value: isNumber(raw.value) ? raw.value : undefined,
    weapon,
    armor,
    attunement: attunementOf(raw.reqAttune, raw.reqAttuneTags),
    grantsProficiency: raw.grantsProficiency === true ? true : undefined,
    firearm: raw.firearm === true ? true : undefined,
    bonuses: bonusesOf(raw),
    charges: chargesOf(raw),
    spells: attachedSpellsOf(raw.attachedSpells),
    container: containerOf(raw.containerCapacity),
    vehicle: vehicleOf(raw),
    traits: traitsOf(raw),
    details: [raw.detail1, raw.detail2].filter(isText),
    groups: [],
    family: FAMILY.filter((flag) => raw[flag] === true),
    focus: isText(raw.scfType) ? raw.scfType : undefined,
    free: inFreeRules(raw),
    // A 2014 tool's text is in `additionalEntries` (printed in a later book), often alone.
    entries: fillPlaceholders(
      [...entryList(raw.entries), ...entryList(raw.additionalEntries)],
      raw,
    ),
  }
}

const entryList = (value: unknown): Entry[] =>
  Array.isArray(value) ? (value as Entry[]) : []

function readWeapon(
  raw: Fields,
  lookups: ItemLookups,
  melee: boolean,
): ItemWeapon | undefined {
  const type = isText(raw.type) ? codeOf(raw.type) : undefined
  if (!isText(raw.dmg1) && type !== 'M' && type !== 'R') return undefined
  const damageTypes = damageTypesOf(raw.dmgType)
  const properties = texts(raw.property).map((reference): ItemProperty => {
    const property = lookups.property(reference) ?? {
      code: codeOf(reference),
      name: codeOf(reference),
      rule: '',
    }
    return {
      code: property.code,
      name: property.name,
      rule: property.rule,
      label: propertyLabel(property, raw),
    }
  })
  const range = parseRange(raw.range)
  return {
    category:
      raw.weaponCategory === 'simple' || raw.weaponCategory === 'martial'
        ? raw.weaponCategory
        : undefined,
    melee,
    damage: parseDice(raw.dmg1),
    versatile: parseDice(raw.dmg2),
    damageTypes,
    properties,
    range,
    mastery: texts(raw.mastery).map(
      (reference) => lookups.mastery(reference) ?? { name: codeOf(reference), rule: '' },
    ),
    ammoType: isText(raw.ammoType) ? titleCase(codeOf(raw.ammoType)) : undefined,
  }
}

/** The parts of a pack, with the items they are found among. */
export function packOf(
  raw: unknown,
  find: (reference: string) => Item | undefined,
): PackPart[] | undefined {
  if (!Array.isArray(raw)) return undefined
  const part = (reference: string, quantity: number): PackPart => {
    const item = find(reference)
    return { key: item?.key, name: item?.name ?? titleCase(codeOf(reference)), quantity }
  }
  const parts = raw.flatMap((entry): PackPart[] => {
    if (isText(entry)) return [part(entry, 1)]
    if (entry === null || typeof entry !== 'object' || !('item' in entry)) return []
    if (!isText(entry.item)) return []
    return [
      part(
        entry.item,
        'quantity' in entry && isNumber(entry.quantity) ? entry.quantity : 1,
      ),
    ]
  })
  return parts.length > 0 ? parts : undefined
}

/**
 * What a row that names a base item takes from it: the numbers that make it that
 * kind of weapon or armor. The row's own values win.
 */
const FROM_BASE = [
  'type',
  'weaponCategory',
  'dmg1',
  'dmg2',
  'dmgType',
  'property',
  'mastery',
  'range',
  'ac',
  'strength',
  'stealth',
  'dexterityMax',
  'ammoType',
  'reload',
  'weight',
  ...FAMILY,
]

export function inheritBase(raw: RawItem, base: RawItem | undefined): RawItem {
  if (!base) return raw
  const inherited: Fields = {}
  for (const field of FROM_BASE)
    if (raw[field] === undefined && base[field] !== undefined)
      inherited[field] = base[field]
  return { ...raw, ...inherited }
}

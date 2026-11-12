// Generic magic variants ("+1 Weapon", "Armor of Resistance"): a variant is a
// template, not an item. It is one row of the item table; a made item is the
// template laid over the base item it is applied to (applyVariant).

import { codeOf } from './itemText'
import { readItem, type ItemLookups, type RawItem } from './itemRead'
import type { Item, ItemKind, ItemProperty, VariantClause } from './itemTypes'
import { DAMAGE_TYPE_LABELS, ITEM_KIND_LABELS } from './labels'

type Fields = Record<string, unknown>

const isText = (v: unknown): v is string => typeof v === 'string'
const isRecord = (v: unknown): v is Fields =>
  v !== null && typeof v === 'object' && !Array.isArray(v)
const texts = (v: unknown): string[] => (Array.isArray(v) ? v.filter(isText) : [])

const WEAPON_FLAGS = [
  'sword',
  'axe',
  'bow',
  'crossbow',
  'polearm',
  'spear',
  'net',
  'weapon',
]
const AMMO_FLAGS = ['arrow', 'bolt', 'ammo']
const ARMOR_CODES: Record<string, string> = { LA: 'light', MA: 'medium', HA: 'heavy' }
const FOCUS_NAMES: Record<string, string> = {
  arcane: 'arcane focus',
  holy: 'holy symbol',
  druid: 'druidic focus',
}

/** What a clause is about: the kind of item it asks for, when it says. */
function clauseKind(clause: VariantClause): ItemKind | undefined {
  const type = isText(clause.type) ? codeOf(clause.type) : undefined
  if (type === 'M' || type === 'R') return 'weapon'
  if (type !== undefined && type in ARMOR_CODES) return 'armor'
  if (type === 'S') return 'shield'
  if (type === 'A' || type === 'AF') return 'ammunition'
  if (clause.armor === true) return 'armor'
  if (AMMO_FLAGS.some((flag) => clause[flag] === true)) return 'ammunition'
  if (isText(clause.scfType)) return 'focus'
  if (
    WEAPON_FLAGS.some((flag) => clause[flag] === true) ||
    clause.weaponCategory !== undefined ||
    clause.property !== undefined ||
    clause.dmgType !== undefined
  )
    return 'weapon'
  return undefined
}

/** What a template makes: by what it asks for, else by the kind of the items it names. */
function variantKind(
  requires: VariantClause[],
  raw: RawItem,
  kindOfNamed: (name: string, source: string) => ItemKind | undefined,
): ItemKind {
  for (const clause of requires) {
    const kind = clauseKind(clause)
    if (kind) return kind
  }
  for (const clause of requires)
    if (isText(clause.name) && isText(clause.source)) {
      const kind = kindOfNamed(clause.name, clause.source)
      if (kind) return kind
    }
  return raw.ammo === true ? 'ammunition' : 'other'
}

/** Where a clause applies, in words ("sword", "light armor"); undefined when it names an item. */
function clauseText(
  clause: VariantClause,
  propertyName: (code: string) => string,
): string {
  const type = isText(clause.type) ? codeOf(clause.type) : undefined
  if (isText(clause.name)) return clause.name
  if (type === 'M') return 'any melee weapon'
  if (type === 'R') return 'any ranged weapon'
  if (type !== undefined && type in ARMOR_CODES) return `any ${ARMOR_CODES[type]} armor`
  if (type === 'S') return 'any shield'
  if (type === 'A' || type === 'AF') return 'any ammunition'
  if (clause.armor === true) return 'any armor'
  if (isText(clause.scfType))
    return `any ${FOCUS_NAMES[clause.scfType] ?? clause.scfType}`
  const flag = [...WEAPON_FLAGS, ...AMMO_FLAGS].find((name) => clause[name] === true)
  const category = isText(clause.weaponCategory) ? `${clause.weaponCategory} ` : ''
  const damage = isText(clause.dmgType)
    ? `${(DAMAGE_TYPE_LABELS[clause.dmgType] ?? '').toLowerCase()} `
    : ''
  const property = isText(clause.property)
    ? ` with the ${propertyName(clause.property).toLowerCase()} property`
    : ''
  const noun = flag && flag !== 'weapon' ? flag : 'weapon'
  return `any ${category}${damage}${noun}${property}`
}

/** "Any weapon", "Any light, medium or heavy armor", "Longsword or Rapier". */
export function appliesToText(
  requires: VariantClause[],
  propertyName: (code: string) => string,
): string {
  if (requires.length === 0) return 'See the item text'
  const phrases = [...new Set(requires.map((clause) => clauseText(clause, propertyName)))]
  const merged = phrases.length > 1 ? mergeArmor(phrases) : phrases
  const text =
    merged.length > 1
      ? `${merged.slice(0, -1).join(', ')} or ${merged[merged.length - 1]}`
      : merged[0]
  return text.replace(/^./, (c) => c.toUpperCase())
}

/** "any light armor", "any medium armor", "any heavy armor" read as one phrase. */
function mergeArmor(phrases: string[]): string[] {
  const weights = ['light', 'medium', 'heavy'].map((w) => `any ${w} armor`)
  if (!weights.every((phrase) => phrases.includes(phrase))) return phrases
  return [
    'any light, medium or heavy armor',
    ...phrases.filter((phrase) => !weights.includes(phrase)),
  ]
}

/** One generic variant as a row of the item table. */
export function readVariant(
  raw: RawItem,
  lookups: ItemLookups,
  kindOfNamed: (name: string, source: string) => ItemKind | undefined,
): Item {
  const inherits = isRecord(raw.inherits) ? raw.inherits : {}
  const requires = (Array.isArray(raw.requires) ? raw.requires : []).filter(isRecord)
  const excludes = isRecord(raw.excludes) ? raw.excludes : {}
  const {
    namePrefix,
    nameSuffix,
    nameRemove,
    valueExpression,
    weightExpression,
    propertyAdd,
    ...facts
  } = inherits
  const source = isText(facts.source) ? facts.source : raw.source
  const made = readItem(
    {
      ...facts,
      name: raw.name,
      source,
      edition: raw.edition,
      entries: facts.entries ?? raw.entries,
    },
    lookups,
  )
  const kind = variantKind(requires, raw, kindOfNamed)
  return {
    ...made,
    kind,
    type: undefined,
    category: `${ITEM_KIND_LABELS[kind]} (generic variant)`,
    magic: true,
    variant: {
      requires,
      excludes,
      appliesTo: appliesToText(requires, (code) => lookups.property(code)?.name ?? code),
      namePrefix: isText(namePrefix) ? namePrefix : undefined,
      nameSuffix: isText(nameSuffix) ? nameSuffix : undefined,
      nameRemove: isText(nameRemove) ? nameRemove : undefined,
      valueExpression: isText(valueExpression) ? valueExpression : undefined,
      weightExpression: isText(weightExpression) ? weightExpression : undefined,
      propertyAdd: texts(propertyAdd).flatMap((reference): ItemProperty[] => {
        const property = lookups.property(reference)
        return property
          ? [
              {
                code: property.code,
                name: property.name,
                rule: property.rule,
                label: property.name,
              },
            ]
          : []
      }),
    },
  }
}

const EXPRESSION = /^\[\[baseItem\.\w+\]\]\s*([*+-])\s*(\d+(?:\.\d+)?)$/

/** "[[baseItem.value]] * 4" worked out from the base item's number; undefined when it cannot be. */
export function evaluateExpression(
  expression: string,
  baseValue: number | undefined,
): number | undefined {
  const match = EXPRESSION.exec(expression.trim())
  if (!match || baseValue === undefined) return undefined
  const amount = Number(match[2])
  if (match[1] === '*') return baseValue * amount
  return match[1] === '+' ? baseValue + amount : baseValue - amount
}

/** The base item's name with the template's wording around it: "+1 " and "Longsword". */
function madeName(template: Item, base: Item): string {
  const {
    namePrefix = '',
    nameSuffix = '',
    nameRemove,
  } = template.variant ?? { propertyAdd: [] }
  const stem = nameRemove ? base.name.replace(nameRemove, '') : base.name
  return `${namePrefix}${stem}${nameSuffix}`
}

/**
 * The item a template makes of a base item: the base item's own numbers (damage,
 * armor class, weight) with what the template adds (the bonus, the rarity, the
 * attunement, the text) laid over them.
 */
export function applyVariant(template: Item, base: Item): Item {
  const variant = template.variant
  if (!variant) return base
  const name = madeName(template, base)
  const value = variant.valueExpression
    ? evaluateExpression(variant.valueExpression, base.value)
    : undefined
  const weight = variant.weightExpression
    ? evaluateExpression(variant.weightExpression, base.weight)
    : base.weight
  const armor = base.armor
    ? {
        ...base.armor,
        strength: template.armor?.strength ?? base.armor.strength,
        stealth: base.armor.stealth || template.armor?.stealth === true,
      }
    : undefined
  return {
    ...base,
    key: `${name}|${template.source}`,
    name,
    source: template.source,
    srdName: template.srdName,
    page: template.page,
    edition: template.edition,
    twin: undefined,
    rarity: template.rarity,
    magic: true,
    tier: template.tier,
    weight,
    value,
    weapon: base.weapon && {
      ...base.weapon,
      properties: [...base.weapon.properties, ...variant.propertyAdd],
    },
    armor,
    attunement: template.attunement,
    bonuses: [...base.bonuses, ...template.bonuses],
    speed: template.speed ?? base.speed,
    charges: template.charges,
    spells: [...base.spells, ...template.spells],
    traits: [...base.traits, ...template.traits],
    details: template.details,
    groups: [],
    free: template.free,
    entries: template.entries,
    variant: undefined,
  }
}

/** Whether one clause of a template's `requires` or `excludes` fits a base item. */
function clauseFits(clause: VariantClause, base: Item): boolean {
  return Object.entries(clause).every(([field, want]) => {
    switch (field) {
      case 'type':
        return isText(want) && base.type === codeOf(want)
      case 'name':
        return isText(want) && base.name.toLowerCase() === want.toLowerCase()
      case 'source':
        return want === base.source
      case 'weaponCategory':
        return base.weapon?.category === want
      case 'property':
        return (
          isText(want) &&
          (base.weapon?.properties ?? []).some((p) => p.code === codeOf(want))
        )
      case 'dmgType':
        return (
          isText(want) &&
          (base.weapon?.damageTypes ?? []).includes(DAMAGE_TYPE_LABELS[want])
        )
      case 'scfType':
        return base.focus === want
      case 'weapon':
        return want === true && base.weapon !== undefined
      case 'armor':
        return (
          want === true &&
          base.armor?.class !== undefined &&
          base.armor.class !== 'shield'
        )
      default:
        return want === true && base.family.includes(field)
    }
  })
}

/** Whether a template can be applied to a base item (never to a magic item or a template). */
export function variantApplies(template: Item, base: Item): boolean {
  const variant = template.variant
  if (!variant || variant.requires.length === 0 || base.variant || base.magic)
    return false
  if (!variant.requires.some((clause) => clauseFits(clause, base))) return false
  return !Object.entries(variant.excludes).some(([field, want]) =>
    clauseFits({ [field]: want }, base),
  )
}

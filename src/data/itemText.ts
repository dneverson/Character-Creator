// Reading the facts of an item out of the data: pure functions from the data's
// codes and shapes to the words and numbers a table shows. An item that is missing
// a fact simply has none; nothing is guessed.

import { titleCase } from '../text/titleCase'
import {
  BONUS_LABELS,
  DAMAGE_TYPE_LABELS,
  feet,
  ITEM_KIND_LABELS,
  RECHARGE_LABELS,
} from './labels'
import { lookup } from './glossary'
import type {
  AttachedSpell,
  Bonus,
  Dice,
  ItemAttunement,
  ItemCharges,
  ItemArmor,
  ItemContainer,
  ItemKind,
  ItemVehicle,
} from './itemTypes'

type Fields = Record<string, unknown>

const isText = (v: unknown): v is string => typeof v === 'string'
const isNumber = (v: unknown): v is number => typeof v === 'number'
const isRecord = (v: unknown): v is Fields =>
  v !== null && typeof v === 'object' && !Array.isArray(v)
const texts = (v: unknown): string[] => (Array.isArray(v) ? v.filter(isText) : [])

/** The name items are sorted by: without a leading "+1 ", or every bonus item comes first. */
export const nameSortKey = (name: string) => name.replace(/^\+\d+\s+/, '')

/** The code of a "CODE|SOURCE" reference. */
export const codeOf = (reference: string) => reference.split('|')[0]

/** A roll with its markup removed: "{@dice 1d6 + 4}" is "1d6 + 4". */
export function diceText(text: string): string {
  return text.replace(/\{@(?:dice|damage)\s+([^|}]*)[^}]*\}/g, '$1').trim()
}

/** A roll such as "1d8" or "2d6 + 3", with its average; undefined when it is no roll. */
export function parseDice(raw: unknown): Dice | undefined {
  const text = isText(raw) ? diceText(raw) : isNumber(raw) ? String(raw) : ''
  if (!/^\d+(d\d+)?(\s*[+-]\s*\d+(d\d+)?)*$/.test(text)) return undefined
  let average = 0
  for (const [, sign, count, sides] of text.matchAll(/([+-]?)\s*(\d+)(?:d(\d+))?/g)) {
    const amount = sides ? (Number(count) * (Number(sides) + 1)) / 2 : Number(count)
    average += sign === '-' ? -amount : amount
  }
  return { text, average }
}

/** "120/360" is a normal range of 120 feet and a long range of 360. */
export function parseRange(raw: unknown): { normal: number; long?: number } | undefined {
  if (!isText(raw)) return undefined
  const [normal, long] = raw.split('/').map(Number)
  if (!Number.isFinite(normal)) return undefined
  return Number.isFinite(long) ? { normal, long } : { normal }
}

/** A range in words: "120/360 ft.". */
export const rangeLabel = (range: { normal: number; long?: number }) =>
  `${range.normal}${range.long === undefined ? '' : `/${range.long}`} ft.`

/** A bonus with its sign: "+1". */
export function signed(raw: unknown): string | undefined {
  if (isNumber(raw)) return raw < 0 ? String(raw) : `+${raw}`
  if (!isText(raw) || raw === '') return undefined
  return /^[+-]/.test(raw) ? raw : `+${raw}`
}

/** Every bonus an item gives, with what each applies to. */
export function bonusesOf(raw: Fields): Bonus[] {
  return Object.entries(BONUS_LABELS).flatMap(([field, what]) => {
    const value = signed(raw[field])
    return value ? [{ what, value }] : []
  })
}

/** "13" is 13; anything else has no Strength requirement. */
export function strengthOf(raw: unknown): number | undefined {
  const value = isText(raw) ? Number(raw) : raw
  return isNumber(value) && Number.isFinite(value) && value > 0 ? value : undefined
}

/** What an item asks of the one who attunes to it. */
export function attunementOf(
  reqAttune: unknown,
  tags: unknown,
): ItemAttunement | undefined {
  if (reqAttune === undefined || reqAttune === false) return undefined
  const classes = (Array.isArray(tags) ? tags : [])
    .flatMap((tag) => (isRecord(tag) && isText(tag.class) ? [codeOf(tag.class)] : []))
    .map((name) => name.toLowerCase())
  if (reqAttune === 'optional') return { required: false, optional: true, classes }
  return {
    required: true,
    optional: false,
    text: isText(reqAttune) ? reqAttune : undefined,
    classes,
  }
}

/** The name of a spell as the data writes it ("bigby's hand#9", "arcane lock|xphb"). */
const spellName = (raw: string) => titleCase(raw.split(/[|#]/)[0])

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`

/** How a spell is held, by the way the item keys it ("1e" is one use of each spell). */
function howOf(group: string, key: string): string {
  const each = key.endsWith('e')
  const n = parseInt(key, 10)
  switch (group) {
    case 'charges':
      return plural(n, 'charge')
    case 'daily':
      return `${n} per day${each ? ' each' : ''}`
    case 'rest':
      return `${n} per rest${each ? ' each' : ''}`
    case 'limited':
      return plural(n, 'use')
    default:
      return ''
  }
}

/** The spells an item holds: a plain list, or lists by how they are cast. */
export function attachedSpellsOf(raw: unknown): AttachedSpell[] {
  if (Array.isArray(raw))
    return texts(raw).map((name) => ({ name: spellName(name), how: '' }))
  if (!isRecord(raw)) return []
  const spells: AttachedSpell[] = []
  for (const [group, value] of Object.entries(raw)) {
    if (group === 'ability') continue
    if (Array.isArray(value)) {
      const how = group === 'will' ? 'at will' : group === 'ritual' ? 'as a ritual' : ''
      for (const name of texts(value)) spells.push({ name: spellName(name), how })
    } else if (isRecord(value)) {
      for (const [key, names] of Object.entries(value))
        for (const name of texts(names))
          spells.push({ name: spellName(name), how: howOf(group, key) })
    }
  }
  return spells
}

/** "at dawn", "after a long rest"; a word nobody decoded is kept as it is. */
export const rechargeText = (code: string | undefined) =>
  code === undefined ? undefined : (RECHARGE_LABELS[code] ?? code)

/** The charges of an item: how many, when they return, how many return. */
export function chargesOf(raw: Fields): ItemCharges | undefined {
  const max = isNumber(raw.charges)
    ? String(raw.charges)
    : isText(raw.charges)
      ? diceText(raw.charges)
      : undefined
  if (max === undefined) return undefined
  const amount = isNumber(raw.rechargeAmount)
    ? String(raw.rechargeAmount)
    : isText(raw.rechargeAmount)
      ? diceText(raw.rechargeAmount)
      : undefined
  return {
    max,
    recharge: rechargeText(isText(raw.recharge) ? raw.recharge : undefined),
    amount,
  }
}

/** Charges in a sentence: "7, regains 1d6 + 4 at dawn". */
export function chargesText(charges: ItemCharges): string {
  const back = [
    charges.amount ? `regains ${charges.amount}` : undefined,
    charges.recharge,
  ]
    .filter(Boolean)
    .join(' ')
  return back ? `${charges.max}, ${back}` : charges.max
}

/** What a container holds. */
export function containerOf(raw: unknown): ItemContainer | undefined {
  if (!isRecord(raw) || !Array.isArray(raw.weight) || !isNumber(raw.weight[0]))
    return undefined
  return { weight: raw.weight[0], weightless: raw.weightless === true }
}

const KIND_OF_TYPE: Record<string, ItemKind> = {
  M: 'weapon',
  R: 'weapon',
  LA: 'armor',
  MA: 'armor',
  HA: 'armor',
  S: 'shield',
  A: 'ammunition',
  AF: 'ammunition',
  G: 'gear',
  T: 'tool',
  AT: 'tool',
  GS: 'tool',
  INS: 'instrument',
  SCF: 'focus',
  P: 'potion',
  SC: 'scroll',
  RG: 'ring',
  RD: 'rod',
  WD: 'wand',
  ST: 'staff',
  W: 'wondrous',
  VEH: 'vehicle',
  SHP: 'vehicle',
  SPC: 'vehicle',
  AIR: 'vehicle',
  MNT: 'mount',
  TAH: 'tack',
  FD: 'food',
  TG: 'trade',
  TB: 'trade',
  $: 'treasure',
  $A: 'treasure',
  $G: 'treasure',
  $C: 'coin',
  EXP: 'explosive',
}

/** What an item is: by its type code, else by what it is flagged as, else by what it does. */
export function kindOf(raw: Fields): ItemKind {
  const code = isText(raw.type) ? codeOf(raw.type) : undefined
  const byType = code === undefined ? undefined : KIND_OF_TYPE[code]
  if (byType) return byType
  if (raw.staff === true) return 'staff'
  if (raw.wondrous === true) return 'wondrous'
  if (isText(raw.dmg1)) return 'weapon'
  return 'other'
}

const ARMOR_CLASS: Record<string, ItemArmor['class']> = {
  LA: 'light',
  MA: 'medium',
  HA: 'heavy',
  S: 'shield',
}

/** The armor class of an item, from the type code. */
export const armorClassOf = (code: string | undefined): ItemArmor['class'] =>
  code === undefined ? undefined : ARMOR_CLASS[code]

/** The type of an item in words: "Martial melee weapon", "Heavy armor", "Potion". */
export function categoryOf(
  kind: ItemKind,
  raw: Fields,
  typeName: string | undefined,
  melee: boolean,
): string {
  if (kind === 'weapon') {
    const category = isText(raw.weaponCategory) ? `${titleCase(raw.weaponCategory)} ` : ''
    return `${category}${melee ? 'melee' : 'ranged'} weapon`.replace(/^./, (c) =>
      c.toUpperCase(),
    )
  }
  if (kind === 'armor' || kind === 'shield') return typeName ?? ITEM_KIND_LABELS[kind]
  if (raw.tattoo === true) return 'Wondrous item (tattoo)'
  return typeName ?? ITEM_KIND_LABELS[kind]
}

const SIGNED = (n: number) => (n < 0 ? String(n) : `+${n}`)

function speedChangeText(raw: unknown): string[] {
  if (!isRecord(raw)) return []
  return Object.entries(raw).flatMap(([how, by]) =>
    isRecord(by)
      ? Object.entries(by).map(([mode, amount]) => {
          const way = mode === 'walk' ? 'walking' : mode
          if (how === 'equal') return `${way} speed equals your walking speed`
          if (how === 'multiply') return `${way} speed multiplied by ${String(amount)}`
          if (how === 'bonus' && isNumber(amount))
            return `${SIGNED(amount)} ft. ${way} speed`
          return `${way} speed ${isNumber(amount) ? feet(amount) : String(amount)}`
        })
      : [],
  )
}

const ABILITY_CODES = ['str', 'dex', 'con', 'int', 'wis', 'cha']

const abilityName = (code: string) => lookup(code.toUpperCase(), 'ability')?.full ?? code

function abilityText(raw: unknown): string[] {
  if (!isRecord(raw)) return []
  const lines: string[] = []
  const choice = (rule: Fields) => {
    const count = isNumber(rule.count) ? rule.count : 1
    const amount = isNumber(rule.amount) ? rule.amount : 1
    lines.push(
      `${SIGNED(amount)} to ${count === 1 ? 'one ability score' : `${count} ability scores`} of your choice`,
    )
  }
  if (isRecord(raw.static))
    for (const [code, score] of Object.entries(raw.static))
      lines.push(`Sets your ${abilityName(code)} to ${String(score)}`)
  if (Array.isArray(raw.choose)) raw.choose.filter(isRecord).forEach(choice)
  if (Array.isArray(raw.from)) choice(raw)
  for (const code of ABILITY_CODES)
    if (isNumber(raw[code])) lines.push(`${SIGNED(raw[code])} ${abilityName(code)}`)
  return lines
}

const listOf = (v: unknown): string[] =>
  (Array.isArray(v) ? v : []).flatMap((entry) =>
    isText(entry)
      ? [entry]
      : isRecord(entry) && Array.isArray(entry.resist)
        ? texts(entry.resist)
        : [],
  )

/** Everything else an item does, as short phrases. */
export function traitsOf(raw: Fields): string[] {
  const list = (label: string, field: string) => {
    const names = listOf(raw[field])
    return names.length > 0 ? [`${label} ${names.join(', ')}`] : []
  }
  const light = Array.isArray(raw.light) ? raw.light.find(isRecord) : undefined
  return [
    ...list('Resistance to', 'resist'),
    ...list('Immune to', 'immune'),
    ...list('Vulnerable to', 'vulnerable'),
    ...list('Immune to the conditions', 'conditionImmune'),
    ...(isRecord(raw.attachedSpells) && isText(raw.attachedSpells.ability)
      ? [`Spellcasting ability: ${abilityName(raw.attachedSpells.ability)}`]
      : []),
    ...speedChangeText(raw.modifySpeed),
    ...abilityText(raw.ability),
    ...(isNumber(raw.critThreshold) ? [`Critical hit on ${raw.critThreshold}-20`] : []),
    ...(light && isNumber(light.bright)
      ? [
          `Sheds bright light ${feet(light.bright)}${
            isNumber(light.dim) ? `, dim light ${feet(light.dim)} further` : ''
          }`,
        ]
      : []),
    ...(raw.grantsLanguage ? ['Grants a language'] : []),
    ...(raw.grantsProficiency ? ['Grants a proficiency'] : []),
    ...(raw.curse === true ? ['Cursed'] : []),
    ...(raw.sentient === true ? ['Sentient'] : []),
    ...(raw.poison === true ? ['Poison'] : []),
  ]
}

/** The damage types an item deals, in full. */
export const damageTypesOf = (code: unknown): string[] =>
  isText(code) ? [DAMAGE_TYPE_LABELS[code] ?? code] : []

/** A vehicle, ship or mount's own numbers. */
export function vehicleOf(raw: Fields): ItemVehicle | undefined {
  const crew = isNumber(raw.crew)
    ? String(raw.crew)
    : isNumber(raw.crewMin) && isNumber(raw.crewMax)
      ? `${raw.crewMin}-${raw.crewMax}`
      : undefined
  const vehicle: ItemVehicle = {
    speed: isNumber(raw.vehSpeed)
      ? `${raw.vehSpeed} mph`
      : isNumber(raw.speed)
        ? feet(raw.speed)
        : undefined,
    ac: isNumber(raw.vehAc) ? raw.vehAc : undefined,
    hp: isNumber(raw.vehHp) ? raw.vehHp : undefined,
    damageThreshold: isNumber(raw.vehDmgThresh) ? raw.vehDmgThresh : undefined,
    crew,
    cargoTons: isNumber(raw.capCargo) ? raw.capCargo : undefined,
    passengers: isNumber(raw.capPassenger) ? raw.capPassenger : undefined,
    carrying: isNumber(raw.carryingCapacity) ? raw.carryingCapacity : undefined,
  }
  return Object.values(vehicle).some((v) => v !== undefined) ? vehicle : undefined
}

// How a few stats that the data keeps as codes and numbers are written out. Pure
// text, so the same wording serves a table cell, a compare row and a summary.

import { lookup } from './glossary'
import type { ItemKind } from './itemTypes'
import { titleCase } from '../text/titleCase'

/** A distance, as the books write it. */
export const feet = (distance: number) => `${distance} ft.`

// "V" is how the data marks a creature whose size is the player's to choose.
const VARIES = 'V'

/** One size code in full; a code nobody knows is shown as it is. */
function sizeName(code: string): string {
  if (code === VARIES) return 'Varies'
  return lookup(code, 'size')?.full ?? code
}

/** The sizes a creature can be: "Medium", "Small or Medium". */
export function sizeLabel(sizes: string[] | undefined): string {
  return (sizes ?? []).map(sizeName).join(' or ')
}

/** One way of moving: a number, a flag, a number with a condition, or a choice of ways. */
export type SpeedValue =
  | number
  | boolean
  | { number: number; condition?: string }
  | { from: string[]; amount: number; note?: string }

/** A speed: one number for walking, or a number for each way of moving. */
export type Speed = number | Record<string, SpeedValue>

/** The distance of a way of moving, when it has one. */
export function speedDistance(value: SpeedValue | undefined): number | undefined {
  if (typeof value === 'number') return value
  if (value && typeof value === 'object' && 'number' in value) return value.number
  return undefined
}

/** The walking speed, 0 when there is none (for sorting by speed). */
export function walkingSpeed(speed: Speed | undefined): number {
  if (typeof speed === 'number') return speed
  return speedDistance(speed?.walk) ?? 0
}

/** One way of moving written out, "fly 60 ft. (air only)"; empty for a way that is absent. */
export function modeText(
  mode: string,
  value: SpeedValue,
  walk: number | undefined,
): string {
  if (value === false) return ''
  if (value === true) return walk === undefined ? mode : `${mode} ${feet(walk)}`
  if (typeof value === 'number') return value > 0 ? `${mode} ${feet(value)}` : ''
  if ('number' in value) {
    const note = value.condition ? ` ${value.condition}` : ''
    return `${mode} ${feet(value.number)}${note}`
  }
  const note = value.note ? ` ${value.note}` : ''
  return `${value.from.join(' or ')} ${feet(value.amount)}${note}`
}

/**
 * Every way of moving: "30 ft., fly 50 ft.". Walking leads and goes unnamed. A
 * way marked `true` in the data moves at the walking speed; one with a condition
 * carries it: "fly 60 ft. (air only)". `canHover` is a note, not a way of moving.
 */
export function speedLabel(speed: Speed | undefined): string {
  if (speed === undefined) return ''
  if (typeof speed === 'number') return feet(speed)
  const walk = speedDistance(speed.walk)
  const parts = walk === undefined ? [] : [feet(walk)]
  for (const [mode, value] of Object.entries(speed)) {
    if (mode === 'walk' || mode === 'canHover') continue
    const text = modeText(mode, value, walk)
    if (text) parts.push(text)
  }
  return parts.join(', ')
}

/** The rules edition a piece of content is written for, as the year players know it by. */
export const editionYear = (edition: 'classic' | 'one' | undefined) =>
  edition === 'one' ? '2024' : '2014'

/**
 * The senses a block of the data grants: "Blindsight 10 ft.". A bonus adds to a
 * sense the character already has: "Darkvision +60 ft.".
 */
export function senseText(senses: unknown[] | undefined, bonus = false): string {
  return (senses ?? [])
    .flatMap((block) => (block && typeof block === 'object' ? Object.entries(block) : []))
    .filter((entry): entry is [string, number] => typeof entry[1] === 'number')
    .map(([sense, range]) => `${titleCase(sense)} ${bonus ? '+' : ''}${feet(range)}`)
    .join(', ')
}

/**
 * What the spell data's area codes (`areaTags`) stand for. Each code is decoded;
 * the code itself is never shown.
 */
export const AREA_TAG_LABELS: Record<string, string> = {
  ST: 'Single target',
  MT: 'Multiple targets',
  S: 'Sphere',
  C: 'Cube',
  Y: 'Cylinder',
  W: 'Wall',
  N: 'Cone',
  L: 'Line',
  Q: 'Square',
  R: 'Circle',
  E: 'Emanation',
  H: 'Hemisphere',
}

/**
 * What the spell data's miscellaneous codes (`miscTags`) stand for. A code that
 * is not decoded here is left out of a spell's tags rather than shown raw.
 */
export const SPELL_TAG_LABELS: Record<string, string> = {
  HL: 'Healing',
  THP: 'Grants temporary hit points',
  SGT: 'Sight needed',
  PRM: 'Permanent effect',
  SCL: 'Scaling effect',
  SCT: 'Scaling targets',
  SMN: 'Summons',
  MAC: 'Modifies armor class',
  TP: 'Teleportation',
  FMV: 'Forced movement',
  PS: 'Plane shifting',
  OBS: 'Obscures vision',
  DFT: 'Difficult terrain',
  AAD: 'Additional attack damage',
  OBJ: 'Affects objects',
  ADV: 'Grants advantage or disadvantage',
  LGT: 'Creates light',
  LGTS: 'Creates sunlight',
  UBA: 'Uses a bonus action',
  UA: 'Uses an action',
  RO: 'Random outcome',
  BO: 'Ignites flammable objects',
  WLT: 'Targets willing creatures',
}

/** What the `components.r` mark is called: a payment owed to a third party. */
export const ROYALTY_LABEL = 'Royalty'

/** What an item is, in a word: the type facet of an item table. */
export const ITEM_KIND_LABELS: Record<ItemKind, string> = {
  weapon: 'Weapon',
  armor: 'Armor',
  shield: 'Shield',
  ammunition: 'Ammunition',
  gear: 'Adventuring gear',
  tool: 'Tools',
  instrument: 'Musical instrument',
  focus: 'Spellcasting focus',
  potion: 'Potion',
  scroll: 'Scroll',
  ring: 'Ring',
  rod: 'Rod',
  wand: 'Wand',
  staff: 'Staff',
  wondrous: 'Wondrous item',
  vehicle: 'Vehicle',
  mount: 'Mount',
  tack: 'Tack and harness',
  food: 'Food and drink',
  trade: 'Trade good',
  treasure: 'Treasure',
  explosive: 'Explosive',
  coin: 'Coinage',
  other: 'Other',
}

/** The damage letters of the item data in full. */
export const DAMAGE_TYPE_LABELS: Record<string, string> = {
  A: 'Acid',
  B: 'Bludgeoning',
  C: 'Cold',
  F: 'Fire',
  I: 'Poison',
  L: 'Lightning',
  N: 'Necrotic',
  O: 'Force',
  P: 'Piercing',
  R: 'Radiant',
  S: 'Slashing',
  T: 'Thunder',
  Y: 'Psychic',
}

/** When a magic item gets its charges back, as a phrase after "regains". */
export const RECHARGE_LABELS: Record<string, string> = {
  dawn: 'at dawn',
  dusk: 'at dusk',
  midnight: 'at midnight',
  restLong: 'after a long rest',
  special: 'as the item describes',
}

/** What each bonus field of an item applies to. */
export const BONUS_LABELS: Record<string, string> = {
  bonusWeapon: 'weapon attack and damage',
  bonusWeaponAttack: 'weapon attack',
  bonusWeaponDamage: 'weapon damage',
  bonusAc: 'AC',
  bonusSpellAttack: 'spell attack',
  bonusSpellSaveDc: 'spell save DC',
  bonusSpellDamage: 'spell damage',
  bonusSavingThrow: 'saving throws',
  bonusSavingThrowConcentration: 'concentration saving throws',
  bonusAbilityCheck: 'ability checks',
  bonusProficiencyBonus: 'proficiency bonus',
}

/** The armor classes: the weight of armor a type code stands for. */
export const ARMOR_CLASS_LABELS: Record<string, string> = {
  light: 'Light armor',
  medium: 'Medium armor',
  heavy: 'Heavy armor',
  shield: 'Shield',
}

/** The kinds of item a class or background offers a pick of ("any simple weapon"). */
export const EQUIPMENT_KIND_LABELS: Record<string, string> = {
  weaponSimple: 'Simple weapon',
  weaponMartial: 'Martial weapon',
  weaponSimpleMelee: 'Simple melee weapon',
  weaponMartialMelee: 'Martial melee weapon',
  focusSpellcastingArcane: 'Arcane focus',
  focusSpellcastingHoly: 'Holy symbol',
  focusSpellcastingDruidic: 'Druidic focus',
  instrumentMusical: 'Musical instrument',
  toolArtisan: "Artisan's tools",
  setGaming: 'Gaming set',
}

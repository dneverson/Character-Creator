// The shape of an item as the app uses it: every stat a player compares items by,
// read out of the data once (see itemRead) so a table never meets a raw code.

import type { Entry } from '../text/Entries'
import type { Edition } from './edition'

/** What an item is, decoded from its type code and flags. */
export type ItemKind =
  | 'weapon'
  | 'armor'
  | 'shield'
  | 'ammunition'
  | 'gear'
  | 'tool'
  | 'instrument'
  | 'focus'
  | 'potion'
  | 'scroll'
  | 'ring'
  | 'rod'
  | 'wand'
  | 'staff'
  | 'wondrous'
  | 'vehicle'
  | 'mount'
  | 'tack'
  | 'food'
  | 'trade'
  | 'treasure'
  | 'explosive'
  | 'coin'
  | 'other'

/** A die roll as the books write it, with the average for sorting and filtering. */
export interface Dice {
  /** "1d8", "2d6 + 3". */
  text: string
  average: number
}

/** A weapon property, named and explained by the data (itemProperty). */
export interface ItemProperty {
  code: string
  name: string
  /** The rule, in plain text: what the tooltip says. */
  rule: string
  /** What the property adds in the item's own words: "Ammunition (range 80/320)". */
  label: string
}

/** A 2024 weapon mastery, named and explained by the data (itemMastery). */
export interface ItemMastery {
  name: string
  rule: string
}

/** A bonus an item gives: what it applies to, and the signed amount. */
export interface Bonus {
  /** "weapon attack and damage", "AC", "spell save DC". */
  what: string
  /** "+1". */
  value: string
}

/**
 * How an item changes the ways its bearer moves, as the data states it (`modifySpeed`),
 * each by way of moving ("walk", "fly", or "*" for every one).
 */
export interface ItemSpeedChange {
  /** The speed becomes this many feet, unless it is already higher. */
  static: Record<string, number>
  /** The speed equals another of the bearer's speeds: { climb: "walk" }. */
  equal: Record<string, string>
  /** Feet added. */
  bonus: Record<string, number>
  /** The speed is multiplied. */
  multiply: Record<string, number>
}

/** A spell an item holds, and how it can be cast. */
export interface AttachedSpell {
  name: string
  /** "at will", "1 per day", "1 charge", "ritual". */
  how: string
}

export interface ItemWeapon {
  category?: 'simple' | 'martial'
  melee: boolean
  damage?: Dice
  /** The two-handed die of a versatile weapon. */
  versatile?: Dice
  /** Full names: "Slashing". */
  damageTypes: string[]
  properties: ItemProperty[]
  range?: { normal: number; long?: number }
  mastery: ItemMastery[]
  /** What the weapon fires, or what the ammunition is for: "Arrow". */
  ammoType?: string
}

export interface ItemArmor {
  /** The armor class of a suit of armor. */
  base?: number
  /** What a shield adds to armor class. */
  bonus?: number
  strength?: number
  stealth: boolean
  dexterityMax?: number
  class?: 'light' | 'medium' | 'heavy' | 'shield'
}

export interface ItemAttunement {
  required: boolean
  optional: boolean
  /** The restriction as printed: "by a wizard". */
  text?: string
  /** The classes the restriction names, lower case. */
  classes: string[]
}

export interface ItemCharges {
  /** "7", or a roll: "1d6 + 1". */
  max: string
  /** When they come back, in words: "at dawn". */
  recharge?: string
  /** The data's code for when: "dawn", "restLong". */
  on?: string
  /** How many come back: "1d6 + 4". */
  amount?: string
}

export interface ItemContainer {
  /** The pounds it holds. */
  weight: number
  /** Its contents weigh nothing (a bag of holding). */
  weightless: boolean
}

export interface PackPart {
  /** The key of the item in the catalog, when it is there. */
  key?: string
  name: string
  quantity: number
}

export interface ItemVehicle {
  speed?: string
  ac?: number
  hp?: number
  damageThreshold?: number
  crew?: string
  cargoTons?: number
  passengers?: number
  /** Pounds a mount or beast of burden can carry. */
  carrying?: number
}

/** One condition of where a generic variant applies, as the data states it. */
export type VariantClause = Record<string, unknown>

/** A generic magic variant: a template that makes an item out of any base item it fits. */
export interface VariantTemplate {
  requires: VariantClause[]
  excludes: VariantClause
  /** Where it applies, in words: "Any weapon", "Any sword". */
  appliesTo: string
  /** Put before and after the base item's name: "+1 " makes "+1 Longsword". */
  namePrefix?: string
  nameSuffix?: string
  /** Taken out of the base item's name ("Barding" made of "Chain Mail Barding"). */
  nameRemove?: string
  /** What the made item costs and weighs, from the base item: "[[baseItem.value]] * 4". */
  valueExpression?: string
  weightExpression?: string
  /** Properties the made item gains. */
  propertyAdd: ItemProperty[]
}

export interface Item {
  /** `${name}|${source}`: the address in the inventory and the history. */
  key: string
  name: string
  source: string
  /** What the SRD calls the item, when that is another name (full content only). */
  srdName?: string
  page?: number
  edition: Edition
  /** The key of the same item in the other edition's book (reprintedAs, both ways). */
  twin?: string
  kind: ItemKind
  /** The raw type code with its source suffix removed ("M", "LA", "P"), for the tooltip. */
  type?: string
  /** "Martial melee weapon", "Heavy armor", "Potion", "Wondrous item". */
  category?: string
  rarity?: string
  /** A magic item: it has a rarity of its own or is not mundane. */
  magic: boolean
  tier?: 'major' | 'minor'
  /** Pounds. */
  weight?: number
  weightNote?: string
  /** Copper pieces. */
  value?: number
  weapon?: ItemWeapon
  armor?: ItemArmor
  attunement?: ItemAttunement
  /** Whoever wields the item is proficient with it. */
  grantsProficiency?: true
  /** A firearm, for the proficiency with firearms. */
  firearm?: true
  bonuses: Bonus[]
  /** What the item does to the bearer's speeds, when it does anything. */
  speed?: ItemSpeedChange
  charges?: ItemCharges
  spells: AttachedSpell[]
  container?: ItemContainer
  pack?: PackPart[]
  vehicle?: ItemVehicle
  /** Everything else the item does: resistances, speed, languages, curses, light. */
  traits: string[]
  /** The variable part of the item (the colour of a tattoo). */
  details: string[]
  /** The weapon families it belongs to (sword, axe, bow ...), for what a variant needs. */
  family: string[]
  /** Its focus kind (arcane, holy, druid) when it is a spellcasting focus. */
  focus?: string
  /** The umbrella items the item belongs to ("Armor of Resistance"). */
  groups: string[]
  /** Printed in the free rules. */
  free: boolean
  entries: Entry[]
  /** Set on a generic variant: a template, not an item to own as it is. */
  variant?: VariantTemplate
}

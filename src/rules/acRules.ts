// Every rule that sets or changes a character's armor class and is written only as
// text in the books: a class or subclass formula (Unarmored Defense), natural armor,
// a fighting style, a feat, an item that sets the base. Armor, shields and the plain
// "+1" of a magic item are structured in the data and are read from it, not listed here.
// Each row is keyed by the holder's data identity; the audit in acRules.test.ts fails
// when a book adds a rule that is neither here nor in AC_NOT_APPLIED with its reason.

import type { AbilityKey } from '../dice/dice'
import { holderId, type Holder } from './holder'

/** What a bonus asks of what the character wears or wields. */
export type AcRequirement =
  | 'armor'
  | 'heavyArmor'
  | 'noArmor'
  | 'noHeavyArmor'
  | 'noArmorNoShield'
  | 'noShield'
  | 'twoMeleeWeapons'
  | { weapon: string }

export type AcEffect =
  /**
   * A way to work out the base armor class: `base` plus the modifiers of `abilities`.
   * `unarmored` formulas hold only without body armor (and without a shield when
   * `noShield`); natural armor (`unarmored: false`) is always an option to pick
   * against the worn armor. `armorUseless` marks a body that gains nothing from armor.
   */
  | {
      kind: 'base'
      base: number
      abilities: AbilityKey[]
      unarmored: boolean
      noShield?: boolean
      armorUseless?: boolean
      /** The most Dexterity the formula adds. */
      dexMax?: number
    }
  | { kind: 'add'; amount: number; requires?: AcRequirement }
  /** Medium armor adds this much Dexterity, with at least this Dexterity score. */
  | { kind: 'mediumDexCap'; cap: number; minDex: number }
  /** The item's own armor adds the whole Dexterity modifier. */
  | { kind: 'noDexCap' }
  /** The item's structured armor class bonus is not a standing bonus (it is a reaction). */
  | { kind: 'ignoreStructuredBonus' }

export interface AcRule {
  holder: Holder
  label: string
  /** The rule in plain words, as the line's tooltip. */
  text: string
  effect: AcEffect
}

/** The data identity of a rule. */
export const acRuleId = (rule: AcRule) => holderId(rule.holder)

const unarmoredDefense = (
  holder: Holder,
  label: string,
  abilities: AbilityKey[],
  text: string,
  options: { noShield?: boolean; base?: number } = {},
): AcRule => ({
  holder,
  label,
  text,
  effect: {
    kind: 'base',
    base: options.base ?? 10,
    abilities,
    unarmored: true,
    noShield: options.noShield,
  },
})

const natural = (
  holder: Holder,
  base: number,
  abilities: AbilityKey[],
  text: string,
  options: { unarmored?: boolean; armorUseless?: boolean } = {},
): AcRule => ({
  holder,
  label: 'Natural armor',
  text,
  effect: {
    kind: 'base',
    base,
    abilities,
    unarmored: options.unarmored ?? false,
    armorUseless: options.armorUseless,
  },
})

const bonus = (
  holder: Holder,
  label: string,
  amount: number,
  text: string,
  requires?: AcRequirement,
): AcRule => ({ holder, label, text, effect: { kind: 'add', amount, requires } })

const classFeature = (className: string, source: string, name: string): Holder => ({
  classFeature: { className, source, name },
})

const subclassFeature = (
  className: string,
  shortName: string,
  source: string,
  name: string,
): Holder => ({ subclassFeature: { className, shortName, source, name } })

/** A Barrier Tattoo: while no armor is worn it sets the armor class, and a shield still counts. */
const tattoo = (
  size: string,
  base: number,
  dex: 'dex' | undefined,
  dexMax?: number,
): AcRule => ({
  holder: { item: `Barrier Tattoo (${size})|TCE` },
  label: `Barrier Tattoo (${size})`,
  text: `Barrier Tattoo (${size}): while you aren't wearing armor, your Armor Class is ${base}${dex ? ' + your Dexterity modifier' : ''}${dexMax ? ` (maximum of +${dexMax})` : ''}. You can use a shield and still gain this benefit.`,
  effect: { kind: 'base', base, abilities: dex ? [dex] : [], unarmored: true, dexMax },
})

export const AC_RULES: readonly AcRule[] = [
  // ---- Class and subclass formulas --------------------------------------------
  unarmoredDefense(
    classFeature('Barbarian', 'PHB', 'Unarmored Defense'),
    'Unarmored Defense',
    ['dex', 'con'],
    'Barbarian: while you wear no armor, your AC is 10 + Dexterity modifier + Constitution modifier. You can use a shield.',
  ),
  unarmoredDefense(
    classFeature('Barbarian', 'XPHB', 'Unarmored Defense'),
    'Unarmored Defense',
    ['dex', 'con'],
    'Barbarian: while you wear no armor, your base AC is 10 + Dexterity modifier + Constitution modifier. You can use a shield.',
  ),
  unarmoredDefense(
    classFeature('Monk', 'PHB', 'Unarmored Defense'),
    'Unarmored Defense',
    ['dex', 'wis'],
    'Monk: while you wear no armor and wield no shield, your AC is 10 + Dexterity modifier + Wisdom modifier.',
    { noShield: true },
  ),
  unarmoredDefense(
    classFeature('Monk', 'XPHB', 'Unarmored Defense'),
    'Unarmored Defense',
    ['dex', 'wis'],
    'Monk: while you wear no armor and wield no shield, your base AC is 10 + Dexterity modifier + Wisdom modifier.',
    { noShield: true },
  ),
  unarmoredDefense(
    subclassFeature('Bard', 'Dance', 'XPHB', 'Unarmored Defense'),
    'Unarmored Defense',
    ['dex', 'cha'],
    'College of Dance: while you wear no armor and wield no shield, your base AC is 10 + Dexterity modifier + Charisma modifier.',
    { noShield: true },
  ),
  unarmoredDefense(
    subclassFeature('Sorcerer', 'Draconic', 'PHB', 'Draconic Resilience'),
    'Draconic Resilience',
    ['dex'],
    'Draconic Bloodline: while you wear no armor, your AC is 13 + Dexterity modifier.',
    { base: 13 },
  ),
  unarmoredDefense(
    subclassFeature('Sorcerer', 'Draconic', 'XPHB', 'Draconic Resilience'),
    'Draconic Resilience',
    ['dex', 'cha'],
    'Draconic Sorcery: while you wear no armor, your base AC is 10 + Dexterity modifier + Charisma modifier.',
  ),
  unarmoredDefense(
    subclassFeature('Paladin', 'Noble Genies', 'FRHoF', "Genie's Splendor"),
    "Genie's Splendor",
    ['dex', 'cha'],
    'Oath of the Noble Genies: while you wear no armor, your base AC is 10 + Dexterity modifier + Charisma modifier. You can use a shield.',
  ),
  unarmoredDefense(
    subclassFeature('Mystic', 'Immortal', 'UATheMysticClass', 'Immortal Durability'),
    'Immortal Durability',
    ['dex', 'con'],
    'Order of the Immortal: while you wear no armor and wield no shield, your base AC is 10 + Dexterity modifier + Constitution modifier.',
    { noShield: true },
  ),
  bonus(
    subclassFeature('Cleric', 'Forge', 'XGE', 'Soul of the Forge'),
    'Soul of the Forge',
    1,
    'Forge Domain: while you wear heavy armor, you gain a +1 bonus to AC.',
    'heavyArmor',
  ),

  // ---- Fighting style and feats -----------------------------------------------
  bonus(
    { option: 'Defense|PHB' },
    'Defense fighting style',
    1,
    'Defense: while you are wearing armor, you gain a +1 bonus to AC.',
    'armor',
  ),
  bonus(
    { feat: 'Defense|XPHB' },
    'Defense fighting style',
    1,
    'Defense: while you are wearing Light, Medium or Heavy armor, you gain a +1 bonus to AC.',
    'armor',
  ),
  unarmoredDefense(
    { feat: 'Dragon Hide|XGE' },
    'Dragon Hide',
    ['dex'],
    'Dragon Hide: while you wear no armor, you can calculate your AC as 13 + Dexterity modifier.',
    { base: 13 },
  ),
  bonus(
    { feat: 'Dual Wielder|PHB' },
    'Dual Wielder',
    1,
    'Dual Wielder: you gain a +1 bonus to AC while you wield a separate melee weapon in each hand.',
    'twoMeleeWeapons',
  ),
  bonus(
    { feat: 'Revenant Blade|ERLW' },
    'Revenant Blade',
    1,
    'Revenant Blade: while you hold a double-bladed scimitar with two hands, you gain a +1 bonus to AC.',
    { weapon: 'double-bladed scimitar' },
  ),
  {
    holder: { feat: 'Medium Armor Master|PHB' },
    label: 'Medium Armor Master',
    text: 'Medium Armor Master: when you wear medium armor you add 3, rather than 2, to your AC if your Dexterity is 16 or higher.',
    effect: { kind: 'mediumDexCap', cap: 3, minDex: 16 },
  },
  {
    holder: { feat: 'Medium Armor Master|XPHB' },
    label: 'Medium Armor Master',
    text: 'Medium Armor Master: while you wear medium armor you add 3, rather than 2, to your AC if your Dexterity score is 16 or higher.',
    effect: { kind: 'mediumDexCap', cap: 3, minDex: 16 },
  },

  // ---- Species -----------------------------------------------------------------
  natural(
    { race: { baseName: 'Autognome', source: 'AAG' } },
    13,
    ['dex'],
    'Autognome, Armored Casing: while you wear no armor, your base AC is 13 + Dexterity modifier.',
    { unarmored: true },
  ),
  natural(
    { race: { baseName: 'Goblin', source: 'PSZ' } },
    11,
    ['dex'],
    'Goblin: while you wear no armor, your AC is 11 + Dexterity modifier.',
    { unarmored: true },
  ),
  bonus(
    { race: { baseName: 'Lizardfolk', source: 'DMG' } },
    'Natural armor',
    3,
    'Lizardfolk: your scales function as natural armor, granting a +3 bonus to AC.',
  ),
  natural(
    { race: { baseName: 'Lizardfolk', source: 'MPMM' } },
    13,
    ['dex'],
    'Lizardfolk: your base AC is 13 + Dexterity modifier; you can use it if the armor you wear would leave you with a lower AC, and a shield still applies.',
  ),
  natural(
    { race: { baseName: 'Lizardfolk', source: 'VGM' } },
    13,
    ['dex'],
    'Lizardfolk: your AC is 13 + Dexterity modifier; you can use it if the armor you wear would leave you with a lower AC, and a shield still applies.',
  ),
  natural(
    { race: { baseName: 'Locathah', source: 'LR' } },
    12,
    ['dex'],
    'Locathah: your AC is 12 + Dexterity modifier; you can use it if the armor you wear would leave you with a lower AC, and a shield still applies.',
  ),
  natural(
    { race: { baseName: 'Loxodon', source: 'GGR' } },
    12,
    ['con'],
    'Loxodon: your AC is 12 + Constitution modifier; you can use it if the armor you wear would leave you with a lower AC, and a shield still applies.',
  ),
  bonus(
    { race: { baseName: 'Simic Hybrid', source: 'GGR' } },
    'Simic Hybrid',
    1,
    'Simic Hybrid, Carapace: you gain a +1 bonus to AC while you are not wearing heavy armor.',
    'noHeavyArmor',
  ),
  natural(
    { race: { baseName: 'Thri-kreen', source: 'AAG' } },
    13,
    ['dex'],
    'Thri-kreen, Chameleon Carapace: while you wear no armor, your base AC is 13 + Dexterity modifier.',
    { unarmored: true },
  ),
  natural(
    { race: { baseName: 'Tortle', source: 'MPMM' } },
    17,
    [],
    'Tortle: your shell gives you a base AC of 17 (Dexterity does not affect it) and you cannot wear armor; a shield still applies.',
    { armorUseless: true },
  ),
  natural(
    { race: { baseName: 'Tortle', source: 'TTP' } },
    17,
    [],
    'Tortle: your shell gives you a base AC of 17 (Dexterity does not affect it) and you gain no benefit from armor; a shield still applies.',
    { armorUseless: true },
  ),
  bonus(
    { race: { baseName: 'Troglodyte', source: 'DMG' } },
    'Natural armor',
    1,
    'Troglodyte: your thick hide grants you a +1 bonus to AC.',
  ),
  bonus(
    { race: { baseName: 'Warforged', source: 'EFA' } },
    'Integrated Protection',
    1,
    'Warforged: you gain a +1 bonus to AC.',
  ),
  bonus(
    { race: { baseName: 'Warforged', source: 'ERLW' } },
    'Integrated Protection',
    1,
    'Warforged: you gain a +1 bonus to AC.',
  ),

  // ---- Items whose armor class is text ---------------------------------------------
  ...['DMG', 'XDMG'].map((source): AcRule => ({
    holder: { item: `Bracers of Defense|${source}` },
    label: 'Bracers of Defense',
    text: 'Bracers of Defense: you gain a +2 bonus to AC while you wear no armor and use no shield.',
    effect: { kind: 'add', amount: 2, requires: 'noArmorNoShield' },
  })),
  {
    holder: { item: 'Bracers of Asmodeus|CoA' },
    label: 'Bracers of Asmodeus',
    text: 'Bracers of Asmodeus: you have a +2 bonus to AC while wearing them, if you do not wear armor or use a shield at the same time.',
    effect: { kind: 'add', amount: 2, requires: 'noArmorNoShield' },
  },
  {
    holder: { item: 'Badge of the Watch|WDH' },
    label: 'Badge of the Watch',
    text: "Badge of the Watch: while wearing the badge, you gain a +2 bonus to AC if you aren't using a shield.",
    effect: { kind: 'add', amount: 2, requires: 'noShield' },
  },
  {
    holder: { item: 'True-Ice Shards (Dagger)|CoA' },
    label: 'True-Ice Shards (Dagger)',
    text: 'True-Ice Shards: when using the magic dagger, you gain a +3 bonus to your AC, as long as it is used as your offhand weapon.',
    effect: { kind: 'add', amount: 3, requires: 'twoMeleeWeapons' },
  },
  ...['DMG', 'XDMG'].map((source): AcRule => ({
    holder: { item: `Robe of the Archmagi|${source}` },
    label: 'Robe of the Archmagi',
    text: 'Robe of the Archmagi: if you wear no armor, your base AC is 15 + Dexterity modifier.',
    effect: {
      kind: 'base',
      base: 15,
      abilities: ['dex'],
      unarmored: true,
    },
  })),
  {
    holder: { item: 'Pride Silk Outfit|EGW' },
    label: 'Pride Silk Outfit',
    text: 'Pride Silk Outfit: if you wear no armor, your base AC is 11 + Dexterity modifier while you wear it.',
    effect: { kind: 'base', base: 11, abilities: ['dex'], unarmored: true },
  },
  tattoo('Small', 12, 'dex'),
  tattoo('Medium', 15, 'dex', 2),
  tattoo('Large', 18, undefined),
  {
    holder: { item: 'Serpent Scale Armor|CM' },
    label: 'Serpent Scale Armor',
    text: 'Serpent Scale Armor: you can apply your full Dexterity modifier, rather than a maximum of +2, to your AC.',
    effect: { kind: 'noDexCap' },
  },
  {
    holder: { item: 'Quarterstaff of the Acrobat|XDMG' },
    label: 'Quarterstaff of the Acrobat',
    text: 'Quarterstaff of the Acrobat: the AC bonus is a reaction against one attack, not a standing bonus.',
    effect: { kind: 'ignoreStructuredBonus' },
  },
]

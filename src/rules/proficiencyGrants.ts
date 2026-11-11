// The armor and weapon proficiencies that a class or subclass feature grants in its
// text only (a cleric domain's "Bonus Proficiencies", a Hexblade's Hex Warrior). The
// proficiencies that classes, species and feats list as data are read from the data; the
// rows here are what the books only write in words. The audit in
// proficiencyGrants.test.ts fails when a book adds such a feature that is neither here nor
// in PROFICIENCY_NOT_GRANTED with its reason.

import { holderId, type Holder } from './holder'

export type ArmorKind = 'light' | 'medium' | 'heavy' | 'shield'

/**
 * A weapon proficiency: every condition it names must hold for a weapon. A name is an
 * item name in lower case; a category is simple or martial; properties are the codes
 * of the data ("L" light, "F" finesse, "H" heavy, "2H" two-handed).
 */
export interface WeaponGrant {
  category?: 'simple' | 'martial'
  name?: string
  anyProperty?: string[]
  noProperty?: string[]
  melee?: boolean
  ranged?: boolean
  firearms?: boolean
}

export interface ProficiencyGrant {
  holder: Holder
  /** The rule in plain words. */
  text: string
  armor?: ArmorKind[]
  weapons?: WeaponGrant[]
  /** Tools it gives, by name. */
  tools?: string[]
  /** Languages it gives, by name. */
  languages?: string[]
  /**
   * For a weapon item: the wielder is proficient with it when proficient with any of
   * these weapons ("if you are proficient with shortsword or longsword, you are
   * proficient with the Sun Blade"). The category is that of the named weapon.
   */
  via?: { name: string; category: 'simple' | 'martial' }[]
}

const LONGSWORD_OR_SHORTSWORD = [
  { name: 'longsword', category: 'martial' },
  { name: 'shortsword', category: 'martial' },
] as const

const viaSword = (item: string, label: string): ProficiencyGrant => ({
  holder: { item },
  text: `${label}: if you are proficient with shortsword or longsword, you are proficient with it.`,
  via: [...LONGSWORD_OR_SHORTSWORD],
})

const subclass = (
  className: string,
  shortName: string,
  source: string,
  name: string,
): Holder => ({ subclassFeature: { className, shortName, source, name } })

const classFeature = (className: string, source: string, name: string): Holder => ({
  classFeature: { className, source, name },
})

const MARTIAL: WeaponGrant = { category: 'martial' }

export const PROFICIENCY_GRANTS: readonly ProficiencyGrant[] = [
  viaSword('Sun Blade|DMG', 'Sun Blade'),
  viaSword('Sun Blade|XDMG', 'Sun Blade'),
  viaSword('Sunsword|CoS', 'Sunsword'),
  viaSword('Dawnbringer|OotA', 'Dawnbringer'),
  {
    holder: { item: 'Storm Boomerang|PotA' },
    text: 'Storm Boomerang: any creature that is proficient with the javelin is also proficient with it.',
    via: [{ name: 'javelin', category: 'simple' }],
  },
  {
    holder: subclass('Artificer', 'Armorer', 'EFA', 'Tools of the Trade'),
    text: 'Armorer: you gain training with heavy armor.',
    armor: ['heavy'],
    tools: ["smith's tools"],
  },
  {
    holder: subclass('Artificer', 'Armorer', 'TCE', 'Tools of the Trade'),
    text: 'Armorer: you gain proficiency with heavy armor.',
    armor: ['heavy'],
    tools: ["smith's tools"],
  },
  {
    holder: subclass('Artificer', 'Artillerist', 'EFA', 'Tools of the Trade'),
    text: 'Artillerist: you gain proficiency with martial ranged weapons.',
    weapons: [{ category: 'martial', ranged: true }],
    tools: ["woodcarver's tools"],
  },
  {
    holder: subclass('Artificer', 'Battle Smith', 'TCE', 'Battle Ready'),
    text: 'Battle Smith: you gain proficiency with martial weapons.',
    weapons: [MARTIAL],
  },
  {
    holder: subclass('Artificer', 'Battle Smith', 'EFA', 'Battle Ready'),
    text: 'Battle Smith: you gain proficiency with martial weapons.',
    weapons: [MARTIAL],
  },
  {
    holder: subclass('Bard', 'Valor', 'PHB', 'Bonus Proficiencies'),
    text: 'College of Valor: you gain proficiency with medium armor, shields and martial weapons.',
    armor: ['medium', 'shield'],
    weapons: [MARTIAL],
  },
  {
    holder: subclass('Bard', 'Valor', 'XPHB', 'Martial Training'),
    text: 'College of Valor: you gain proficiency with martial weapons and training with medium armor and shields.',
    armor: ['medium', 'shield'],
    weapons: [MARTIAL],
  },
  {
    holder: subclass('Bard', 'Swords', 'XGE', 'Bonus Proficiencies'),
    text: 'College of Swords: you gain proficiency with medium armor and the scimitar.',
    armor: ['medium'],
    weapons: [{ name: 'scimitar' }],
  },
  {
    holder: subclass('Cleric', 'Death', 'DMG', 'Bonus Proficiency'),
    text: 'Death Domain: you gain proficiency with martial weapons.',
    weapons: [MARTIAL],
  },
  {
    holder: subclass('Cleric', 'Life', 'PHB', 'Bonus Proficiency'),
    text: 'Life Domain: you gain proficiency with heavy armor.',
    armor: ['heavy'],
  },
  {
    holder: subclass('Cleric', 'Nature', 'PHB', 'Bonus Proficiency'),
    text: 'Nature Domain: you gain proficiency with heavy armor.',
    armor: ['heavy'],
  },
  {
    holder: subclass('Cleric', 'Tempest', 'PHB', 'Bonus Proficiencies'),
    text: 'Tempest Domain: you gain proficiency with martial weapons and heavy armor.',
    armor: ['heavy'],
    weapons: [MARTIAL],
  },
  {
    holder: subclass('Cleric', 'War', 'PHB', 'Bonus Proficiencies'),
    text: 'War Domain: you gain proficiency with martial weapons and heavy armor.',
    armor: ['heavy'],
    weapons: [MARTIAL],
  },
  {
    holder: subclass('Cleric', 'Solidarity (PSA)', 'PSA', 'Bonus Proficiency'),
    text: 'Solidarity Domain: you gain proficiency with heavy armor.',
    armor: ['heavy'],
  },
  {
    holder: subclass('Cleric', 'Strength (PSA)', 'PSA', 'Bonus Proficiency'),
    text: 'Strength Domain: you gain proficiency with heavy armor.',
    armor: ['heavy'],
  },
  {
    holder: subclass('Cleric', 'Zeal (PSA)', 'PSA', 'Bonus Proficiencies'),
    text: 'Zeal Domain: you gain proficiency with martial weapons and heavy armor.',
    armor: ['heavy'],
    weapons: [MARTIAL],
  },
  {
    holder: subclass('Cleric', 'Order', 'TCE', 'Bonus Proficiencies'),
    text: 'Order Domain: you gain proficiency with heavy armor.',
    armor: ['heavy'],
  },
  {
    holder: subclass('Cleric', 'Twilight', 'TCE', 'Bonus Proficiencies'),
    text: 'Twilight Domain: you gain proficiency with martial weapons and heavy armor.',
    armor: ['heavy'],
    weapons: [MARTIAL],
  },
  {
    holder: subclass('Cleric', 'Forge', 'XGE', 'Bonus Proficiency'),
    text: "Forge Domain: you gain proficiency with heavy armor and smith's tools.",
    armor: ['heavy'],
    tools: ["smith's tools"],
  },
  {
    holder: subclass('Mystic', 'Avatar', 'UATheMysticClass', 'Armor Training'),
    text: 'Order of the Avatar: you gain proficiency with medium armor and shields.',
    armor: ['medium', 'shield'],
  },
  {
    holder: subclass('Mystic', 'Soul Knife', 'UATheMysticClass', 'Martial Training'),
    text: 'Order of the Soul Knife: you gain proficiency with medium armor and martial weapons.',
    armor: ['medium'],
    weapons: [MARTIAL],
  },
  {
    holder: subclass('Warlock', 'Hexblade', 'XGE', 'Hex Warrior'),
    text: 'Hexblade: you gain proficiency with medium armor, shields and martial weapons.',
    armor: ['medium', 'shield'],
    weapons: [MARTIAL],
  },
  {
    holder: subclass(
      'Wizard',
      'Bladesinging',
      'TCE',
      'Training in War and Song (Bladesinging)',
    ),
    text: 'Bladesinging: you gain proficiency with light armor (and one one-handed melee weapon of your choice, which is not stored yet).',
    armor: ['light'],
  },
  {
    holder: subclass('Wizard', 'Bladesinger', 'FRHoF', 'Training in War and Song'),
    text: 'Bladesinger: you gain proficiency with martial melee weapons that have neither the two-handed nor the heavy property.',
    weapons: [{ category: 'martial', melee: true, noProperty: ['2H', 'H'] }],
  },
  // ---- Tools and languages a feature gives in text ----------------------------
  {
    holder: subclass('Artificer', 'Alchemist', 'TCE', 'Tool Proficiency'),
    text: "Alchemist: you gain proficiency with alchemist's supplies.",
    tools: ["alchemist's supplies"],
  },
  {
    holder: subclass('Artificer', 'Alchemist', 'EFA', 'Tools of the Trade'),
    text: "Alchemist: you gain proficiency with alchemist's supplies and the herbalism kit.",
    tools: ["alchemist's supplies", 'herbalism kit'],
  },
  {
    holder: subclass('Artificer', 'Artillerist', 'TCE', 'Tool Proficiency'),
    text: "Artillerist: you gain proficiency with woodcarver's tools.",
    tools: ["woodcarver's tools"],
  },
  {
    holder: subclass('Artificer', 'Battle Smith', 'TCE', 'Tool Proficiency'),
    text: "Battle Smith: you gain proficiency with smith's tools.",
    tools: ["smith's tools"],
  },
  {
    holder: subclass('Artificer', 'Battle Smith', 'EFA', 'Tools of the Trade'),
    text: "Battle Smith: you gain proficiency with smith's tools.",
    tools: ["smith's tools"],
  },
  {
    holder: subclass('Artificer', 'Cartographer', 'EFA', 'Tools of the Trade'),
    text: "Cartographer: you gain proficiency with calligrapher's supplies and cartographer's tools.",
    tools: ["calligrapher's supplies", "cartographer's tools"],
  },
  {
    holder: subclass('Artificer', 'Reanimator', 'RHW', "Reanimator's Skill Set"),
    text: "Reanimator: you gain proficiency with alchemist's supplies.",
    tools: ["alchemist's supplies"],
  },
  {
    holder: subclass('Fighter', 'Rune Knight', 'TCE', 'Bonus Proficiencies'),
    text: "Rune Knight: you gain proficiency with smith's tools and learn Giant.",
    tools: ["smith's tools"],
    languages: ['Giant'],
  },
  {
    holder: subclass('Barbarian', 'Giant', 'BGG', 'Giant Power'),
    text: 'Path of the Giant: you learn Giant.',
    languages: ['Giant'],
  },
  {
    holder: subclass('Monk', 'Mercy', 'TCE', 'Implements of Mercy'),
    text: 'Way of Mercy: you gain proficiency with the herbalism kit.',
    tools: ['herbalism kit'],
  },
  {
    holder: subclass('Monk', 'Mercy', 'XPHB', 'Implements of Mercy'),
    text: 'Warrior of Mercy: you gain proficiency with the herbalism kit.',
    tools: ['herbalism kit'],
  },
  {
    holder: subclass('Monk', 'Drunken Master', 'XGE', 'Bonus Proficiencies'),
    text: "Way of the Drunken Master: you gain proficiency with brewer's supplies.",
    tools: ["brewer's supplies"],
  },
  {
    holder: subclass('Monk', 'Mystic Brews', 'WoW', 'Bonus Proficiencies'),
    text: "Way of Mystic Brews: you gain proficiency with brewer's supplies.",
    tools: ["brewer's supplies"],
  },
  {
    holder: subclass('Monk', 'Ascendant Dragon', 'FTD', 'Draconic Disciple'),
    text: 'Way of the Ascendant Dragon: you learn Draconic.',
    languages: ['Draconic'],
  },
  {
    holder: subclass('Ranger', 'Drakewarden', 'FTD', 'Draconic Gift'),
    text: 'Drakewarden: you learn Draconic.',
    languages: ['Draconic'],
  },
  {
    holder: subclass('Rogue', 'Assassin', 'PHB', 'Bonus Proficiencies'),
    text: "Assassin: you gain proficiency with the disguise kit and the poisoner's kit.",
    tools: ['disguise kit', "poisoner's kit"],
  },
  {
    holder: subclass('Rogue', 'Assassin', 'XPHB', "Assassin's Tools"),
    text: "Assassin: you gain proficiency with the disguise kit and the poisoner's kit.",
    tools: ['disguise kit', "poisoner's kit"],
  },
  {
    holder: subclass('Rogue', 'Mastermind', 'XGE', 'Master of Intrigue'),
    text: 'Mastermind: you gain proficiency with the disguise kit and the forgery kit (and a gaming set and two languages of your choice, which are not stored yet).',
    tools: ['disguise kit', 'forgery kit'],
  },
  {
    holder: classFeature('Druid', 'PHB', 'Druidic'),
    text: 'Druidic: you know Druidic, the secret language of druids.',
    languages: ['Druidic'],
  },
  {
    holder: classFeature('Druid', 'XPHB', 'Druidic'),
    text: 'Druidic: you know Druidic, the secret language of druids.',
    languages: ['Druidic'],
  },
  {
    holder: classFeature('Rogue', 'PHB', "Thieves' Cant"),
    text: "Thieves' Cant: you know thieves' cant, the secret language of rogues.",
    languages: ["Thieves' cant"],
  },
  {
    holder: classFeature('Rogue', 'XPHB', "Thieves' Cant"),
    text: "Thieves' Cant: you know Thieves' Cant (and one other language of your choice, which is not stored yet).",
    languages: ["Thieves' cant"],
  },
]

export const proficiencyGrantId = (grant: ProficiencyGrant) => holderId(grant.holder)

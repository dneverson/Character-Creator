// What adds to walking speed that the data gives in text only: Fast Movement, Unarmored
// Movement, Roving and the feats that make a character quicker. A row names its holder, so
// the audit in speedRules.test.ts can tell a feature covered here from one a book added.
// The speed of a species is data and is read from it, and so is the Strength an armor
// asks for; what spares the character its slowdown is a table here.

import type { Edition } from '../data/edition'
import type { Holder } from './holder'

/** Armor that switches the bonus off. */
export type SpeedLimit = 'heavyArmor' | 'mediumOrHeavyArmor' | 'anyArmor'

export interface SpeedRule {
  holder: Holder
  label: string
  text: string
  /** Feet added; a list of [class level, feet] steps for a bonus that grows with the class. */
  amount: number | readonly (readonly [number, number])[]
  /** What the character may not wear for the bonus to count. */
  without?: SpeedLimit
  /** It holds only in a case the sheet cannot check: shown with when, not counted. */
  when?: string
}

const classFeature = (className: string, source: string, name: string): Holder => ({
  classFeature: { className, source, name },
})

const subclassFeature = (
  className: string,
  shortName: string,
  source: string,
  name: string,
): Holder => ({ subclassFeature: { className, shortName, source, name } })

const UNARMORED_MOVEMENT = [
  [2, 10],
  [6, 15],
  [10, 20],
  [14, 25],
  [18, 30],
] as const

const unarmored = (source: string): SpeedRule => ({
  holder: classFeature('Monk', source, 'Unarmored Movement'),
  label: 'Unarmored Movement',
  text: 'Unarmored Movement: your speed increases while you wear no armor and wield no shield.',
  amount: UNARMORED_MOVEMENT,
  without: 'anyArmor',
})

const fastMovement = (source: string): SpeedRule => ({
  holder: classFeature('Barbarian', source, 'Fast Movement'),
  label: 'Fast Movement',
  text: 'Fast Movement: your speed increases by 10 feet while you do not wear heavy armor.',
  amount: 10,
  without: 'heavyArmor',
})

export const SPEED_RULES: readonly SpeedRule[] = [
  fastMovement('PHB'),
  fastMovement('XPHB'),
  unarmored('PHB'),
  unarmored('XPHB'),
  {
    holder: { reward: 'Boon of Speed|DMG' },
    label: 'Boon of Speed',
    text: 'Boon of Speed: your walking speed increases by 30 feet.',
    amount: 30,
  },
  {
    holder: { reward: 'Blessing of the Flying Companion|WoW' },
    label: 'Blessing of the Flying Companion',
    text: 'Blessing of the Flying Companion: your Speed increases by 5 feet.',
    amount: 5,
    when: 'while a flying companion has a Loyalty Score of 10 or higher',
  },
  {
    holder: classFeature('Ranger', 'XPHB', 'Roving'),
    label: 'Roving',
    text: 'Roving: your speed increases by 10 feet while you do not wear heavy armor.',
    amount: 10,
    without: 'heavyArmor',
  },
  {
    holder: { feat: 'Mobile|PHB' },
    label: 'Mobile',
    text: 'Mobile: your speed increases by 10 feet.',
    amount: 10,
  },
  {
    holder: { feat: 'Speedy|XPHB' },
    label: 'Speedy',
    text: 'Speedy: your speed increases by 10 feet.',
    amount: 10,
  },
  {
    holder: subclassFeature('Rogue', 'Scout', 'XGE', 'Superior Mobility'),
    label: 'Superior Mobility',
    text: 'Superior Mobility: your walking speed increases by 10 feet. If you have a climbing or swimming speed, this increase applies to that speed as well.',
    amount: 10,
  },
]

/** The ways of moving besides walking, each a speed of its own. */
export const MOVE_MODES = ['fly', 'swim', 'climb', 'burrow'] as const
export type MoveMode = (typeof MOVE_MODES)[number]

/**
 * A speed of another way of moving that a feature, feat, option or species trait gives in
 * text only. The speeds a species' and an item's data state are read from the data.
 */
export interface MoveRule {
  holder: Holder
  label: string
  text: string
  mode: MoveMode
  /**
   * Feet; `walk` for a speed equal to the walking speed (times `times`); `bonus` for feet
   * added to a speed of this way the character already has (Superior Mobility).
   */
  amount: number | 'walk' | { bonus: number }
  times?: number
  /** It holds only after something is done: shown with when, not counted. */
  when?: string
  /** What the character may not wear for it to count. */
  without?: SpeedLimit
  hover?: true
  /**
   * The character level (class level, for a class feature) it arrives at: a species trait
   * of a later level, or a feature whose name the data gives at several levels (the Totem
   * Warrior's Eagle at levels 3, 6 and 14).
   */
  fromLevel?: number
}

const walkSpeed = (
  holder: Holder,
  label: string,
  text: string,
  mode: MoveMode,
  extra: Partial<MoveRule> = {},
): MoveRule => ({ holder, label, text, mode, amount: 'walk', ...extra })

const AFTER_BONUS = 'after the bonus action that starts it'

export const MOVE_RULES: readonly MoveRule[] = [
  {
    holder: { reward: 'Dark Gift of Tarakamedes, the Grave Wyrm|CoS' },
    label: 'Dark Gift of Tarakamedes',
    text: 'Dark Gift of Tarakamedes: you grow skeletal wings and have a flying speed of 50 feet.',
    mode: 'fly',
    amount: 50,
  },
  walkSpeed(
    { reward: 'Blessing of the Aquatic Companion|WoW' },
    'Blessing of the Aquatic Companion',
    'Blessing of the Aquatic Companion: you have a swimming speed equal to your Speed.',
    'swim',
    { when: 'while an aquatic companion has a Loyalty Score of 10 or higher' },
  ),
  walkSpeed(
    { reward: 'Nangnang|ToA' },
    'Nangnang',
    'Nangnang: the host can move up, down and across vertical surfaces and ceilings, with a climbing speed equal to its walking speed.',
    'climb',
  ),
  walkSpeed(
    { reward: 'Manifest Charm of Syrania, the Azure Sky|EFA' },
    'Manifest Charm of Syrania',
    'Manifest Charm of Syrania: you can expend the charm as a bonus action to gain a flying speed equal to your Speed for 1 minute.',
    'fly',
    { when: `for 1 minute, after you expend the charm as a bonus action` },
  ),
  ...(['TCE', 'EFA'] as const).map((source): MoveRule => ({
    holder: subclassFeature('Artificer', 'Alchemist', source, 'Experimental Elixir'),
    label: 'Experimental Elixir',
    text: 'Experimental Elixir, Flight: the drinker of the elixir gains a flying speed of 10 feet for 10 minutes.',
    mode: 'fly',
    amount: 10,
    when: 'for 10 minutes after you drink an elixir of Flight',
  })),
  walkSpeed(
    subclassFeature('Artificer', 'Armorer', 'EFA', 'Perfected Armor'),
    'Perfected Armor',
    'Perfected Armor: as a Bonus Action, you can gain a Fly Speed equal to twice your Speed until the end of the current turn.',
    'fly',
    { times: 2, when: `until the end of the turn, ${AFTER_BONUS}` },
  ),
  walkSpeed(
    subclassFeature('Barbarian', 'Totem Warrior', 'PHB', 'Eagle'),
    'Eagle',
    'Eagle (Totemic Attunement): while raging, you have a flying speed equal to your current walking speed.',
    'fly',
    { when: 'while raging; you fall if you end your turn in the air', fromLevel: 14 },
  ),
  {
    holder: subclassFeature('Barbarian', 'Storm Herald', 'XGE', 'Sea'),
    label: 'Sea',
    text: 'Sea (Storm Soul): you gain a swimming speed of 30 feet.',
    mode: 'swim',
    amount: 30,
    fromLevel: 6,
  },
  walkSpeed(
    subclassFeature('Barbarian', 'Wild Heart', 'XPHB', 'Power of the Wilds'),
    'Power of the Wilds',
    "Power of the Wilds, Falcon: while your Rage is active, you have a Fly Speed equal to your Speed if you aren't wearing any armor.",
    'fly',
    { when: 'while raging, with the Falcon option', without: 'anyArmor' },
  ),
  walkSpeed(
    subclassFeature('Barbarian', 'Zealot', 'XPHB', 'Rage of the Gods'),
    'Rage of the Gods',
    'Rage of the Gods, Flight: in the form of a divine warrior, you have a Fly Speed equal to your Speed and can hover.',
    'fly',
    {
      when: 'for 1 minute after you take the divine form on activating Rage',
      hover: true,
    },
  ),
  walkSpeed(
    subclassFeature('Cleric', 'Tempest', 'PHB', 'Stormborn'),
    'Stormborn',
    'Stormborn: you have a flying speed equal to your current walking speed whenever you are not underground or indoors.',
    'fly',
    { when: 'when you are not underground or indoors' },
  ),
  walkSpeed(
    subclassFeature('Cleric', 'Twilight', 'TCE', 'Steps of Night'),
    'Steps of Night',
    'Steps of Night: as a bonus action in dim light or darkness, you can give yourself a flying speed equal to your walking speed for 1 minute.',
    'fly',
    { when: `for 1 minute ${AFTER_BONUS}, in dim light or darkness` },
  ),
  {
    holder: subclassFeature('Cleric', 'Shadow', 'WoW', 'Dispersion'),
    label: 'Dispersion',
    text: 'Dispersion: until the end of your next turn, you have a Fly Speed of 40 feet.',
    mode: 'fly',
    amount: 40,
    when: 'until the end of your next turn, after the Reaction that starts it',
  },
  ...(['TCE', 'XPHB'] as const).map((source): MoveRule => ({
    holder: subclassFeature('Druid', 'Stars', source, 'Twinkling Constellations'),
    label: 'Twinkling Constellations',
    text: 'Twinkling Constellations: while the Dragon constellation is active, you have a flying speed of 20 feet and can hover.',
    mode: 'fly',
    amount: 20,
    when: 'while the Dragon form of your Starry Form is active',
    hover: true,
  })),
  walkSpeed(
    subclassFeature('Druid', 'Sea', 'XPHB', 'Aquatic Affinity'),
    'Aquatic Affinity',
    'Aquatic Affinity: you gain a Swim Speed equal to your Speed.',
    'swim',
  ),
  walkSpeed(
    subclassFeature('Druid', 'Sea', 'XPHB', 'Stormborn'),
    'Stormborn',
    'Stormborn, Flight: while your Wrath of the Sea is active, you gain a Fly Speed equal to your Speed.',
    'fly',
    { when: 'while your Wrath of the Sea is active' },
  ),
  ...(['TCE', 'XPHB'] as const).map((source): MoveRule =>
    walkSpeed(
      subclassFeature('Fighter', 'Psi Warrior', source, 'Psi-Powered Leap'),
      'Psi-Powered Leap',
      'Psi-Powered Leap: as a bonus action, you gain a flying speed equal to twice your walking speed until the end of the current turn.',
      'fly',
      { times: 2, when: `until the end of the turn, ${AFTER_BONUS}` },
    ),
  ),
  walkSpeed(
    subclassFeature('Monk', 'Ascendant Dragon', 'FTD', 'Wings Unfurled'),
    'Wings Unfurled',
    'Wings Unfurled: while the wings exist, you have a flying speed equal to your walking speed.',
    'fly',
    { when: `for 1 minute, while the wings exist, ${AFTER_BONUS}` },
  ),
  ...(['fly', 'swim'] as const).map((mode): MoveRule =>
    walkSpeed(
      subclassFeature('Monk', 'Elements', 'XPHB', 'Stride of the Elements'),
      'Stride of the Elements',
      'Stride of the Elements: while your Elemental Attunement is active, you also have a Fly Speed and a Swim Speed equal to your Speed.',
      mode,
      { when: 'while your Elemental Attunement is active' },
    ),
  ),
  {
    holder: subclassFeature('Paladin', 'Vengeance', 'PHB', 'Avenging Angel'),
    label: 'Avenging Angel',
    text: 'Avenging Angel: for 1 hour, wings sprout from your back and grant you a flying speed of 60 feet.',
    mode: 'fly',
    amount: 60,
    when: 'for 1 hour after the action that starts it',
  },
  {
    holder: subclassFeature('Paladin', 'Vengeance', 'XPHB', 'Avenging Angel'),
    label: 'Avenging Angel',
    text: 'Avenging Angel, Flight: you sprout spectral wings on your back, have a Fly Speed of 60 feet, and can hover.',
    mode: 'fly',
    amount: 60,
    when: `for 10 minutes ${AFTER_BONUS}`,
    hover: true,
  },
  {
    holder: subclassFeature('Paladin', 'Noble Genies', 'FRHoF', 'Noble Scion'),
    label: 'Noble Scion',
    text: 'Noble Scion, Flight: you have a Fly Speed of 60 feet and can hover.',
    mode: 'fly',
    amount: 60,
    when: `for 10 minutes ${AFTER_BONUS}`,
    hover: true,
  },
  ...(['climb', 'swim'] as const).map((mode): MoveRule =>
    walkSpeed(
      classFeature('Ranger', 'XPHB', 'Roving'),
      'Roving',
      'Roving: you have a Climb Speed and a Swim Speed equal to your Speed.',
      mode,
    ),
  ),
  {
    holder: subclassFeature('Ranger', 'Swarmkeeper', 'TCE', 'Writhing Tide'),
    label: 'Writhing Tide',
    text: 'Writhing Tide: as a bonus action, you gain a flying speed of 10 feet and can hover, for 1 minute.',
    mode: 'fly',
    amount: 10,
    when: `for 1 minute ${AFTER_BONUS}`,
    hover: true,
  },
  ...(['TCE', 'RHW'] as const).map((source): MoveRule => ({
    holder: subclassFeature('Rogue', 'Phantom', source, 'Ghost Walk'),
    label: 'Ghost Walk',
    text: 'Ghost Walk: in spectral form, you have a flying speed of 10 feet and can hover.',
    mode: 'fly',
    amount: 10,
    when: `for 10 minutes in spectral form, ${AFTER_BONUS}`,
    hover: true,
  })),
  ...(['climb', 'swim'] as const).map((mode): MoveRule => ({
    holder: subclassFeature('Rogue', 'Scout', 'XGE', 'Superior Mobility'),
    label: 'Superior Mobility',
    text: 'Superior Mobility: if you have a climbing or swimming speed, the 10-foot increase to your walking speed applies to that speed as well.',
    mode,
    amount: { bonus: 10 },
  })),
  walkSpeed(
    subclassFeature('Rogue', 'Thief', 'XPHB', 'Second-Story Work'),
    'Second-Story Work',
    'Second-Story Work, Climber: you gain a Climb Speed equal to your Speed.',
    'climb',
  ),
  walkSpeed(
    subclassFeature('Sorcerer', 'Draconic', 'PHB', 'Dragon Wings'),
    'Dragon Wings',
    'Dragon Wings: as a bonus action you sprout dragon wings, gaining a flying speed equal to your current speed.',
    'fly',
    { when: `while the wings are out, ${AFTER_BONUS}` },
  ),
  {
    holder: subclassFeature('Sorcerer', 'Draconic', 'XPHB', 'Dragon Wings'),
    label: 'Dragon Wings',
    text: 'Dragon Wings: as a Bonus Action, you can cause draconic wings to appear on your back; for the duration, you have a Fly Speed of 60 feet.',
    mode: 'fly',
    amount: 60,
    when: `for 1 hour ${AFTER_BONUS}`,
  },
  ...(['TCE', 'XPHB'] as const).flatMap((source): MoveRule[] => {
    const holder = subclassFeature(
      'Sorcerer',
      source === 'TCE' ? 'Aberrant Mind' : 'Aberrant',
      source,
      'Revelation in Flesh',
    )
    const when = 'for 10 minutes after the bonus action that spends Sorcery Points on it'
    const text =
      'Revelation in Flesh: you can gain a flying speed equal to your walking speed and hover, or a swimming speed equal to twice your walking speed, each a benefit you choose.'
    return [
      walkSpeed(holder, 'Revelation in Flesh', text, 'fly', { when, hover: true }),
      walkSpeed(holder, 'Revelation in Flesh', text, 'swim', { when, times: 2 }),
    ]
  }),
  {
    holder: subclassFeature('Sorcerer', 'Divine Soul', 'XGE', 'Otherworldly Wings'),
    label: 'Otherworldly Wings',
    text: 'Otherworldly Wings: while the wings are present, you have a flying speed of 30 feet.',
    mode: 'fly',
    amount: 30,
    when: `while the wings are present, ${AFTER_BONUS}`,
  },
  {
    holder: subclassFeature('Sorcerer', 'Storm', 'XGE', 'Wind Soul'),
    label: 'Wind Soul',
    text: 'Wind Soul: you gain a magical flying speed of 60 feet.',
    mode: 'fly',
    amount: 60,
  },
  {
    holder: subclassFeature('Sorcerer', 'Spellfire', 'FRHoF', 'Crown of Spellfire'),
    label: 'Crown of Spellfire',
    text: 'Crown of Spellfire, Flight: while this use of Innate Sorcery is active, you gain a Fly Speed of 60 feet and can hover.',
    mode: 'fly',
    amount: 60,
    when: 'while Innate Sorcery altered by this feature is active',
    hover: true,
  },
  {
    holder: subclassFeature('Warlock', 'Fathomless', 'TCE', 'Gift of the Sea'),
    label: 'Gift of the Sea',
    text: 'Gift of the Sea: you gain a swimming speed of 40 feet.',
    mode: 'swim',
    amount: 40,
  },
  {
    holder: subclassFeature('Warlock', 'Genie', 'TCE', 'Elemental Gift'),
    label: 'Elemental Gift',
    text: 'Elemental Gift: as a bonus action, you can give yourself a flying speed of 30 feet that lasts for 10 minutes, during which you can hover.',
    mode: 'fly',
    amount: 30,
    when: `for 10 minutes ${AFTER_BONUS}`,
    hover: true,
  },
  walkSpeed(
    subclassFeature('Warlock', 'Undead', 'VRGR', 'Spirit Projection'),
    'Spirit Projection',
    'Spirit Projection: while projected, your spirit has a flying speed equal to your walking speed and can hover.',
    'fly',
    { when: 'while your spirit is projected (an action, up to 1 hour)', hover: true },
  ),
  walkSpeed(
    subclassFeature('Warlock', 'Undead', 'RHW', 'Superior Dread'),
    'Superior Dread',
    'Superior Dread, Ghostly Flight: while using Form of Dread, you have a Fly Speed equal to your Speed and can hover.',
    'fly',
    { when: 'while your Form of Dread is active', hover: true },
  ),
  walkSpeed(
    { feat: 'Athlete|XPHB' },
    'Athlete',
    'Athlete, Climb Speed: you gain a Climb Speed equal to your Speed.',
    'climb',
  ),
  {
    holder: { feat: 'Boon of Misty Escape|ABH' },
    label: 'Boon of Misty Escape',
    text: 'Boon of Misty Escape: when you cast Gaseous Form this way, your Fly Speed is 20 feet.',
    mode: 'fly',
    amount: 20,
    when: 'while the Gaseous Form cast with the boon lasts',
  },
  walkSpeed(
    { feat: 'Child of the Sea|WoW' },
    'Child of the Sea',
    'Child of the Sea, Ocean Born: you have a Swim Speed equal to your Speed.',
    'swim',
  ),
  {
    holder: { feat: 'Greater Mark of Storm|EFA' },
    label: 'Greater Mark of Storm',
    text: 'Greater Mark of Storm, Improved Storm: when you cast Gust of Wind with Storm Magic, you also gain a Fly Speed of 60 feet for the duration of the spell.',
    mode: 'fly',
    amount: 60,
    when: 'while the Gust of Wind cast with Storm Magic lasts',
  },
  {
    holder: { feat: 'Vampiric Exultation|PSX' },
    label: 'Vampiric Exultation',
    text: 'Vampiric Exultation: while transformed, you have a flying speed of 30 feet.',
    mode: 'fly',
    amount: 30,
    when: 'while transformed (a bonus action, for 1 minute)',
  },
  ...(['XGE', 'XPHB'] as const).map((source): MoveRule =>
    walkSpeed(
      { option: `Gift of the Depths|${source}` },
      'Gift of the Depths',
      'Gift of the Depths: you gain a swimming speed equal to your walking speed.',
      'swim',
    ),
  ),
  ...(['MPMM', 'XPHB'] as const).map((source): MoveRule =>
    walkSpeed(
      { race: { baseName: 'Aasimar', source } },
      'Celestial Revelation',
      'Celestial Revelation, Heavenly Wings: until the transformation ends, you have a flying speed equal to your walking speed.',
      'fly',
      { when: `for 1 minute ${AFTER_BONUS}, as Heavenly Wings`, fromLevel: 3 },
    ),
  ),
  {
    holder: { race: { baseName: 'Aasimar', source: 'VGM', subraceName: 'Protector' } },
    label: 'Radiant Soul',
    text: 'Radiant Soul: during the transformation, you have a flying speed of 30 feet.',
    mode: 'fly',
    amount: 30,
    when: 'for 1 minute after the action that starts it',
    fromLevel: 3,
  },
  walkSpeed(
    { race: { baseName: 'Dracthyr', source: 'WoW' } },
    'Dracthyr Flight',
    'Dracthyr Flight: as a Bonus Action, you give yourself a Fly Speed equal to your Speed that lasts for 10 minutes.',
    'fly',
    { when: `for 10 minutes ${AFTER_BONUS}` },
  ),
  walkSpeed(
    { race: { baseName: 'Dragonborn', source: 'XPHB' } },
    'Draconic Flight',
    'Draconic Flight: as a Bonus Action, you sprout spectral wings for 10 minutes; during that time, you have a Fly Speed equal to your Speed.',
    'fly',
    { when: `for 10 minutes ${AFTER_BONUS}`, fromLevel: 5 },
  ),
  walkSpeed(
    { race: { baseName: 'Dragonborn (Gem)', source: 'FTD' } },
    'Gem Flight',
    'Gem Flight: as a bonus action, you gain a flying speed equal to your walking speed and can hover, for 1 minute.',
    'fly',
    { when: `for 1 minute ${AFTER_BONUS}`, hover: true, fromLevel: 5 },
  ),
  walkSpeed(
    { race: { baseName: 'Simic Hybrid', source: 'GGR' } },
    'Nimble Climber',
    'Nimble Climber (Animal Enhancement): you have a climbing speed equal to your walking speed.',
    'climb',
    { when: 'with the Nimble Climber enhancement chosen, at 5th level' },
  ),
  walkSpeed(
    { race: { baseName: 'Simic Hybrid', source: 'GGR' } },
    'Underwater Adaptation',
    'Underwater Adaptation (Animal Enhancement): you have a swimming speed equal to your walking speed.',
    'swim',
    { when: 'with the Underwater Adaptation enhancement chosen' },
  ),
  {
    holder: { race: { baseName: 'Goblin', source: 'PSX', subraceName: 'Ixalan' } },
    label: 'Agile Climber',
    text: "Agile Climber: you have a climbing speed of 25 feet. You can't use it while you wear medium or heavy armor.",
    mode: 'climb',
    amount: 25,
    without: 'mediumOrHeavyArmor',
  },
  {
    holder: {
      race: {
        baseName: 'Half-Elf',
        source: 'SCAG',
        subraceName: 'Variant; Aquatic Elf Descent',
      },
    },
    label: 'Swim',
    text: 'Swim (Aquatic Elf Descent): you gain a swimming speed of 30 feet.',
    mode: 'swim',
    amount: 30,
  },
]

/** A way of moving of a species' data that some armor switches off, as its text says. */
export interface MoveLimit {
  holder: Holder
  mode: MoveMode
  without: SpeedLimit
  text: string
}

const flightLimit = (baseName: string, source: string): MoveLimit => ({
  holder: { race: { baseName, source } },
  mode: 'fly',
  without: 'mediumOrHeavyArmor',
  text: `${baseName}, Flight: you can't use this flying speed while you wear medium or heavy armor.`,
})

export const RACE_MOVE_LIMITS: readonly MoveLimit[] = [
  flightLimit('Aarakocra', 'EEPC'),
  flightLimit('Aarakocra', 'MPMM'),
  flightLimit('Aven', 'PSA'),
  flightLimit('Aven', 'PSD'),
  flightLimit('Fairy', 'MPMM'),
  flightLimit('Fairy', 'WBtW'),
  flightLimit('Owlin', 'SCC'),
  flightLimit('Siren', 'PSX'),
  {
    holder: { race: { baseName: 'Kor', source: 'PSZ' } },
    mode: 'climb',
    without: 'heavyArmor',
    text: 'Kor, Climbing: you have a climbing speed of 30 feet as long as you are not wearing heavy armor.',
  },
  {
    holder: {
      race: { baseName: 'Tiefling', source: 'SCAG', subraceName: 'Variant; Winged' },
    },
    mode: 'fly',
    without: 'heavyArmor',
    text: "Winged Tiefling: you have a flying speed of 30 feet while you aren't wearing heavy armor.",
  },
]

/**
 * Heavy armor with a Strength requirement (the item's `strength`, from the Armor table)
 * slows a wearer whose Strength score is lower, in each edition's words.
 */
export const ARMOR_STRENGTH: Readonly<Record<Edition, { feet: number; text: string }>> = {
  classic: {
    feet: 10,
    text: "Armor, Strength (PHB 2014, chapter 5): if the Armor table shows a Strength score for an armor type, the armor reduces the wearer's speed by 10 feet unless the wearer has a Strength score equal to or higher than the listed score.",
  },
  one: {
    feet: 10,
    text: "Armor, Strength (PHB 2024, chapter 6): if the Armor table shows a Strength score for an armor type, the armor reduces the wearer's Speed by 10 feet unless the wearer has a Strength score equal to or higher than the listed score.",
  },
}

export interface ArmorStrengthExempt {
  holder: Holder
  label: string
  text: string
}

/**
 * What keeps armor's Strength requirement from slowing the character. Armor whose own
 * data drops the requirement (mithral) has no `strength` and needs no row. The audit in
 * speedRules.test.ts finds every record that says so.
 */
export const ARMOR_STRENGTH_EXEMPT: readonly ArmorStrengthExempt[] = [
  ...(
    [
      ['Dwarf', 'PHB'],
      ['Dwarf (Kaladesh)', 'PSK'],
    ] as const
  ).map(([baseName, source]): ArmorStrengthExempt => ({
    holder: { race: { baseName, source } },
    label: baseName,
    text: `${baseName}, Speed: your speed is not reduced by wearing heavy armor.`,
  })),
  ...(['DMG', 'XDMG'] as const).map((source): ArmorStrengthExempt => ({
    holder: { item: `Boots of Striding and Springing|${source}` },
    label: 'Boots of Striding and Springing',
    text: "Boots of Striding and Springing: while you wear these boots, your speed isn't reduced by wearing heavy armor.",
  })),
  ...(['TCE', 'EFA'] as const).map((source): ArmorStrengthExempt => ({
    holder: subclassFeature('Artificer', 'Armorer', source, 'Arcane Armor'),
    label: 'Arcane Armor',
    text: 'Arcane Armor: if the armor normally has a Strength requirement, the arcane armor lacks this requirement for you.',
  })),
]

/**
 * The items whose speed holds only after something is done (a potion drunk, a charge
 * spent, a command word spoken), by item key, with when it holds. An item with a speed in
 * its data (`modifySpeed`) and not here changes the speed for as long as it is equipped
 * (and attuned, when it needs attunement). The audit in speedRules.test.ts fails when an
 * item that names an action beside its speed is in neither this table nor its list of
 * items whose action is for something else.
 */
export const ITEM_SPEED_WHEN: Readonly<Record<string, string>> = {
  'Amethyst Lodestone|FTD': 'for 10 minutes after you spend a charge (a bonus action)',
  'Boots of Speed|DMG': "while the boots' heels are clicked together (a bonus action)",
  'Boots of Speed|XDMG': "while the boots' heels are clicked together (a Bonus Action)",
  'Cloak of the Manta Ray|DMG': 'with the hood up',
  'Crown of Whirling Comets|BMT':
    'for 10 minutes after you spend a charge (a bonus action)',
  'Deck of Many More Things|BMT': 'after you draw the card that gives it',
  'Dekella, Bident of Thassa|MOT': 'for a worshiper of Thassa with a piety of 10 or more',
  'Eagle Whistle|TftYP': 'while you blow the whistle',
  'Medal of the Conch|CRCotN': 'for 1 hour after you rub the medal (an action)',
  'Nimbus Coronet|BGG': 'in cloud form, after you invoke the rune (an action)',
  'Pennant of the Vind Rune|SKT': 'once the rune is moved onto armor you wear',
  'Potion of Aqueous Form|MOT': 'for 10 minutes after you drink it',
  'Potion of Climbing|DMG': 'for 1 hour after you drink it',
  'Potion of Climbing|XDMG': 'for 1 hour after you drink it',
  'Potion of Flying|DMG': 'for 1 hour after you drink it',
  'Potion of Flying|XDMG': 'for 1 hour after you drink it',
  'Ring of Air Elemental Command|DMG': 'once you help slay an air elemental',
  'Teeth of Dahlver-Nar|TCE': 'with the tooth that gives it implanted',
  'The Infernal Machine of Lum the Mad|IMR': 'with the property that gives it',
  'Winged Boots|XDMG': 'for 1 hour after you spend a charge (a Magic action)',
  'Wings of Flying|DMG': 'for 1 hour after you speak the command word (an action)',
  'Wings of Flying|XDMG':
    'for 1 hour after you turn the cloak into wings (a Magic action)',
  'Wingwear|PotA': 'until you land, after you spend a charge (a bonus action)',
}

// What changes the initiative roll and the passive scores of a character, which the data
// gives in text. Each row names its holder, so the audit in combatRules.test.ts can tell a
// feature that is covered from one a book added.

import type { AbilityKey } from '../dice/dice'
import type { Edition } from '../data/edition'
import type { Holder } from './holder'

export type InitiativeEffect =
  /** A fixed bonus (Alert of the 2014 book). */
  | { kind: 'flat'; amount: number }
  /** The modifier of an ability is added. */
  | { kind: 'ability'; ability: AbilityKey }
  /** The proficiency bonus is added. */
  | { kind: 'proficiency' }
  /** Half the proficiency bonus, to a check that does not already use it. */
  | { kind: 'half'; round: 'down' | 'up'; checks: 'any' | 'strDexCon' }
  /** Advantage on the roll: shown, not a number. */
  | { kind: 'advantage' }

export interface InitiativeRule {
  holder: Holder
  label: string
  text: string
  effect: InitiativeEffect
}

export interface PassiveRule {
  holder: Holder
  label: string
  text: string
  /** The skills whose passive score it raises. */
  skills: string[]
  amount: number
}

const feat = (name: string, source: string): Holder => ({ feat: `${name}|${source}` })
const classFeature = (className: string, source: string, name: string): Holder => ({
  classFeature: { className, source, name },
})
const subclassFeature = (
  className: string,
  shortName: string,
  source: string,
  name: string,
): Holder => ({ subclassFeature: { className, shortName, source, name } })

export const INITIATIVE_RULES: readonly InitiativeRule[] = [
  {
    holder: feat('Alert', 'PHB'),
    label: 'Alert',
    text: 'Alert: you gain a +5 bonus to initiative.',
    effect: { kind: 'flat', amount: 5 },
  },
  {
    holder: feat('Alert', 'XPHB'),
    label: 'Alert',
    text: 'Alert, Initiative Proficiency: when you roll Initiative, you can add your proficiency bonus to the roll.',
    effect: { kind: 'proficiency' },
  },
  {
    holder: { race: { baseName: 'Harengon', source: 'MPMM' } },
    label: 'Hare-Trigger',
    text: 'Harengon, Hare-Trigger: you can add your proficiency bonus to your initiative rolls.',
    effect: { kind: 'proficiency' },
  },
  {
    holder: { race: { baseName: 'Harengon', source: 'WBtW' } },
    label: 'Hare-Trigger',
    text: 'Harengon, Hare-Trigger: you can add your proficiency bonus to your initiative rolls.',
    effect: { kind: 'proficiency' },
  },
  {
    holder: classFeature('Bard', 'PHB', 'Jack of All Trades'),
    label: 'Jack of All Trades',
    text: "Jack of All Trades: you add half your proficiency bonus, rounded down, to any ability check that doesn't already include it.",
    effect: { kind: 'half', round: 'down', checks: 'any' },
  },
  {
    holder: classFeature('Bard', 'XPHB', 'Jack of All Trades'),
    label: 'Jack of All Trades',
    text: "Jack of All Trades: you add half your proficiency bonus (round down) to an ability check that doesn't otherwise use it.",
    effect: { kind: 'half', round: 'down', checks: 'any' },
  },
  {
    holder: subclassFeature('Fighter', 'Champion', 'PHB', 'Remarkable Athlete'),
    label: 'Remarkable Athlete',
    text: "Champion, Remarkable Athlete: you add half your proficiency bonus (round up) to a Strength, Dexterity or Constitution check that doesn't already use it.",
    effect: { kind: 'half', round: 'up', checks: 'strDexCon' },
  },
  {
    holder: subclassFeature('Fighter', 'Champion', 'XPHB', 'Remarkable Athlete'),
    label: 'Remarkable Athlete',
    text: 'Champion, Remarkable Athlete: you have advantage on Initiative rolls.',
    effect: { kind: 'advantage' },
  },
  {
    holder: subclassFeature('Wizard', 'War', 'XGE', 'Tactical Wit'),
    label: 'Tactical Wit',
    text: 'War Magic, Tactical Wit: you can add your Intelligence modifier to your initiative rolls.',
    effect: { kind: 'ability', ability: 'int' },
  },
  {
    holder: subclassFeature('Wizard', 'Chronurgy', 'EGW', 'Temporal Awareness'),
    label: 'Temporal Awareness',
    text: 'Chronurgy Magic, Temporal Awareness: you can add your Intelligence modifier to your initiative rolls.',
    effect: { kind: 'ability', ability: 'int' },
  },
  {
    holder: subclassFeature('Rogue', 'Swashbuckler', 'XGE', 'Rakish Audacity'),
    label: 'Rakish Audacity',
    text: 'Swashbuckler, Rakish Audacity: you can add your Charisma modifier to your initiative rolls.',
    effect: { kind: 'ability', ability: 'cha' },
  },
  {
    holder: subclassFeature('Rogue', 'Swashbuckler', 'WoW', 'Rakish Audacity'),
    label: 'Rakish Audacity',
    text: 'Swashbuckler, Rakish Audacity: when you roll Initiative, you can add your Charisma modifier to the roll.',
    effect: { kind: 'ability', ability: 'cha' },
  },
  {
    holder: subclassFeature('Ranger', 'Gloom Stalker', 'XGE', 'Dread Ambusher'),
    label: 'Dread Ambusher',
    text: 'Gloom Stalker, Dread Ambusher: you can add your Wisdom modifier to your initiative rolls.',
    effect: { kind: 'ability', ability: 'wis' },
  },
  {
    holder: classFeature('Barbarian', 'PHB', 'Feral Instinct'),
    label: 'Feral Instinct',
    text: 'Feral Instinct: you have advantage on initiative rolls.',
    effect: { kind: 'advantage' },
  },
  {
    holder: classFeature('Barbarian', 'XPHB', 'Feral Instinct'),
    label: 'Feral Instinct',
    text: 'Feral Instinct: you have advantage on Initiative rolls.',
    effect: { kind: 'advantage' },
  },
  {
    holder: subclassFeature('Rogue', 'Scout', 'XGE', 'Ambush Master'),
    label: 'Ambush Master',
    text: 'Scout, Ambush Master: you have advantage on initiative rolls.',
    effect: { kind: 'advantage' },
  },
  {
    holder: subclassFeature('Rogue', 'Assassin', 'XPHB', 'Assassinate'),
    label: 'Assassinate',
    text: 'Assassin, Assassinate: you have Advantage on Initiative rolls.',
    effect: { kind: 'advantage' },
  },
  {
    holder: subclassFeature('Cleric', 'Twilight', 'TCE', 'Vigilant Blessing'),
    label: 'Vigilant Blessing',
    text: 'Twilight Domain, Vigilant Blessing: you can give a creature advantage on its next initiative roll.',
    effect: { kind: 'advantage' },
  },
]

export const PASSIVE_RULES: readonly PassiveRule[] = [
  {
    holder: feat('Observant', 'PHB'),
    label: 'Observant',
    text: 'Observant: you have a +5 bonus to your passive Wisdom (Perception) and passive Intelligence (Investigation) scores.',
    skills: ['perception', 'investigation'],
    amount: 5,
  },
]

/** The skills with a passive score on the sheet. */
export const PASSIVE_SKILLS = ['perception', 'investigation', 'insight'] as const

/** The skill a passive score is for. */
export type PassiveSkill = (typeof PASSIVE_SKILLS)[number]

/**
 * Advantage on a check raises its passive score by 5 and disadvantage lowers it by 5; one
 * of each cancels, and several of one kind count once, as for a roll.
 */
export const PASSIVE_EDGE: Record<Edition, { amount: number; text: string }> = {
  classic: {
    amount: 5,
    text: 'Passive checks (PHB 2014, chapter 7): if you have advantage on the check, add 5; for disadvantage, subtract 5.',
  },
  one: {
    amount: 5,
    text: 'Passive Perception (PHB 2024, Rules Glossary): with advantage on such checks the score increases by 5; with disadvantage it decreases by 5.',
  },
}

/** Advantage or disadvantage on the checks of a passive score, from what the character has. */
export interface PassiveEdgeRule {
  holder: Holder
  label: string
  text: string
  skills: readonly PassiveSkill[]
  edge: 'advantage' | 'disadvantage'
  /** A condition the sheet cannot check: the line shows, but is not counted. */
  when?: string
}

const item = (key: string): Holder => ({ item: key })
const race = (baseName: string, source: string, subraceName?: string): Holder => ({
  race: { baseName, source, ...(subraceName ? { subraceName } : {}) },
})

const SIGHT = 'Only for checks that rely on sight.'
const SUNLIGHT = 'Only for checks that rely on sight, in direct sunlight.'

const edge = (
  holder: Holder,
  label: string,
  text: string,
  skills: readonly PassiveSkill[],
  when?: string,
  kind: PassiveEdgeRule['edge'] = 'advantage',
): PassiveEdgeRule => ({
  holder,
  label,
  text: `${label}: ${text}`,
  skills,
  edge: kind,
  ...(when ? { when } : {}),
})

const sunlightSensitivity = (holder: Holder): PassiveEdgeRule =>
  edge(
    holder,
    'Sunlight Sensitivity',
    'you have disadvantage on Wisdom (Perception) checks that rely on sight when you, or whatever you are trying to perceive, is in direct sunlight.',
    ['perception'],
    SUNLIGHT,
    'disadvantage',
  )

export const PASSIVE_EDGE_RULES: readonly PassiveEdgeRule[] = [
  edge(
    item('Ioun Stone, Awareness|XDMG'),
    'Ioun Stone, Awareness',
    'while it orbits your head, you have advantage on Wisdom (Perception) checks.',
    ['perception'],
  ),
  ...['DMG', 'XDMG'].flatMap((source) => [
    edge(
      item(`Rod of Alertness|${source}`),
      'Rod of Alertness',
      'while holding the rod, you have advantage on Wisdom (Perception) checks.',
      ['perception'],
    ),
    edge(
      item(`Sentinel Shield|${source}`),
      'Sentinel Shield',
      'while holding this shield, you have advantage on Wisdom (Perception) checks.',
      ['perception'],
    ),
    edge(
      item(`Eyes of the Eagle|${source}`),
      'Eyes of the Eagle',
      'while wearing them, you have advantage on Wisdom (Perception) checks that rely on sight.',
      ['perception'],
      SIGHT,
    ),
    edge(
      item(`Robe of Eyes|${source}`),
      'Robe of Eyes',
      'you have advantage on Wisdom (Perception) checks that rely on sight.',
      ['perception'],
      SIGHT,
    ),
    edge(
      item(`Eyes of Minute Seeing|${source}`),
      'Eyes of Minute Seeing',
      'you have advantage on Intelligence (Investigation) checks to examine something within 1 foot.',
      ['investigation'],
      'Only for something within 1 foot of you.',
    ),
  ]),
  edge(
    item('Stonespeaker Crystal|OotA'),
    'Stonespeaker Crystal',
    'it grants you advantage on Intelligence (Investigation) checks while it is on your person.',
    ['investigation'],
  ),
  edge(
    item('Sword of Zariel|BGDIA'),
    'Sword of Zariel',
    'while holding the sword, you gain advantage on all Wisdom (Insight) checks.',
    ['insight'],
  ),
  edge(
    item('Helm of Perfect Potential|BGG'),
    'Helm of Perfect Potential',
    'while wearing the helm, you have advantage on Wisdom (Insight) checks.',
    ['insight'],
  ),
  edge(
    { option: 'Stone Rune|TCE' },
    'Stone Rune',
    'while wearing or carrying an object inscribed with this rune, you have advantage on Wisdom (Insight) checks.',
    ['insight'],
  ),
  edge(
    race('Elf', 'EGW', 'Pallid'),
    'Incisive Sense',
    'you have advantage on Intelligence (Investigation) and Wisdom (Insight) checks.',
    ['investigation', 'insight'],
  ),
  edge(
    item("Danoth's Visor (Dormant)|EGW"),
    "Danoth's Visor",
    'you have advantage on Intelligence (Investigation) and Wisdom (Perception) checks that rely on sight.',
    ['investigation', 'perception'],
    SIGHT,
  ),
  edge(
    item("Knave's Eye Patch|WDH"),
    "Knave's Eye Patch",
    'you have advantage on Wisdom (Perception) checks that rely on sight.',
    ['perception'],
    SIGHT,
  ),
  edge(
    item('Watchful Helm|CM'),
    'Watchful Helm',
    'while you wear this helm, you have advantage on Wisdom (Perception) checks that rely on sight.',
    ['perception'],
    SIGHT,
  ),
  edge(
    item('Verminshroud (Dormant)|EGW'),
    'Verminshroud',
    'you have advantage on Wisdom (Perception) checks that rely on smell.',
    ['perception'],
    'Only for checks that rely on smell.',
  ),
  edge(
    item('Grovelthrash (Dormant)|EGW'),
    'Grovelthrash',
    'while holding this weapon, you have advantage on Wisdom (Insight) checks made to discern a lie spoken in a language you understand.',
    ['insight'],
    'Only to discern a lie spoken in a language you understand.',
  ),
  edge(
    item('Ring of Truth Telling|WDH'),
    'Ring of Truth Telling',
    'while wearing this ring, you have advantage on Wisdom (Insight) checks to determine whether someone is lying to you.',
    ['insight'],
    'Only to tell whether someone is lying to you.',
  ),
  edge(
    item('Sorcerous Spyglass|XMtS'),
    'Sorcerous Spyglass',
    'a creature looking through the spyglass has advantage on Wisdom (Perception) checks to detect things that can be seen.',
    ['perception'],
    'Only while looking through the spyglass.',
  ),
  edge(
    race('Grimlock', 'DMG'),
    'Keen Hearing and Smell',
    'you have advantage on Wisdom (Perception) checks that rely on hearing or smell.',
    ['perception'],
    'Only for checks that rely on hearing or smell.',
  ),
  edge(
    race('Loxodon', 'GGR'),
    'Keen Smell',
    'you have advantage on Wisdom (Perception) and Intelligence (Investigation) checks that involve smell.',
    ['perception', 'investigation'],
    'Only for checks that involve smell.',
  ),
  edge(
    subclassFeature('Rogue', 'Inquisitive', 'XGE', 'Steady Eye'),
    'Steady Eye',
    'you have advantage on any Wisdom (Perception) or Intelligence (Investigation) check if you move no more than half your speed on the same turn.',
    ['perception', 'investigation'],
    'Only if you move no more than half your speed on the turn.',
  ),
  edge(
    feat('Dungeon Delver', 'PHB'),
    'Dungeon Delver',
    'you have advantage on Wisdom (Perception) and Intelligence (Investigation) checks made to detect the presence of secret doors.',
    ['perception', 'investigation'],
    'Only to detect secret doors.',
  ),
  sunlightSensitivity(race('Kobold', 'DMG')),
  sunlightSensitivity(race('Kobold', 'VGM')),
  sunlightSensitivity(race('Kuo-Toa', 'DMG')),
  sunlightSensitivity(race('Troglodyte', 'DMG')),
  sunlightSensitivity(race('Dwarf', 'MTF', 'Duergar')),
  sunlightSensitivity(race('Elf', 'PHB', 'Drow')),
  sunlightSensitivity(race('Elf (Zendikar)', 'PSZ', 'Mul Daya Nation')),
  edge(
    item('The Infernal Machine of Lum the Mad|IMR'),
    'The Infernal Machine of Lum the Mad',
    'while in direct sunlight, you have disadvantage on Wisdom (Perception) checks that rely on sight.',
    ['perception'],
    SUNLIGHT,
    'disadvantage',
  ),
]

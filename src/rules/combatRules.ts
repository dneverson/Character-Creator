// What changes the initiative roll and the passive scores of a character, which the data
// gives in text. Each row names its holder, so the audit in combatRules.test.ts can tell a
// feature that is covered from one a book added.

import type { AbilityKey } from '../dice/dice'
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

// What adds to walking speed that the data gives in text only: Fast Movement, Unarmored
// Movement, Roving and the feats that make a character quicker. A row names its holder, so
// the audit in speedRules.test.ts can tell a feature covered here from one a book added.
// The speed of a species is data and is read from it.

import type { Holder } from './holder'

/** Armor that switches the bonus off. */
export type SpeedLimit = 'heavyArmor' | 'anyArmor'

export interface SpeedRule {
  holder: Holder
  label: string
  text: string
  /** Feet added; a list of [class level, feet] steps for a bonus that grows with the class. */
  amount: number | readonly (readonly [number, number])[]
  /** What the character may not wear for the bonus to count. */
  without?: SpeedLimit
}

const classFeature = (className: string, source: string, name: string): Holder => ({
  classFeature: { className, source, name },
})

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

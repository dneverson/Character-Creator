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

// The 2024 features and feats that let a character use the mastery property of kinds of
// weapons it chooses. How many kinds a class feature gives is the Weapon Mastery column of
// the class's table where it has one, and the number its text names otherwise (a class of
// another book that takes in the feature, without the column). What kinds qualify and how
// many a long rest lets the character change are in the text only, so each is a row here.
// The audit in weaponMastery.test.ts fails when a book adds a feature or feat that gives
// mastery properties and is neither here nor excused with its reason.

import type { Holder } from './holder'

/** The column of a class's table that counts the kinds of weapons mastered. */
export const MASTERY_COLUMN = 'Weapon Mastery'

export interface MasteryGrant {
  holder: Holder
  /** How many kinds, where the class's table has no Weapon Mastery column. */
  count: number
  /** Only melee weapons qualify (a Barbarian's). */
  melee?: true
  /** Only weapons the character is proficient with qualify. */
  proficient?: true
  /** How many of the kinds the character can change when it finishes a long rest. */
  changes: 'one' | 'all'
  /** The rule in plain words. */
  text: string
}

const xphb = (className: string): Holder => ({
  classFeature: { className, source: 'XPHB', name: 'Weapon Mastery' },
})

export const MASTERY_GRANTS: readonly MasteryGrant[] = [
  {
    holder: xphb('Barbarian'),
    count: 2,
    melee: true,
    changes: 'one',
    text: 'Simple or Martial Melee weapons; one can be changed on finishing a Long Rest.',
  },
  {
    holder: xphb('Fighter'),
    count: 3,
    changes: 'one',
    text: 'Simple or Martial weapons; one can be changed on finishing a Long Rest.',
  },
  ...['Paladin', 'Ranger', 'Rogue'].map((className): MasteryGrant => ({
    holder: xphb(className),
    count: 2,
    proficient: true,
    changes: 'all',
    text: 'Weapons you are proficient with; all can be changed on finishing a Long Rest.',
  })),
  {
    holder: { feat: 'Weapon Master|XPHB' },
    count: 1,
    proficient: true,
    changes: 'all',
    text: 'A Simple or Martial weapon you are proficient with; it can be changed on finishing a Long Rest.',
  },
]

// The class features that give expertise (the proficiency bonus counted twice) as the
// player's pick of skills they are proficient in. The data gives a feat's expertise as a
// list, which the sheet reads like every other grant; a class feature gives it in text,
// so each is a row here. Two features of one name differ only by the level they arrive at
// (Rogue's Expertise at 1 and at 6), so a row carries its level.

import type { Holder } from './holder'

export interface ExpertiseGrant {
  holder: Holder
  /** The level of the class it arrives at, when the data names two features alike. */
  level?: number
  /** How many skills (or tools) it gives expertise in. */
  count: number
  /** The skills it is limited to; any skill the character is proficient in when absent. */
  skills?: string[]
  /** Thieves' tools can be picked as well as skills. */
  thievesTools?: true
  /** The rule in plain words. */
  text: string
}

const classFeature = (className: string, source: string, name: string): Holder => ({
  classFeature: { className, source, name },
})

const TWO_SKILLS = 'you gain expertise in two of your skill proficiencies of your choice.'
const TWO_OR_THIEVES =
  "you gain expertise in two of your skill proficiencies, or one skill and thieves' tools."

export const EXPERTISE_GRANTS: readonly ExpertiseGrant[] = [
  ...(['PHB', 'XPHB'] as const).flatMap((source) =>
    [1, 6].map((level): ExpertiseGrant => ({
      holder: classFeature('Rogue', source, 'Expertise'),
      level,
      count: 2,
      ...(source === 'PHB' ? { thievesTools: true as const } : {}),
      text: `Rogue, Expertise: ${source === 'PHB' ? TWO_OR_THIEVES : TWO_SKILLS}`,
    })),
  ),
  ...(
    [
      ['PHB', 3],
      ['PHB', 10],
      ['XPHB', 2],
      ['XPHB', 9],
    ] as const
  ).map(([source, level]): ExpertiseGrant => ({
    holder: classFeature('Bard', source, 'Expertise'),
    level,
    count: 2,
    text: `Bard, Expertise: ${TWO_SKILLS}`,
  })),
  {
    holder: classFeature('Ranger', 'XPHB', 'Deft Explorer'),
    count: 1,
    text: 'Ranger, Deft Explorer: you gain expertise in one of your skill proficiencies.',
  },
  {
    holder: classFeature('Ranger', 'XPHB', 'Expertise'),
    count: 2,
    text: `Ranger, Expertise: ${TWO_SKILLS}`,
  },
  {
    holder: classFeature('Demon Hunter', 'WoW', 'Deft Explorer'),
    count: 1,
    text: 'Demon Hunter, Deft Explorer: you gain expertise in one of your skill proficiencies.',
  },
  {
    holder: classFeature('Wizard', 'XPHB', 'Scholar'),
    count: 1,
    skills: ['arcana', 'history', 'investigation', 'medicine', 'nature', 'religion'],
    text: 'Wizard, Scholar: you gain expertise in one of Arcana, History, Investigation, Medicine, Nature or Religion that you are proficient in.',
  },
]
